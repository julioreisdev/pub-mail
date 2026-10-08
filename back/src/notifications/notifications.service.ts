import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createHash } from 'node:crypto';
import { promises as fsp } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { normalizeModules } from '../platform-billing/modules.const';
import { DEFAULT_PREFS, KINDS, KIND_GROUPS, Prefs, SOUNDS, VIBRATIONS, VIBRATION_PATTERNS, brtMinuteOfDay, decide, kindMeta, normalizePrefs } from './notification-kinds';
import { PushService } from './push.service';

// =============================================================================
// Notificações do painel: decide, por usuário, se um evento vira aviso no painel (WebSocket
// `notify`) e/ou push no aparelho (Web Push), respeitando as preferências dele
// (tipos, escopo, números, contatos, horário silencioso, som, vibração).
//
// Quem gera eventos chama `notify(orgId, input)` — nunca fala com push/socket direto.
// Candidatos: `to` explícito (ids) ou todos os usuários ativos da org com o módulo WhatsApp.
// Acesso por número: evento de um número só chega a quem pode ver aquele número.
// =============================================================================

export type NotifyInput = {
  kind: string;
  title: string;
  body?: string | null;
  url?: string | null;
  /** agrupa/substitui no aparelho (push `tag`) e vale para o freio anti-rajada */
  tag?: string | null;
  important?: boolean;
  data?: Record<string, unknown> | null;
  sessionId?: string | null;
  chat?: { uuid?: string | null; jid?: string | null; group?: boolean; assigned_user_id?: string | null; name?: string | null } | null;
  stageId?: string | null;
  /** destinatários explícitos (ids); ausente = todos da org com o módulo */
  to?: string[] | null;
  exclude?: string[] | null;
  /** ícone do evento (foto do contato/grupo, URL pública); usado se o usuário mantém "foto do contato" ligada */
  icon?: string | null;
  /** som/vibração forçados (avisos personalizados); ausente = preferência do usuário */
  sound?: string | null;
  vibrate?: string | null;
  /** ignora os filtros de evento (teste) — canais/quiet continuam valendo */
  bypass?: boolean;
};

type UserRow = { id: string; name: string; role: string; modules: unknown; whatsapp_sessions: unknown };

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const isAdmin = (role?: string | null) => role === 'OWNER' || role === 'ADMIN' || role === 'SUPER_ADMIN';
const clip = (s: unknown, n: number) => (s === null || s === undefined ? null : String(s).slice(0, n));
const THROTTLE_MS = 1_500; // só colapsa duplicatas imediatas (eco/reenvio) — cada mensagem avisa
const CACHE_MS = 60_000;

function deviceLabelOf(ua: string) {
  const u = ua || '';
  const os = /iPhone/i.test(u) ? 'iPhone' : /iPad/i.test(u) ? 'iPad' : /Android/i.test(u) ? 'Android' : /Windows/i.test(u) ? 'Windows' : /Mac OS/i.test(u) ? 'Mac' : /Linux/i.test(u) ? 'Linux' : 'Aparelho';
  const br = /Edg\//i.test(u) ? 'Edge' : /SamsungBrowser/i.test(u) ? 'Samsung' : /OPR\//i.test(u) ? 'Opera' : /Firefox/i.test(u) ? 'Firefox' : /CriOS|Chrome/i.test(u) ? 'Chrome' : /Safari/i.test(u) ? 'Safari' : '';
  return br ? `${os} · ${br}` : os;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly prefsCache = new Map<string, { at: number; prefs: Prefs }>();
  private readonly usersCache = new Map<string, { at: number; rows: UserRow[] }>();
  private readonly lastSent = new Map<string, number>(); // `${user}|${tag}` → ts (freio anti-rajada)

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly push: PushService,
  ) {}

  // ---------------------------------------------------------------- catálogo / vapid
  catalog() {
    return {
      push_enabled: this.push.enabled,
      vapid_public_key: this.push.enabled ? this.push.publicKey : null,
      groups: KIND_GROUPS,
      kinds: KINDS,
      sounds: SOUNDS,
      vibrations: VIBRATIONS,
      defaults: DEFAULT_PREFS,
    };
  }

  // ---------------------------------------------------------------- preferências
  async getPrefs(orgId: string, userId: string): Promise<Prefs> {
    const c = this.prefsCache.get(userId);
    if (c && Date.now() - c.at < CACHE_MS) return c.prefs;
    const row = await this.prisma.notification_prefs.findUnique({ where: { user_id: userId } }).catch(() => null);
    const prefs = normalizePrefs(row?.organization_id === orgId ? row?.prefs : null);
    this.prefsCache.set(userId, { at: Date.now(), prefs });
    return prefs;
  }

  async setPrefs(orgId: string, userId: string, raw: any): Promise<Prefs> {
    const cur = await this.getPrefs(orgId, userId);
    const prefs = normalizePrefs(raw, cur);
    await this.prisma.notification_prefs.upsert({
      where: { user_id: userId },
      create: { user_id: userId, organization_id: orgId, prefs: prefs as any },
      update: { organization_id: orgId, prefs: prefs as any },
    });
    this.prefsCache.set(userId, { at: Date.now(), prefs });
    return prefs;
  }

  // ---------------------------------------------------------------- inscrições (aparelhos)
  async listSubscriptions(orgId: string, userId: string) {
    const rows = await this.prisma.push_subscriptions.findMany({ where: { organization_id: orgId, user_id: userId }, orderBy: { created_at: 'desc' } });
    return rows.map((r) => ({ id: r.id, device_label: r.device_label, user_agent: r.user_agent, failures: r.failures, last_sent_at: r.last_sent_at, last_seen_at: r.last_seen_at, created_at: r.created_at }));
  }

  async subscribe(orgId: string, userId: string, dto: { endpoint: string; keys: { p256dh: string; auth: string }; user_agent?: string; device_label?: string }) {
    const endpoint = String(dto?.endpoint || '').trim();
    const p256dh = String(dto?.keys?.p256dh || '').trim();
    const auth = String(dto?.keys?.auth || '').trim();
    if (!/^https:\/\//.test(endpoint) || endpoint.length > 4000 || !p256dh || !auth) throw new BadRequestException('Inscrição de push inválida.');
    const ua = clip(dto.user_agent, 255) || null;
    const label = clip(dto.device_label, 80) || deviceLabelOf(ua || '');
    const hash = sha(endpoint);
    const now = new Date();
    // o mesmo aparelho pode trocar de usuário (logout/login): a inscrição passa a ser do usuário atual
    const row = await this.prisma.push_subscriptions.upsert({
      where: { endpoint_hash: hash },
      create: { organization_id: orgId, user_id: userId, endpoint_hash: hash, endpoint, p256dh, auth, user_agent: ua, device_label: label, last_seen_at: now },
      update: { organization_id: orgId, user_id: userId, endpoint, p256dh, auth, user_agent: ua, ...(dto.device_label ? { device_label: label } : {}), last_seen_at: now, failures: 0 },
    });
    return { id: row.id, device_label: row.device_label };
  }

  async unsubscribe(orgId: string, userId: string, by: { id?: string; endpoint?: string }) {
    const where: any = { organization_id: orgId, user_id: userId };
    if (by.id) where.id = String(by.id);
    else if (by.endpoint) where.endpoint_hash = sha(String(by.endpoint));
    else throw new BadRequestException('Informe o aparelho.');
    const r = await this.prisma.push_subscriptions.deleteMany({ where });
    return { removed: r.count };
  }

  async touchSubscription(orgId: string, userId: string, endpoint: string) {
    if (!endpoint) return;
    await this.prisma.push_subscriptions.updateMany({ where: { organization_id: orgId, user_id: userId, endpoint_hash: sha(String(endpoint)) }, data: { last_seen_at: new Date() } }).catch(() => undefined);
  }

  // ---------------------------------------------------------------- usuários candidatos
  private async orgUsers(orgId: string): Promise<UserRow[]> {
    const c = this.usersCache.get(orgId);
    if (c && Date.now() - c.at < CACHE_MS) return c.rows;
    const rows = await this.prisma.users.findMany({ where: { organization_id: orgId, active: true }, select: { id: true, name: true, role: true, modules: true, whatsapp_sessions: true } });
    const out = rows.map((r) => ({ id: r.id, name: r.name, role: String(r.role), modules: r.modules, whatsapp_sessions: r.whatsapp_sessions }));
    this.usersCache.set(orgId, { at: Date.now(), rows: out });
    return out;
  }

  invalidateUsers(orgId: string) {
    this.usersCache.delete(orgId);
  }

  private hasWhatsApp(u: UserRow) {
    return u.role === 'SUPER_ADMIN' || normalizeModules(u.modules).includes('whatsapp');
  }

  private canSeeSession(u: UserRow, sessionId?: string | null) {
    if (!sessionId) return true;
    if (isAdmin(u.role)) return true;
    if (!Array.isArray(u.whatsapp_sessions)) return true; // sem restrição = todos
    return (u.whatsapp_sessions as any[]).map(String).includes(String(sessionId));
  }

  async userName(userId: string) {
    const u = await this.prisma.users.findUnique({ where: { id: userId }, select: { name: true } }).catch(() => null);
    return u?.name || null;
  }

  // ---------------------------------------------------------------- envio
  /** Decide e envia para cada destinatário. Nunca lança (best-effort). Devolve o resumo. */
  async notify(orgId: string, input: NotifyInput) {
    const summary = { candidates: 0, sent: 0, inapp: 0, push: 0, skipped: 0 };
    try {
      const meta = kindMeta(input.kind);
      if (!meta && input.kind !== 'test') {
        this.logger.warn(`notify: tipo desconhecido ${input.kind}`);
        return summary;
      }
      const all = await this.orgUsers(orgId);
      const exclude = new Set((input.exclude || []).map(String));
      let targets: UserRow[];
      if (input.to) {
        const ids = new Set(input.to.map(String));
        targets = all.filter((u) => ids.has(u.id));
      } else targets = all.filter((u) => this.hasWhatsApp(u));
      targets = targets.filter((u) => !exclude.has(u.id) && this.canSeeSession(u, input.sessionId));
      summary.candidates = targets.length;
      if (!targets.length) return summary;

      const minute = brtMinuteOfDay();
      const online = new Set([...this.realtime.onlineUserIds(orgId, 'whatsapp'), ...this.realtime.onlineUserIds(orgId, 'team')]);
      const important = Boolean(input.important ?? meta?.important);
      const now = Date.now();
      const tag = input.tag || `${input.kind}:${input.chat?.uuid || input.sessionId || 'org'}`;

      for (const u of targets) {
        const prefs = await this.getPrefs(orgId, u.id);
        const d = input.bypass
          ? decide({ ...prefs, enabled: true }, { kind: 'test', userId: u.id, online: online.has(u.id), brtMinute: minute })
          : decide(prefs, { kind: input.kind, userId: u.id, sessionId: input.sessionId, chat: input.chat, stageId: input.stageId, online: online.has(u.id), brtMinute: minute });
        if (!d.send) {
          summary.skipped++;
          if (d.reason === 'quiet') await this.log(orgId, u.id, input, '', 'quiet');
          continue;
        }
        // freio anti-rajada: a mesma conversa não vira 10 avisos em 10 s (o push já substitui pelo tag)
        const key = `${u.id}|${tag}`;
        if (!input.bypass && input.kind !== 'custom' && now - (this.lastSent.get(key) || 0) < THROTTLE_MS) {
          summary.skipped++;
          continue;
        }
        this.lastSent.set(key, now);

        const sound = (input.sound && SOUNDS.includes(input.sound as any) ? input.sound : prefs.sound) as string;
        const vib = (input.vibrate && VIBRATIONS.includes(input.vibrate as any) ? input.vibrate : prefs.vibrate) as keyof typeof VIBRATION_PATTERNS;
        const channels: string[] = [];
        const logRow = await this.log(orgId, u.id, input, '', 'sent');
        const icon = (input.icon && (prefs.contact_photo || input.kind === 'custom') ? input.icon : null) || (prefs.icon.mode !== 'default' && prefs.icon.url ? prefs.icon.url : null);
        const base = {
          id: logRow?.id || null,
          icon,
          kind: input.kind,
          title: input.title,
          body: input.body || '',
          url: input.url || '/dashboard',
          tag,
          important,
          sound: d.quiet ? 'none' : sound,
          vibrate: d.quiet ? [] : VIBRATION_PATTERNS[vib] || [],
          at: new Date().toISOString(),
          data: input.data || {},
        };
        if (d.inapp) {
          this.realtime.toUser(orgId, u.id, 'notify', base);
          channels.push('inapp');
          summary.inapp++;
        }
        if (d.push) {
          // `only_when_away`: pula os aparelhos em que ESTE usuário está com o painel aberto (o aviso já aparece lá)
          const skip = d.away_only ? this.realtime.onlinePushHashes(orgId, u.id) : null;
          const n = await this.pushToUser(orgId, u.id, { ...base, silent: base.sound === 'none', renotify: true }, important, tag, skip);
          if (n > 0) {
            channels.push('push');
            summary.push++;
          } else if (!d.inapp) channels.push('no_device');
        }
        if (logRow) await this.prisma.notification_log.update({ where: { id: logRow.id }, data: { channels: channels.join(',').slice(0, 32), status: channels.includes('inapp') || channels.includes('push') ? 'sent' : 'no_device' } }).catch(() => undefined);
        summary.sent++;
      }
    } catch (e: any) {
      this.logger.warn(`notify ${input.kind} falhou: ${e?.message || e}`);
    }
    if (this.lastSent.size > 5000) this.lastSent.clear();
    return summary;
  }

  /** Push para todos os aparelhos do usuário. Devolve quantos receberam. */
  private async pushToUser(orgId: string, userId: string, payload: Record<string, unknown>, important: boolean, tag: string, skip: Set<string> | null = null) {
    if (!this.push.enabled) return 0;
    const subs = await this.prisma.push_subscriptions.findMany({ where: { organization_id: orgId, user_id: userId } });
    let ok = 0;
    for (const s of subs) {
      if (skip?.has(s.endpoint_hash)) continue; // painel aberto neste aparelho
      const r = await this.push.send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { urgency: important ? 'high' : 'normal', topic: tag });
      if (r.ok) {
        ok++;
        if (s.failures || !s.last_sent_at || Date.now() - new Date(s.last_sent_at).getTime() > 60_000) await this.prisma.push_subscriptions.update({ where: { id: s.id }, data: { failures: 0, last_sent_at: new Date() } }).catch(() => undefined);
      } else if (r.gone || s.failures + 1 >= 8) {
        await this.prisma.push_subscriptions.delete({ where: { id: s.id } }).catch(() => undefined);
        this.logger.log(`push: aparelho removido (${s.device_label || s.id}) — ${r.gone ? 'desinscrito' : 'falhas seguidas'}: ${r.error}`);
      } else {
        await this.prisma.push_subscriptions.update({ where: { id: s.id }, data: { failures: { increment: 1 } } }).catch(() => undefined);
        this.logger.debug(`push falhou (${s.device_label || s.id}): ${r.status} ${r.error}`);
      }
    }
    return ok;
  }

  private async log(orgId: string, userId: string, input: NotifyInput, channels: string, status: string) {
    return this.prisma.notification_log
      .create({ data: { organization_id: orgId, user_id: userId, kind: input.kind.slice(0, 32), title: input.title.slice(0, 160), body: clip(input.body, 500), url: clip(input.url, 500), data: (input.data as any) ?? undefined, channels, status } })
      .catch(() => null);
  }

  // ---------------------------------------------------------------- teste / histórico
  async sendTest(orgId: string, userId: string, channel: 'push' | 'inapp' | 'both' = 'both') {
    const subs = channel === 'inapp' ? 0 : await this.prisma.push_subscriptions.count({ where: { organization_id: orgId, user_id: userId } });
    const prefs = await this.getPrefs(orgId, userId);
    const sound = prefs.sound;
    const base = { kind: 'test', title: 'Teste do Pub Mail', body: 'Se você está vendo isto, as notificações estão funcionando. 🎉', url: '/whatsapp/notifications', tag: `test:${Date.now()}`, data: { test: true } };
    const online = new Set(this.realtime.onlineUserIds(orgId, 'whatsapp'));
    const payload = { id: null, ...base, icon: prefs.icon.mode !== 'default' && prefs.icon.url ? prefs.icon.url : null, important: false, sound, vibrate: VIBRATION_PATTERNS[prefs.vibrate], at: new Date().toISOString() };
    let inapp = false;
    let push = 0;
    if (channel !== 'push') {
      this.realtime.toUser(orgId, userId, 'notify', payload);
      inapp = online.has(userId);
    }
    if (channel !== 'inapp') push = await this.pushToUser(orgId, userId, { ...payload, silent: sound === 'none', renotify: true }, false, base.tag);
    await this.log(orgId, userId, base, [inapp ? 'inapp' : '', push ? 'push' : ''].filter(Boolean).join(','), inapp || push ? 'sent' : 'no_device');
    return { inapp, push, devices: subs, push_enabled: this.push.enabled };
  }

  async history(orgId: string, userId: string, page = 1, size = 50) {
    const p = Math.max(1, Number(page) || 1);
    const s = Math.min(100, Math.max(10, Number(size) || 50));
    const where = { organization_id: orgId, user_id: userId };
    const [total, rows, unread] = await Promise.all([
      this.prisma.notification_log.count({ where }),
      this.prisma.notification_log.findMany({ where, orderBy: { created_at: 'desc' }, skip: (p - 1) * s, take: s }),
      this.prisma.notification_log.count({ where: { ...where, read_at: null, status: 'sent' } }),
    ]);
    return { items: rows.map((r) => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, url: r.url, data: r.data, channels: r.channels ? r.channels.split(',') : [], status: r.status, read_at: r.read_at, created_at: r.created_at })), total, unread, page: p, pages: Math.max(1, Math.ceil(total / s)) };
  }

  async markRead(orgId: string, userId: string, ids?: string[] | null) {
    const where: any = { organization_id: orgId, user_id: userId, read_at: null };
    if (ids?.length) where.id = { in: ids.map(String).slice(0, 200) };
    const r = await this.prisma.notification_log.updateMany({ where, data: { read_at: new Date() } });
    return { updated: r.count };
  }

  async clearHistory(orgId: string, userId: string) {
    const r = await this.prisma.notification_log.deleteMany({ where: { organization_id: orgId, user_id: userId } });
    return { removed: r.count };
  }

  // ---------------------------------------------------------------- avisos personalizados
  private normRecipients(raw: any, me: string, admin: boolean) {
    const mode = ['me', 'all', 'users'].includes(String(raw?.mode)) ? String(raw.mode) : 'me';
    const ids = Array.isArray(raw?.user_ids) ? [...new Set(raw.user_ids.map((x: any) => String(x || '').trim()).filter(Boolean))].slice(0, 100) : [];
    if (!admin && mode !== 'me') throw new ForbiddenException('Só o dono ou um admin pode enviar avisos para outras pessoas.');
    if (mode === 'users' && !ids.length) throw new BadRequestException('Escolha pelo menos uma pessoa.');
    return { mode, user_ids: mode === 'users' ? ids : mode === 'me' ? [me] : [] };
  }

  private shapeCustom(r: any) {
    return { id: r.id, name: r.name, title: r.title, body: r.body, url: r.url, emoji: r.emoji, icon_url: r.icon_url, sound: r.sound, vibrate: r.vibrate, important: r.important, recipients: r.recipients, schedule_at: r.schedule_at, sent_at: r.sent_at, fire_count: r.fire_count, last_fired_at: r.last_fired_at, created_by: r.created_by, created_at: r.created_at, updated_at: r.updated_at };
  }

  async listCustom(orgId: string, userId: string, role: string) {
    const where: any = { organization_id: orgId };
    if (!isAdmin(role)) where.created_by = userId; // cada um vê os seus; dono/admin veem todos
    const rows = await this.prisma.notification_custom.findMany({ where, orderBy: { created_at: 'desc' }, take: 100 });
    const names = new Map<string, string>();
    for (const u of await this.orgUsers(orgId)) names.set(u.id, u.name);
    return rows.map((r) => ({ ...this.shapeCustom(r), created_by_name: names.get(r.created_by) || null }));
  }

  private customData(dto: any, me: string, admin: boolean) {
    const name = String(dto?.name || '').trim().slice(0, 80);
    const title = String(dto?.title || '').trim().slice(0, 120);
    if (!name || !title) throw new BadRequestException('Nome e título são obrigatórios.');
    const url = dto?.url ? String(dto.url).trim().slice(0, 500) : null;
    if (url && !/^(\/|https?:\/\/)/.test(url)) throw new BadRequestException('O link precisa começar com / (tela do painel) ou https://.');
    let schedule: Date | null = null;
    if (dto?.schedule_at) {
      schedule = new Date(dto.schedule_at);
      if (Number.isNaN(schedule.getTime())) throw new BadRequestException('Data de agendamento inválida.');
    }
    return {
      name,
      title,
      body: dto?.body ? String(dto.body).trim().slice(0, 500) : null,
      url,
      emoji: dto?.emoji ? String(dto.emoji).slice(0, 16) : null,
      icon_url: dto?.icon_url && /^(https?:\/\/|\/)/.test(String(dto.icon_url)) ? String(dto.icon_url).slice(0, 500) : null,
      sound: SOUNDS.includes(dto?.sound) ? dto.sound : 'default',
      vibrate: VIBRATIONS.includes(dto?.vibrate) ? dto.vibrate : 'short',
      important: Boolean(dto?.important),
      recipients: this.normRecipients(dto?.recipients, me, admin) as any,
      schedule_at: schedule,
      ...(schedule ? { sent_at: null } : {}),
    };
  }

  async createCustom(orgId: string, userId: string, role: string, dto: any) {
    const data = this.customData(dto, userId, isAdmin(role));
    const row = await this.prisma.notification_custom.create({ data: { ...data, organization_id: orgId, created_by: userId } });
    return this.shapeCustom(row);
  }

  private async customRow(orgId: string, userId: string, role: string, id: string) {
    const row = await this.prisma.notification_custom.findFirst({ where: { id: String(id), organization_id: orgId } });
    if (!row || (!isAdmin(role) && row.created_by !== userId)) throw new NotFoundException('Aviso não encontrado.');
    return row;
  }

  async updateCustom(orgId: string, userId: string, role: string, id: string, dto: any) {
    const cur = await this.customRow(orgId, userId, role, id);
    // o DTO chega com as chaves ausentes como `undefined` (campos de classe) — não podem apagar o que já existe
    const given = Object.fromEntries(Object.entries(dto || {}).filter(([, v]) => v !== undefined));
    const data = this.customData({ ...this.shapeCustom(cur), ...given, recipients: given.recipients ?? cur.recipients }, userId, isAdmin(role));
    const row = await this.prisma.notification_custom.update({ where: { id: cur.id }, data });
    return this.shapeCustom(row);
  }

  async deleteCustom(orgId: string, userId: string, role: string, id: string) {
    const cur = await this.customRow(orgId, userId, role, id);
    await this.prisma.notification_custom.delete({ where: { id: cur.id } });
    return { ok: true };
  }

  /** Dispara agora (pelo botão ou pelo agendamento). `to` = só para quem chamou (teste). */
  async fireCustom(orgId: string, userId: string, role: string, id: string, opts: { onlyMe?: boolean } = {}) {
    const row = await this.customRow(orgId, userId, role, id);
    const rec: any = row.recipients || {};
    let to: string[] | null;
    if (opts.onlyMe) to = [userId];
    else if (rec.mode === 'all') to = (await this.orgUsers(orgId)).filter((u) => this.hasWhatsApp(u) || isAdmin(u.role)).map((u) => u.id);
    else if (rec.mode === 'users') to = rec.user_ids || [];
    else to = [row.created_by];
    const title = `${row.emoji ? `${row.emoji} ` : ''}${row.title}`.slice(0, 160);
    const r = await this.notify(orgId, { kind: 'custom', title, body: row.body, url: row.url || '/whatsapp/notifications', tag: `custom:${row.id}:${Date.now()}`, important: row.important, sound: row.sound, vibrate: row.vibrate, icon: row.icon_url || null, to, data: { custom_id: row.id, by: userId } });
    await this.prisma.notification_custom.update({ where: { id: row.id }, data: { fire_count: { increment: 1 }, last_fired_at: new Date(), ...(opts.onlyMe ? {} : { sent_at: new Date() }) } }).catch(() => undefined);
    return r;
  }

  /** Avisos agendados (1×/min) — quem criou é o remetente. */
  @Cron(CronExpression.EVERY_MINUTE)
  async fireScheduled() {
    const rows = await this.prisma.notification_custom.findMany({ where: { schedule_at: { lte: new Date() }, sent_at: null }, take: 50 }).catch(() => []);
    for (const r of rows) {
      const claimed = await this.prisma.notification_custom.updateMany({ where: { id: r.id, sent_at: null }, data: { sent_at: new Date() } });
      if (!claimed.count) continue;
      try {
        await this.fireCustom(r.organization_id, r.created_by, 'ADMIN', r.id);
      } catch (e: any) {
        this.logger.warn(`aviso agendado ${r.id}: ${e?.message || e}`);
      }
    }
  }

  /** Histórico de 30 dias. */
  @Cron('0 20 4 * * *')
  async prune() {
    await this.prisma.notification_log.deleteMany({ where: { created_at: { lt: new Date(Date.now() - 30 * 86_400_000) } } }).catch(() => undefined);
  }

  // ---------------------------------------------------------------- ícone (upload)
  /** Guarda a imagem do ícone (192×192 PNG) em uploads/notification-icons/ (servido pelo nginx) e devolve a URL pública. */
  async saveIcon(orgId: string, userId: string, file: { buffer: Buffer; mimetype: string; size: number }, slot?: string | null) {
    if (!file?.buffer?.length) throw new BadRequestException('Envie uma imagem.');
    if (!/^image\/(png|jpe?g|webp|gif|svg\+xml)$/i.test(file.mimetype)) throw new BadRequestException('Formato inválido: use PNG, JPG, WEBP, GIF ou SVG.');
    if (file.size > 2 * 1024 * 1024) throw new BadRequestException('Imagem até 2 MB.');
    let out: Buffer;
    try {
      const sharp = require('sharp');
      out = await sharp(file.buffer, { density: 300 }).rotate().resize(192, 192, { fit: 'cover' }).png({ compressionLevel: 9 }).toBuffer();
    } catch (e: any) {
      throw new BadRequestException(`Não deu para processar a imagem (${e?.message || e}).`);
    }
    const safeSlot = slot ? String(slot).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 48) : '';
    const dir = join(process.cwd(), 'uploads', 'notification-icons');
    await fsp.mkdir(dir, { recursive: true, mode: 0o755 });
    const name = `${userId}${safeSlot ? `-${safeSlot}` : ''}.png`;
    await fsp.writeFile(join(dir, name), out, { mode: 0o644 });
    const base = String(process.env.PUBLIC_API_URL || 'https://api.reveleonline.com').replace(/\/+$/, '');
    return { url: `${base}/uploads/notification-icons/${name}?v=${Date.now()}` };
  }

  /** Dados para a tela: pessoas da org (destinatários dos avisos personalizados). */
  async people(orgId: string) {
    return (await this.orgUsers(orgId)).map((u) => ({ id: u.id, name: u.name, role: u.role, whatsapp: this.hasWhatsApp(u) }));
  }
}
