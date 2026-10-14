import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from '../../platform-billing/access.service';
import { publicApiUrl } from '../../payments/gateways.util';
import { WhatsAppPresenter } from '../whatsapp-presenter.service';
import { InboundEvent, WhatsAppHooks } from '../whatsapp-hooks.service';
import { WhatsAppOutboxService } from '../whatsapp-outbox.service';
import { WhatsAppChargesService } from '../whatsapp-charges.service';
import { WhatsAppCrmService } from '../whatsapp-crm.service';
import { WhatsAppIdentityService } from '../whatsapp-identity.service';
import { WhatsAppSessionsService } from '../whatsapp-sessions.service';
import { WhatsAppCustomFieldsService } from '../whatsapp-custom-fields.service';
import { formatBRL, firstName } from '../wa-crm-vars.util';
import { addMonths, cycleMonthsOf, BILLING_MONTHS } from '../wa-subscription-math.util';
import { isGroupJid } from '../wa-jid.util';
import {
  APPT_STATUSES, Booking, DAY_MS, OCCUPYING, RESOURCE_KINDS, SchedulingSettings, WAIT_PERIODS,
  addDaysStr, brtDateStr, brtMinuteOf, brtToUtc, buildIcs, cancelDeadline, fillScheduleText, fmtDay, fmtDuration, fmtTime, hhmmToMin,
  isDay, isOnGrid, maxLoad, normalizeAvailability, normalizeBooking, normalizeIncludedPlans, normalizeSchedulingSettings, overlaps, periodOf,
  slotsForDay, weekdayOf, withinAvailability,
} from './wa-schedule.util';

// ============================================================================
// Agenda com pagamento (Fase 6 das assinaturas — contrato `docs/whatsapp-assinaturas-contrato.md` §9).
//
//  - Serviço = produto `kind:'service'` (duração, intervalo, capacidade, regras de reserva em `booking`).
//  - Recurso = quem/o que atende (profissional, sala, box…), com grade semanal e bloqueios.
//  - Reserva ATÔMICA: transação interativa; trava a linha do recurso (`FOR UPDATE`, serializa reservas do
//    mesmo recurso) e as linhas de agendamento sobrepostas (`FOR UPDATE`); carga ≥ capacidade → 409 SLOT_TAKEN;
//    o mesmo contato/cliente com horário sobreposto → 409 CONTACT_BUSY. Deadlock/lock → tenta de novo (3×).
//  - Pagamento: no local · incluso no plano (uso por ciclo, atômico) · na reserva / sinal (cobrança PIX pelo
//    serviço de cobranças; `pending_payment` até `pay_until`) · crédito do cliente abate (FIFO, atômico).
//  - Hooks `charge_paid/expired/canceled` movem o agendamento; runners (whatsapp-scheduling.runner.ts) expiram,
//    lembram (D-1/H-2), marcam falta, concluem e oferecem vagas da lista de espera.
//  - TODO texto ao cliente sai pela fila (`whatsapp_outbox`, dedupe `appt:<id>:<tipo>`). Agendamento feito
//    pelo BOT não recebe os textos de reserva/pagamento daqui (o bot mostra os dele).
//  - Respostas "1/2" ao pedido de confirmação D-1 e à oferta da lista de espera são consumidas aqui
//    (`onInboundFilter`, como avaliação/descadastro) — o bot não as vê.
// ============================================================================

const OCC = [...OCCUPYING] as string[];
const UUID_RE = /^[0-9a-f-]{36}$/i;
const MAX_RESOURCES = 100;
const MAX_BLOCKS = 2000;
const DEDUPE_HOURS = 24;
export type BookSource = 'bot' | 'panel' | 'api' | 'waitlist';
export type BookInput = {
  product_id: string; resource_id?: string | null; starts_at: string | Date;
  customer_id?: string | null; contact_id?: string | null; session_id?: string | null; chat_id?: string | null;
  source: BookSource; payment?: 'auto' | 'on_site' | 'charge'; notes?: string | null; user_id?: string | null;
  bot?: { flow_id: string; node_id?: string | null } | null; waitlist_id?: string | null; notify?: boolean;
  /** painel: ignora antecedência mínima e limite de dias (encaixe da equipe) */
  ignore_notice?: boolean;
  /** Fase 7: campos personalizados do agendamento (obrigatórios só pelo painel/API; o bot não pede) */
  custom?: Record<string, unknown> | null;
};
export type ActBy = 'customer' | 'staff' | 'system';
type Pending = { ids: Set<string>; until: number; sentAt: number };
type OfferPending = { waitlistId: string; until: number; sentAt: number };
/** Lote dos runners (por org, com cursor) e teto por org por rodada. */
const RUN_BATCH = 200;
const RUN_MAX_PER_ORG = 2000;
/** Reserva/remarcação: READ COMMITTED para enxergar o que outra transação gravou enquanto esta esperava o lock do recurso. */
const TX_OPTS = { timeout: 15_000, maxWait: 10_000, isolationLevel: 'ReadCommitted' as const };
const isDeadlock = (e: any) => e?.code === 'P2034' || /deadlock|lock wait timeout|1213|1205/i.test(String(e?.message || e?.meta?.message || ''));
/** Esperas do bot que NÃO são pergunta ao cliente (tempo, pagamento, ação interna): não disputam o "1/2". */
const BOT_NOT_ASKING = new Set(['wait', 'charge', 'pix', 'crm_wait']);
const conflict = (code: string, message: string) => new ConflictException({ statusCode: 409, code, message });

@Injectable()
export class WhatsAppSchedulingService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppSchedulingService.name);
  private readonly settingsCache = new Map<string, { at: number; s: SchedulingSettings }>();
  private readonly confirmPending = new Map<string, Pending>(); // `${org}:${session}:${jid}` → agendamentos aguardando "1/2"
  private readonly offerPending = new Map<string, OfferPending>(); // idem → oferta da lista de espera
  private readonly waitlistKick = new Map<string, number>(); // org:produto → última varredura imediata
  /** `${org}:${session}:${jid}` → quando o bot passou a esperar resposta (hook `bot_state`); a pergunta mais recente decide quem lê o "1/2". */
  private readonly botWaiting = new Map<string, number>();
  private readonly scanning = new Set<string>(); // org em varredura da lista de espera (mutex)
  private readonly rescan = new Map<string, string | null | undefined>(); // org → pediram outra varredura durante a atual

  constructor(
    private readonly prisma: PrismaService,
    private readonly presenter: WhatsAppPresenter,
    private readonly hooks: WhatsAppHooks,
    private readonly outbox: WhatsAppOutboxService,
    private readonly charges: WhatsAppChargesService,
    private readonly crm: WhatsAppCrmService,
    private readonly identity: WhatsAppIdentityService,
    private readonly sessions: WhatsAppSessionsService,
    private readonly access: AccessService,
    private readonly cf: WhatsAppCustomFieldsService,
  ) {}

  async onModuleInit() {
    this.hooks.on('charge_paid', (e) => this.onChargePaid(e));
    this.hooks.on('charge_expired', (e) => this.onChargeGone(e, 'expired'));
    this.hooks.on('charge_canceled', (e) => this.onChargeGone(e, 'canceled'));
    this.hooks.on('outbox_sent', (e) => this.onOutboxSent(e));
    this.hooks.onInboundFilter((e) => this.capture(e));
    this.hooks.on('bot_state', (e) => this.onBotState(e));
    await this.reloadPending().catch((e) => this.logger.warn(`agenda: recarregar pendências: ${e?.message || e}`));
  }

  // ================================================================ configurações
  async settings(orgId: string): Promise<SchedulingSettings> {
    const c = this.settingsCache.get(orgId);
    if (c && Date.now() - c.at < 60_000) return c.s;
    const row = await this.prisma.whatsapp_crm_settings.findUnique({ where: { organization_id: orgId }, select: { scheduling: true } }).catch(() => null);
    const s = normalizeSchedulingSettings(row?.scheduling);
    this.settingsCache.set(orgId, { at: Date.now(), s });
    return s;
  }

  /** PUT parcial: chaves ausentes mantêm o valor atual; textos vazios voltam ao padrão. */
  async updateSettings(orgId: string, dto: any) {
    this.settingsCache.delete(orgId);
    const cur = await this.settings(orgId);
    const clean: any = Object.fromEntries(Object.entries(dto || {}).filter(([, v]) => v !== undefined));
    const next = normalizeSchedulingSettings({ ...cur, ...clean, texts: { ...cur.texts, ...(clean.texts && typeof clean.texts === 'object' ? clean.texts : {}) } });
    await this.prisma.whatsapp_crm_settings.upsert({ where: { organization_id: orgId }, create: { organization_id: orgId, scheduling: next as any }, update: { scheduling: next as any } });
    this.settingsCache.delete(orgId);
    return this.settings(orgId);
  }

  // ================================================================ recursos
  private shapeResource(r: any, ctx: { smap?: Map<string, any>; users?: Map<string, string>; products?: Map<string, string> } = {}) {
    const services = Array.isArray(r.services) ? (r.services as any[]).map(String) : [];
    return {
      id: r.id, name: r.name, kind: r.kind, color: r.color || null, photo_media_id: r.photo_media_id || null, active: r.active, position: r.position,
      session_id: r.session_id || null, session: (r.session_id && ctx.smap?.get(r.session_id)) || null,
      user_id: r.user_id || null, user: r.user_id ? { id: r.user_id, name: ctx.users?.get(r.user_id) || null } : null,
      services, all_services: !services.length, service_names: services.map((id) => ctx.products?.get(id)).filter(Boolean),
      availability: normalizeAvailability(r.availability), has_ics: Boolean(r.ics_token),
      created_at: r.created_at, updated_at: r.updated_at,
    };
  }

  private async resourceCtx(orgId: string, rows: any[]) {
    const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
    const [smap, users, products] = await Promise.all([
      this.presenter.sessionMap(orgId),
      userIds.length ? this.prisma.users.findMany({ where: { id: { in: userIds }, organization_id: orgId }, select: { id: true, name: true, email: true } }) : Promise.resolve([] as any[]),
      this.prisma.whatsapp_products.findMany({ where: { organization_id: orgId, kind: 'service' }, select: { id: true, name: true } }),
    ]);
    return { smap, users: new Map(users.map((u: any) => [u.id, u.name || u.email] as [string, string])), products: new Map(products.map((p) => [p.id, p.name] as [string, string])) };
  }

  async listResources(orgId: string, q: any = {}) {
    const where: any = { organization_id: orgId };
    if (q.active === '1' || q.active === 'true' || q.active === true) where.active = true;
    if (q.product_id) where.active = true;
    let rows = await this.prisma.whatsapp_resources.findMany({ where, orderBy: [{ position: 'asc' }, { name: 'asc' }] });
    if (q.product_id) rows = rows.filter((r) => this.serves(r, String(q.product_id)));
    const ctx = await this.resourceCtx(orgId, rows);
    return rows.map((r) => this.shapeResource(r, ctx));
  }

  async getResource(orgId: string, id: string) {
    const r = await this.prisma.whatsapp_resources.findFirst({ where: { id, organization_id: orgId } });
    if (!r) throw new NotFoundException('Recurso não encontrado.');
    return this.shapeResource(r, await this.resourceCtx(orgId, [r]));
  }

  private serves(r: any, productId: string) {
    const list = Array.isArray(r.services) ? (r.services as any[]).map(String) : [];
    return !list.length || list.includes(productId);
  }

  private async resourceData(orgId: string, dto: any, cur?: any) {
    const data: any = {};
    if (dto.name !== undefined || !cur) { const n = String(dto.name || '').trim().slice(0, 120); if (!n) throw new BadRequestException('Dê um nome ao recurso.'); data.name = n; }
    if (dto.kind !== undefined) data.kind = (RESOURCE_KINDS as readonly string[]).includes(dto.kind) ? dto.kind : 'other';
    if (dto.color !== undefined) data.color = /^#[0-9a-f]{6}$/i.test(String(dto.color || '')) ? String(dto.color).toLowerCase() : null;
    if (dto.active !== undefined) data.active = Boolean(dto.active);
    if (dto.photo_media_id !== undefined) {
      if (dto.photo_media_id) {
        const m = await this.prisma.whatsapp_media.findFirst({ where: { id: String(dto.photo_media_id), organization_id: orgId }, select: { id: true } });
        if (!m) throw new BadRequestException('A foto não existe mais. Envie de novo.');
        await this.prisma.whatsapp_media.updateMany({ where: { id: m.id }, data: { expires_at: null } }).catch(() => undefined); // foto de recurso não vence
        data.photo_media_id = m.id;
      } else data.photo_media_id = null;
    }
    if (dto.session_id !== undefined) {
      if (dto.session_id) { const s = await this.sessions.rowById(orgId, String(dto.session_id)); if (!s) throw new BadRequestException('Número não encontrado.'); data.session_id = s.id; } else data.session_id = null;
    }
    if (dto.user_id !== undefined) {
      if (dto.user_id) { const u = await this.prisma.users.findFirst({ where: { id: String(dto.user_id), organization_id: orgId }, select: { id: true } }); if (!u) throw new BadRequestException('Usuário não encontrado.'); data.user_id = u.id; } else data.user_id = null;
    }
    if (dto.services !== undefined) {
      const ids = [...new Set((Array.isArray(dto.services) ? dto.services : []).map(String).filter((x: string) => UUID_RE.test(x)))].slice(0, 200) as string[];
      if (ids.length && (await this.prisma.whatsapp_products.count({ where: { organization_id: orgId, id: { in: ids }, kind: 'service' } })) !== ids.length) throw new BadRequestException('Algum dos serviços escolhidos não existe (ou não é serviço).');
      data.services = ids;
    }
    if (dto.availability !== undefined) data.availability = normalizeAvailability(dto.availability) as any;
    return data;
  }

  async createResource(orgId: string, dto: any) {
    const n = await this.prisma.whatsapp_resources.count({ where: { organization_id: orgId } });
    if (n >= MAX_RESOURCES) throw new BadRequestException(`Limite de ${MAX_RESOURCES} recursos.`);
    const data = await this.resourceData(orgId, dto);
    if (!data.availability) data.availability = normalizeAvailability(null) as any;
    const r = await this.prisma.whatsapp_resources.create({ data: { organization_id: orgId, ...data, position: n } });
    this.presenter.emit(orgId, 'wa:appointment', { action: 'resources', resource_id: r.id });
    return this.getResource(orgId, r.id);
  }

  async updateResource(orgId: string, id: string, dto: any) {
    const cur = await this.prisma.whatsapp_resources.findFirst({ where: { id, organization_id: orgId } });
    if (!cur) throw new NotFoundException('Recurso não encontrado.');
    const clean: any = Object.fromEntries(Object.entries(dto || {}).filter(([, v]) => v !== undefined));
    const data = await this.resourceData(orgId, clean, cur);
    await this.prisma.whatsapp_resources.update({ where: { id }, data });
    this.presenter.emit(orgId, 'wa:appointment', { action: 'resources', resource_id: id });
    return this.getResource(orgId, id);
  }

  async removeResource(orgId: string, id: string) {
    const cur = await this.prisma.whatsapp_resources.findFirst({ where: { id, organization_id: orgId } });
    if (!cur) throw new NotFoundException('Recurso não encontrado.');
    const future = await this.prisma.whatsapp_appointments.count({ where: { resource_id: id, status: { in: OCC }, ends_at: { gt: new Date() } } });
    if (future) throw new BadRequestException(`Há ${future} agendamento${future === 1 ? '' : 's'} futuro${future === 1 ? '' : 's'} neste recurso. Cancele/remarque ou desative o recurso em vez de excluir.`);
    // apagar o recurso apaga o histórico de agendamentos dele (FK CASCADE) — por isso só sem futuros
    await this.prisma.whatsapp_resources.delete({ where: { id } });
    this.presenter.emit(orgId, 'wa:appointment', { action: 'resources', resource_id: id });
    return { ok: true };
  }

  async reorderResources(orgId: string, ids: string[]) {
    const list = (Array.isArray(ids) ? ids : []).map(String).slice(0, MAX_RESOURCES);
    await this.prisma.$transaction(list.map((id, i) => this.prisma.whatsapp_resources.updateMany({ where: { id, organization_id: orgId }, data: { position: i } })));
    return this.listResources(orgId);
  }

  // ---------------------------------------------------------------- bloqueios
  private shapeBlock(b: any) {
    return { id: b.id, resource_id: b.resource_id || null, starts_at: b.starts_at, ends_at: b.ends_at, reason: b.reason || null, label: `${fmtDay(b.starts_at)} ${fmtTime(b.starts_at)} → ${fmtDay(b.ends_at)} ${fmtTime(b.ends_at)}`, created_at: b.created_at };
  }

  /** `resourceId` = do recurso + os gerais; `null` = TODOS os da org (gerais com `resource_id: null` + os de cada recurso). */
  async listBlocks(orgId: string, resourceId: string | null, q: any = {}) {
    if (resourceId) await this.requireResource(orgId, resourceId);
    const from = q.from ? this.parseDayOrIso(q.from, '00:00') : new Date(Date.now() - 30 * DAY_MS);
    const to = q.to ? this.parseDayOrIso(q.to, '24:00') : new Date(Date.now() + 400 * DAY_MS);
    const rows = await this.prisma.whatsapp_resource_blocks.findMany({ where: { organization_id: orgId, ...(resourceId ? { OR: [{ resource_id: resourceId }, { resource_id: null }] } : {}), ends_at: { gt: from }, starts_at: { lt: to } }, orderBy: { starts_at: 'asc' }, take: 500 });
    return rows.map((b) => this.shapeBlock(b));
  }

  async createBlock(orgId: string, resourceId: string | null, dto: any, userId: string | null) {
    if (resourceId) await this.requireResource(orgId, resourceId);
    const start = this.parseDayOrIso(dto.starts_at, '00:00'), end = this.parseDayOrIso(dto.ends_at, '24:00');
    if (!(end > start)) throw new BadRequestException('O fim do bloqueio precisa ser depois do início.');
    if (+end - +start > 400 * DAY_MS) throw new BadRequestException('Bloqueio de no máximo 400 dias.');
    if ((await this.prisma.whatsapp_resource_blocks.count({ where: { organization_id: orgId, ends_at: { gt: new Date() } } })) >= MAX_BLOCKS) throw new BadRequestException('Muitos bloqueios futuros.');
    const b = await this.prisma.whatsapp_resource_blocks.create({ data: { organization_id: orgId, resource_id: resourceId, starts_at: start, ends_at: end, reason: String(dto.reason || '').trim().slice(0, 120) || null, created_by: userId } });
    // agendamentos que já existem dentro do bloqueio NÃO são cancelados — a resposta avisa quantos
    const conflicts = await this.prisma.whatsapp_appointments.count({ where: { organization_id: orgId, status: { in: OCC }, ...(resourceId ? { resource_id: resourceId } : {}), starts_at: { lt: end }, service_ends_at: { gt: start } } });
    this.presenter.emit(orgId, 'wa:appointment', { action: 'blocks', resource_id: resourceId });
    return { ...this.shapeBlock(b), conflicts };
  }

  async removeBlock(orgId: string, id: string) {
    const r = await this.prisma.whatsapp_resource_blocks.deleteMany({ where: { id, organization_id: orgId } });
    if (!r.count) throw new NotFoundException('Bloqueio não encontrado.');
    this.presenter.emit(orgId, 'wa:appointment', { action: 'blocks' });
    return { ok: true };
  }

  private async requireResource(orgId: string, id: string) {
    const r = await this.prisma.whatsapp_resources.findFirst({ where: { id, organization_id: orgId } });
    if (!r) throw new NotFoundException('Recurso não encontrado.');
    return r;
  }

  /** "YYYY-MM-DD" (BRT, com hora padrão) ou ISO. */
  private parseDayOrIso(v: any, defaultTime: string) {
    const s = String(v || '');
    const d = isDay(s) ? brtToUtc(s, defaultTime) : s ? new Date(s) : new Date(NaN);
    // ano fora de 2000..2100 também é inválido (o banco recusa e virava 500)
    if (Number.isNaN(+d) || d.getUTCFullYear() < 2000 || d.getUTCFullYear() > 2100) throw new BadRequestException('Data inválida.');
    return d;
  }

  // ---------------------------------------------------------------- ICS
  private newIcsToken() { return randomBytes(24).toString('base64url'); }
  private icsUrl(token: string) { return `${publicApiUrl()}/public/calendar/${token}.ics`; }

  async icsLink(orgId: string, resourceId: string, rotate = false) {
    const r = await this.requireResource(orgId, resourceId);
    let token = r.ics_token;
    if (!token || rotate) { token = this.newIcsToken(); await this.prisma.whatsapp_resources.update({ where: { id: r.id }, data: { ics_token: token } }); }
    return { url: this.icsUrl(token) };
  }

  /** Feed público (só primeiro nome + serviço; sem telefone). null = token desconhecido. */
  async icsFeed(token: string): Promise<{ name: string; body: string } | null> {
    if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return null;
    const r = await this.prisma.whatsapp_resources.findUnique({ where: { ics_token: token } });
    if (!r) return null;
    if (!(await this.access.isOrgActive(r.organization_id))) return { name: r.name, body: buildIcs(r.name, []) };
    const rows = await this.prisma.whatsapp_appointments.findMany({ where: { resource_id: r.id, status: { in: OCC }, starts_at: { gte: new Date(Date.now() - 7 * DAY_MS), lte: new Date(Date.now() + 90 * DAY_MS) } }, orderBy: { starts_at: 'asc' }, take: 3000 });
    const custIds = [...new Set(rows.map((a) => a.customer_id).filter(Boolean))] as string[];
    const contIds = [...new Set(rows.map((a) => a.contact_id).filter(Boolean))] as string[];
    const [custs, conts] = await Promise.all([
      custIds.length ? this.prisma.whatsapp_customers.findMany({ where: { id: { in: custIds } }, select: { id: true, name: true } }) : Promise.resolve([] as any[]),
      contIds.length ? this.prisma.whatsapp_contacts.findMany({ where: { id: { in: contIds } }, select: { id: true, name: true, push_name: true } }) : Promise.resolve([] as any[]),
    ]);
    const cn = new Map(custs.map((c: any) => [c.id, c.name] as [string, string]));
    const kn = new Map(conts.map((c: any) => [c.id, c.name || c.push_name] as [string, string]));
    const STATUS_LABEL: Record<string, string> = { pending_payment: 'Aguardando pagamento', booked: 'Agendado', confirmed: 'Confirmado', in_progress: 'Em atendimento' };
    const events = rows.map((a) => {
      const who = firstName((a.customer_id && cn.get(a.customer_id)) || (a.contact_id && kn.get(a.contact_id)) || '') || 'Cliente';
      return { uid: `${a.id}@pubmail`, start: a.starts_at, end: a.service_ends_at, summary: `${a.service_name} · ${who}`, description: STATUS_LABEL[a.status] || a.status, status: (a.status === 'pending_payment' ? 'TENTATIVE' : 'CONFIRMED') as 'TENTATIVE' | 'CONFIRMED', stamp: a.updated_at };
    });
    return { name: r.name, body: buildIcs(r.name, events) };
  }

  // ================================================================ serviços e vagas
  private serviceShape(p: any, resources: Array<{ id: string; name: string }>) {
    return { id: p.id, name: p.name, description: p.description || null, price_cents: p.price_cents, price_label: formatBRL(p.price_cents), duration_minutes: p.duration_minutes || 0, duration_label: fmtDuration(p.duration_minutes || 0), buffer_after_minutes: p.buffer_after_minutes || 0, capacity: p.capacity || 1, booking: normalizeBooking(p.booking), resources };
  }

  /** Serviços ativos com os recursos que atendem cada um. */
  async services(orgId: string) {
    const [products, res] = await Promise.all([
      this.prisma.whatsapp_products.findMany({ where: { organization_id: orgId, active: true, kind: 'service' }, orderBy: [{ position: 'asc' }, { name: 'asc' }] }),
      this.prisma.whatsapp_resources.findMany({ where: { organization_id: orgId, active: true }, orderBy: [{ position: 'asc' }, { name: 'asc' }] }),
    ]);
    return products.filter((p) => (p.duration_minutes || 0) > 0).map((p) => this.serviceShape(p, res.filter((r) => this.serves(r, p.id)).map((r) => ({ id: r.id, name: r.name }))));
  }

  /** Recursos ativos que atendem o serviço (ordem da lista). */
  async resourcesFor(orgId: string, productId: string) {
    const res = await this.prisma.whatsapp_resources.findMany({ where: { organization_id: orgId, active: true }, orderBy: [{ position: 'asc' }, { name: 'asc' }] });
    return res.filter((r) => this.serves(r, productId)).map((r) => ({ id: r.id, name: r.name, kind: r.kind, color: r.color || null, user_id: r.user_id || null }));
  }

  private async requireService(orgId: string, productId: string) {
    const p = await this.prisma.whatsapp_products.findFirst({ where: { id: String(productId || ''), organization_id: orgId } });
    if (!p || p.kind !== 'service' || !(p.duration_minutes && p.duration_minutes > 0)) throw new NotFoundException('Serviço não encontrado.');
    if (!p.active) throw new BadRequestException('Este serviço não está disponível no momento.');
    return p;
  }

  /** Ocupação dos recursos no intervalo (agendamentos que ocupam), por recurso. */
  private async busyByResource(resourceIds: string[], from: Date, to: Date, excludeId?: string | null) {
    const rows = resourceIds.length ? await this.prisma.whatsapp_appointments.findMany({ where: { resource_id: { in: resourceIds }, status: { in: OCC }, starts_at: { lt: to }, ends_at: { gt: from } }, select: { id: true, resource_id: true, product_id: true, starts_at: true, ends_at: true } }) : [];
    const map = new Map<string, typeof rows>();
    for (const r of rows) if (r.id !== excludeId) map.set(r.resource_id, [...(map.get(r.resource_id) || []), r]);
    return map;
  }

  private async blocksFor(orgId: string, resourceIds: string[], from: Date, to: Date) {
    return this.prisma.whatsapp_resource_blocks.findMany({ where: { organization_id: orgId, OR: [{ resource_id: null }, { resource_id: { in: resourceIds } }], starts_at: { lt: to }, ends_at: { gt: from } } });
  }

  /**
   * Dias com vaga. `resource_id` ausente = todos os recursos do serviço; o horário vem com o 1º recurso livre.
   * `days` 1..60 (padrão 14), `from` YYYY-MM-DD (padrão hoje BRT), `limit_per_day` corta os horários de cada dia.
   */
  async availability(orgId: string, q: { product_id: string; resource_id?: string | null; from?: string | null; days?: number | null; limit_per_day?: number | null; ignore_notice?: boolean; exclude_appointment_id?: string | null; period?: string | null; to?: string | null }) {
    const p = await this.requireService(orgId, q.product_id);
    const booking = normalizeBooking(p.booking);
    const today = brtDateStr();
    const from = q.from && isDay(q.from) && q.from > today ? q.from : today;
    let days = Math.min(60, Math.max(1, Math.round(Number(q.days) || 14)));
    if (q.to && isDay(q.to)) days = Math.min(60, Math.max(1, Math.round((Date.parse(`${q.to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1));
    let resources = (await this.prisma.whatsapp_resources.findMany({ where: { organization_id: orgId, active: true }, orderBy: [{ position: 'asc' }, { name: 'asc' }] })).filter((r) => this.serves(r, p.id));
    if (q.resource_id) resources = resources.filter((r) => r.id === q.resource_id);
    if (!resources.length) return [];
    const rangeFrom = brtToUtc(from, '00:00'), rangeTo = brtToUtc(addDaysStr(from, days), '00:00');
    const ids = resources.map((r) => r.id);
    const [busy, blocks] = await Promise.all([this.busyByResource(ids, rangeFrom, rangeTo, q.exclude_appointment_id), this.blocksFor(orgId, ids, rangeFrom, rangeTo)]);
    const out: Array<{ date: string; label: string; slots: any[] }> = [];
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const day = addDaysStr(from, i);
      const merged = new Map<string, any>();
      for (const r of resources) {
        const slots = slotsForDay({
          availability: normalizeAvailability(r.availability),
          blocks: blocks.filter((b) => !b.resource_id || b.resource_id === r.id).map((b) => ({ start: b.starts_at, end: b.ends_at })),
          busy: (busy.get(r.id) || []).map((b) => ({ start: b.starts_at, end: b.ends_at, foreign: b.product_id !== p.id })),
          capacity: p.capacity || 1, duration: p.duration_minutes!, buffer: p.buffer_after_minutes || 0, day, now,
          minNoticeHours: q.ignore_notice ? 0 : booking.min_notice_hours, maxDaysAhead: q.ignore_notice ? undefined : booking.max_days_ahead,
        });
        for (const s of slots) {
          if (q.period && q.period !== 'any' && periodOf(new Date(s.starts_at)) !== q.period) continue;
          if (!merged.has(s.starts_at)) merged.set(s.starts_at, { starts_at: s.starts_at, ends_at: s.ends_at, service_ends_at: s.service_ends_at, time_label: fmtTime(s.starts_at), resource_id: r.id, resource_name: r.name, left: s.left });
        }
      }
      let slots = [...merged.values()].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      if (q.limit_per_day) slots = slots.slice(0, Math.max(1, Math.round(Number(q.limit_per_day))));
      if (slots.length) out.push({ date: day, label: fmtDay(day), slots });
    }
    return out;
  }

  // ================================================================ formato
  private async shapeMany(orgId: string, rows: any[]) {
    if (!rows.length) return [] as any[];
    const ids = (k: string) => [...new Set(rows.map((r) => r[k]).filter(Boolean))] as string[];
    const [res, custs, charges, smap, products] = await Promise.all([
      this.prisma.whatsapp_resources.findMany({ where: { id: { in: ids('resource_id') } }, select: { id: true, name: true, color: true, kind: true, user_id: true } }),
      ids('customer_id').length ? this.prisma.whatsapp_customers.findMany({ where: { id: { in: ids('customer_id') } }, select: { id: true, name: true, contact_id: true } }) : Promise.resolve([] as any[]),
      ids('charge_id').length ? this.prisma.whatsapp_charges.findMany({ where: { id: { in: ids('charge_id') } }, select: { id: true, status: true, pix_code: true, pay_link_token: true } }) : Promise.resolve([] as any[]),
      this.presenter.sessionMap(orgId),
      ids('product_id').length ? this.prisma.whatsapp_products.findMany({ where: { id: { in: ids('product_id') } }, select: { id: true, booking: true } }) : Promise.resolve([] as any[]),
    ]);
    const contactIds = [...new Set([...ids('contact_id'), ...custs.map((c: any) => c.contact_id)])] as string[];
    const contacts = contactIds.length ? await this.prisma.whatsapp_contacts.findMany({ where: { id: { in: contactIds } }, select: { id: true, name: true, push_name: true, phone: true } }) : [];
    const pairs = rows.filter((r) => r.session_id && r.chat_id).map((r) => ({ session_id: r.session_id, chat_id: r.chat_id }));
    const chats = pairs.length ? await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, OR: pairs }, select: { id: true, session_id: true, chat_id: true } }) : [];
    const ctx = {
      res: new Map(res.map((r) => [r.id, r] as [string, any])), custs: new Map(custs.map((c: any) => [c.id, c] as [string, any])), charges: new Map(charges.map((c: any) => [c.id, c] as [string, any])),
      contacts: new Map(contacts.map((c) => [c.id, c] as [string, any])), chats: new Map(chats.map((c) => [`${c.session_id}|${c.chat_id}`, c.id] as [string, string])), smap,
      bookings: new Map(products.map((p: any) => [p.id, normalizeBooking(p.booking)] as [string, Booking])),
    };
    return rows.map((a) => this.shape(a, ctx));
  }

  private shape(a: any, ctx: any) {
    const r = ctx.res.get(a.resource_id);
    const cust = a.customer_id ? ctx.custs.get(a.customer_id) : null;
    const contact = ctx.contacts.get(a.contact_id) || (cust ? ctx.contacts.get(cust.contact_id) : null);
    const ch = a.charge_id ? ctx.charges.get(a.charge_id) : null;
    const booking: Booking = (a.product_id && ctx.bookings.get(a.product_id)) || normalizeBooking(null);
    const deadline = cancelDeadline(a.starts_at, booking.cancel_free_hours);
    const live = OCC.includes(a.status);
    const now = Date.now();
    const appUrl = String(process.env.APP_PUBLIC_URL || publicApiUrl().replace('://api.', '://')).replace(/\/+$/, '');
    return {
      id: a.id, status: a.status, payment: a.payment,
      starts_at: a.starts_at, ends_at: a.ends_at, service_ends_at: a.service_ends_at,
      date_label: fmtDay(a.starts_at), time_label: fmtTime(a.starts_at), end_time_label: fmtTime(a.service_ends_at), duration_label: fmtDuration(Math.round((+new Date(a.service_ends_at) - +new Date(a.starts_at)) / 60_000)),
      resource: r ? { id: r.id, name: r.name, color: r.color || null, kind: r.kind, user_id: r.user_id || null } : { id: a.resource_id, name: '—', color: null, kind: 'other', user_id: null },
      product_id: a.product_id || null, service_name: a.service_name, price_cents: a.price_cents, price_label: formatBRL(a.price_cents), paid_cents: a.paid_cents || 0, credit_cents: a.credit_cents || 0,
      due_cents: Math.max(0, (a.price_cents || 0) - (a.paid_cents || 0) - (a.credit_cents || 0)),
      charge: ch ? { id: ch.id, status: ch.status, pix_code: ch.pix_code || null, pay_link: ch.pay_link_token ? `${appUrl}/pay/${ch.pay_link_token}` : null } : null,
      pay_until: a.pay_until || null,
      customer: cust ? { id: cust.id, name: cust.name, phone: contact?.phone || null } : null,
      contact: contact ? { id: contact.id, name: contact.name || contact.push_name || null, phone: contact.phone || null } : null,
      contact_id: a.contact_id || null, session_id: a.session_id || null, session: (a.session_id && ctx.smap.get(a.session_id)) || null,
      chat_id: (a.session_id && a.chat_id && ctx.chats.get(`${a.session_id}|${a.chat_id}`)) || null, jid: a.chat_id || null,
      subscription_id: a.subscription_id || null, source: a.source, confirmed_at: a.confirmed_at || null, reminders: a.reminders && typeof a.reminders === 'object' ? a.reminders : {},
      started_at: a.started_at || null, done_at: a.done_at || null, canceled_at: a.canceled_at || null,
      notes: a.notes || null, custom: a.custom && typeof a.custom === 'object' ? a.custom : {}, reschedules: a.reschedules || 0,
      cancel_deadline: deadline, can_cancel_free: live && now <= +deadline, can_reschedule: live && ['pending_payment', 'booked', 'confirmed'].includes(a.status) && +new Date(a.starts_at) > now && (a.reschedules || 0) < booking.reschedule_limit,
      rescheduled_from: a.rescheduled_from || null, cancel_reason: a.cancel_reason || null, cancel_by: a.cancel_by || null,
      address: booking.address, created_by: a.created_by || null, created_at: a.created_at, updated_at: a.updated_at,
    };
  }

  private async shapeOne(orgId: string, a: any) { return (await this.shapeMany(orgId, [a]))[0]; }

  private async row(orgId: string, id: string) {
    const a = await this.prisma.whatsapp_appointments.findFirst({ where: { id: String(id || ''), organization_id: orgId } });
    if (!a) throw new NotFoundException('Agendamento não encontrado.');
    return a;
  }

  async get(orgId: string, id: string) { return this.shapeOne(orgId, await this.row(orgId, id)); }

  /** Número do agendamento (o controller confere o acesso). */
  async sessionOf(orgId: string, id: string) { return (await this.row(orgId, id)).session_id || null; }

  /** O agendamento é deste contato (ou de um destes clientes)? — o bot confere antes de mexer. */
  async belongsTo(orgId: string, id: string, who: { contact_id?: string | null; customer_ids?: string[] | null }) {
    const a = await this.prisma.whatsapp_appointments.findFirst({ where: { id: String(id || ''), organization_id: orgId }, select: { contact_id: true, customer_id: true } });
    if (!a) return false;
    return Boolean((who.contact_id && a.contact_id === who.contact_id) || (a.customer_id && (who.customer_ids || []).includes(a.customer_id)));
  }

  // ================================================================ eventos / textos
  private emitAppt(orgId: string, action: string, appointment: any, extra: Record<string, unknown> = {}) {
    // agendamento de um número só vai à sala desse número (quem não vê o número não recebe nome/telefone do cliente)
    if (appointment?.session_id) this.presenter.emitSession(orgId, appointment.session_id, 'wa:appointment', { action, appointment, ...extra });
    else this.presenter.emit(orgId, 'wa:appointment', { action, appointment, ...extra });
    this.hooks.emit(`appointment_${action}`, { orgId, appointment, ...extra });
  }

  private async varsFor(orgId: string, a: any, extra: Record<string, string> = {}) {
    const shaped = a.service_name && a.date_label ? a : await this.shapeOne(orgId, a);
    const due = shaped.charge?.status === 'PENDING' ? shaped.due_cents : shaped.price_cents;
    const name = shaped.customer?.name || shaped.contact?.name || '';
    return {
      'cliente.nome': name, 'cliente.primeiro_nome': firstName(name),
      'agendamento.servico': shaped.service_name, 'agendamento.profissional': shaped.resource?.name || '', 'agendamento.data': shaped.date_label, 'agendamento.hora': shaped.time_label,
      'agendamento.valor': formatBRL(due), 'agendamento.endereco': shaped.address || '', 'agendamento.link_pagamento': shaped.charge?.pay_link || shaped.charge?.pix_code || '',
      'agendamento.pagar_ate': shaped.pay_until ? fmtTime(shaped.pay_until) : '', 'agendamento.credito': '', 'agendamento.oferta_minutos': '',
      ...extra,
    } as Record<string, string>;
  }

  /** Por qual (número, jid) falar com o cliente do agendamento. */
  private async keyFor(orgId: string, a: { session_id?: string | null; chat_id?: string | null; contact_id?: string | null; customer_id?: string | null }) {
    if (a.session_id && a.chat_id && !isGroupJid(a.chat_id)) {
      const s = await this.sessions.rowById(orgId, a.session_id);
      if (s) return { session_id: s.id, chat_id: a.chat_id };
    }
    let contactId = a.contact_id || null;
    if (!contactId && a.customer_id) contactId = (await this.prisma.whatsapp_customers.findUnique({ where: { id: a.customer_id }, select: { contact_id: true } }))?.contact_id || null;
    return contactId ? this.outbox.chatKeyForContact(orgId, contactId) : null;
  }

  /** Texto ao cliente pela FILA (dedupe `appt:<id>:<tipo>`). Nunca lança. */
  private async notifyCustomer(orgId: string, a: any, textKey: keyof SchedulingSettings['texts'], tipo: string, opts: { extraVars?: Record<string, string>; kind?: string; dedupe?: string; key?: { session_id: string; chat_id: string } | null } = {}) {
    try {
      const s = await this.settings(orgId);
      const text = fillScheduleText(s.texts[textKey], await this.varsFor(orgId, a, opts.extraVars || {}));
      if (!text) return null;
      const key = opts.key || (await this.keyFor(orgId, a));
      if (!key) { this.logger.debug(`agenda ${a.id}: sem número para avisar (${tipo})`); return null; }
      return await this.outbox.enqueue(orgId, { ...key, kind: opts.kind || `appt_${tipo}`, payload: { text, mark: { appointment: a.id } }, dedupe_key: opts.dedupe || `appt:${a.id}:${tipo}` });
    } catch (e: any) { this.logger.warn(`agenda ${a?.id}: aviso ${tipo}: ${e?.message || e}`); return null; }
  }

  // ================================================================ créditos e usos de plano
  async creditBalance(orgId: string, customerId: string) {
    const rows = await this.prisma.whatsapp_customer_credits.findMany({ where: { organization_id: orgId, customer_id: customerId, OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }] }, select: { amount_cents: true, used_cents: true } });
    return rows.reduce((s, r) => s + Math.max(0, r.amount_cents - r.used_cents), 0);
  }

  async listCredits(orgId: string, customerId: string) {
    const rows = await this.prisma.whatsapp_customer_credits.findMany({ where: { organization_id: orgId, customer_id: customerId }, orderBy: { created_at: 'desc' }, take: 100 });
    return { balance_cents: await this.creditBalance(orgId, customerId), items: rows.map((r) => ({ id: r.id, amount_cents: r.amount_cents, used_cents: r.used_cents, left_cents: Math.max(0, r.amount_cents - r.used_cents), reason: r.reason, appointment_id: r.appointment_id, expires_at: r.expires_at, created_at: r.created_at })) };
  }

  private async grantCredit(orgId: string, customerId: string | null, amount: number, reason: string, appointmentId: string | null) {
    if (!customerId || !(amount > 0)) return 0;
    await this.prisma.whatsapp_customer_credits.create({ data: { organization_id: orgId, customer_id: customerId, amount_cents: Math.round(amount), reason: reason.slice(0, 255), appointment_id: appointmentId } });
    return Math.round(amount);
  }

  /** Consome crédito FIFO dentro da transação (claim otimista por linha). Devolve quanto consumiu. */
  private async consumeCredits(tx: any, orgId: string, customerId: string, need: number) {
    if (!(need > 0)) return 0;
    const rows = await tx.whatsapp_customer_credits.findMany({ where: { organization_id: orgId, customer_id: customerId, OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }] }, orderBy: { created_at: 'asc' } });
    let used = 0;
    for (const r of rows) {
      const left = r.amount_cents - r.used_cents;
      if (left <= 0) continue;
      const take = Math.min(left, need - used);
      const u = await tx.whatsapp_customer_credits.updateMany({ where: { id: r.id, used_cents: r.used_cents }, data: { used_cents: r.used_cents + take } });
      if (u.count) used += take;
      if (used >= need) break;
    }
    return used;
  }

  /** Plano do cliente que inclui o serviço + ciclo que contém o dia do agendamento. */
  private async includedPlan(orgId: string, customerId: string, product: any, startsAt: Date) {
    const plans = normalizeIncludedPlans(product.included_in_plans);
    if (!plans.length) return null;
    const subs = await this.prisma.whatsapp_subscriptions.findMany({ where: { organization_id: orgId, customer_id: customerId, status: 'active', product_id: { in: plans.map((p) => p.plan_id) } } });
    if (!subs.length) return null;
    const planProducts = await this.prisma.whatsapp_products.findMany({ where: { id: { in: subs.map((s) => s.product_id!).filter(Boolean) } }, select: { id: true, billing: true, billing_interval_months: true } });
    const pmap = new Map(planProducts.map((p) => [p.id, p]));
    const day = brtDateStr(startsAt);
    const out: Array<{ sub: any; uses: number; cycle_start: string }> = [];
    for (const s of subs) {
      const pp = pmap.get(s.product_id!);
      const months = cycleMonthsOf(pp?.billing || s.billing, pp?.billing_interval_months) || BILLING_MONTHS[s.billing] || 1;
      let next = s.next_due_at ? s.next_due_at.toISOString().slice(0, 10) : null;
      let start = next ? addMonths(next, -months, s.due_day) : (s.started_at ? s.started_at.toISOString().slice(0, 10) : brtDateStr());
      // agendamento num ciclo futuro: avança até o ciclo que contém o dia
      for (let i = 0; next && day >= next && i < 36; i++) { start = next; next = addMonths(next, months, s.due_day); }
      out.push({ sub: s, uses: plans.find((p) => p.plan_id === s.product_id)!.uses_per_cycle, cycle_start: start });
    }
    return out;
  }

  private async returnUsage(a: any) {
    const cyc = (a.custom as any)?.usage_cycle;
    if (a.payment !== 'included' || !a.subscription_id || !a.product_id || !cyc) return;
    await this.prisma.whatsapp_subscription_usage.updateMany({ where: { subscription_id: a.subscription_id, product_id: a.product_id, cycle_start: new Date(`${cyc}T00:00:00Z`), used: { gt: 0 } }, data: { used: { decrement: 1 } } }).catch(() => undefined);
  }

  // ================================================================ reserva
  /**
   * Agendamentos que ocupam o recurso em [start, end). Chamar DEPOIS do `FOR UPDATE` na linha do recurso (é ele que
   * serializa as reservas) e numa transação READ COMMITTED (`TX_OPTS`): em REPEATABLE READ a leitura usaria a foto
   * tirada na 1ª consulta da transação, ANTES de esperar o lock, e não veria as reservas que acabaram de entrar
   * (10 reservas simultâneas numa aula de 3 vagas passavam todas).
   */
  private overlapping(tx: any, resourceId: string, start: Date, end: Date, exceptId?: string) {
    return tx.whatsapp_appointments.findMany({
      where: { resource_id: resourceId, status: { in: OCC }, starts_at: { lt: end }, ends_at: { gt: start }, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true, product_id: true, starts_at: true, ends_at: true },
    });
  }

  /** Trava (FOR UPDATE) a linha do contato e a do cliente — sempre nessa ordem, antes dos recursos. */
  private async lockWho(tx: any, contactId: string | null | undefined, customerId: string | null | undefined) {
    if (contactId) await tx.$queryRaw`SELECT id FROM whatsapp_contacts WHERE id = ${contactId} FOR UPDATE`;
    if (customerId) await tx.$queryRaw`SELECT id FROM whatsapp_customers WHERE id = ${customerId} FOR UPDATE`;
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    for (let i = 0; ; i++) {
      try { return await fn(); } catch (e: any) {
        if (i < 2 && isDeadlock(e)) { await new Promise((r) => setTimeout(r, 80 + Math.random() * 200)); continue; }
        throw e;
      }
    }
  }

  /** Resolve contato/cliente/conversa da reserva. */
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
      if (isGroupJid(key.chat_id)) throw new BadRequestException('Agendamento é só para conversas individuais.');
      if (!contactId) contactId = (await this.identity.contactOfJid(orgId, key.session_id, key.chat_id))?.id || null;
    }
    if (!customer && contactId) customer = (await this.identity.customersOfContact(orgId, contactId))[0]?.customer || null;
    if (!contactId && !customer) throw new BadRequestException('Informe o cliente, o contato ou a conversa.');
    if (!key && contactId) key = await this.outbox.chatKeyForContact(orgId, contactId).catch(() => null);
    return { customer, contactId, key };
  }

  /**
   * Reserva um horário. Ver contrato §9.3. Lança 409 `{code:'SLOT_TAKEN'|'CONTACT_BUSY'}`, 400 `{code:'CUSTOMER_REQUIRED'}`,
   * 400 com mensagem clara para fora do horário/antecedência/limite.
   */
  async book(orgId: string, input: BookInput): Promise<{ appointment: any; charge: any | null }> {
    const product = await this.requireService(orgId, input.product_id);
    const booking = normalizeBooking(product.booking);
    const start = new Date(input.starts_at as any);
    if (Number.isNaN(+start)) throw new BadRequestException('Horário inválido.');
    const dur = product.duration_minutes!, buf = product.buffer_after_minutes || 0, cap = Math.max(1, product.capacity || 1);
    const svcEnd = new Date(+start + dur * 60_000), end = new Date(+svcEnd + buf * 60_000);
    const userCustom = (await this.cf.apply(orgId, 'appointment', input.custom ?? {}, { mode: 'create', skipRequired: input.source === 'bot' || input.source === 'waitlist' })) || {};
    const staff = input.source === 'panel' && input.ignore_notice;
    if (staff) { if (+start < Date.now() - 15 * 60_000) throw new BadRequestException('Esse horário já passou.'); }
    else {
      if (+start < Date.now() + booking.min_notice_hours * 3600_000) throw new BadRequestException(booking.min_notice_hours ? `Agende com pelo menos ${booking.min_notice_hours} h de antecedência.` : 'Esse horário já passou.');
      if (brtDateStr(start) > addDaysStr(brtDateStr(), booking.max_days_ahead)) throw new BadRequestException(`Dá para agendar até ${booking.max_days_ahead} dias à frente.`);
    }
    // recursos candidatos (o escolhido ou todos que atendem, em ordem), já filtrados por grade e bloqueios
    let resources = (await this.prisma.whatsapp_resources.findMany({ where: { organization_id: orgId, active: true }, orderBy: [{ position: 'asc' }, { name: 'asc' }] })).filter((r) => this.serves(r, product.id));
    if (input.resource_id) {
      resources = resources.filter((r) => r.id === input.resource_id);
      if (!resources.length) throw new BadRequestException('Este profissional/recurso não atende esse serviço (ou está inativo).');
    }
    if (!resources.length) throw new BadRequestException('Nenhum profissional/recurso atende esse serviço.');
    const blocks = await this.blocksFor(orgId, resources.map((r) => r.id), start, svcEnd);
    let fits = resources.filter((r) => withinAvailability(normalizeAvailability(r.availability), start, svcEnd) && !blocks.some((b) => (!b.resource_id || b.resource_id === r.id) && overlaps(start, svcEnd, b.starts_at, b.ends_at)));
    if (!fits.length) throw new BadRequestException(input.resource_id ? 'Fora do horário de atendimento (ou bloqueado) nesse dia.' : 'Nenhum horário de atendimento cobre esse período.');
    // grade de horários (`slot_minutes` de cada recurso): só o encaixe da equipe pode fugir dela
    if (!staff) {
      const onGrid = fits.filter((r) => isOnGrid(normalizeAvailability(r.availability), start));
      if (!onGrid.length) throw new BadRequestException(`Esse horário não está na grade de horários${fits.length === 1 ? ` (de ${normalizeAvailability(fits[0].availability).slot_minutes} em ${normalizeAvailability(fits[0].availability).slot_minutes} minutos)` : ''}. Escolha um dos horários livres.`);
      fits = onGrid;
    }

    // quem
    const w = await this.who(orgId, input);
    let customer = w.customer;
    // forma de pagamento
    const price = product.price_cents || 0;
    let mode: 'none' | 'on_site' | 'included' | 'on_booking' | 'deposit' = price <= 0 ? 'none' : (booking.payment as any);
    if (input.payment === 'on_site' && price > 0) mode = 'on_site';
    if (input.payment === 'charge' && price > 0) mode = 'on_booking';
    // faltas demais → exige sinal
    const settings = await this.settings(orgId);
    if (mode === 'on_site' && settings.no_show_deposit_after > 0 && customer && input.payment !== 'on_site') {
      const ns = Number((customer.custom as any)?.no_shows || 0);
      if (ns >= settings.no_show_deposit_after) mode = booking.deposit_cents > 0 ? 'deposit' : 'on_booking';
    }
    let plans: Awaited<ReturnType<WhatsAppSchedulingService['includedPlan']>> = null;
    if (mode === 'included') {
      plans = customer ? await this.includedPlan(orgId, customer.id, product, start) : null;
      if (!plans?.length) mode = 'on_booking';
    }
    const base = mode === 'deposit' ? Math.min(price, booking.deposit_cents || price) : price;
    const mayCharge = mode === 'on_booking' || mode === 'deposit' || mode === 'included';
    if (mayCharge && base >= 100 && !customer) {
      if (booking.requires_customer) throw new BadRequestException({ statusCode: 400, code: 'CUSTOMER_REQUIRED', message: 'Para agendar este serviço é preciso ter cadastro. Faça o cadastro primeiro.' });
      if (!w.contactId) throw new BadRequestException('Contato não encontrado para gerar a cobrança.');
      customer = await this.crm.createCustomer(orgId, input.user_id || null, { contact_id: w.contactId, source: input.source === 'bot' ? 'bot' : input.source === 'api' ? 'api' : 'panel' }).catch(async (e) => {
        const again = (await this.identity.customersOfContact(orgId, w.contactId!))[0]?.customer; // corrida: outro processo criou
        if (again) return again;
        throw e;
      });
      customer = await this.prisma.whatsapp_customers.findUnique({ where: { id: customer.id } });
    }
    const customerId: string | null = customer?.id || null;

    const created = await this.withRetry(() => this.prisma.$transaction(async (tx: any) => {
      if (w.contactId || customerId) {
        // serializa reservas do MESMO contato/cliente (em recursos diferentes também): sem a trava, duas reservas
        // simultâneas passavam as duas pela checagem de horário ocupado. Ordem das travas: contato → cliente → recurso.
        await this.lockWho(tx, w.contactId, customerId);
        const clash = await tx.whatsapp_appointments.findFirst({ where: { organization_id: orgId, status: { in: OCC }, starts_at: { lt: svcEnd }, service_ends_at: { gt: start }, OR: [...(w.contactId ? [{ contact_id: w.contactId }] : []), ...(customerId ? [{ customer_id: customerId }] : [])] }, select: { id: true } });
        if (clash) throw conflict('CONTACT_BUSY', 'Você já tem um horário marcado nesse período.');
      }
      for (const r of fits) {
        await tx.$queryRaw`SELECT id FROM whatsapp_resources WHERE id = ${r.id} FOR UPDATE`; // serializa reservas do recurso
        const rows = await this.overlapping(tx, r.id, start, end);
        const load = maxLoad(rows.map((x: any) => ({ start: x.starts_at, end: x.ends_at, foreign: x.product_id !== product.id })), start, end);
        if (load >= cap) continue;
        // pagamento (uso do plano / crédito) DENTRO da transação
        let payment: string = mode, status = 'booked', credit = 0, subscriptionId: string | null = null, usageCycle: string | null = null, payUntil: Date | null = null;
        if (mode === 'included') {
          payment = 'on_booking';
          for (const pl of plans || []) {
            const cycle = new Date(`${pl.cycle_start}T00:00:00Z`);
            await tx.whatsapp_subscription_usage.upsert({ where: { subscription_id_product_id_cycle_start: { subscription_id: pl.sub.id, product_id: product.id, cycle_start: cycle } }, create: { organization_id: orgId, subscription_id: pl.sub.id, product_id: product.id, cycle_start: cycle, used: 0 }, update: {} });
            const u = await tx.whatsapp_subscription_usage.updateMany({ where: { subscription_id: pl.sub.id, product_id: product.id, cycle_start: cycle, used: { lt: pl.uses } }, data: { used: { increment: 1 } } });
            if (u.count) { payment = 'included'; subscriptionId = pl.sub.id; usageCycle = pl.cycle_start; break; }
          }
        }
        let due = 0;
        if (payment === 'on_booking' || payment === 'deposit') {
          const amount = payment === 'deposit' ? base : price;
          if (amount < 100) payment = 'on_site'; // menos de R$ 1,00 não vira cobrança
          else {
            if (customerId) credit = await this.consumeCredits(tx, orgId, customerId, amount);
            // crédito parcial que deixaria menos de R$ 1,00 a pagar: devolve a sobra para fechar o valor mínimo
            due = amount - credit;
            if (due > 0 && due < 100) {
              const back = 100 - due;
              await tx.whatsapp_customer_credits.create({ data: { organization_id: orgId, customer_id: customerId!, amount_cents: back, reason: 'Ajuste (valor mínimo da cobrança)', appointment_id: null } });
              credit -= back; due = 100;
            }
            if (due <= 0) payment = 'credit';
            else { status = 'pending_payment'; payUntil = new Date(Date.now() + booking.pay_within_minutes * 60_000); }
          }
        }
        return tx.whatsapp_appointments.create({
          data: {
            organization_id: orgId, session_id: w.key?.session_id || null, chat_id: w.key?.chat_id || null, customer_id: customerId, contact_id: w.contactId, resource_id: r.id, product_id: product.id,
            service_name: product.name.slice(0, 120), price_cents: price, starts_at: start, ends_at: end, service_ends_at: svcEnd, status, payment, credit_cents: credit,
            subscription_id: subscriptionId, pay_until: payUntil, source: input.source, notes: input.notes ? String(input.notes).slice(0, 5000) : null,
            custom: { ...userCustom, ...(usageCycle ? { usage_cycle: usageCycle } : {}), ...(due > 0 ? { due_cents: due } : {}), ...(input.waitlist_id ? { waitlist_id: input.waitlist_id } : {}) } as any,
            created_by: input.user_id || null, reminders: {} as any,
          },
        });
      }
      throw conflict('SLOT_TAKEN', 'Esse horário acabou de ser preenchido. Escolha outro.');
    }, TX_OPTS));

    // cobrança (fora da transação: fala com o gateway)
    let charge: any = null;
    let appt: any = created;
    if (created.status === 'pending_payment') {
      const due = Number((created.custom as any)?.due_cents) || 0;
      try {
        // `send: false`: o cliente recebe UMA mensagem — a da agenda (`pending_payment`, com link/PIX e o prazo) ou a do bot
        const payMinutes = created.pay_until ? Math.max(1, Math.ceil((+created.pay_until - Date.now()) / 60_000)) : booking.pay_within_minutes;
        charge = await this.charges.create(orgId, input.user_id || null, {
          customer_id: customerId, amount_cents: due, description: `${product.name} · ${fmtDay(start)} ${fmtTime(start)}`.slice(0, 255), kind: 'pix', due_at: brtDateStr(), __internal: true,
          __purpose: 'appointment', __expires_minutes: payMinutes,
          ...(w.key ? { session_id: w.key.session_id, chat_id: w.key.chat_id } : {}), send: false, ...(input.bot?.flow_id ? { bot: input.bot } : {}),
        }, input.source === 'bot' ? 'bot' : 'manual');
        appt = await this.prisma.whatsapp_appointments.update({ where: { id: created.id }, data: { charge_id: charge.id } });
      } catch (e: any) {
        // sem cobrança não há reserva: libera o horário e devolve o crédito usado
        await this.prisma.whatsapp_appointments.update({ where: { id: created.id }, data: { status: 'canceled', canceled_at: new Date(), cancel_by: 'system', cancel_reason: 'Falha ao gerar a cobrança' } }).catch(() => undefined);
        await this.grantCredit(orgId, customerId, created.credit_cents, 'Devolução — cobrança não gerada', created.id);
        this.logger.warn(`agenda ${created.id}: cobrança falhou: ${e?.message || e}`);
        throw new BadRequestException(`Não foi possível gerar a cobrança da reserva. ${e?.response?.message || e?.message || ''}`.trim());
      }
    }
    if (input.waitlist_id) await this.prisma.whatsapp_waitlist.updateMany({ where: { id: input.waitlist_id, organization_id: orgId }, data: { status: 'booked', appointment_id: appt.id } }).catch(() => undefined);
    const shaped = await this.shapeOne(orgId, appt);
    this.logger.log(`agenda: ${appt.id} ${appt.status} (${input.source}) ${shaped.service_name} ${shaped.date_label} ${shaped.time_label} · ${shaped.resource.name}`);
    this.emitAppt(orgId, 'booked', shaped, { by: input.source, user_id: input.user_id || null, notify_staff: settings.staff_notify });
    if (input.source !== 'bot' && input.notify !== false) {
      if (appt.status === 'pending_payment') await this.notifyCustomer(orgId, shaped, 'pending_payment', 'pending');
      else await this.notifyCustomer(orgId, shaped, input.source === 'waitlist' ? 'waitlist_booked' : 'booked', 'booked');
    }
    return { appointment: shaped, charge };
  }

  // ================================================================ pagamento (hooks das cobranças)
  /**
   * Cobrança paga. Idempotente por cobrança: o id entra em `custom.paid_charges` na MESMA escrita que soma o valor
   * (escrita condicional pelo status/`paid_cents` lidos) — o hook e a rotina de expiração podem chegar juntos.
   */
  private async onChargePaid(e: any, depth = 0): Promise<void> {
    const c = e?.charge;
    if (!c?.id) return;
    const orgId = e.orgId || c.organization_id;
    const a = await this.prisma.whatsapp_appointments.findFirst({ where: { organization_id: orgId, charge_id: c.id }, orderBy: { created_at: 'desc' } });
    if (!a) return;
    const amount = Number(c.amount_cents) || 0;
    const custom: any = (a.custom as any) || {};
    const done: string[] = Array.isArray(custom.paid_charges) ? custom.paid_charges.map(String) : [];
    if (done.includes(String(c.id))) return; // já contado
    const nextCustom = { ...custom, paid_charges: [...done, String(c.id)].slice(-20) };
    if (a.status === 'pending_payment') {
      const u = await this.prisma.whatsapp_appointments.updateMany({ where: { id: a.id, status: 'pending_payment', paid_cents: a.paid_cents }, data: { status: a.confirmed_at ? 'confirmed' : 'booked', paid_cents: { increment: amount }, pay_until: null, custom: nextCustom } });
      if (!u.count) return depth < 3 ? this.onChargePaid(e, depth + 1) : undefined; // mudou no meio: reavalia
      const shaped = await this.get(orgId, a.id);
      this.emitAppt(orgId, 'paid', shaped);
      if (a.source !== 'bot') await this.notifyCustomer(orgId, shaped, 'paid', 'paid');
      return;
    }
    if (OCC.includes(a.status) || a.status === 'done' || a.status === 'no_show') {
      const u = await this.prisma.whatsapp_appointments.updateMany({ where: { id: a.id, status: a.status, paid_cents: a.paid_cents }, data: { paid_cents: { increment: amount }, custom: nextCustom } });
      if (!u.count) return depth < 3 ? this.onChargePaid(e, depth + 1) : undefined;
      this.emitAppt(orgId, 'paid', await this.get(orgId, a.id));
      return;
    }
    // pago DEPOIS de expirar/cancelar: o horário já foi liberado → vira crédito do cliente
    const u = await this.prisma.whatsapp_appointments.updateMany({ where: { id: a.id, status: a.status, paid_cents: a.paid_cents, updated_at: a.updated_at }, data: { custom: nextCustom } });
    if (!u.count) return depth < 3 ? this.onChargePaid(e, depth + 1) : undefined;
    const granted = await this.grantCredit(orgId, a.customer_id, amount, 'Pagamento recebido depois que a reserva expirou', a.id);
    this.logger.warn(`agenda ${a.id}: cobrança ${c.id} paga com o agendamento ${a.status} → crédito ${granted}`);
    if (granted) await this.notifyCustomer(orgId, a, 'canceled', 'paid_late', { extraVars: { 'agendamento.credito': `Recebemos o pagamento depois do prazo; ficou um crédito de ${formatBRL(granted)} para o próximo agendamento.` } });
  }

  private async onChargeGone(e: any, why: 'expired' | 'canceled') {
    const c = e?.charge;
    if (!c?.id) return;
    const orgId = e.orgId || c.organization_id;
    const a = await this.prisma.whatsapp_appointments.findFirst({ where: { organization_id: orgId, charge_id: c.id, status: 'pending_payment' } });
    if (!a) return;
    await this.expireOne(orgId, a, `cobrança ${why === 'expired' ? 'expirou' : 'cancelada'}`, false);
  }

  /** pending_payment → expired: libera o horário, devolve crédito/uso, cancela a cobrança (opcional), avisa. */
  private async expireOne(orgId: string, a: any, reason: string, cancelCharge: boolean) {
    const u = await this.prisma.whatsapp_appointments.updateMany({ where: { id: a.id, status: 'pending_payment' }, data: { status: 'expired', canceled_at: new Date(), cancel_by: 'system', cancel_reason: reason.slice(0, 255), pay_until: null } });
    if (!u.count) return false;
    this.dropConfirmPending(orgId, a.id);
    await this.grantCredit(orgId, a.customer_id, a.credit_cents, 'Devolução — reserva expirou', a.id);
    await this.returnUsage(a);
    if (cancelCharge && a.charge_id) await this.charges.cancel(orgId, a.charge_id).catch((err) => this.logger.debug(`agenda ${a.id}: cancelar cobrança: ${err?.message || err}`));
    const shaped = await this.get(orgId, a.id);
    this.emitAppt(orgId, 'expired', shaped);
    if (a.source !== 'bot') await this.notifyCustomer(orgId, shaped, 'expired', 'expired');
    this.kickWaitlist(orgId, a.product_id);
    return true;
  }

  // ================================================================ ações
  private async transition(orgId: string, id: string, from: string[], data: any, action: string, extra: Record<string, unknown> = {}) {
    const a = await this.row(orgId, id);
    if (!from.includes(a.status)) throw new BadRequestException(`Não dá para fazer isso com um agendamento ${STATUS_PT[a.status] || a.status}.`);
    const u = await this.prisma.whatsapp_appointments.updateMany({ where: { id: a.id, status: a.status }, data });
    if (!u.count) throw new BadRequestException('O agendamento mudou enquanto você mexia. Atualize a tela.');
    // saiu de agendado/confirmado (atendimento, concluído, falta…): o "1/2" do lembrete não vale mais para ele
    if (!['booked', 'pending_payment'].includes(data.status || a.status)) this.dropConfirmPending(orgId, a.id);
    const shaped = await this.get(orgId, id);
    this.emitAppt(orgId, action, shaped, extra);
    return { before: a, appointment: shaped };
  }

  /** Confirmação de presença. Em `pending_payment` só marca (vira `confirmed` quando pagar). */
  async confirm(orgId: string, id: string, opts: { by?: ActBy; notify?: boolean } = {}) {
    const a = await this.row(orgId, id);
    if (a.status === 'confirmed') return this.shapeOne(orgId, a);
    if (a.status === 'pending_payment') {
      await this.prisma.whatsapp_appointments.update({ where: { id }, data: { confirmed_at: new Date() } });
      const shaped = await this.get(orgId, id);
      this.emitAppt(orgId, 'confirmed', shaped, { by: opts.by || 'staff' });
      return shaped;
    }
    const r = await this.transition(orgId, id, ['booked'], { status: 'confirmed', confirmed_at: new Date() }, 'confirmed', { by: opts.by || 'staff' });
    this.dropConfirmPending(orgId, id);
    if (opts.notify) await this.notifyCustomer(orgId, r.appointment, 'confirmed', 'confirmed');
    return r.appointment;
  }

  async start(orgId: string, id: string) {
    const r = await this.transition(orgId, id, ['booked', 'confirmed', 'no_show', 'pending_payment'], { status: 'in_progress', started_at: new Date() }, 'started');
    if (r.before.status === 'no_show') await this.bumpNoShows(orgId, r.before.customer_id, -1); // a falta (automática) foi engano: ele veio
    return r.appointment;
  }

  async done(orgId: string, id: string) {
    const r = await this.transition(orgId, id, ['booked', 'confirmed', 'in_progress', 'no_show'], { status: 'done', done_at: new Date() }, 'done');
    if (r.before.status === 'no_show') await this.bumpNoShows(orgId, r.before.customer_id, -1); // correção de uma falta automática
    return r.appointment;
  }

  /** Falta. `auto` (runner) não manda texto ao cliente — a equipe confere e corrige se ele veio. */
  async noShow(orgId: string, id: string, opts: { by?: ActBy; notify?: boolean } = {}) {
    const cur = await this.row(orgId, id);
    if (+new Date(cur.starts_at) > Date.now()) throw new BadRequestException('A falta só pode ser marcada depois do horário de início.');
    const r = await this.transition(orgId, id, ['booked', 'confirmed', 'pending_payment'], { status: 'no_show' }, 'no_show', { by: opts.by || 'staff', notify_staff: (await this.settings(orgId)).staff_notify });
    await this.bumpNoShows(orgId, r.before.customer_id, +1);
    if (r.before.status === 'pending_payment' && r.before.charge_id) await this.charges.cancel(orgId, r.before.charge_id).catch(() => undefined);
    if (opts.notify !== false && opts.by !== 'system') await this.notifyCustomer(orgId, r.appointment, 'no_show', 'no_show');
    return r.appointment;
  }

  private async bumpNoShows(orgId: string, customerId: string | null, delta: number) {
    if (!customerId) return;
    const c = await this.prisma.whatsapp_customers.findFirst({ where: { id: customerId, organization_id: orgId }, select: { custom: true } });
    if (!c) return;
    const custom = { ...((c.custom as any) || {}) };
    custom.no_shows = String(Math.max(0, (Number(custom.no_shows) || 0) + delta));
    await this.prisma.whatsapp_customers.update({ where: { id: customerId }, data: { custom } }).catch(() => undefined);
  }

  /**
   * Cancela. Dentro do prazo gratuito (antes de `starts_at − cancel_free_hours`): o que foi pago volta inteiro
   * como crédito (política `refund` = estorno; sem estorno no gateway hoje → crédito com aviso). Fora do prazo:
   * política do serviço (`credit` devolve, `keep` fica, `refund` → crédito). Plano incluso devolve o uso
   * (exceto `keep` fora do prazo). `policy_override` (equipe): credit | keep | refund | free.
   */
  async cancel(orgId: string, id: string, opts: { by: ActBy; reason?: string | null; policy_override?: string | null; notify?: boolean; user_id?: string | null }) {
    const a = await this.row(orgId, id);
    const allowed = opts.by === 'staff' || opts.by === 'system' ? OCC : ['pending_payment', 'booked', 'confirmed'];
    if (!allowed.includes(a.status)) throw new BadRequestException(`Não dá para cancelar um agendamento ${STATUS_PT[a.status] || a.status}.`);
    const product = a.product_id ? await this.prisma.whatsapp_products.findUnique({ where: { id: a.product_id } }) : null;
    const booking = normalizeBooking(product?.booking);
    const free = opts.policy_override === 'free' || opts.by === 'system' || Date.now() <= +cancelDeadline(a.starts_at, booking.cancel_free_hours);
    let policy: string = free ? 'credit' : booking.cancel_policy;
    if (opts.policy_override && opts.by === 'staff' && ['credit', 'keep', 'refund'].includes(opts.policy_override)) policy = opts.policy_override;
    const u = await this.prisma.whatsapp_appointments.updateMany({ where: { id: a.id, status: a.status }, data: { status: 'canceled', canceled_at: new Date(), cancel_by: opts.by, cancel_reason: opts.reason ? String(opts.reason).slice(0, 255) : null, pay_until: null } });
    if (!u.count) throw new BadRequestException('O agendamento mudou enquanto você cancelava. Atualize a tela.');
    let credit = 0;
    if (a.status === 'pending_payment') {
      if (a.charge_id) await this.charges.cancel(orgId, a.charge_id).catch(() => undefined);
      credit = await this.grantCredit(orgId, a.customer_id, a.credit_cents, 'Devolução — agendamento cancelado', a.id);
      await this.returnUsage(a);
    } else {
      const back = (a.paid_cents || 0) + (a.credit_cents || 0);
      if (policy !== 'keep' && back > 0) {
        credit = await this.grantCredit(orgId, a.customer_id, back, policy === 'refund' ? 'Cancelamento — estorno pedido (gateway sem estorno automático: crédito)' : 'Cancelamento de agendamento', a.id);
        if (policy === 'refund') { this.logger.warn(`agenda ${a.id}: estorno pedido — sem estorno automático no gateway; virou crédito de ${back}`); await this.patchCustom(a.id, { refund_requested: true }); }
      }
      if (policy !== 'keep' || free) await this.returnUsage(a);
    }
    this.dropConfirmPending(orgId, a.id);
    await this.outbox.cancelPending(orgId, { dedupe_prefix: `appt:${a.id}:` }).catch(() => undefined);
    const shaped = await this.get(orgId, a.id);
    this.emitAppt(orgId, 'canceled', shaped, { by: opts.by, free, credit_cents: credit, user_id: opts.user_id || null, notify_staff: (await this.settings(orgId)).staff_notify });
    const creditText = credit > 0 ? `Ficou um crédito de ${formatBRL(credit)} para usar no próximo agendamento.` : '';
    if (opts.by === 'staff' && opts.notify !== false) await this.notifyCustomer(orgId, shaped, free ? 'canceled' : 'canceled_late', 'canceled', { extraVars: { 'agendamento.credito': creditText } });
    this.kickWaitlist(orgId, a.product_id);
    return { ...shaped, credit_granted_cents: credit, free };
  }

  private async patchCustom(id: string, patch: Record<string, unknown>) {
    const a = await this.prisma.whatsapp_appointments.findUnique({ where: { id }, select: { custom: true } });
    await this.prisma.whatsapp_appointments.update({ where: { id }, data: { custom: { ...((a?.custom as any) || {}), ...patch } as any } }).catch(() => undefined);
  }

  /**
   * Remarca: reserva o novo horário (mesma transação/travas do `book`, ignorando o próprio agendamento) e cria
   * uma linha NOVA (`rescheduled_from`) com o pagamento herdado; a antiga vira `canceled` ('remarcado').
   * Cliente: até `reschedule_limit` remarcações e respeita antecedência/limite; equipe ignora o limite.
   */
  async reschedule(orgId: string, id: string, opts: { starts_at: string | Date; resource_id?: string | null; by: ActBy; notify?: boolean; user_id?: string | null }) {
    const a = await this.row(orgId, id);
    if (!['pending_payment', 'booked', 'confirmed'].includes(a.status)) throw new BadRequestException(`Não dá para remarcar um agendamento ${STATUS_PT[a.status] || a.status}.`);
    if (!a.product_id) throw new BadRequestException('O serviço deste agendamento não existe mais.');
    const product = await this.requireService(orgId, a.product_id);
    const booking = normalizeBooking(product.booking);
    if (opts.by === 'customer') {
      if ((a.reschedules || 0) >= booking.reschedule_limit) throw new BadRequestException(booking.reschedule_limit ? `Este agendamento já foi remarcado ${a.reschedules}x (limite ${booking.reschedule_limit}).` : 'Este serviço não permite remarcar.');
      if (+new Date(a.starts_at) <= Date.now()) throw new BadRequestException('O horário já começou; não dá mais para remarcar.');
    }
    const start = new Date(opts.starts_at as any);
    if (Number.isNaN(+start)) throw new BadRequestException('Horário inválido.');
    const dur = product.duration_minutes!, buf = product.buffer_after_minutes || 0, cap = Math.max(1, product.capacity || 1);
    const svcEnd = new Date(+start + dur * 60_000), end = new Date(+svcEnd + buf * 60_000);
    if (opts.by === 'staff') { if (+start < Date.now() - 15 * 60_000) throw new BadRequestException('Esse horário já passou.'); }
    else {
      if (+start < Date.now() + booking.min_notice_hours * 3600_000) throw new BadRequestException(`Escolha um horário com pelo menos ${booking.min_notice_hours} h de antecedência.`);
      if (brtDateStr(start) > addDaysStr(brtDateStr(), booking.max_days_ahead)) throw new BadRequestException(`Dá para agendar até ${booking.max_days_ahead} dias à frente.`);
    }
    let resources = (await this.prisma.whatsapp_resources.findMany({ where: { organization_id: orgId, active: true }, orderBy: [{ position: 'asc' }, { name: 'asc' }] })).filter((r) => this.serves(r, product.id));
    const wanted = opts.resource_id || (opts.resource_id === undefined ? a.resource_id : null);
    if (wanted) { const pref = resources.filter((r) => r.id === wanted); resources = opts.resource_id ? pref : [...pref, ...resources.filter((r) => r.id !== wanted)]; }
    const blocks = await this.blocksFor(orgId, resources.map((r) => r.id), start, svcEnd);
    let fits = resources.filter((r) => withinAvailability(normalizeAvailability(r.availability), start, svcEnd) && !blocks.some((b) => (!b.resource_id || b.resource_id === r.id) && overlaps(start, svcEnd, b.starts_at, b.ends_at)));
    if (!fits.length) throw new BadRequestException('Fora do horário de atendimento (ou bloqueado) nesse período.');
    if (opts.by !== 'staff') {
      fits = fits.filter((r) => isOnGrid(normalizeAvailability(r.availability), start));
      if (!fits.length) throw new BadRequestException('Esse horário não está na grade de horários. Escolha um dos horários livres.');
    }
    const created = await this.withRetry(() => this.prisma.$transaction(async (tx: any) => {
      // trava o próprio agendamento: duas remarcações simultâneas não podem criar duas linhas novas
      const cur: any[] = await tx.$queryRaw`SELECT id FROM whatsapp_appointments WHERE id = ${a.id} AND status = ${a.status} FOR UPDATE`;
      if (!cur.length) throw new BadRequestException('O agendamento mudou enquanto você remarcava. Atualize a tela.');
      if (a.contact_id || a.customer_id) {
        await this.lockWho(tx, a.contact_id, a.customer_id);
        const clash = await tx.whatsapp_appointments.findFirst({ where: { organization_id: orgId, id: { not: a.id }, status: { in: OCC }, starts_at: { lt: svcEnd }, service_ends_at: { gt: start }, OR: [...(a.contact_id ? [{ contact_id: a.contact_id }] : []), ...(a.customer_id ? [{ customer_id: a.customer_id }] : [])] }, select: { id: true } });
        if (clash) throw conflict('CONTACT_BUSY', 'Você já tem outro horário marcado nesse período.');
      }
      for (const r of fits) {
        await tx.$queryRaw`SELECT id FROM whatsapp_resources WHERE id = ${r.id} FOR UPDATE`;
        const rows = await this.overlapping(tx, r.id, start, end, a.id);
        if (maxLoad(rows.map((x: any) => ({ start: x.starts_at, end: x.ends_at, foreign: x.product_id !== product.id })), start, end) >= cap) continue;
        const old = await tx.whatsapp_appointments.updateMany({ where: { id: a.id, status: a.status }, data: { status: 'canceled', canceled_at: new Date(), cancel_by: opts.by, cancel_reason: 'remarcado', pay_until: null } });
        if (!old.count) throw new BadRequestException('O agendamento mudou enquanto você remarcava. Atualize a tela.');
        return tx.whatsapp_appointments.create({
          data: {
            organization_id: orgId, session_id: a.session_id, chat_id: a.chat_id, customer_id: a.customer_id, contact_id: a.contact_id, resource_id: r.id, product_id: a.product_id,
            service_name: a.service_name, price_cents: a.price_cents, starts_at: start, ends_at: end, service_ends_at: svcEnd, status: a.status === 'confirmed' ? 'booked' : a.status, payment: a.payment,
            charge_id: a.charge_id, paid_cents: a.paid_cents, credit_cents: a.credit_cents, subscription_id: a.subscription_id, pay_until: a.pay_until, source: a.source,
            rescheduled_from: a.id, reschedules: (a.reschedules || 0) + 1, notes: a.notes, custom: (a.custom as any) || {}, created_by: opts.user_id || a.created_by, reminders: {} as any,
          },
        });
      }
      throw conflict('SLOT_TAKEN', 'Esse horário acabou de ser preenchido. Escolha outro.');
    }, TX_OPTS));
    this.dropConfirmPending(orgId, a.id);
    await this.outbox.cancelPending(orgId, { dedupe_prefix: `appt:${a.id}:` }).catch(() => undefined);
    const [shaped, old] = await Promise.all([this.get(orgId, created.id), this.get(orgId, a.id)]);
    this.emitAppt(orgId, 'rescheduled', shaped, { from: old, by: opts.by });
    if (opts.by === 'staff' && opts.notify !== false) await this.notifyCustomer(orgId, shaped, 'rescheduled', 'rescheduled');
    this.kickWaitlist(orgId, a.product_id);
    return shaped;
  }

  /** Gera (ou reenvia) a cobrança do que falta pagar. */
  async charge(orgId: string, id: string, userId: string | null) {
    const a = await this.row(orgId, id);
    if (!OCC.includes(a.status) && a.status !== 'done') throw new BadRequestException(`Não dá para cobrar um agendamento ${STATUS_PT[a.status] || a.status}.`);
    if (a.charge_id) {
      const c = await this.prisma.whatsapp_charges.findUnique({ where: { id: a.charge_id }, select: { status: true } });
      if (c?.status === 'PENDING') { const charge = await this.charges.resend(orgId, a.charge_id); return { appointment: await this.get(orgId, id), charge }; }
    }
    const due = Math.max(0, a.price_cents - a.paid_cents - a.credit_cents);
    if (due < 100) throw new BadRequestException('Não há valor a cobrar (mínimo R$ 1,00).');
    let customerId = a.customer_id;
    if (!customerId) {
      if (!a.contact_id) throw new BadRequestException('Agendamento sem cliente/contato para cobrar.');
      const existing = (await this.identity.customersOfContact(orgId, a.contact_id))[0]?.customer;
      customerId = existing?.id || (await this.crm.createCustomer(orgId, userId, { contact_id: a.contact_id, source: 'panel' })).id;
      await this.prisma.whatsapp_appointments.update({ where: { id }, data: { customer_id: customerId } });
    }
    const key = a.session_id && a.chat_id ? { session_id: a.session_id, chat_id: a.chat_id } : null;
    const payMinutes = a.pay_until && +a.pay_until > Date.now() ? Math.ceil((+a.pay_until - Date.now()) / 60_000) : undefined;
    const charge = await this.charges.create(orgId, userId, { customer_id: customerId, amount_cents: due, description: `${a.service_name} · ${fmtDay(a.starts_at)} ${fmtTime(a.starts_at)}`.slice(0, 255), kind: 'pix', due_at: brtDateStr(), __internal: true, __purpose: 'appointment', ...(payMinutes ? { __expires_minutes: payMinutes } : {}), ...(key || {}), send: true }, 'manual');
    await this.prisma.whatsapp_appointments.update({ where: { id }, data: { charge_id: charge.id } });
    const shaped = await this.get(orgId, id);
    this.emitAppt(orgId, 'updated', shaped);
    return { appointment: shaped, charge };
  }

  async update(orgId: string, id: string, dto: { notes?: string | null; custom?: Record<string, unknown> | null }) {
    const a = await this.row(orgId, id);
    const data: any = {};
    if (dto.notes !== undefined) data.notes = dto.notes ? String(dto.notes).slice(0, 5000) : null;
    if (dto.custom !== undefined) {
      // chaves internas (uso do plano, valor devido, lista de espera) não vêm do painel
      // (Fase 7: tipos e obrigatórios dos campos personalizados de agendamento; as reservadas ficam como estão)
      data.custom = await this.cf.apply(orgId, 'appointment', dto.custom && typeof dto.custom === 'object' ? dto.custom : {}, { mode: 'update', current: a.custom });
    }
    await this.prisma.whatsapp_appointments.update({ where: { id }, data });
    const shaped = await this.get(orgId, id);
    this.emitAppt(orgId, 'updated', shaped);
    return shaped;
  }

  // ================================================================ consultas
  /** Próximos agendamentos (que ocupam) do contato e/ou do cliente — o bot usa no "meus agendamentos". */
  async upcomingOf(orgId: string, q: { customer_id?: string | null; contact_id?: string | null; limit?: number }) {
    const or: any[] = [];
    if (q.contact_id) or.push({ contact_id: q.contact_id });
    if (q.customer_id) or.push({ customer_id: q.customer_id });
    if (!or.length) return [];
    const rows = await this.prisma.whatsapp_appointments.findMany({ where: { organization_id: orgId, status: { in: OCC }, service_ends_at: { gt: new Date() }, OR: or }, orderBy: { starts_at: 'asc' }, take: Math.min(20, Math.max(1, q.limit || 5)) });
    return this.shapeMany(orgId, rows);
  }

  /** Lista do painel. `allowed` = números do usuário (null = todos); agendamento sem número aparece para todos. */
  async list(orgId: string, q: any = {}, allowed: Set<string> | null = null) {
    const page = Math.max(1, parseInt(String(q.page || 1), 10) || 1);
    const size = Math.min(500, Math.max(10, parseInt(String(q.page_size || 100), 10) || 100));
    const where: any = { organization_id: orgId };
    const and: any[] = [];
    if (q.from) where.starts_at = { ...(where.starts_at || {}), gte: this.parseDayOrIso(q.from, '00:00') };
    if (q.to) where.starts_at = { ...(where.starts_at || {}), lt: this.parseDayOrIso(q.to, '24:00') };
    if (q.resource_id) where.resource_id = String(q.resource_id);
    if (q.customer_id) where.customer_id = String(q.customer_id);
    if (q.contact_id) where.contact_id = String(q.contact_id);
    if (q.product_id) where.product_id = String(q.product_id);
    if (q.status) {
      const st = String(q.status) === 'active' ? OCC : String(q.status).split(',').map((s) => s.trim()).filter((s) => (APPT_STATUSES as readonly string[]).includes(s));
      if (st.length) where.status = { in: st };
    }
    if (q.session_id) {
      if (allowed !== null && !allowed.has(String(q.session_id))) return { items: [], total: 0, page, page_size: size, pages: 1 };
      where.session_id = String(q.session_id);
    } else if (allowed !== null) and.push({ OR: [{ session_id: null }, ...(allowed.size ? [{ session_id: { in: [...allowed] } }] : [])] });
    const term = String(q.q || '').trim().slice(0, 80);
    if (term) {
      const digits = term.replace(/\D/g, '');
      const [custs, conts] = await Promise.all([
        this.prisma.whatsapp_customers.findMany({ where: { organization_id: orgId, name: { contains: term } }, select: { id: true }, take: 200 }),
        this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, OR: [{ name: { contains: term } }, { push_name: { contains: term } }, ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : [])] }, select: { id: true }, take: 200 }),
      ]);
      and.push({ OR: [{ service_name: { contains: term } }, ...(custs.length ? [{ customer_id: { in: custs.map((c) => c.id) } }] : []), ...(conts.length ? [{ contact_id: { in: conts.map((c) => c.id) } }] : [])] });
    }
    if (and.length) where.AND = and;
    const desc = q.order === 'desc';
    const [total, rows] = await Promise.all([this.prisma.whatsapp_appointments.count({ where }), this.prisma.whatsapp_appointments.findMany({ where, orderBy: { starts_at: desc ? 'desc' : 'asc' }, skip: (page - 1) * size, take: size })]);
    return { items: await this.shapeMany(orgId, rows), total, page, page_size: size, pages: Math.max(1, Math.ceil(total / size)) };
  }

  /** Contagens de um dia (BRT): por status e por recurso. */
  async counts(orgId: string, date?: string | null, allowed: Set<string> | null = null) {
    const day = date && isDay(date) ? date : brtDateStr();
    const where: any = { organization_id: orgId, starts_at: { gte: brtToUtc(day, '00:00'), lt: brtToUtc(day, '24:00') } };
    if (allowed !== null) where.OR = [{ session_id: null }, ...(allowed.size ? [{ session_id: { in: [...allowed] } }] : [])];
    const [byStatus, byResource] = await Promise.all([
      this.prisma.whatsapp_appointments.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.whatsapp_appointments.groupBy({ by: ['resource_id'], where: { ...where, status: { in: OCC } }, _count: { _all: true } }),
    ]);
    const by_status: Record<string, number> = Object.fromEntries(APPT_STATUSES.map((s) => [s, 0]));
    for (const g of byStatus) by_status[g.status] = g._count._all;
    // números no topo (o front lê `confirmed`, `pending_payment`…) + detalhamento
    return { ...by_status, date: day, label: fmtDay(day), total: Object.values(by_status).reduce((s, n) => s + n, 0), active: OCC.reduce((s, k) => s + (by_status[k] || 0), 0), by_status, by_resource: byResource.map((g) => ({ resource_id: g.resource_id, count: g._count._all })) };
  }

  /** Relatório (ocupação, serviços, faltas, cancelamentos, ticket médio, horários de pico). */
  async report(orgId: string, q: { from?: string; to?: string } = {}, allowed: Set<string> | null = null) {
    const to = q.to && isDay(q.to) ? q.to : brtDateStr();
    let from = q.from && isDay(q.from) ? q.from : addDaysStr(to, -29);
    if (from > to) from = to;
    if (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) > 366 * DAY_MS) from = addDaysStr(to, -366);
    const start = brtToUtc(from, '00:00'), endAt = brtToUtc(to, '24:00');
    const [rows, resources, blocks] = await Promise.all([
      this.prisma.whatsapp_appointments.findMany({ where: { organization_id: orgId, starts_at: { gte: start, lt: endAt }, ...(allowed !== null ? { OR: [{ session_id: null }, ...(allowed.size ? [{ session_id: { in: [...allowed] } }] : [])] } : {}) }, select: { resource_id: true, product_id: true, service_name: true, status: true, cancel_reason: true, starts_at: true, service_ends_at: true, paid_cents: true, credit_cents: true }, take: 50_000 }),
      this.prisma.whatsapp_resources.findMany({ where: { organization_id: orgId }, orderBy: [{ position: 'asc' }, { name: 'asc' }] }),
      this.prisma.whatsapp_resource_blocks.findMany({ where: { organization_id: orgId, starts_at: { lt: endAt }, ends_at: { gt: start } } }),
    ]);
    const real = rows.filter((r) => r.cancel_reason !== 'remarcado'); // remarcação não é cancelamento
    const worked = ['booked', 'confirmed', 'in_progress', 'done'];
    const mins = (r: any) => Math.round((+r.service_ends_at - +r.starts_at) / 60_000);
    const days: string[] = [];
    for (let d = from; d <= to; d = addDaysStr(d, 1)) days.push(d);
    const by_resource = resources.map((res) => {
      const av = normalizeAvailability(res.availability);
      let available = 0;
      for (const d of days) {
        for (const iv of av.weekly[String(weekdayOf(d))] || []) {
          const a = +brtToUtc(d, iv.start), b = +brtToUtc(d, iv.end);
          let m = (b - a) / 60_000;
          for (const bl of blocks) if (!bl.resource_id || bl.resource_id === res.id) m -= Math.max(0, Math.min(b, +bl.ends_at) - Math.max(a, +bl.starts_at)) / 60_000;
          available += Math.max(0, m);
        }
      }
      const booked = real.filter((r) => r.resource_id === res.id && worked.includes(r.status)).reduce((s, r) => s + mins(r), 0);
      return { resource: { id: res.id, name: res.name, color: res.color || null, active: res.active }, booked_minutes: booked, available_minutes: Math.round(available), occupancy: available > 0 ? Math.round((booked / available) * 1000) / 1000 : 0 };
    });
    const svc = new Map<string, { service: { id: string | null; name: string }; count: number; revenue_cents: number }>();
    for (const r of real) {
      if (!worked.includes(r.status) && r.status !== 'no_show') continue;
      const k = r.product_id || r.service_name;
      const cur = svc.get(k) || { service: { id: r.product_id, name: r.service_name }, count: 0, revenue_cents: 0 };
      cur.count++; cur.revenue_cents += (r.paid_cents || 0) + (r.credit_cents || 0);
      svc.set(k, cur);
    }
    const n = (s: string) => real.filter((r) => r.status === s).length;
    const done = n('done'), noShow = n('no_show'), canceled = n('canceled'), expired = n('expired');
    const revenue = real.reduce((s, r) => s + (r.paid_cents || 0) + (r.credit_cents || 0), 0);
    const paidCount = real.filter((r) => (r.paid_cents || 0) + (r.credit_cents || 0) > 0).length;
    const peak = new Array(24).fill(0);
    for (const r of real) if (worked.includes(r.status) || r.status === 'no_show') peak[Math.floor(brtMinuteOf(r.starts_at) / 60)]++;
    return {
      from, to, by_resource, by_service: [...svc.values()].sort((a, b) => b.count - a.count),
      no_show_rate: done + noShow ? Math.round((noShow / (done + noShow)) * 1000) / 1000 : 0,
      cancel_rate: real.length ? Math.round((canceled / real.length) * 1000) / 1000 : 0,
      avg_ticket_cents: paidCount ? Math.round(revenue / paidCount) : 0,
      peak_hours: peak.map((count, hour) => ({ hour, count })).filter((x) => x.count > 0),
      totals: { appointments: real.length, done, no_show: noShow, canceled, expired, active: real.filter((r) => OCC.includes(r.status)).length, revenue_cents: revenue, booked_minutes: by_resource.reduce((s, r) => s + r.booked_minutes, 0), available_minutes: by_resource.reduce((s, r) => s + r.available_minutes, 0) },
      truncated: rows.length >= 50_000,
    };
  }

  // ================================================================ lista de espera
  private async shapeWaitlist(orgId: string, rows: any[]) {
    if (!rows.length) return [] as any[];
    const ids = (k: string) => [...new Set(rows.map((r) => r[k]).filter(Boolean))] as string[];
    const [prods, res, custs, conts] = await Promise.all([
      this.prisma.whatsapp_products.findMany({ where: { id: { in: ids('product_id') } }, select: { id: true, name: true } }),
      this.prisma.whatsapp_resources.findMany({ where: { id: { in: [...ids('resource_id'), ...ids('offered_resource_id')] } }, select: { id: true, name: true } }),
      ids('customer_id').length ? this.prisma.whatsapp_customers.findMany({ where: { id: { in: ids('customer_id') } }, select: { id: true, name: true, contact_id: true } }) : Promise.resolve([] as any[]),
      ids('contact_id').length ? this.prisma.whatsapp_contacts.findMany({ where: { id: { in: ids('contact_id') } }, select: { id: true, name: true, push_name: true, phone: true } }) : Promise.resolve([] as any[]),
    ]);
    // telefone do cliente = o do contato principal; conversa (uuid) por número + jid
    const custContactIds = custs.map((c: any) => c.contact_id).filter((x: string) => x && !ids('contact_id').includes(x));
    const extraConts = custContactIds.length ? await this.prisma.whatsapp_contacts.findMany({ where: { id: { in: custContactIds } }, select: { id: true, name: true, push_name: true, phone: true } }) : [];
    const pairs = rows.filter((r) => r.session_id && r.chat_id).map((r) => ({ session_id: r.session_id, chat_id: r.chat_id }));
    const chats = pairs.length ? await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, OR: pairs }, select: { id: true, session_id: true, chat_id: true } }) : [];
    const chm = new Map(chats.map((c) => [`${c.session_id}|${c.chat_id}`, c.id] as [string, string]));
    const pm = new Map(prods.map((p) => [p.id, p.name])), rm = new Map(res.map((r) => [r.id, r.name]));
    const cm = new Map(custs.map((c: any) => [c.id, c])), km = new Map([...conts, ...extraConts].map((c: any) => [c.id, c]));
    return rows.map((w) => {
      const k: any = w.contact_id ? km.get(w.contact_id) : null;
      const c: any = w.customer_id ? cm.get(w.customer_id) : null;
      return {
        id: w.id, status: w.status, product_id: w.product_id, service_name: pm.get(w.product_id) || '—', resource_id: w.resource_id || null, resource_name: w.resource_id ? rm.get(w.resource_id) || null : null,
        resource: w.resource_id ? { id: w.resource_id, name: rm.get(w.resource_id) || '—' } : null,
        date_from: w.date_from.toISOString().slice(0, 10), date_to: w.date_to.toISOString().slice(0, 10), period: w.period,
        contact: k ? { id: k.id, name: k.name || k.push_name || null, phone: k.phone || null } : null, customer: c ? { id: c.id, name: c.name, phone: (km.get(c.contact_id) as any)?.phone || null } : null,
        session_id: w.session_id || null, jid: w.chat_id || null, chat_id: (w.session_id && w.chat_id && chm.get(`${w.session_id}|${w.chat_id}`)) || null,
        offered_starts_at: w.offered_starts_at || null, offered_label: w.offered_starts_at ? `${fmtDay(w.offered_starts_at)} ${fmtTime(w.offered_starts_at)}` : null,
        offered_resource_id: w.offered_resource_id || null, offered_resource_name: w.offered_resource_id ? rm.get(w.offered_resource_id) || null : null,
        offered_at: w.offered_at || null, expires_at: w.expires_at || null, appointment_id: w.appointment_id || null, created_at: w.created_at,
      };
    });
  }

  async waitlistList(orgId: string, q: any = {}, allowed: Set<string> | null = null) {
    const where: any = { organization_id: orgId };
    if (allowed !== null) where.OR = [{ session_id: null }, ...(allowed.size ? [{ session_id: { in: [...allowed] } }] : [])];
    if (q.status) where.status = { in: String(q.status).split(',').map((s) => s.trim()) };
    else where.status = { in: ['waiting', 'offered'] };
    if (q.product_id) where.product_id = String(q.product_id);
    if (q.contact_id) where.contact_id = String(q.contact_id);
    if (q.customer_id) where.customer_id = String(q.customer_id);
    const page = Math.max(1, parseInt(String(q.page || 1), 10) || 1);
    const size = Math.min(500, Math.max(10, parseInt(String(q.page_size || 100), 10) || 100));
    const [total, rows] = await Promise.all([this.prisma.whatsapp_waitlist.count({ where }), this.prisma.whatsapp_waitlist.findMany({ where, orderBy: { created_at: 'asc' }, skip: (page - 1) * size, take: size })]);
    return { items: await this.shapeWaitlist(orgId, rows), total, page, page_size: size, pages: Math.max(1, Math.ceil(total / size)) };
  }

  /** Entra na lista de espera (o mesmo contato + serviço = atualiza a entrada aberta). */
  async waitlistJoin(orgId: string, input: { product_id: string; resource_id?: string | null; date_from?: string | null; date_to?: string | null; period?: string | null; customer_id?: string | null; contact_id?: string | null; session_id?: string | null; chat_id?: string | null }) {
    const product = await this.requireService(orgId, input.product_id);
    const booking = normalizeBooking(product.booking);
    if (input.resource_id) { const r = await this.requireResource(orgId, input.resource_id); if (!this.serves(r, product.id)) throw new BadRequestException('Este recurso não atende esse serviço.'); }
    const w = await this.who(orgId, input);
    if (!w.contactId) throw new BadRequestException('Contato não encontrado.');
    const today = brtDateStr();
    const from = input.date_from && isDay(input.date_from) && input.date_from > today ? input.date_from : today;
    const maxTo = addDaysStr(today, booking.max_days_ahead);
    let to = input.date_to && isDay(input.date_to) ? input.date_to : addDaysStr(from, 14);
    if (to > maxTo) to = maxTo;
    if (to < from) to = from;
    const period = (WAIT_PERIODS as readonly string[]).includes(String(input.period)) ? String(input.period) : 'any';
    const data = { resource_id: input.resource_id || null, date_from: new Date(`${from}T00:00:00Z`), date_to: new Date(`${to}T00:00:00Z`), period, customer_id: w.customer?.id || null, session_id: w.key?.session_id || null, chat_id: w.key?.chat_id || null };
    const open = await this.prisma.whatsapp_waitlist.findFirst({ where: { organization_id: orgId, contact_id: w.contactId, product_id: product.id, status: { in: ['waiting', 'offered'] } } });
    let row: any;
    if (open) row = await this.prisma.whatsapp_waitlist.update({ where: { id: open.id }, data: { ...data, ...(open.status === 'offered' ? {} : { status: 'waiting' }) } });
    else {
      const n = await this.prisma.whatsapp_waitlist.count({ where: { organization_id: orgId, contact_id: w.contactId, status: { in: ['waiting', 'offered'] } } });
      if (n >= 5) throw new BadRequestException('Você já está em 5 listas de espera.');
      row = await this.prisma.whatsapp_waitlist.create({ data: { organization_id: orgId, contact_id: w.contactId, product_id: product.id, status: 'waiting', ...data } });
    }
    const [shaped] = await this.shapeWaitlist(orgId, [row]);
    this.emitWaitlist(orgId, row.session_id, { waitlist: shaped });
    this.kickWaitlist(orgId, product.id);
    return shaped;
  }

  async waitlistRemove(orgId: string, id: string) {
    const w = await this.prisma.whatsapp_waitlist.findFirst({ where: { id, organization_id: orgId }, select: { session_id: true } });
    const r = await this.prisma.whatsapp_waitlist.updateMany({ where: { id, organization_id: orgId, status: { in: ['waiting', 'offered'] } }, data: { status: 'canceled' } });
    if (!r.count) throw new NotFoundException('Entrada da lista de espera não encontrada (ou já encerrada).');
    this.dropOffer(orgId, id);
    this.emitWaitlist(orgId, w?.session_id, { waitlist_id: id });
    return { ok: true };
  }

  /** Número da entrada da lista de espera (o controller confere o acesso). */
  async waitlistSessionOf(orgId: string, id: string) {
    const w = await this.prisma.whatsapp_waitlist.findFirst({ where: { id: String(id || ''), organization_id: orgId }, select: { session_id: true } });
    if (!w) throw new NotFoundException('Entrada da lista de espera não encontrada.');
    return w.session_id || null;
  }

  /** Lista de espera de um número vai só à sala desse número (sem número = org). */
  private emitWaitlist(orgId: string, sessionId: string | null | undefined, extra: Record<string, unknown>) {
    if (sessionId) this.presenter.emitSession(orgId, sessionId, 'wa:appointment', { action: 'waitlist', ...extra });
    else this.presenter.emit(orgId, 'wa:appointment', { action: 'waitlist', ...extra });
  }

  /** Primeira vaga compatível com a entrada (descontando as vagas já oferecidas a outras pessoas). */
  private async findSlotFor(orgId: string, w: any) {
    const today = brtDateStr();
    const from = w.date_from.toISOString().slice(0, 10) > today ? w.date_from.toISOString().slice(0, 10) : today;
    const to = w.date_to.toISOString().slice(0, 10);
    if (to < from) return null;
    const days = await this.availability(orgId, { product_id: w.product_id, resource_id: w.resource_id, from, to, period: w.period });
    if (!days.length) return null;
    const offered = await this.prisma.whatsapp_waitlist.findMany({ where: { organization_id: orgId, product_id: w.product_id, status: 'offered', id: { not: w.id } }, select: { offered_starts_at: true, offered_resource_id: true } });
    const taken = new Map<string, number>();
    for (const o of offered) { const k = `${o.offered_resource_id}|${o.offered_starts_at ? new Date(o.offered_starts_at).toISOString() : ''}`; taken.set(k, (taken.get(k) || 0) + 1); }
    for (const d of days) for (const s of d.slots) if ((taken.get(`${s.resource_id}|${s.starts_at}`) || 0) < s.left) return s;
    return null;
  }

  /** Oferece uma vaga (manual: horário escolhido, conferido contra as vagas livres; automático: a 1ª compatível). */
  async waitlistOffer(orgId: string, id: string, dto: { starts_at?: string | null; resource_id?: string | null } = {}) {
    const w = await this.prisma.whatsapp_waitlist.findFirst({ where: { id, organization_id: orgId } });
    if (!w) throw new NotFoundException('Entrada da lista de espera não encontrada.');
    if (!['waiting', 'offered'].includes(w.status)) throw new BadRequestException('Esta entrada da lista de espera já foi encerrada.');
    let slot: { starts_at: string; resource_id: string } | null = null;
    if (dto.starts_at) {
      const st = new Date(String(dto.starts_at));
      if (Number.isNaN(+st)) throw new BadRequestException('Horário inválido.');
      const rid = dto.resource_id || w.resource_id || null;
      // o cliente vai aceitar pelo `book` (antecedência, grade, vaga): só oferece horário que ele consegue reservar
      const days = await this.availability(orgId, { product_id: w.product_id, resource_id: rid, from: brtDateStr(st), days: 1 });
      const free = days.flatMap((d) => d.slots).find((x) => x.starts_at === st.toISOString());
      if (!free) throw conflict('NO_SLOT', 'Esse horário não está livre (ocupado, fora da grade, bloqueado ou sem a antecedência mínima). Escolha um horário da lista de vagas.');
      slot = { starts_at: free.starts_at, resource_id: free.resource_id };
    } else slot = await this.findSlotFor(orgId, w);
    if (!slot) throw conflict('NO_SLOT', 'Não há vaga livre compatível com o serviço, o recurso e o período desta pessoa.');
    const ok = await this.offer(orgId, w, slot);
    if (!ok) throw conflict('NO_CHANNEL', 'Não foi possível enviar a oferta (nenhum número do WhatsApp para falar com o contato, ou a entrada mudou agora).');
    return (await this.shapeWaitlist(orgId, [(await this.prisma.whatsapp_waitlist.findUnique({ where: { id } }))!]))[0];
  }

  /**
   * Reserva a entrada (claim condicional pelo status lido — e pelo `offered_at`, se já oferecida) e enfileira a
   * oferta; dedupe pela hora da oferta (a mesma vaga pode ser oferecida de novo depois). Fila recusou → desfaz.
   */
  private async offer(orgId: string, w: any, slot: { starts_at: string; resource_id: string }) {
    const s = await this.settings(orgId);
    const product = await this.prisma.whatsapp_products.findUnique({ where: { id: w.product_id } });
    const res = await this.prisma.whatsapp_resources.findUnique({ where: { id: slot.resource_id }, select: { name: true } });
    if (!product) return false;
    const key = await this.keyFor(orgId, { session_id: w.session_id, chat_id: w.chat_id, contact_id: w.contact_id, customer_id: w.customer_id });
    if (!key) return false;
    const offeredAt = new Date();
    const until = new Date(+offeredAt + s.waitlist_offer_minutes * 60_000);
    const prev = { status: w.status, offered_starts_at: w.offered_starts_at || null, offered_resource_id: w.offered_resource_id || null, offered_at: w.offered_at || null, expires_at: w.expires_at || null, session_id: w.session_id || null, chat_id: w.chat_id || null };
    const u = await this.prisma.whatsapp_waitlist.updateMany({
      where: { id: w.id, status: w.status, ...(w.status === 'offered' ? { offered_at: w.offered_at } : {}) },
      data: { status: 'offered', offered_starts_at: new Date(slot.starts_at), offered_resource_id: slot.resource_id, offered_at: offeredAt, expires_at: until, session_id: key.session_id, chat_id: key.chat_id },
    });
    if (!u.count) return false;
    const name = w.customer_id ? (await this.prisma.whatsapp_customers.findUnique({ where: { id: w.customer_id }, select: { name: true } }))?.name : (await this.prisma.whatsapp_contacts.findUnique({ where: { id: w.contact_id }, select: { name: true, push_name: true } }).then((c) => c?.name || c?.push_name));
    const vars = { 'cliente.nome': name || '', 'cliente.primeiro_nome': firstName(name), 'agendamento.servico': product.name, 'agendamento.profissional': res?.name || '', 'agendamento.data': fmtDay(slot.starts_at), 'agendamento.hora': fmtTime(slot.starts_at), 'agendamento.valor': formatBRL(product.price_cents), 'agendamento.endereco': normalizeBooking(product.booking).address || '', 'agendamento.oferta_minutos': String(s.waitlist_offer_minutes), 'agendamento.link_pagamento': '', 'agendamento.pagar_ate': '', 'agendamento.credito': '' };
    const text = fillScheduleText(s.texts.waitlist_offer, vars);
    // dedupe `appt:wl:<id>:<offered_at>` — o 3º pedaço continua sendo o id da entrada (onOutboxSent/reloadPending)
    const queued = text ? await this.outbox.enqueue(orgId, { ...key, kind: 'appt_waitlist_offer', payload: { text, mark: { waitlist: w.id } }, dedupe_key: `appt:wl:${w.id}:${+offeredAt}` }).catch(() => null) : null;
    if (!queued) {
      // sem mensagem não há oferta: devolve a entrada como estava (senão a vaga ficaria "oferecida" a quem não soube)
      await this.prisma.whatsapp_waitlist.updateMany({ where: { id: w.id, status: 'offered', offered_at: offeredAt }, data: prev }).catch(() => undefined);
      this.logger.warn(`agenda: lista de espera ${w.id}: oferta não enfileirada — entrada devolvida`);
      return false;
    }
    this.logger.log(`agenda: lista de espera ${w.id} ← vaga ${fmtDay(slot.starts_at)} ${fmtTime(slot.starts_at)}`);
    this.emitWaitlist(orgId, key.session_id, { waitlist_id: w.id });
    return true;
  }

  /** Varredura imediata (cancelamento/expiração liberou horário) — no máx. 1× por 20 s por serviço. */
  private kickWaitlist(orgId: string, productId: string | null) {
    if (!productId) return;
    const k = `${orgId}:${productId}`;
    if (Date.now() - (this.waitlistKick.get(k) || 0) < 20_000) return;
    this.waitlistKick.set(k, Date.now());
    setTimeout(() => void this.scanWaitlist(orgId, productId).catch((e) => this.logger.debug(`lista de espera: ${e?.message || e}`)), 1500);
  }

  /**
   * Oferece vagas às entradas `waiting` (mais antigas primeiro). Usado pelo runner e pelo kick. Uma varredura por
   * org de cada vez (mutex): pedida durante outra, roda de novo no fim (sem duas varreduras oferecendo a mesma vaga).
   */
  async scanWaitlist(orgId: string, productId?: string | null, limit = 20): Promise<number> {
    if (this.scanning.has(orgId)) {
      // já tem varredura rodando: pede outra no fim (sem produto = todos)
      const cur = this.rescan.get(orgId);
      this.rescan.set(orgId, this.rescan.has(orgId) && cur !== productId ? null : productId);
      return 0;
    }
    this.scanning.add(orgId);
    let offered = 0;
    try {
      const rows = await this.prisma.whatsapp_waitlist.findMany({ where: { organization_id: orgId, status: 'waiting', ...(productId ? { product_id: productId } : {}) }, orderBy: { created_at: 'asc' }, take: limit });
      for (const w of rows) {
        const slot = await this.findSlotFor(orgId, w).catch(() => null);
        if (slot && (await this.offer(orgId, w, slot).catch(() => false))) offered++;
      }
    } finally {
      this.scanning.delete(orgId);
    }
    if (this.rescan.has(orgId)) {
      const again = this.rescan.get(orgId);
      this.rescan.delete(orgId);
      offered += await this.scanWaitlist(orgId, again, limit).catch(() => 0);
    }
    return offered;
  }

  // ================================================================ respostas do cliente (sem o bot)
  private static pkey(orgId: string, sessionId: string, jid: string) { return `${orgId}:${sessionId}:${jid}`; }

  private onOutboxSent(e: any) {
    const o = e?.outbox;
    if (!o?.dedupe_key) return;
    const key = WhatsAppSchedulingService.pkey(o.organization_id, o.session_id, o.chat_id);
    if (o.kind === 'appt_d1_confirm') {
      const id = String(o.dedupe_key).split(':')[1];
      const cur = this.confirmPending.get(key);
      const ids = cur && cur.until > Date.now() ? cur.ids : new Set<string>();
      ids.add(id);
      this.confirmPending.set(key, { ids, until: Date.now() + DEDUPE_HOURS * 3600_000, sentAt: Date.now() });
    } else if (o.kind === 'appt_waitlist_offer') {
      const wid = String(o.dedupe_key).split(':')[2];
      const sentAt = Date.now();
      void this.prisma.whatsapp_waitlist.findUnique({ where: { id: wid }, select: { expires_at: true, status: true } }).then((w) => {
        if (w?.status === 'offered' && w.expires_at) this.offerPending.set(key, { waitlistId: wid, until: +w.expires_at, sentAt });
      }).catch(() => undefined);
    }
  }

  /** Bot passou a esperar resposta (menu/pergunta) nesta conversa — ou parou de esperar. */
  private onBotState(e: any) {
    if (!e?.orgId || !e.sessionId || !e.chatId) return;
    const key = WhatsAppSchedulingService.pkey(e.orgId, e.sessionId, e.chatId);
    if (e.status === 'waiting' && !BOT_NOT_ASKING.has(String(e.waiting_for || ''))) this.botWaiting.set(key, Date.now());
    else this.botWaiting.delete(key);
  }

  /** O bot fez uma pergunta DEPOIS da nossa (e ainda espera)? Então o "1/2" é resposta ao bot. */
  private botAskedAfter(key: string, sentAt: number) {
    const at = this.botWaiting.get(key);
    if (!at) return false;
    if (Date.now() - at > DEDUPE_HOURS * 3600_000) { this.botWaiting.delete(key); return false; }
    return at > sentAt;
  }

  /** Poda da memória (pendências vencidas, kicks e estados antigos). O runner chama a cada minuto. */
  pruneMemory() {
    const now = Date.now();
    for (const [k, p] of this.confirmPending) if (p.until < now || !p.ids.size) this.confirmPending.delete(k);
    for (const [k, p] of this.offerPending) if (p.until < now) this.offerPending.delete(k);
    for (const [k, at] of this.botWaiting) if (now - at > DEDUPE_HOURS * 3600_000) this.botWaiting.delete(k);
    for (const [k, at] of this.waitlistKick) if (now - at > 60_000) this.waitlistKick.delete(k);
    for (const [k, at] of this.lastScan) if (now - at > 3600_000) this.lastScan.delete(k);
    for (const [k, c] of this.activeCache) if (now - c.at > 600_000) this.activeCache.delete(k);
    for (const [k, c] of this.settingsCache) if (now - c.at > 600_000) this.settingsCache.delete(k);
  }

  private dropConfirmPending(orgId: string, apptId: string) {
    for (const [k, p] of this.confirmPending) if (k.startsWith(`${orgId}:`) && p.ids.delete(apptId) && !p.ids.size) this.confirmPending.delete(k);
  }
  private dropOffer(orgId: string, waitlistId: string) {
    for (const [k, p] of this.offerPending) if (k.startsWith(`${orgId}:`) && p.waitlistId === waitlistId) this.offerPending.delete(k);
  }

  /** Reinício do processo: pedidos de confirmação (24 h) e ofertas em aberto voltam para a memória. */
  private async reloadPending() {
    const since = new Date(Date.now() - DEDUPE_HOURS * 3600_000);
    const sent = await this.prisma.whatsapp_outbox.findMany({ where: { kind: { in: ['appt_d1_confirm', 'appt_waitlist_offer'] }, status: 'sent', sent_at: { gte: since } }, select: { organization_id: true, session_id: true, chat_id: true, kind: true, dedupe_key: true, sent_at: true }, take: 5000 });
    const apptIds = sent.filter((s) => s.kind === 'appt_d1_confirm').map((s) => String(s.dedupe_key || '').split(':')[1]).filter(Boolean);
    const wlIds = sent.filter((s) => s.kind === 'appt_waitlist_offer').map((s) => String(s.dedupe_key || '').split(':')[2]).filter(Boolean);
    const [appts, wls] = await Promise.all([
      apptIds.length ? this.prisma.whatsapp_appointments.findMany({ where: { id: { in: apptIds }, status: { in: ['booked', 'pending_payment'] }, confirmed_at: null, starts_at: { gt: new Date() } }, select: { id: true } }) : Promise.resolve([] as any[]),
      wlIds.length ? this.prisma.whatsapp_waitlist.findMany({ where: { id: { in: wlIds }, status: 'offered', expires_at: { gt: new Date() } }, select: { id: true, expires_at: true } }) : Promise.resolve([] as any[]),
    ]);
    const okAppt = new Set(appts.map((a: any) => a.id));
    const okWl = new Map(wls.map((w: any) => [w.id, +w.expires_at] as [string, number]));
    for (const s of sent) {
      const key = WhatsAppSchedulingService.pkey(s.organization_id, s.session_id, s.chat_id);
      if (s.kind === 'appt_d1_confirm') {
        const id = String(s.dedupe_key || '').split(':')[1];
        if (!okAppt.has(id)) continue;
        const sentAt = +(s.sent_at || new Date());
        const cur = this.confirmPending.get(key) || { ids: new Set<string>(), until: sentAt + DEDUPE_HOURS * 3600_000, sentAt };
        cur.ids.add(id);
        if (sentAt > cur.sentAt) { cur.sentAt = sentAt; cur.until = sentAt + DEDUPE_HOURS * 3600_000; }
        this.confirmPending.set(key, cur);
      } else {
        const wid = String(s.dedupe_key || '').split(':')[2];
        if (okWl.has(wid)) this.offerPending.set(key, { waitlistId: wid, until: okWl.get(wid)!, sentAt: +(s.sent_at || new Date()) });
      }
    }
    // perguntas do bot ainda em aberto (quem perguntou por último decide quem lê o "1/2")
    if (this.confirmPending.size || this.offerPending.size) {
      const bots = await this.prisma.whatsapp_bot_sessions.findMany({ where: { status: 'waiting', updated_at: { gte: since } }, select: { organization_id: true, session_id: true, chat_id: true, updated_at: true, vars: true }, take: 5000 }).catch(() => [] as any[]);
      for (const b of bots) if (!BOT_NOT_ASKING.has(String((b.vars as any)?.__waiting_for || ''))) this.botWaiting.set(WhatsAppSchedulingService.pkey(b.organization_id, b.session_id, b.chat_id), +b.updated_at);
    }
    if (this.confirmPending.size || this.offerPending.size) this.logger.log(`agenda: ${this.confirmPending.size} confirmação(ões) e ${this.offerPending.size} oferta(s) aguardando resposta`);
  }

  /** Filtro síncrono de entrada: "1/sim" e "2/não" às perguntas da agenda. true = consumida (o bot não vê). */
  private capture(e: InboundEvent): boolean {
    if (!e?.sessionId || !e.chatId || isGroupJid(e.chatId)) return false;
    const key = WhatsAppSchedulingService.pkey(e.orgId, e.sessionId, e.chatId);
    const offer = this.offerPending.get(key);
    const conf = this.confirmPending.get(key);
    if (!offer && !conf) return false;
    const body = String(e.message?.body || '').trim().toLowerCase().replace(/[.!]+$/, '');
    if (!body || body.length > 40) return false;
    const yes = /^(1|1️⃣|sim|s|quero|confirmo|confirmar|confirmado|ok|pode ser)$/.test(body);
    const no = /^(2|2️⃣|não|nao|n|remarcar|cancelar|não quero|nao quero)$/.test(body);
    if (!yes && !no) return false;
    // o bot perguntou algo DEPOIS da nossa pergunta (menu, pergunta): o "1/2" é dele — não consome
    if (offer) {
      if (offer.until < Date.now()) this.offerPending.delete(key);
      else if (!this.botAskedAfter(key, offer.sentAt)) {
        this.offerPending.delete(key);
        void this.answerOffer(e.orgId, offer.waitlistId, yes, { session_id: e.sessionId, chat_id: e.chatId });
        return true;
      }
    }
    if (conf) {
      if (conf.until < Date.now() || !conf.ids.size) { this.confirmPending.delete(key); return false; }
      if (this.botAskedAfter(key, conf.sentAt)) return false;
      this.confirmPending.delete(key);
      void this.answerConfirm(e.orgId, [...conf.ids], yes, { session_id: e.sessionId, chat_id: e.chatId });
      return true;
    }
    return false;
  }

  private async answerConfirm(orgId: string, ids: string[], yes: boolean, key: { session_id: string; chat_id: string }) {
    for (const id of ids) {
      try {
        const a = await this.prisma.whatsapp_appointments.findFirst({ where: { id, organization_id: orgId } });
        if (!a || !['booked', 'pending_payment'].includes(a.status)) continue;
        if (yes) {
          const shaped = await this.confirm(orgId, id, { by: 'customer' });
          await this.notifyCustomer(orgId, shaped, 'confirmed', 'confirmed', { key });
        } else {
          await this.patchCustom(id, { d1_answer: 'reschedule' });
          const shaped = await this.get(orgId, id);
          this.emitAppt(orgId, 'reschedule_requested', shaped);
          await this.notifyCustomer(orgId, shaped, 'reschedule_help', 'reply2', { key });
        }
      } catch (err: any) { this.logger.warn(`agenda ${id}: resposta à confirmação: ${err?.message || err}`); }
    }
  }

  private async answerOffer(orgId: string, waitlistId: string, yes: boolean, key: { session_id: string; chat_id: string }) {
    const w = await this.prisma.whatsapp_waitlist.findFirst({ where: { id: waitlistId, organization_id: orgId } });
    if (!w || w.status !== 'offered' || !w.offered_starts_at) return;
    const s = await this.settings(orgId);
    const say = async (text: string, tipo: string) => { await this.outbox.enqueue(orgId, { ...key, kind: `appt_${tipo}`, payload: { text, mark: { waitlist: w.id } }, dedupe_key: `appt:wl:${w.id}:${tipo}:${Date.now()}` }).catch(() => undefined); };
    if (!yes) {
      await this.prisma.whatsapp_waitlist.updateMany({ where: { id: w.id, status: 'offered' }, data: { status: 'declined' } });
      await say(fillScheduleText(s.texts.waitlist_declined, {}), 'waitlist_declined');
      this.emitWaitlist(orgId, w.session_id, { waitlist_id: w.id });
      this.kickWaitlist(orgId, w.product_id);
      return;
    }
    try {
      await this.book(orgId, { product_id: w.product_id, resource_id: w.offered_resource_id, starts_at: w.offered_starts_at, contact_id: w.contact_id, customer_id: w.customer_id, session_id: key.session_id, chat_id: key.chat_id, source: 'waitlist', waitlist_id: w.id });
    } catch (err: any) {
      this.logger.log(`agenda: lista de espera ${w.id} não conseguiu a vaga: ${err?.response?.code || err?.message || err}`);
      await this.prisma.whatsapp_waitlist.updateMany({ where: { id: w.id, status: 'offered' }, data: { status: 'waiting', offered_starts_at: null, offered_resource_id: null, offered_at: null, expires_at: null } });
      await say(fillScheduleText(s.texts.waitlist_failed, {}), 'waitlist_failed');
    }
    this.emitWaitlist(orgId, w.session_id, { waitlist_id: w.id });
  }

  // ================================================================ runners (chamados pelo WhatsAppSchedulingRunner)
  private readonly activeCache = new Map<string, { at: number; ok: boolean }>();
  private async orgActive(orgId: string) {
    const c = this.activeCache.get(orgId);
    if (c && Date.now() - c.at < 60_000) return c.ok;
    const ok = await this.access.isOrgActive(orgId).catch(() => true);
    this.activeCache.set(orgId, { at: Date.now(), ok });
    return ok;
  }

  /** Orgs com linhas candidatas (groupBy) — os runners iteram POR ORG: org sem acesso/opção desligada não trava as outras. */
  private async orgsWith(where: any): Promise<string[]> {
    const g = await this.prisma.whatsapp_appointments.groupBy({ by: ['organization_id'], where, _count: { _all: true } });
    return g.map((x) => x.organization_id);
  }

  /**
   * Percorre as linhas da org em lotes, em ordem (`orderField`, id), até `RUN_MAX_PER_ORG`. Cursor "keyset" com os
   * valores LIDOS (a linha pode sair do filtro ou ter o campo zerado ao ser processada — ex.: `pay_until` → null).
   */
  private async eachRow(where: any, orderField: 'starts_at' | 'pay_until' | 'ends_at', fn: (a: any) => Promise<void>) {
    let last: { v: Date; id: string } | null = null, seen = 0;
    while (seen < RUN_MAX_PER_ORG) {
      const after: any = last ? { OR: [{ [orderField]: { gt: last.v } }, { [orderField]: last.v, id: { gt: last.id } }] } : null;
      const rows: any[] = await this.prisma.whatsapp_appointments.findMany({ where: after ? { AND: [where, after] } : where, orderBy: [{ [orderField]: 'asc' } as any, { id: 'asc' as const }], take: RUN_BATCH });
      if (!rows.length) break;
      const tail = rows[rows.length - 1];
      last = { v: tail[orderField], id: tail.id };
      for (const a of rows) await fn(a);
      seen += rows.length;
      if (rows.length < RUN_BATCH || !last.v) break;
    }
  }

  /**
   * Reserva com pagamento vencido → reconfere a cobrança no gateway; PAGA → confirma (mesmo caminho do hook,
   * idempotente); ainda em aberto → expira e cancela.
   */
  async runExpireUnpaid() {
    const base = { status: 'pending_payment', pay_until: { lt: new Date() } };
    let n = 0;
    for (const orgId of await this.orgsWith(base)) {
      if (!(await this.orgActive(orgId))) continue;
      await this.eachRow({ ...base, organization_id: orgId }, 'pay_until', async (a) => {
        try {
          if (a.charge_id) {
            const ch = await this.charges.check(orgId, a.charge_id).catch(() => null);
            if (ch?.status === 'PAID') { await this.onChargePaid({ orgId, charge: { id: a.charge_id, amount_cents: ch.amount_cents, organization_id: orgId } }); return; }
          }
          if (await this.expireOne(orgId, a, 'Prazo para pagar acabou', true)) n++;
        } catch (e: any) { this.logger.warn(`agenda ${a.id}: expirar: ${e?.message || e}`); }
      });
    }
    if (n) this.logger.log(`agenda: ${n} reserva(s) sem pagamento expiraram`);
    return n;
  }

  /**
   * Marca o lembrete e só enfileira se o agendamento AINDA está agendado/confirmado (escrita condicional); depois de
   * enfileirar, confere de novo — cancelado no meio tempo = tira da fila.
   */
  private async sendReminder(a: any, kind: 'd1' | 'h2', mark: Record<string, unknown>, send: () => Promise<any>) {
    const rem: any = (a.reminders as any) || {};
    if (rem[kind]) return false;
    const u = await this.prisma.whatsapp_appointments.updateMany({ where: { id: a.id, status: { in: ['booked', 'confirmed'] } }, data: { reminders: { ...rem, [kind]: mark } } });
    if (!u.count) return false;
    const sent = await send();
    const now = await this.prisma.whatsapp_appointments.findUnique({ where: { id: a.id }, select: { status: true } });
    if (now && !['booked', 'confirmed'].includes(now.status)) {
      await this.outbox.cancelPending(a.organization_id, { dedupe_prefix: `appt:${a.id}:` }).catch(() => undefined);
      return false;
    }
    return Boolean(sent);
  }

  /** Lembretes D-1 (no horário configurado, BRT) e H-2 — por org, só os ainda não enviados (filtro no banco), em ordem. */
  async runReminders() {
    const now = new Date();
    const tomorrow = addDaysStr(brtDateStr(now), 1);
    let d1 = 0, h2 = 0;
    const productBooking = new Map<string, Booking>();
    const bookingOf = async (pid: string | null) => {
      if (!pid) return normalizeBooking(null);
      if (!productBooking.has(pid)) productBooking.set(pid, normalizeBooking((await this.prisma.whatsapp_products.findUnique({ where: { id: pid }, select: { booking: true } }))?.booking));
      return productBooking.get(pid)!;
    };
    const d1Base = { status: { in: ['booked', 'confirmed'] }, starts_at: { gte: brtToUtc(tomorrow, '00:00'), lt: brtToUtc(tomorrow, '24:00') }, created_at: { lt: new Date(+now - 2 * 3600_000) }, reminders: { path: '$.d1', equals: Prisma.DbNull } };
    for (const orgId of await this.orgsWith(d1Base)) {
      if (!(await this.orgActive(orgId))) continue;
      const s = await this.settings(orgId);
      if (brtMinuteOf(now) < hhmmToMin(s.reminder_d1_hour)) continue;
      await this.eachRow({ ...d1Base, organization_id: orgId }, 'starts_at', async (a) => {
        try {
          const booking = await bookingOf(a.product_id);
          const ask = booking.confirm === 'ask_d1' && a.status === 'booked';
          if (await this.sendReminder(a, 'd1', { at: now.toISOString(), ask }, () => this.notifyCustomer(orgId, a, ask ? 'reminder_d1_confirm' : 'reminder_d1', 'd1', { kind: ask ? 'appt_d1_confirm' : 'appt_d1' }))) d1++;
        } catch (e: any) { this.logger.warn(`agenda ${a.id}: lembrete D-1: ${e?.message || e}`); }
      });
    }
    const h2Base = { status: { in: ['booked', 'confirmed'] }, starts_at: { gt: now, lte: new Date(+now + 2 * 3600_000) }, created_at: { lt: new Date(+now - 60 * 60_000) }, reminders: { path: '$.h2', equals: Prisma.DbNull } };
    for (const orgId of await this.orgsWith(h2Base)) {
      if (!(await this.orgActive(orgId))) continue;
      if (!(await this.settings(orgId)).reminder_h2) continue;
      await this.eachRow({ ...h2Base, organization_id: orgId }, 'starts_at', async (a) => {
        try {
          if (await this.sendReminder(a, 'h2', { at: now.toISOString() }, () => this.notifyCustomer(orgId, a, 'reminder_h2', 'h2'))) h2++;
        } catch (e: any) { this.logger.warn(`agenda ${a.id}: lembrete H-2: ${e?.message || e}`); }
      });
    }
    if (d1 || h2) this.logger.log(`agenda: lembretes enfileirados D-1=${d1} H-2=${h2}`);
    return { d1, h2 };
  }

  /** Falta automática e conclusão automática — por org, com a configuração da org no filtro. */
  async runNoShowAndComplete() {
    const now = Date.now();
    let noShows = 0, done = 0;
    const lateBase = { status: { in: ['booked', 'confirmed'] }, starts_at: { lt: new Date(now - 5 * 60_000), gt: new Date(now - 3 * DAY_MS) }, started_at: null };
    for (const orgId of await this.orgsWith(lateBase)) {
      if (!(await this.orgActive(orgId))) continue;
      const s = await this.settings(orgId);
      if (!s.no_show_after_minutes) continue;
      const where = { ...lateBase, organization_id: orgId, starts_at: { lt: new Date(now - Math.max(5, s.no_show_after_minutes) * 60_000), gt: lateBase.starts_at.gt } };
      await this.eachRow(where, 'starts_at', async (a) => {
        try { await this.noShow(orgId, a.id, { by: 'system', notify: false }); noShows++; } catch (e: any) { this.logger.debug(`agenda ${a.id}: falta automática: ${e?.message || e}`); }
      });
    }
    const oldBase = { status: { in: ['booked', 'confirmed', 'in_progress'] }, ends_at: { lt: new Date(now - 2 * 3600_000) } };
    for (const orgId of await this.orgsWith(oldBase)) {
      if (!(await this.orgActive(orgId))) continue;
      const s = await this.settings(orgId);
      if (!s.auto_complete) continue;
      // com falta automática ligada, só o "em atendimento" conclui sozinho (os outros viram falta)
      const where = { ...oldBase, organization_id: orgId, ...(s.no_show_after_minutes ? { status: 'in_progress' } : {}) };
      await this.eachRow(where, 'ends_at', async (a) => {
        try {
          const u = await this.prisma.whatsapp_appointments.updateMany({ where: { id: a.id, status: a.status }, data: { status: 'done', done_at: new Date() } });
          if (u.count) { done++; this.dropConfirmPending(orgId, a.id); this.emitAppt(orgId, 'done', await this.get(orgId, a.id), { by: 'system' }); }
        } catch (e: any) { this.logger.debug(`agenda ${a.id}: conclusão automática: ${e?.message || e}`); }
      });
    }
    if (noShows || done) this.logger.log(`agenda: faltas automáticas=${noShows} concluídos=${done}`);
    return { no_shows: noShows, done };
  }

  /** Lista de espera: vence ofertas e entradas antigas; oferece vagas (no máx. a cada 5 min por org). */
  private lastScan = new Map<string, number>();
  async runWaitlist() {
    const now = new Date();
    this.pruneMemory();
    const expiredOffers = await this.prisma.whatsapp_waitlist.findMany({ where: { status: 'offered', expires_at: { lt: now } }, select: { id: true, organization_id: true, product_id: true }, take: 500 });
    for (const w of expiredOffers) {
      const u = await this.prisma.whatsapp_waitlist.updateMany({ where: { id: w.id, status: 'offered' }, data: { status: 'expired' } });
      if (u.count) { this.dropOffer(w.organization_id, w.id); this.kickWaitlist(w.organization_id, w.product_id); }
    }
    await this.prisma.whatsapp_waitlist.updateMany({ where: { status: 'waiting', date_to: { lt: new Date(`${brtDateStr(now)}T00:00:00Z`) } }, data: { status: 'expired' } });
    const orgs = await this.prisma.whatsapp_waitlist.groupBy({ by: ['organization_id'], where: { status: 'waiting' }, _count: { _all: true } });
    let offered = 0;
    for (const g of orgs) {
      if (Date.now() - (this.lastScan.get(g.organization_id) || 0) < 5 * 60_000) continue;
      if (!(await this.orgActive(g.organization_id))) continue;
      this.lastScan.set(g.organization_id, Date.now());
      offered += await this.scanWaitlist(g.organization_id, null, 20).catch(() => 0);
    }
    return { expired_offers: expiredOffers.length, offered };
  }
}

const STATUS_PT: Record<string, string> = { pending_payment: 'aguardando pagamento', booked: 'agendado', confirmed: 'confirmado', in_progress: 'em atendimento', done: 'concluído', no_show: 'marcado como falta', canceled: 'cancelado', expired: 'expirado' };
