import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../platform-billing/access.service';
import { OpenWaClient, OpenWaError } from './openwa.client';
import { WhatsAppSessionsService } from './whatsapp-sessions.service';
import { WhatsAppMediaService } from './whatsapp-media.service';
import { WhatsAppPacingService } from './whatsapp-pacing.service';
import { WhatsAppInboundService } from './whatsapp-inbound.service';
import { isGroupJid, phoneFromJid } from './whatsapp-contacts.service';
import { WhatsAppAttendanceService } from './whatsapp-attendance.service';
import { WhatsAppPresenter } from './whatsapp-presenter.service';
import { WhatsAppCrmService } from './whatsapp-crm.service';

// Broadcasts (espelho do Telegram): horários diários (minuto-do-dia BRT), copies com rotação,
// audiência = contatos salvos/tags/selecionados + grupos, fila `whatsapp_broadcast_sends`
// com worker contínuo (1 envio por vez por org, intervalo configurável), aquecimento por org
// (PACED = volta amanhã), 429 do gateway respeitado, métricas por run.

const MAX_ATTEMPTS = 3;

function brtMinuteOfDay(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === 'hour')?.value || 0) % 24;
  const m = Number(parts.find((p) => p.type === 'minute')?.value || 0);
  return h * 60 + m;
}
function brtStartOfToday(now = new Date()) {
  const s = new Date(now.getTime() - 3 * 3600_000);
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()) + 3 * 3600_000);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// {{nome}} {{telefone}} + {{cliente.*}} (CRM). Chave fora do mapa fica como está.
export function fillVars(text: string, vars: Record<string, string>) {
  return String(text || '').replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (m, k) => { const key = String(k).toLowerCase(); return key in vars ? vars[key] ?? '' : m; });
}

@Injectable()
export class WhatsAppBroadcastsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppBroadcastsService.name);
  private stopped = false;
  private loopRunning = false;
  private readonly busyOrgs = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly openwa: OpenWaClient,
    private readonly sessions: WhatsAppSessionsService,
    private readonly media: WhatsAppMediaService,
    private readonly pacing: WhatsAppPacingService,
    private readonly inbound: WhatsAppInboundService,
    private readonly access: AccessService,
    private readonly attendance: WhatsAppAttendanceService,
    private readonly presenter: WhatsAppPresenter,
    private readonly crm: WhatsAppCrmService,
  ) {}

  // ---------------------------------------------------------------- normalização
  private normTargets(raw: any) {
    const t = raw && typeof raw === 'object' ? raw : {};
    const contacts = ['saved', 'all', 'none', 'selected'].includes(t.contacts) ? t.contacts : 'none';
    return {
      contacts,
      contact_ids: Array.isArray(t.contact_ids) ? t.contact_ids.map(String).slice(0, 5000) : [],
      tags: Array.isArray(t.tags) ? t.tags.map((x: any) => String(x).slice(0, 40)).slice(0, 50) : [],
      groups: Array.isArray(t.groups) ? t.groups.map(String).filter((g: string) => isGroupJid(g)).slice(0, 200) : [],
    };
  }
  private normTimes(raw: any) {
    if (!Array.isArray(raw)) return [];
    return [...new Set(raw.map((n) => Math.round(Number(n))).filter((n) => Number.isFinite(n) && n >= 0 && n <= 1439))].sort((a, b) => a - b).slice(0, 48);
  }
  private normMessages(raw: any) {
    if (!Array.isArray(raw)) return [];
    return raw.slice(0, 10).map((m: any) => ({
      id: String(m?.id || Math.random().toString(36).slice(2)),
      text: String(m?.text || '').slice(0, 4096),
      media_id: m?.media?.id ? String(m.media.id) : m?.media_id ? String(m.media_id) : null,
      delay_seconds: Math.min(60, Math.max(0, Number(m?.delay_seconds || 0))),
    })).filter((m: any) => m.text || m.media_id);
  }

  // ---------------------------------------------------------------- audiência
  async audience(orgId: string, rawTargets: any) {
    const t = this.normTargets(rawTargets);
    const where: any = { organization_id: orgId, is_blocked: false, opted_out_at: null }; // LGPD: descadastrados fora da estimativa também
    const ids = new Set<string>();
    if (t.contacts === 'all' || t.contacts === 'saved') {
      const rows = await this.prisma.whatsapp_contacts.findMany({ where: { ...where, ...(t.contacts === 'saved' ? { saved: true } : {}) }, select: { id: true, tags: true } });
      for (const r of rows) if (!t.tags.length || (Array.isArray(r.tags) && (r.tags as any[]).some((x) => t.tags.includes(String(x))))) ids.add(r.id);
    }
    if (t.contact_ids.length) {
      const sel = await this.prisma.whatsapp_contacts.findMany({ where: { ...where, id: { in: t.contact_ids } }, select: { id: true } });
      for (const r of sel) ids.add(r.id);
    }
    return { contacts: ids.size, groups: t.groups.length, total: ids.size + t.groups.length };
  }

  private async resolveAudience(orgId: string, rawTargets: any) {
    const t = this.normTargets(rawTargets);
    const out: Array<{ chat_id: string; contact_id: string | null; target_kind: 'contact' | 'group' }> = [];
    const base: any = { organization_id: orgId, is_blocked: false, opted_out_at: null }; // LGPD: quem pediu PARE não recebe
    const rows: any[] = [];
    if (t.contacts === 'all' || t.contacts === 'saved') {
      const pool = await this.prisma.whatsapp_contacts.findMany({ where: { ...base, ...(t.contacts === 'saved' ? { saved: true } : {}) }, select: { id: true, wa_id: true, tags: true, phone: true } });
      for (const r of pool) if (!t.tags.length || (Array.isArray(r.tags) && (r.tags as any[]).some((x) => t.tags.includes(String(x))))) rows.push(r);
    }
    if (t.contact_ids.length) rows.push(...(await this.prisma.whatsapp_contacts.findMany({ where: { ...base, id: { in: t.contact_ids } }, select: { id: true, wa_id: true, tags: true, phone: true } })));
    for (const r of rows) {
      const chatId = r.wa_id.endsWith('@c.us') || r.wa_id.endsWith('@lid') ? r.wa_id : r.phone ? `${r.phone}@c.us` : null;
      if (chatId) out.push({ chat_id: chatId, contact_id: r.id, target_kind: 'contact' });
    }
    for (const g of t.groups) out.push({ chat_id: g, contact_id: null, target_kind: 'group' });
    // dedupe por chat
    const seen = new Set<string>();
    return out.filter((x) => (seen.has(x.chat_id) ? false : (seen.add(x.chat_id), true)));
  }

  // ---------------------------------------------------------------- CRUD
  private async shape(b: any, extra: any = {}) {
    return { id: b.id, name: b.name, targets: this.normTargets(b.targets), times: this.normTimes(b.times), mode: b.mode, delete_used: b.delete_used, active: b.active, interval_ms: b.interval_ms, risk_ack_at: b.risk_ack_at, created_at: b.created_at, ...extra };
  }

  async list(orgId: string) {
    const rows = await this.prisma.whatsapp_broadcasts.findMany({ where: { organization_id: orgId }, orderBy: { created_at: 'desc' }, include: { _count: { select: { copies: true } } } });
    const session = await this.sessions.row(orgId);
    const warm = session ? await this.pacing.summary({ paired_at: session.paired_at, pacing_enabled: session.pacing_enabled, organization_id: orgId }) : null;
    const start = brtStartOfToday();
    const nowMin = brtMinuteOfDay();
    const out: any[] = [];
    for (const b of rows) {
      const runs = await this.prisma.whatsapp_broadcast_runs.findMany({ where: { broadcast_id: b.id, run_at: { gte: start } }, orderBy: { run_at: 'desc' } });
      const times = this.normTimes(b.times);
      const time_status: Record<string, string> = {};
      for (const t of times) {
        const run = runs.find((r) => brtMinuteOfDay(r.run_at) === t);
        if (!run) time_status[String(t)] = t >= nowMin ? 'pending' : 'missed';
        else if (run.status !== 'done') time_status[String(t)] = 'sending';
        else if (run.failed === 0 && run.blocked === 0) time_status[String(t)] = 'sent';
        else if (run.sent > 0) time_status[String(t)] = 'sent_with_errors';
        else time_status[String(t)] = 'failed';
      }
      out.push(await this.shape(b, { copies_count: b._count.copies, audience: await this.audience(orgId, b.targets), time_status, warmup: warm }));
    }
    return out;
  }

  private validateInput(dto: any) {
    const name = String(dto.name || '').trim().slice(0, 255);
    if (!name) throw new BadRequestException('Nome é obrigatório.');
    const targets = this.normTargets(dto.targets);
    if (targets.contacts === 'none' && !targets.contact_ids.length && !targets.groups.length) throw new BadRequestException('Escolha ao menos contatos ou grupos.');
    return { name, targets, times: this.normTimes(dto.times), mode: dto.mode === 'random' ? 'random' : 'sequential', delete_used: Boolean(dto.delete_used), interval_ms: Math.min(120000, Math.max(1000, Number(dto.interval_ms || 4000))) };
  }

  async create(orgId: string, dto: any) {
    const v = this.validateInput(dto);
    if (!dto.risk_ack) throw new BadRequestException('Confirme que entende o risco de restrição do número.');
    const b = await this.prisma.whatsapp_broadcasts.create({ data: { organization_id: orgId, ...v, active: Boolean(dto.active), risk_ack_at: new Date() } });
    return this.shape(b);
  }

  async update(orgId: string, id: string, dto: any) {
    const b = await this.prisma.whatsapp_broadcasts.findFirst({ where: { id, organization_id: orgId } });
    if (!b) throw new NotFoundException('Broadcast não encontrado.');
    const v = this.validateInput({ ...b, ...dto, targets: dto.targets ?? b.targets, times: dto.times ?? b.times });
    const upd = await this.prisma.whatsapp_broadcasts.update({ where: { id }, data: { ...v, ...(dto.active !== undefined ? { active: Boolean(dto.active) } : {}), ...(dto.risk_ack ? { risk_ack_at: new Date() } : {}) } });
    return this.shape(upd);
  }

  async remove(orgId: string, id: string) {
    const b = await this.prisma.whatsapp_broadcasts.findFirst({ where: { id, organization_id: orgId } });
    if (!b) throw new NotFoundException('Broadcast não encontrado.');
    await this.prisma.whatsapp_broadcasts.delete({ where: { id } });
    return { ok: true };
  }

  async getCopies(orgId: string, id: string) {
    const b = await this.prisma.whatsapp_broadcasts.findFirst({ where: { id, organization_id: orgId } });
    if (!b) throw new NotFoundException('Broadcast não encontrado.');
    const copies = await this.prisma.whatsapp_broadcast_copies.findMany({ where: { broadcast_id: id }, orderBy: { position: 'asc' } });
    const out: any[] = [];
    for (const c of copies) out.push({ id: c.id, position: c.position, messages: await this.hydrateMessages(c.messages) });
    return out;
  }

  private async hydrateMessages(raw: any) {
    const msgs = this.normMessages(raw);
    const ids = msgs.map((m) => m.media_id).filter(Boolean) as string[];
    const medias = ids.length ? await this.prisma.whatsapp_media.findMany({ where: { id: { in: ids } } }) : [];
    const mmap = new Map(medias.map((m) => [m.id, m] as [string, any]));
    return msgs.map((m) => ({ id: m.id, text: m.text, media: m.media_id ? this.media.toPublic(mmap.get(m.media_id)) : null, delay_seconds: m.delay_seconds }));
  }

  async setCopies(orgId: string, id: string, copies: any[]) {
    const b = await this.prisma.whatsapp_broadcasts.findFirst({ where: { id, organization_id: orgId } });
    if (!b) throw new NotFoundException('Broadcast não encontrado.');
    const list = (Array.isArray(copies) ? copies : []).slice(0, 50).map((c, i) => ({ position: i, messages: this.normMessages(c?.messages) })).filter((c) => c.messages.length);
    await this.prisma.$transaction(async (tx) => {
      await tx.whatsapp_broadcast_copies.deleteMany({ where: { broadcast_id: id } });
      for (const c of list) await tx.whatsapp_broadcast_copies.create({ data: { broadcast_id: id, organization_id: orgId, position: c.position, messages: c.messages } });
      await tx.whatsapp_broadcasts.update({ where: { id }, data: { last_copy_index: 0 } });
    });
    return this.getCopies(orgId, id);
  }

  async runs(orgId: string, id: string, q: any = {}) {
    const b = await this.prisma.whatsapp_broadcasts.findFirst({ where: { id, organization_id: orgId } });
    if (!b) throw new NotFoundException('Broadcast não encontrado.');
    const page = Math.max(1, parseInt(String(q.page || 1), 10) || 1);
    const size = Math.min(100, Math.max(5, parseInt(String(q.page_size || 10), 10) || 10));
    const where: any = { broadcast_id: id };
    const valid = (v: any) => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? d : null; };
    if (valid(q.from) || valid(q.to)) where.run_at = { ...(valid(q.from) ? { gte: valid(q.from) } : {}), ...(valid(q.to) ? { lte: valid(q.to) } : {}) };
    if (q.status === 'sending') where.status = 'running';
    if (q.status === 'done') where.status = 'done';
    if (q.status === 'clean') { where.status = 'done'; where.failed = 0; where.blocked = 0; }
    if (q.status === 'errors') where.OR = [{ failed: { gt: 0 } }, { blocked: { gt: 0 } }];
    const [total, rows] = await Promise.all([this.prisma.whatsapp_broadcast_runs.count({ where }), this.prisma.whatsapp_broadcast_runs.findMany({ where, orderBy: { run_at: 'desc' }, skip: (page - 1) * size, take: size })]);
    const items: any[] = [];
    for (const r of rows) {
      const paced = await this.prisma.whatsapp_broadcast_sends.count({ where: { run_id: r.id, status: 'PACED' } });
      const pending = await this.prisma.whatsapp_broadcast_sends.count({ where: { run_id: r.id, status: 'PENDING' } });
      items.push({ id: r.id, run_at: r.run_at, total: r.total, sent: r.sent, failed: r.failed, blocked: r.blocked, paced, pending, status: r.status, finished_at: r.finished_at });
    }
    return { items, total, page, pages: Math.max(1, Math.ceil(total / size)) };
  }

  async sends(orgId: string, id: string, runId: string, q: any = {}) {
    const run = await this.prisma.whatsapp_broadcast_runs.findFirst({ where: { id: runId, broadcast_id: id, organization_id: orgId } });
    if (!run) throw new NotFoundException('Disparo não encontrado.');
    const page = Math.max(1, parseInt(String(q.page || 1), 10) || 1);
    const size = Math.min(200, Math.max(10, parseInt(String(q.page_size || 50), 10) || 50));
    const where: any = { run_id: runId };
    if (q.status && q.status !== 'all') where.status = String(q.status).toUpperCase();
    const [total, rows] = await Promise.all([this.prisma.whatsapp_broadcast_sends.count({ where }), this.prisma.whatsapp_broadcast_sends.findMany({ where, orderBy: { created_at: 'asc' }, skip: (page - 1) * size, take: size })]);
    const chatIds = rows.map((r) => r.chat_id);
    const [contacts, chats] = await Promise.all([
      this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, wa_id: { in: chatIds } }, select: { wa_id: true, name: true, push_name: true, phone: true } }),
      this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, chat_id: { in: chatIds } }, select: { chat_id: true, name: true } }),
    ]);
    const cmap = new Map(contacts.map((c) => [c.wa_id, c] as [string, any]));
    const gmap = new Map(chats.map((c) => [c.chat_id, c] as [string, any]));
    return {
      items: rows.map((r) => ({ id: r.id, chat_id: r.chat_id, target_kind: r.target_kind, name: cmap.get(r.chat_id)?.name || cmap.get(r.chat_id)?.push_name || gmap.get(r.chat_id)?.name || (phoneFromJid(r.chat_id) ? `+${phoneFromJid(r.chat_id)}` : r.chat_id), status: r.status, attempts: r.attempts, last_error: r.last_error, sent_at: r.sent_at })),
      total, page, pages: Math.max(1, Math.ceil(total / size)),
    };
  }

  // ---------------------------------------------------------------- disparo
  private pickCopy(b: any, copies: any[]) {
    if (!copies.length) return null;
    if (b.mode === 'random') return copies[Math.floor(Math.random() * copies.length)];
    return copies[b.last_copy_index % copies.length];
  }

  async fire(orgId: string, id: string, runAt = new Date()) {
    const b = await this.prisma.whatsapp_broadcasts.findFirst({ where: { id, organization_id: orgId } });
    if (!b) throw new NotFoundException('Broadcast não encontrado.');
    const session = await this.sessions.row(orgId);
    if (!session?.openwa_session_id || session.status !== 'ready') throw new BadRequestException('Conecte o WhatsApp antes de disparar.');
    const copies = await this.prisma.whatsapp_broadcast_copies.findMany({ where: { broadcast_id: id }, orderBy: { position: 'asc' } });
    const copy = this.pickCopy(b, copies);
    if (!copy) throw new BadRequestException('Cadastre ao menos uma copy antes de disparar.');
    const audience = await this.resolveAudience(orgId, b.targets);
    if (!audience.length) throw new BadRequestException('Audiência vazia.');
    let run: any;
    try {
      run = await this.prisma.whatsapp_broadcast_runs.create({ data: { broadcast_id: id, organization_id: orgId, run_at: runAt, copy_id: copy.id, messages: copy.messages as any, total: audience.length, status: 'running' } });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new BadRequestException('Já existe um disparo neste minuto.');
      throw e;
    }
    for (let i = 0; i < audience.length; i += 500) {
      await this.prisma.whatsapp_broadcast_sends.createMany({ data: audience.slice(i, i + 500).map((a) => ({ organization_id: orgId, broadcast_id: id, run_id: run.id, target_kind: a.target_kind, chat_id: a.chat_id, contact_id: a.contact_id, status: 'PENDING', next_at: new Date() })) });
    }
    const data: any = { last_copy_index: (b.last_copy_index + 1) % Math.max(1, copies.length) };
    await this.prisma.whatsapp_broadcasts.update({ where: { id }, data });
    if (b.delete_used) await this.prisma.whatsapp_broadcast_copies.delete({ where: { id: copy.id } }).catch(() => undefined);
    this.logger.log(`Broadcast ${b.name} disparado: ${audience.length} destinos (org=${orgId})`);
    return { run_id: run.id, total: audience.length };
  }

  // dispatcher: horários diários
  @Cron(CronExpression.EVERY_MINUTE)
  async dispatch() {
    const nowMin = brtMinuteOfDay();
    const active = await this.prisma.whatsapp_broadcasts.findMany({ where: { active: true } });
    for (const b of active) {
      if (!this.normTimes(b.times).includes(nowMin)) continue;
      if (!(await this.access.isOrgActive(b.organization_id))) continue;
      const runAt = new Date(); runAt.setSeconds(0, 0);
      try { await this.fire(b.organization_id, b.id, runAt); } catch (e: any) { this.logger.debug(`dispatch ${b.id}: ${e?.message || e}`); }
    }
  }

  // ---------------------------------------------------------------- worker
  onModuleInit() { this.loop().catch((e) => this.logger.error(`worker parou: ${e?.message || e}`)); }
  onModuleDestroy() { this.stopped = true; }

  private async loop() {
    if (this.loopRunning) return;
    this.loopRunning = true;
    while (!this.stopped) {
      let did = false;
      try {
        const orgs = await this.prisma.whatsapp_broadcast_sends.groupBy({ by: ['organization_id'], where: { status: 'PENDING', next_at: { lte: new Date() } } });
        for (const o of orgs) {
          if (this.busyOrgs.has(o.organization_id)) continue;
          this.busyOrgs.add(o.organization_id);
          did = true;
          this.processOrg(o.organization_id).catch((e) => this.logger.warn(`org ${o.organization_id}: ${e?.message || e}`)).finally(() => this.busyOrgs.delete(o.organization_id));
        }
      } catch (e: any) {
        this.logger.warn(`loop: ${e?.message || e}`);
      }
      await sleep(did ? 1500 : 4000);
    }
  }

  // 1 envio por vez por org, respeitando intervalo do broadcast e aquecimento.
  private async processOrg(orgId: string) {
    const session = await this.sessions.row(orgId);
    if (!session?.openwa_session_id || session.status !== 'ready') return;
    if (!(await this.access.isOrgActive(orgId))) return;
    for (let i = 0; i < 20; i++) {
      const send = await this.prisma.whatsapp_broadcast_sends.findFirst({ where: { organization_id: orgId, status: 'PENDING', next_at: { lte: new Date() } }, orderBy: { created_at: 'asc' } });
      if (!send) return;
      const run = await this.prisma.whatsapp_broadcast_runs.findUnique({ where: { id: send.run_id } });
      const bc = await this.prisma.whatsapp_broadcasts.findUnique({ where: { id: send.broadcast_id } });
      if (!run || !bc) { await this.prisma.whatsapp_broadcast_sends.update({ where: { id: send.id }, data: { status: 'FAILED', last_error: 'broadcast removido' } }); continue; }
      // aquecimento
      const can = await this.pacing.canSend({ paired_at: session.paired_at, pacing_enabled: session.pacing_enabled, organization_id: orgId }, send.chat_id);
      if (!can.ok) {
        const tomorrow = brtStartOfToday(new Date(Date.now() + 86_400_000));
        await this.prisma.whatsapp_broadcast_sends.update({ where: { id: send.id }, data: { status: 'PACED', next_at: tomorrow, last_error: can.reason || null } });
        await this.reconcile(run.id);
        continue;
      }
      await this.sendOne(session, send, run, bc);
      await this.reconcile(run.id);
      await sleep(Math.min(120000, Math.max(1000, bc.interval_ms || 4000)) * (0.8 + Math.random() * 0.4));
    }
  }

  private async sendOne(session: any, send: any, run: any, bc: any) {
    const msgs = this.normMessages(run.messages);
    const contact = send.contact_id ? await this.prisma.whatsapp_contacts.findUnique({ where: { id: send.contact_id } }) : null;
    const vars: Record<string, string> = { nome: contact?.name || contact?.push_name || '', name: contact?.name || contact?.push_name || '', telefone: contact?.phone || phoneFromJid(send.chat_id), phone: contact?.phone || phoneFromJid(send.chat_id) };
    if (msgs.some((m) => /\{\{\s*cliente\./i.test(String(m.text || '')))) Object.assign(vars, await this.crm.varsForChat(session.organization_id, send.chat_id));
    let idx = send.msg_index || 0;
    try {
      for (; idx < msgs.length; idx++) {
        const m = msgs[idx];
        if (m.delay_seconds) { await this.openwa.typing(session.openwa_session_id, send.chat_id, 'typing').catch(() => undefined); await sleep(Math.min(60, m.delay_seconds) * 1000); }
        const text = fillVars(m.text, vars);
        let r: any;
        if (m.media_id) {
          const media = await this.media.readBase64(session.organization_id, m.media_id);
          const kind = media.kind === 'voice' || media.kind === 'audio' ? 'audio' : media.kind === 'image' ? 'image' : media.kind === 'video' ? 'video' : 'document';
          r = await this.openwa.sendMedia(session.openwa_session_id, kind as any, send.chat_id, { base64: media.base64, mimetype: media.mime, filename: media.filename || undefined, caption: text || undefined, ...(media.kind === 'voice' ? { ptt: true } : {}) });
          await this.recordOut(session.organization_id, send.chat_id, r, media.kind === 'voice' ? 'voice' : kind, text || null, m.media_id);
        } else {
          r = await this.openwa.sendText(session.openwa_session_id, send.chat_id, text);
          await this.recordOut(session.organization_id, send.chat_id, r, 'text', text, null);
        }
        await this.prisma.whatsapp_broadcast_sends.update({ where: { id: send.id }, data: { msg_index: idx + 1 } });
      }
      await this.prisma.whatsapp_broadcast_sends.update({ where: { id: send.id }, data: { status: 'DONE', sent_at: new Date(), attempts: send.attempts + 1, last_error: null } });
    } catch (e: any) {
      const attempts = send.attempts + 1;
      const msg = (e instanceof OpenWaError ? `${e.code}: ${e.message}` : String(e?.message || e)).slice(0, 500);
      if (e instanceof OpenWaError && e.status === 429) {
        // pacing do gateway (se ligado) → espera e mantém PENDING
        await this.prisma.whatsapp_broadcast_sends.update({ where: { id: send.id }, data: { next_at: new Date(Date.now() + (e.retryAfterSeconds || 300) * 1000), last_error: msg } });
        return;
      }
      if (e instanceof OpenWaError && (e.status === 403 || /blocked|not.?found|invalid.*(number|jid)/i.test(msg))) {
        await this.prisma.whatsapp_broadcast_sends.update({ where: { id: send.id }, data: { status: 'BLOCKED', attempts, last_error: msg } });
        return;
      }
      await this.prisma.whatsapp_broadcast_sends.update({ where: { id: send.id }, data: attempts >= MAX_ATTEMPTS ? { status: 'FAILED', attempts, last_error: msg } : { attempts, last_error: msg, next_at: new Date(Date.now() + 60_000 * attempts) } });
    }
  }

  private async recordOut(orgId: string, chatId: string, r: any, type: string, body: string | null, mediaId: string | null) {
    const at = r?.timestamp ? new Date(Number(r.timestamp) * 1000) : new Date();
    const waId = String(r?.messageId || `bc_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    await this.prisma.whatsapp_messages
      .create({ data: { organization_id: orgId, chat_id: chatId, wa_message_id: waId, direction: 'OUT', type, body, media_id: mediaId, ack: 1, timestamp: at, extra: { broadcast: true } } })
      .catch(async (e: any) => {
        if (e?.code === 'P2002') await this.prisma.whatsapp_messages.update({ where: { organization_id_wa_message_id: { organization_id: orgId, wa_message_id: waId } }, data: { extra: { broadcast: true } } }).catch(() => undefined);
      });
    await this.inbound.bumpChat(orgId, chatId, { type, body, direction: 'OUT', at });
    this.presenter.message(orgId, { waId });
  }

  private async reconcile(runId: string) {
    const g = await this.prisma.whatsapp_broadcast_sends.groupBy({ by: ['status'], where: { run_id: runId }, _count: { _all: true } });
    const n = (s: string) => g.find((x) => x.status === s)?._count._all || 0;
    const open = n('PENDING') + n('PACED');
    await this.prisma.whatsapp_broadcast_runs.update({ where: { id: runId }, data: { sent: n('DONE'), failed: n('FAILED'), blocked: n('BLOCKED'), status: open ? 'running' : 'done', ...(open ? {} : { finished_at: new Date() }) } });
  }
}
