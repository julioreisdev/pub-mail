import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppPresenter } from './whatsapp-presenter.service';
import { isGroupJid } from './wa-jid.util';
import { formatBRL } from './whatsapp-crm.service';

// ============================================================================
// Métricas de atendimento do WhatsApp (fase 4 do CRM). Tudo calculado em memória a partir
// de mensagens + eventos de atendimento + avaliações + cobranças do período (teto de
// 100 mil mensagens). Dias em BRT.
//
// Multi-número: `q.session_id` filtra um número; sem filtro, entram todos os números permitidos
// ao usuário (`allowed`, null = todos). Uma conversa é (número, jid). `by_session` quebra os
// volumes por número.
// ============================================================================

const BRT = 'America/Sao_Paulo';
const dayOf = (d: Date | string) => new Intl.DateTimeFormat('en-CA', { timeZone: BRT, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const median = (a: number[]) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const START_EVENTS = new Set(['assumed', 'handoff', 'released', 'auto_assigned', 'phone_reply', 'transferred', 'reopened', 'bot_started', 'bot_start', 'bot']);
const END_EVENTS = new Set(['closed', 'auto_closed']);
const ckey = (sessionId: string | null | undefined, jid: string) => `${sessionId || ''}|${jid}`;

type SessionStat = { session_id: string; label: string; color: string; phone: string | null; msgs_in: number; msgs_out: number; chats_active: number; assumed: number; closed: number };

@Injectable()
export class WhatsAppMetricsService {
  constructor(private readonly prisma: PrismaService, private readonly presenter: WhatsAppPresenter) {}

  private range(q: any) {
    const to = q.to ? new Date(String(q.to)) : new Date();
    const from = q.from ? new Date(String(q.from)) : new Date(to.getTime() - 30 * 86_400_000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) throw new BadRequestException('Período inválido.');
    if (to.getTime() - from.getTime() > 400 * 86_400_000) throw new BadRequestException('Período máximo: 400 dias.');
    return { from, to };
  }

  /** Cláusula `session_id`: número pedido (se permitido) ou todos os permitidos. null = nada a mostrar. */
  private sessionFilter(sessionId: unknown, allowed: Set<string> | null): { session_id?: any } | null {
    const sid = sessionId ? String(sessionId) : '';
    if (sid) return allowed !== null && !allowed.has(sid) ? null : { session_id: sid };
    if (allowed === null) return {};
    if (!allowed.size) return null;
    return { session_id: { in: [...allowed] } };
  }

  async overview(orgId: string, q: any = {}, allowed: Set<string> | null = null) {
    const { from, to } = this.range(q);
    const smap = await this.presenter.sessionMap(orgId);
    // sem nenhum número permitido: filtro impossível (resposta zerada, mesma forma)
    const sess = this.sessionFilter(q.session_id, allowed) ?? { session_id: '__none__' };
    const sessionIds = sess.session_id ? (typeof sess.session_id === 'string' ? [sess.session_id] : [...(sess.session_id.in as string[])]) : [...smap.keys()];
    const bySession = new Map<string, SessionStat>();
    for (const id of sessionIds) { const b = smap.get(id); if (b) bySession.set(id, { session_id: id, label: b.label, color: b.color, phone: b.phone, msgs_in: 0, msgs_out: 0, chats_active: 0, assumed: 0, closed: 0 }); }
    const sstat = (id: string | null | undefined) => (id ? bySession.get(id) : undefined);

    const [messages, events, newChats, ratings, chargesCreated, chargesPaid, overdue, tags, stages, stageCounts, users, waitingNow, humanNow] = await Promise.all([
      this.prisma.whatsapp_messages.findMany({ where: { organization_id: orgId, ...sess, timestamp: { gte: from, lte: to }, revoked: false }, select: { session_id: true, chat_id: true, direction: true, timestamp: true, sent_by_user_id: true, extra: true }, orderBy: { timestamp: 'asc' }, take: 100_000 }),
      this.prisma.whatsapp_service_events.findMany({ where: { organization_id: orgId, ...sess, created_at: { gte: from, lte: to } }, orderBy: { created_at: 'asc' }, take: 100_000 }),
      this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, ...sess, created_at: { gte: from, lte: to } }, select: { created_at: true, kind: true } }),
      this.prisma.whatsapp_ratings.findMany({ where: { organization_id: orgId, ...sess, answered_at: { gte: from, lte: to } }, select: { score: true, user_id: true, comment: true } }),
      this.prisma.whatsapp_charges.findMany({ where: { organization_id: orgId, ...sess, created_at: { gte: from, lte: to } }, select: { status: true, amount_cents: true, origin: true } }),
      this.prisma.whatsapp_charges.aggregate({ where: { organization_id: orgId, ...sess, status: 'PAID', paid_at: { gte: from, lte: to } }, _count: { _all: true }, _sum: { amount_cents: true } }),
      this.prisma.whatsapp_charges.aggregate({ where: { organization_id: orgId, ...sess, status: 'PENDING', due_at: { lt: new Date() } }, _count: { _all: true }, _sum: { amount_cents: true } }),
      this.prisma.whatsapp_tags.findMany({ where: { organization_id: orgId } }),
      this.prisma.whatsapp_pipeline_stages.findMany({ where: { organization_id: orgId }, orderBy: { position: 'asc' } }),
      this.prisma.whatsapp_chats.groupBy({ by: ['stage_id'], where: { organization_id: orgId, ...sess, stage_id: { not: null }, archived: false }, _count: { _all: true }, _sum: { deal_cents: true } }),
      this.prisma.users.findMany({ where: { organization_id: orgId }, select: { id: true, name: true, email: true } }),
      this.prisma.whatsapp_chats.count({ where: { organization_id: orgId, ...sess, service_status: 'waiting' } }),
      this.prisma.whatsapp_chats.count({ where: { organization_id: orgId, ...sess, service_status: 'human' } }),
    ]);
    const uname = new Map(users.map((u) => [u.id, u.name || u.email]));

    // ---- por dia
    const days = new Map<string, { day: string; in: number; out: number; out_human: number; out_bot: number; new_chats: number; closed: number }>();
    const day = (d: Date | string) => { const k = dayOf(d); if (!days.has(k)) days.set(k, { day: k, in: 0, out: 0, out_human: 0, out_bot: 0, new_chats: 0, closed: 0 }); return days.get(k)!; };
    for (let t = new Date(from); t <= to; t = new Date(t.getTime() + 86_400_000)) day(t);
    day(to);

    // ---- mensagens: volumes + tempo até 1ª resposta humana (conversa = número + jid)
    const chatsActive = new Set<string>();
    const perUser = new Map<string, { sent: number; first: number[]; assumed: number; closed: number; ratings: number[] }>();
    const user = (id: string) => { if (!perUser.has(id)) perUser.set(id, { sent: 0, first: [], assumed: 0, closed: 0, ratings: [] }); return perUser.get(id)!; };
    const pendingSince = new Map<string, number>();
    const firstResponses: number[] = [];
    let msgsIn = 0, msgsOut = 0, outHuman = 0, outBot = 0, outAuto = 0;
    for (const m of messages) {
      const d = day(m.timestamp);
      const x: any = m.extra || {};
      const group = isGroupJid(m.chat_id);
      const k = ckey(m.session_id, m.chat_id);
      const ss = sstat(m.session_id);
      if (!group && !chatsActive.has(k)) { chatsActive.add(k); if (ss) ss.chats_active++; }
      if (m.direction === 'IN') {
        msgsIn++; d.in++; if (ss) ss.msgs_in++;
        if (!group && !pendingSince.has(k)) pendingSince.set(k, new Date(m.timestamp).getTime());
      } else {
        msgsOut++; d.out++; if (ss) ss.msgs_out++;
        const human = Boolean(m.sent_by_user_id);
        if (human) { outHuman++; d.out_human++; user(m.sent_by_user_id!).sent++; }
        else if (x.bot) { outBot++; d.out_bot++; }
        else outAuto++;
        if (!group && human && pendingSince.has(k)) {
          const sec = (new Date(m.timestamp).getTime() - pendingSince.get(k)!) / 1000;
          if (sec >= 0 && sec < 7 * 86_400) { firstResponses.push(sec); user(m.sent_by_user_id!).first.push(sec); }
          pendingSince.delete(k);
        } else if (!group && (human || x.bot)) pendingSince.delete(k);
      }
    }

    // ---- eventos: atendimentos, tempo de resolução, por atendente / por número
    const open = new Map<string, number>();
    const resolutions: number[] = [];
    let assumedN = 0, closedN = 0, autoAssigned = 0, handoffs = 0, optouts = 0;
    for (const e of events) {
      const meta: any = e.meta || {};
      const k = ckey(e.session_id, e.chat_id);
      const ss = sstat(e.session_id);
      if (e.event === 'assumed' || e.event === 'auto_assigned' || e.event === 'transferred') {
        assumedN++; if (ss) ss.assumed++;
        const who = e.event === 'assumed' ? e.user_id : meta.to;
        if (who) user(who).assumed++;
        if (e.event === 'auto_assigned') autoAssigned++;
      }
      if (e.event === 'handoff') handoffs++;
      if (e.event === 'opted_out') optouts++;
      if (START_EVENTS.has(e.event) && !open.has(k)) open.set(k, new Date(e.created_at).getTime());
      if (END_EVENTS.has(e.event)) {
        closedN++; day(e.created_at).closed++; if (ss) ss.closed++;
        if (e.user_id) user(e.user_id).closed++;
        const st = open.get(k);
        if (st) { const sec = (new Date(e.created_at).getTime() - st) / 1000; if (sec >= 0) resolutions.push(sec); open.delete(k); }
      }
    }
    for (const c of newChats) day(c.created_at).new_chats++;

    // ---- avaliações
    const scores = ratings.map((r) => r.score).filter((s): s is number => typeof s === 'number');
    const dist = [1, 2, 3, 4, 5].map((n) => ({ score: n, count: scores.filter((s) => s === n).length }));
    for (const r of ratings) if (r.user_id && typeof r.score === 'number') user(r.user_id).ratings.push(r.score);

    // ---- etiquetas (conversas ativas no período)
    const activePairs = [...chatsActive].slice(0, 5000).map((k) => { const i = k.indexOf('|'); return { session_id: k.slice(0, i), chat_id: k.slice(i + 1) }; }).filter((p) => p.session_id);
    const tagged = activePairs.length ? await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, OR: activePairs }, select: { tags: true } }) : [];
    const tagCount = new Map<string, number>();
    for (const c of tagged) for (const t of Array.isArray(c.tags) ? (c.tags as string[]) : []) tagCount.set(t, (tagCount.get(t) || 0) + 1);
    const byTag = tags.map((t) => ({ id: t.id, name: t.name, color: t.color, count: tagCount.get(t.id) || 0 })).filter((t) => t.count).sort((a, b) => b.count - a.count);

    // ---- funil (foto atual)
    const sc = new Map(stageCounts.map((s) => [s.stage_id as string, s]));
    const funnel = stages.map((s) => ({ id: s.id, name: s.name, color: s.color, kind: s.kind, count: sc.get(s.id)?._count._all || 0, deal_cents: sc.get(s.id)?._sum.deal_cents || 0, deal_label: formatBRL(sc.get(s.id)?._sum.deal_cents || 0) }));

    // ---- cobranças
    const created = chargesCreated.length;
    const createdCents = chargesCreated.reduce((a, c) => a + c.amount_cents, 0);
    const failed = chargesCreated.filter((c) => c.status === 'FAILED').length;

    const attendants = [...perUser.entries()]
      .map(([id, v]) => ({ id, name: uname.get(id) || null, sent: v.sent, assumed: v.assumed, closed: v.closed, first_response_avg_sec: avg(v.first), rating_avg: avg(v.ratings), rating_count: v.ratings.length }))
      .filter((a) => a.sent || a.assumed || a.closed || a.rating_count)
      .sort((a, b) => b.sent - a.sent);

    return {
      from: from.toISOString(), to: to.toISOString(),
      session_id: q.session_id ? String(q.session_id) : null,
      totals: {
        chats_active: chatsActive.size, new_chats: newChats.filter((c) => c.kind === 'individual').length, msgs_in: msgsIn, msgs_out: msgsOut, out_human: outHuman, out_bot: outBot, out_auto: outAuto,
        assumed: assumedN, closed: closedN, auto_assigned: autoAssigned, handoffs, optouts,
        first_response_avg_sec: avg(firstResponses), first_response_median_sec: median(firstResponses), first_response_n: firstResponses.length,
        resolution_avg_sec: avg(resolutions), resolution_median_sec: median(resolutions), resolution_n: resolutions.length,
        waiting_now: waitingNow,
        human_now: humanNow,
      },
      ratings: { count: scores.length, avg: avg(scores), distribution: dist, with_comment: ratings.filter((r) => r.comment).length },
      charges: { created, created_cents: createdCents, created_label: formatBRL(createdCents), paid: chargesPaid._count._all, paid_cents: chargesPaid._sum.amount_cents || 0, paid_label: formatBRL(chargesPaid._sum.amount_cents || 0), overdue: overdue._count._all, overdue_cents: overdue._sum.amount_cents || 0, overdue_label: formatBRL(overdue._sum.amount_cents || 0), failed },
      series: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)),
      attendants,
      by_session: [...bySession.values()],
      by_tag: byTag,
      funnel,
      truncated: messages.length >= 100_000 || events.length >= 100_000,
    };
  }
}
