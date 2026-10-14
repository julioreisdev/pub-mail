import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppContactsService } from './whatsapp-contacts.service';
import { WhatsAppPresenter } from './whatsapp-presenter.service';
import { digitsOf, isGroupJid, jidFromPhone } from './wa-jid.util';
import { docHash, isValidDoc as docIsValid, maskDoc, normalizeDoc } from './wa-doc.util';
import { ROLE_LABEL, WhatsAppIdentityService, normalizeIdentity } from './whatsapp-identity.service';
import { WhatsAppSubscriptionsService } from './whatsapp-subscriptions.service';
import { WhatsAppOutboxService } from './whatsapp-outbox.service';
import { cancelChargeRemote } from '../payments/gateways.util';
import { fillCrmVars, formatBRL } from './wa-crm-vars.util';
import { normalizeChargeSettings, normalizeReminderRules } from './wa-charge-settings.util';
import { daysBetween, fmtDateBR as fmtDateBRMath, isDateStr, nextDueFromDate, penaltyBreakdown, toDateStr as toDateStrMath } from './wa-subscription-math.util';
import { RESERVED_CUSTOM_KEYS, SubMeta, brtDateStr, dateOnlyUTC, sanitizeCustom } from './whatsapp-subscriptions.service';
import type { BotCustomer, BotOpenCharge, BotProduct, BotSubscription } from './bot/wa-bot.engine';
import { BILLINGS, CANCEL_POLICIES, CUSTOMER_STATUSES } from './dto/whatsapp-crm.dto';
import { WhatsAppHooks } from './whatsapp-hooks.service';
import { WhatsAppCustomFieldsService } from './whatsapp-custom-fields.service';
import { CF_ENTITIES, customList, customVars, normalizeCustomFieldMap } from './wa-custom-fields.util';
import { EntitlementRuleError, normalizeRules } from './wa-entitlement.util';
import { fmtDuration, normalizeBooking, normalizeIncludedPlans } from './scheduling/wa-schedule.util';
import { billingFromName, csvSafe, parseBilling } from './wa-import.util';

// ============================================================================
// CRM do WhatsApp — produtos/serviços, clientes (um contato "promovido") e
// assinaturas (produto + valor + vencimento). Genérico: serve para qualquer
// negócio (produto físico, serviço, plano, mensalidade).
//
//   cliente 1 ─── N contatos (whatsapp_customer_contacts; `contact_id` = o principal)   → conversas = uma por NÚMERO
//   contato 1 ─── N clientes (Fase 1 das assinaturas, 12/10/2026 — ver whatsapp-identity.service.ts)
//   cliente 1 ─── N assinaturas ─── 0..1 produto
//
// Variáveis para mensagens (respostas rápidas, agendamentos, broadcasts, bot):
//   {{cliente.nome}} {{cliente.primeiro_nome}} {{cliente.produto}} {{cliente.produtos}}
//   {{cliente.valor}} {{cliente.vencimento}} {{cliente.dia_vencimento}} {{cliente.status}}
//   (+ {{nome}} {{telefone}} que já existiam) — ver `varsForChat`.
//
// Multi-número: o cliente é DA ORG. `byChat` recebe o uuid da conversa (API); quem já tem
// (número, jid) — bot, broadcasts, agendamentos, cobranças — usa `byContactJid`/`varsForChat(jid)`.
// ============================================================================

const UUID_RE = /^[0-9a-f-]{36}$/i;
/** Origens de criação SEM alguém para preencher os campos obrigatórios (P7-2): importação, bot e fluxos internos. */
const INTERNAL_SOURCES = ['import', 'bot', 'system', 'order', 'appointment'];
/** A-8: cliente com os dados apagados (LGPD) não volta a ser editado, vinculado nem assinado. */
const ERASED_MSG = 'Os dados deste cliente foram apagados (LGPD).';

export const BILLING_LABEL: Record<string, string> = { once: 'Avulso', monthly: 'Mensal', quarterly: 'Trimestral', semiannual: 'Semestral', yearly: 'Anual' };
const BILLING_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, semiannual: 6, yearly: 12 };
export { fillCrmVars, formatBRL }; // helpers puros movidos para wa-crm-vars.util.ts (compat)
// "YYYY-MM-DD" → Date (meia-noite UTC) — colunas DATE não têm fuso
const parseDate = (v: unknown): Date | null => {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};
// "hoje" do negócio é o dia em BRT (servidor em UTC: perto da meia-noite o dia UTC já virou) — nunca `getUTCDate()` do relógio
const todayBRT = () => dateOnlyUTC(brtDateStr());
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);
const cleanDoc = (v: unknown) => normalizeDoc(v);
export const isValidDoc = (doc: string) => docIsValid(doc);

/** Próximo vencimento: o primeiro dia `dueDay` (1–28) a partir de `from` (inclusive). Legado (compat); o motor usa `nextDueFromDate`. */
export function nextDueFrom(from: Date, dueDay: number): Date {
  const y = from.getUTCFullYear(), m = from.getUTCMonth();
  const thisMonth = new Date(Date.UTC(y, m, dueDay));
  return thisMonth >= from ? thisMonth : new Date(Date.UTC(y, m + 1, dueDay));
}
/** Vencimento seguinte depois de pagar (mantém o dia; avança 1/3/12 meses). */
export function advanceDue(due: Date, billing: string, dueDay?: number | null): Date | null {
  const months = BILLING_MONTHS[billing];
  if (!months) return null;
  const d = dueDay || due.getUTCDate();
  return new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + months, Math.min(28, d)));
}

/** Endereços de atendimento/entrega/outros (Fase 7). O `address` do cliente continua sendo o de cobrança. */
const ADDRESS_KINDS = ['service', 'delivery', 'billing', 'other'];
export function normalizeAddresses(raw: unknown) {
  if (!Array.isArray(raw)) return null;
  const pick = (a: any, k: string, max: number) => String(a?.[k] ?? '').trim().slice(0, max) || undefined;
  const out = raw.slice(0, 10).filter((a) => a && typeof a === 'object').map((a: any, i: number) => ({
    id: /^[a-z0-9-]{4,40}$/i.test(String(a.id || '')) ? String(a.id) : `a${Date.now().toString(36)}${i}`,
    kind: ADDRESS_KINDS.includes(a.kind) ? a.kind : 'service', label: pick(a, 'label', 60),
    street: pick(a, 'street', 120), number: pick(a, 'number', 20), complement: pick(a, 'complement', 60), district: pick(a, 'district', 80),
    city: pick(a, 'city', 80), state: pick(a, 'state', 2)?.toUpperCase(), zip: digitsOf(a.zip).slice(0, 8) || undefined, notes: pick(a, 'notes', 200),
    is_default: a.is_default === true,
  })).filter((a) => a.street || a.city || a.zip);
  return out.length ? out : null;
}


@Injectable()
export class WhatsAppCrmService {
  private readonly logger = new Logger(WhatsAppCrmService.name);
  constructor(private readonly prisma: PrismaService, private readonly contacts: WhatsAppContactsService, private readonly presenter: WhatsAppPresenter, private readonly identity: WhatsAppIdentityService, private readonly subscriptions: WhatsAppSubscriptionsService, private readonly outbox: WhatsAppOutboxService, private readonly hooks: WhatsAppHooks, private readonly cf: WhatsAppCustomFieldsService) {}

  // ---------------------------------------------------------------- configurações
  async settings(orgId: string) {
    const row = await this.prisma.whatsapp_crm_settings.findUnique({ where: { organization_id: orgId } });
    const custom_fields = normalizeCustomFieldMap(row?.custom_fields);
    // `custom_fields` = mapa por entidade (Fase 7); `customer_fields` = a lista de clientes (formato antigo)
    return { custom_fields, customer_fields: custom_fields.customer, identity: normalizeIdentity(row?.identity) };
  }
  async updateSettings(orgId: string, dto: { custom_fields?: unknown; identity?: unknown }) {
    const data: any = {};
    const row0 = await this.prisma.whatsapp_crm_settings.findUnique({ where: { organization_id: orgId }, select: { custom_fields: true } });
    if (dto.custom_fields !== undefined) {
      // array (formato antigo) = só clientes; mapa = substitui as entidades que vieram, mantém as outras
      const cur = normalizeCustomFieldMap(row0?.custom_fields);
      const inc: any = dto.custom_fields;
      const next = Array.isArray(inc) ? { ...cur, customer: inc } : inc && typeof inc === 'object' ? { ...cur, ...Object.fromEntries(Object.entries(inc).filter(([k]) => (CF_ENTITIES as readonly string[]).includes(k))) } : cur;
      data.custom_fields = normalizeCustomFieldMap(next);
    }
    if (dto.identity !== undefined && dto.identity && typeof dto.identity === 'object') {
      const cur = await this.identity.settings(orgId);
      data.identity = normalizeIdentity({ ...cur, ...(dto.identity as any) });
    }
    await this.prisma.whatsapp_crm_settings.upsert({ where: { organization_id: orgId }, create: { organization_id: orgId, ...data }, update: data });
    this.cf.invalidate(orgId);
    return this.settings(orgId);
  }

  // ---------------------------------------------------------------- produtos
  private shapeProduct(p: any, counts?: Map<string, number>) {
    const cycle = p.billing_interval_months || BILLING_MONTHS[p.billing] || 0;
    return {
      id: p.id, name: p.name, description: p.description, price_cents: p.price_cents, price_label: formatBRL(p.price_cents), billing: p.billing, billing_label: BILLING_LABEL[p.billing] || p.billing, active: p.active, position: p.position, subscribers: counts?.get(p.id) ?? 0,
      // Fase 3 (motor de assinatura)
      trial_days: p.trial_days || 0, grace_days: p.grace_days || 0, prorate: p.prorate !== false, cancel_policy: p.cancel_policy === 'immediate' ? 'immediate' : 'end_of_cycle',
      billing_interval_months: p.billing_interval_months || null, cycle_months: cycle, charge_days_before: p.charge_days_before ?? null,
      reminder_rules: p.reminder_rules && typeof p.reminder_rules === 'object' ? p.reminder_rules : null, entitlement: p.entitlement && typeof p.entitlement === 'object' ? { rules: normalizeRules(p.entitlement).rules } : null, // Fase 5: regras de acesso normalizadas
      custom: p.custom && typeof p.custom === 'object' ? p.custom : {}, category: p.category || null,
      installments_max: p.installments_max || 1, // Fase 4: parcelas no cartão (só avulso)
      // Fase 6 (agenda): produto | plano | serviço (com duração)
      kind: p.kind === 'service' ? 'service' : p.billing !== 'once' ? 'plan' : 'product',
      duration_minutes: p.kind === 'service' ? p.duration_minutes || null : null, duration_label: p.kind === 'service' && p.duration_minutes ? fmtDuration(p.duration_minutes) : null,
      buffer_after_minutes: p.kind === 'service' ? p.buffer_after_minutes || 0 : 0, capacity: p.kind === 'service' ? p.capacity || 1 : 1,
      booking: p.kind === 'service' ? normalizeBooking(p.booking) : null, included_in_plans: p.kind === 'service' ? normalizeIncludedPlans(p.included_in_plans) : [],
      created_at: p.created_at, updated_at: p.updated_at,
    };
  }

  async listProducts(orgId: string, q: any = {}) {
    const where: any = { organization_id: orgId };
    if (q.active === '1' || q.active === 'true') where.active = true;
    const rows = await this.prisma.whatsapp_products.findMany({ where, orderBy: [{ active: 'desc' }, { position: 'asc' }, { name: 'asc' }] });
    const grp = await this.prisma.whatsapp_subscriptions.groupBy({ by: ['product_id'], where: { organization_id: orgId, status: { in: ['active', 'overdue', 'paused'] }, product_id: { not: null } }, _count: { _all: true } });
    const counts = new Map(grp.map((g) => [String(g.product_id), g._count._all]));
    return rows.map((p) => this.shapeProduct(p, counts));
  }

  private productData(dto: any): any {
    const name = String(dto.name || '').trim().slice(0, 120);
    if (!name) throw new BadRequestException('Dê um nome ao produto.');
    let billing: string = BILLINGS.includes(dto.billing) ? dto.billing : 'once';
    const service = dto.kind === 'service'; // Fase 6: serviço agendável = sempre avulso
    if (service) { billing = 'once'; dto = { ...dto, billing_interval_months: null }; }
    const interval = dto.billing_interval_months === null || dto.billing_interval_months === undefined || dto.billing_interval_months === '' ? null : Number(dto.billing_interval_months);
    if (interval !== null && ![1, 3, 6, 12].includes(interval)) throw new BadRequestException('Intervalo de cobrança: 1, 3, 6 ou 12 meses.');
    if (interval) billing = interval === 12 ? 'yearly' : interval === 6 ? 'semiannual' : interval === 3 ? 'quarterly' : 'monthly'; // o enum acompanha o intervalo
    const recurring = billing !== 'once';
    return {
      name, description: String(dto.description || '').trim().slice(0, 500) || null, price_cents: Math.max(0, Math.round(Number(dto.price_cents) || 0)), billing, active: dto.active !== false,
      trial_days: recurring ? Math.min(365, Math.max(0, Math.round(Number(dto.trial_days) || 0))) : 0,
      grace_days: Math.min(90, Math.max(0, Math.round(Number(dto.grace_days) || 0))),
      prorate: dto.prorate !== false,
      cancel_policy: CANCEL_POLICIES.includes(dto.cancel_policy) ? dto.cancel_policy : 'end_of_cycle',
      billing_interval_months: recurring ? interval || BILLING_MONTHS[billing] || null : null,
      charge_days_before: dto.charge_days_before === null || dto.charge_days_before === undefined || dto.charge_days_before === '' ? null : Math.min(30, Math.max(0, Math.round(Number(dto.charge_days_before) || 0))),
      reminder_rules: dto.reminder_rules && typeof dto.reminder_rules === 'object' ? normalizeReminderRules(dto.reminder_rules) : null,
      entitlement: this.entitlementData(dto.entitlement),
      custom: dto.custom && typeof dto.custom === 'object' ? Object.fromEntries(Object.entries(dto.custom).slice(0, 40).map(([k, v]) => [String(k).slice(0, 40), typeof v === 'string' ? v.slice(0, 500) : v])) : null,
      category: String(dto.category || '').trim().slice(0, 64) || null,
      installments_max: recurring ? null : Math.min(12, Math.max(1, Math.round(Number(dto.installments_max) || 1))),
      ...this.serviceData(dto, service, recurring),
    };
  }

  /** Fase 6 (agenda): campos de serviço. `kind` = service só quando pedido; os outros acompanham a cobrança. */
  private serviceData(dto: any, service: boolean, recurring: boolean) {
    if (!service) return { kind: recurring ? 'plan' : 'product', duration_minutes: null, buffer_after_minutes: 0, capacity: 1, booking: null, included_in_plans: null };
    const dur = Math.round(Number(dto.duration_minutes));
    if (!(dur >= 5 && dur <= 720)) throw new BadRequestException('Serviço: informe a duração (5 a 720 minutos).');
    const plans = normalizeIncludedPlans(dto.included_in_plans);
    return {
      kind: 'service', duration_minutes: dur,
      buffer_after_minutes: Math.min(240, Math.max(0, Math.round(Number(dto.buffer_after_minutes) || 0))),
      capacity: Math.min(200, Math.max(1, Math.round(Number(dto.capacity) || 1))),
      booking: normalizeBooking(dto.booking) as any,
      included_in_plans: plans.length ? (plans as any) : null,
    };
  }

  /** Planos que incluem o serviço precisam existir e ser recorrentes. */
  private async checkIncludedPlans(orgId: string, data: any) {
    const plans: any[] = Array.isArray(data.included_in_plans) ? data.included_in_plans : [];
    if (!plans.length) return;
    const ids = plans.map((p) => p.plan_id);
    const n = await this.prisma.whatsapp_products.count({ where: { organization_id: orgId, id: { in: ids }, billing: { not: 'once' } } });
    if (n !== ids.length) throw new BadRequestException('Algum plano escolhido em "incluso nos planos" não existe ou não é recorrente.');
  }

  /** Regras de acesso (Fase 5): normaliza (400 com a mensagem da regra inválida); sem regras = null. */
  private entitlementData(raw: unknown): any {
    if (!raw || typeof raw !== 'object') return null;
    try {
      const { rules } = normalizeRules(raw, { strict: true });
      return rules.length ? { rules } : null;
    } catch (e: any) {
      if (e instanceof EntitlementRuleError) throw new BadRequestException(e.message);
      throw e;
    }
  }
  /** Os alvos das regras são da org (número, etiqueta, arquivo); o arquivo digital deixa de vencer (retenção de 90 dias). */
  private async checkEntitlementRefs(orgId: string, ent: any) {
    const rules: any[] = Array.isArray(ent?.rules) ? ent.rules : [];
    if (!rules.length) return;
    const uniq = (xs: any[]) => [...new Set(xs.filter(Boolean).map(String))];
    const sessIds = uniq(rules.filter((r) => r.kind === 'group_member').map((r) => r.session_id));
    const tagIds = uniq(rules.filter((r) => r.kind === 'tag').map((r) => r.ref));
    const mediaIds = uniq(rules.filter((r) => r.kind === 'digital_file').map((r) => r.ref));
    if (sessIds.length && (await this.prisma.whatsapp_sessions.count({ where: { organization_id: orgId, id: { in: sessIds } } })) !== sessIds.length) throw new BadRequestException('Regra de acesso: o número escolhido para o grupo não existe.');
    if (tagIds.length && (await this.prisma.whatsapp_tags.count({ where: { organization_id: orgId, id: { in: tagIds } } })) !== tagIds.length) throw new BadRequestException('Regra de acesso: a etiqueta escolhida não existe.');
    if (mediaIds.length) {
      if ((await this.prisma.whatsapp_media.count({ where: { organization_id: orgId, id: { in: mediaIds } } })) !== mediaIds.length) throw new BadRequestException('Regra de acesso: o arquivo não existe mais. Envie de novo.');
      await this.prisma.whatsapp_media.updateMany({ where: { organization_id: orgId, id: { in: mediaIds } }, data: { expires_at: null } }).catch(() => undefined);
    }
  }

  async createProduct(orgId: string, dto: any) {
    const n = await this.prisma.whatsapp_products.count({ where: { organization_id: orgId } });
    if (n >= 500) throw new BadRequestException('Limite de 500 produtos.');
    const data = this.productData(dto);
    data.custom = (await this.cf.apply(orgId, 'product', dto.custom, { mode: 'create' })) || null;
    await this.checkEntitlementRefs(orgId, data.entitlement);
    await this.checkIncludedPlans(orgId, data);
    const p = await this.prisma.whatsapp_products.create({ data: { organization_id: orgId, ...data, position: n } });
    return this.shapeProduct(p);
  }

  async updateProduct(orgId: string, id: string, dto: any) {
    const cur = await this.prisma.whatsapp_products.findFirst({ where: { id, organization_id: orgId } });
    if (!cur) throw new NotFoundException('Produto não encontrado.');
    const data: any = {};
    // DTO de update chega com as chaves ausentes como `undefined` → só o que veio sobrescreve o atual
    const clean: any = Object.fromEntries(Object.entries(dto || {}).filter(([, v]) => v !== undefined));
    // `billing` sem `billing_interval_months`: o intervalo acompanha o enum novo (senão o intervalo antigo do produto venceria e desfaria a troca)
    if ('billing' in clean && !('billing_interval_months' in clean)) clean.billing_interval_months = BILLING_MONTHS[String(clean.billing)] || null;
    const keys = ['name', 'description', 'price_cents', 'billing', 'active', 'trial_days', 'grace_days', 'prorate', 'cancel_policy', 'billing_interval_months', 'charge_days_before', 'reminder_rules', 'entitlement', 'custom', 'category', 'installments_max', 'kind', 'duration_minutes', 'buffer_after_minutes', 'capacity', 'booking', 'included_in_plans'];
    if (keys.some((k) => k in clean)) {
      // `kind` ausente mantém o atual (serviço continua serviço); plano/produto acompanham a cobrança
      if (!('kind' in clean)) clean.kind = cur.kind === 'service' ? 'service' : undefined;
      if (clean.kind === 'service' && cur.kind !== 'service' && cur.billing !== 'once') {
        const subs = await this.prisma.whatsapp_subscriptions.count({ where: { product_id: id, status: { in: ['active', 'overdue', 'paused'] } } });
        if (subs) throw new BadRequestException('Este plano tem assinaturas em andamento; não dá para transformá-lo em serviço.');
      }
      Object.assign(data, this.productData({ ...cur, ...clean }));
      if ('custom' in clean) data.custom = await this.cf.apply(orgId, 'product', clean.custom, { mode: 'update', current: cur.custom });
      else delete data.custom; // não regravar o custom atual pelo productData
      await this.checkIncludedPlans(orgId, data);
    }
    if (dto.position !== undefined) data.position = Math.max(0, Number(dto.position) || 0);
    const rulesBefore = JSON.stringify(normalizeRules(cur.entitlement).rules);
    const rulesChanged = 'entitlement' in data && JSON.stringify(normalizeRules(data.entitlement).rules) !== rulesBefore;
    if (rulesChanged) await this.checkEntitlementRefs(orgId, data.entitlement);
    const p = await this.prisma.whatsapp_products.update({ where: { id }, data });
    if (rulesChanged) this.hooks.emit('product_entitlements_changed', { orgId, product_id: id }); // Fase 5: o motor re-sincroniza as assinaturas (hook evita DI circular)
    // o nome do produto é copiado nas assinaturas (fica mesmo se o produto sumir); renomear atualiza as ativas
    if (dto.name && dto.name !== cur.name) await this.prisma.whatsapp_subscriptions.updateMany({ where: { organization_id: orgId, product_id: id, status: { in: ['active', 'overdue', 'paused'] } }, data: { product_name: p.name } });
    return this.shapeProduct(p);
  }

  async removeProduct(orgId: string, id: string) {
    const cur = await this.prisma.whatsapp_products.findFirst({ where: { id, organization_id: orgId } });
    if (!cur) throw new NotFoundException('Produto não encontrado.');
    const inUse = await this.prisma.whatsapp_subscriptions.count({ where: { product_id: id, status: { in: ['active', 'overdue', 'paused'] } } });
    if (inUse) throw new BadRequestException(`Há ${inUse} assinatura${inUse === 1 ? '' : 's'} em andamento com este produto. Desative-o em vez de excluir.`);
    await this.prisma.whatsapp_products.delete({ where: { id } });
    return { ok: true };
  }

  // ---------------------------------------------------------------- clientes
  /** Formato da assinatura = o do motor (`subscriptions.shape`, com carência e `coupon_code` quando veio por `shapeMany`). */
  private shapeSub(s: any) {
    return s.__shaped || this.subscriptions.shape(s);
  }
  private shapeCustomer(c: any, contact: any, subs: any[], fields: any[] = [], chats: Array<{ chat_id: string; session_id: string; jid: string; session: any }> = [], links: Array<{ contact: any; role: string; linked_by: string }> = []) {
    const shapedSubs = subs.map((s) => this.shapeSub(s));
    const live = shapedSubs.filter((s) => s.status === 'active' || s.status === 'overdue');
    const paused = shapedSubs.filter((s) => s.status === 'paused');
    const overdue = shapedSubs.some((s) => s.status === 'overdue');
    const next = live.filter((s) => s.next_due_at).sort((a, b) => String(a.next_due_at).localeCompare(String(b.next_due_at)))[0] || null;
    const monthly = live.reduce((acc, s) => acc + (BILLING_MONTHS[s.billing] ? s.price_cents / BILLING_MONTHS[s.billing] : 0), 0);
    const custom = c.custom && typeof c.custom === 'object' ? c.custom : {};
    return {
      id: c.id, contact_id: c.contact_id, name: c.name, doc: c.doc, doc_masked: maskDoc(c.doc), email: c.email, address: c.address || null, notes: c.notes, custom,
      code: c.code || null, kind: c.kind || 'person', parent_customer_id: c.parent_customer_id || null, source: c.source || 'panel',
      // Fase 7: unidade, id no sistema externo, endereços de atendimento/entrega
      unit_id: c.unit_id || null, unit: c.unit_id ? { id: c.unit_id, name: c.__unit_name || null } : null, external_id: c.external_id || null, addresses: Array.isArray(c.addresses) ? c.addresses : [], erased_at: c.erased_at || null,
      // números da pessoa (titular primeiro); `contact_id`/`phone` acima = o principal
      contacts: links.map((l) => ({ id: l.contact.id, phone: l.contact.phone || null, phone_label: l.contact.phone ? `+${l.contact.phone}` : '', name: l.contact.name || l.contact.push_name || null, wa_id: l.contact.wa_id, role: l.role, role_label: ROLE_LABEL[l.role] || l.role, linked_by: l.linked_by, primary: l.contact.id === c.contact_id })),
      custom_list: customList(fields, custom),
      status: c.status, since: c.since ? dateOnly(new Date(c.since)) : null, created_at: c.created_at, updated_at: c.updated_at,
      phone: contact?.phone || null, phone_label: contact?.phone ? `+${contact.phone}` : '', push_name: contact?.push_name || null,
      // conversas da pessoa (uma por número, a mais recente primeiro); `chat_id` = uuid da primeira (compat)
      jid: contact?.wa_id || null,
      chats,
      chat_id: chats[0]?.chat_id || null,
      contact_tags: Array.isArray(contact?.tags) ? contact.tags : [],
      subscriptions: shapedSubs,
      billing_status: c.status !== 'active' ? 'inactive' : overdue ? 'overdue' : live.length ? 'ok' : paused.length ? 'paused' : 'none',
      next_due_at: next?.next_due_at || null, next_due_label: next?.next_due_label || '', days_to_due: next?.days_to_due ?? null,
      monthly_cents: Math.round(monthly), monthly_label: formatBRL(Math.round(monthly)),
      products: live.map((s) => s.product_name),
    };
  }

  /** jids pelos quais a pessoa pode aparecer numa conversa (telefone, @lid, wa_id). */
  private contactJids(contact: any): string[] {
    if (!contact) return [];
    return [...new Set([contact.wa_id, contact.lid, contact.phone ? jidFromPhone(contact.phone) : null].filter(Boolean))] as string[];
  }

  /** Conversas (uma por número) de cada contato, no formato público, mais recentes primeiro. */
  private async chatsOfContacts(orgId: string, contacts: any[]) {
    const out = new Map<string, Array<{ chat_id: string; session_id: string; jid: string; session: any; last_message_at: Date | null }>>();
    const all = [...new Set(contacts.flatMap((c) => this.contactJids(c)))];
    if (!all.length) return out;
    const [rows, smap] = await Promise.all([
      this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, kind: 'individual', chat_id: { in: all } }, select: { id: true, session_id: true, chat_id: true, last_message_at: true }, orderBy: { last_message_at: 'desc' } }),
      this.presenter.sessionMap(orgId),
    ]);
    const byJid = new Map<string, typeof rows>();
    for (const r of rows) byJid.set(r.chat_id, [...(byJid.get(r.chat_id) || []), r]);
    for (const c of contacts) {
      const seen = new Set<string>();
      const list: Array<{ chat_id: string; session_id: string; jid: string; session: any; last_message_at: Date | null }> = [];
      for (const jid of this.contactJids(c)) for (const r of byJid.get(jid) || []) if (!seen.has(r.id)) { seen.add(r.id); list.push({ chat_id: r.id, session_id: r.session_id, jid: r.chat_id, session: smap.get(r.session_id) || null, last_message_at: r.last_message_at }); }
      list.sort((a, b) => (b.last_message_at?.getTime() || 0) - (a.last_message_at?.getTime() || 0));
      out.set(c.id, list);
    }
    return out;
  }

  private async hydrate(orgId: string, rows: any[]) {
    if (!rows.length) return [];
    const links = await this.identity.linksOfCustomers(rows.map((r) => r.id));
    const contactIds = [...new Set([...rows.map((r) => r.contact_id), ...[...links.values()].flat().map((l) => l.contact_id)])];
    const unitIds = [...new Set(rows.map((r) => r.unit_id).filter(Boolean))] as string[];
    const [contacts, subs, cfg, units] = await Promise.all([
      this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, id: { in: contactIds } } }),
      this.prisma.whatsapp_subscriptions.findMany({ where: { organization_id: orgId, customer_id: { in: rows.map((r) => r.id) } }, orderBy: [{ status: 'asc' }, { created_at: 'asc' }] }),
      this.settings(orgId),
      unitIds.length ? this.prisma.whatsapp_units.findMany({ where: { id: { in: unitIds }, organization_id: orgId }, select: { id: true, name: true } }) : Promise.resolve([] as Array<{ id: string; name: string }>),
    ]);
    const unitName = new Map(units.map((u) => [u.id, u.name] as [string, string]));
    const byContact = new Map(contacts.map((c) => [c.id, c]));
    const chats = await this.chatsOfContacts(orgId, contacts);
    const byCustomer = new Map<string, any[]>();
    const shapedSubs = await this.subscriptions.shapeMany(orgId, subs);
    for (const [i, s] of subs.entries()) byCustomer.set(s.customer_id, [...(byCustomer.get(s.customer_id) || []), { ...s, __shaped: shapedSubs[i] }]);
    return rows.map((r) => {
      const ls = (links.get(r.id) || []).map((l) => ({ contact: byContact.get(l.contact_id) as any, role: l.role, linked_by: l.linked_by })).filter((l) => Boolean(l.contact));
      if (!ls.length && byContact.get(r.contact_id)) ls.push({ contact: byContact.get(r.contact_id), role: 'owner', linked_by: 'panel' }); // cliente sem vínculo (não deveria): o principal
      // conversas de TODOS os números do cliente, sem repetir, mais recentes primeiro
      const seen = new Set<string>();
      const allChats = ls.flatMap((l) => chats.get(l.contact.id) || []).filter((x) => (seen.has(x.chat_id) ? false : (seen.add(x.chat_id), true))).sort((a, b) => (b.last_message_at?.getTime() || 0) - (a.last_message_at?.getTime() || 0));
      return this.shapeCustomer({ ...r, __unit_name: r.unit_id ? unitName.get(r.unit_id) || null : null }, byContact.get(r.contact_id), byCustomer.get(r.id) || [], cfg.custom_fields.customer, allChats.map(({ last_message_at: _l, ...x }) => x), ls);
    });
  }

  /** ids de clientes vinculados a qualquer um dos contatos (para filtros da lista). */
  private async customerIdsOfContacts(contactIds: string[]) {
    if (!contactIds.length) return [] as string[];
    const rows = await this.prisma.whatsapp_customer_contacts.findMany({ where: { contact_id: { in: contactIds } }, select: { customer_id: true } });
    return [...new Set(rows.map((r) => r.customer_id))];
  }

  async listCustomers(orgId: string, q: any = {}) {
    const page = Math.max(1, parseInt(String(q.page || 1), 10) || 1);
    const size = Math.min(200, Math.max(5, parseInt(String(q.page_size || 25), 10) || 25));
    const where: any = { organization_id: orgId };
    if (q.status === 'active' || q.status === 'inactive') where.status = q.status;
    if (q.q) {
      const s = String(q.q).trim(), d = digitsOf(s);
      const byPhone = d.length >= 4 ? await this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, phone: { contains: d } }, select: { id: true }, take: 500 }) : [];
      const byLink = byPhone.length ? await this.customerIdsOfContacts(byPhone.map((c) => c.id)) : [];
      // documento é cifrado: só casa pelo hash quando os dígitos formam um CPF/CNPJ válido
      const hash = (d.length === 11 || d.length === 14) && docIsValid(d) ? docHash(orgId, d) : null;
      where.OR = [{ name: { contains: s } }, { email: { contains: s } }, { code: { contains: s } }, ...(hash ? [{ doc_hash: hash }] : []), ...(byLink.length ? [{ id: { in: byLink } }] : []), ...(byPhone.length ? [{ contact_id: { in: byPhone.map((c) => c.id) } }] : [])];
    }
    if (q.session_id) {
      // só clientes cujo contato tem conversa individual naquele NÚMERO (casa por wa_id, lid ou telefone@c.us)
      const chats = await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, session_id: String(q.session_id), kind: 'individual' }, select: { chat_id: true }, take: 20000 });
      const jids = chats.map((c) => c.chat_id);
      const phones = jids.map((j) => j.split('@')[0]).filter((d) => /^\d{8,15}$/.test(d));
      const contacts = jids.length
        ? await this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, OR: [{ wa_id: { in: jids } }, { lid: { in: jids } }, ...(phones.length ? [{ phone: { in: phones } }] : [])] }, select: { id: true }, take: 20000 })
        : [];
      const ids = contacts.map((c) => c.id);
      const linked = await this.customerIdsOfContacts(ids);
      where.OR = [...(where.OR ? [{ OR: where.OR }] : []), { contact_id: { in: ids.length ? ids : ['__none__'] } }, { id: { in: linked.length ? linked : ['__none__'] } }];
      if (where.OR.length === 3) { const search = where.OR.shift(); where.AND = [search, { OR: where.OR }]; delete where.OR; }
    }
    if (q.unit_id) where.unit_id = String(q.unit_id) === 'none' ? null : String(q.unit_id);
    if (q.external_id) where.external_id = String(q.external_id).trim().slice(0, 64);
    if (q.product_id) {
      const subs = await this.prisma.whatsapp_subscriptions.findMany({ where: { organization_id: orgId, product_id: String(q.product_id), status: { in: ['active', 'overdue', 'paused'] } }, select: { customer_id: true } });
      where.id = { in: [...new Set(subs.map((s) => s.customer_id))] };
    }
    // "em atraso" = o runner gravou `overdue` OU ativa vencida (dia em BRT); só ids distintos de cliente, nunca as linhas
    const overdueWhere = { organization_id: orgId, OR: [{ status: 'overdue' }, { status: 'active', next_due_at: { lt: todayBRT() } }] };
    if (q.billing === 'overdue') {
      const subs = await this.prisma.whatsapp_subscriptions.groupBy({ by: ['customer_id'], where: overdueWhere });
      where.id = { in: subs.map((s) => s.customer_id).filter((id) => !where.id || where.id.in.includes(id)) };
    }
    const [total, rows, counts, overdueGroups, mrr] = await Promise.all([
      this.prisma.whatsapp_customers.count({ where }),
      this.prisma.whatsapp_customers.findMany({ where, orderBy: [{ status: 'asc' }, { name: 'asc' }], skip: (page - 1) * size, take: size }),
      this.prisma.whatsapp_customers.groupBy({ by: ['status'], where: { organization_id: orgId }, _count: { _all: true } }),
      this.prisma.whatsapp_subscriptions.groupBy({ by: ['customer_id'], where: overdueWhere }), // 1 linha por cliente em atraso (KPI da org)
      this.prisma.whatsapp_subscriptions.groupBy({ by: ['billing'], where: { organization_id: orgId, status: { in: ['active', 'overdue'] }, billing: { in: ['monthly', 'quarterly', 'semiannual', 'yearly'] } }, _sum: { price_cents: true } }), // MRR = 4 linhas, não todas as assinaturas
    ]);
    const monthly = mrr.reduce((a, g) => a + (g._sum.price_cents || 0) / (BILLING_MONTHS[g.billing] || 1), 0);
    return {
      items: await this.hydrate(orgId, rows), total, page, page_size: size, pages: Math.max(1, Math.ceil(total / size)),
      counts: { total: counts.reduce((a, c) => a + c._count._all, 0), active: counts.find((c) => c.status === 'active')?._count._all || 0, inactive: counts.find((c) => c.status === 'inactive')?._count._all || 0, overdue: overdueGroups.length, monthly_cents: Math.round(monthly), monthly_label: formatBRL(Math.round(monthly)) },
    };
  }

  async getCustomer(orgId: string, id: string) {
    const c = await this.prisma.whatsapp_customers.findFirst({ where: { id, organization_id: orgId } });
    if (!c) throw new NotFoundException('Cliente não encontrado.');
    return (await this.hydrate(orgId, [c]))[0];
  }

  /** Cliente da conversa pelo uuid (API). null se o contato ainda não foi promovido. Inclui o contato e a conversa. */
  async byChat(orgId: string, chatUuid: string, customerId?: string | null) {
    const row = await this.prisma.whatsapp_chats.findFirst({ where: { id: String(chatUuid || ''), organization_id: orgId }, select: { id: true, session_id: true, chat_id: true } });
    if (!row) return { customer: null, contact: null, chat: null, customers: [] as any[] };
    const r = await this.byContactJid(orgId, row.session_id, row.chat_id, { customerId });
    return { ...r, chat: { chat_id: row.id, session_id: row.session_id, jid: row.chat_id } };
  }

  /** Cliente de (número, jid) — para quem já tem o jid (bot, broadcasts, agendamentos, cobranças). `session` = id da sessão ou null. */
  async byContactJid(orgId: string, session: string | null | undefined, jid: string, opts: { customerId?: string | null } = {}) {
    if (!jid || isGroupJid(jid)) return { customer: null, contact: null, customers: [] as any[] };
    const { contact, customers } = await this.identity.customersOfJid(orgId, session, jid);
    if (!contact) return { customer: null, contact: null, customers: [] as any[] };
    // vários clientes no mesmo número: `customerId` escolhe; senão o titular (ordem por papel)
    const pick = (opts.customerId && customers.find((x) => x.customer.id === opts.customerId)) || customers[0] || null;
    return {
      customer: pick ? (await this.hydrate(orgId, [pick.customer]))[0] : null,
      contact: { id: contact.id, name: contact.name || contact.push_name || null, phone: contact.phone, wa_id: contact.wa_id },
      customers: customers.map((x) => ({ id: x.customer.id, name: x.customer.name, status: x.customer.status, role: x.role, role_label: ROLE_LABEL[x.role] || x.role, code: x.customer.code || null })),
    };
  }

  private async customerData(orgId: string, dto: any, cur?: any) {
    const data: any = {};
    if (dto.name !== undefined) { const n = String(dto.name || '').trim().slice(0, 255); if (!n) throw new BadRequestException('Informe o nome do cliente.'); data.name = n; }
    if (dto.doc !== undefined) {
      const d = cleanDoc(dto.doc);
      if (d && !isValidDoc(d)) throw new BadRequestException('CPF/CNPJ inválido.');
      data.doc = d;
      data.doc_hash = d ? docHash(orgId, d) : null;
    }
    if (dto.code !== undefined) data.code = String(dto.code ?? '').trim().slice(0, 32) || null;
    if (dto.kind !== undefined) data.kind = dto.kind === 'company' ? 'company' : 'person';
    if (dto.parent_customer_id !== undefined) {
      if (dto.parent_customer_id) {
        const parent = await this.prisma.whatsapp_customers.findFirst({ where: { id: String(dto.parent_customer_id), organization_id: orgId }, select: { id: true } });
        if (!parent) throw new NotFoundException('Cliente responsável não encontrado.');
        if (cur && parent.id === cur.id) throw new BadRequestException('Um cliente não pode ser responsável por si mesmo.');
        data.parent_customer_id = parent.id;
      } else data.parent_customer_id = null;
    }
    if (dto.email !== undefined) {
      const e = String(dto.email || '').trim().toLowerCase().slice(0, 255);
      if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new BadRequestException('E-mail inválido.');
      data.email = e || null;
    }
    if (dto.address !== undefined) {
      const a = dto.address && typeof dto.address === 'object' ? dto.address : {};
      const pick = (k: string, max: number) => String((a as any)[k] || '').trim().slice(0, max) || undefined;
      const addr: any = { zip: digitsOf((a as any).zip).slice(0, 8) || undefined, street: pick('street', 120), number: pick('number', 20), complement: pick('complement', 60), district: pick('district', 80), city: pick('city', 80), state: pick('state', 2)?.toUpperCase() };
      data.address = Object.values(addr).some(Boolean) ? addr : null;
    }
    if (dto.notes !== undefined) data.notes = String(dto.notes || '').trim().slice(0, 20000) || null;
    // campos personalizados (Fase 7): tipos, obrigatórios na criação (importação de planilha não exige)
    const custom = await this.cf.apply(orgId, 'customer', dto.custom, { mode: cur === undefined ? 'create' : 'update', current: cur?.custom, skipRequired: INTERNAL_SOURCES.includes(String(dto.source)) || dto.__internal === true });
    if (custom !== undefined) data.custom = custom;
    if (dto.unit_id !== undefined) {
      if (dto.unit_id) {
        const u = await this.prisma.whatsapp_units.findFirst({ where: { id: String(dto.unit_id), organization_id: orgId }, select: { id: true } });
        if (!u) throw new NotFoundException('Unidade não encontrada.');
        data.unit_id = u.id;
      } else data.unit_id = null;
    }
    if (dto.external_id !== undefined) data.external_id = String(dto.external_id ?? '').trim().slice(0, 64) || null;
    if (dto.addresses !== undefined) data.addresses = normalizeAddresses(dto.addresses);
    if (dto.status !== undefined) data.status = CUSTOMER_STATUSES.includes(dto.status) ? dto.status : 'active';
    if (dto.since !== undefined) data.since = parseDate(dto.since);
    if (cur === undefined && !data.name) throw new BadRequestException('Informe o nome do cliente.');
    return data;
  }

  async createCustomer(orgId: string, userId: string | null, dto: any) {
    let contact: any = null;
    if (dto.contact_id) {
      contact = await this.prisma.whatsapp_contacts.findFirst({ where: { id: String(dto.contact_id), organization_id: orgId } });
      if (!contact) throw new NotFoundException('Contato não encontrado.');
    } else if (dto.phone) {
      const shaped = await this.contacts.createManual(orgId, { phone: dto.phone, name: dto.name });
      contact = await this.prisma.whatsapp_contacts.findUnique({ where: { id: shaped.id } });
    } else throw new BadRequestException('Informe o contato ou o telefone.');
    const existing = await this.identity.customersOfContact(orgId, contact.id);
    if (existing.length && !dto.another) throw new BadRequestException(`Este número já é do cliente "${existing[0].customer.name}". Para cadastrar outro cliente com o mesmo número, marque "outro cliente neste número".`);
    const data = await this.customerData(orgId, { ...dto, name: dto.name || contact.name || contact.push_name || (contact.phone ? `+${contact.phone}` : 'Cliente') });
    if (!contact.saved) await this.prisma.whatsapp_contacts.update({ where: { id: contact.id }, data: { saved: true } }).catch(() => undefined);
    const source = ['panel', 'import', 'bot', 'api'].includes(dto.source) ? dto.source : 'panel';
    let c: any;
    try {
      c = await this.prisma.whatsapp_customers.create({ data: { organization_id: orgId, contact_id: contact.id, created_by: userId, since: todayBRT(), source, ...data } });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new BadRequestException(String(e?.meta?.target || e?.message || '').includes('external') ? 'Já existe um cliente com esse código externo.' : 'Já existe um cliente com esse código.');
      throw e;
    }
    await this.prisma.whatsapp_customer_contacts.create({ data: { customer_id: c.id, contact_id: contact.id, role: 'owner', linked_by: source === 'bot' ? 'bot' : source === 'import' ? 'import' : source === 'api' ? 'api' : 'panel' } }).catch(() => undefined);
    for (const ph of Array.isArray(dto.phones) ? dto.phones.slice(0, 20) : []) await this.identity.linkContact(orgId, c.id, { phone: String(ph) }, 'user', source === 'import' ? 'import' : 'panel').catch(() => undefined);
    this.hooks.emit('customer_created', { orgId, customer_id: c.id, source }); // Fase 5: webhooks de saída
    return (await this.hydrate(orgId, [c]))[0];
  }

  // ---------------------------------------------------------------- identidade (Fase 1)
  /** Busca por documento/código/telefone — resposta mínima (o front e o bot usam para "achar o cadastro"). */
  async lookupCustomer(orgId: string, q: any) {
    const key = q?.doc !== undefined ? { doc: String(q.doc) } : q?.code !== undefined ? { code: String(q.code) } : q?.phone !== undefined ? { phone: String(q.phone) } : q?.contact_id ? { contact_id: String(q.contact_id) } : {};
    const r = await this.identity.findCustomer(orgId, key);
    if (!r.found.length) throw new NotFoundException(r.reason === 'invalid_doc' ? 'CPF/CNPJ inválido.' : r.reason === 'invalid_code' ? 'Informe o código.' : r.reason === 'invalid_phone' ? 'Telefone inválido.' : 'Cliente não encontrado.');
    return { items: await this.hydrate(orgId, r.found) };
  }
  /** A-8: 404 se não é da org; 400 se os dados foram apagados (LGPD). */
  async assertNotErased(orgId: string, customerId: string) {
    const c = await this.prisma.whatsapp_customers.findFirst({ where: { id: String(customerId || ''), organization_id: orgId }, select: { id: true, erased_at: true } });
    if (!c) throw new NotFoundException('Cliente não encontrado.');
    if (c.erased_at) throw new BadRequestException(ERASED_MSG);
    return c;
  }

  async linkContact(orgId: string, customerId: string, dto: { contact_id?: string; phone?: string; role?: string }) {
    await this.assertNotErased(orgId, customerId);
    await this.identity.linkContact(orgId, customerId, dto, dto.role || 'user', 'panel');
    return this.getCustomer(orgId, customerId);
  }
  async setContactRole(orgId: string, customerId: string, contactId: string, role: string) {
    await this.assertNotErased(orgId, customerId);
    await this.identity.setRole(orgId, customerId, contactId, role);
    if (role === 'owner') {
      await this.prisma.whatsapp_customers.update({ where: { id: customerId }, data: { contact_id: contactId } }).catch(() => undefined); // titular vira o principal
      this.hooks.emit('customer_updated', { orgId, customer_id: customerId }); // telefone principal mudou (grupo VIP acompanha)
    }
    return this.getCustomer(orgId, customerId);
  }
  async unlinkContact(orgId: string, customerId: string, contactId: string) {
    await this.identity.unlinkContact(orgId, customerId, contactId);
    return this.getCustomer(orgId, customerId);
  }

  // ---------------------------------------------------------------- CSV
  /** Colunas: phone,name,doc,email,zip,street,number,district,city,state,notes,product,price,due_day,code,kind,phones (só phone obrigatória; `phones` = outros números separados por `|`). */
  async importCsv(orgId: string, userId: string | null, buf: Buffer) {
    const text = buf.toString('utf8').replace(/^﻿/, '');
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new BadRequestException('Arquivo vazio ou sem linhas de dados.');
    const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
    const split = (line: string) => {
      const out: string[] = []; let cur = ''; let q = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
        else if (ch === sep && !q) { out.push(cur); cur = ''; }
        else cur += ch;
      }
      out.push(cur);
      return out.map((x) => x.trim());
    };
    const header = split(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z_]/g, ''));
    const col = (row: string[], ...names: string[]) => { for (const n of names) { const i = header.indexOf(n); if (i >= 0 && row[i] !== undefined) return row[i]; } return ''; };
    if (!header.some((h) => ['phone', 'telefone'].includes(h))) throw new BadRequestException('O cabeçalho precisa ter a coluna "phone" (telefone).');
    const products = await this.prisma.whatsapp_products.findMany({ where: { organization_id: orgId } });
    const byName = new Map(products.map((p) => [p.name.trim().toLowerCase(), p]));
    let imported = 0, updated = 0, skipped = 0, subscriptions = 0;
    const errors: string[] = [];
    for (const [i, line] of lines.slice(1, 2001).entries()) {
      const row = split(line);
      const phone = digitsOf(col(row, 'phone', 'telefone'));
      const name = col(row, 'name', 'nome');
      if (phone.length < 10 || phone.length > 15) { skipped++; if (errors.length < 20) errors.push(`linha ${i + 2}: telefone inválido`); continue; }
      try {
        const dto: any = { phone, name: name || undefined, doc: col(row, 'doc', 'cpf', 'cnpj', 'documento') || undefined, email: col(row, 'email', 'e_mail') || undefined, notes: col(row, 'notes', 'observacoes', 'obs') || undefined, code: col(row, 'code', 'codigo', 'matricula', 'contrato') || undefined, kind: /^(company|empresa|pj|cnpj)$/i.test(col(row, 'kind', 'tipo')) ? 'company' : undefined, source: 'import' };
        const extraPhones = col(row, 'phones', 'telefones', 'outros_telefones').split(/[|;\s]+/).map((x) => digitsOf(x)).filter((x) => x.length >= 10 && x.length <= 15 && x !== phone);
        if (extraPhones.length) dto.phones = extraPhones;
        const addr = { zip: col(row, 'zip', 'cep'), street: col(row, 'street', 'rua', 'logradouro'), number: col(row, 'number', 'numero'), district: col(row, 'district', 'bairro'), city: col(row, 'city', 'cidade'), state: col(row, 'state', 'uf', 'estado') };
        if (Object.values(addr).some(Boolean)) dto.address = addr;
        const shaped = await this.contacts.createManual(orgId, { phone, name: name || undefined });
        const existingList = await this.identity.customersOfContact(orgId, shaped.id);
        const existing = existingList.find((x) => !x.customer.erased_at)?.customer || null; // A-8: cliente apagado (LGPD) não é atualizado
        let customer: any;
        if (existing) {
          const { phones: ph, source: _s, ...rest } = dto;
          customer = await this.updateCustomer(orgId, existing.id, rest); updated++;
          for (const x of ph || []) await this.identity.linkContact(orgId, existing.id, { phone: x }, 'user', 'import').catch(() => undefined);
        } else { customer = await this.createCustomer(orgId, userId, { ...dto, contact_id: shaped.id }); imported++; }
        const prodName = col(row, 'product', 'produto').trim();
        if (prodName) {
          let prod = byName.get(prodName.toLowerCase());
          const priceCents = Math.round(parseFloat(String(col(row, 'price', 'valor', 'preco')).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')) * 100);
          // C-H2: periodicidade pela coluna `billing` (PT ou inglês); sem coluna, pelo nome do produto ("Plano Anual"); senão mensal
          const billRaw = col(row, 'billing', 'cobranca', 'periodicidade', 'ciclo', 'recorrencia');
          const billing = parseBilling(billRaw);
          if (billing === '') throw new BadRequestException(`periodicidade "${billRaw}" inválida (use avulso, mensal, trimestral, semestral ou anual)`);
          if (prod && billing && prod.billing !== billing) throw new BadRequestException(`o produto "${prod.name}" é ${BILLING_LABEL[prod.billing] || prod.billing} e a planilha diz ${BILLING_LABEL[billing] || billing}`);
          if (!prod && Number.isFinite(priceCents) && priceCents > 0) {
            const bill = billing || billingFromName(prodName) || 'monthly';
            const months = BILLING_MONTHS[bill] || null;
            prod = await this.prisma.whatsapp_products.create({ data: { organization_id: orgId, name: prodName.slice(0, 120), price_cents: priceCents, billing: bill as any, billing_interval_months: months, kind: months ? 'plan' : 'product', position: products.length + byName.size } });
            byName.set(prodName.toLowerCase(), prod);
          }
          if (prod) {
            const has = (customer.subscriptions || []).some((x: any) => x.product_id === prod!.id && x.status !== 'canceled');
            // cliente antigo importado: sem teste grátis (`trial:false`; o motor também força pela origem `import`) e sem cobrança na hora
            if (!has) { const dueDay = parseInt(col(row, 'due_day', 'dia_vencimento', 'vencimento'), 10); await this.addSubscription(orgId, customer.id, { product_id: prod.id, trial: false, ...(Number.isFinite(priceCents) && priceCents > 0 ? { price_cents: priceCents } : {}), ...(Number.isFinite(dueDay) ? { due_day: Math.min(28, Math.max(1, dueDay)) } : {}) }, { source: 'import', user_id: userId }); subscriptions++; }
          } else if (errors.length < 20) errors.push(`linha ${i + 2}: produto "${prodName}" não existe (informe price para criar)`);
        }
      } catch (e: any) {
        skipped++;
        if (errors.length < 20) errors.push(`linha ${i + 2}: ${e?.message || 'erro'}`);
      }
    }
    return { imported, updated, skipped, subscriptions, errors };
  }

  async exportCsv(orgId: string) {
    const rows = await this.prisma.whatsapp_customers.findMany({ where: { organization_id: orgId }, orderBy: { name: 'asc' }, take: 20000 });
    const items = await this.hydrate(orgId, rows);
    // P7-12: célula começando com = + - @ TAB CR ganha apóstrofo (o Excel/Sheets não executa como fórmula)
    const esc = (v: any) => `"${csvSafe(v).replace(/"/g, '""')}"`;
    const lines = ['phone,name,doc,email,zip,street,number,district,city,state,notes,status,products,monthly,next_due,since,code,kind,phones'];
    for (const c of items as any[]) {
      const a = c.address || {};
      const others = (c.contacts || []).filter((x: any) => !x.primary && x.phone).map((x: any) => x.phone).join('|');
      lines.push([esc(c.phone || ''), esc(c.name), esc(c.doc || ''), esc(c.email || ''), esc(a.zip || ''), esc(a.street || ''), esc(a.number || ''), esc(a.district || ''), esc(a.city || ''), esc(a.state || ''), esc(c.notes || ''), esc(c.status), esc((c.products || []).join('|')), esc(((c.monthly_cents || 0) / 100).toFixed(2).replace('.', ',')), esc(c.next_due_at || ''), esc(c.since || ''), esc(c.code || ''), esc(c.kind || 'person'), esc(others)].join(','));
    }
    return '﻿' + lines.join('\n');
  }

  async updateCustomer(orgId: string, id: string, dto: any) {
    const cur = await this.prisma.whatsapp_customers.findFirst({ where: { id, organization_id: orgId } });
    if (!cur) throw new NotFoundException('Cliente não encontrado.');
    if (cur.erased_at) throw new BadRequestException(ERASED_MSG);
    const data = await this.customerData(orgId, dto, cur);
    let c: any;
    try {
      c = await this.prisma.whatsapp_customers.update({ where: { id }, data });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new BadRequestException(String(e?.meta?.target || e?.message || '').includes('external') ? 'Já existe um cliente com esse código externo.' : 'Já existe um cliente com esse código.');
      throw e;
    }
    if (data.name && data.name !== cur.name) await this.prisma.whatsapp_contacts.update({ where: { id: cur.contact_id }, data: { name: data.name } }).catch(() => undefined);
    this.hooks.emit('customer_updated', { orgId, customer_id: id }); // Fase 5: webhooks de saída + motor de acesso (telefone principal)
    return (await this.hydrate(orgId, [c]))[0];
  }

  /**
   * Antes de apagar cliente/assinatura: cancela no gateway as cobranças PENDING (as da assinatura pelo motor, as avulsas
   * do cliente direto), marca CANCELED e tira os envios da fila. Best-effort: erro do gateway só vira warn, o delete segue.
   */
  private async cancelOpenCharges(orgId: string, customerId: string, subscriptionIds: string[]) {
    for (const subId of subscriptionIds) await this.subscriptions.cancelPendingCharges(orgId, subId).catch((e: any) => this.logger.warn(`cancelar cobranças da assinatura ${subId}: ${e?.message || e}`));
    const loose = await this.prisma.whatsapp_charges.findMany({ where: { organization_id: orgId, customer_id: customerId, subscription_id: null, status: 'PENDING' } }).catch(() => [] as any[]);
    if (!loose.length) return;
    const gw = await this.prisma.telegram_payment_settings.findUnique({ where: { organization_id: orgId } }).catch(() => null);
    for (const c of loose) {
      try { await cancelChargeRemote(gw, c); } catch (e: any) { this.logger.warn(`cobrança ${c.id}: cancelamento no gateway falhou: ${e?.message || e}`); }
      await this.prisma.whatsapp_charges.updateMany({ where: { id: c.id, status: 'PENDING' }, data: { status: 'CANCELED' } }).catch(() => undefined);
      await this.outbox.cancelPending(orgId, { dedupe_prefix: `charge:${c.id}:` }).catch(() => undefined);
    }
  }

  async removeCustomer(orgId: string, id: string) {
    const cur = await this.prisma.whatsapp_customers.findFirst({ where: { id, organization_id: orgId } });
    if (!cur) throw new NotFoundException('Cliente não encontrado.');
    const subs = await this.prisma.whatsapp_subscriptions.findMany({ where: { customer_id: id, organization_id: orgId }, select: { id: true } });
    await this.cancelOpenCharges(orgId, id, subs.map((s) => s.id)); // nada fica cobrável no gateway de um cliente apagado
    // Fase 5: as linhas de acesso somem em cascata — o motor tira do grupo quem estava dentro (best-effort, com a cópia)
    const ents = await this.prisma.whatsapp_entitlements.findMany({ where: { organization_id: orgId, customer_id: id, kind: 'group_member', status: 'active' } }).catch(() => [] as any[]);
    await this.prisma.whatsapp_customers.delete({ where: { id } }); // assinaturas em cascata (FK)
    if (ents.length) this.hooks.emit('customer_deleted', { orgId, customer_id: id, entitlements: ents });
    return { ok: true };
  }

  // ---------------------------------------------------------------- assinaturas
  /**
   * Edição MANUAL (PUT legado): só dados cadastrais. Transições passam pelo motor — `status` diferente do atual e troca
   * de produto são recusados (400) para não furar cupom/crédito/eventos/cobranças. Mudar o `due_day` sem `next_due_at`
   * explícito realinha o vencimento para a PRIMEIRA data com o dia novo ≥ o vencimento atual (nunca cobra de novo um período já pago).
   */
  private async subData(orgId: string, dto: any, cur: any) {
    const data: any = {};
    if (dto.status !== undefined && dto.status !== cur.status) throw new BadRequestException('Use as ações cancelar/pausar/retomar/reativar.');
    if (dto.product_id !== undefined && (dto.product_id || null) !== (cur.product_id || null)) throw new BadRequestException('Use trocar plano.');
    if (dto.product_name !== undefined) { const n = String(dto.product_name || '').trim().slice(0, 120); if (n) data.product_name = n; }
    if (dto.price_cents !== undefined) data.price_cents = Math.max(0, Math.round(Number(dto.price_cents) || 0));
    if (dto.billing !== undefined) data.billing = BILLINGS.includes(dto.billing) ? dto.billing : 'monthly';
    if (dto.due_day !== undefined) data.due_day = dto.due_day === null ? null : Math.min(28, Math.max(1, parseInt(String(dto.due_day), 10) || 1));
    if (dto.started_at !== undefined) { if (dto.started_at && !isDateStr(dto.started_at)) throw new BadRequestException('Início: YYYY-MM-DD.'); data.started_at = parseDate(dto.started_at); }
    if (dto.next_due_at !== undefined) { if (dto.next_due_at && !isDateStr(dto.next_due_at)) throw new BadRequestException('Vencimento: YYYY-MM-DD.'); data.next_due_at = parseDate(dto.next_due_at); }
    if (dto.notes !== undefined) data.notes = String(dto.notes || '').trim().slice(0, 500) || null;
    if (dto.external_id !== undefined) data.external_id = String(dto.external_id ?? '').trim().slice(0, 64) || null;
    if (dto.contract_number !== undefined) data.contract_number = String(dto.contract_number ?? '').trim().slice(0, 64) || null;
    if (dto.payment_method !== undefined || dto.payment_method_id !== undefined) {
      // cartão salvo só com `payment_method === 'card'` e só do próprio cliente (ativo) — senão 400 / null
      const pm = await this.subscriptions.resolvePaymentMethod(orgId, cur.customer_id, dto, cur.payment_method);
      if (dto.payment_method !== undefined) data.payment_method = pm.payment_method;
      if (dto.payment_method_id !== undefined || pm.payment_method !== 'card') data.payment_method_id = pm.payment_method_id;
    }
    if (dto.custom !== undefined) {
      // mescla só as chaves do cliente (sem reservadas, 40 chaves, 500 chars); as marcas do motor (`first_charge`, `paused_from`…) ficam como estão
      const curCustom: Record<string, unknown> = cur.custom && typeof cur.custom === 'object' ? (cur.custom as any) : {};
      const reserved = Object.fromEntries(Object.entries(curCustom).filter(([k]) => (RESERVED_CUSTOM_KEYS as readonly string[]).includes(k)));
      const merged0 = sanitizeCustom({ ...curCustom, ...(dto.custom && typeof dto.custom === 'object' ? dto.custom : {}) });
      const checked = await this.cf.apply(orgId, 'subscription', dto.custom && typeof dto.custom === 'object' ? dto.custom : {}, { mode: 'update', current: merged0 });
      data.custom = { ...(checked || merged0), ...reserved };
    }
    const merged = { ...cur, ...data };
    if (!merged.product_name) throw new BadRequestException('Escolha um produto ou dê um nome à assinatura.');
    const recurring = Boolean(BILLING_MONTHS[merged.billing]);
    if (recurring) {
      if (!merged.due_day) throw new BadRequestException('Informe o dia do vencimento (1 a 28).');
      if (dto.next_due_at === undefined) {
        const curNext = toDateStrMath(cur.next_due_at);
        if (!curNext) data.next_due_at = dateOnlyUTC(nextDueFromDate(brtDateStr(), merged.due_day));
        else if (dto.due_day !== undefined && cur.due_day !== merged.due_day) data.next_due_at = dateOnlyUTC(nextDueFromDate(curNext, merged.due_day)); // 1ª data com o dia novo ≥ vencimento atual
      }
    } else if (dto.billing !== undefined) { data.due_day = null; data.next_due_at = data.next_due_at ?? null; }
    return data;
  }

  /**
   * Cria pelo MOTOR (`subscriptions.createSubscription`: trial, pró-rata, cupom, eventos, 1ª cobrança).
   * Resposta = o cliente (compat com o painel) + `subscription` (shaped, com `first_charge`).
   * `next_due_at`/`status` explícitos (compat da API antiga): `next_due_at` vira edição manual; `status` vai pelo motor
   * (`canceled` → cancelamento imediato, `paused` → pausa de 30 dias; `overdue` é gravado direto — o runner é quem decide).
   */
  async addSubscription(orgId: string, customerId: string, dto: any, meta: { source: 'panel' | 'bot' | 'api' | 'import' | 'system'; user_id?: string | null; auto_charge?: boolean } = { source: 'panel' }) {
    await this.assertNotErased(orgId, customerId);
    if (dto?.product_id) {
      const p = await this.prisma.whatsapp_products.findFirst({ where: { id: String(dto.product_id), organization_id: orgId }, select: { kind: true } });
      if (p?.kind === 'service') throw new BadRequestException('Serviço é agendado (Agenda), não assinado. Escolha um plano.');
    }
    const sub = await this.subscriptions.createSubscription(orgId, customerId, { ...dto, billing: dto.billing ?? (dto.product_id ? undefined : 'monthly') }, meta);
    if (dto.next_due_at !== undefined) await this.updateSubscription(orgId, customerId, sub.id, { next_due_at: dto.next_due_at }, meta);
    if (dto.status === 'canceled') await this.subscriptions.cancel(orgId, sub.id, { policy: 'immediate', reason: null, source: meta.source, user_id: meta.user_id });
    else if (dto.status === 'paused') await this.subscriptions.pause(orgId, sub.id, { days: 30, source: meta.source, user_id: meta.user_id });
    else if (dto.status === 'overdue') await this.prisma.whatsapp_subscriptions.updateMany({ where: { id: sub.id, status: 'active' }, data: { status: 'overdue' } });
    const customer = await this.getCustomer(orgId, customerId);
    return { ...customer, subscription: { ...(customer.subscriptions.find((s: any) => s.id === sub.id) || sub), first_charge: sub.first_charge ?? null } };
  }

  async updateSubscription(orgId: string, customerId: string, id: string, dto: any, meta: Partial<SubMeta> = { source: 'panel' }) {
    const cur = await this.prisma.whatsapp_subscriptions.findFirst({ where: { id, customer_id: customerId, organization_id: orgId } });
    if (!cur) throw new NotFoundException('Assinatura não encontrada.');
    const data = await this.subData(orgId, dto, cur);
    const changed = Object.keys(data).filter((k) => JSON.stringify((cur as any)[k] ?? null) !== JSON.stringify(data[k] ?? null));
    if (!changed.length) return this.getCustomer(orgId, customerId);
    await this.prisma.whatsapp_subscriptions.update({ where: { id }, data });
    // auditoria: o que mudou à mão (datas como YYYY-MM-DD); preço à mão = `price_changed` com antes/depois
    const show = (v: any) => (v instanceof Date ? toDateStrMath(v) : v ?? null);
    await this.subscriptions.recordEvent(orgId, id, 'manual_edit', { fields: changed, from: Object.fromEntries(changed.map((k) => [k, show((cur as any)[k])])), to: Object.fromEntries(changed.map((k) => [k, show(data[k])])) }, meta);
    if (changed.includes('price_cents')) await this.subscriptions.recordEvent(orgId, id, 'price_changed', { from_cents: cur.price_cents, to_cents: data.price_cents, reason: 'manual' }, meta);
    return this.getCustomer(orgId, customerId);
  }

  async removeSubscription(orgId: string, customerId: string, id: string) {
    const cur = await this.prisma.whatsapp_subscriptions.findFirst({ where: { id, customer_id: customerId, organization_id: orgId } });
    if (!cur) throw new NotFoundException('Assinatura não encontrada.');
    await this.subscriptions.cancelPendingCharges(orgId, id).catch((e: any) => this.logger.warn(`cancelar cobranças da assinatura ${id}: ${e?.message || e}`)); // gateway + fila (best-effort)
    if (cur.coupon_id) await this.prisma.whatsapp_coupons.updateMany({ where: { id: cur.coupon_id, used: { gt: 0 } }, data: { used: { decrement: 1 } } }).catch(() => undefined); // devolve o uso do cupom
    // Fase 5: ANTES de apagar (a FK vira NULL), o acesso dado por esta assinatura é marcado para revogar — o worker tira do grupo/etiqueta
    await this.prisma.whatsapp_entitlements.updateMany({ where: { organization_id: orgId, subscription_id: id, desired: { not: 'revoked' } }, data: { desired: 'revoked', next_try_at: new Date() } }).catch((e: any) => this.logger.warn(`revogar acesso da assinatura ${id}: ${e?.message || e}`));
    await this.prisma.whatsapp_entitlements.updateMany({ where: { organization_id: orgId, subscription_id: id, status: 'failed' }, data: { status: 'pending', attempts: 0, error: null, next_try_at: new Date() } }).catch(() => undefined);
    this.hooks.emit('subscription_event', { orgId, subscription_id: id, kind: 'deleted', data: { customer_id: customerId, product_id: cur.product_id, product_name: cur.product_name } });
    await this.prisma.whatsapp_subscriptions.delete({ where: { id } });
    return this.getCustomer(orgId, customerId);
  }

  // ---------------------------------------------------------------- formato do motor do bot (Fase 2, contrato §1.3)
  /** Produtos ATIVOS da org no formato do motor do bot (ordem da lista do painel). */
  async botProducts(orgId: string): Promise<BotProduct[]> {
    // serviços (kind 'service', Fase 6) são da agenda — não entram nos menus de plano/assinatura do bot
    const rows = await this.prisma.whatsapp_products.findMany({ where: { organization_id: orgId, active: true, kind: { not: 'service' } }, orderBy: [{ position: 'asc' }, { name: 'asc' }] });
    return rows.map((p) => ({
      id: p.id, name: p.name, description: p.description || null, price_cents: p.price_cents, price_label: formatBRL(p.price_cents), billing: p.billing, billing_label: BILLING_LABEL[p.billing] || p.billing,
      trial_days: p.trial_days || 0, cancel_policy: p.cancel_policy === 'immediate' ? 'immediate' : 'end_of_cycle', active: true, kind: (p as any).kind || 'plan',
    }));
  }

  /** Assinatura (shaped do motor de assinaturas) → formato do bot. */
  botSubscription(s: any, today = brtDateStr()): BotSubscription {
    const next = s?.next_due_at ? String(s.next_due_at).slice(0, 10) : null;
    const late = s?.status === 'overdue' && next ? Math.max(0, daysBetween(next, today)) : 0;
    return {
      id: s.id, product_id: s.product_id || null, product_name: s.product_name || '', price_cents: Number(s.price_cents) || 0, price_label: s.price_label || formatBRL(s.price_cents),
      billing: s.billing || 'monthly', status: s.status, next_due_at: next, next_due_label: next ? fmtDateBRMath(next) : '', days_overdue: late, due_day: s.due_day ?? null,
      cancel_at: s.cancel_at ? String(s.cancel_at).slice(0, 10) : null, paused_until: s.paused_until ? String(s.paused_until).slice(0, 10) : null,
    };
  }

  /**
   * Cliente no formato do motor do bot (`BotCustomer`): assinaturas + cobranças em aberto com o valor da
   * 2ª via (multa + juros de hoje). `verified` = o número da conversa (`contactId`) está vinculado ao
   * cliente OU `opts.verified` (documento conferido nesta sessão do bot). 404 se não for da org.
   */
  async botCustomer(orgId: string, customerId: string, opts: { contactId?: string | null; verified?: boolean } = {}): Promise<BotCustomer> {
    const c = await this.getCustomer(orgId, customerId);
    const today = brtDateStr();
    const [rows, settingsRow] = await Promise.all([
      this.prisma.whatsapp_charges.findMany({ where: { organization_id: orgId, customer_id: c.id, status: 'PENDING' }, orderBy: [{ due_at: 'asc' }, { created_at: 'asc' }], take: 20 }),
      this.prisma.whatsapp_crm_settings.findUnique({ where: { organization_id: orgId }, select: { charge: true } }),
    ]);
    const cfg = normalizeChargeSettings(settingsRow?.charge);
    const open: BotOpenCharge[] = rows.map((r) => {
      const due = toDateStrMath(r.due_at);
      const p = penaltyBreakdown(r.base_amount_cents ?? r.amount_cents, due, today, r.purpose ? 0 : cfg.late_fee_percent, r.purpose ? 0 : cfg.interest_month_percent); // pedido/agendamento sem encargos (P7-3)
      return { id: r.id, amount_cents: p.amount_cents, amount_label: formatBRL(p.amount_cents), description: r.description || '', due_at: due, due_label: fmtDateBRMath(due), days_overdue: p.days_late, kind: r.kind, pix_code: r.pix_code || null, boleto_url: r.boleto_url || null, status: r.status };
    });
    const subs = (c.subscriptions || []).map((s: any) => this.botSubscription(s, today));
    const live = subs.filter((s) => s.status === 'active' || s.status === 'overdue');
    const status: BotCustomer['status'] = c.status !== 'active' ? 'inactive' : live.some((s) => s.status === 'overdue') || open.some((o) => o.days_overdue > 0) ? 'overdue' : live.length ? 'ok' : subs.some((s) => s.status === 'paused') ? 'paused' : 'none';
    const custom: Record<string, string> = {};
    for (const [k, v] of Object.entries((c.custom as Record<string, unknown>) || {})) custom[String(k).toLowerCase()] = String(v ?? '');
    const linked = opts.contactId ? (c.contacts || []).some((x: any) => x.id === opts.contactId) : false;
    return {
      id: c.id, name: c.name || '', first_name: String(c.name || '').trim().split(/\s+/)[0] || '', doc_masked: c.doc_masked || '', code: c.code || '', email: c.email || '',
      status, verified: Boolean(linked || opts.verified), custom, subscriptions: subs, open_charges: open,
    };
  }

  // ---------------------------------------------------------------- variáveis para mensagens
  /**
   * Variáveis `{{cliente.*}}` da conversa (vazias quando o contato não é cliente). Barato: 2–3 consultas.
   * `ref` = jid (quem já tem o jid: bot, broadcasts, agendamentos — `sessionId` opcional ajuda a resolver @lid)
   * OU uuid da conversa (rotas da API).
   */
  private static readonly EMPTY_VARS = { 'cliente.nome': '', 'cliente.primeiro_nome': '', 'cliente.produto': '', 'cliente.produtos': '', 'cliente.valor': '', 'cliente.vencimento': '', 'cliente.dia_vencimento': '', 'cliente.status': '', 'cliente.email': '', 'cliente.documento': '', 'cliente.codigo': '' };

  /** Variáveis `{{cliente.*}}`/`{{assinatura.*}}`/`{{produto.*}}` de um cliente já montado (shapeCustomer). */
  private buildCustomerVars(customer: any, cfm: any, prodCustom: any) {
    const live = customer.subscriptions.filter((s: any) => s.status === 'active' || s.status === 'overdue');
    const next = live.filter((s: any) => s.next_due_at).sort((a: any, b: any) => String(a.next_due_at).localeCompare(String(b.next_due_at)))[0] || live[0] || null;
    const vars: Record<string, string> = {
      'cliente.nome': customer.name, 'cliente.primeiro_nome': customer.name.split(/\s+/)[0] || '',
      'cliente.produto': next?.product_name || '', 'cliente.produtos': live.map((s: any) => s.product_name).join(', '),
      'cliente.valor': next ? next.price_label : '', 'cliente.vencimento': next?.next_due_label || '', 'cliente.dia_vencimento': next?.due_day ? String(next.due_day) : '',
      'cliente.status': customer.billing_status === 'overdue' ? 'em atraso' : customer.billing_status === 'ok' ? 'em dia' : customer.billing_status === 'paused' ? 'pausada' : customer.status === 'inactive' ? 'inativo' : 'sem assinatura',
      'cliente.email': customer.email || '', 'cliente.documento': customer.doc || '', 'cliente.codigo': customer.code || '',
    };
    // Fase 7: campos personalizados como variáveis + unidade + código externo
    Object.assign(vars, customVars('cliente', cfm.customer, customer.custom, true));
    vars['cliente.unidade'] = customer.unit?.name || '';
    vars['cliente.codigo_externo'] = customer.external_id || '';
    Object.assign(vars, customVars('assinatura', cfm.subscription, next?.custom || {}));
    Object.assign(vars, customVars('produto', cfm.product, prodCustom || {}));
    return { vars, nextProductId: next?.product_id || null };
  }

  async varsForChat(orgId: string, ref: string, sessionId?: string | null): Promise<Record<string, string>> {
    try {
      const { customer } = UUID_RE.test(String(ref || '')) && !String(ref).includes('@') ? await this.byChat(orgId, ref) : await this.byContactJid(orgId, sessionId || null, ref);
      if (!customer) return { ...WhatsAppCrmService.EMPTY_VARS };
      const cfm = await this.cf.map(orgId);
      const first = this.buildCustomerVars(customer, cfm, {});
      if (!first.nextProductId) return first.vars;
      const prod = await this.prisma.whatsapp_products.findUnique({ where: { id: first.nextProductId }, select: { custom: true } }).catch(() => null);
      return this.buildCustomerVars(customer, cfm, prod?.custom || {}).vars;
    } catch (e: any) {
      this.logger.debug(`vars ${ref}: ${e?.message || e}`);
      return { ...WhatsAppCrmService.EMPTY_VARS };
    }
  }

  /**
   * Mesmas variáveis do `varsForChat`, para VÁRIOS clientes de uma vez (rotina diária: lembretes em lote) — sem
   * procurar conversas em todos os números (o que pesa ~70 ms por cliente): uma consulta por tipo para o lote todo.
   */
  async varsForCustomers(orgId: string, rows: any[]): Promise<Map<string, Record<string, string>>> {
    const out = new Map<string, Record<string, string>>();
    if (!rows.length) return out;
    const ids = rows.map((r) => r.id);
    const unitIds = [...new Set(rows.map((r) => r.unit_id).filter(Boolean))] as string[];
    const [subs, units, cfm, contacts] = await Promise.all([
      this.prisma.whatsapp_subscriptions.findMany({ where: { organization_id: orgId, customer_id: { in: ids } }, orderBy: [{ status: 'asc' }, { created_at: 'asc' }] }),
      unitIds.length ? this.prisma.whatsapp_units.findMany({ where: { id: { in: unitIds }, organization_id: orgId }, select: { id: true, name: true } }) : Promise.resolve([] as Array<{ id: string; name: string }>),
      this.cf.map(orgId),
      this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, id: { in: rows.map((r) => r.contact_id) } } }),
    ]);
    const shaped = await this.subscriptions.shapeMany(orgId, subs);
    const byCustomer = new Map<string, any[]>();
    for (const [i, s] of subs.entries()) byCustomer.set(s.customer_id, [...(byCustomer.get(s.customer_id) || []), { ...s, __shaped: shaped[i] }]);
    const unitName = new Map(units.map((u) => [u.id, u.name] as [string, string]));
    const byContact = new Map(contacts.map((c) => [c.id, c]));
    const built = rows.map((r) => {
      const customer = this.shapeCustomer({ ...r, __unit_name: r.unit_id ? unitName.get(r.unit_id) || null : null }, byContact.get(r.contact_id), byCustomer.get(r.id) || [], cfm.customer);
      return { r, customer, first: this.buildCustomerVars(customer, cfm, {}) };
    });
    const prodIds = [...new Set(built.map((b) => b.first.nextProductId).filter(Boolean))] as string[];
    const prods = prodIds.length ? await this.prisma.whatsapp_products.findMany({ where: { id: { in: prodIds } }, select: { id: true, custom: true } }) : [];
    const prodCustom = new Map(prods.map((p) => [p.id, p.custom] as [string, any]));
    for (const b of built) out.set(b.r.id, b.first.nextProductId ? this.buildCustomerVars(b.customer, cfm, prodCustom.get(b.first.nextProductId) || {}).vars : b.first.vars);
    return out;
  }
}
