import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WebchatsService } from '../webchats/webchat.service';
import { PaymentsSettingsService } from './payments-settings.service';
import { WebchatAssetsService } from './webchat-assets.service';
import { cancelCharge, createPixCharge, getChargeStatus } from './pix-providers';

// Cobrança PIX disparada por uma sequência do funil do webchat (ending.type='charge').
// Regras:
//  - o VALOR vem do funil salvo no banco (settings.personalizacao.funil), nunca do cliente;
//  - o lead não informa nada (pagador = placeholder derivado da sessão);
//  - PIX expira em 30 min; reconciliação por webhook + cron + polling do front;
//  - a ENTREGA (mensagens da sequência "após pagamento", com URLs assinadas dos
//    arquivos) só sai daqui quando status = PAID.
export const CHARGE_TTL_MIN = 30;
const BRL = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type RateBucket = { count: number; resetAt: number };

@Injectable()
export class WebchatPaymentsService {
  private readonly logger = new Logger(WebchatPaymentsService.name);
  // Rate-limit em memória (rotas públicas): cobranças por sessão/hora e por IP/hora.
  private readonly buckets = new Map<string, RateBucket>();
  // Serializa criações concorrentes da MESMA sessão (duplo clique) — A-96.
  private readonly sessionLocks = new Map<string, Promise<unknown>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly webchats: WebchatsService,
    private readonly settings: PaymentsSettingsService,
    private readonly assets: WebchatAssetsService,
  ) {}

  // ---------------------------------------------------------------- helpers
  private hit(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    const b = this.buckets.get(key);
    if (!b || b.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      if (this.buckets.size > 5000) {
        for (const [k, v] of this.buckets) if (v.resetAt <= now) this.buckets.delete(k);
      }
      return true;
    }
    b.count += 1;
    return b.count <= limit;
  }

  // Executa `fn` só depois que a criação anterior da mesma sessão terminou.
  private async withSessionLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.sessionLocks.get(key) || Promise.resolve();
    const run = prev.catch(() => undefined).then(fn);
    this.sessionLocks.set(key, run);
    try {
      return await run;
    } finally {
      if (this.sessionLocks.get(key) === run) this.sessionLocks.delete(key);
    }
  }

  // Transição condicional PENDING→status (A-23): nunca sobrescreve um PAID que
  // chegou por outro caminho (webhook/cron/polling). Devolve a linha recarregada.
  private async transitionFromPending(id: string, status: 'EXPIRED' | 'FAILED') {
    await this.prisma.webchat_payments.updateMany({ where: { id, status: 'PENDING' }, data: { status } });
    return (await this.prisma.webchat_payments.findUnique({ where: { id } }))!;
  }

  // Cancela no gateway (best-effort) para o QR parar de aceitar pagamento.
  private async cancelAtGateway(p: any) {
    try {
      const gw = await this.prisma.telegram_payment_settings.findUnique({ where: { organization_id: p.organization_id } });
      if (!gw?.access_token || !p.provider_charge_id) return;
      const r = await cancelCharge(p.provider, gw.access_token, p.provider_charge_id);
      if (!r.ok) this.logger.warn(`cancelCharge ${p.id} (${p.provider}): ${r.error}`);
    } catch (e: any) {
      this.logger.warn(`cancelCharge ${p.id}: ${e?.message || e}`);
    }
  }

  // Vencida localmente: reconfere UMA vez no gateway antes de expirar (o lead
  // pode ter pago no último segundo) e, se não pagou, expira + cancela lá (A-22).
  private async expireIfUnpaid(p: any) {
    const checked = await this.checkPayment(p).catch(() => p);
    if (checked.status !== 'PENDING') return checked;
    const row = await this.transitionFromPending(p.id, 'EXPIRED');
    if (row.status === 'EXPIRED') await this.cancelAtGateway(row);
    return row;
  }

  private normalizeSessionId(v: unknown) {
    const s = String(v ?? '').trim().slice(0, 100);
    if (!s) throw new BadRequestException('session_id obrigatório.');
    return s;
  }

  private funilOf(webchat: any) {
    const settings = webchat?.settings && typeof webchat.settings === 'object' ? webchat.settings : {};
    const pers = settings.personalizacao && typeof settings.personalizacao === 'object' ? settings.personalizacao : settings;
    const funil = pers?.funil;
    return funil && typeof funil === 'object' ? funil : null;
  }

  // Sequência de cobrança válida (existe, ending.type='charge', valor > 0).
  private chargeSequence(webchat: any, sequenceId: string) {
    const funil = this.funilOf(webchat);
    const seq = funil?.sequences?.[sequenceId];
    const ending = seq?.ending;
    if (!seq || !ending || ending.type !== 'charge') throw new BadRequestException('Esta etapa do funil não é uma cobrança.');
    const charge = ending.charge && typeof ending.charge === 'object' ? ending.charge : {};
    const amount = Math.round(Number(charge.amountCents) || 0);
    if (amount <= 0) throw new BadRequestException('Cobrança sem valor configurado.');
    return { funil, seq, charge, amount };
  }

  private toPublic(p: any, extra: any = {}) {
    return {
      id: p.id,
      sequence_id: p.sequence_id,
      status: p.status,
      amount_cents: p.amount_cents,
      amount_label: BRL(p.amount_cents),
      description: p.description,
      pix_code: p.status === 'PENDING' ? p.pix_code : null,
      qr_base64: p.status === 'PENDING' ? p.qr_base64 : null,
      expires_at: p.expires_at,
      paid_at: p.paid_at,
      created_at: p.created_at,
      ...extra,
    };
  }

  // ---------------------------------------------------------------- público
  async createCharge(slug: string, domainHint: string | undefined, body: any, ip: string) {
    const sessionId = this.normalizeSessionId(body?.session_id);
    const sequenceId = String(body?.sequence_id || '').trim().slice(0, 80);
    if (!sequenceId) throw new BadRequestException('sequence_id obrigatório.');
    if (!this.hit(`s:${sessionId}`, 8, 3600_000) || !this.hit(`ip:${ip}`, 40, 3600_000)) {
      throw new BadRequestException('Muitas cobranças geradas. Aguarde alguns minutos.');
    }

    // Duplo clique / 2 abas: a 2ª criação espera a 1ª e reaproveita o PENDING.
    return this.withSessionLock(`${slug}:${sessionId}:${sequenceId}`, () =>
      this.createChargeLocked(slug, domainHint, body, ip, sessionId, sequenceId),
    );
  }

  private async createChargeLocked(
    slug: string,
    domainHint: string | undefined,
    body: any,
    ip: string,
    sessionId: string,
    sequenceId: string,
  ) {
    const webchat = await this.webchats.resolvePublicWebchat(slug, domainHint);
    const { charge, amount } = this.chargeSequence(webchat, sequenceId);
    const gw = await this.settings.require(webchat.organization_id);
    if (!gw) throw new BadRequestException('Pagamento indisponível no momento (gateway não configurado).');

    // Reaproveita cobrança PENDING ainda válida da mesma sessão/etapa (F5, clique duplo).
    const existing = await this.prisma.webchat_payments.findFirst({
      where: { webchat_id: webchat.id, session_id: sessionId, sequence_id: sequenceId, status: 'PENDING', expires_at: { gt: new Date() } },
      orderBy: { created_at: 'desc' },
    });
    if (existing && existing.amount_cents === amount) return this.toPublic(existing);

    const description = String(charge.description || webchat.name || 'Pagamento').trim().slice(0, 200) || 'Pagamento';
    const payerRef = createHash('sha1').update(`${webchat.id}:${sessionId}`).digest('hex').slice(0, 12);
    const res = await createPixCharge(gw.provider, gw.access_token!, amount, description, {
      payerRef,
      name: 'Cliente',
      webhookUrl: this.settings.webhookUrl(gw.provider),
      expiresInMin: CHARGE_TTL_MIN,
      // Determinística por janela de 1 min (A-96): retry/duplo clique no mesmo
      // minuto não gera 2 PIX no gateway.
      idempotency: `wc-${webchat.id}-${sessionId}-${sequenceId}-${Math.floor(Date.now() / 60000)}`,
    });
    if (!res.ok || !res.chargeId) {
      this.logger.warn(`createPixCharge falhou (${gw.provider}) webchat=${webchat.id}: ${res.error}`);
      throw new BadRequestException('Não foi possível gerar o PIX agora. Tente novamente em instantes.');
    }
    const row = await this.prisma.webchat_payments.create({
      data: {
        organization_id: webchat.organization_id,
        webchat_id: webchat.id,
        session_id: sessionId,
        sequence_id: sequenceId,
        provider: gw.provider,
        provider_charge_id: res.chargeId,
        amount_cents: amount,
        description: description.slice(0, 255),
        status: 'PENDING',
        pix_code: res.pixCode || null,
        qr_base64: res.qrBase64 || null,
        context: { domain: domainHint || null, page_url: String(body?.page_url || '').slice(0, 500) || null, ip },
        expires_at: new Date(Date.now() + CHARGE_TTL_MIN * 60_000),
      },
    });
    return this.toPublic(row);
  }

  // Status (+ entrega quando PAID). `check=true` reconfere no gateway (botão "Validar").
  async getStatus(slug: string, domainHint: string | undefined, paymentId: string, sessionIdRaw: unknown, check: boolean) {
    const sessionId = this.normalizeSessionId(sessionIdRaw);
    const webchat = await this.webchats.resolvePublicWebchat(slug, domainHint);
    let p: any = await this.prisma.webchat_payments.findFirst({ where: { id: paymentId, webchat_id: webchat.id, session_id: sessionId } });
    if (!p) throw new NotFoundException('Cobrança não encontrada.');

    if (p.status === 'PENDING') {
      if (p.expires_at && p.expires_at.getTime() <= Date.now()) {
        p = await this.expireIfUnpaid(p);
      } else {
        // Reconfere no gateway: no "Validar pagamento" no máx. 1x a cada 2s
        // por cobrança (A-24); no polling do front, 1x a cada 4s (não martela a API).
        const allowed = check ? this.hit(`check:${p.id}`, 1, 2000) : this.hit(`poll:${p.id}`, 1, 4000);
        if (allowed) p = await this.checkPayment(p);
      }
    }
    const delivery = p.status === 'PAID' ? await this.buildDelivery(webchat, p) : null;
    return this.toPublic(p, { delivery });
  }

  // ---------------------------------------------------------------- núcleo
  async checkPayment(p: any): Promise<any> {
    if (p.status === 'PAID') return p;
    const gw = await this.prisma.telegram_payment_settings.findUnique({ where: { organization_id: p.organization_id } });
    if (!gw?.access_token || !p.provider_charge_id) return p;
    const r = await getChargeStatus(p.provider, gw.access_token, p.provider_charge_id);
    if (!r.ok || !r.status) return p;
    if (r.status === 'PAID') return this.markPaid(p.id);
    // Só PENDING vira EXPIRED/FAILED, e de forma condicional (A-23).
    if (p.status === 'PENDING' && r.status !== 'PENDING') {
      return this.transitionFromPending(p.id, r.status);
    }
    return p;
  }

  // Transição atômica PENDING→PAID (webhook + cron + front podem chegar juntos).
  private async markPaid(id: string) {
    await this.prisma.webchat_payments.updateMany({ where: { id, status: { not: 'PAID' } }, data: { status: 'PAID', paid_at: new Date() } });
    return (await this.prisma.webchat_payments.findUnique({ where: { id } }))!;
  }

  async handleWebhookCharge(provider: string, chargeId: string) {
    const p = await this.prisma.webchat_payments.findFirst({ where: { provider, provider_charge_id: chargeId }, orderBy: { created_at: 'desc' } });
    if (!p) return false;
    await this.checkPayment(p);
    return true;
  }

  // Cron: expira vencidas (reconferindo no gateway antes) e reconfere as
  // pendentes (rede de segurança sem webhook). Também revisita EXPIRED das
  // últimas 24h — pagamento "atrasado" no MP vira PAID e entrega no próximo fetch (A-22).
  async reconcilePending() {
    const now = new Date();
    const overdue = await this.prisma.webchat_payments.findMany({
      where: { status: 'PENDING', expires_at: { lte: now } },
      orderBy: { created_at: 'asc' },
      take: 200,
    });
    for (const p of overdue) {
      try { await this.expireIfUnpaid(p); } catch (e: any) { this.logger.warn(`expire ${p.id}: ${e?.message || e}`); }
    }
    const pending = await this.prisma.webchat_payments.findMany({ where: { status: 'PENDING', expires_at: { gt: now } }, orderBy: { created_at: 'asc' }, take: 200 });
    for (const p of pending) {
      try { await this.checkPayment(p); } catch (e: any) { this.logger.warn(`reconcile ${p.id}: ${e?.message || e}`); }
    }
    const expiredRecent = await this.prisma.webchat_payments.findMany({
      where: { status: 'EXPIRED', provider_charge_id: { not: null }, expires_at: { gte: new Date(now.getTime() - 24 * 3600_000) } },
      orderBy: { expires_at: 'desc' },
      take: 100,
    });
    for (const p of expiredRecent) {
      try { await this.checkPayment(p); } catch (e: any) { this.logger.warn(`reconcile-expired ${p.id}: ${e?.message || e}`); }
    }
  }

  // Mensagens da sequência "após pagamento" com URLs assinadas dos arquivos.
  // O config público NÃO traz essas mensagens (são stripadas em getPublicConfig).
  async buildDelivery(webchat: any, p: any) {
    const funil = this.funilOf(webchat);
    const seq = funil?.sequences?.[p.sequence_id];
    const charge = seq?.ending?.charge || {};
    const targetId = String(charge.onPaidSequenceId || '');
    const target = targetId ? funil?.sequences?.[targetId] : null;
    const rawMessages: any[] = Array.isArray(target?.messages) ? target.messages : [];
    const assetIds = rawMessages.map((m) => (m?.type === 'file' || m?.type === 'video' ? String(m.assetId || '') : '')).filter(Boolean);
    const assetMap = await this.assets.mapByIds(webchat.organization_id, assetIds);
    const messages = rawMessages.map((m) => {
      if (m?.type === 'file' || m?.type === 'video') {
        const a = assetMap.get(String(m.assetId || ''));
        if (!a) return { ...m, url: '', missing: true };
        const label = String(m.label || '').trim().slice(0, 150);
        const fn = label ? `&fn=${encodeURIComponent(label)}` : '';
        const signed = this.assets.signedUrl(a.id);
        return {
          ...m,
          name: a.name,
          label,
          mime: a.mime,
          size: Number(a.size_bytes),
          url: `${signed}${fn}`,
          download_url: `${signed}${fn}&dl=1`,
        };
      }
      return m;
    });
    // Sequência de entrega apagada/vazia: NÃO marca como entregue (A-65) — o
    // dono pode corrigir o funil e o próximo fetch entrega de verdade.
    if (messages.length === 0) {
      this.logger.warn(`Pagamento ${p.id} PAID mas a sequência de entrega (${targetId || 'sem alvo'}) está vazia — nada entregue.`);
    } else if (!p.delivered_at) {
      await this.prisma.webchat_payments.updateMany({ where: { id: p.id, delivered_at: null }, data: { delivered_at: new Date() } }).catch(() => undefined);
    }
    return { sequence_id: targetId || null, messages };
  }

  // ---------------------------------------------------------------- admin
  async listSales(orgId: string, opts: any = {}) {
    const where: any = { organization_id: orgId };
    if (opts.status && opts.status !== 'all') where.status = String(opts.status).toUpperCase();
    if (opts.webchat_id && opts.webchat_id !== 'all') where.webchat_id = opts.webchat_id;
    const rows = await this.prisma.webchat_payments.findMany({ where, orderBy: { created_at: 'desc' }, take: 2000 });
    const wcIds = [...new Set(rows.map((r) => r.webchat_id))];
    const wcs = wcIds.length ? await this.prisma.webchats.findMany({ where: { id: { in: wcIds } }, select: { id: true, name: true, slug: true } }) : [];
    const wmap = new Map<string, any>(wcs.map((w) => [w.id, w] as [string, any]));
    return rows.map((r) => ({
      id: r.id,
      channel: 'webchat',
      title: r.description || 'Cobrança',
      source_name: wmap.get(r.webchat_id)?.name || '—',
      customer: `Sessão ${r.session_id.replace(/^session_/, '').slice(0, 8)}`,
      amount_cents: r.amount_cents,
      amount_label: BRL(r.amount_cents),
      status: r.status,
      provider: r.provider,
      delivered: Boolean(r.delivered_at),
      paid_at: r.paid_at,
      created_at: r.created_at,
    }));
  }
}
