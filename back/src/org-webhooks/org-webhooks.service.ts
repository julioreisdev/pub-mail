import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SafeHttpError, checkWebhookUrl, postRaw } from '../wordpress/safe-http.util';
import { maskSecret, newWebhookSecret, normalizeEvents, signatureHeader, wantsEvent } from './webhook-sign.util';

// Webhooks de saída da organização (Fase 5, contrato §8.5): o Pub Mail avisa o sistema do cliente.
//  - Painel: CRUD, segredo (só volta na criação/rotação), teste (`ping` na hora), entregas (lista/detalhe/reenviar).
//  - `dispatch(org, event, data)`: uma entrega por webhook ATIVO que assina o evento (fila `org_webhook_deliveries`,
//    payload cifrado pela extensão do Prisma); quem entrega é o `OrgWebhooksWorker`.
//  - `post()`: corpo assinado (HMAC-SHA256 de "<timestamp>.<corpo>") pelo anti-SSRF de `safe-http.util`.
export const MAX_WEBHOOKS_PER_ORG = 10;
const HOOKS_CACHE_MS = 30_000;
const TIMEOUT_MS = 10_000;
export type PostResult = { ok: boolean; status: number | null; duration_ms: number; error: string | null };

@Injectable()
export class OrgWebhooksService {
  private readonly logger = new Logger(OrgWebhooksService.name);
  private readonly hooksCache = new Map<string, { at: number; rows: Array<{ id: string; events: unknown }> }>();
  private kickFn: (() => void) | null = null;

  private static readonly instances = new Set<OrgWebhooksService>();
  /** Org apagada: esquece o cache de webhooks dela (não cria entrega órfã nos 30 s seguintes). */
  static forgetOrganization(orgId: string) {
    for (const inst of OrgWebhooksService.instances) inst.invalidate(orgId);
  }

  constructor(private readonly prisma: PrismaService) {
    OrgWebhooksService.instances.add(this);
  }

  /** O worker se registra aqui para ser acordado logo depois de uma entrega nova. */
  onEnqueue(fn: () => void) { this.kickFn = fn; }
  invalidate(orgId: string) { this.hooksCache.delete(orgId); }

  // ---------------------------------------------------------------- painel
  private shape(w: any) {
    return {
      id: w.id, name: w.name, url: w.url, events: normalizeEvents(w.events), active: Boolean(w.active), failures: w.failures || 0,
      last_status: w.last_status ?? null, last_error: w.last_error || null, last_delivery_at: w.last_delivery_at || null,
      secret_masked: maskSecret(w.secret), created_at: w.created_at, updated_at: w.updated_at,
    };
  }

  private url(raw: string) {
    try {
      return checkWebhookUrl(raw).url;
    } catch (e: any) {
      throw new BadRequestException(e instanceof SafeHttpError ? e.message : 'Endereço inválido.');
    }
  }

  private async own(orgId: string, id: string) {
    const w = await this.prisma.org_webhooks.findFirst({ where: { id, organization_id: orgId } });
    if (!w) throw new NotFoundException('Webhook não encontrado.');
    return w;
  }

  async list(orgId: string) {
    const rows = await this.prisma.org_webhooks.findMany({ where: { organization_id: orgId }, orderBy: { created_at: 'asc' } });
    return rows.map((r) => this.shape(r));
  }

  async create(orgId: string, dto: { name: string; url: string; events?: string[] }) {
    const n = await this.prisma.org_webhooks.count({ where: { organization_id: orgId } });
    if (n >= MAX_WEBHOOKS_PER_ORG) throw new BadRequestException(`Limite de ${MAX_WEBHOOKS_PER_ORG} webhooks por organização.`);
    const name = String(dto.name || '').trim().slice(0, 80);
    if (!name) throw new BadRequestException('Dê um nome ao webhook.');
    const secret = newWebhookSecret();
    const row = await this.prisma.org_webhooks.create({ data: { organization_id: orgId, name, url: this.url(dto.url), secret, events: normalizeEvents(dto.events) as any, active: true } });
    this.invalidate(orgId);
    return { ...this.shape(row), secret }; // o segredo inteiro SÓ nesta resposta
  }

  async update(orgId: string, id: string, dto: { name?: string; url?: string; events?: string[]; active?: boolean }) {
    const cur = await this.own(orgId, id);
    const data: any = {};
    if (dto.name !== undefined) { const name = String(dto.name || '').trim().slice(0, 80); if (!name) throw new BadRequestException('Dê um nome ao webhook.'); data.name = name; }
    if (dto.url !== undefined) data.url = this.url(dto.url);
    if (dto.events !== undefined) data.events = normalizeEvents(dto.events);
    if (dto.active !== undefined) { data.active = Boolean(dto.active); if (dto.active && !cur.active) { data.failures = 0; data.last_error = null; } } // reativar zera a contagem
    const row = Object.keys(data).length ? await this.prisma.org_webhooks.update({ where: { id }, data }) : cur;
    this.invalidate(orgId);
    return this.shape(row);
  }

  async rotateSecret(orgId: string, id: string) {
    await this.own(orgId, id);
    const secret = newWebhookSecret();
    const row = await this.prisma.org_webhooks.update({ where: { id }, data: { secret } });
    return { ...this.shape(row), secret };
  }

  async remove(orgId: string, id: string) {
    await this.own(orgId, id);
    await this.prisma.org_webhooks.delete({ where: { id } }); // entregas em cascata
    this.invalidate(orgId);
    return { ok: true };
  }

  /** `ping` na hora (não entra na fila). */
  async test(orgId: string, id: string) {
    const w = await this.own(orgId, id);
    const deliveryId = randomUUID();
    const body = JSON.stringify({ id: deliveryId, event: 'ping', created_at: new Date().toISOString(), organization_id: orgId, data: { webhook_id: w.id, name: w.name, message: 'Teste do Pub Mail: se você recebeu isto, o webhook está funcionando.' } });
    const r = await this.post(w, 'ping', deliveryId, body);
    await this.prisma.org_webhooks.update({ where: { id }, data: { last_status: r.status, last_error: r.ok ? null : (r.error || '').slice(0, 255) || null } }).catch(() => undefined);
    return { ok: r.ok, status: r.status, duration_ms: r.duration_ms, ...(r.error ? { error: r.error } : {}) };
  }

  async deliveries(orgId: string, webhookId: string, q: any = {}) {
    await this.own(orgId, webhookId);
    const page = Math.max(1, parseInt(String(q.page || 1), 10) || 1);
    const size = Math.min(100, Math.max(5, parseInt(String(q.page_size || 25), 10) || 25));
    const where: any = { organization_id: orgId, webhook_id: webhookId };
    if (['pending', 'sending', 'delivered', 'failed'].includes(String(q.status || ''))) where.status = String(q.status);
    if (q.event) where.event = String(q.event).slice(0, 64);
    const select = { id: true, webhook_id: true, event: true, status: true, attempts: true, next_try_at: true, last_status: true, last_error: true, duration_ms: true, delivered_at: true, created_at: true, updated_at: true };
    const [total, items] = await Promise.all([
      this.prisma.org_webhook_deliveries.count({ where }),
      this.prisma.org_webhook_deliveries.findMany({ where, orderBy: { created_at: 'desc' }, skip: (page - 1) * size, take: size, select }),
    ]);
    return { items, total, page, page_size: size, pages: Math.max(1, Math.ceil(total / size)) };
  }

  async delivery(orgId: string, id: string) {
    const d = await this.prisma.org_webhook_deliveries.findFirst({ where: { id, organization_id: orgId } });
    if (!d) throw new NotFoundException('Entrega não encontrada.');
    let payload: any = null;
    try { payload = JSON.parse(d.payload); } catch { payload = d.payload; }
    return { id: d.id, webhook_id: d.webhook_id, event: d.event, status: d.status, attempts: d.attempts, last_status: d.last_status, duration_ms: d.duration_ms, last_error: d.last_error, created_at: d.created_at, delivered_at: d.delivered_at, next_try_at: d.next_try_at, payload };
  }

  async retry(orgId: string, id: string) {
    const d = await this.prisma.org_webhook_deliveries.findFirst({ where: { id, organization_id: orgId }, select: { id: true, status: true, webhook_id: true } });
    if (!d) throw new NotFoundException('Entrega não encontrada.');
    if (d.status === 'pending' || d.status === 'sending') throw new BadRequestException('Esta entrega já está na fila.');
    const w = await this.prisma.org_webhooks.findUnique({ where: { id: d.webhook_id }, select: { active: true } });
    if (!w?.active) throw new BadRequestException('O webhook está desativado. Reative-o antes de reenviar.');
    await this.prisma.org_webhook_deliveries.updateMany({ where: { id, status: { in: ['failed', 'delivered'] } }, data: { status: 'pending', attempts: 0, next_try_at: new Date(), last_error: null } });
    this.kickFn?.();
    return this.delivery(orgId, id);
  }

  // ---------------------------------------------------------------- disparo
  private async activeHooks(orgId: string) {
    const c = this.hooksCache.get(orgId);
    if (c && Date.now() - c.at < HOOKS_CACHE_MS) return c.rows;
    const rows = await this.prisma.org_webhooks.findMany({ where: { organization_id: orgId, active: true }, select: { id: true, events: true } });
    this.hooksCache.set(orgId, { at: Date.now(), rows });
    return rows;
  }

  /** Algum webhook ativo da org quer este evento? (barato: cache de 30 s — o bridge consulta antes de montar o payload). */
  async hasSubscribers(orgId: string, event: string) {
    if (!orgId) return false;
    return (await this.activeHooks(orgId)).some((h) => wantsEvent(h.events, event));
  }

  /** Enfileira o evento para cada webhook que o assina. Devolve quantas entregas criou. Nunca lança. */
  async dispatch(orgId: string, event: string, data: unknown): Promise<number> {
    try {
      const targets = (await this.activeHooks(orgId)).filter((h) => wantsEvent(h.events, event));
      if (!targets.length) return 0;
      const createdAt = new Date().toISOString();
      for (const t of targets) {
        const id = randomUUID();
        const payload = JSON.stringify({ id, event, created_at: createdAt, organization_id: orgId, data: data ?? null });
        await this.prisma.org_webhook_deliveries.create({ data: { id, organization_id: orgId, webhook_id: t.id, event, payload, status: 'pending', next_try_at: new Date() } });
      }
      this.kickFn?.();
      return targets.length;
    } catch (e: any) {
      this.logger.warn(`webhook ${event} org=${orgId}: ${e?.message || e}`);
      return 0;
    }
  }

  /**
   * LGPD (A-6): apaga as entregas (pendentes e antigas) cujo payload cita o cliente — o id dele, dos contatos
   * ou os jids. O payload é cifrado em repouso, então a busca é feita decifrando em lotes (a extensão do Prisma
   * decifra na leitura). Teto de 300 mil entregas lidas por chamada (a poda mantém só 30 dias).
   */
  async purgeForCustomer(orgId: string, needles: string[]): Promise<number> {
    const terms = [...new Set(needles.map((x) => String(x || '').trim()).filter((x) => x.length >= 8))];
    if (!orgId || !terms.length) return 0;
    let removed = 0;
    let cursor = '';
    for (let i = 0; i < 600; i++) {
      const rows = await this.prisma.org_webhook_deliveries.findMany({ where: { organization_id: orgId, id: { gt: cursor } }, orderBy: { id: 'asc' }, take: 500, select: { id: true, payload: true, status: true, event: true } });
      if (!rows.length) break;
      cursor = rows[rows.length - 1].id;
      const hit = rows.filter((r) => r.status !== 'sending' && r.event !== 'customer.erased' && typeof r.payload === 'string' && terms.some((t) => r.payload.includes(t))).map((r) => r.id);
      if (hit.length) removed += (await this.prisma.org_webhook_deliveries.deleteMany({ where: { id: { in: hit }, status: { not: 'sending' } } })).count;
      if (rows.length < 500) break;
      await new Promise((r) => setTimeout(r, 20));
    }
    return removed;
  }

  // ---------------------------------------------------------------- envio
  /** POST assinado. `body` = a string exata gravada (a assinatura cobre esses bytes). */
  async post(w: { url: string; secret: string }, event: string, deliveryId: string, body: string): Promise<PostResult> {
    const ts = Math.floor(Date.now() / 1000);
    const started = Date.now();
    try {
      const r = await postRaw(w.url, body, {
        timeoutMs: TIMEOUT_MS,
        headers: { 'User-Agent': 'PubMail-Webhooks/1.0', 'X-PubMail-Event': event, 'X-PubMail-Delivery': deliveryId, 'X-PubMail-Timestamp': String(ts), 'X-PubMail-Signature': signatureHeader(w.secret, ts, body) },
      });
      const ok = r.status >= 200 && r.status < 300;
      return { ok, status: r.status, duration_ms: r.duration_ms, error: ok ? null : `HTTP ${r.status}${r.body ? `: ${r.body.replace(/\s+/g, ' ').slice(0, 180)}` : ''}` };
    } catch (e: any) {
      const msg = e?.code === 'ETIMEOUT' ? 'Tempo esgotado (10 s)' : e?.code === 'EBLOCKED' ? 'Destino bloqueado (IP interno)' : e?.code === 'ENOTFOUND' ? 'Domínio não encontrado' : String(e?.message || e);
      return { ok: false, status: null, duration_ms: Date.now() - started, error: msg.slice(0, 255) };
    }
  }
}
