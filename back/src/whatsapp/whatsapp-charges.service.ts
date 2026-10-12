import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../platform-billing/access.service';
import { cancelCharge, createBoletoCharge, createPixCharge, getChargeStatus, providerSupportsBoleto } from '../payments/pix-providers';
import { OpenWaClient } from './openwa.client';
import { WhatsAppMediaService } from './whatsapp-media.service';
import { WhatsAppInboundService } from './whatsapp-inbound.service';
import { WhatsAppPresenter } from './whatsapp-presenter.service';
import { WhatsAppHooks } from './whatsapp-hooks.service';
import { ChatKey, WhatsAppAttendanceService } from './whatsapp-attendance.service';
import { WhatsAppSessionsService } from './whatsapp-sessions.service';
import { WhatsAppCrmService, advanceDue, fillCrmVars, formatBRL } from './whatsapp-crm.service';
import { WhatsAppPipelineService } from './whatsapp-pipeline.service';
import { isGroupJid, jidFromPhone, phoneFromJid } from './wa-jid.util';

// ============================================================================
// Cobranças pelo WhatsApp (CRM, fase 2)
//
//  - Uma cobrança = valor + descrição + vencimento para um CLIENTE, paga por PIX
//    (copia-e-cola + QR, validade longa) e/ou BOLETO (só Mercado Pago).
//  - Origem: manual (botão "Cobrar" na conversa / tela Cobranças), recorrente
//    (gerada N dias antes do vencimento da assinatura) ou bot.
//  - Confirmação: webhook único /payments/webhook/:provider (reconfere no gateway),
//    runner a cada 5 min e botão "Verificar". Pagou → recibo, assinatura avança o
//    vencimento, etiqueta "Inadimplente" sai.
//  - Régua: lembretes antes / no dia / depois do vencimento (textos editáveis),
//    param ao pagar; D+1 marca a assinatura em atraso e aplica a etiqueta.
//  - Atenção Mercado Pago: PIX pago depois de vencido vira estorno pro pagador →
//    a validade do PIX = vencimento + `pix_days` (padrão 7) e EXPIRED para tudo.
//
// Multi-número: `whatsapp_charges.session_id` = NÚMERO pelo qual a cobrança (e os lembretes,
// o recibo) saem; `chat_id` = jid. Cobrar a partir de uma conversa (uuid) usa o número dela;
// a partir do cliente usa `session_id` informado → conversa mais recente do contato num número
// permitido → qualquer número conectado. Na API a cobrança devolve `chat_id` (uuid), `jid`,
// `session_id` e `session`.
// ============================================================================

export const CHARGE_STATUSES = ['PENDING', 'PAID', 'EXPIRED', 'CANCELED', 'FAILED'] as const;
const BRT = 'America/Sao_Paulo';
const DAY = 86_400_000;
const OVERDUE_TAG = { name: 'Inadimplente', color: '#EF4444' };

export type ChargeSettings = {
  pix_days: number; // validade do PIX depois do vencimento (dias)
  boleto_days: number; // validade do boleto depois do vencimento (dias)
  default_kind: 'pix' | 'boleto' | 'both';
  days_before_due: number; // cobrança recorrente gerada N dias antes
  auto_recurring: boolean;
  send_qr: boolean;
  overdue_tag: boolean;
  reminders: { before: { enabled: boolean; days: number }; due: { enabled: boolean }; after: { enabled: boolean; days: number }; after2: { enabled: boolean; days: number } };
  texts: { charge: string; boleto: string; reminder_before: string; reminder_due: string; reminder_after: string; paid: string; expired: string };
};
export const DEFAULT_CHARGE_SETTINGS: ChargeSettings = {
  pix_days: 7,
  boleto_days: 7,
  default_kind: 'pix',
  days_before_due: 5,
  auto_recurring: true,
  send_qr: true,
  overdue_tag: true,
  reminders: { before: { enabled: true, days: 3 }, due: { enabled: true }, after: { enabled: true, days: 1 }, after2: { enabled: true, days: 5 } },
  texts: {
    charge: 'Olá, {{cliente.primeiro_nome}}! 😊\nSegue a cobrança de *{{cobranca.valor}}* referente a *{{cobranca.descricao}}*, com vencimento em *{{cobranca.vencimento}}*.\n\nPara pagar pelo PIX, copie o código abaixo e cole no app do seu banco 👇',
    boleto: 'Se preferir boleto, aqui está o link: {{cobranca.boleto_link}}\nLinha digitável: {{cobranca.boleto_codigo}}',
    reminder_before: 'Oi, {{cliente.primeiro_nome}}! Lembrete: a cobrança de *{{cobranca.valor}}* ({{cobranca.descricao}}) vence em *{{cobranca.vencimento}}*. O PIX copia e cola segue abaixo 👇',
    reminder_due: 'Oi, {{cliente.primeiro_nome}}! A cobrança de *{{cobranca.valor}}* ({{cobranca.descricao}}) *vence hoje*. O PIX copia e cola segue abaixo 👇',
    reminder_after: 'Oi, {{cliente.primeiro_nome}}. A cobrança de *{{cobranca.valor}}* ({{cobranca.descricao}}) venceu em {{cobranca.vencimento}} e ainda consta em aberto. Se já pagou, desconsidere. O PIX segue abaixo 👇',
    paid: 'Pagamento de *{{cobranca.valor}}* confirmado ✅ Obrigado, {{cliente.primeiro_nome}}!',
    expired: 'A cobrança de *{{cobranca.valor}}* ({{cobranca.descricao}}) expirou. Se quiser, respondo com uma nova.',
  },
};

const brtDateStr = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: BRT, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); // YYYY-MM-DD
const dateOnlyUTC = (s: string) => new Date(`${s}T00:00:00Z`);
const toDateStr = (d: Date) => d.toISOString().slice(0, 10);
const fmtBR = (s?: string | null) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');
const endOfDayBRT = (dateStr: string) => new Date(`${dateStr}T23:59:59-03:00`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clampInt = (v: unknown, min: number, max: number, def: number) => { const n = parseInt(String(v), 10); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
const chatKeyOf = (sessionId: string | null | undefined, jid: string) => `${sessionId || ''}|${jid}`;

@Injectable()
export class WhatsAppChargesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppChargesService.name);
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly openwa: OpenWaClient,
    private readonly media: WhatsAppMediaService,
    private readonly inbound: WhatsAppInboundService,
    private readonly presenter: WhatsAppPresenter,
    private readonly attendance: WhatsAppAttendanceService,
    private readonly sessions: WhatsAppSessionsService,
    private readonly crm: WhatsAppCrmService,
    private readonly access: AccessService,
    private readonly pipeline: WhatsAppPipelineService,
    private readonly hooks: WhatsAppHooks,
  ) {}

  onModuleInit() { this.timer = setInterval(() => void this.tick(), 5 * 60_000); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  // ---------------------------------------------------------------- configurações
  async settings(orgId: string): Promise<ChargeSettings & { provider: string | null; gateway_ready: boolean; boleto_available: boolean }> {
    const [row, gw] = await Promise.all([
      this.prisma.whatsapp_crm_settings.findUnique({ where: { organization_id: orgId } }),
      this.prisma.telegram_payment_settings.findUnique({ where: { organization_id: orgId } }),
    ]);
    const c: any = (row?.charge as any) || {};
    const d = DEFAULT_CHARGE_SETTINGS;
    const rem = c.reminders || {};
    const tx = c.texts || {};
    const t = (k: keyof ChargeSettings['texts']) => String(tx[k] ?? d.texts[k]).slice(0, 1500);
    return {
      pix_days: clampInt(c.pix_days, 1, 30, d.pix_days),
      boleto_days: clampInt(c.boleto_days, 3, 60, d.boleto_days),
      default_kind: ['pix', 'boleto', 'both'].includes(c.default_kind) ? c.default_kind : d.default_kind,
      days_before_due: clampInt(c.days_before_due, 0, 30, d.days_before_due),
      auto_recurring: c.auto_recurring !== false,
      send_qr: c.send_qr !== false,
      overdue_tag: c.overdue_tag !== false,
      reminders: {
        before: { enabled: rem.before?.enabled !== false, days: clampInt(rem.before?.days, 1, 15, 3) },
        due: { enabled: rem.due?.enabled !== false },
        after: { enabled: rem.after?.enabled !== false, days: clampInt(rem.after?.days, 1, 30, 1) },
        after2: { enabled: rem.after2?.enabled !== false, days: clampInt(rem.after2?.days, 2, 60, 5) },
      },
      texts: { charge: t('charge'), boleto: t('boleto'), reminder_before: t('reminder_before'), reminder_due: t('reminder_due'), reminder_after: t('reminder_after'), paid: t('paid'), expired: t('expired') },
      provider: gw?.provider || null,
      gateway_ready: Boolean(gw?.active && gw?.access_token),
      boleto_available: Boolean(gw?.active && gw?.access_token && providerSupportsBoleto(gw.provider)),
    };
  }

  async updateSettings(orgId: string, dto: any) {
    const cur = await this.settings(orgId);
    const next: any = {
      pix_days: dto.pix_days !== undefined ? clampInt(dto.pix_days, 1, 30, cur.pix_days) : cur.pix_days,
      boleto_days: dto.boleto_days !== undefined ? clampInt(dto.boleto_days, 3, 60, cur.boleto_days) : cur.boleto_days,
      default_kind: dto.default_kind !== undefined && ['pix', 'boleto', 'both'].includes(dto.default_kind) ? dto.default_kind : cur.default_kind,
      days_before_due: dto.days_before_due !== undefined ? clampInt(dto.days_before_due, 0, 30, cur.days_before_due) : cur.days_before_due,
      auto_recurring: dto.auto_recurring !== undefined ? Boolean(dto.auto_recurring) : cur.auto_recurring,
      send_qr: dto.send_qr !== undefined ? Boolean(dto.send_qr) : cur.send_qr,
      overdue_tag: dto.overdue_tag !== undefined ? Boolean(dto.overdue_tag) : cur.overdue_tag,
      reminders: { ...cur.reminders },
      texts: { ...cur.texts },
    };
    if (dto.reminders && typeof dto.reminders === 'object') {
      for (const k of ['before', 'due', 'after', 'after2'] as const) {
        const r = (dto.reminders as any)[k];
        if (!r || typeof r !== 'object') continue;
        next.reminders[k] = { ...next.reminders[k], ...(r.enabled !== undefined ? { enabled: Boolean(r.enabled) } : {}), ...(r.days !== undefined && k !== 'due' ? { days: clampInt(r.days, k === 'after2' ? 2 : 1, k === 'before' ? 15 : 60, next.reminders[k].days) } : {}) };
      }
    }
    if (dto.texts && typeof dto.texts === 'object') {
      for (const k of Object.keys(DEFAULT_CHARGE_SETTINGS.texts) as (keyof ChargeSettings['texts'])[]) if (typeof (dto.texts as any)[k] === 'string') next.texts[k] = String((dto.texts as any)[k]).slice(0, 1500);
    }
    const row = await this.prisma.whatsapp_crm_settings.findUnique({ where: { organization_id: orgId } });
    const charge = { ...((row?.charge as any) || {}), ...next };
    await this.prisma.whatsapp_crm_settings.upsert({ where: { organization_id: orgId }, create: { organization_id: orgId, charge }, update: { charge } });
    return this.settings(orgId);
  }

  // ---------------------------------------------------------------- formato
  private shape(c: any, extra?: { customer?: any; smap?: Map<string, any>; cmap?: Map<string, string> }) {
    const today = brtDateStr();
    const due = toDateStr(new Date(c.due_at));
    const days = Math.round((dateOnlyUTC(due).getTime() - dateOnlyUTC(today).getTime()) / DAY);
    return {
      id: c.id, customer_id: c.customer_id, subscription_id: c.subscription_id, product_id: c.product_id,
      // conversa: uuid (quando existe), jid e número pelo qual a cobrança sai
      chat_id: extra?.cmap?.get(chatKeyOf(c.session_id, c.chat_id)) || null,
      jid: c.chat_id,
      session_id: c.session_id || null,
      session: (c.session_id && extra?.smap?.get(c.session_id)) || null,
      kind: c.kind, amount_cents: c.amount_cents, amount_label: formatBRL(c.amount_cents), description: c.description,
      due_at: due, due_label: fmtBR(due), days_to_due: days, overdue: c.status === 'PENDING' && days < 0,
      status: c.status, origin: c.origin, provider: c.provider,
      pix: c.pix_charge_id ? { code: c.pix_code, qr_media_id: c.pix_qr_media_id, expires_at: c.pix_expires_at } : null,
      boleto: c.boleto_charge_id ? { url: c.boleto_url, barcode: c.boleto_barcode, digitable: c.boleto_digitable, expires_at: c.boleto_expires_at } : null,
      paid_via: c.paid_via, paid_at: c.paid_at, sent_at: c.sent_at, reminders: Array.isArray(c.reminders) ? c.reminders : [], error: c.error,
      created_at: c.created_at, updated_at: c.updated_at,
      customer: extra?.customer ? { id: extra.customer.id, name: extra.customer.name, phone: extra.customer.phone } : undefined,
    };
  }

  /** Mapas para o shape: números (brief) + uuid das conversas (número|jid → uuid). */
  private async decorate(orgId: string, rows: any[]) {
    const pairs = new Map<string, any>();
    for (const r of rows) if (r.session_id && r.chat_id) pairs.set(chatKeyOf(r.session_id, r.chat_id), { session_id: r.session_id, chat_id: r.chat_id });
    const [smap, chats] = await Promise.all([
      this.presenter.sessionMap(orgId),
      pairs.size ? this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, OR: [...pairs.values()] }, select: { id: true, session_id: true, chat_id: true } }) : Promise.resolve([] as any[]),
    ]);
    const cmap = new Map<string, string>(chats.map((c: any) => [chatKeyOf(c.session_id, c.chat_id), c.id] as [string, string]));
    return { smap, cmap };
  }

  private async shapeOne(orgId: string, c: any, customer?: any) {
    const { smap, cmap } = await this.decorate(orgId, [c]);
    return this.shape(c, { customer, smap, cmap });
  }

  private async gateway(orgId: string) {
    const gw = await this.prisma.telegram_payment_settings.findUnique({ where: { organization_id: orgId } });
    if (!gw?.active || !gw.access_token) throw new BadRequestException('Configure o gateway de pagamento em Configurações → Pagamentos antes de cobrar.');
    return { ...gw, access_token: gw.access_token as string };
  }
  private webhookUrl(provider: string) {
    const base = String(process.env.PUBLIC_API_URL || 'https://api.reveleonline.com').replace(/\/+$/, '');
    return `${base}/payments/webhook/${provider || 'mercadopago'}`;
  }

  // ---------------------------------------------------------------- número da cobrança
  /** jids pelos quais o contato pode aparecer numa conversa. */
  private contactJids(contact: any): string[] {
    return [...new Set([contact?.wa_id, contact?.lid, contact?.phone ? jidFromPhone(contact.phone) : null].filter(Boolean))] as string[];
  }

  /**
   * Por qual número cobrar um cliente (sem conversa informada): `wanted` (session_id do DTO) →
   * conversa mais recente do contato num número permitido → qualquer número conectado (permitido).
   */
  private async pickSession(orgId: string, contact: any, wanted?: string | null, allowed: Set<string> | null = null): Promise<ChatKey> {
    const jids = this.contactJids(contact);
    const fallbackJid = contact?.phone ? jidFromPhone(contact.phone) : String(contact?.wa_id || '');
    if (!fallbackJid) throw new BadRequestException('O contato do cliente não tem telefone.');
    if (wanted) {
      const row = await this.sessions.requireRow(orgId, String(wanted));
      if (allowed !== null && !allowed.has(row.id)) throw new NotFoundException('Número não encontrado.');
      const chat = await this.prisma.whatsapp_chats.findFirst({ where: { organization_id: orgId, session_id: row.id, kind: 'individual', chat_id: { in: jids } }, orderBy: { last_message_at: 'desc' } });
      return { session_id: row.id, chat_id: chat?.chat_id || fallbackJid };
    }
    const recent = jids.length
      ? await this.prisma.whatsapp_chats.findFirst({ where: { organization_id: orgId, kind: 'individual', chat_id: { in: jids }, ...(allowed !== null ? { session_id: { in: [...allowed] } } : {}) }, orderBy: { last_message_at: 'desc' } })
      : null;
    if (recent) return { session_id: recent.session_id, chat_id: recent.chat_id };
    const ready = (await this.sessions.readyRows(orgId)).filter((r) => allowed === null || allowed.has(r.id));
    if (!ready.length) throw new BadRequestException('Nenhum número do WhatsApp conectado para enviar a cobrança.');
    return { session_id: ready[0].id, chat_id: fallbackJid };
  }

  // ---------------------------------------------------------------- criar + enviar
  /**
   * `dto.chat_id` = uuid da conversa (cobra pelo número dela) OU `dto.customer_id` (+ `dto.session_id` opcional).
   * `allowed` = números do usuário (null = todos) — só vale para escolher o número a partir do cliente.
   */
  async create(orgId: string, userId: string | null, dto: any, origin: 'manual' | 'recurring' | 'bot' = 'manual', allowed: Set<string> | null = null) {
    const cfg = await this.settings(orgId);
    let customer: any = null;
    let key: ChatKey | null = null;
    if (dto.chat_id) {
      const chat = await this.attendance.chatRow(orgId, String(dto.chat_id));
      if (isGroupJid(chat.chat_id) || chat.kind !== 'individual') throw new BadRequestException('Cobrança é só para conversas individuais.');
      const r = await this.crm.byContactJid(orgId, chat.session_id, chat.chat_id);
      if (!r.customer) throw new BadRequestException('Este contato ainda não é cliente. Cadastre-o primeiro (painel "Cliente" da conversa).');
      customer = await this.prisma.whatsapp_customers.findUnique({ where: { id: r.customer.id } });
      key = { session_id: chat.session_id, chat_id: chat.chat_id };
    } else if (dto.customer_id) customer = await this.prisma.whatsapp_customers.findFirst({ where: { id: String(dto.customer_id), organization_id: orgId } });
    if (!customer) throw new NotFoundException('Cliente não encontrado.');
    if (customer.status !== 'active') throw new BadRequestException('Cliente inativo. Reative-o para cobrar.');
    const contact = await this.prisma.whatsapp_contacts.findUnique({ where: { id: customer.contact_id } });
    if (!contact) throw new BadRequestException('O contato do cliente não existe mais.');
    if (!key) key = await this.pickSession(orgId, contact, dto.session_id, allowed);

    // valor/descrição: da assinatura, do produto ou livres
    let sub: any = null, product: any = null;
    if (dto.subscription_id) { sub = await this.prisma.whatsapp_subscriptions.findFirst({ where: { id: String(dto.subscription_id), customer_id: customer.id } }); if (!sub) throw new NotFoundException('Assinatura não encontrada.'); }
    if (dto.product_id) { product = await this.prisma.whatsapp_products.findFirst({ where: { id: String(dto.product_id), organization_id: orgId } }); if (!product) throw new NotFoundException('Produto não encontrado.'); }
    const amount = Math.round(Number(dto.amount_cents ?? sub?.price_cents ?? product?.price_cents ?? 0));
    if (!(amount >= 100)) throw new BadRequestException('Informe um valor de pelo menos R$ 1,00.');
    const description = String(dto.description || sub?.product_name || product?.name || 'Cobrança').trim().slice(0, 255);
    const kind: 'pix' | 'boleto' | 'both' = ['pix', 'boleto', 'both'].includes(dto.kind) ? dto.kind : cfg.default_kind;
    // vencimento: o informado; senão o da assinatura (se ainda não passou); senão hoje
    const subDue = sub?.next_due_at ? sub.next_due_at.toISOString().slice(0, 10) : null;
    const dueStr = /^\d{4}-\d{2}-\d{2}$/.test(String(dto.due_at || '')) ? String(dto.due_at) : subDue && subDue >= brtDateStr() ? subDue : brtDateStr();
    if (dueStr < brtDateStr() && origin === 'manual') throw new BadRequestException('O vencimento não pode ficar no passado.');

    const gw = await this.gateway(orgId);
    const wantBoleto = kind === 'boleto' || kind === 'both';
    const wantPix = kind === 'pix' || kind === 'both';
    if (wantBoleto && !providerSupportsBoleto(gw.provider)) throw new BadRequestException('O gateway configurado não emite boleto (só o Mercado Pago). Cobre por PIX.');
    const addr: any = customer.address || {};
    if (wantBoleto && (!customer.doc || !customer.email || !addr.zip || !addr.street || !addr.number || !addr.city || !addr.state)) throw new BadRequestException('Para boleto o cliente precisa de CPF/CNPJ, e-mail e endereço completo (CEP, rua, número, cidade e UF). Complete o cadastro.');

    const payerRef = createHash('sha1').update(`${orgId}:${customer.id}`).digest('hex').slice(0, 12);
    const stamp = Math.floor(Date.now() / 60000);
    const row = await this.prisma.whatsapp_charges.create({
      data: { organization_id: orgId, session_id: key.session_id, customer_id: customer.id, subscription_id: sub?.id || null, product_id: product?.id || sub?.product_id || null, chat_id: key.chat_id, kind, amount_cents: amount, description, due_at: dateOnlyUTC(dueStr), status: 'PENDING', origin, provider: gw.provider, created_by: userId, reminders: [] },
    });
    const data: any = {};
    const errors: string[] = [];
    if (wantPix) {
      const expires = new Date(endOfDayBRT(dueStr).getTime() + cfg.pix_days * DAY);
      const r = await createPixCharge(gw.provider, gw.access_token, amount, description, { payerRef, name: customer.name, email: customer.email || undefined, webhookUrl: this.webhookUrl(gw.provider), expiresInMin: Math.max(30, Math.round((expires.getTime() - Date.now()) / 60000)), idempotency: `wacharge-${row.id}-pix-${stamp}` });
      if (r.ok && r.chargeId) {
        data.pix_charge_id = r.chargeId; data.pix_code = r.pixCode || null; data.pix_expires_at = expires;
        if (r.qrBase64 && cfg.send_qr) { try { const m = await this.media.storeBase64(orgId, r.qrBase64, 'image/png', 'pix.png', 'image'); data.pix_qr_media_id = m.id; } catch (e: any) { this.logger.debug(`QR: ${e?.message || e}`); } }
      } else errors.push(`PIX: ${r.error || 'gateway recusou'}`);
    }
    if (wantBoleto) {
      const dueDate = new Date(Math.max(endOfDayBRT(dueStr).getTime(), Date.now() + 3 * DAY));
      const r = await createBoletoCharge(gw.provider, gw.access_token, amount, description, { name: customer.name, email: customer.email!, doc: customer.doc!, address: { zip: addr.zip, street: addr.street, number: addr.number, district: addr.district || 'Centro', city: addr.city, state: addr.state } }, { dueAt: dueDate, webhookUrl: this.webhookUrl(gw.provider), idempotency: `wacharge-${row.id}-bol-${stamp}` });
      if (r.ok && r.chargeId) { data.boleto_charge_id = r.chargeId; data.boleto_url = r.url || null; data.boleto_barcode = r.barcode || null; data.boleto_digitable = r.digitable || null; data.boleto_expires_at = dueDate; }
      else errors.push(`Boleto: ${r.error || 'gateway recusou'}`);
    }
    if (!data.pix_charge_id && !data.boleto_charge_id) {
      await this.prisma.whatsapp_charges.update({ where: { id: row.id }, data: { status: 'FAILED', error: errors.join(' | ').slice(0, 255) } });
      throw new BadRequestException(`Não foi possível gerar a cobrança. ${errors.join(' | ')}`);
    }
    if (errors.length) data.error = errors.join(' | ').slice(0, 255);
    let charge = await this.prisma.whatsapp_charges.update({ where: { id: row.id }, data });
    if (dto.send !== false) charge = await this.sendCharge(orgId, charge, customer, 'charge').catch((e) => { this.logger.warn(`envio da cobrança ${row.id}: ${e?.message || e}`); return charge; });
    return this.shapeOne(orgId, charge, { ...customer, phone: contact.phone });
  }

  // ---------------------------------------------------------------- mensagens
  private async varsFor(orgId: string, c: any, customer: any) {
    const base = await this.crm.varsForChat(orgId, c.chat_id, c.session_id || null);
    const name = customer?.name || base['cliente.nome'] || '';
    return {
      ...base, nome: name, 'cliente.nome': name, 'cliente.primeiro_nome': name.split(/\s+/)[0] || '',
      'cobranca.valor': formatBRL(c.amount_cents), 'cobranca.descricao': c.description, 'cobranca.vencimento': fmtBR(toDateStr(new Date(c.due_at))),
      'cobranca.pix': c.pix_code || '', 'cobranca.boleto_link': c.boleto_url || '', 'cobranca.boleto_codigo': c.boleto_digitable || c.boleto_barcode || '',
    };
  }

  /** Número pronto da cobrança (400 claro quando não está). Cobrança antiga sem número usa qualquer um conectado e adota-o. */
  private async sessionFor(orgId: string, c: any) {
    if (c.session_id) return this.sessions.requireReady(orgId, c.session_id);
    const row = await this.sessions.anyReady(orgId);
    if (!row) throw new BadRequestException('O WhatsApp não está conectado.');
    await this.prisma.whatsapp_charges.update({ where: { id: c.id }, data: { session_id: row.id } }).catch(() => undefined);
    c.session_id = row.id;
    return row;
  }

  /** Envia pelo número `row` para o jid; grava a mensagem OUT com `session_id` e `extra.charge`. */
  private async send(orgId: string, row: any, jid: string, msg: { kind: 'text' | 'image'; text?: string; mediaId?: string | null }, chargeId: string) {
    const sid = String(row.openwa_session_id);
    let r: any; let type = 'text';
    if (msg.kind === 'image' && msg.mediaId) {
      const f = await this.media.readBase64(orgId, msg.mediaId);
      r = await this.openwa.sendMedia(sid, 'image' as any, jid, { base64: f.base64, mimetype: f.mime, filename: f.filename || 'pix.png', caption: msg.text || undefined });
      type = 'image';
    } else {
      if (!msg.text) return;
      r = await this.openwa.sendText(sid, jid, msg.text);
    }
    const at = r?.timestamp ? new Date(Number(r.timestamp) * 1000) : new Date();
    const waId = String(r?.messageId || `charge_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    await this.prisma.whatsapp_messages
      .create({ data: { organization_id: orgId, session_id: row.id, chat_id: jid, wa_message_id: waId, direction: 'OUT', type, body: msg.text || null, media_id: msg.kind === 'image' ? msg.mediaId || null : null, ack: 1, timestamp: at, extra: { charge: chargeId } } })
      .catch(async (e: any) => { if (e?.code === 'P2002') await this.prisma.whatsapp_messages.update({ where: { organization_id_session_id_wa_message_id: { organization_id: orgId, session_id: row.id, wa_message_id: waId } }, data: { extra: { charge: chargeId } } }).catch(() => undefined); });
    await this.inbound.bumpChat(orgId, row.id, jid, { type, body: msg.text, direction: 'OUT', at });
    this.presenter.message(orgId, { waId, sessionId: row.id });
  }

  /** Envia a cobrança (ou um lembrete) na conversa: texto + PIX copia-e-cola + QR + boleto. */
  private async sendCharge(orgId: string, c: any, customer: any, which: 'charge' | 'reminder_before' | 'reminder_due' | 'reminder_after') {
    const row = await this.sessionFor(orgId, c);
    const cfg = await this.settings(orgId);
    const vars = await this.varsFor(orgId, c, customer);
    const text = fillCrmVars(cfg.texts[which], vars).trim();
    if (text) await this.send(orgId, row, c.chat_id, { kind: 'text', text }, c.id);
    if (c.pix_code) {
      await sleep(400);
      await this.send(orgId, row, c.chat_id, { kind: 'text', text: c.pix_code }, c.id);
      if (which === 'charge' && c.pix_qr_media_id && cfg.send_qr) { await sleep(400); await this.send(orgId, row, c.chat_id, { kind: 'image', mediaId: c.pix_qr_media_id, text: `QR Code do PIX · ${formatBRL(c.amount_cents)}` }, c.id).catch((e) => this.logger.debug(`QR: ${e?.message || e}`)); }
    }
    if (c.boleto_charge_id && (c.boleto_url || c.boleto_digitable || c.boleto_barcode)) {
      await sleep(400);
      const bt = fillCrmVars(cfg.texts.boleto, vars).trim();
      if (bt) await this.send(orgId, row, c.chat_id, { kind: 'text', text: bt }, c.id);
    }
    const reminders = Array.isArray(c.reminders) ? [...c.reminders] : [];
    if (which !== 'charge') reminders.push({ kind: which, at: new Date().toISOString(), day: brtDateStr() });
    return this.prisma.whatsapp_charges.update({ where: { id: c.id }, data: { sent_at: new Date(), reminders } });
  }

  // ---------------------------------------------------------------- consultas
  /** Cláusula de número para listagens: `session_id` pedido (se permitido) ou todos os permitidos. null = nada. */
  private sessionFilter(sessionId: unknown, allowed: Set<string> | null): { session_id?: any } | null {
    const sid = sessionId ? String(sessionId) : '';
    if (sid) return allowed !== null && !allowed.has(sid) ? null : { session_id: sid };
    if (allowed === null) return {};
    if (!allowed.size) return null;
    return { session_id: { in: [...allowed] } };
  }

  /** `q.session_id` filtra um número; `q.chat_id` = uuid da conversa; `allowed` = números do usuário (null = todos). */
  async list(orgId: string, q: any = {}, allowed: Set<string> | null = null) {
    const page = Math.max(1, parseInt(String(q.page || 1), 10) || 1);
    const size = Math.min(200, Math.max(5, parseInt(String(q.page_size || 25), 10) || 25));
    const zero = { count: 0, cents: 0, label: formatBRL(0) };
    const empty = { items: [] as any[], total: 0, page, page_size: size, pages: 1, kpis: { pending: zero, overdue: zero, paid_month: zero } };
    const sess = this.sessionFilter(q.session_id, allowed);
    if (sess === null) return empty;
    const where: any = { organization_id: orgId, ...sess };
    if (q.status && q.status !== 'all') {
      if (q.status === 'OVERDUE') { where.status = 'PENDING'; where.due_at = { lt: dateOnlyUTC(brtDateStr()) }; }
      else if (CHARGE_STATUSES.includes(String(q.status).toUpperCase() as any)) where.status = String(q.status).toUpperCase();
    }
    if (q.customer_id) where.customer_id = String(q.customer_id);
    if (q.chat_id) {
      const chat = await this.prisma.whatsapp_chats.findFirst({ where: { id: String(q.chat_id), organization_id: orgId }, select: { session_id: true, chat_id: true } });
      if (!chat || (allowed !== null && !allowed.has(chat.session_id))) return empty;
      where.session_id = chat.session_id;
      where.chat_id = chat.chat_id;
    }
    if (q.kind && ['pix', 'boleto', 'both'].includes(q.kind)) where.kind = q.kind;
    if (q.origin && ['manual', 'recurring', 'bot'].includes(q.origin)) where.origin = q.origin;
    if (q.from || q.to) where.due_at = { ...(where.due_at || {}), ...(q.from ? { gte: dateOnlyUTC(String(q.from).slice(0, 10)) } : {}), ...(q.to ? { lte: dateOnlyUTC(String(q.to).slice(0, 10)) } : {}) };
    if (q.q) {
      const s = String(q.q).trim();
      const custs = await this.prisma.whatsapp_customers.findMany({ where: { organization_id: orgId, name: { contains: s } }, select: { id: true }, take: 500 });
      where.OR = [{ description: { contains: s } }, ...(custs.length ? [{ customer_id: { in: custs.map((c) => c.id) } }] : [])];
    }
    const todayStr = brtDateStr();
    const monthStart = new Date(`${todayStr.slice(0, 7)}-01T00:00:00-03:00`);
    const kpiBase = { organization_id: orgId, ...sess };
    const [total, rows, pend, overdueRows, paidMonth] = await Promise.all([
      this.prisma.whatsapp_charges.count({ where }),
      this.prisma.whatsapp_charges.findMany({ where, orderBy: [{ created_at: 'desc' }], skip: (page - 1) * size, take: size }),
      this.prisma.whatsapp_charges.aggregate({ where: { ...kpiBase, status: 'PENDING' }, _sum: { amount_cents: true }, _count: { _all: true } }),
      this.prisma.whatsapp_charges.aggregate({ where: { ...kpiBase, status: 'PENDING', due_at: { lt: dateOnlyUTC(todayStr) } }, _sum: { amount_cents: true }, _count: { _all: true } }),
      this.prisma.whatsapp_charges.aggregate({ where: { ...kpiBase, status: 'PAID', paid_at: { gte: monthStart } }, _sum: { amount_cents: true }, _count: { _all: true } }),
    ]);
    const custIds = [...new Set(rows.map((r) => r.customer_id))];
    const custs = custIds.length ? await this.prisma.whatsapp_customers.findMany({ where: { id: { in: custIds } } }) : [];
    const contacts = custs.length ? await this.prisma.whatsapp_contacts.findMany({ where: { id: { in: custs.map((c) => c.contact_id) } }, select: { id: true, phone: true } }) : [];
    const phone = new Map(contacts.map((c) => [c.id, c.phone]));
    const byId = new Map(custs.map((c) => [c.id, { ...c, phone: phone.get(c.contact_id) || null }]));
    const { smap, cmap } = await this.decorate(orgId, rows);
    const kpi = (a: any) => ({ count: a._count._all, cents: a._sum.amount_cents || 0, label: formatBRL(a._sum.amount_cents || 0) });
    return { items: rows.map((r) => this.shape(r, { customer: byId.get(r.customer_id), smap, cmap })), total, page, page_size: size, pages: Math.max(1, Math.ceil(total / size)), kpis: { pending: kpi(pend), overdue: kpi(overdueRows), paid_month: kpi(paidMonth) } };
  }

  async get(orgId: string, id: string) {
    const c = await this.prisma.whatsapp_charges.findFirst({ where: { id, organization_id: orgId } });
    if (!c) throw new NotFoundException('Cobrança não encontrada.');
    const customer = await this.prisma.whatsapp_customers.findUnique({ where: { id: c.customer_id } });
    const contact = customer ? await this.prisma.whatsapp_contacts.findUnique({ where: { id: customer.contact_id }, select: { phone: true } }) : null;
    return this.shapeOne(orgId, c, customer ? { ...customer, phone: contact?.phone || null } : undefined);
  }

  /** Número da cobrança (para o controller conferir o acesso). */
  async sessionOf(orgId: string, id: string) {
    const c = await this.prisma.whatsapp_charges.findFirst({ where: { id, organization_id: orgId }, select: { session_id: true } });
    if (!c) throw new NotFoundException('Cobrança não encontrada.');
    return c.session_id;
  }

  // ---------------------------------------------------------------- ações
  async resend(orgId: string, id: string) {
    const c = await this.prisma.whatsapp_charges.findFirst({ where: { id, organization_id: orgId } });
    if (!c) throw new NotFoundException('Cobrança não encontrada.');
    if (c.status !== 'PENDING') throw new BadRequestException('Só cobranças em aberto podem ser reenviadas.');
    const customer = await this.prisma.whatsapp_customers.findUnique({ where: { id: c.customer_id } });
    const upd = await this.sendCharge(orgId, c, customer, 'charge');
    return this.shapeOne(orgId, upd, customer);
  }

  async cancel(orgId: string, id: string) {
    const c = await this.prisma.whatsapp_charges.findFirst({ where: { id, organization_id: orgId } });
    if (!c) throw new NotFoundException('Cobrança não encontrada.');
    if (c.status !== 'PENDING') throw new BadRequestException('Só cobranças em aberto podem ser canceladas.');
    const gw = await this.prisma.telegram_payment_settings.findUnique({ where: { organization_id: orgId } });
    if (gw?.access_token) for (const cid of [c.pix_charge_id, c.boleto_charge_id]) if (cid) await cancelCharge(c.provider || gw.provider, gw.access_token, cid).catch(() => undefined);
    const upd = await this.prisma.whatsapp_charges.update({ where: { id }, data: { status: 'CANCELED' } });
    return this.shapeOne(orgId, upd);
  }

  async markPaid(orgId: string, userId: string, id: string) {
    const c = await this.prisma.whatsapp_charges.findFirst({ where: { id, organization_id: orgId } });
    if (!c) throw new NotFoundException('Cobrança não encontrada.');
    if (c.status === 'PAID') throw new BadRequestException('Esta cobrança já está paga.');
    if (c.status === 'CANCELED') throw new BadRequestException('Cobrança cancelada não pode ser marcada como paga.');
    await this.settle(c, 'manual', userId);
    return this.get(orgId, id);
  }

  async check(orgId: string, id: string) {
    const c = await this.prisma.whatsapp_charges.findFirst({ where: { id, organization_id: orgId } });
    if (!c) throw new NotFoundException('Cobrança não encontrada.');
    await this.refresh(c);
    return this.get(orgId, id);
  }

  // ---------------------------------------------------------------- confirmação
  /** Webhook único: a cobrança é achada pelo id do gateway (PIX ou boleto). */
  async handleWebhookCharge(provider: string, chargeId: string): Promise<boolean> {
    const c = await this.prisma.whatsapp_charges.findFirst({ where: { OR: [{ pix_charge_id: chargeId }, { boleto_charge_id: chargeId }] } });
    if (!c) return false;
    await this.refresh(c).catch((e) => this.logger.warn(`webhook ${chargeId}: ${e?.message || e}`));
    return true;
  }

  /** Reconfere no gateway. Pagou → liquida; vencido além da validade → EXPIRED. */
  private async refresh(c: any): Promise<boolean> {
    if (c.status !== 'PENDING') return false;
    const gw = await this.prisma.telegram_payment_settings.findUnique({ where: { organization_id: c.organization_id } });
    if (!gw?.access_token) return false;
    const provider = c.provider || gw.provider;
    const checks: Array<['pix' | 'boleto', string]> = [];
    if (c.pix_charge_id) checks.push(['pix', c.pix_charge_id]);
    if (c.boleto_charge_id) checks.push(['boleto', c.boleto_charge_id]);
    let allGone = checks.length > 0;
    for (const [via, id] of checks) {
      const st = await getChargeStatus(provider, gw.access_token, id);
      if (st.ok && st.status === 'PAID') { await this.settle(c, via, null); return true; }
      if (!(st.ok && st.status === 'EXPIRED')) allGone = false;
    }
    const latest = Math.max(c.pix_expires_at ? new Date(c.pix_expires_at).getTime() : 0, c.boleto_expires_at ? new Date(c.boleto_expires_at).getTime() : 0);
    if (allGone || (latest && latest < Date.now())) {
      const u = await this.prisma.whatsapp_charges.updateMany({ where: { id: c.id, status: 'PENDING' }, data: { status: 'EXPIRED' } });
      if (u.count) this.logger.log(`cobrança ${c.id} expirou`);
    }
    return false;
  }

  private keyOf(c: any): ChatKey | null {
    return c?.session_id && c?.chat_id ? { session_id: c.session_id, chat_id: c.chat_id } : null;
  }

  /** Liquida a cobrança (uma vez só): assinatura avança, recibo, etiqueta sai. */
  private async settle(c: any, via: 'pix' | 'boleto' | 'manual', userId: string | null) {
    const u = await this.prisma.whatsapp_charges.updateMany({ where: { id: c.id, status: { not: 'PAID' } }, data: { status: 'PAID', paid_at: new Date(), paid_via: via, paid_manual_by: via === 'manual' ? userId : null } });
    if (!u.count) return;
    const orgId = c.organization_id;
    const gw = await this.prisma.telegram_payment_settings.findUnique({ where: { organization_id: orgId } });
    // o outro meio (pix/boleto) é cancelado no gateway para não pagar duas vezes
    if (gw?.access_token) for (const [v, id] of [['pix', c.pix_charge_id], ['boleto', c.boleto_charge_id]] as const) if (id && v !== via) await cancelCharge(c.provider || gw.provider, gw.access_token, id).catch(() => undefined);
    if (c.subscription_id) {
      const sub = await this.prisma.whatsapp_subscriptions.findUnique({ where: { id: c.subscription_id } });
      if (sub && sub.status !== 'canceled') {
        const due = new Date(c.due_at);
        const next = advanceDue(sub.next_due_at && new Date(sub.next_due_at) > due ? new Date(sub.next_due_at) : due, sub.billing, sub.due_day);
        await this.prisma.whatsapp_subscriptions.update({ where: { id: sub.id }, data: { last_paid_at: new Date(), status: sub.status === 'overdue' ? 'active' : sub.status, ...(next ? { next_due_at: next } : {}) } });
      }
    }
    const key = this.keyOf(c);
    if (key) {
      await this.syncOverdueTag(orgId, c.customer_id, key).catch(() => undefined);
      await this.pipeline.onPaid(orgId, key); // funil: pago → etapa (se configurado)
    }
    const customer = await this.prisma.whatsapp_customers.findUnique({ where: { id: c.customer_id } });
    this.hooks.emit('charge_paid', { orgId, charge: c, customer, via });
    try {
      const row = await this.sessionFor(orgId, c);
      const cfg = await this.settings(orgId);
      const text = fillCrmVars(cfg.texts.paid, await this.varsFor(orgId, c, customer)).trim();
      if (text) await this.send(orgId, row, c.chat_id, { kind: 'text', text }, c.id);
    } catch (e: any) { this.logger.debug(`recibo ${c.id}: ${e?.message || e}`); }
    this.logger.log(`cobrança ${c.id} paga via ${via}`);
  }

  /** Etiqueta "Inadimplente" na conversa (número + jid) quando há cobrança vencida em aberto; sai quando não há mais. */
  private async syncOverdueTag(orgId: string, customerId: string, key: ChatKey) {
    const cfg = await this.settings(orgId);
    if (!cfg.overdue_tag) return;
    const overdue = await this.prisma.whatsapp_charges.count({ where: { organization_id: orgId, customer_id: customerId, status: 'PENDING', due_at: { lt: dateOnlyUTC(brtDateStr()) } } });
    let tag = await this.prisma.whatsapp_tags.findFirst({ where: { organization_id: orgId, name: OVERDUE_TAG.name } });
    if (!tag && overdue) tag = await this.prisma.whatsapp_tags.create({ data: { organization_id: orgId, name: OVERDUE_TAG.name, color: OVERDUE_TAG.color, position: 99 } }).catch(() => null as any);
    if (!tag) return;
    await this.attendance.changeTags(orgId, key, overdue ? [tag.id] : [], overdue ? [] : [tag.id]);
  }

  // ---------------------------------------------------------------- runner
  private async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const pend = await this.prisma.whatsapp_charges.findMany({ where: { status: 'PENDING', created_at: { lt: new Date(Date.now() - 20_000) } }, orderBy: { updated_at: 'asc' }, take: 100 });
      for (const c of pend) await this.refresh(c).catch((e) => this.logger.debug(`refresh ${c.id}: ${e?.message || e}`));
    } catch (e: any) { this.logger.debug(`tick: ${e?.message || e}`); } finally { this.ticking = false; }
  }

  /** Diário (09:00 BRT = 12:00 UTC): gera cobranças recorrentes, manda lembretes, marca atrasos. */
  @Cron('0 5 12 * * *')
  async daily() {
    const orgs = await this.prisma.whatsapp_crm_settings.findMany({ select: { organization_id: true } });
    const subsOrgs = await this.prisma.whatsapp_subscriptions.groupBy({ by: ['organization_id'], where: { status: { in: ['active', 'overdue'] } } });
    const ids = [...new Set([...orgs.map((o) => o.organization_id), ...subsOrgs.map((o) => o.organization_id)])];
    for (const orgId of ids) {
      if (!(await this.access.isOrgActive(orgId).catch(() => false))) continue;
      await this.runDailyFor(orgId).catch((e) => this.logger.warn(`daily ${orgId}: ${e?.message || e}`));
    }
  }

  async runDailyFor(orgId: string) {
    const cfg = await this.settings(orgId);
    const today = brtDateStr();
    const todayD = dateOnlyUTC(today);
    const result = { generated: 0, reminders: 0, overdue: 0, errors: [] as string[] };
    // 1) recorrentes: vence em até N dias e ainda não tem cobrança para esse vencimento
    //    (o número é o da última conversa do contato; sem conversa, qualquer número conectado)
    if (cfg.auto_recurring && cfg.gateway_ready) {
      const limit = new Date(todayD.getTime() + cfg.days_before_due * DAY);
      const subs = await this.prisma.whatsapp_subscriptions.findMany({ where: { organization_id: orgId, status: { in: ['active', 'overdue'] }, billing: { in: ['monthly', 'quarterly', 'yearly'] }, next_due_at: { not: null, lte: limit } }, take: 500 });
      for (const sub of subs) {
        const exists = await this.prisma.whatsapp_charges.findFirst({ where: { subscription_id: sub.id, due_at: sub.next_due_at!, status: { in: ['PENDING', 'PAID'] } } });
        if (exists) continue;
        const customer = await this.prisma.whatsapp_customers.findUnique({ where: { id: sub.customer_id } });
        if (!customer || customer.status !== 'active') continue;
        try {
          await this.create(orgId, null, { customer_id: customer.id, subscription_id: sub.id, kind: cfg.default_kind === 'boleto' && !customer.doc ? 'pix' : cfg.default_kind, due_at: toDateStr(new Date(sub.next_due_at!)), send: true }, 'recurring');
          result.generated++;
          await sleep(1500);
        } catch (e: any) { result.errors.push(`${customer.name}: ${e?.message || e}`); }
      }
    }
    // 2) lembretes + atraso
    const pend = await this.prisma.whatsapp_charges.findMany({ where: { organization_id: orgId, status: 'PENDING' }, take: 1000 });
    // venceram ONTEM (o runner é diário → 1 aviso por cobrança)
    const yesterday = new Date(dateOnlyUTC(brtDateStr()).getTime() - 86_400_000).getTime();
    for (const c of pend) if (c.due_at && new Date(c.due_at).getTime() === yesterday) this.hooks.emit('charge_overdue', { orgId, charge: c });
    for (const c of pend) {
      const due = toDateStr(new Date(c.due_at));
      const days = Math.round((todayD.getTime() - dateOnlyUTC(due).getTime()) / DAY); // >0 = dias de atraso
      const sentKinds = new Set((Array.isArray(c.reminders) ? c.reminders : []).map((r: any) => `${r.kind}:${r.day}`));
      let which: 'reminder_before' | 'reminder_due' | 'reminder_after' | null = null;
      if (cfg.reminders.before.enabled && days === -cfg.reminders.before.days) which = 'reminder_before';
      else if (cfg.reminders.due.enabled && days === 0) which = 'reminder_due';
      else if (cfg.reminders.after.enabled && days === cfg.reminders.after.days) which = 'reminder_after';
      else if (cfg.reminders.after2.enabled && days === cfg.reminders.after2.days) which = 'reminder_after';
      if (which && !sentKinds.has(`${which}:${today}`) && c.sent_at) {
        try {
          const customer = await this.prisma.whatsapp_customers.findUnique({ where: { id: c.customer_id } });
          await this.sendCharge(orgId, c, customer, which);
          result.reminders++;
          await sleep(1500);
        } catch (e: any) { result.errors.push(`lembrete ${c.id}: ${e?.message || e}`); }
      }
      if (days >= 1) {
        if (c.subscription_id) { const u = await this.prisma.whatsapp_subscriptions.updateMany({ where: { id: c.subscription_id, status: 'active' }, data: { status: 'overdue' } }); if (u.count) result.overdue++; }
        const key = this.keyOf(c);
        if (key) await this.syncOverdueTag(orgId, c.customer_id, key).catch(() => undefined);
      }
    }
    if (result.generated || result.reminders || result.errors.length) this.logger.log(`daily ${orgId}: ${JSON.stringify(result)}`);
    return result;
  }

  /** Vendas unificadas (Configurações → Pagamentos → Vendas). */
  async listSales(orgId: string, status?: string) {
    const where: any = { organization_id: orgId };
    if (status && status !== 'all') where.status = String(status).toUpperCase();
    const rows = await this.prisma.whatsapp_charges.findMany({ where, orderBy: { created_at: 'desc' }, take: 2000 });
    const custs = rows.length ? await this.prisma.whatsapp_customers.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.customer_id))] } }, select: { id: true, name: true } }) : [];
    const name = new Map(custs.map((c) => [c.id, c.name]));
    // PIX gerados pelo Fluxo do Bot (whatsapp_payments) também são vendas do canal
    const botRows = await this.prisma.whatsapp_payments.findMany({ where, orderBy: { created_at: 'desc' }, take: 2000 }).catch(() => [] as any[]);
    const smap = rows.length || botRows.length ? await this.presenter.sessionMap(orgId) : new Map<string, any>();
    const crm = rows.map((r) => ({ id: r.id, channel: 'whatsapp', title: r.description, source_name: r.origin === 'recurring' ? 'Cobrança recorrente' : r.origin === 'bot' ? 'Bot' : 'Cobrança manual', customer: name.get(r.customer_id) || phoneFromJid(r.chat_id) || '—', amount_cents: r.amount_cents, amount_label: formatBRL(r.amount_cents), status: r.status, provider: r.provider, delivered: r.status === 'PAID', paid_at: r.paid_at, created_at: r.created_at, session_id: r.session_id || null, session: (r.session_id && smap.get(r.session_id)) || null }));
    const bot = botRows.map((r: any) => ({ id: r.id, channel: 'whatsapp', title: r.description || 'PIX do bot', source_name: 'Fluxo do Bot (PIX)', customer: phoneFromJid(r.chat_id) || '—', amount_cents: r.amount_cents, amount_label: formatBRL(r.amount_cents), status: r.status, provider: r.provider, delivered: r.status === 'PAID', paid_at: r.paid_at, created_at: r.created_at, session_id: r.session_id || null, session: (r.session_id && smap.get(r.session_id)) || null }));
    return [...crm, ...bot].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
}
