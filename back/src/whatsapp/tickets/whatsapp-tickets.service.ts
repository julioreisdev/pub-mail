import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from '../../platform-billing/access.service';
import { WhatsAppPresenter } from '../whatsapp-presenter.service';
import { InboundEvent, WhatsAppHooks } from '../whatsapp-hooks.service';
import { WhatsAppOutboxService } from '../whatsapp-outbox.service';
import { WhatsAppIdentityService } from '../whatsapp-identity.service';
import { WhatsAppSessionsService } from '../whatsapp-sessions.service';
import { WhatsAppMediaService } from '../whatsapp-media.service';
import { WhatsAppCustomFieldsService } from '../whatsapp-custom-fields.service';
import { firstName } from '../wa-crm-vars.util';
import { isGroupJid } from '../wa-jid.util';
import { fillScheduleText } from '../scheduling/wa-schedule.util';
import { customVars } from '../wa-custom-fields.util';
import {
  ACTIVE_TICKET, PRIORITY_LABEL, STATUS_LABEL, STATUS_LABEL_STAFF, TicketPriority, TicketSettings, TicketStatus,
  categoryKey, computeDue, counterName, defaultSubject, fmtDueAbsolute, fmtDueRelative, formatProtocol, isCourtesy, isPriority,
  isTicketStatus, normalizeProtocolInput, normalizeTicketSettings, slaHoursFor, slaState,
} from './wa-ticket.util';

// ============================================================================
// Chamados / protocolos (Fase 6B — contrato `docs/whatsapp-assinaturas-contrato.md` §10).
//
//  - Protocolo SEM FURO: o número sai do contador `whatsapp_counters` NA MESMA transação da criação
//    (`INSERT … ON DUPLICATE KEY UPDATE value = LAST_INSERT_ID(value+1)` + `SELECT LAST_INSERT_ID()`, mesma
//    conexão). Falhou a criação = rollback = o número volta. A linha do contador serializa as criações da org.
//  - Descrição e corpo dos eventos são CIFRADOS em repouso (extensão do Prisma). Eventos são criados SEMPRE
//    direto em `whatsapp_ticket_events` (nunca aninhados no ticket — a extensão só cifra o modelo da operação).
//  - Todo texto ao cliente sai pela FILA (`whatsapp_outbox`, dedupe `ticket:<id>:<tipo>[:<evento>]`).
//    Chamado aberto pelo BOT não recebe o texto `created` daqui (o bot mostra o dele).
//  - Mensagem solta do cliente (hook `message`, NÃO consome): chamado "aguardando cliente" volta a "aberto";
//    "resolvido" dentro de `reopen_days` reabre (exceto agradecimento curto: "ok", "obrigado"…).
//  - Runner: aviso de prazo, prazo estourado (uma vez cada), encerramento automático de resolvidos.
// ============================================================================

const UUID_RE = /^[0-9a-f-]{36}$/i;
const TX_OPTS = { timeout: 15_000, maxWait: 15_000 };
const isDeadlock = (e: any) => e?.code === 'P2034' || /deadlock|lock wait timeout|1213|1205/i.test(String(e?.message || e?.meta?.message || ''));
const MAX_MEDIA = 5;
const RUN_BATCH = 200;
const RUN_MAX_PER_ORG = 2000;
const MAX_DESC = 5000;
const MAX_BODY = 4000;
export type TicketSource = 'bot' | 'panel' | 'api';
export type TicketBy = { by: 'staff' | 'customer' | 'system' | 'bot' | 'api'; user_id?: string | null };
export type CreateTicketInput = {
  category: string; subject?: string | null; description: string; priority?: string | null;
  customer_id?: string | null; contact_id?: string | null; session_id?: string | null; chat_id?: string | null;
  media_ids?: string[] | null; custom?: Record<string, unknown> | null; assigned_user_id?: string | null;
  source: TicketSource; user_id?: string | null; notify?: boolean;
};
export type PatchTicketInput = { status?: string; priority?: string; category?: string; subject?: string; assigned_user_id?: string | null; notify?: boolean; custom?: Record<string, unknown> };

/** `YYYY-MM-DD` (dia em BRT; `to` = fim do dia) ou ISO. Inválida → 400 (antes virava 500 no banco). */
function parseDate(v: unknown, endOfDay: boolean): Date {
  const s = String(v ?? '').trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T${endOfDay ? '24:00:00' : '00:00:00'}-03:00`) : new Date(s);
  if (!s || Number.isNaN(+d) || d.getUTCFullYear() < 2000 || d.getUTCFullYear() > 2100) throw new BadRequestException('Data inválida.');
  return d;
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, max) : '');

@Injectable()
export class WhatsAppTicketsService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppTicketsService.name);
  private readonly settingsCache = new Map<string, { at: number; s: TicketSettings }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly presenter: WhatsAppPresenter,
    private readonly hooks: WhatsAppHooks,
    private readonly outbox: WhatsAppOutboxService,
    private readonly identity: WhatsAppIdentityService,
    private readonly sessions: WhatsAppSessionsService,
    private readonly media: WhatsAppMediaService,
    private readonly access: AccessService,
    private readonly cf: WhatsAppCustomFieldsService,
  ) {}

  onModuleInit() {
    this.hooks.on('message', (e: InboundEvent) => this.onInbound(e));
  }

  // ================================================================ configurações
  async settings(orgId: string): Promise<TicketSettings> {
    const c = this.settingsCache.get(orgId);
    if (c && Date.now() - c.at < 60_000) return c.s;
    const row = await this.prisma.whatsapp_crm_settings.findUnique({ where: { organization_id: orgId }, select: { tickets: true } }).catch(() => null);
    const s = normalizeTicketSettings(row?.tickets);
    this.settingsCache.set(orgId, { at: Date.now(), s });
    return s;
  }

  /** PUT parcial: chaves ausentes mantêm; textos vazios voltam ao padrão; responsável de categoria precisa ser da org. */
  async updateSettings(orgId: string, dto: any) {
    this.settingsCache.delete(orgId);
    const cur = await this.settings(orgId);
    const c: any = Object.fromEntries(Object.entries(dto || {}).filter(([, v]) => v !== undefined));
    const merged: any = {
      ...cur, ...c,
      texts: { ...cur.texts, ...(c.texts && typeof c.texts === 'object' ? c.texts : {}) },
      notify_customer: { ...cur.notify_customer, ...(c.notify_customer && typeof c.notify_customer === 'object' ? c.notify_customer : {}) },
      sla_hours: { ...cur.sla_hours, ...(c.sla_hours && typeof c.sla_hours === 'object' ? c.sla_hours : {}) },
      first_response_hours: { ...cur.first_response_hours, ...(c.first_response_hours && typeof c.first_response_hours === 'object' ? c.first_response_hours : {}) },
    };
    const next = normalizeTicketSettings(merged);
    if (Array.isArray(c.categories) && !next.categories.length) throw new BadRequestException('Deixe ao menos uma categoria.');
    const ids = [...new Set(next.categories.map((x) => x.assignee_id).filter(Boolean))] as string[];
    if (ids.length) {
      const ok = new Set((await this.prisma.users.findMany({ where: { id: { in: ids }, organization_id: orgId }, select: { id: true } })).map((u) => u.id));
      for (const cat of next.categories) if (cat.assignee_id && !ok.has(cat.assignee_id)) cat.assignee_id = null;
    }
    // prefixo/reinício mudados: o próximo protocolo pode colidir com um existente — o contador continua o mesmo;
    // a colisão é impossível com o mesmo prefixo + contador, e com outro prefixo os protocolos são distintos.
    await this.prisma.whatsapp_crm_settings.upsert({ where: { organization_id: orgId }, create: { organization_id: orgId, tickets: next as any }, update: { tickets: next as any } });
    this.settingsCache.delete(orgId);
    return this.settings(orgId);
  }

  // ================================================================ quem / onde
  private async who(orgId: string, input: { customer_id?: string | null; contact_id?: string | null; session_id?: string | null; chat_id?: string | null }) {
    let customer: any = null, contactId: string | null = null, key: { session_id: string; chat_id: string } | null = null;
    if (input.customer_id) {
      customer = await this.prisma.whatsapp_customers.findFirst({ where: { id: String(input.customer_id), organization_id: orgId } });
      if (!customer) throw new NotFoundException('Cliente não encontrado.');
      contactId = customer.contact_id;
    }
    if (input.contact_id) {
      const c = await this.prisma.whatsapp_contacts.findFirst({ where: { id: String(input.contact_id), organization_id: orgId }, select: { id: true } });
      if (!c) throw new NotFoundException('Contato não encontrado.');
      contactId = c.id;
    }
    if (input.chat_id) {
      const ref = String(input.chat_id);
      if (UUID_RE.test(ref) && !ref.includes('@')) {
        const chat = await this.prisma.whatsapp_chats.findFirst({ where: { id: ref, organization_id: orgId } });
        if (!chat) throw new NotFoundException('Conversa não encontrada.');
        key = { session_id: chat.session_id, chat_id: chat.chat_id };
      } else {
        if (!input.session_id) throw new BadRequestException('Informe o número (session_id) junto com o jid da conversa.');
        const s = await this.sessions.rowById(orgId, String(input.session_id));
        if (!s) throw new NotFoundException('Número não encontrado.');
        key = { session_id: s.id, chat_id: ref };
      }
      if (isGroupJid(key.chat_id)) throw new BadRequestException('Chamado é só para conversas individuais.');
      if (!contactId) contactId = (await this.identity.contactOfJid(orgId, key.session_id, key.chat_id))?.id || null;
    }
    if (!customer && contactId) customer = (await this.identity.customersOfContact(orgId, contactId))[0]?.customer || null;
    if (!key && contactId) key = await this.outbox.chatKeyForContact(orgId, contactId).catch(() => null);
    return { customer, contactId, key };
  }

  /** Por qual (número, jid) falar com o cliente do chamado. */
  private async keyFor(orgId: string, t: { session_id?: string | null; chat_id?: string | null; contact_id?: string | null; customer_id?: string | null }) {
    if (t.session_id && t.chat_id && !isGroupJid(t.chat_id)) {
      const s = await this.sessions.rowById(orgId, t.session_id);
      if (s) return { session_id: s.id, chat_id: t.chat_id };
    }
    let contactId = t.contact_id || null;
    if (!contactId && t.customer_id) contactId = (await this.prisma.whatsapp_customers.findUnique({ where: { id: t.customer_id }, select: { contact_id: true } }))?.contact_id || null;
    return contactId ? this.outbox.chatKeyForContact(orgId, contactId) : null;
  }

  private async assertUser(orgId: string, userId: string | null | undefined) {
    if (!userId) return null;
    const u = await this.prisma.users.findFirst({ where: { id: String(userId), organization_id: orgId }, select: { id: true, active: true } });
    if (!u) throw new BadRequestException('Responsável não encontrado nesta organização.');
    if (u.active === false) throw new BadRequestException('Esse usuário está desativado.');
    return u.id;
  }

  /** Mídias do cliente/da equipe: precisam ser da org; ficam guardadas (sem vencimento) enquanto o chamado existir. */
  private async claimMedia(orgId: string, ids: unknown): Promise<string[]> {
    const list = [...new Set((Array.isArray(ids) ? ids : []).map(String).filter((x) => UUID_RE.test(x)))].slice(0, MAX_MEDIA);
    if (!list.length) return [];
    const rows = await this.prisma.whatsapp_media.findMany({ where: { id: { in: list }, organization_id: orgId }, select: { id: true } });
    const ok = rows.map((r) => r.id);
    if (ok.length) await this.prisma.whatsapp_media.updateMany({ where: { id: { in: ok } }, data: { expires_at: null } }).catch(() => undefined);
    return list.filter((x) => ok.includes(x));
  }

  // ================================================================ formato
  private async shapeMany(orgId: string, rows: any[], opts: { full?: boolean } = {}) {
    if (!rows.length) return [] as any[];
    const s = await this.settings(orgId);
    const ids = (k: string) => [...new Set(rows.map((r) => r[k]).filter(Boolean))] as string[];
    const mediaIds = [...new Set(rows.flatMap((r) => (Array.isArray(r.media_ids) ? r.media_ids : [])).map(String))];
    const [custs, users, smap, medias] = await Promise.all([
      ids('customer_id').length ? this.prisma.whatsapp_customers.findMany({ where: { id: { in: ids('customer_id') } }, select: { id: true, name: true, contact_id: true, code: true } }) : Promise.resolve([] as any[]),
      ids('assigned_user_id').length ? this.prisma.users.findMany({ where: { id: { in: ids('assigned_user_id') }, organization_id: orgId }, select: { id: true, name: true } }) : Promise.resolve([] as any[]),
      this.presenter.sessionMap(orgId),
      opts.full && mediaIds.length ? this.prisma.whatsapp_media.findMany({ where: { id: { in: mediaIds }, organization_id: orgId } }) : Promise.resolve([] as any[]),
    ]);
    const contactIds = [...new Set([...ids('contact_id'), ...custs.map((c: any) => c.contact_id)].filter(Boolean))] as string[];
    const contacts = contactIds.length ? await this.prisma.whatsapp_contacts.findMany({ where: { id: { in: contactIds } }, select: { id: true, name: true, push_name: true, phone: true } }) : [];
    const pairs = rows.filter((r) => r.session_id && r.chat_id).map((r) => ({ session_id: r.session_id, chat_id: r.chat_id }));
    const chats = pairs.length ? await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, OR: pairs }, select: { id: true, session_id: true, chat_id: true } }) : [];
    const cm = new Map(custs.map((c: any) => [c.id, c] as [string, any]));
    const um = new Map(users.map((u: any) => [u.id, u] as [string, any]));
    const ctm = new Map(contacts.map((c) => [c.id, c] as [string, any]));
    const chm = new Map(chats.map((c) => [`${c.session_id}|${c.chat_id}`, c.id] as [string, string]));
    const mm = new Map(medias.map((m: any) => [m.id, m] as [string, any]));
    const catLabel = (k: string) => s.categories.find((c) => c.key === k)?.label || k;
    return rows.map((t) => {
      const cust = t.customer_id ? cm.get(t.customer_id) : null;
      const contact = (t.contact_id && ctm.get(t.contact_id)) || (cust ? ctm.get(cust.contact_id) : null) || null;
      const desc = typeof t.description === 'string' ? t.description : '';
      const st = t.status as TicketStatus;
      return {
        id: t.id, number: t.number, protocol: t.protocol, status: st, status_label: STATUS_LABEL_STAFF[st] || st, status_label_customer: STATUS_LABEL[st] || st,
        priority: t.priority, priority_label: PRIORITY_LABEL[t.priority as TicketPriority] || t.priority,
        category: t.category, category_label: catLabel(t.category), subject: t.subject,
        ...(opts.full ? { description: desc } : { excerpt: desc.length > 180 ? `${desc.slice(0, 177)}…` : desc }),
        customer: cust ? { id: cust.id, name: cust.name, code: cust.code || null, phone: contact?.phone || null } : null,
        contact: contact ? { id: contact.id, name: contact.name || contact.push_name || null, phone: contact.phone || null } : null,
        contact_id: t.contact_id || null, session_id: t.session_id || null, session: (t.session_id && smap.get(t.session_id)) || null,
        chat_id: (t.session_id && t.chat_id && chm.get(`${t.session_id}|${t.chat_id}`)) || null, jid: t.chat_id || null,
        assigned_user_id: t.assigned_user_id || null, assigned: t.assigned_user_id ? { id: t.assigned_user_id, name: um.get(t.assigned_user_id)?.name || null } : null,
        sla_due_at: t.sla_due_at || null, sla_state: slaState(t, s.warn_before_minutes), sla_label: t.sla_due_at ? fmtDueAbsolute(t.sla_due_at) : '', sla_relative: t.sla_due_at ? fmtDueRelative(t.sla_due_at) : '',
        first_response_due_at: t.first_response_due_at || null, first_response_at: t.first_response_at || null,
        resolved_at: t.resolved_at || null, closed_at: t.closed_at || null, reopen_count: t.reopen_count || 0,
        media_ids: Array.isArray(t.media_ids) ? t.media_ids : [],
        ...(opts.full ? { media: (Array.isArray(t.media_ids) ? t.media_ids : []).map((id: string) => mm.get(id)).filter(Boolean).map((m: any) => this.media.toPublic(m)) } : {}),
        source: t.source, custom: t.custom && typeof t.custom === 'object' ? t.custom : {}, created_by: t.created_by || null,
        last_event_at: t.last_event_at || t.created_at, created_at: t.created_at, updated_at: t.updated_at,
      };
    });
  }

  private async shapeOne(orgId: string, t: any, full = true) { return (await this.shapeMany(orgId, [t], { full }))[0]; }

  private async row(orgId: string, id: string) {
    const t = await this.prisma.whatsapp_tickets.findFirst({ where: { id: String(id || ''), organization_id: orgId } });
    if (!t) throw new NotFoundException('Chamado não encontrado.');
    return t;
  }

  async get(orgId: string, id: string) { return this.shapeOne(orgId, await this.row(orgId, id)); }
  async sessionOf(orgId: string, id: string) { return (await this.row(orgId, id)).session_id || null; }

  /** O chamado é deste contato (ou de um destes clientes)? — o bot confere antes de mexer. */
  async belongsTo(orgId: string, id: string, who: { contact_id?: string | null; customer_ids?: string[] | null }) {
    const t = await this.prisma.whatsapp_tickets.findFirst({ where: { id: String(id || ''), organization_id: orgId }, select: { contact_id: true, customer_id: true } });
    if (!t) return false;
    return Boolean((who.contact_id && t.contact_id === who.contact_id) || (t.customer_id && (who.customer_ids || []).includes(t.customer_id)));
  }

  // ================================================================ eventos / textos
  private emitTicket(orgId: string, action: string, ticket: any, extra: Record<string, unknown> = {}) {
    // chamado de um número só vai à sala desse número (quem não vê o número não recebe a descrição)
    if (ticket?.session_id) this.presenter.emitSession(orgId, ticket.session_id, 'wa:ticket', { action, ticket, ...extra });
    else this.presenter.emit(orgId, 'wa:ticket', { action, ticket, ...extra });
    this.hooks.emit(`ticket_${action}`, { orgId, ticket, ...extra });
  }

  private async addEvent(orgId: string, ticketId: string, e: { kind: string; by: TicketBy; from?: string | null; to?: string | null; body?: string | null; visibility?: 'internal' | 'public'; media_id?: string | null }, db: any = this.prisma) {
    const ev = await db.whatsapp_ticket_events.create({
      data: {
        organization_id: orgId, ticket_id: ticketId, kind: e.kind, by: e.by.by, user_id: e.by.user_id || null,
        from_value: e.from ? String(e.from).slice(0, 64) : null, to_value: e.to ? String(e.to).slice(0, 64) : null,
        body: e.body ? String(e.body).slice(0, MAX_BODY) : null, visibility: e.visibility || 'internal', media_id: e.media_id || null,
      },
    });
    await db.whatsapp_tickets.updateMany({ where: { id: ticketId }, data: { last_event_at: ev.created_at } });
    return ev;
  }

  private async varsFor(orgId: string, t: any, extra: Record<string, string> = {}) {
    const shaped = t.protocol && t.category_label ? t : await this.shapeOne(orgId, t);
    const name = shaped.customer?.name || shaped.contact?.name || '';
    return {
      'cliente.nome': name, 'cliente.primeiro_nome': firstName(name),
      'chamado.protocolo': shaped.protocol, 'chamado.assunto': shaped.subject, 'chamado.categoria': shaped.category_label,
      'chamado.status': shaped.status_label_customer, 'chamado.prioridade': shaped.priority_label,
      'chamado.prazo': shaped.sla_label || '', 'chamado.descricao': (shaped.description || shaped.excerpt || '').slice(0, 500), 'chamado.comentario': '',
      ...customVars('chamado', await this.cf.defs(orgId, 'ticket'), shaped.custom),
      ...extra,
    } as Record<string, string>;
  }

  /** Texto ao cliente pela FILA. Nunca lança. */
  private async notifyCustomer(orgId: string, t: any, textKey: keyof TicketSettings['texts'], tipo: string, opts: { extraVars?: Record<string, string>; dedupe?: string; media_id?: string | null } = {}) {
    try {
      const s = await this.settings(orgId);
      const text = fillScheduleText(s.texts[textKey], await this.varsFor(orgId, t, opts.extraVars || {}));
      if (!text && !opts.media_id) return null;
      const key = await this.keyFor(orgId, t);
      if (!key) { this.logger.debug(`chamado ${t.id}: sem número para avisar (${tipo})`); return null; }
      const messages: any[] = [];
      if (text) messages.push({ kind: 'text', text });
      if (opts.media_id) {
        const m = await this.prisma.whatsapp_media.findFirst({ where: { id: opts.media_id, organization_id: orgId }, select: { kind: true } });
        if (m) messages.push({ kind: ['image', 'video', 'audio', 'voice', 'document', 'sticker'].includes(m.kind) ? (m.kind === 'sticker' ? 'image' : m.kind) : 'document', media_id: opts.media_id });
      }
      return await this.outbox.enqueue(orgId, { ...key, kind: `ticket_${tipo}`.slice(0, 32), payload: { messages, mark: { ticket: t.id } }, dedupe_key: opts.dedupe || `ticket:${t.id}:${tipo}` });
    } catch (e: any) { this.logger.warn(`chamado ${t?.id}: aviso ${tipo}: ${e?.message || e}`); return null; }
  }

  // ================================================================ criação (protocolo sem furo)
  private async nextNumber(tx: any, orgId: string, name: string): Promise<number> {
    await tx.$executeRaw`INSERT INTO whatsapp_counters (organization_id, name, value) VALUES (${orgId}, ${name}, LAST_INSERT_ID(1)) ON DUPLICATE KEY UPDATE value = LAST_INSERT_ID(value + 1)`;
    const r: { n: bigint | number }[] = await tx.$queryRaw`SELECT LAST_INSERT_ID() AS n`;
    const n = Number(r?.[0]?.n);
    if (!(n > 0)) throw new Error('contador de protocolo não devolveu número');
    return n;
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    for (let i = 0; ; i++) {
      try { return await fn(); } catch (e: any) {
        if (i < 3 && isDeadlock(e)) { await new Promise((r) => setTimeout(r, 60 + Math.random() * 240)); continue; }
        throw e;
      }
    }
  }

  async create(orgId: string, input: CreateTicketInput) {
    const s = await this.settings(orgId);
    const cat = s.categories.find((c) => c.key === categoryKey(input.category));
    if (!cat || !cat.active) throw new BadRequestException({ statusCode: 400, code: 'CATEGORY_INVALID', message: 'Categoria inexistente ou desativada.' });
    const description = clean(input.description, MAX_DESC);
    if (description.length < 3) throw new BadRequestException('Descreva o chamado (pelo menos 3 caracteres).');
    const priority: TicketPriority = isPriority(input.priority) ? input.priority : cat.default_priority;
    const subject = clean(input.subject, 160) || defaultSubject(description, cat.label);
    const w = await this.who(orgId, input);
    const media_ids = await this.claimMedia(orgId, input.media_ids);
    const assigned = input.assigned_user_id !== undefined && input.assigned_user_id !== null ? await this.assertUser(orgId, input.assigned_user_id) : cat.assignee_id ? await this.assertUser(orgId, cat.assignee_id).catch(() => null) : null;
    const by: TicketBy = { by: input.source === 'bot' ? 'bot' : input.source === 'api' ? 'api' : 'staff', user_id: input.user_id || null };
    // campos personalizados de chamado (Fase 7): o bot pede os marcados "pedir no bot"; obrigatórios valem para painel/API/bot
    const custom = (await this.cf.apply(orgId, 'ticket', input.custom, { mode: 'create' })) || {};

    const created = await this.withRetry(() => this.prisma.$transaction(async (tx: any) => {
      const now = new Date();
      const number = await this.nextNumber(tx, orgId, counterName(s, now));
      const due = computeDue(s, cat.key, priority, now);
      const t = await tx.whatsapp_tickets.create({
        data: {
          organization_id: orgId, number, protocol: formatProtocol(s, number, now),
          session_id: w.key?.session_id || null, chat_id: w.key?.chat_id || null, contact_id: w.contactId || null, customer_id: w.customer?.id || null,
          category: cat.key, subject, description, priority, status: 'open', assigned_user_id: assigned,
          first_response_due_at: due.first_response_due_at, sla_due_at: due.sla_due_at, media_ids: media_ids as any,
          source: input.source, custom: custom as any, created_by: input.user_id || null, last_event_at: now,
        },
      });
      await this.addEvent(orgId, t.id, { kind: 'created', by, to: 'open' }, tx);
      if (assigned) await this.addEvent(orgId, t.id, { kind: 'assigned', by, to: assigned }, tx);
      return t;
    }, TX_OPTS));

    const shaped = await this.shapeOne(orgId, created);
    this.logger.log(`chamado ${shaped.protocol} (${input.source}) ${shaped.category_label} · ${shaped.priority}`);
    this.emitTicket(orgId, 'created', shaped, { by: by.by, user_id: by.user_id || null });
    if (assigned) this.emitTicket(orgId, 'assigned', shaped, { by: by.by, user_id: by.user_id || null, from: null });
    if (input.source !== 'bot' && input.notify !== false && s.notify_customer.created) await this.notifyCustomer(orgId, shaped, 'created', 'created');
    return shaped;
  }

  // ================================================================ lista / contagens / eventos
  private scope(allowed: Set<string> | null) {
    return allowed === null ? null : { OR: [{ session_id: null }, ...(allowed.size ? [{ session_id: { in: [...allowed] } }] : [])] };
  }

  async list(orgId: string, q: any = {}, allowed: Set<string> | null = null, userId: string | null = null) {
    const s = await this.settings(orgId);
    const page = Math.max(1, parseInt(String(q.page || 1), 10) || 1);
    const size = Math.min(200, Math.max(10, parseInt(String(q.page_size || 50), 10) || 50));
    const where: any = { organization_id: orgId };
    const and: any[] = [];
    const now = new Date();
    if (q.status) {
      const raw = String(q.status);
      const st = raw === 'active' ? [...ACTIVE_TICKET] : raw.split(',').map((x) => x.trim()).filter(isTicketStatus);
      if (st.length) where.status = { in: st };
    }
    if (q.category) where.category = { in: String(q.category).split(',').map(categoryKey).filter(Boolean) };
    if (q.priority) where.priority = { in: String(q.priority).split(',').filter(isPriority) };
    if (q.assigned === 'me') where.assigned_user_id = userId || '__none__';
    else if (q.assigned === 'none') where.assigned_user_id = null;
    else if (q.assigned && UUID_RE.test(String(q.assigned))) where.assigned_user_id = String(q.assigned);
    if (q.sla === 'overdue') and.push({ status: { in: [...ACTIVE_TICKET] } }, { sla_due_at: { lt: now } });
    else if (q.sla === 'due_soon') and.push({ status: { in: [...ACTIVE_TICKET] } }, { sla_due_at: { gte: now, lte: new Date(+now + s.warn_before_minutes * 60_000) } });
    if (q.customer_id) where.customer_id = String(q.customer_id);
    if (q.contact_id) where.contact_id = String(q.contact_id);
    if (q.source) where.source = String(q.source);
    if (q.from) where.created_at = { ...(where.created_at || {}), gte: parseDate(q.from, false) };
    if (q.to) where.created_at = { ...(where.created_at || {}), lt: parseDate(q.to, true) };
    if (q.session_id) {
      if (allowed !== null && !allowed.has(String(q.session_id))) return { items: [], total: 0, page, page_size: size, pages: 1 };
      where.session_id = String(q.session_id);
    } else {
      const sc = this.scope(allowed);
      if (sc) and.push(sc);
    }
    const term = String(q.q || '').trim().slice(0, 80);
    if (term) {
      const prot = normalizeProtocolInput(term);
      const digits = term.replace(/\D/g, '');
      const [custs, conts] = await Promise.all([
        this.prisma.whatsapp_customers.findMany({ where: { organization_id: orgId, OR: [{ name: { contains: term } }, { code: term }] }, select: { id: true }, take: 200 }),
        this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, OR: [{ name: { contains: term } }, { push_name: { contains: term } }, ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : [])] }, select: { id: true }, take: 200 }),
      ]);
      and.push({
        OR: [
          { subject: { contains: term } },
          ...(prot.length >= 3 ? [{ protocol: { contains: prot } }] : []),
          ...(custs.length ? [{ customer_id: { in: custs.map((c) => c.id) } }] : []),
          ...(conts.length ? [{ contact_id: { in: conts.map((c) => c.id) } }] : []),
        ],
      });
    }
    if (and.length) where.AND = and;
    const order = String(q.order || 'sla');
    const orderBy: any = order === 'recent' ? [{ last_event_at: 'desc' }, { created_at: 'desc' }] : order === 'oldest' ? [{ created_at: 'asc' }] : order === 'newest' ? [{ created_at: 'desc' }] : [{ sla_due_at: 'asc' }, { created_at: 'asc' }];
    const [total, rows] = await Promise.all([this.prisma.whatsapp_tickets.count({ where }), this.prisma.whatsapp_tickets.findMany({ where, orderBy, skip: (page - 1) * size, take: size })]);
    return { items: await this.shapeMany(orgId, rows), total, page, page_size: size, pages: Math.max(1, Math.ceil(total / size)) };
  }

  async counts(orgId: string, allowed: Set<string> | null = null, userId: string | null = null) {
    const s = await this.settings(orgId);
    const sc = this.scope(allowed);
    const base: any = { organization_id: orgId, ...(sc ? { AND: [sc] } : {}) };
    const now = new Date();
    const active = { ...base, status: { in: [...ACTIVE_TICKET] } };
    const [byStatus, overdue, dueSoon, mine, unassigned] = await Promise.all([
      this.prisma.whatsapp_tickets.groupBy({ by: ['status'], where: base, _count: { _all: true } }),
      this.prisma.whatsapp_tickets.count({ where: { ...active, sla_due_at: { lt: now } } }),
      this.prisma.whatsapp_tickets.count({ where: { ...active, sla_due_at: { gte: now, lte: new Date(+now + s.warn_before_minutes * 60_000) } } }),
      userId ? this.prisma.whatsapp_tickets.count({ where: { ...active, assigned_user_id: userId } }) : Promise.resolve(0),
      this.prisma.whatsapp_tickets.count({ where: { ...active, assigned_user_id: null } }),
    ]);
    const by: Record<string, number> = { open: 0, pending: 0, resolved: 0, closed: 0 };
    for (const g of byStatus) by[g.status] = g._count._all;
    return { ...by, active: by.open + by.pending, total: Object.values(by).reduce((a, b) => a + b, 0), overdue, due_soon: dueSoon, mine, unassigned };
  }

  async events(orgId: string, id: string) {
    await this.row(orgId, id);
    const rows = await this.prisma.whatsapp_ticket_events.findMany({ where: { ticket_id: String(id), organization_id: orgId }, orderBy: { created_at: 'asc' }, take: 500 });
    const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
    const users = userIds.length ? await this.prisma.users.findMany({ where: { id: { in: userIds }, organization_id: orgId }, select: { id: true, name: true } }) : [];
    const um = new Map(users.map((u) => [u.id, u.name] as [string, string]));
    const mediaIds = [...new Set(rows.map((r) => r.media_id).filter(Boolean))] as string[];
    const medias = mediaIds.length ? await this.prisma.whatsapp_media.findMany({ where: { id: { in: mediaIds }, organization_id: orgId } }) : [];
    const mm = new Map(medias.map((m) => [m.id, this.media.toPublic(m)] as [string, any]));
    // ids de responsável viram nomes no "de → para" das atribuições
    const assignIds = [...new Set(rows.filter((r) => r.kind === 'assigned').flatMap((r) => [r.from_value, r.to_value]).filter((x): x is string => Boolean(x && UUID_RE.test(x))))];
    const aus = assignIds.length ? await this.prisma.users.findMany({ where: { id: { in: assignIds }, organization_id: orgId }, select: { id: true, name: true } }) : [];
    const am = new Map(aus.map((u) => [u.id, u.name] as [string, string]));
    return rows.map((r) => ({
      id: r.id, kind: r.kind, by: r.by, user: r.user_id ? { id: r.user_id, name: um.get(r.user_id) || null } : null,
      from: r.from_value, to: r.to_value,
      from_label: r.kind === 'assigned' ? (r.from_value ? am.get(r.from_value) || '—' : null) : r.from_value,
      to_label: r.kind === 'assigned' ? (r.to_value ? am.get(r.to_value) || '—' : 'ninguém') : r.to_value,
      body: r.body || null, visibility: r.visibility, media: r.media_id ? mm.get(r.media_id) || null : null, created_at: r.created_at,
    }));
  }

  // ================================================================ alterações
  async update(orgId: string, id: string, patch: PatchTicketInput, by: TicketBy) {
    const t = await this.row(orgId, id);
    const s = await this.settings(orgId);
    const data: any = {};
    const evs: { kind: string; from?: string | null; to?: string | null }[] = [];
    let newStatus: TicketStatus | null = null;
    let reopened = false;
    let assignedTo: string | null | undefined;

    if (patch.subject !== undefined) {
      const sub = clean(patch.subject, 160);
      if (sub && sub !== t.subject) { data.subject = sub; evs.push({ kind: 'subject', from: t.subject.slice(0, 64), to: sub.slice(0, 64) }); }
    }
    let category = t.category, priority = t.priority as TicketPriority, recompute = false;
    if (patch.category !== undefined) {
      const k = categoryKey(patch.category);
      const cat = s.categories.find((c) => c.key === k);
      if (!cat) throw new BadRequestException({ statusCode: 400, code: 'CATEGORY_INVALID', message: 'Categoria inexistente.' });
      if (k !== t.category) { data.category = k; category = k; recompute = true; evs.push({ kind: 'category', from: t.category, to: k }); }
    }
    if (patch.priority !== undefined) {
      if (!isPriority(patch.priority)) throw new BadRequestException('Prioridade inválida.');
      if (patch.priority !== t.priority) { data.priority = patch.priority; priority = patch.priority; recompute = true; evs.push({ kind: 'priority', from: t.priority, to: patch.priority }); }
    }
    if (patch.status !== undefined) {
      if (!isTicketStatus(patch.status)) throw new BadRequestException('Status inválido.');
      if (patch.status !== t.status) {
        newStatus = patch.status;
        data.status = newStatus;
        const now = new Date();
        if (newStatus === 'resolved') data.resolved_at = now;
        if (newStatus === 'closed') { data.closed_at = now; if (!t.resolved_at) data.resolved_at = now; }
        if ((newStatus === 'open' || newStatus === 'pending') && (t.status === 'resolved' || t.status === 'closed')) {
          reopened = true;
          data.reopen_count = { increment: 1 };
          data.resolved_at = null;
          data.closed_at = null;
          // reaberto = prazo novo a partir de agora
          const h = slaHoursFor(s, category, priority);
          data.sla_due_at = new Date(+now + h.solve * 3600_000);
          data.sla_warned_at = null;
          data.sla_breached_at = null;
        }
        evs.push({ kind: reopened ? 'reopened' : 'status', from: t.status, to: newStatus });
      }
    }
    if (recompute && !reopened) {
      const due = computeDue(s, category, priority, t.created_at);
      data.sla_due_at = due.sla_due_at;
      data.first_response_due_at = due.first_response_due_at;
      if (+due.sla_due_at > Date.now()) { data.sla_breached_at = null; data.sla_warned_at = null; }
    }
    if (patch.assigned_user_id !== undefined) {
      const next = patch.assigned_user_id ? await this.assertUser(orgId, patch.assigned_user_id) : null;
      if (next !== (t.assigned_user_id || null)) { data.assigned_user_id = next; assignedTo = next; evs.push({ kind: 'assigned', from: t.assigned_user_id || null, to: next }); }
    }
    if (patch.custom !== undefined) {
      const next = await this.cf.apply(orgId, 'ticket', patch.custom, { mode: 'update', current: t.custom });
      if (next && JSON.stringify(next) !== JSON.stringify(t.custom || {})) { data.custom = next; evs.push({ kind: 'custom' }); }
    }
    if (!Object.keys(data).length) return this.get(orgId, id);

    // claim condicional: se o status mudou no meio (outra aba/runner), não sobrescreve
    const u = await this.prisma.whatsapp_tickets.updateMany({ where: { id: t.id, organization_id: orgId, status: t.status }, data });
    if (!u.count) throw new BadRequestException('O chamado mudou enquanto você editava. Atualize a tela.');
    for (const e of evs) await this.addEvent(orgId, t.id, { ...e, by });
    const shaped = await this.get(orgId, id);
    this.emitTicket(orgId, 'updated', shaped, { by: by.by, user_id: by.user_id || null, changes: evs.map((e) => e.kind) });
    if (assignedTo !== undefined) this.emitTicket(orgId, 'assigned', shaped, { by: by.by, user_id: by.user_id || null, from: t.assigned_user_id || null });
    if (newStatus && patch.notify !== false && by.by !== 'customer') {
      const evId = Date.now().toString(36);
      if (newStatus === 'resolved' && s.notify_customer.resolved) await this.notifyCustomer(orgId, shaped, 'resolved', 'resolved', { dedupe: `ticket:${t.id}:resolved:${evId}` });
      else if (newStatus === 'closed' && s.notify_customer.status) await this.notifyCustomer(orgId, shaped, 'closed', 'closed', { dedupe: `ticket:${t.id}:closed:${evId}` });
      else if (s.notify_customer.status) await this.notifyCustomer(orgId, shaped, 'status_changed', 'status', { dedupe: `ticket:${t.id}:status:${evId}` });
    }
    return shaped;
  }

  /** Comentário da equipe: interno (nota) ou público (vai ao cliente). `status` opcional muda junto (ex.: "aguardando cliente"). */
  async comment(orgId: string, id: string, input: { body?: string | null; visibility?: string; media_id?: string | null; status?: string | null; notify?: boolean }, by: TicketBy) {
    const t = await this.row(orgId, id);
    const s = await this.settings(orgId);
    const body = clean(input.body, MAX_BODY);
    const media = input.media_id ? (await this.claimMedia(orgId, [input.media_id]))[0] || null : null;
    if (!body && !media) throw new BadRequestException('Escreva o comentário.');
    const visibility: 'internal' | 'public' = input.visibility === 'public' ? 'public' : 'internal';
    if (visibility === 'public' && t.status === 'closed') throw new BadRequestException('Chamado encerrado: reabra antes de responder ao cliente.');
    // status ANTES do comentário: se a troca de status falhar (mudou no meio), nada foi gravado e o "tentar de novo"
    // não duplica o comentário; se o comentário falhar depois, o novo envio já não muda o status (igual) e só comenta.
    const wantStatus = input.status && isTicketStatus(input.status) && input.status !== t.status ? input.status : null;
    if (wantStatus) await this.update(orgId, id, { status: wantStatus, notify: false }, by);
    const ev = await this.addEvent(orgId, t.id, { kind: 'comment', by, body, visibility, media_id: media });
    if (visibility === 'public' && (by.by === 'staff' || by.by === 'api') && !t.first_response_at) {
      await this.prisma.whatsapp_tickets.updateMany({ where: { id: t.id, first_response_at: null }, data: { first_response_at: new Date() } });
    }
    const shaped: any = await this.get(orgId, id);
    this.emitTicket(orgId, 'commented', shaped, { by: by.by, user_id: by.user_id || null, visibility, event_id: ev.id, ...(visibility === 'public' ? { comment: body } : {}) });
    if (visibility === 'public' && input.notify !== false && s.notify_customer.comment) {
      const key = wantStatus === 'pending' ? 'pending' : wantStatus === 'resolved' ? 'resolved' : 'comment';
      if (key === 'resolved') {
        // resposta + resolvido: manda o comentário e depois o texto de resolvido
        await this.notifyCustomer(orgId, shaped, 'comment', 'comment', { extraVars: { 'chamado.comentario': body }, dedupe: `ticket:${t.id}:comment:${ev.id}`, media_id: media });
        if (s.notify_customer.resolved) await this.notifyCustomer(orgId, shaped, 'resolved', 'resolved', { dedupe: `ticket:${t.id}:resolved:${ev.id}` });
      } else {
        await this.notifyCustomer(orgId, shaped, key, key === 'pending' ? 'pending' : 'comment', { extraVars: { 'chamado.comentario': body }, dedupe: `ticket:${t.id}:comment:${ev.id}`, media_id: media });
      }
    }
    return { ticket: shaped, event_id: ev.id };
  }

  /**
   * Mensagem do CLIENTE no chamado (bot "enviar mais informações" ou mensagem solta observada).
   * Aguardando cliente → aberto; resolvido dentro de `reopen_days` → reaberto; encerrado → não aceita.
   * Dedupe: o mesmo texto do cliente no mesmo chamado em 2 min é ignorado (bot + observador).
   */
  async customerMessage(orgId: string, id: string, input: { body?: string | null; media_id?: string | null }, by: TicketBy = { by: 'customer' }) {
    const t = await this.row(orgId, id);
    if (t.status === 'closed') return { ok: false as const, reason: 'closed', ticket: await this.shapeOne(orgId, t) };
    const s = await this.settings(orgId);
    const body = clean(input.body, 2000);
    const media = input.media_id ? (await this.claimMedia(orgId, [input.media_id]))[0] || null : null;
    if (!body && !media) return { ok: false as const, reason: 'empty', ticket: await this.shapeOne(orgId, t) };
    const recent = await this.prisma.whatsapp_ticket_events.findMany({ where: { ticket_id: t.id, kind: 'customer_message', created_at: { gte: new Date(Date.now() - 120_000) } }, select: { body: true, media_id: true } });
    if (recent.some((r) => (r.body || '') === body && (r.media_id || null) === media)) return { ok: true as const, duplicate: true, ticket: await this.shapeOne(orgId, t) };
    await this.addEvent(orgId, t.id, { kind: 'customer_message', by, body, visibility: 'public', media_id: media });
    let next: TicketStatus | null = null;
    if (t.status === 'pending') next = 'open';
    else if (t.status === 'resolved' && s.customer_reply_reopens && t.resolved_at && Date.now() - +t.resolved_at <= s.reopen_days * 86_400_000) next = 'open';
    let shaped: any;
    if (next) {
      const wasResolved = t.status === 'resolved';
      shaped = await this.update(orgId, id, { status: next, notify: false }, by).catch(async () => this.get(orgId, id));
      if (wasResolved) await this.notifyCustomer(orgId, shaped, 'reopened', 'reopened', { dedupe: `ticket:${t.id}:reopened:${shaped.reopen_count}` });
    } else {
      shaped = await this.get(orgId, id);
      this.emitTicket(orgId, 'updated', shaped, { by: by.by, changes: ['customer_message'] });
    }
    return { ok: true as const, ticket: shaped, reopened: Boolean(next && t.status === 'resolved') };
  }

  // ================================================================ bot / painel da conversa
  /** Chamados do contato/cliente (mais recentes primeiro). */
  async ofContact(orgId: string, who: { contact_id?: string | null; customer_ids?: string[] | null }, opts: { limit?: number; active_only?: boolean } = {}) {
    const or: any[] = [];
    if (who.contact_id) or.push({ contact_id: who.contact_id });
    if (who.customer_ids?.length) or.push({ customer_id: { in: who.customer_ids } });
    if (!or.length) return [];
    const rows = await this.prisma.whatsapp_tickets.findMany({
      where: { organization_id: orgId, OR: or, ...(opts.active_only ? { status: { in: [...ACTIVE_TICKET] } } : {}) },
      orderBy: [{ last_event_at: 'desc' }, { created_at: 'desc' }],
      take: Math.min(50, Math.max(1, opts.limit || 5)),
    });
    return this.shapeMany(orgId, rows);
  }

  /** Protocolo digitado pelo cliente — só acha se for dele. */
  async byProtocol(orgId: string, protocol: string, who: { contact_id?: string | null; customer_ids?: string[] | null }) {
    const p = normalizeProtocolInput(protocol);
    if (p.length < 3) return null;
    const t = await this.prisma.whatsapp_tickets.findFirst({ where: { organization_id: orgId, protocol: p } });
    if (!t) return null;
    const mine = (who.contact_id && t.contact_id === who.contact_id) || (t.customer_id && (who.customer_ids || []).includes(t.customer_id));
    return mine ? this.shapeOne(orgId, t) : null;
  }

  /** Última atualização pública (comentário da equipe) — o bot mostra nos detalhes. */
  async lastPublicUpdate(orgId: string, id: string) {
    const ev = await this.prisma.whatsapp_ticket_events.findFirst({ where: { ticket_id: id, organization_id: orgId, kind: 'comment', visibility: 'public' }, orderBy: { created_at: 'desc' } });
    return ev ? { body: ev.body || '', at: ev.created_at } : null;
  }

  /** Painel da conversa: chamados do contato daquela conversa (todos os números). */
  async byChat(orgId: string, chatUuid: string, allowed: Set<string> | null = null) {
    const chat = await this.prisma.whatsapp_chats.findFirst({ where: { id: String(chatUuid), organization_id: orgId } });
    if (!chat) throw new NotFoundException('Conversa não encontrada.');
    const contact = await this.identity.contactOfJid(orgId, chat.session_id, chat.chat_id);
    const customers = contact ? (await this.identity.customersOfContact(orgId, contact.id)).map((x: any) => x.customer?.id).filter(Boolean) : [];
    const or: any[] = [{ session_id: chat.session_id, chat_id: chat.chat_id }];
    if (contact) or.push({ contact_id: contact.id });
    if (customers.length) or.push({ customer_id: { in: customers } });
    const sc = this.scope(allowed);
    const rows = await this.prisma.whatsapp_tickets.findMany({ where: { organization_id: orgId, OR: or, ...(sc ? { AND: [sc] } : {}) }, orderBy: [{ created_at: 'desc' }], take: 50 });
    return { items: await this.shapeMany(orgId, rows), contact_id: contact?.id || null, customer_id: customers[0] || null };
  }

  // ================================================================ mensagem solta do cliente
  private async onInbound(e: InboundEvent) {
    try {
      const m = e?.message;
      if (!m || !e.orgId || !e.sessionId || !e.chatId || isGroupJid(e.chatId)) return;
      const body = typeof m.body === 'string' ? m.body : '';
      if (!body.trim() && !m.media_id) return;
      // conversa no meio de um fluxo do bot (menu/pergunta esperando resposta): quem trata a mensagem é o bot
      // (o bloco "Meus chamados" grava a informação pelo `customerMessage`); "1", "pronto" etc. não viram registro.
      const bot = await this.prisma.whatsapp_bot_sessions.findFirst({ where: { organization_id: e.orgId, session_id: e.sessionId, chat_id: e.chatId, status: 'waiting', updated_at: { gte: new Date(Date.now() - 24 * 3600_000) } }, select: { id: true } }).catch(() => null);
      if (bot) return;
      const contact = await this.identity.contactOfJid(e.orgId, e.sessionId, e.chatId).catch(() => null);
      const or: any[] = [{ session_id: e.sessionId, chat_id: e.chatId }];
      if (contact?.id) or.push({ contact_id: contact.id });
      const s = await this.settings(e.orgId);
      const statuses = ['pending', ...(s.customer_reply_reopens ? ['resolved'] : [])];
      const t = await this.prisma.whatsapp_tickets.findFirst({ where: { organization_id: e.orgId, status: { in: statuses }, OR: or }, orderBy: [{ last_event_at: 'desc' }] });
      if (!t) return;
      if (t.status === 'resolved') {
        if (!t.resolved_at || Date.now() - +t.resolved_at > s.reopen_days * 86_400_000) return;
        if (!m.media_id && isCourtesy(body)) return; // "ok", "obrigado" não reabre
      }
      await this.customerMessage(e.orgId, t.id, { body, media_id: m.media_id || null }, { by: 'customer' });
    } catch (err: any) {
      this.logger.warn(`chamados: mensagem do cliente: ${err?.message || err}`);
    }
  }

  // ================================================================ rotinas (runner)
  /**
   * Aviso de prazo / prazo estourado (uma vez cada) e encerramento automático dos resolvidos. POR ORG (org sem acesso
   * ou com a opção desligada não ocupa a vez das outras), com a configuração da org no filtro do banco e lotes em
   * ordem até `RUN_MAX_PER_ORG` por rodada.
   */
  async runSla(now: Date = new Date()) {
    const warnBase = { status: { in: [...ACTIVE_TICKET] }, sla_warned_at: null, sla_breached_at: null, sla_due_at: { gt: now, lte: new Date(+now + 7 * 86_400_000) } };
    const lateBase = { status: { in: [...ACTIVE_TICKET] }, sla_breached_at: null, sla_due_at: { lte: now } };
    const resolvedBase = { status: 'resolved', resolved_at: { lte: new Date(+now - 86_400_000) } };
    const orgsOf = async (where: any) => (await this.prisma.whatsapp_tickets.groupBy({ by: ['organization_id'], where, _count: { _all: true } })).map((g) => g.organization_id);
    const [wOrgs, lOrgs, rOrgs] = await Promise.all([orgsOf(warnBase), orgsOf(lateBase), orgsOf(resolvedBase)]);
    const active = new Map<string, boolean>();
    const isActive = async (org: string) => {
      if (!active.has(org)) active.set(org, await this.access.isOrgActive(org).catch(() => false));
      return active.get(org)!;
    };
    let warned = 0, breached = 0, closed = 0;
    for (const orgId of wOrgs) {
      if (!(await isActive(orgId))) continue;
      const s = await this.settings(orgId);
      const where = { ...warnBase, organization_id: orgId, sla_due_at: { gt: now, lte: new Date(+now + s.warn_before_minutes * 60_000) } };
      await this.eachTicket(where, 'sla_due_at', async (t) => {
        const u = await this.prisma.whatsapp_tickets.updateMany({ where: { id: t.id, sla_warned_at: null }, data: { sla_warned_at: now } });
        if (!u.count) return;
        await this.addEvent(orgId, t.id, { kind: 'sla_warning', by: { by: 'system' }, to: fmtDueAbsolute(t.sla_due_at) });
        this.emitTicket(orgId, 'sla', await this.get(orgId, t.id), { phase: 'warning' });
        warned++;
      });
    }
    for (const orgId of lOrgs) {
      if (!(await isActive(orgId))) continue;
      await this.eachTicket({ ...lateBase, organization_id: orgId }, 'sla_due_at', async (t) => {
        const u = await this.prisma.whatsapp_tickets.updateMany({ where: { id: t.id, sla_breached_at: null }, data: { sla_breached_at: now, sla_warned_at: t.sla_warned_at || now } });
        if (!u.count) return;
        await this.addEvent(orgId, t.id, { kind: 'sla_breached', by: { by: 'system' }, to: fmtDueAbsolute(t.sla_due_at) });
        this.emitTicket(orgId, 'sla', await this.get(orgId, t.id), { phase: 'breached' });
        breached++;
      });
    }
    // resolvidos antigos → encerrados (por org: `auto_close_days`; 0 = desligado)
    for (const orgId of rOrgs) {
      if (!(await isActive(orgId))) continue;
      const s = await this.settings(orgId);
      if (!s.auto_close_days) continue;
      await this.eachTicket({ ...resolvedBase, organization_id: orgId, resolved_at: { lte: new Date(+now - s.auto_close_days * 86_400_000) } }, 'resolved_at', async (t) => {
        try {
          await this.update(orgId, t.id, { status: 'closed', notify: true }, { by: 'system' });
          closed++;
        } catch { /* mudou no meio: fica para a próxima rodada */ }
      });
    }
    if (warned || breached || closed) this.logger.log(`chamados: ${warned} aviso(s) de prazo, ${breached} prazo(s) estourado(s), ${closed} encerrado(s)`);
    return { warned, breached, closed };
  }

  /** Lotes em ordem (`field`, id) com cursor pelos valores LIDOS (a linha sai do filtro ao ser processada). */
  private async eachTicket(where: any, field: 'sla_due_at' | 'resolved_at', fn: (t: any) => Promise<void>) {
    let last: { v: Date; id: string } | null = null, seen = 0;
    while (seen < RUN_MAX_PER_ORG) {
      const after: any = last ? { OR: [{ [field]: { gt: last.v } }, { [field]: last.v, id: { gt: last.id } }] } : null;
      const rows: any[] = await this.prisma.whatsapp_tickets.findMany({ where: after ? { AND: [where, after] } : where, orderBy: [{ [field]: 'asc' } as any, { id: 'asc' as const }], take: RUN_BATCH });
      if (!rows.length) break;
      const tail = rows[rows.length - 1];
      last = { v: tail[field], id: tail.id };
      for (const t of rows) {
        try { await fn(t); } catch (e: any) { this.logger.warn(`chamado ${t.id}: rotina: ${e?.message || e}`); }
      }
      seen += rows.length;
      if (rows.length < RUN_BATCH || !last.v) break;
    }
  }

  /** Quantidades para o painel do cliente/conversa (rápido). */
  async activeCountFor(orgId: string, who: { contact_id?: string | null; customer_ids?: string[] | null }) {
    const or: any[] = [];
    if (who.contact_id) or.push({ contact_id: who.contact_id });
    if (who.customer_ids?.length) or.push({ customer_id: { in: who.customer_ids } });
    if (!or.length) return { active: 0, pending_customer: 0 };
    const [active, pending] = await Promise.all([
      this.prisma.whatsapp_tickets.count({ where: { organization_id: orgId, OR: or, status: { in: [...ACTIVE_TICKET] } } }),
      this.prisma.whatsapp_tickets.count({ where: { organization_id: orgId, OR: or, status: 'pending' } }),
    ]);
    return { active, pending_customer: pending };
  }

  /** Usuários que podem ser responsáveis (ativos da org). */
  async assignees(orgId: string) {
    const rows = await this.prisma.users.findMany({ where: { organization_id: orgId, active: true }, select: { id: true, name: true, email: true, role: true, modules: true }, orderBy: { name: 'asc' }, take: 500 });
    // dono/admin sempre; membro só com o módulo WhatsApp liberado
    const withWa = rows.filter((u) => u.role !== 'MEMBER' || (Array.isArray(u.modules) && (u.modules as any[]).includes('whatsapp')));
    return withWa.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role }));
  }
}
