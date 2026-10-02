import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppPresenter } from './whatsapp-presenter.service';
import { isGroupJid } from './wa-jid.util';
import { RealtimeService } from '../realtime/realtime.service';
import { WhatsAppHooks } from './whatsapp-hooks.service';

// Atendimento das conversas do WhatsApp (painel de atendimento + bot):
//
//   service_status  none     → ninguém atendendo (conversa livre)
//                   bot      → o fluxo do bot está conduzindo (etiqueta automática "Bot")
//                   waiting  → na fila, esperando um atendente (bot transferiu / liberado)
//                   human    → um atendente está conversando (etiqueta automática = nome dele;
//                              sem atendente = respondido pelo celular)
//                   closed   → encerrado (a próxima mensagem do cliente recomeça pelo bot)
//
// Regra do "zera em 24 h": atendimento humano (ou fila) sem interação humana por
// `reset_hours` (padrão 24) é encerrado sozinho; a próxima mensagem volta ao bot.
// Tudo que muda aqui vira evento na linha do tempo (whatsapp_service_events) e em tempo real.

export const SERVICE_STATUSES = ['none', 'bot', 'waiting', 'human', 'closed'] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export type ServiceSettings = {
  reset_hours: number; // encerra atendimento parado há X horas (1–168)
  signature: { enabled: boolean; template: string }; // assinatura do atendente no início das mensagens
  auto_assign_on_reply: boolean; // quem responde pelo painel assume a conversa
  mark_read_on_open: boolean;
  distribution: 'off' | 'round_robin' | 'least_busy'; // fila → atendente online, sozinho
  rating: { enabled: boolean; question: string; thanks: string; hours: number }; // pesquisa ao encerrar
  optout: { enabled: boolean; keywords: string[]; reply: string }; // LGPD: palavra de saída
};
export const DISTRIBUTIONS = ['off', 'round_robin', 'least_busy'] as const;
const DEFAULT_SETTINGS: ServiceSettings = {
  reset_hours: 24,
  signature: { enabled: false, template: '*{nome}:*' },
  auto_assign_on_reply: true,
  mark_read_on_open: true,
  distribution: 'off',
  rating: { enabled: false, question: 'Antes de ir: de 1 a 5, como foi o nosso atendimento? Responda só com o número 🙂', thanks: 'Obrigado pela avaliação! 💚', hours: 24 },
  optout: { enabled: true, keywords: ['PARE', 'SAIR', 'CANCELAR'], reply: 'Pronto, você não receberá mais mensagens nossas. Se mudar de ideia, é só escrever.' },
};
const normWords = (v: unknown) => [...new Set((Array.isArray(v) ? v : String(v || '').split(',')).map((x) => String(x).trim().toUpperCase().slice(0, 30)).filter(Boolean))].slice(0, 20);
const TAG_COLORS = ['#25D366', '#128C7E', '#34B7F1', '#7C3AED', '#F59E0B', '#EF4444', '#EC4899', '#64748B'];

@Injectable()
export class WhatsAppAttendanceService {
  private readonly logger = new Logger(WhatsAppAttendanceService.name);
  constructor(private readonly prisma: PrismaService, private readonly presenter: WhatsAppPresenter, private readonly realtime: RealtimeService, private readonly hooks: WhatsAppHooks) {}
  private readonly rrLast = new Map<string, string>(); // round-robin: último atendente por org

  // ---------------------------------------------------------------- configurações
  async settings(orgId: string): Promise<ServiceSettings> {
    const row = await this.prisma.whatsapp_sessions.findUnique({ where: { organization_id: orgId }, select: { settings: true } });
    const s: any = ((row?.settings as any) || {}).service || {};
    return {
      reset_hours: Math.min(168, Math.max(1, Number(s.reset_hours) || DEFAULT_SETTINGS.reset_hours)),
      signature: { enabled: Boolean(s.signature?.enabled), template: String(s.signature?.template || DEFAULT_SETTINGS.signature.template).slice(0, 60) },
      auto_assign_on_reply: s.auto_assign_on_reply !== false,
      mark_read_on_open: s.mark_read_on_open !== false,
      distribution: (DISTRIBUTIONS as readonly string[]).includes(s.distribution) ? s.distribution : 'off',
      rating: {
        enabled: Boolean(s.rating?.enabled),
        question: String(s.rating?.question || DEFAULT_SETTINGS.rating.question).slice(0, 500),
        thanks: String(s.rating?.thanks ?? DEFAULT_SETTINGS.rating.thanks).slice(0, 300),
        hours: Math.min(72, Math.max(1, Number(s.rating?.hours) || DEFAULT_SETTINGS.rating.hours)),
      },
      optout: {
        enabled: s.optout?.enabled !== false,
        keywords: s.optout?.keywords !== undefined ? normWords(s.optout.keywords) : DEFAULT_SETTINGS.optout.keywords,
        reply: String(s.optout?.reply ?? DEFAULT_SETTINGS.optout.reply).slice(0, 500),
      },
    };
  }

  async updateSettings(orgId: string, dto: any) {
    const row = await this.prisma.whatsapp_sessions.findUnique({ where: { organization_id: orgId } });
    if (!row) throw new BadRequestException('Conecte o WhatsApp primeiro.');
    const cur = await this.settings(orgId);
    const next: ServiceSettings = {
      reset_hours: dto?.reset_hours !== undefined ? Math.min(168, Math.max(1, parseInt(String(dto.reset_hours), 10) || 24)) : cur.reset_hours,
      signature: {
        enabled: dto?.signature?.enabled !== undefined ? Boolean(dto.signature.enabled) : cur.signature.enabled,
        template: dto?.signature?.template !== undefined ? String(dto.signature.template || '').trim().slice(0, 60) || DEFAULT_SETTINGS.signature.template : cur.signature.template,
      },
      auto_assign_on_reply: dto?.auto_assign_on_reply !== undefined ? Boolean(dto.auto_assign_on_reply) : cur.auto_assign_on_reply,
      mark_read_on_open: dto?.mark_read_on_open !== undefined ? Boolean(dto.mark_read_on_open) : cur.mark_read_on_open,
      distribution: dto?.distribution !== undefined && (DISTRIBUTIONS as readonly string[]).includes(dto.distribution) ? dto.distribution : cur.distribution,
      rating: {
        enabled: dto?.rating?.enabled !== undefined ? Boolean(dto.rating.enabled) : cur.rating.enabled,
        question: dto?.rating?.question !== undefined ? String(dto.rating.question || '').trim().slice(0, 500) || DEFAULT_SETTINGS.rating.question : cur.rating.question,
        thanks: dto?.rating?.thanks !== undefined ? String(dto.rating.thanks || '').trim().slice(0, 300) : cur.rating.thanks,
        hours: dto?.rating?.hours !== undefined ? Math.min(72, Math.max(1, parseInt(String(dto.rating.hours), 10) || 24)) : cur.rating.hours,
      },
      optout: {
        enabled: dto?.optout?.enabled !== undefined ? Boolean(dto.optout.enabled) : cur.optout.enabled,
        keywords: dto?.optout?.keywords !== undefined ? normWords(dto.optout.keywords) : cur.optout.keywords,
        reply: dto?.optout?.reply !== undefined ? String(dto.optout.reply || '').trim().slice(0, 500) : cur.optout.reply,
      },
    };
    if (next.optout.enabled && !next.optout.keywords.length) throw new BadRequestException('Informe pelo menos uma palavra de descadastro.');
    await this.prisma.whatsapp_sessions.update({ where: { id: row.id }, data: { settings: { ...((row.settings as any) || {}), service: next } } });
    return next;
  }

  /** Texto com a assinatura do atendente, se ligada ("*Ana:*\nOlá…"). */
  async sign(orgId: string, userId: string | null | undefined, text: string) {
    if (!userId || !text) return text;
    const cfg = await this.settings(orgId);
    if (!cfg.signature.enabled) return text;
    const name = await this.userName(userId);
    if (!name) return text;
    const first = name.split(/\s+/)[0];
    const sig = cfg.signature.template.replace(/\{nome\}/g, name).replace(/\{primeiro_nome\}/g, first);
    return `${sig}\n${text}`;
  }

  // ---------------------------------------------------------------- usuários / atendentes
  private readonly userCache = new Map<string, { name: string; at: number }>();
  async userName(userId: string) {
    const c = this.userCache.get(userId);
    if (c && Date.now() - c.at < 5 * 60_000) return c.name;
    const u = await this.prisma.users.findUnique({ where: { id: userId }, select: { name: true, email: true } }).catch(() => null);
    const name = String(u?.name || u?.email?.split('@')[0] || '').trim();
    this.userCache.set(userId, { name, at: Date.now() });
    return name;
  }

  async attendants(orgId: string) {
    const users = await this.prisma.users.findMany({
      where: { organization_id: orgId, active: true },
      select: { id: true, name: true, email: true, role: true, modules: true },
      orderBy: { name: 'asc' },
    });
    return users
      .filter((u) => u.role === 'SUPER_ADMIN' || (Array.isArray(u.modules) && (u.modules as any[]).includes('whatsapp')))
      .map((u) => ({ id: u.id, name: u.name || u.email, email: u.email, role: u.role }));
  }

  // ---------------------------------------------------------------- etiquetas
  async listTags(orgId: string) {
    const tags = await this.prisma.whatsapp_tags.findMany({ where: { organization_id: orgId }, orderBy: [{ position: 'asc' }, { name: 'asc' }] });
    if (!tags.length) return [];
    // contagem por etiqueta (JSON_CONTAINS no MySQL)
    const counts = await Promise.all(
      tags.map((t) =>
        this.prisma.whatsapp_chats.count({ where: { organization_id: orgId, tags: { array_contains: t.id } } }).catch(() => 0),
      ),
    );
    return tags.map((t, i) => ({ id: t.id, name: t.name, color: t.color, position: t.position, count: counts[i] }));
  }

  async createTag(orgId: string, dto: any) {
    const name = String(dto?.name || '').trim().slice(0, 40);
    if (!name) throw new BadRequestException('Dê um nome à etiqueta.');
    if (['bot', 'aguardando', 'encerrado', 'celular'].includes(name.toLowerCase())) throw new BadRequestException('Esse nome é reservado para as etiquetas automáticas.');
    const n = await this.prisma.whatsapp_tags.count({ where: { organization_id: orgId } });
    if (n >= 100) throw new BadRequestException('Limite de 100 etiquetas.');
    const color = /^#[0-9a-f]{6}$/i.test(String(dto?.color || '')) ? String(dto.color) : TAG_COLORS[n % TAG_COLORS.length];
    try {
      const t = await this.prisma.whatsapp_tags.create({ data: { organization_id: orgId, name, color, position: n } });
      this.presenter.invalidateTags(orgId);
      return { id: t.id, name: t.name, color: t.color, position: t.position, count: 0 };
    } catch (e: any) {
      if (e?.code === 'P2002') throw new BadRequestException('Já existe uma etiqueta com esse nome.');
      throw e;
    }
  }

  async updateTag(orgId: string, id: string, dto: any) {
    const t = await this.prisma.whatsapp_tags.findFirst({ where: { id, organization_id: orgId } });
    if (!t) throw new NotFoundException('Etiqueta não encontrada.');
    const data: any = {};
    if (dto?.name !== undefined) {
      const name = String(dto.name || '').trim().slice(0, 40);
      if (!name) throw new BadRequestException('Nome vazio.');
      data.name = name;
    }
    if (dto?.color !== undefined && /^#[0-9a-f]{6}$/i.test(String(dto.color))) data.color = String(dto.color);
    if (dto?.position !== undefined) data.position = Math.max(0, parseInt(String(dto.position), 10) || 0);
    try {
      const u = await this.prisma.whatsapp_tags.update({ where: { id }, data });
      this.presenter.invalidateTags(orgId);
      return { id: u.id, name: u.name, color: u.color, position: u.position };
    } catch (e: any) {
      if (e?.code === 'P2002') throw new BadRequestException('Já existe uma etiqueta com esse nome.');
      throw e;
    }
  }

  async removeTag(orgId: string, id: string) {
    const t = await this.prisma.whatsapp_tags.findFirst({ where: { id, organization_id: orgId } });
    if (!t) throw new NotFoundException('Etiqueta não encontrada.');
    const chats = await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, tags: { array_contains: id } }, select: { id: true, chat_id: true, tags: true } });
    for (const c of chats) {
      const next = (Array.isArray(c.tags) ? (c.tags as string[]) : []).filter((x) => x !== id);
      await this.prisma.whatsapp_chats.update({ where: { id: c.id }, data: { tags: next } });
      this.presenter.chat(orgId, c.chat_id);
    }
    await this.prisma.whatsapp_tags.delete({ where: { id } });
    this.presenter.invalidateTags(orgId);
    return { ok: true, removed_from: chats.length };
  }

  async setChatTags(orgId: string, chatId: string, tagIds: unknown, userId?: string | null) {
    const chat = await this.chatRow(orgId, chatId);
    const valid = await this.prisma.whatsapp_tags.findMany({ where: { organization_id: orgId }, select: { id: true } });
    const allowed = new Set(valid.map((v) => v.id));
    const ids = [...new Set((Array.isArray(tagIds) ? tagIds : []).map(String).filter((x) => allowed.has(x)))].slice(0, 20);
    await this.prisma.whatsapp_chats.update({ where: { id: chat.id }, data: { tags: ids } });
    await this.event(orgId, chatId, 'tags', userId || null, { tags: ids });
    return this.shaped(orgId, chatId);
  }

  /** Acrescenta/remove etiquetas (usado pelo bot). */
  async changeTags(orgId: string, chatId: string, add: string[] = [], remove: string[] = []) {
    const chat = await this.prisma.whatsapp_chats.findUnique({ where: { organization_id_chat_id: { organization_id: orgId, chat_id: chatId } } });
    if (!chat) return;
    const valid = await this.prisma.whatsapp_tags.findMany({ where: { organization_id: orgId }, select: { id: true } });
    const allowed = new Set(valid.map((v) => v.id));
    const cur = new Set((Array.isArray(chat.tags) ? (chat.tags as string[]) : []).filter((x) => allowed.has(x)));
    for (const a of add) if (allowed.has(a)) cur.add(a);
    for (const r of remove) cur.delete(r);
    await this.prisma.whatsapp_chats.update({ where: { id: chat.id }, data: { tags: [...cur].slice(0, 20) } });
    this.presenter.chat(orgId, chatId);
  }

  // ---------------------------------------------------------------- estado do atendimento
  private async chatRow(orgId: string, chatId: string) {
    const c = await this.prisma.whatsapp_chats.findUnique({ where: { organization_id_chat_id: { organization_id: orgId, chat_id: chatId } } });
    if (!c) throw new NotFoundException('Conversa não encontrada.');
    return c;
  }

  private async shaped(orgId: string, chatId: string) {
    const c = await this.chatRow(orgId, chatId);
    const [shaped] = await this.presenter.shapeChats(orgId, [c]);
    this.presenter.chat(orgId, chatId);
    return shaped;
  }

  async event(orgId: string, chatId: string, event: string, userId: string | null, meta?: any) {
    await this.prisma.whatsapp_service_events
      .create({ data: { organization_id: orgId, chat_id: chatId, event: event.slice(0, 32), user_id: userId, meta: meta ?? undefined } })
      .catch(() => undefined);
  }

  async events(orgId: string, chatId: string) {
    const rows = await this.prisma.whatsapp_service_events.findMany({ where: { organization_id: orgId, chat_id: chatId }, orderBy: { created_at: 'desc' }, take: 50 });
    const names = new Map<string, string>();
    for (const r of rows) if (r.user_id && !names.has(r.user_id)) names.set(r.user_id, await this.userName(r.user_id));
    return rows.map((r) => ({ id: r.id, event: r.event, user: r.user_id ? { id: r.user_id, name: names.get(r.user_id) || null } : null, meta: r.meta, created_at: r.created_at }));
  }

  /** Muda o estado do atendimento (uso interno: bot, runner, inbound). */
  async setStatus(orgId: string, chatId: string, status: ServiceStatus, opts: { userId?: string | null; assign?: string | null; event?: string; meta?: any; actor?: string | null } = {}) {
    const c = await this.prisma.whatsapp_chats.findUnique({ where: { organization_id_chat_id: { organization_id: orgId, chat_id: chatId } } });
    if (!c) return null;
    const now = new Date();
    const data: any = { service_status: status };
    if (status === 'human' || status === 'waiting' || status === 'bot') {
      if (c.service_status === 'none' || c.service_status === 'closed' || !c.service_started_at) data.service_started_at = now;
      data.service_closed_at = null;
    }
    if (status === 'human') data.service_last_human_at = now;
    if (opts.assign !== undefined) data.assigned_user_id = opts.assign;
    if (status === 'closed' || status === 'none' || status === 'bot') {
      if (opts.assign === undefined) data.assigned_user_id = null;
      if (status === 'closed') data.service_closed_at = now;
    }
    await this.prisma.whatsapp_chats.update({ where: { id: c.id }, data });
    if (opts.event) await this.event(orgId, chatId, opts.event, opts.actor ?? opts.userId ?? null, opts.meta);
    this.presenter.chat(orgId, chatId);
    // entrou na fila sem dono → distribuição automática (se ligada), excluindo quem liberou
    if (status === 'waiting' && !data.assigned_user_id) void this.autoAssign(orgId, chatId, opts.actor ?? null).catch((e) => this.logger.warn(`distribuição ${chatId}: ${e?.message || e}`));
    return { ...c, ...data };
  }

  // ---------------------------------------------------------------- distribuição automática
  /** Escolhe um atendente ONLINE (conectado ao módulo pelo WebSocket) conforme a regra da org. */
  private async pickAttendant(orgId: string, mode: ServiceSettings['distribution'], exclude: string | null) {
    const online = new Set(this.realtime.onlineUserIds(orgId, 'whatsapp'));
    const pool = (await this.attendants(orgId)).filter((a) => online.has(a.id) && a.id !== exclude);
    if (!pool.length) return null;
    if (mode === 'least_busy') {
      const counts = await this.prisma.whatsapp_chats.groupBy({ by: ['assigned_user_id'], where: { organization_id: orgId, service_status: 'human', assigned_user_id: { in: pool.map((a) => a.id) } }, _count: { _all: true } });
      const n = new Map(counts.map((c) => [c.assigned_user_id as string, c._count._all]));
      return [...pool].sort((a, b) => (n.get(a.id) || 0) - (n.get(b.id) || 0) || a.name.localeCompare(b.name))[0];
    }
    const sorted = [...pool].sort((a, b) => a.id.localeCompare(b.id));
    const last = this.rrLast.get(orgId);
    const idx = last ? sorted.findIndex((a) => a.id === last) : -1;
    return sorted[(idx + 1) % sorted.length];
  }

  async autoAssign(orgId: string, chatId: string, exclude: string | null = null) {
    const s = await this.settings(orgId);
    if (s.distribution === 'off') return null;
    const c = await this.prisma.whatsapp_chats.findUnique({ where: { organization_id_chat_id: { organization_id: orgId, chat_id: chatId } } });
    if (!c || c.service_status !== 'waiting' || c.assigned_user_id) return null;
    const pick = await this.pickAttendant(orgId, s.distribution, exclude);
    if (!pick) return null;
    this.rrLast.set(orgId, pick.id);
    await this.setStatus(orgId, chatId, 'human', { assign: pick.id, event: 'auto_assigned', meta: { to: pick.id, mode: s.distribution } });
    this.presenter.emit(orgId, 'wa:assigned', { chat_id: chatId, user_id: pick.id, mode: s.distribution });
    return pick;
  }

  /** Fila parada (ninguém online na hora): tenta de novo a cada minuto. */
  @Cron(CronExpression.EVERY_MINUTE)
  async distributeQueue() {
    const orgs = await this.prisma.whatsapp_chats.groupBy({ by: ['organization_id'], where: { service_status: 'waiting', assigned_user_id: null } }).catch(() => []);
    for (const o of orgs) {
      const s = await this.settings(o.organization_id).catch(() => null);
      if (!s || s.distribution === 'off') continue;
      const rows = await this.prisma.whatsapp_chats.findMany({ where: { organization_id: o.organization_id, service_status: 'waiting', assigned_user_id: null }, orderBy: { service_started_at: 'asc' }, take: 50 });
      for (const c of rows) {
        const picked = await this.autoAssign(o.organization_id, c.chat_id).catch(() => null);
        if (!picked) break; // ninguém online: não adianta insistir nas outras
      }
    }
  }

  /**
   * Ações do painel: assumir, transferir, liberar para a fila, encerrar.
   * ("Enviar para o bot" fica no serviço do bot, que precisa do fluxo.)
   */
  async action(orgId: string, userId: string, chatId: string, action: string, targetUserId?: string | null) {
    const c = await this.chatRow(orgId, chatId);
    if (isGroupJid(chatId)) throw new BadRequestException('Atendimento é só para conversas individuais.');
    switch (action) {
      case 'assume':
        await this.setStatus(orgId, chatId, 'human', { assign: userId, event: 'assumed', userId, actor: userId });
        await this.stopBot(orgId, chatId);
        break;
      case 'transfer': {
        if (!targetUserId) throw new BadRequestException('Escolha para quem transferir.');
        const ok = (await this.attendants(orgId)).some((a) => a.id === targetUserId);
        if (!ok) throw new BadRequestException('Esse usuário não atende o WhatsApp desta organização.');
        await this.setStatus(orgId, chatId, 'human', { assign: targetUserId, event: 'transferred', actor: userId, meta: { from: c.assigned_user_id, to: targetUserId } });
        await this.stopBot(orgId, chatId);
        break;
      }
      case 'release':
        await this.setStatus(orgId, chatId, 'waiting', { assign: null, event: 'released', actor: userId });
        await this.stopBot(orgId, chatId);
        break;
      case 'close':
        await this.setStatus(orgId, chatId, 'closed', { event: 'closed', actor: userId });
        await this.stopBot(orgId, chatId);
        // pesquisa de satisfação (se ligada) — só quando um humano encerra pelo painel
        if (c.service_status === 'human' || c.service_status === 'waiting') this.hooks.emitServiceClosed({ orgId, chatId, userId, assignedUserId: c.assigned_user_id || null });
        break;
      case 'reopen':
        await this.setStatus(orgId, chatId, 'none', { event: 'reopened', actor: userId });
        break;
      default:
        throw new BadRequestException('Ação inválida.');
    }
    return this.shaped(orgId, chatId);
  }

  /** Encerra o bot daquela conversa (quando um humano assume). */
  async stopBot(orgId: string, chatId: string, status: 'handoff' | 'stopped' | 'done' = 'handoff') {
    await this.prisma.whatsapp_bot_sessions
      .updateMany({ where: { organization_id: orgId, chat_id: chatId, status: { in: ['active', 'waiting'] } }, data: { status, wait_until: null } })
      .catch(() => undefined);
  }

  // ---------------------------------------------------------------- ganchos do pipeline
  /** Atendente respondeu pelo painel. */
  async onPanelSend(orgId: string, chatId: string, userId: string | null | undefined) {
    if (!userId || isGroupJid(chatId)) return;
    const c = await this.prisma.whatsapp_chats.findUnique({ where: { organization_id_chat_id: { organization_id: orgId, chat_id: chatId } } });
    if (!c) return;
    const cfg = await this.settings(orgId);
    const assign = cfg.auto_assign_on_reply && !c.assigned_user_id ? userId : undefined;
    const wasHuman = c.service_status === 'human';
    await this.setStatus(orgId, chatId, 'human', { assign, event: wasHuman ? undefined : 'assumed', actor: userId, userId });
    if (c.service_status === 'bot') await this.stopBot(orgId, chatId);
  }

  /** Alguém respondeu pelo celular (eco que não saiu do Pub Mail). */
  async onPhoneSend(orgId: string, chatId: string) {
    if (isGroupJid(chatId)) return;
    const c = await this.prisma.whatsapp_chats.findUnique({ where: { organization_id_chat_id: { organization_id: orgId, chat_id: chatId } } });
    if (!c) return;
    await this.setStatus(orgId, chatId, 'human', { event: c.service_status === 'human' ? undefined : 'phone_reply' });
    if (c.service_status === 'bot') await this.stopBot(orgId, chatId);
  }

  // ---------------------------------------------------------------- "zera em 24 h"
  /** O atendimento humano/fila venceu (sem interação humana há reset_hours)? */
  expired(c: { service_status: string; service_last_human_at: Date | null; service_started_at: Date | null; updated_at?: Date }, resetHours: number) {
    if (c.service_status !== 'human' && c.service_status !== 'waiting') return false;
    const ref = c.service_last_human_at || c.service_started_at;
    if (!ref) return true;
    return Date.now() - new Date(ref).getTime() > resetHours * 3600_000;
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async closeStale() {
    const orgs = await this.prisma.whatsapp_chats.groupBy({ by: ['organization_id'], where: { service_status: { in: ['human', 'waiting'] } } }).catch(() => []);
    for (const o of orgs as any[]) {
      const orgId = o.organization_id as string;
      const cfg = await this.settings(orgId);
      const limit = new Date(Date.now() - cfg.reset_hours * 3600_000);
      const stale = await this.prisma.whatsapp_chats.findMany({
        where: {
          organization_id: orgId,
          service_status: { in: ['human', 'waiting'] },
          OR: [{ service_last_human_at: { lt: limit } }, { service_last_human_at: null, service_started_at: { lt: limit } }],
        },
        select: { chat_id: true },
        take: 500,
      });
      for (const s of stale) await this.setStatus(orgId, s.chat_id, 'closed', { event: 'auto_closed', meta: { reset_hours: cfg.reset_hours } });
      if (stale.length) this.logger.log(`atendimentos encerrados por inatividade org=${orgId}: ${stale.length}`);
    }
  }

  // ---------------------------------------------------------------- respostas rápidas
  async listQuickReplies(orgId: string) {
    const rows = await this.prisma.whatsapp_quick_replies.findMany({ where: { organization_id: orgId }, orderBy: [{ position: 'asc' }, { shortcut: 'asc' }] });
    const mediaIds = rows.map((r) => r.media_id).filter(Boolean) as string[];
    const medias = mediaIds.length ? await this.prisma.whatsapp_media.findMany({ where: { id: { in: mediaIds }, organization_id: orgId } }) : [];
    const mm = new Map(medias.map((m) => [m.id, m] as [string, any]));
    return rows.map((r) => ({ id: r.id, shortcut: r.shortcut, title: r.title, text: r.text, media: r.media_id ? this.presenter.mediaPublic(mm.get(r.media_id)) : null, position: r.position }));
  }

  private cleanShortcut(v: unknown) {
    const s = String(v || '').trim().replace(/^\/+/, '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_\-à-ú]/gi, '').slice(0, 40);
    if (!s) throw new BadRequestException('Informe o atalho (ex.: boasvindas).');
    return s;
  }

  async createQuickReply(orgId: string, dto: any) {
    const shortcut = this.cleanShortcut(dto?.shortcut);
    const text = String(dto?.text || '').slice(0, 4096);
    const mediaId = dto?.media_id ? String(dto.media_id) : null;
    if (!text.trim() && !mediaId) throw new BadRequestException('A resposta precisa de texto ou mídia.');
    if (mediaId && !(await this.prisma.whatsapp_media.findFirst({ where: { id: mediaId, organization_id: orgId } }))) throw new BadRequestException('Mídia inválida.');
    const n = await this.prisma.whatsapp_quick_replies.count({ where: { organization_id: orgId } });
    if (n >= 300) throw new BadRequestException('Limite de 300 respostas rápidas.');
    try {
      await this.prisma.whatsapp_quick_replies.create({ data: { organization_id: orgId, shortcut, title: dto?.title ? String(dto.title).slice(0, 80) : null, text: text || null, media_id: mediaId, position: n } });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new BadRequestException(`O atalho /${shortcut} já existe.`);
      throw e;
    }
    return this.listQuickReplies(orgId);
  }

  async updateQuickReply(orgId: string, id: string, dto: any) {
    const r = await this.prisma.whatsapp_quick_replies.findFirst({ where: { id, organization_id: orgId } });
    if (!r) throw new NotFoundException('Resposta rápida não encontrada.');
    const data: any = {};
    if (dto?.shortcut !== undefined) data.shortcut = this.cleanShortcut(dto.shortcut);
    if (dto?.title !== undefined) data.title = dto.title ? String(dto.title).slice(0, 80) : null;
    if (dto?.text !== undefined) data.text = String(dto.text || '').slice(0, 4096) || null;
    if (dto?.media_id !== undefined) {
      const mediaId = dto.media_id ? String(dto.media_id) : null;
      if (mediaId && !(await this.prisma.whatsapp_media.findFirst({ where: { id: mediaId, organization_id: orgId } }))) throw new BadRequestException('Mídia inválida.');
      data.media_id = mediaId;
    }
    if (dto?.position !== undefined) data.position = Math.max(0, parseInt(String(dto.position), 10) || 0);
    try {
      await this.prisma.whatsapp_quick_replies.update({ where: { id }, data });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new BadRequestException('Esse atalho já existe.');
      throw e;
    }
    return this.listQuickReplies(orgId);
  }

  async removeQuickReply(orgId: string, id: string) {
    const r = await this.prisma.whatsapp_quick_replies.findFirst({ where: { id, organization_id: orgId } });
    if (!r) throw new NotFoundException('Resposta rápida não encontrada.');
    await this.prisma.whatsapp_quick_replies.delete({ where: { id } });
    return this.listQuickReplies(orgId);
  }
}
