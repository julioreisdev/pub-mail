import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../platform-billing/access.service';
import { OpenWaClient, OpenWaError } from './openwa.client';
import { WhatsAppSessionsService, SessionRow, sessionLabel } from './whatsapp-sessions.service';
import { WhatsAppMediaService } from './whatsapp-media.service';
import { WhatsAppPacingService, brtDayStart } from './whatsapp-pacing.service';
import { WhatsAppChatService } from './whatsapp-chat.service';
import { WhatsAppPresenter } from './whatsapp-presenter.service';
import { WhatsAppHooks } from './whatsapp-hooks.service';
import { WhatsAppCrmService } from './whatsapp-crm.service';
import { isLidJid, phoneFromJid } from './wa-jid.util';

// Broadcasts MULTI-NÚMERO: a campanha tem `session_ids` (1..N números da org). Horários diários
// (minuto-do-dia BRT), copies com rotação, audiência = contatos salvos/tags/selecionados + grupos.
//  - Contatos (saved/all/selected), com 2+ números, seguem a `distribution` da campanha:
//      'shared' ("Usar em conjunto", padrão): a audiência é SOMADA e dividida IGUALMENTE entre os
//        números conectados no disparo (1000 + 100 contatos → 550 por número). Cada número fica
//        primeiro com quem já conversa com ele; o excedente vai para os números com folga.
//      'own' ("Cada número dispara para seus contatos"): o contato sai pelo número DELE — o da
//        conversa mais recente ou, sem conversa, o número de cuja agenda ele veio
//        (`whatsapp_contact_sessions`); quem não é de nenhum dos números escolhidos fica de fora.
//    Grupos saem sempre pelo número da conversa do grupo.
//  - Fila `whatsapp_broadcast_sends` com `session_id`; worker processa POR NÚMERO (1 envio por vez
//    por número; números diferentes em paralelo), obedecendo ao ritmo (`pacing`: preset/intervalo/
//    jitter/limite diário/pausa a cada N/janela de horário) e ao aquecimento de cada número.
//  - PACED = limite do dia do número atingido → volta amanhã (o `dispatch` reabre os vencidos).
//  - Métricas por run e por número (`whatsapp_broadcast_runs.by_session`).

const MAX_ATTEMPTS = 3;

export type PacingPreset = 'fast' | 'normal' | 'safe' | 'very_safe' | 'custom';
export type PacingWindow = { start: string; end: string } | null;
export type BroadcastPacing = { preset: PacingPreset; interval_ms: number; jitter_pct: number; daily_limit: number | null; pause_every: number; pause_minutes: number; window: PacingWindow };

const PRESET_TABLE: Record<Exclude<PacingPreset, 'custom'>, Omit<BroadcastPacing, 'preset'> & { label: string; description: string; risk: 'high' | 'medium' | 'low' | 'minimal'; warning?: string }> = {
  fast: { label: 'Rápido', risk: 'high', description: '3 s entre envios (±30 %), sem pausas e sem limite diário.', warning: 'Risco ALTO de restrição ou banimento do número. Use só em números aquecidos e audiências que já conversaram com você.', interval_ms: 3000, jitter_pct: 30, daily_limit: null, pause_every: 0, pause_minutes: 0, window: null },
  normal: { label: 'Normal', risk: 'medium', description: '8 s entre envios (±30 %), pausa de 10 min a cada 50 envios.', interval_ms: 8000, jitter_pct: 30, daily_limit: null, pause_every: 50, pause_minutes: 10, window: null },
  safe: { label: 'Seguro', risk: 'low', description: '20 s entre envios (±40 %), pausa de 15 min a cada 30, até 300 envios por dia por número.', interval_ms: 20000, jitter_pct: 40, daily_limit: 300, pause_every: 30, pause_minutes: 15, window: null },
  very_safe: { label: 'Muito seguro', risk: 'minimal', description: '45 s entre envios (±50 %), pausa de 20 min a cada 20, até 150 por dia por número, só das 08:00 às 20:00.', interval_ms: 45000, jitter_pct: 50, daily_limit: 150, pause_every: 20, pause_minutes: 20, window: { start: '08:00', end: '20:00' } },
};
const PRESET_KEYS: PacingPreset[] = ['fast', 'normal', 'safe', 'very_safe', 'custom'];
const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function brtMinuteOfDay(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === 'hour')?.value || 0) % 24;
  const m = Number(parts.find((p) => p.type === 'minute')?.value || 0);
  return h * 60 + m;
}
const brtStartOfToday = (now = new Date()) => brtDayStart(now);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clamp = (v: any, min: number, max: number, dflt: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : dflt; };
const hhmmToMin = (s: string) => { const m = HHMM_RE.exec(String(s || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const isReady = (r: any) => Boolean(r?.openwa_session_id && r.status === 'ready');

// {{nome}} {{telefone}} + {{cliente.*}} (CRM). Chave fora do mapa fica como está.
export function fillVars(text: string, vars: Record<string, string>) {
  return String(text || '').replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (m, k) => { const key = String(k).toLowerCase(); return key in vars ? vars[key] ?? '' : m; });
}

type Target = { session_id: string; chat_id: string; contact_id: string | null; target_kind: 'contact' | 'group' };
export type BroadcastDistribution = 'shared' | 'own';
const normDistribution = (v: any): BroadcastDistribution => (v === 'own' ? 'own' : 'shared');
type SessionStats = { total: number; sent: number; failed: number; blocked: number; paced: number; pending: number };

@Injectable()
export class WhatsAppBroadcastsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppBroadcastsService.name);
  private stopped = false;
  private loopRunning = false;
  // chave de ocupação = id do NÚMERO (1 envio por vez por número; números diferentes em paralelo)
  private readonly busySessions = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly openwa: OpenWaClient,
    private readonly sessions: WhatsAppSessionsService,
    private readonly media: WhatsAppMediaService,
    private readonly pacing: WhatsAppPacingService,
    private readonly chat: WhatsAppChatService,
    private readonly access: AccessService,
    private readonly presenter: WhatsAppPresenter,
    private readonly crm: WhatsAppCrmService,
    private readonly hooks: WhatsAppHooks,
  ) {}

  // ---------------------------------------------------------------- presets / ritmo
  presets() {
    return {
      default: 'normal',
      items: (Object.keys(PRESET_TABLE) as Array<Exclude<PacingPreset, 'custom'>>).map((key) => ({ key, ...PRESET_TABLE[key] })).concat([{ key: 'custom', label: 'Personalizado', risk: 'medium', description: 'Você define intervalo, variação, limite diário, pausas e janela de horário.', interval_ms: 8000, jitter_pct: 30, daily_limit: null, pause_every: 0, pause_minutes: 0, window: null } as any]),
      limits: { interval_ms: { min: 1000, max: 120000 }, jitter_pct: { min: 0, max: 80 }, daily_limit: { min: 1, max: 5000 }, pause_every: { min: 0, max: 1000 }, pause_minutes: { min: 0, max: 240 } },
    };
  }

  /** Normaliza o JSON `pacing`. `legacyInterval` = coluna `interval_ms` de campanhas antigas (sem `pacing`). */
  private normPacing(raw: any, legacyInterval?: number | null): BroadcastPacing {
    const p = raw && typeof raw === 'object' ? raw : null;
    const preset: PacingPreset = p && PRESET_KEYS.includes(p.preset) ? p.preset : p ? 'custom' : legacyInterval ? 'custom' : 'normal';
    if (preset !== 'custom') {
      const t = PRESET_TABLE[preset];
      return { preset, interval_ms: t.interval_ms, jitter_pct: t.jitter_pct, daily_limit: t.daily_limit, pause_every: t.pause_every, pause_minutes: t.pause_minutes, window: t.window ? { ...t.window } : null };
    }
    const dl = Number(p?.daily_limit);
    const start = p?.window?.start, end = p?.window?.end;
    const window: PacingWindow = HHMM_RE.test(String(start || '')) && HHMM_RE.test(String(end || '')) && start !== end ? { start: String(start), end: String(end) } : null;
    return {
      preset,
      interval_ms: clamp(p?.interval_ms ?? legacyInterval, 1000, 120000, 8000),
      jitter_pct: clamp(p?.jitter_pct, 0, 80, 30),
      daily_limit: Number.isFinite(dl) && dl > 0 ? Math.min(5000, Math.round(dl)) : null,
      pause_every: clamp(p?.pause_every, 0, 1000, 0),
      pause_minutes: clamp(p?.pause_minutes, 0, 240, 0),
      window,
    };
  }

  private inWindow(w: PacingWindow, now = new Date()) {
    if (!w) return true;
    const s = hhmmToMin(w.start), e = hhmmToMin(w.end);
    if (s === null || e === null || s === e) return true;
    const n = brtMinuteOfDay(now);
    return s < e ? n >= s && n < e : n >= s || n < e; // janela que vira a meia-noite
  }
  /** Próximo início da janela (hoje se ainda não passou, senão amanhã), em BRT. */
  private nextWindowStart(w: PacingWindow, now = new Date()) {
    const s = w ? hhmmToMin(w.start) : null;
    if (s === null) return now;
    let at = new Date(brtStartOfToday(now).getTime() + s * 60_000);
    if (at.getTime() <= now.getTime()) at = new Date(at.getTime() + 86_400_000);
    return at;
  }
  /** Quando um envio PACED pode voltar: início do dia de amanhã (ou da janela de amanhã). */
  private tomorrowStart(w: PacingWindow) {
    const t = brtStartOfToday(new Date(Date.now() + 86_400_000));
    const s = w ? hhmmToMin(w.start) : null;
    return s === null ? t : new Date(t.getTime() + s * 60_000);
  }
  private intervalFor(p: BroadcastPacing) {
    const j = (p.jitter_pct || 0) / 100;
    return Math.round(p.interval_ms * (1 + (Math.random() * 2 - 1) * j));
  }

  // ---------------------------------------------------------------- normalização
  private normTargets(raw: any) {
    const t = raw && typeof raw === 'object' ? raw : {};
    const contacts = ['saved', 'all', 'none', 'selected'].includes(t.contacts) ? t.contacts : 'none';
    return {
      contacts,
      contact_ids: Array.isArray(t.contact_ids) ? [...new Set<string>(t.contact_ids.map((x: any) => String(x)))].slice(0, 5000) : [],
      tags: Array.isArray(t.tags) ? t.tags.map((x: any) => String(x).slice(0, 40)).slice(0, 50) : [],
      // uuids de conversas de grupo (campanhas antigas podem ter jids `@g.us` — aceitos como legado)
      groups: Array.isArray(t.groups) ? [...new Set<string>(t.groups.map((g: any) => String(g).trim()).filter((g: string) => UUID_RE.test(g) || /@g\.us$/.test(g)))].slice(0, 200) : [],
    };
  }
  private normSessionIds(raw: any): string[] {
    return Array.isArray(raw) ? [...new Set<string>(raw.map((x: any) => String(x)).filter(Boolean))].slice(0, 50) : [];
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

  /** Números escolhidos (validados contra a org). `strict` = id desconhecido vira 400; senão é ignorado (número apagado depois). */
  private async chosenSessions(orgId: string, raw: any, strict: boolean): Promise<SessionRow[]> {
    const ids = this.normSessionIds(raw);
    const all = await this.sessions.rowsOf(orgId);
    const found = ids.map((id) => all.find((r) => r.id === id)).filter(Boolean) as SessionRow[];
    if (strict && found.length !== ids.length) throw new BadRequestException('Um dos números escolhidos não existe nesta organização.');
    return found;
  }

  // ---------------------------------------------------------------- audiência
  /** jid pelo qual este NÚMERO fala com o contato (Baileys = telefone@c.us; whatsapp-web.js = @lid quando conhecido). */
  private jidForSession(s: SessionRow, c: { wa_id: string; phone: string | null; lid: string | null }) {
    const phoneJid = c.phone ? `${c.phone}@c.us` : null;
    if (String(s?.engine || 'wwjs') === 'baileys') return phoneJid || (!isLidJid(c.wa_id) && /@c\.us$/.test(c.wa_id) ? c.wa_id : null);
    if (c.lid && isLidJid(c.lid)) return c.lid;
    if (/@c\.us$|@lid$/.test(c.wa_id)) return c.wa_id;
    return phoneJid;
  }

  /**
   * Resolve a audiência em alvos `{session_id, chat_id (jid), contact_id, target_kind}`.
   * `chosen` = números da campanha; `pool` = números que recebem a divisão (os conectados no disparo).
   * `distribution` (só importa com 2+ números): 'shared' divide os contatos igualmente entre o `pool`
   * (preferindo o número com que o contato já conversa); 'own' manda cada contato pelo número com que
   * ele já conversa e deixa de fora quem não conversou com nenhum (`unassigned`).
   * Grupo sai pelo número da conversa do grupo.
   */
  private async resolveAudience(orgId: string, rawTargets: any, chosen: SessionRow[], pool: SessionRow[], distribution: BroadcastDistribution = 'shared'): Promise<{ targets: Target[]; warnings: string[]; unassigned: number }> {
    const t = this.normTargets(rawTargets);
    const chosenIds = chosen.map((r) => r.id);
    const poolIds = new Set(pool.map((r) => r.id));
    const base: any = { organization_id: orgId, is_blocked: false, opted_out_at: null }; // LGPD: quem pediu PARE não recebe
    const select = { id: true, wa_id: true, tags: true, phone: true, lid: true };
    const rows: any[] = [];
    if (t.contacts === 'all' || t.contacts === 'saved') {
      // ordem fixa: a divisão entre os números é a mesma a cada disparo (o contato não fica trocando de número)
      const all = await this.prisma.whatsapp_contacts.findMany({ where: { ...base, ...(t.contacts === 'saved' ? { saved: true } : {}) }, select, orderBy: { id: 'asc' } });
      for (const r of all) if (!t.tags.length || (Array.isArray(r.tags) && (r.tags as any[]).some((x) => t.tags.includes(String(x))))) rows.push(r);
    }
    if (t.contact_ids.length) rows.push(...(await this.prisma.whatsapp_contacts.findMany({ where: { ...base, id: { in: t.contact_ids } }, select, orderBy: { id: 'asc' } })));
    const contacts = [...new Map(rows.map((r) => [r.id, r] as [string, any])).values()];

    // conversas já existentes desses contatos nos números escolhidos (qualquer forma de jid)
    const cand = new Set<string>();
    for (const c of contacts) { cand.add(c.wa_id); if (c.phone) cand.add(`${c.phone}@c.us`); if (c.lid) cand.add(c.lid); }
    const chats = cand.size && chosenIds.length ? await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, session_id: { in: chosenIds }, chat_id: { in: [...cand] }, kind: 'individual' }, select: { session_id: true, chat_id: true, last_message_at: true } }) : [];
    type Hit = { session_id: string; chat_id: string; last_message_at: Date | null };
    const byJid = new Map<string, Hit[]>();
    for (const ch of chats) byJid.set(ch.chat_id, [...(byJid.get(ch.chat_id) || []), ch as Hit]);
    const hitsOf = (c: any): Hit[] => ([c.wa_id, c.phone ? `${c.phone}@c.us` : null, c.lid].filter(Boolean) as string[]).flatMap((j) => byJid.get(j) || []);
    // de qual número cada contato veio (agenda sincronizada por ele ou mensagem por ele)
    const links = contacts.length && chosenIds.length ? await this.prisma.whatsapp_contact_sessions.findMany({ where: { organization_id: orgId, session_id: { in: chosenIds } }, select: { contact_id: true, session_id: true } }) : [];
    const ownersOf = new Map<string, string[]>();
    for (const l of links) ownersOf.set(l.contact_id, [...(ownersOf.get(l.contact_id) || []), l.session_id]);
    const chosenById = new Map(chosen.map((r) => [r.id, r] as [string, SessionRow]));
    const recent = (a: Hit, b: Hit) => (b.last_message_at?.getTime() || 0) - (a.last_message_at?.getTime() || 0);

    const out: Target[] = [];
    const seen = new Set<string>();
    const push = (x: Target) => { const k = `${x.session_id}|${x.chat_id}`; if (!seen.has(k)) { seen.add(k); out.push(x); return true; } return false; };
    const warnings: string[] = [];
    let unassigned = 0;
    // com 1 número não há o que repartir: tudo sai por ele
    const mode: BroadcastDistribution = chosen.length > 1 ? distribution : 'shared';

    if (mode === 'own') {
      // cada número dispara para SEUS contatos: o da conversa mais recente; sem conversa, o número
      // de cuja agenda o contato veio (se for de vários, o conectado com menos envios nesta rodada).
      // Número desconectado: o envio fica na fila dele até reconectar.
      const load = new Map<string, number>();
      const bump = (sid: string) => load.set(sid, (load.get(sid) || 0) + 1);
      for (const c of contacts) {
        const hits = hitsOf(c).sort(recent);
        const hit = hits.find((h) => poolIds.has(h.session_id)) || hits[0];
        if (hit) { if (push({ session_id: hit.session_id, chat_id: hit.chat_id, contact_id: c.id, target_kind: 'contact' })) bump(hit.session_id); continue; }
        const owners = (ownersOf.get(c.id) || []).filter((sid) => chosenById.has(sid)).sort((a, b) => Number(poolIds.has(b)) - Number(poolIds.has(a)) || (load.get(a) || 0) - (load.get(b) || 0));
        let sent = false;
        for (const sid of owners) {
          const jid = this.jidForSession(chosenById.get(sid)!, c);
          if (jid && push({ session_id: sid, chat_id: jid, contact_id: c.id, target_kind: 'contact' })) { bump(sid); sent = true; break; }
        }
        if (!sent) unassigned++;
      }
      if (unassigned) warnings.push(`${unassigned.toLocaleString('pt-BR')} contato(s) não são de nenhum dos números escolhidos (não estão na agenda deles nem conversaram com eles) e ficam de fora. Para incluí-los, use "Usar em conjunto".`);
    } else if (pool.length) {
      // usar em conjunto: soma a audiência e divide IGUALMENTE entre os números conectados.
      // 1ª passada: cada número fica com quem já conversa com ele, até a sua cota;
      // 2ª passada: com quem veio da agenda dele; 3ª: o excedente e os sem dono vão para quem tem folga.
      const n = pool.length;
      const base_ = Math.floor(contacts.length / n);
      const extra = contacts.length % n;
      const quota = new Map(pool.map((p, idx) => [p.id, base_ + (idx < extra ? 1 : 0)] as [string, number]));
      const load = new Map(pool.map((p) => [p.id, 0] as [string, number]));
      const room = (sid: string) => (quota.get(sid) || 0) - (load.get(sid) || 0);
      const take = (sid: string) => load.set(sid, (load.get(sid) || 0) + 1);
      const byLoad = (a: string, b: string) => (load.get(a) || 0) - (load.get(b) || 0);
      const noChat: any[] = [];
      const rest: any[] = [];
      for (const c of contacts) {
        const all = hitsOf(c).filter((h) => poolIds.has(h.session_id));
        if (!all.length) { noChat.push(c); continue; }
        const hit = all.filter((h) => room(h.session_id) > 0).sort((a, b) => byLoad(a.session_id, b.session_id) || recent(a, b))[0];
        if (!hit) { rest.push(c); continue; }
        // `push` falso = outra linha de contato já apontava para a mesma conversa (duplicata): não reenvia por outro número
        if (push({ session_id: hit.session_id, chat_id: hit.chat_id, contact_id: c.id, target_kind: 'contact' })) take(hit.session_id);
      }
      for (const c of noChat) {
        const owners = (ownersOf.get(c.id) || []).filter((sid) => poolIds.has(sid) && room(sid) > 0).sort(byLoad);
        let sent = false;
        for (const sid of owners) {
          const jid = this.jidForSession(chosenById.get(sid)!, c);
          if (jid && push({ session_id: sid, chat_id: jid, contact_id: c.id, target_kind: 'contact' })) { take(sid); sent = true; break; }
        }
        if (!sent) rest.push(c);
      }
      for (const c of rest) {
        // número com mais folga primeiro; se ele não consegue falar com o contato (sem jid), tenta o próximo
        const order = [...pool].sort((a, b) => room(b.id) - room(a.id));
        const own = hitsOf(c);
        for (const s2 of order) {
          const jid = own.find((h) => h.session_id === s2.id)?.chat_id || this.jidForSession(s2, c);
          if (jid && push({ session_id: s2.id, chat_id: jid, contact_id: c.id, target_kind: 'contact' })) { take(s2.id); break; }
        }
      }
    }

    if (t.groups.length) {
      const uuids = t.groups.filter((g) => UUID_RE.test(g));
      const jids = t.groups.filter((g) => !UUID_RE.test(g));
      type GroupRow = { id: string; session_id: string; chat_id: string };
      const [byUuid, byLegacy]: [GroupRow[], GroupRow[]] = await Promise.all([
        uuids.length ? this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, id: { in: uuids }, kind: 'group' }, select: { id: true, session_id: true, chat_id: true } }) : ([] as GroupRow[]),
        jids.length && chosenIds.length ? this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, session_id: { in: chosenIds }, chat_id: { in: jids }, kind: 'group' }, select: { id: true, session_id: true, chat_id: true } }) : ([] as GroupRow[]),
      ]);
      for (const g of uuids) { const row = byUuid.find((r) => r.id === g); if (row) push({ session_id: row.session_id, chat_id: row.chat_id, contact_id: null, target_kind: 'group' }); else warnings.push(`Grupo ${g} não encontrado.`); }
      for (const g of jids) { const rowsG = byLegacy.filter((r) => r.chat_id === g); if (!rowsG.length) warnings.push(`Grupo ${g} não encontrado nos números escolhidos.`); for (const row of rowsG) push({ session_id: row.session_id, chat_id: row.chat_id, contact_id: null, target_kind: 'group' }); }
    }
    return { targets: out, warnings, unassigned };
  }

  /** Estimativa: `{ contacts, groups, total, by_session:[{session_id,label,color,connected,contacts,groups}], distribution, unassigned }`. */
  async audience(orgId: string, rawTargets: any, sessionIds?: string[], rawDistribution?: any) {
    const distribution = normDistribution(rawDistribution);
    const all = await this.sessions.rowsOf(orgId);
    const ids = this.normSessionIds(sessionIds);
    const chosen = ids.length ? all.filter((r) => ids.includes(r.id)) : all;
    const ready = chosen.filter(isReady);
    const pool = ready.length ? ready : chosen; // sem ninguém conectado, estima como se todos estivessem
    const { targets, warnings, unassigned } = await this.resolveAudience(orgId, rawTargets, chosen, pool, distribution);
    const stats = new Map<string, { contacts: number; groups: number }>();
    for (const x of targets) { const s = stats.get(x.session_id) || { contacts: 0, groups: 0 }; if (x.target_kind === 'group') s.groups++; else s.contacts++; stats.set(x.session_id, s); }
    const rowsFor = [...chosen, ...all.filter((r) => stats.has(r.id) && !chosen.some((c) => c.id === r.id))]; // grupos de números fora da seleção
    const by_session = rowsFor.map((r) => ({ session_id: r.id, label: sessionLabel(r), color: r.color || null, connected: isReady(r), contacts: stats.get(r.id)?.contacts || 0, groups: stats.get(r.id)?.groups || 0 }));
    const contacts = targets.filter((x) => x.target_kind === 'contact').length;
    const groups = targets.length - contacts;
    return { contacts, groups, total: targets.length, by_session, warnings, distribution: chosen.length > 1 ? distribution : 'shared', unassigned };
  }

  // ---------------------------------------------------------------- CRUD
  private shape(b: any, extra: any = {}) {
    const pacing = this.normPacing(b.pacing, b.interval_ms);
    return { id: b.id, name: b.name, session_ids: this.normSessionIds(b.session_ids), distribution: normDistribution(b.distribution), pacing, targets: this.normTargets(b.targets), times: this.normTimes(b.times), mode: b.mode, delete_used: b.delete_used, active: b.active, interval_ms: pacing.interval_ms, risk_ack_at: b.risk_ack_at, created_at: b.created_at, ...extra };
  }

  /** Campanhas que tenham ao menos um número em `allowed` (null = todos). */
  async list(orgId: string, allowed: Set<string> | null = null) {
    const rows = await this.prisma.whatsapp_broadcasts.findMany({ where: { organization_id: orgId }, orderBy: { created_at: 'desc' }, include: { _count: { select: { copies: true } } } });
    const sessRows = await this.sessions.rowsOf(orgId);
    const smap = await this.presenter.sessionMap(orgId);
    const warmCache = new Map<string, any>();
    const warmOf = async (sid: string) => {
      if (!warmCache.has(sid)) {
        const r = sessRows.find((x) => x.id === sid);
        warmCache.set(sid, r ? await this.pacing.summary({ id: r.id, paired_at: r.paired_at, pacing_enabled: r.pacing_enabled, organization_id: orgId }).catch(() => null) : null);
      }
      return warmCache.get(sid);
    };
    const start = brtStartOfToday();
    const nowMin = brtMinuteOfDay();
    const out: any[] = [];
    for (const b of rows) {
      const sids = this.normSessionIds(b.session_ids);
      if (allowed && !sids.some((s) => allowed.has(s))) continue;
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
      const warmup = (await Promise.all(sids.map(warmOf))).filter(Boolean);
      out.push(this.shape(b, {
        copies_count: b._count.copies,
        sessions: sids.map((s) => smap.get(s)).filter(Boolean),
        warmup,
        audience: await this.audience(orgId, b.targets, sids, b.distribution),
        time_status,
      }));
    }
    return out;
  }

  private validateInput(dto: any) {
    const name = String(dto.name || '').trim().slice(0, 255);
    if (!name) throw new BadRequestException('Nome é obrigatório.');
    const targets = this.normTargets(dto.targets);
    if (targets.contacts === 'none' && !targets.contact_ids.length && !targets.groups.length) throw new BadRequestException('Escolha ao menos contatos ou grupos.');
    return { name, targets, times: this.normTimes(dto.times), mode: dto.mode === 'random' ? 'random' : 'sequential', delete_used: Boolean(dto.delete_used) };
  }

  async create(orgId: string, dto: any) {
    const v = this.validateInput(dto);
    let sessions = await this.chosenSessions(orgId, dto.session_ids, true);
    if (!sessions.length) {
      const all = await this.sessions.rowsOf(orgId);
      if (all.length === 1) sessions = all; // org com 1 número: assume
      else throw new BadRequestException('Escolha ao menos um número para disparar.');
    }
    const pacing = this.normPacing(dto.pacing, dto.interval_ms);
    // só o ritmo "Rápido" exige confirmar o risco (os demais já têm pausas/limites)
    if (pacing.preset === 'fast' && !dto.risk_ack) throw new BadRequestException('O ritmo "Rápido" tem risco ALTO de restrição do número. Confirme que entende o risco.');
    const b = await this.prisma.whatsapp_broadcasts.create({ data: { organization_id: orgId, ...v, session_ids: sessions.map((s) => s.id), distribution: normDistribution(dto.distribution), pacing: pacing as any, interval_ms: pacing.interval_ms, active: Boolean(dto.active), risk_ack_at: new Date() } });
    return this.shape(b);
  }

  async update(orgId: string, id: string, dto: any) {
    const b = await this.prisma.whatsapp_broadcasts.findFirst({ where: { id, organization_id: orgId } });
    if (!b) throw new NotFoundException('Broadcast não encontrado.');
    const v = this.validateInput({ ...b, ...dto, targets: dto.targets ?? b.targets, times: dto.times ?? b.times });
    let sessionIds = this.normSessionIds(b.session_ids);
    if (dto.session_ids !== undefined) {
      const sessions = await this.chosenSessions(orgId, dto.session_ids, true);
      if (!sessions.length) throw new BadRequestException('Escolha ao menos um número para disparar.');
      sessionIds = sessions.map((s) => s.id);
    }
    const prev = this.normPacing(b.pacing, b.interval_ms);
    const pacing = dto.pacing !== undefined ? this.normPacing(dto.pacing) : dto.interval_ms !== undefined ? this.normPacing({ ...prev, preset: 'custom', interval_ms: dto.interval_ms }) : prev;
    if (pacing.preset === 'fast' && prev.preset !== 'fast' && !dto.risk_ack) throw new BadRequestException('O ritmo "Rápido" tem risco ALTO de restrição do número. Confirme que entende o risco.');
    const upd = await this.prisma.whatsapp_broadcasts.update({
      where: { id },
      data: { ...v, session_ids: sessionIds, ...(dto.distribution !== undefined ? { distribution: normDistribution(dto.distribution) } : {}), pacing: pacing as any, interval_ms: pacing.interval_ms, ...(dto.active !== undefined ? { active: Boolean(dto.active) } : {}), ...(dto.risk_ack ? { risk_ack_at: new Date() } : {}) },
    });
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

  private bySessionOf(run: any): Record<string, SessionStats> {
    const raw = run?.by_session && typeof run.by_session === 'object' ? run.by_session : {};
    const out: Record<string, SessionStats> = {};
    for (const [sid, v] of Object.entries<any>(raw)) out[sid] = { total: Number(v?.total || 0), sent: Number(v?.sent || 0), failed: Number(v?.failed || 0), blocked: Number(v?.blocked || 0), paced: Number(v?.paced || 0), pending: Number(v?.pending || 0) };
    return out;
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
    const smap = await this.presenter.sessionMap(orgId);
    const items: any[] = [];
    for (const r of rows) {
      const by = this.bySessionOf(r);
      const sum = (k: keyof SessionStats) => Object.values(by).reduce((a, s) => a + s[k], 0);
      const hasBy = Object.keys(by).length > 0;
      const paced = hasBy ? sum('paced') : await this.prisma.whatsapp_broadcast_sends.count({ where: { run_id: r.id, status: 'PACED' } });
      const pending = hasBy ? sum('pending') : await this.prisma.whatsapp_broadcast_sends.count({ where: { run_id: r.id, status: 'PENDING' } });
      items.push({
        id: r.id, run_at: r.run_at, total: r.total, sent: r.sent, failed: r.failed, blocked: r.blocked, paced, pending, status: r.status, finished_at: r.finished_at,
        by_session: Object.entries(by).map(([sid, s]) => ({ session_id: sid, session: smap.get(sid) || null, ...s })),
      });
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
    if (q.session_id) where.session_id = String(q.session_id);
    const [total, rows] = await Promise.all([this.prisma.whatsapp_broadcast_sends.count({ where }), this.prisma.whatsapp_broadcast_sends.findMany({ where, orderBy: { created_at: 'asc' }, skip: (page - 1) * size, take: size })]);
    const jids = [...new Set(rows.map((r) => r.chat_id))];
    const sids = [...new Set(rows.map((r) => r.session_id).filter(Boolean))] as string[];
    const [contacts, chats, smap] = await Promise.all([
      jids.length ? this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, OR: [{ wa_id: { in: jids } }, { lid: { in: jids } }] }, select: { wa_id: true, lid: true, name: true, push_name: true, phone: true } }) : [],
      jids.length && sids.length ? this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, session_id: { in: sids }, chat_id: { in: jids } }, select: { id: true, session_id: true, chat_id: true, name: true } }) : [],
      this.presenter.sessionMap(orgId),
    ]);
    const cmap = new Map<string, any>();
    for (const c of contacts) { cmap.set(c.wa_id, c); if (c.lid) cmap.set(c.lid, c); }
    const chmap = new Map(chats.map((c) => [`${c.session_id}|${c.chat_id}`, c] as [string, any]));
    return {
      items: rows.map((r) => {
        const ch = r.session_id ? chmap.get(`${r.session_id}|${r.chat_id}`) : null;
        const c = cmap.get(r.chat_id);
        return { id: r.id, chat_id: ch?.id || null, jid: r.chat_id, session_id: r.session_id, session: (r.session_id && smap.get(r.session_id)) || null, target_kind: r.target_kind, name: c?.name || c?.push_name || ch?.name || (phoneFromJid(r.chat_id) ? `+${phoneFromJid(r.chat_id)}` : r.chat_id), status: r.status, attempts: r.attempts, last_error: r.last_error, sent_at: r.sent_at };
      }),
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
    const chosen = await this.chosenSessions(orgId, b.session_ids, false);
    if (!chosen.length) throw new BadRequestException('A campanha não tem nenhum número válido. Edite e escolha os números.');
    const ready = chosen.filter(isReady);
    if (!ready.length) throw new BadRequestException('Conecte ao menos um dos números da campanha antes de disparar.');
    const copies = await this.prisma.whatsapp_broadcast_copies.findMany({ where: { broadcast_id: id }, orderBy: { position: 'asc' } });
    const copy = this.pickCopy(b, copies);
    if (!copy) throw new BadRequestException('Cadastre ao menos uma copy antes de disparar.');
    const { targets, warnings } = await this.resolveAudience(orgId, b.targets, chosen, ready, normDistribution(b.distribution));
    if (!targets.length) throw new BadRequestException(warnings[0] && normDistribution(b.distribution) === 'own' ? `Audiência vazia. ${warnings[0]}` : 'Audiência vazia.');
    const pacing = this.normPacing(b.pacing, b.interval_ms);
    const firstAt = pacing.window && !this.inWindow(pacing.window) ? this.nextWindowStart(pacing.window) : new Date();
    const by_session: Record<string, SessionStats> = {};
    for (const t of targets) {
      const s = by_session[t.session_id] || (by_session[t.session_id] = { total: 0, sent: 0, failed: 0, blocked: 0, paced: 0, pending: 0 });
      s.total++; s.pending++;
    }
    let run: any;
    try {
      run = await this.prisma.whatsapp_broadcast_runs.create({ data: { broadcast_id: id, organization_id: orgId, run_at: runAt, copy_id: copy.id, messages: copy.messages as any, by_session: by_session as any, total: targets.length, status: 'running' } });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new BadRequestException('Já existe um disparo neste minuto.');
      throw e;
    }
    for (let i = 0; i < targets.length; i += 500) {
      await this.prisma.whatsapp_broadcast_sends.createMany({ data: targets.slice(i, i + 500).map((a) => ({ organization_id: orgId, session_id: a.session_id, broadcast_id: id, run_id: run.id, target_kind: a.target_kind, chat_id: a.chat_id, contact_id: a.contact_id, status: 'PENDING', next_at: firstAt })) });
    }
    await this.prisma.whatsapp_broadcasts.update({ where: { id }, data: { last_copy_index: (b.last_copy_index + 1) % Math.max(1, copies.length) } });
    if (b.delete_used) await this.prisma.whatsapp_broadcast_copies.delete({ where: { id: copy.id } }).catch(() => undefined);
    const offline = Object.keys(by_session).filter((sid) => !ready.some((r) => r.id === sid));
    if (offline.length) this.logger.warn(`Broadcast ${b.name}: ${offline.length} número(s) desconectado(s) com envios na fila — ficam PENDING até reconectar`);
    this.logger.log(`Broadcast ${b.name} disparado: ${targets.length} destinos em ${Object.keys(by_session).length} número(s) (org=${orgId})`);
    return { run_id: run.id, total: targets.length, by_session: Object.entries(by_session).map(([session_id, s]) => ({ session_id, total: s.total })), warnings, first_at: firstAt };
  }

  // dispatcher: horários diários + reabre PACED vencidos (limite do dia → volta amanhã)
  @Cron(CronExpression.EVERY_MINUTE)
  async dispatch() {
    try {
      const reopened = await this.prisma.whatsapp_broadcast_sends.updateMany({ where: { status: 'PACED', next_at: { lte: new Date() } }, data: { status: 'PENDING' } });
      if (reopened.count) this.logger.log(`${reopened.count} envio(s) PACED voltaram para a fila`);
    } catch (e: any) { this.logger.debug(`reopen paced: ${e?.message || e}`); }
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
        const groups = await this.prisma.whatsapp_broadcast_sends.groupBy({ by: ['organization_id', 'session_id'], where: { status: 'PENDING', next_at: { lte: new Date() }, session_id: { not: null } } });
        for (const g of groups) {
          const sid = g.session_id as string;
          if (!sid || this.busySessions.has(sid)) continue;
          this.busySessions.add(sid);
          did = true;
          this.processSession(g.organization_id, sid).catch((e) => this.logger.warn(`número ${sid}: ${e?.message || e}`)).finally(() => this.busySessions.delete(sid));
        }
      } catch (e: any) {
        this.logger.warn(`loop: ${e?.message || e}`);
      }
      await sleep(did ? 1500 : 4000);
    }
  }

  // 1 envio por vez por NÚMERO, respeitando ritmo da campanha (intervalo/jitter/janela/pausas/limite) e aquecimento do número.
  private async processSession(orgId: string, sessionId: string) {
    const row = await this.sessions.rowById(orgId, sessionId);
    if (!row?.openwa_session_id || row.status !== 'ready') return;
    if (!(await this.access.isOrgActive(orgId))) return;
    const pacingRow = { id: row.id, paired_at: row.paired_at, pacing_enabled: row.pacing_enabled, organization_id: orgId };
    const runCache = new Map<string, any>();
    const bcCache = new Map<string, any>();
    for (let i = 0; i < 20; i++) {
      const send = await this.prisma.whatsapp_broadcast_sends.findFirst({ where: { organization_id: orgId, session_id: sessionId, status: 'PENDING', next_at: { lte: new Date() } }, orderBy: { created_at: 'asc' } });
      if (!send) return;
      if (!runCache.has(send.run_id)) runCache.set(send.run_id, await this.prisma.whatsapp_broadcast_runs.findUnique({ where: { id: send.run_id } }));
      if (!bcCache.has(send.broadcast_id)) bcCache.set(send.broadcast_id, await this.prisma.whatsapp_broadcasts.findUnique({ where: { id: send.broadcast_id } }));
      const run = runCache.get(send.run_id);
      const bc = bcCache.get(send.broadcast_id);
      if (!run || !bc) { await this.prisma.whatsapp_broadcast_sends.update({ where: { id: send.id }, data: { status: 'FAILED', last_error: 'broadcast removido' } }); continue; }
      const pc = this.normPacing(bc.pacing, bc.interval_ms);
      // janela de horário: fora dela, tudo deste número/run espera o próximo início
      if (pc.window && !this.inWindow(pc.window)) {
        const at = this.nextWindowStart(pc.window);
        await this.prisma.whatsapp_broadcast_sends.updateMany({ where: { run_id: run.id, session_id: sessionId, status: 'PENDING' }, data: { next_at: at } });
        await this.reconcile(run.id);
        continue;
      }
      // aquecimento do número + limite diário da campanha
      const can = await this.pacing.canSend(pacingRow, send.chat_id, pc.daily_limit);
      if (!can.ok) {
        await this.prisma.whatsapp_broadcast_sends.update({ where: { id: send.id }, data: { status: 'PACED', next_at: this.tomorrowStart(pc.window), last_error: can.reason || null } });
        await this.reconcile(run.id);
        continue;
      }
      const status = await this.sendOne(row, send, run, bc);
      await this.reconcile(run.id);
      // pausa a cada N envios concluídos deste número nesta run
      if (status === 'DONE' && pc.pause_every > 0 && pc.pause_minutes > 0) {
        const done = await this.prisma.whatsapp_broadcast_sends.count({ where: { run_id: run.id, session_id: sessionId, status: 'DONE' } });
        if (done > 0 && done % pc.pause_every === 0) {
          const at = new Date(Date.now() + pc.pause_minutes * 60_000);
          const r = await this.prisma.whatsapp_broadcast_sends.updateMany({ where: { run_id: run.id, session_id: sessionId, status: 'PENDING' }, data: { next_at: at } });
          if (r.count) this.logger.log(`Broadcast ${bc.name} · ${sessionLabel(row)}: pausa de ${pc.pause_minutes} min após ${done} envios (${r.count} na fila)`);
          return;
        }
      }
      await sleep(this.intervalFor(pc));
    }
  }

  private async sendOne(row: SessionRow, send: any, run: any, bc: any): Promise<'DONE' | 'PENDING' | 'BLOCKED' | 'FAILED'> {
    const orgId = row.organization_id as string;
    const msgs = this.normMessages(run.messages);
    const contact = send.contact_id ? await this.prisma.whatsapp_contacts.findUnique({ where: { id: send.contact_id } }) : null;
    const vars: Record<string, string> = { nome: contact?.name || contact?.push_name || '', name: contact?.name || contact?.push_name || '', telefone: contact?.phone || phoneFromJid(send.chat_id), phone: contact?.phone || phoneFromJid(send.chat_id) };
    if (msgs.some((m) => /\{\{\s*cliente\./i.test(String(m.text || '')))) Object.assign(vars, await this.crm.varsForChat(orgId, send.chat_id, row.id).catch(() => ({})));
    const extra = { broadcast: true, broadcast_id: bc.id, run_id: run.id };
    let idx = send.msg_index || 0;
    try {
      for (; idx < msgs.length; idx++) {
        const m = msgs[idx];
        if (m.delay_seconds) { await this.openwa.typing(row.openwa_session_id, send.chat_id, 'typing').catch(() => undefined); await sleep(Math.min(60, m.delay_seconds) * 1000); }
        const text = fillVars(m.text, vars);
        if (m.media_id) {
          const media = await this.media.readBase64(orgId, m.media_id);
          const kind = media.kind === 'voice' || media.kind === 'audio' ? 'audio' : media.kind === 'image' ? 'image' : media.kind === 'video' ? 'video' : 'document';
          const r = await this.openwa.sendMedia(row.openwa_session_id, kind as any, send.chat_id, { base64: media.base64, mimetype: media.mime, filename: media.filename || undefined, caption: text || undefined, ...(media.kind === 'voice' ? { ptt: true } : {}) });
          await this.chat.recordOut(row, send.chat_id, r as any, { type: media.kind === 'voice' ? 'voice' : kind, body: text || null, media_id: m.media_id, extra });
        } else {
          const r = await this.openwa.sendText(row.openwa_session_id, send.chat_id, text);
          await this.chat.recordOut(row, send.chat_id, r as any, { type: 'text', body: text, media_id: null, extra });
        }
        await this.prisma.whatsapp_broadcast_sends.update({ where: { id: send.id }, data: { msg_index: idx + 1 } });
      }
      await this.prisma.whatsapp_broadcast_sends.update({ where: { id: send.id }, data: { status: 'DONE', sent_at: new Date(), attempts: send.attempts + 1, last_error: null } });
      return 'DONE';
    } catch (e: any) {
      const attempts = send.attempts + 1;
      const msg = (e instanceof OpenWaError ? `${e.code}: ${e.message}` : String(e?.message || e)).slice(0, 500);
      if (e instanceof OpenWaError && e.status === 429) {
        // pacing do gateway (se ligado) → espera e mantém PENDING
        await this.prisma.whatsapp_broadcast_sends.update({ where: { id: send.id }, data: { next_at: new Date(Date.now() + (e.retryAfterSeconds || 300) * 1000), last_error: msg } });
        return 'PENDING';
      }
      if (e instanceof OpenWaError && (e.status === 403 || /blocked|not.?found|invalid.*(number|jid)/i.test(msg))) {
        await this.prisma.whatsapp_broadcast_sends.update({ where: { id: send.id }, data: { status: 'BLOCKED', attempts, last_error: msg } });
        return 'BLOCKED';
      }
      const final = attempts >= MAX_ATTEMPTS;
      await this.prisma.whatsapp_broadcast_sends.update({ where: { id: send.id }, data: final ? { status: 'FAILED', attempts, last_error: msg } : { attempts, last_error: msg, next_at: new Date(Date.now() + 60_000 * attempts) } });
      return final ? 'FAILED' : 'PENDING';
    }
  }

  /** Recalcula totais da run e o detalhe por número (`by_session`). */
  async reconcile(runId: string) {
    const g = await this.prisma.whatsapp_broadcast_sends.groupBy({ by: ['session_id', 'status'], where: { run_id: runId }, _count: { _all: true } });
    const by: Record<string, SessionStats> = {};
    const tot: SessionStats = { total: 0, sent: 0, failed: 0, blocked: 0, paced: 0, pending: 0 };
    for (const x of g) {
      const sid = x.session_id || 'unknown';
      const s = by[sid] || (by[sid] = { total: 0, sent: 0, failed: 0, blocked: 0, paced: 0, pending: 0 });
      const n = x._count._all;
      const key: keyof SessionStats | null = x.status === 'DONE' ? 'sent' : x.status === 'FAILED' ? 'failed' : x.status === 'BLOCKED' ? 'blocked' : x.status === 'PACED' ? 'paced' : x.status === 'PENDING' ? 'pending' : null;
      s.total += n; tot.total += n;
      if (key) { s[key] += n; tot[key] += n; }
    }
    const open = tot.pending + tot.paced;
    const prev = await this.prisma.whatsapp_broadcast_runs.findUnique({ where: { id: runId } });
    await this.prisma.whatsapp_broadcast_runs.update({ where: { id: runId }, data: { sent: tot.sent, failed: tot.failed, blocked: tot.blocked, by_session: by as any, status: open ? 'running' : 'done', ...(open ? {} : { finished_at: new Date() }) } });
    // terminou agora → notificação
    if (!open && prev && prev.status !== 'done') {
      const b = await this.prisma.whatsapp_broadcasts.findUnique({ where: { id: prev.broadcast_id } }).catch(() => null);
      this.hooks.emit('broadcast_done', { orgId: prev.organization_id, broadcast: b, run: prev, stats: tot });
    }
  }
}
