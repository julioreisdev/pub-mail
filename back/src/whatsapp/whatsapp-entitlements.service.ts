import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../platform-billing/access.service';
import { OpenWaClient, OpenWaError } from './openwa.client';
import { WhatsAppSessionsService, sessionLabel } from './whatsapp-sessions.service';
import { WhatsAppAttendanceService } from './whatsapp-attendance.service';
import { WhatsAppOutboxService } from './whatsapp-outbox.service';
import { WhatsAppContactsService } from './whatsapp-contacts.service';
import { WhatsAppHooks } from './whatsapp-hooks.service';
import { WhatsAppPresenter } from './whatsapp-presenter.service';
import { brtDateStr } from './whatsapp-subscriptions.service';
import { isGroupJid, isLidJid, normJid, phoneFromJid } from './wa-jid.util';
import { isErasing } from '../org-webhooks/erasing.registry';
import { EntitlementDesired, EntitlementRule, ENTITLEMENT_STATUSES, KIND_LABEL, desiredFor, digitsOnly, normalizeRules, phoneJidOf, samePhone } from './wa-entitlement.util';

// ============================================================================
// Motor do DIREITO DE ACESSO (Fase 5 das assinaturas) — contrato em docs/whatsapp-assinaturas-contrato.md §8.1–8.3.
//
//  - `whatsapp_entitlements`: uma linha por (assinatura, regra do produto, alvo). `desired` = o que o motor quer;
//    `status` = o que foi aplicado (pending|active|suspended|revoked|failed). Só o WORKER executa ações.
//  - `syncSubscription` recalcula `desired` (regras do produto × status da assinatura) e marca `next_try_at`;
//    gatilhos: hook `subscription_event` (debounce 2 s por assinatura), `product_entitlements_changed`,
//    `customer_updated`, cron diário 09:10 BRT (é ele que aplica `suspend_after_days`).
//  - Worker (20 s, claim atômico): grupo (adicionar/remover participante; privacidade → convite pela fila),
//    etiqueta (em toda conversa individual do cliente), arquivo digital (pela fila), externo (só status/webhook).
//    Falha → +5 min, +30 min, +2 h, +6 h, +24 h; 6ª = `failed` (retry manual). Número desconectado = +30 min sem contar.
//  - Hooks emitidos: `entitlement_changed` {orgId, entitlement, from, to} e `entitlement_failed` {orgId, entitlement, error}.
// ============================================================================

const TICK_MS = 20_000;
const BATCH = 40; // linhas por rodada do worker
const MAX_ATTEMPTS = 6; // a 6ª falha vira `failed`
const BACKOFF_MS = [5 * 60_000, 30 * 60_000, 2 * 3600_000, 6 * 3600_000, 24 * 3600_000];
const CLAIM_MS = 5 * 60_000; // linha reivindicada: ninguém pega de novo por 5 min (processo caiu no meio = volta sozinha)
const DISCONNECTED_MS = 30 * 60_000;
const INACTIVE_ORG_MS = 3600_000;
const SYNC_DEBOUNCE_MS = 2_000;
const SYNC_CONCURRENCY = 4;
const GROUP_CACHE_MS = 60_000;
const SYNC_BATCH = 500;
const LIVE = ['active', 'overdue', 'paused'];
type Outcome = { ok: true; note?: string | null } | { ok: false; error: string; noCount?: boolean; delayMs?: number };
const ok = (note?: string | null): Outcome => ({ ok: true, note: note ?? null });
const fail = (error: string): Outcome => ({ ok: false, error });
const errText = (e: any) => String(e?.message || e || 'erro').slice(0, 200);

@Injectable()
export class WhatsAppEntitlementsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppEntitlementsService.name);
  private timer: NodeJS.Timeout | null = null;
  private kickTimer: NodeJS.Timeout | null = null;
  private ticking = false;
  private dailyRunning = false;
  private readonly syncTimers = new Map<string, { orgId: string; timer: NodeJS.Timeout }>();
  private readonly syncRunning = new Set<string>();
  private readonly syncAgain = new Set<string>();
  private readonly orgCache = new Map<string, { at: number; active: boolean }>();
  private readonly groupCache = new Map<string, { at: number; info: any }>();
  private readonly jidCache = new Map<string, { at: number; jid: string }>();
  private readonly tagOrgs = new Map<string, { at: number; has: boolean }>(); // org tem etiqueta ativa por direito? (hook de entrada)
  private readonly tagSeen = new Map<string, number>(); // conversa já conferida há pouco (hook de entrada)

  constructor(
    private readonly prisma: PrismaService,
    private readonly openwa: OpenWaClient,
    private readonly sessions: WhatsAppSessionsService,
    private readonly attendance: WhatsAppAttendanceService,
    private readonly outbox: WhatsAppOutboxService,
    private readonly contacts: WhatsAppContactsService,
    private readonly access: AccessService,
    private readonly hooks: WhatsAppHooks,
    private readonly presenter: WhatsAppPresenter,
  ) {}

  onModuleInit() {
    this.hooks.on('subscription_event', (e: any) => {
      if (!e?.orgId || !e?.subscription_id) return;
      // apagada: o CRM já marcou as linhas para revogar ANTES do delete (a FK vira NULL); aqui só cancela um sync pendente e acorda o worker
      if (e.kind === 'deleted') { const t = this.syncTimers.get(e.subscription_id); if (t) { clearTimeout(t.timer); this.syncTimers.delete(e.subscription_id); } this.kick(3_000); return; }
      this.queueSync(e.orgId, e.subscription_id);
    });
    this.hooks.on('product_entitlements_changed', (e: any) => { if (e?.orgId && e?.product_id) void this.syncProduct(e.orgId, e.product_id).catch((err) => this.logger.warn(`syncProduct ${e.product_id}: ${errText(err)}`)); });
    this.hooks.on('customer_updated', (e: any) => { if (e?.orgId && e?.customer_id) void this.syncCustomer(e.orgId, e.customer_id).catch(() => undefined); });
    this.hooks.on('customer_deleted', (e: any) => this.onCustomerDeleted(e));
    this.hooks.on('message', (e: any) => this.onInbound(e));
    this.timer = setInterval(() => void this.tick(), TICK_MS);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.kickTimer) clearTimeout(this.kickTimer);
    for (const t of this.syncTimers.values()) clearTimeout(t.timer);
  }

  /** Roda o worker logo (depois de um sync), sem esperar o próximo tick. */
  kick(delayMs = 1_000) {
    if (this.kickTimer) return;
    this.kickTimer = setTimeout(() => { this.kickTimer = null; void this.tick(); }, delayMs);
  }

  // ---------------------------------------------------------------- estado desejado
  private queueSync(orgId: string, subId: string) {
    const cur = this.syncTimers.get(subId);
    if (cur) clearTimeout(cur.timer);
    const timer = setTimeout(() => { this.syncTimers.delete(subId); void this.runQueuedSync(orgId, subId); }, SYNC_DEBOUNCE_MS);
    this.syncTimers.set(subId, { orgId, timer });
  }
  // no máx. SYNC_CONCURRENCY sincronizações ao mesmo tempo: a rotina diária pode marcar milhares de assinaturas "em atraso"
  // num lote, e milhares de syncs em paralelo esgotavam o pool do banco (Fase 8). O resto espera na fila, em ordem.
  private syncActive = 0;
  private readonly syncWaiting = new Map<string, string>(); // subId → orgId
  private async runQueuedSync(orgId: string, subId: string) {
    if (this.syncRunning.has(subId)) { this.syncAgain.add(subId); return; }
    if (this.syncActive >= SYNC_CONCURRENCY) { this.syncWaiting.set(subId, orgId); return; }
    this.syncActive++;
    this.syncRunning.add(subId);
    try { await this.syncSubscription(orgId, subId); this.kick(); } catch (e: any) { this.logger.warn(`sync ${subId}: ${errText(e)}`); } finally {
      this.syncRunning.delete(subId);
      this.syncActive--;
      if (this.syncAgain.delete(subId)) this.queueSync(orgId, subId);
      const nextSub = this.syncWaiting.keys().next();
      if (!nextSub.done) { const nextOrg = this.syncWaiting.get(nextSub.value)!; this.syncWaiting.delete(nextSub.value); void this.runQueuedSync(nextOrg, nextSub.value); }
    }
  }

  private async productRules(orgId: string, productId: string | null | undefined): Promise<EntitlementRule[]> {
    if (!productId) return [];
    const p = await this.prisma.whatsapp_products.findFirst({ where: { id: productId, organization_id: orgId }, select: { entitlement: true } });
    return normalizeRules(p?.entitlement).rules;
  }

  /** Marca para revogar (o worker remove do grupo/etiqueta). `failed` volta para a fila com o novo desejo. */
  private async markRevoked(where: Record<string, any>) {
    const now = new Date();
    const a = await this.prisma.whatsapp_entitlements.updateMany({ where: { ...where, desired: { not: 'revoked' }, status: { not: 'failed' } }, data: { desired: 'revoked', next_try_at: now } });
    const b = await this.prisma.whatsapp_entitlements.updateMany({ where: { ...where, desired: { not: 'revoked' }, status: 'failed' }, data: { desired: 'revoked', status: 'pending', attempts: 0, error: null, next_try_at: now } });
    return a.count + b.count;
  }

  /**
   * Recalcula o estado desejado das regras de UMA assinatura (nunca executa ação aqui). Assinatura apagada = revoga
   * as linhas que ainda apontam para ela; regra removida do produto / telefone do cliente trocado = revoga a linha antiga.
   */
  async syncSubscription(orgId: string, subId: string) {
    const sub = await this.prisma.whatsapp_subscriptions.findFirst({ where: { id: subId, organization_id: orgId } });
    if (!sub) { const n = await this.markRevoked({ organization_id: orgId, subscription_id: subId }); return { changed: n }; }
    const rules = sub.billing === 'once' ? [] : await this.productRules(orgId, sub.product_id); // avulso fica fora desta fase
    const existing = await this.prisma.whatsapp_entitlements.findMany({ where: { organization_id: orgId, subscription_id: sub.id } });
    if (!rules.length && !existing.length) return { changed: 0 };
    let target = '';
    if (rules.some((r) => r.kind === 'group_member')) {
      const customer = await this.prisma.whatsapp_customers.findFirst({ where: { id: sub.customer_id, organization_id: orgId }, select: { contact_id: true } });
      const contact = customer ? await this.prisma.whatsapp_contacts.findFirst({ where: { id: customer.contact_id, organization_id: orgId }, select: { phone: true, wa_id: true } }) : null;
      target = phoneJidOf(contact);
    }
    const today = brtDateStr();
    const now = new Date();
    const used = new Set<string>();
    let changed = 0;
    for (const rule of rules) {
      const tgt = rule.kind === 'group_member' ? target : '';
      let row = existing.find((r) => r.rule_id === rule.id && r.target === tgt);
      const want = desiredFor(rule, sub, today);
      // o alvo da regra mudou (outro grupo/etiqueta/arquivo/número): a linha antiga é renomeada e revogada; a nova nasce
      if (row && (row.kind !== rule.kind || row.ref !== rule.ref || (rule.kind === 'group_member' && row.session_id !== rule.session_id))) {
        const renamed = `${rule.id}~${row.id.replace(/-/g, '').slice(0, 6)}`;
        await this.prisma.whatsapp_entitlements.update({ where: { id: row.id }, data: { rule_id: renamed } });
        await this.markRevoked({ id: row.id });
        changed++;
        row = undefined;
      }
      if (row) used.add(row.id);
      const desired: EntitlementDesired | null = want ?? (row ? (row.desired as EntitlementDesired) : null);
      if (!row) {
        if (desired !== 'active') continue; // nada concedido: não cria linha só para suspender/revogar
        try {
          const created = await this.prisma.whatsapp_entitlements.create({ data: { organization_id: orgId, customer_id: sub.customer_id, subscription_id: sub.id, product_id: sub.product_id, rule_id: rule.id, kind: rule.kind, ref: rule.ref, label: rule.label, session_id: rule.session_id, target: tgt, desired: 'active', status: 'pending', next_try_at: now } });
          used.add(created.id);
          changed++;
        } catch (e: any) { if (e?.code !== 'P2002') throw e; } // outro sync criou ao mesmo tempo
        continue;
      }
      const data: any = {};
      if (row.label !== rule.label) data.label = rule.label;
      if (row.product_id !== sub.product_id) data.product_id = sub.product_id;
      if (row.customer_id !== sub.customer_id) data.customer_id = sub.customer_id;
      if (desired && desired !== row.desired) {
        data.desired = desired;
        data.next_try_at = now;
        if (row.status === 'failed') Object.assign(data, { status: 'pending', attempts: 0, error: null });
      } else if (desired && row.status !== desired && row.status !== 'failed' && !row.next_try_at) data.next_try_at = now; // fora de sincronia sem estar na fila
      if (Object.keys(data).length) { await this.prisma.whatsapp_entitlements.update({ where: { id: row.id }, data }); if (data.desired || data.next_try_at) changed++; }
    }
    // linhas sem regra correspondente (regra removida do produto, troca de plano, telefone do cliente mudou) → revogar
    const orphans = existing.filter((r) => !used.has(r.id) && r.desired !== 'revoked').map((r) => r.id);
    if (orphans.length) changed += await this.markRevoked({ id: { in: orphans } });
    return { changed };
  }

  /** Produto salvo com regras mudadas: re-sincroniza as assinaturas vivas dele (e as que ainda têm acesso por ele). */
  async syncProduct(orgId: string, productId: string) {
    let n = 0;
    for (let cursor = ''; ;) {
      const subs = await this.prisma.whatsapp_subscriptions.findMany({ where: { organization_id: orgId, product_id: productId, status: { in: LIVE }, id: { gt: cursor } }, orderBy: { id: 'asc' }, take: SYNC_BATCH, select: { id: true } });
      if (!subs.length) break;
      cursor = subs[subs.length - 1].id;
      for (const s of subs) { await this.syncSubscription(orgId, s.id).catch((e) => this.logger.warn(`sync ${s.id}: ${errText(e)}`)); n++; }
      if (subs.length < SYNC_BATCH) break;
    }
    // canceladas que mantêm o acesso (`on_cancel='keep'`) e linhas ainda não revogadas deste produto
    const rest = await this.prisma.whatsapp_entitlements.findMany({ where: { organization_id: orgId, product_id: productId, desired: { not: 'revoked' } }, distinct: ['subscription_id'], select: { subscription_id: true } });
    for (const r of rest) if (r.subscription_id) await this.syncSubscription(orgId, r.subscription_id).catch(() => undefined);
    this.kick();
    return { subscriptions: n };
  }

  /** Cliente editado (telefone principal pode ter mudado): re-sincroniza as assinaturas dele. */
  async syncCustomer(orgId: string, customerId: string) {
    const subs = await this.prisma.whatsapp_subscriptions.findMany({ where: { organization_id: orgId, customer_id: customerId }, select: { id: true }, take: 50 });
    for (const s of subs) this.queueSync(orgId, s.id);
  }

  /** Diário 09:10 BRT (depois das cobranças, que marcam o atraso às 09:05): aplica `suspend_after_days` e corrige divergências. */
  @Cron('0 10 12 * * *')
  async daily() {
    if (this.dailyRunning) return;
    this.dailyRunning = true;
    try { const r = await this.syncAll(); if (r.subscriptions) this.logger.log(`direito de acesso: ${r.subscriptions} assinatura(s) conferida(s), ${r.changed} mudança(s)`); } catch (e: any) { this.logger.warn(`syncAll: ${errText(e)}`); } finally { this.dailyRunning = false; }
  }

  async syncAll() {
    let subsN = 0, changed = 0;
    const products = await this.prisma.whatsapp_products.findMany({ where: { entitlement: { not: Prisma.DbNull } }, select: { id: true, organization_id: true, entitlement: true } });
    const byOrg = new Map<string, string[]>();
    for (const p of products) if (normalizeRules(p.entitlement).rules.length) byOrg.set(p.organization_id, [...(byOrg.get(p.organization_id) || []), p.id]);
    const orgsWithRows = await this.prisma.whatsapp_entitlements.groupBy({ by: ['organization_id'], where: { desired: { not: 'revoked' } } });
    const orgIds = [...new Set([...byOrg.keys(), ...orgsWithRows.map((o) => o.organization_id)])];
    for (const orgId of orgIds) {
      if (!(await this.orgActive(orgId))) continue;
      const done = new Set<string>();
      const pids = byOrg.get(orgId) || [];
      if (pids.length) {
        for (let cursor = ''; ;) {
          const subs = await this.prisma.whatsapp_subscriptions.findMany({ where: { organization_id: orgId, product_id: { in: pids }, status: { in: LIVE }, billing: { not: 'once' }, id: { gt: cursor } }, orderBy: { id: 'asc' }, take: SYNC_BATCH, select: { id: true } });
          if (!subs.length) break;
          cursor = subs[subs.length - 1].id;
          for (const s of subs) { done.add(s.id); subsN++; changed += (await this.syncSubscription(orgId, s.id).catch(() => ({ changed: 0 }))).changed; }
          if (subs.length < SYNC_BATCH) break;
        }
      }
      // linhas com acesso cujas assinaturas não entraram acima (canceladas, produto sem regras agora, assinatura apagada)
      for (let cursor = ''; ;) {
        const rows = await this.prisma.whatsapp_entitlements.findMany({ where: { organization_id: orgId, desired: { not: 'revoked' }, id: { gt: cursor } }, orderBy: { id: 'asc' }, take: SYNC_BATCH, select: { id: true, subscription_id: true } });
        if (!rows.length) break;
        cursor = rows[rows.length - 1].id;
        const orphan = rows.filter((r) => !r.subscription_id).map((r) => r.id);
        if (orphan.length) changed += await this.markRevoked({ id: { in: orphan } });
        for (const r of rows) {
          if (!r.subscription_id || done.has(r.subscription_id)) continue;
          done.add(r.subscription_id);
          subsN++;
          changed += (await this.syncSubscription(orgId, r.subscription_id).catch(() => ({ changed: 0 }))).changed;
        }
        if (rows.length < SYNC_BATCH) break;
      }
    }
    if (changed) this.kick();
    return { subscriptions: subsN, changed };
  }

  // ---------------------------------------------------------------- worker
  private async orgActive(orgId: string) {
    const c = this.orgCache.get(orgId);
    if (c && Date.now() - c.at < 60_000) return c.active;
    const active = await this.access.isOrgActive(orgId).catch(() => true);
    this.orgCache.set(orgId, { at: Date.now(), active });
    return active;
  }

  private async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      // fora de sincronia (status ≠ desejado), não `failed`, vencida — o índice (status, desired, next_try_at) atende
      const picks: { id: string }[] = await this.prisma.$queryRaw`
        SELECT id FROM whatsapp_entitlements
        WHERE status <> desired AND status <> 'failed' AND next_try_at IS NOT NULL AND next_try_at <= ${new Date()}
        ORDER BY next_try_at LIMIT ${BATCH}`;
      if (!picks.length) return;
      const rows = await this.prisma.whatsapp_entitlements.findMany({ where: { id: { in: picks.map((p) => p.id) } }, orderBy: { next_try_at: 'asc' } });
      for (const row of rows) await this.processOne(row).catch((e) => this.logger.warn(`direito ${row.id}: ${errText(e)}`));
    } catch (e: any) { this.logger.debug(`tick: ${errText(e)}`); } finally { this.ticking = false; }
  }

  /** Processa UMA linha agora (também usado no retry manual). */
  private async processOne(row: any) {
    if (!(await this.orgActive(row.organization_id))) {
      await this.prisma.whatsapp_entitlements.updateMany({ where: { id: row.id, status: row.status, desired: row.desired }, data: { next_try_at: new Date(Date.now() + INACTIVE_ORG_MS) } });
      return;
    }
    const claim = await this.prisma.whatsapp_entitlements.updateMany({ where: { id: row.id, status: row.status, desired: row.desired, next_try_at: { lte: new Date() } }, data: { next_try_at: new Date(Date.now() + CLAIM_MS) } });
    if (!claim.count) return;
    const from = String(row.status), to = String(row.desired) as EntitlementDesired;
    let out: Outcome;
    try { out = await this.apply(row, to); } catch (e: any) { out = fail(this.gatewayError(e)); }
    const now = new Date();
    if (out.ok) {
      const data: any = { status: to, attempts: 0, error: out.note ? out.note.slice(0, 255) : null, last_sync_at: now, next_try_at: null };
      if (to === 'active') data.activated_at = now; else if (to === 'suspended') data.suspended_at = now; else if (to === 'revoked') data.revoked_at = now;
      // LGPD (A-18): cliente apagado — depois de revogar, o alvo (telefone) sai da linha (a regra é renomeada para não
      // colidir com o único (assinatura, regra, alvo))
      if (to === 'revoked' && row.target && (await this.customerErased(row.organization_id, row.customer_id))) {
        data.target = '';
        data.rule_id = `${String(row.rule_id).split('~')[0].slice(0, 8)}~${String(row.id).replace(/-/g, '').slice(0, 6)}`;
      }
      try { await this.prisma.whatsapp_entitlements.update({ where: { id: row.id }, data }); }
      catch (e: any) {
        if (e?.code !== 'P2002' || !('target' in data)) throw e;
        delete data.target; delete data.rule_id; // colisão improvável: grava sem limpar o alvo (a privacidade limpa depois)
        await this.prisma.whatsapp_entitlements.update({ where: { id: row.id }, data });
      }
      await this.prisma.whatsapp_entitlements.updateMany({ where: { id: row.id, desired: { not: to } }, data: { next_try_at: new Date() } }); // o desejo mudou no meio → de volta à fila
      this.logger.log(`direito ${row.id} (${row.kind}): ${from} → ${to}${out.note ? ` — ${out.note}` : ''}`);
      await this.emitChanged(row.organization_id, row.id, from, to);
      return;
    }
    if (out.noCount) {
      await this.prisma.whatsapp_entitlements.update({ where: { id: row.id }, data: { error: out.error.slice(0, 255), last_sync_at: now, next_try_at: new Date(Date.now() + (out.delayMs || DISCONNECTED_MS)) } });
      return;
    }
    const attempts = Math.min(100, (Number(row.attempts) || 0) + 1);
    if (attempts >= MAX_ATTEMPTS) {
      await this.prisma.whatsapp_entitlements.update({ where: { id: row.id }, data: { status: 'failed', attempts, error: out.error.slice(0, 255), last_sync_at: now, next_try_at: null } });
      this.logger.warn(`direito ${row.id} (${row.kind}) falhou ${attempts}x: ${out.error}`);
      const shaped = await this.emitChanged(row.organization_id, row.id, from, 'failed');
      if (shaped) this.hooks.emit('entitlement_failed', { orgId: row.organization_id, entitlement: shaped, error: out.error });
      return;
    }
    await this.prisma.whatsapp_entitlements.update({ where: { id: row.id }, data: { attempts, error: out.error.slice(0, 255), last_sync_at: now, next_try_at: new Date(Date.now() + BACKOFF_MS[Math.min(BACKOFF_MS.length - 1, attempts - 1)]) } });
    this.logger.debug(`direito ${row.id} (${row.kind}) tentativa ${attempts}: ${out.error}`);
  }

  private async emitChanged(orgId: string, id: string, from: string, to: string) {
    const fresh = await this.prisma.whatsapp_entitlements.findUnique({ where: { id } }).catch(() => null);
    if (!fresh) return null;
    const [shaped] = await this.shapeRows(orgId, [fresh]);
    this.hooks.emit('entitlement_changed', { orgId, entitlement: shaped, from, to });
    return shaped;
  }

  private gatewayError(e: any) {
    if (e instanceof OpenWaError) {
      if (e.code === 'OPENWA_TIMEOUT') return 'O gateway do WhatsApp demorou para responder.';
      if (e.code === 'OPENWA_UNREACHABLE' || e.code === 'OPENWA_NOT_CONFIGURED') return 'Gateway do WhatsApp indisponível.';
      return `WhatsApp recusou (${e.status}): ${String(e.message || '').slice(0, 160)}`;
    }
    return errText(e);
  }

  private async apply(row: any, to: EntitlementDesired): Promise<Outcome> {
    switch (row.kind) {
      case 'group_member': return this.applyGroup(row, to);
      case 'tag': return this.applyTag(row, to);
      case 'digital_file': return to === 'active' ? this.applyFile(row) : ok(); // não há como "desenviar" um arquivo
      case 'external': return ok(); // só status + webhook (o sistema do cliente age)
      default: return fail('Tipo de regra desconhecido.');
    }
  }

  // ---------------------------------------------------------------- grupo
  private async groupInfo(sid: string, gid: string, fresh = false) {
    const key = `${sid}|${gid}`;
    const c = this.groupCache.get(key);
    if (!fresh && c && Date.now() - c.at < GROUP_CACHE_MS) return c.info;
    const info = await this.openwa.groupInfo(sid, gid);
    this.groupCache.set(key, { at: Date.now(), info });
    if (this.groupCache.size > 500) this.groupCache.delete(this.groupCache.keys().next().value as string);
    return info;
  }

  /** Participantes com telefone (o gateway pode mandar @lid sem número: resolve pelo mapeamento quando precisa). */
  private async participants(orgId: string, sess: any, info: any, needLids: boolean) {
    const list = (Array.isArray(info?.participants) ? info.participants : []).map((p: any) => ({ id: String(p.id || ''), phone: digitsOnly(p.number) || phoneFromJid(String(p.id || '')), admin: Boolean(p.isAdmin || p.isSuperAdmin) }));
    if (needLids) {
      let budget = 1100; // grupo do WhatsApp tem até 1024 participantes
      for (const p of list) {
        if (p.phone || !isLidJid(normJid(p.id)) || budget-- <= 0) continue;
        p.phone = (await this.contacts.phoneOfLid(orgId, sess, p.id).catch(() => null)) || '';
      }
    }
    return list as Array<{ id: string; phone: string; admin: boolean }>;
  }

  /** jid aceito pelo gateway para o telefone (9º dígito etc.); cache de 1 dia. */
  private async resolveJid(sid: string, target: string) {
    const phone = digitsOnly(target.split('@')[0]);
    const c = this.jidCache.get(`${sid}|${phone}`);
    if (c && Date.now() - c.at < 86_400_000) return c.jid;
    let jid = target;
    try { const r = await this.openwa.checkNumber(sid, phone); if (r?.whatsappId) jid = String(r.whatsappId); } catch { /* sem conferir: segue com o telefone */ }
    this.jidCache.set(`${sid}|${phone}`, { at: Date.now(), jid });
    return jid;
  }

  private async applyGroup(row: any, to: EntitlementDesired): Promise<Outcome> {
    if (!row.session_id) return fail('A regra não tem o número administrador do grupo. Edite o produto e escolha o número.');
    const sess = await this.sessions.rowById(row.organization_id, row.session_id);
    if (!sess) return fail('O número escolhido na regra não existe mais. Edite o produto.');
    const label = sessionLabel(sess);
    if (!sess.openwa_session_id || sess.status !== 'ready') return { ok: false, noCount: true, delayMs: DISCONNECTED_MS, error: `O número "${label}" está desconectado; nova tentativa em 30 min.` };
    if (!row.target) return fail('O cliente não tem telefone cadastrado.');
    if (!isGroupJid(row.ref)) return fail('O grupo da regra é inválido. Edite o produto.');
    const sid = String(sess.openwa_session_id), gid = String(row.ref);
    let info: any;
    try { info = await this.groupInfo(sid, gid, true); } catch (e: any) {
      if (e instanceof OpenWaError && e.status === 404) return to === 'active' ? fail(`O grupo "${row.label || gid}" não foi encontrado no número "${label}" (o número saiu do grupo ou o grupo foi apagado).`) : ok('O grupo não existe mais neste número.');
      if (e instanceof OpenWaError && (e.code === 'OPENWA_UNREACHABLE' || e.code === 'OPENWA_TIMEOUT')) return { ok: false, noCount: true, delayMs: DISCONNECTED_MS, error: 'Gateway do WhatsApp indisponível; nova tentativa em 30 min.' };
      throw e;
    }
    const groupName = String(info?.name || info?.subject || row.label || gid).slice(0, 80);
    const myPhone = digitsOnly(sess.phone);
    const targetPhone = digitsOnly(row.target.split('@')[0]);
    const contact = await this.customerContact(row.organization_id, row.customer_id);
    const matchTarget = (p: { id: string; phone: string }) => samePhone(p.phone, targetPhone) || Boolean(contact?.lid && normJid(p.id) === normJid(contact.lid));
    let parts = await this.participants(row.organization_id, sess, info, false);
    if (!parts.some((p) => samePhone(p.phone, myPhone)) || !parts.some(matchTarget)) parts = await this.participants(row.organization_id, sess, info, true);
    const me = parts.find((p) => myPhone && samePhone(p.phone, myPhone));
    const amAdmin = me ? me.admin : null; // null = não deu para saber (o gateway decide)
    const member = parts.find(matchTarget);
    const notAdmin = () => fail(`O número "${label}" precisa ser administrador do grupo "${groupName}".`);
    const key = `${sid}|${gid}`;

    if (to === 'active') {
      if (member) return ok();
      if (amAdmin === false) return notAdmin();
      const jid = await this.resolveJid(sid, row.target);
      try {
        const r = await this.openwa.addGroupParticipants(sid, gid, [jid]);
        this.groupCache.delete(key);
        const res = r.results.find((x) => samePhone(String(x.id || '').split('@')[0], targetPhone)) || r.results[0];
        if (!res || res.success) return ok();
        const st = String(res.status ?? '');
        if (st === '409') return ok(); // já estava no grupo
        if (st === '403' || st === '408') return this.inviteFallback(row, sess, gid, groupName);
        if (st === '401') return notAdmin();
        return fail(`O WhatsApp recusou adicionar o cliente ao grupo "${groupName}"${res.message ? `: ${String(res.message).slice(0, 120)}` : ''}.`);
      } catch (e: any) {
        if (e instanceof OpenWaError && e.status === 409) return ok();
        if (e instanceof OpenWaError && (e.status === 403 || e.status === 408)) return this.inviteFallback(row, sess, gid, groupName); // não-admin já saiu acima
        throw e;
      }
    }
    // suspender / revogar
    if (!member) return ok();
    const other = await this.prisma.whatsapp_entitlements.count({ where: { organization_id: row.organization_id, id: { not: row.id }, kind: 'group_member', ref: row.ref, target: row.target, desired: 'active' } });
    if (other) return ok('Continua no grupo: outra assinatura do cliente também dá acesso.');
    if (amAdmin === false) return notAdmin();
    try {
      const r = await this.openwa.removeGroupParticipants(sid, gid, [member.id]);
      this.groupCache.delete(key);
      const res = r.results.find((x) => normJid(String(x.id || '')) === normJid(member.id) || samePhone(String(x.id || '').split('@')[0], targetPhone)) || r.results[0];
      if (!res || res.success || String(res.status ?? '') === '404') return ok();
      return fail(`O WhatsApp recusou remover o cliente do grupo "${groupName}"${res.message ? `: ${String(res.message).slice(0, 120)}` : ''}.`);
    } catch (e: any) {
      if (e instanceof OpenWaError && e.status === 404) return ok();
      if (e instanceof OpenWaError && e.status === 403) return notAdmin();
      throw e;
    }
  }

  /** Cliente com os dados apagados (LGPD) ou sendo apagado agora. */
  private async customerErased(orgId: string, customerId: string) {
    if (isErasing(orgId, customerId)) return true;
    const c = await this.prisma.whatsapp_customers.findFirst({ where: { id: customerId, organization_id: orgId }, select: { erased_at: true } }).catch(() => null);
    return Boolean(c?.erased_at);
  }

  private async customerContact(orgId: string, customerId: string) {
    const c = await this.prisma.whatsapp_customers.findFirst({ where: { id: customerId, organization_id: orgId }, select: { id: true, contact_id: true, name: true } });
    if (!c) return null;
    const contact = await this.prisma.whatsapp_contacts.findFirst({ where: { id: c.contact_id, organization_id: orgId }, select: { id: true, phone: true, wa_id: true, lid: true } });
    return contact ? { ...contact, customer: c } : null;
  }

  /** Privacidade do contato (só entra por convite): manda o link do grupo pela fila e marca ativo. */
  private async inviteFallback(row: any, sess: any, gid: string, groupName: string): Promise<Outcome> {
    const rule = (await this.productRules(row.organization_id, row.product_id)).find((r) => r.id === String(row.rule_id).split('~')[0]);
    if (rule && !rule.invite_fallback) return fail('A privacidade do cliente só permite entrar por convite, e o convite por link está desligado na regra.');
    let link = '';
    try { link = String((await this.openwa.groupInviteCode(String(sess.openwa_session_id), gid))?.inviteLink || ''); } catch (e: any) {
      if (e instanceof OpenWaError && (e.status === 401 || e.status === 403)) return fail(`O número "${sessionLabel(sess)}" precisa ser administrador do grupo "${groupName}" para gerar o convite.`);
      return fail(`Não consegui o link de convite do grupo "${groupName}": ${this.gatewayError(e)}`);
    }
    if (!link) return fail(`O gateway não devolveu o link de convite do grupo "${groupName}".`);
    const text = `Seu acesso ao grupo *${row.label || groupName}* está liberado: ${link}`;
    const q = await this.enqueueToCustomer(row, 'entitlement_invite', 'invite', { messages: [{ kind: 'text', text }], mark: { entitlement: row.id } }, row.session_id);
    if (!q.ok) return q;
    return ok('Entrou por convite (privacidade do contato)');
  }

  /**
   * Enfileira para o cliente (`whatsapp_outbox`, ritmo do número). Dedupe `ent:<id>:<tipo>:<ciclo>` — uma vez por
   * concessão (suspender e reativar manda de novo). Sem número conectado = +30 min sem contar tentativa.
   */
  private async enqueueToCustomer(row: any, kind: string, what: string, payload: any, preferSession?: string | null): Promise<Outcome> {
    const contact = await this.customerContact(row.organization_id, row.customer_id);
    if (!contact) return fail('O cliente não existe mais.');
    let key = await this.outbox.chatKeyForContact(row.organization_id, contact.id);
    if (!key && preferSession && row.target) key = { session_id: preferSession, chat_id: row.target };
    if (!key) {
      const ready = await this.sessions.readyRows(row.organization_id);
      if (!ready.length) return { ok: false, noCount: true, delayMs: DISCONNECTED_MS, error: 'Nenhum número do WhatsApp conectado; nova tentativa em 30 min.' };
      return fail('Não há como falar com o cliente pelo WhatsApp (sem telefone cadastrado).');
    }
    const cycle = Math.max(row.suspended_at ? new Date(row.suspended_at).getTime() : 0, row.revoked_at ? new Date(row.revoked_at).getTime() : 0);
    await this.outbox.enqueue(row.organization_id, { ...key, kind, payload, dedupe_key: `ent:${row.id}:${what}:${cycle.toString(36)}` }); // null = já estava na fila (dedupe) → ok
    return ok();
  }

  // ---------------------------------------------------------------- etiqueta
  /** Conversas individuais do cliente (todos os contatos vinculados, todos os números). */
  private async customerChats(orgId: string, customerId: string) {
    const c = await this.prisma.whatsapp_customers.findFirst({ where: { id: customerId, organization_id: orgId }, select: { contact_id: true } });
    if (!c) return [];
    const links = await this.prisma.whatsapp_customer_contacts.findMany({ where: { customer_id: customerId }, select: { contact_id: true } });
    const ids = [...new Set([c.contact_id, ...links.map((l) => l.contact_id)])];
    const contacts = await this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, id: { in: ids } }, select: { wa_id: true, lid: true, phone: true } });
    const jids = [...new Set(contacts.flatMap((x) => [x.wa_id, x.lid, x.phone ? `${digitsOnly(x.phone)}@c.us` : null]).filter(Boolean))] as string[];
    if (!jids.length) return [];
    return this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, kind: 'individual', chat_id: { in: jids } }, select: { session_id: true, chat_id: true, tags: true } });
  }

  private async applyTag(row: any, to: EntitlementDesired): Promise<Outcome> {
    const tag = await this.prisma.whatsapp_tags.findFirst({ where: { id: row.ref, organization_id: row.organization_id }, select: { id: true } });
    if (!tag) return to === 'active' ? fail('A etiqueta da regra não existe mais. Edite o produto.') : ok();
    const chats = await this.customerChats(row.organization_id, row.customer_id);
    if (to === 'active') {
      for (const c of chats) await this.attendance.changeTags(row.organization_id, { session_id: c.session_id, chat_id: c.chat_id }, [row.ref], []);
      this.tagOrgs.delete(row.organization_id);
      return ok(chats.length ? null : 'O cliente ainda não tem conversa; a etiqueta entra quando ele mandar mensagem.');
    }
    const other = await this.prisma.whatsapp_entitlements.count({ where: { organization_id: row.organization_id, customer_id: row.customer_id, id: { not: row.id }, kind: 'tag', ref: row.ref, desired: 'active' } });
    if (other) return ok('Etiqueta mantida: outra assinatura do cliente também dá esse acesso.');
    for (const c of chats) await this.attendance.changeTags(row.organization_id, { session_id: c.session_id, chat_id: c.chat_id }, [], [row.ref]);
    return ok();
  }

  /** Mensagem de cliente com etiqueta por direito ativa numa conversa sem a etiqueta (conversa nova): aplica. */
  private async onInbound(e: any) {
    try {
      const orgId = e?.orgId, sessionId = e?.sessionId, jid = String(e?.chatId || '');
      if (!orgId || !sessionId || !jid || isGroupJid(jid)) return;
      let t = this.tagOrgs.get(orgId);
      if (!t || Date.now() - t.at > 60_000) {
        const n = await this.prisma.whatsapp_entitlements.count({ where: { organization_id: orgId, kind: 'tag', status: 'active', desired: 'active' } });
        t = { at: Date.now(), has: n > 0 };
        this.tagOrgs.set(orgId, t);
      }
      if (!t.has) return;
      const seenKey = `${sessionId}|${jid}`;
      if ((this.tagSeen.get(seenKey) || 0) > Date.now()) return;
      this.tagSeen.set(seenKey, Date.now() + 10 * 60_000);
      if (this.tagSeen.size > 5000) for (const [k, v] of this.tagSeen) if (v < Date.now()) this.tagSeen.delete(k);
      const phone = phoneFromJid(jid);
      const contacts = await this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, OR: [{ wa_id: jid }, { lid: jid }, ...(phone ? [{ phone }] : [])] }, select: { id: true }, take: 5 });
      if (!contacts.length) return;
      const links = await this.prisma.whatsapp_customer_contacts.findMany({ where: { contact_id: { in: contacts.map((c) => c.id) } }, select: { customer_id: true } });
      const owners = await this.prisma.whatsapp_customers.findMany({ where: { organization_id: orgId, contact_id: { in: contacts.map((c) => c.id) } }, select: { id: true } });
      const custIds = [...new Set([...links.map((l) => l.customer_id), ...owners.map((o) => o.id)])];
      if (!custIds.length) return;
      const rows = await this.prisma.whatsapp_entitlements.findMany({ where: { organization_id: orgId, customer_id: { in: custIds }, kind: 'tag', status: 'active', desired: 'active' }, select: { ref: true } });
      const add = [...new Set(rows.map((r) => r.ref))];
      if (add.length) await this.attendance.changeTags(orgId, { session_id: sessionId, chat_id: jid }, add, []);
    } catch (err: any) { this.logger.debug(`etiqueta por direito (entrada): ${errText(err)}`); }
  }

  // ---------------------------------------------------------------- arquivo digital
  private async applyFile(row: any): Promise<Outcome> {
    const media = await this.prisma.whatsapp_media.findFirst({ where: { id: row.ref, organization_id: row.organization_id }, select: { id: true, filename: true } });
    if (!media) return fail('O arquivo da regra não existe mais. Envie de novo no produto.');
    const name = row.label || media.filename || 'arquivo';
    return this.enqueueToCustomer(row, 'entitlement_file', 'file', { messages: [{ kind: 'text', text: `Aqui está o seu acesso: ${name}` }, { kind: 'document', media_id: media.id }], mark: { entitlement: row.id } });
  }

  // ---------------------------------------------------------------- cliente apagado (FK CASCADE apaga as linhas)
  /** Best-effort: tira dos grupos quem estava dentro por direito (as linhas já foram apagadas junto com o cliente). */
  private async onCustomerDeleted(e: any) {
    const orgId = e?.orgId;
    const list: any[] = Array.isArray(e?.entitlements) ? e.entitlements : [];
    for (const r of list) {
      if (r?.kind !== 'group_member' || r.status !== 'active' || !r.session_id || !r.target) continue;
      try {
        // A-13: o mesmo número pode estar no grupo por OUTRO cliente (número compartilhado) — não tira
        const digits = digitsOnly(String(r.target).split('@')[0]);
        const others = await this.prisma.whatsapp_entitlements.count({
          where: { organization_id: orgId, kind: 'group_member', ref: r.ref, desired: 'active', ...(e?.customer_id ? { customer_id: { not: String(e.customer_id) } } : {}), ...(r.id ? { id: { not: r.id } } : {}), OR: [{ target: r.target }, ...(digits ? [{ target: { startsWith: `${digits}@` } }] : [])] },
        });
        if (others) { this.logger.log(`cliente apagado: ${r.target} continua no grupo ${r.ref} (outro cliente também dá acesso)`); continue; }
        const sess = await this.sessions.rowById(orgId, r.session_id);
        if (!sess?.openwa_session_id || sess.status !== 'ready') { this.logger.warn(`cliente apagado: não deu para tirar ${r.target} do grupo ${r.ref} (número desconectado)`); continue; }
        const info = await this.groupInfo(String(sess.openwa_session_id), r.ref, true);
        const parts = await this.participants(orgId, sess, info, true);
        const member = parts.find((p) => samePhone(p.phone, digitsOnly(String(r.target).split('@')[0])));
        if (member) await this.openwa.removeGroupParticipants(String(sess.openwa_session_id), r.ref, [member.id]);
        this.logger.log(`cliente apagado: ${r.target} saiu do grupo ${r.ref}`);
      } catch (err: any) { this.logger.warn(`cliente apagado: remover ${r.target} do grupo ${r.ref} falhou: ${this.gatewayError(err)}`); }
    }
  }

  // ---------------------------------------------------------------- leitura (painel / API / webhooks)
  async shapeRows(orgId: string, rows: any[]) {
    if (!rows.length) return [];
    const custIds = [...new Set(rows.map((r) => r.customer_id))];
    const subIds = [...new Set(rows.map((r) => r.subscription_id).filter(Boolean))] as string[];
    const prodIds = [...new Set(rows.map((r) => r.product_id).filter(Boolean))] as string[];
    const [custs, subs, prods, sess] = await Promise.all([
      this.prisma.whatsapp_customers.findMany({ where: { organization_id: orgId, id: { in: custIds } }, select: { id: true, name: true } }),
      subIds.length ? this.prisma.whatsapp_subscriptions.findMany({ where: { organization_id: orgId, id: { in: subIds } }, select: { id: true, product_name: true } }) : Promise.resolve([] as Array<{ id: string; product_name: string }>),
      prodIds.length ? this.prisma.whatsapp_products.findMany({ where: { organization_id: orgId, id: { in: prodIds } }, select: { id: true, name: true } }) : Promise.resolve([] as Array<{ id: string; name: string }>),
      rows.some((r) => r.session_id) ? this.presenter.sessionMap(orgId) : Promise.resolve(new Map<string, any>()), // {id, label, color, phone, status, connected}
    ]);
    const cn = new Map(custs.map((c) => [c.id, c.name] as [string, string]));
    const sn = new Map(subs.map((s) => [s.id, s.product_name] as [string, string]));
    const pn = new Map(prods.map((p) => [p.id, p.name] as [string, string]));
    return rows.map((r) => ({
      id: r.id, customer_id: r.customer_id, customer_name: cn.get(r.customer_id) || null, subscription_id: r.subscription_id || null,
      product_id: r.product_id || null, product_name: (r.product_id && pn.get(r.product_id)) || (r.subscription_id && sn.get(r.subscription_id)) || null,
      rule_id: String(r.rule_id).split('~')[0], kind: r.kind, kind_label: KIND_LABEL[r.kind as keyof typeof KIND_LABEL] || r.kind, label: r.label || null, ref: r.ref,
      session: r.session_id ? sess.get(r.session_id) || { id: r.session_id, label: 'Número removido', color: null, phone: null, status: 'none', connected: false } : null,
      target_phone: r.target ? digitsOnly(String(r.target).split('@')[0]) || null : null,
      desired: r.desired, status: r.status, in_sync: r.status === r.desired, attempts: r.attempts || 0, error: r.error || null,
      next_try_at: r.next_try_at || null, last_sync_at: r.last_sync_at || null, activated_at: r.activated_at || null, suspended_at: r.suspended_at || null, revoked_at: r.revoked_at || null,
      created_at: r.created_at, updated_at: r.updated_at,
    }));
  }

  async list(orgId: string, q: any = {}) {
    const page = Math.max(1, parseInt(String(q.page || 1), 10) || 1);
    const size = Math.min(200, Math.max(5, parseInt(String(q.page_size || 25), 10) || 25));
    const where: any = { organization_id: orgId };
    if (q.customer_id) where.customer_id = String(q.customer_id);
    if (q.subscription_id) where.subscription_id = String(q.subscription_id);
    if (q.product_id) where.product_id = String(q.product_id);
    if (q.kind) where.kind = String(q.kind);
    if (q.status && q.status !== 'all') {
      const st = String(q.status).split(',').map((s) => s.trim()).filter((s) => (ENTITLEMENT_STATUSES as readonly string[]).includes(s));
      if (st.length) where.status = st.length === 1 ? st[0] : { in: st };
    }
    const [total, rows, counts] = await Promise.all([
      this.prisma.whatsapp_entitlements.count({ where }),
      this.prisma.whatsapp_entitlements.findMany({ where, orderBy: [{ updated_at: 'desc' }], skip: (page - 1) * size, take: size }),
      this.prisma.whatsapp_entitlements.groupBy({ by: ['status'], where: { organization_id: orgId, ...(q.customer_id ? { customer_id: String(q.customer_id) } : {}), ...(q.subscription_id ? { subscription_id: String(q.subscription_id) } : {}) }, _count: { _all: true } }),
    ]);
    const cnt: Record<string, number> = Object.fromEntries(ENTITLEMENT_STATUSES.map((s) => [s, 0]));
    for (const g of counts) cnt[g.status] = g._count._all;
    return { items: await this.shapeRows(orgId, rows), total, page, page_size: size, pages: Math.max(1, Math.ceil(total / size)), counts: cnt };
  }

  async get(orgId: string, id: string) {
    const r = await this.prisma.whatsapp_entitlements.findFirst({ where: { id: String(id || ''), organization_id: orgId } });
    if (!r) throw new NotFoundException('Acesso não encontrado.');
    return (await this.shapeRows(orgId, [r]))[0];
  }

  /** Retry manual: `failed` (ou parado fora de sincronia) volta para a fila agora, tentativas zeradas. */
  async retry(orgId: string, id: string) {
    const r = await this.prisma.whatsapp_entitlements.findFirst({ where: { id: String(id || ''), organization_id: orgId } });
    if (!r) throw new NotFoundException('Acesso não encontrado.');
    if (r.status === r.desired) throw new BadRequestException('Este acesso já está como deveria.');
    await this.prisma.whatsapp_entitlements.update({ where: { id: r.id }, data: { status: r.status === 'failed' ? 'pending' : r.status, attempts: 0, error: null, next_try_at: new Date() } });
    this.kick(200);
    return this.get(orgId, r.id);
  }

  /** Força o recálculo de uma assinatura (painel). */
  async syncNow(orgId: string, subscriptionId: string) {
    const sub = await this.prisma.whatsapp_subscriptions.findFirst({ where: { id: String(subscriptionId || ''), organization_id: orgId }, select: { id: true } });
    if (!sub) throw new NotFoundException('Assinatura não encontrada.');
    const r = await this.syncSubscription(orgId, sub.id);
    this.kick(200);
    const rows = await this.prisma.whatsapp_entitlements.findMany({ where: { organization_id: orgId, subscription_id: sub.id }, orderBy: { created_at: 'asc' } });
    return { changed: r.changed, items: await this.shapeRows(orgId, rows) };
  }

  /** O número é administrador do grupo? (o editor de regras avisa antes de salvar). */
  async adminCheck(orgId: string, sessionId: string, jid: string) {
    const gid = String(jid || '').trim();
    if (!isGroupJid(gid)) throw new BadRequestException('Informe um grupo do WhatsApp (id terminado em @g.us).');
    const sess = await this.sessions.requireReady(orgId, sessionId);
    let info: any;
    try { info = await this.groupInfo(String(sess.openwa_session_id), gid, true); } catch (e: any) {
      if (e instanceof OpenWaError && e.status === 404) throw new NotFoundException('Grupo não encontrado neste número (o número precisa participar do grupo).');
      throw new BadRequestException(this.gatewayError(e));
    }
    const myPhone = digitsOnly(sess.phone);
    let parts = await this.participants(orgId, sess, info, false);
    if (myPhone && !parts.some((p) => samePhone(p.phone, myPhone))) parts = await this.participants(orgId, sess, info, true);
    const me = parts.find((p) => myPhone && samePhone(p.phone, myPhone));
    return { is_admin: Boolean(me?.admin), name: String(info?.name || info?.subject || '') || null, participants_count: parts.length };
  }
}
