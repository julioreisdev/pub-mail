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
import { WhatsAppContactsService } from './whatsapp-contacts.service';
import { isGroupJid, isLidJid, phoneFromJid } from './wa-jid.util';

// Broadcasts MULTI-NÚMERO: a campanha tem `session_ids` (1..N números da org). Horários diários
// (minuto-do-dia BRT), copies com rotação, audiência = contatos salvos/tags/selecionados + grupos.
//  - Contatos (saved/all/selected), com 2+ números, seguem a `distribution` da campanha:
//      'shared' ("Usar em conjunto", padrão): a audiência é SOMADA e dividida IGUALMENTE entre os
//        números conectados no disparo (1000 + 100 contatos → 550 por número). Cada número fica
//        primeiro com quem já conversa com ele; o excedente vai para os números com folga.
//      'own' ("Cada número dispara para seus contatos"): o contato sai pelo número DELE — o da
//        conversa mais recente ou, sem conversa, o número de cuja agenda ele veio
//        (`whatsapp_contact_sessions`); quem não é de nenhum dos números escolhidos fica de fora.
//    Grupos saem sempre pelo número da conversa do grupo. `targets.groups_mode`: 'group' (posta no
//    grupo, padrão) | 'members' ("Enviar no privado": cada membro recebe na DM, pelo número que
//    participa do grupo) | 'both'. Membros sem contato na org entram só com o telefone.
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

// {{nome}} {{primeiro_nome}} {{telefone}} + {{cliente.*}} (CRM). Chave fora do mapa fica como está.
export function fillVars(text: string, vars: Record<string, string>) {
  return String(text || '').replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (m, k) => { const key = String(k).toLowerCase(); return key in vars ? vars[key] ?? '' : m; });
}

// 1ª palavra do nome ("Ana Paula Souza" → "Ana"); vazio quando não há nome.
export const firstNameOf = (name: any) => String(name || '').trim().split(/\s+/)[0] || '';
// Variáveis de pessoa das copies: {{nome}}/{{name}}, {{primeiro_nome}}/{{first_name}}, {{telefone}}/{{phone}}.
export function personVars(contact: { name?: string | null; push_name?: string | null; phone?: string | null } | null, fallbackPhone: string | null) {
  const nome = contact?.name || contact?.push_name || '';
  const telefone = contact?.phone || fallbackPhone || '';
  const primeiro = firstNameOf(nome);
  return { nome, name: nome, primeiro_nome: primeiro, first_name: primeiro, telefone, phone: telefone } as Record<string, string>;
}

type Target = { session_id: string; chat_id: string; contact_id: string | null; target_kind: 'contact' | 'group'; via_group?: string };
export type GroupsMode = 'group' | 'members' | 'both';
export type BroadcastDistribution = 'shared' | 'own';
// De quais números vem a AUDIÊNCIA (independe de quais números ENVIAM):
//  all = de todos os números da org (padrão, comportamento antigo) · sending = só dos números que enviam ·
//  others = só dos outros números (quem ainda não é dos que enviam) · custom = dos números escolhidos.
// "É de um número" = está na agenda dele (`whatsapp_contact_sessions`) ou já tem conversa com ele.
export type AudienceSource = 'all' | 'sending' | 'others' | 'custom';
type AudienceFiltered = { source: number; tags: number; engagement: number; cooldown: number; inactive: number };
const normDistribution = (v: any): BroadcastDistribution => (v === 'own' ? 'own' : 'shared');
type SessionStats = { total: number; sent: number; failed: number; blocked: number; paced: number; pending: number; skipped: number };

@Injectable()
export class WhatsAppBroadcastsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppBroadcastsService.name);
  private stopped = false;
  private loopRunning = false;

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
    private readonly contacts: WhatsAppContactsService,
  ) {}

  // ---------------------------------------------------------------- presets / ritmo
  presets() {
    return {
      default: 'custom',
      items: (Object.keys(PRESET_TABLE) as Array<Exclude<PacingPreset, 'custom'>>).map((key) => ({ key, ...PRESET_TABLE[key] })).concat([{ key: 'custom', label: 'Personalizado', risk: 'high', description: 'Você define o tempo entre envios (padrão 0,3 s = ~3 por segundo), variação, limite diário, pausas e janela.', interval_ms: 300, jitter_pct: 20, daily_limit: null, pause_every: 0, pause_minutes: 0, window: null } as any]),
      limits: { interval_ms: { min: 100, max: 120000 }, jitter_pct: { min: 0, max: 80 }, daily_limit: { min: 1, max: 5000 }, pause_every: { min: 0, max: 1000 }, pause_minutes: { min: 0, max: 240 } },
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
      interval_ms: clamp(p?.interval_ms ?? legacyInterval, 100, 120000, 300),
      jitter_pct: clamp(p?.jitter_pct, 0, 80, 20),
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
    const strList = (v: any, max: number, len = 40) => (Array.isArray(v) ? [...new Set<string>(v.map((x: any) => String(x).trim().slice(0, len)).filter(Boolean))].slice(0, max) : []);
    const source: AudienceSource = ['all', 'sending', 'others', 'custom'].includes(t.source) ? t.source : 'all';
    const cooldown = Math.round(Number(t.cooldown_hours) || 0);
    return {
      contacts,
      contact_ids: Array.isArray(t.contact_ids) ? [...new Set<string>(t.contact_ids.map((x: any) => String(x)))].slice(0, 5000) : [],
      tags: Array.isArray(t.tags) ? t.tags.map((x: any) => String(x).slice(0, 40)).slice(0, 50) : [],
      // etiquetas que TIRAM o contato da audiência (vale sobre "Filtrar por tags")
      exclude_tags: strList(t.exclude_tags, 50),
      // uuids de conversas de grupo (campanhas antigas podem ter jids `@g.us` — aceitos como legado)
      groups: Array.isArray(t.groups) ? [...new Set<string>(t.groups.map((g: any) => String(g).trim()).filter((g: string) => UUID_RE.test(g) || /@g\.us$/.test(g)))].slice(0, 200) : [],
      // grupos: postar no grupo (padrão) | 'members' = enviar no privado de cada membro | 'both'
      groups_mode: (['group', 'members', 'both'].includes(t.groups_mode) ? t.groups_mode : t.groups_dm === true ? 'members' : 'group') as GroupsMode,
      source,
      source_session_ids: source === 'custom' ? strList(t.source_session_ids, 50, 36) : [],
      // contatos que não são de número nenhum (importados/criados à mão): entram por padrão só em "todos os números"
      include_unlinked: typeof t.include_unlinked === 'boolean' ? t.include_unlinked : source === 'all',
      // "cada número os seus" + contato que não é de nenhum dos números que enviam: dividir entre eles ou deixar de fora
      outsiders: (source === 'others' ? 'split' : t.outsiders === 'split' || t.outsiders === 'skip' ? t.outsiders : source === 'custom' ? 'split' : 'skip') as 'split' | 'skip',
      // histórico de resposta: any | replied (já respondeu a algum número) | never (nunca respondeu)
      engagement: (['any', 'replied', 'never'].includes(t.engagement) ? t.engagement : 'any') as 'any' | 'replied' | 'never',
      // não repete para quem recebeu QUALQUER broadcast da org nas últimas N horas (null = desligado)
      cooldown_hours: cooldown >= 1 ? Math.min(720, cooldown) : null,
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
  private async resolveAudience(orgId: string, rawTargets: any, chosen: SessionRow[], pool: SessionRow[], distribution: BroadcastDistribution = 'shared', excludeInactiveDays: number | null = null): Promise<{ targets: Target[]; warnings: string[]; unassigned: number; filtered: AudienceFiltered; sources: { by_session: Record<string, number>; unlinked: number } }> {
    const t = this.normTargets(rawTargets);
    const chosenIds = chosen.map((r) => r.id);
    const chosenSet = new Set(chosenIds);
    const poolIds = new Set(pool.map((r) => r.id));
    const base: any = { organization_id: orgId, is_blocked: false, opted_out_at: null, blocked_us_at: null }; // LGPD: quem pediu PARE não recebe; quem bloqueou o número também não
    const select = { id: true, wa_id: true, tags: true, phone: true, lid: true };
    const filtered: AudienceFiltered = { source: 0, tags: 0, engagement: 0, cooldown: 0, inactive: 0 };
    const tagsOf = (r: any): string[] => (Array.isArray(r.tags) ? (r.tags as any[]).map((x) => String(x)) : []);
    // audiência "em massa" (salvos/todos) passa por todos os filtros; contatos escolhidos à mão SEMPRE recebem
    let bulk: any[] = [];
    if (t.contacts === 'all' || t.contacts === 'saved') {
      // ordem fixa: a divisão entre os números é a mesma a cada disparo (o contato não fica trocando de número)
      const all = await this.prisma.whatsapp_contacts.findMany({ where: { ...base, ...(t.contacts === 'saved' ? { saved: true } : {}) }, select, orderBy: { id: 'asc' } });
      for (const r of all) {
        const tg = tagsOf(r);
        if (t.tags.length && !tg.some((x) => t.tags.includes(x))) continue; // "Filtrar por tags" (inclusão) já era assim
        if (t.exclude_tags.length && tg.some((x) => t.exclude_tags.includes(x))) { filtered.tags++; continue; }
        bulk.push(r);
      }
    }
    const manual = t.contact_ids.length ? await this.prisma.whatsapp_contacts.findMany({ where: { ...base, id: { in: t.contact_ids } }, select, orderBy: { id: 'asc' } }) : [];
    const manualIds = new Set<string>(manual.map((r) => r.id));

    // conversas individuais desses contatos em TODOS os números da org (qualquer forma de jid)
    const everyone = [...bulk, ...manual];
    const cand = new Set<string>();
    for (const c of everyone) { cand.add(c.wa_id); if (c.phone) cand.add(`${c.phone}@c.us`); if (c.lid) cand.add(c.lid); }
    const chats = cand.size ? await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, chat_id: { in: [...cand] }, kind: 'individual' }, select: { session_id: true, chat_id: true, last_message_at: true, last_inbound_at: true } }) : [];
    type Hit = { session_id: string; chat_id: string; last_message_at: Date | null; last_inbound_at?: Date | null };
    const byJid = new Map<string, Hit[]>();
    for (const ch of chats) byJid.set(ch.chat_id, [...(byJid.get(ch.chat_id) || []), ch as Hit]);
    const allHitsOf = (c: any): Hit[] => ([c.wa_id, c.phone ? `${c.phone}@c.us` : null, c.lid].filter(Boolean) as string[]).flatMap((j) => byJid.get(j) || []);
    const hitsOf = (c: any): Hit[] => allHitsOf(c).filter((h) => chosenSet.has(h.session_id));
    // de qual número cada contato veio (agenda sincronizada por ele ou mensagem por ele) — todos os números da org
    const links = everyone.length ? await this.prisma.whatsapp_contact_sessions.findMany({ where: { organization_id: orgId }, select: { contact_id: true, session_id: true } }) : [];
    const linksOf = new Map<string, string[]>();
    for (const l of links) linksOf.set(l.contact_id, [...(linksOf.get(l.contact_id) || []), l.session_id]);
    const memberOf = (c: any) => new Set<string>([...(linksOf.get(c.id) || []), ...allHitsOf(c).map((h) => h.session_id)]);
    const ownersOf = new Map<string, string[]>();
    for (const l of links) if (chosenSet.has(l.session_id)) ownersOf.set(l.contact_id, [...(ownersOf.get(l.contact_id) || []), l.session_id]);

    // quantos contatos cada número tem nesta audiência (antes do filtro de origem) — a tela mostra ao escolher
    const sources = { by_session: {} as Record<string, number>, unlinked: 0 };
    const members = new Map<string, Set<string>>();
    for (const c of bulk) {
      const m = memberOf(c);
      members.set(c.id, m);
      if (!m.size) sources.unlinked++;
      for (const sid of m) sources.by_session[sid] = (sources.by_session[sid] || 0) + 1;
    }

    // origem da audiência
    if (t.source !== 'all' || !t.include_unlinked) {
      const srcSet = t.source === 'custom' ? new Set(t.source_session_ids) : chosenSet;
      const touches = (m: Set<string>, set: Set<string>) => [...m].some((x) => set.has(x));
      const before = bulk.length;
      bulk = bulk.filter((c) => {
        const m = members.get(c.id)!;
        if (!m.size) return t.include_unlinked;
        if (t.source === 'all') return true;
        if (t.source === 'others') return !touches(m, chosenSet);
        return touches(m, srcSet);
      });
      filtered.source = before - bulk.length;
    }
    // histórico de resposta (a qualquer número da org)
    if (t.engagement !== 'any') {
      const before = bulk.length;
      bulk = bulk.filter((c) => { const replied = allHitsOf(c).some((h) => h.last_inbound_at); return t.engagement === 'replied' ? replied : !replied; });
      filtered.engagement = before - bulk.length;
    }
    // não repetir: quem recebeu qualquer broadcast da org nas últimas N horas
    if (t.cooldown_hours && bulk.length) {
      const cutoff = new Date(Date.now() - t.cooldown_hours * 3_600_000);
      const recent = await this.prisma.whatsapp_broadcast_sends.findMany({ where: { organization_id: orgId, status: 'DONE', sent_at: { gte: cutoff }, contact_id: { not: null } }, select: { contact_id: true }, distinct: ['contact_id'] });
      const got = new Set(recent.map((r) => r.contact_id as string));
      const before = bulk.length;
      bulk = bulk.filter((c) => !got.has(c.id));
      filtered.cooldown = before - bulk.length;
    }
    const contacts = [...new Map([...bulk, ...manual].map((r) => [r.id, r] as [string, any])).values()];
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
        // não é de nenhum dos números que enviam: divide entre eles (opção da campanha; escolhido à mão sempre recebe)
        if (!sent && (t.outsiders === 'split' || manualIds.has(c.id))) {
          for (const s2 of [...pool].sort((a, b) => (load.get(a.id) || 0) - (load.get(b.id) || 0))) {
            const jid = this.jidForSession(s2, c);
            if (jid && push({ session_id: s2.id, chat_id: jid, contact_id: c.id, target_kind: 'contact' })) { bump(s2.id); sent = true; break; }
          }
        }
        if (!sent) unassigned++;
      }
      if (unassigned) warnings.push(`${unassigned.toLocaleString('pt-BR')} contato(s) não são de nenhum dos números que enviam (não estão na agenda deles nem conversaram com eles) e ficam de fora. Para incluí-los, marque "Dividir entre os números" ou use "Usar em conjunto".`);
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
      const groupRows: GroupRow[] = [];
      for (const g of uuids) { const row = byUuid.find((r) => r.id === g); if (row) groupRows.push(row); else warnings.push(`Grupo ${g} não encontrado.`); }
      for (const g of jids) { const rowsG = byLegacy.filter((r) => r.chat_id === g); if (!rowsG.length) warnings.push(`Grupo ${g} não encontrado nos números escolhidos.`); groupRows.push(...rowsG); }
      if (t.groups_mode !== 'members') for (const row of groupRows) push({ session_id: row.session_id, chat_id: row.chat_id, contact_id: null, target_kind: 'group' });
      if (t.groups_mode !== 'group' && groupRows.length) {
        // "Enviar no privado": cada membro vira um alvo individual, enviado pelos NÚMEROS QUE ENVIAM
        // (não pelo número do grupo), repartido como os contatos; quem já está na audiência não repete.
        const phoneOfContact = new Map(everyone.map((c: any) => [c.id, c.phone || phoneFromJid(c.wa_id) || ''] as [string, string]));
        const already = new Set<string>();
        for (const x of out) { const ph = (x.contact_id && phoneOfContact.get(x.contact_id)) || phoneFromJid(x.chat_id) || ''; if (ph) already.add(ph); }
        const { targets: members, warnings: w2 } = await this.groupMemberTargets(orgId, groupRows, pool, chosen, mode, out, already);
        warnings.push(...w2);
        for (const m of members) push(m);
      }
    }
    // "excluir quem não interagiu nos últimos N dias": fica só quem mandou mensagem (recebida) nesse período
    if (excludeInactiveDays && excludeInactiveDays > 0) {
      const cutoff = new Date(Date.now() - excludeInactiveDays * 86_400_000);
      const isExempt = (x: Target) => Boolean(x.via_group) || Boolean(x.contact_id && manualIds.has(x.contact_id)); // membros de grupo e escolhidos à mão sempre recebem
      const contactsOut = out.filter((x) => x.target_kind === 'contact' && !isExempt(x));
      if (contactsOut.length) {
        const active = await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, kind: 'individual', last_inbound_at: { gte: cutoff }, OR: contactsOut.slice(0, 20000).map((x) => ({ session_id: x.session_id, chat_id: x.chat_id })) }, select: { session_id: true, chat_id: true } });
        const ok = new Set(active.map((c) => `${c.session_id}|${c.chat_id}`));
        const before = out.length;
        const kept = out.filter((x) => x.target_kind !== 'contact' || isExempt(x) || ok.has(`${x.session_id}|${x.chat_id}`));
        const removed = before - kept.length;
        filtered.inactive = removed;
        if (removed) warnings.push(`${removed.toLocaleString('pt-BR')} contato(s) ficam de fora por não terem respondido nos últimos ${excludeInactiveDays} dias.`);
        return { targets: kept, warnings, unassigned, filtered, sources };
      }
    }
    return { targets: out, warnings, unassigned, filtered, sources };
  }

  /**
   * Membros dos grupos como alvos de DM ("Enviar no privado"). Participantes vêm do `group_meta`
   * (cache de 6 h) ou do gateway (número conectado); o próprio número e os outros números da org
   * ficam de fora; quem tem contato na org e pediu PARE / bloqueou / está bloqueado também.
   * Sem telefone resolvível (lid desconhecido) o membro é pulado e entra no aviso.
   */
  private async groupMemberTargets(orgId: string, groups: { id: string; session_id: string; chat_id: string }[], pool: SessionRow[], chosen: SessionRow[], mode: BroadcastDistribution, current: Target[], already: Set<string>): Promise<{ targets: Target[]; warnings: string[] }> {
    const warnings: string[] = [];
    const targets: Target[] = [];
    if (!pool.length) { warnings.push('Nenhum dos números que enviam está conectado — os membros dos grupos não têm por onde sair.'); return { targets, warnings }; }
    const all = await this.sessions.rowsOf(orgId);
    const ownPhones = new Set(all.map((r) => String(r.phone || '')).filter(Boolean));
    const rowsById = new Map(all.map((r) => [r.id, r] as const));
    type Member = { phone: string; lid: string | null; name: string | null };
    const perGroup: { row: SessionRow; group: { id: string; session_id: string; chat_id: string }; members: Member[] }[] = [];
    let unresolved = 0;
    for (const g of groups) {
      const row = rowsById.get(g.session_id);
      if (!row) continue;
      const chat = await this.prisma.whatsapp_chats.findUnique({ where: { id: g.id }, select: { group_meta: true, name: true } });
      const meta: any = chat?.group_meta || {};
      let participants: any[] = Array.isArray(meta.participants) ? meta.participants : [];
      const stale = !meta.fetched_at || Date.now() - new Date(meta.fetched_at).getTime() > 6 * 3_600_000;
      if ((stale || !participants.length) && isReady(row)) {
        try {
          const info = await this.openwa.groupInfo(row.openwa_session_id!, g.chat_id);
          participants = (info?.participants || []).map((p: any) => ({ id: p.id, phone: p.number || phoneFromJid(p.id), name: p.name || null, is_admin: Boolean(p.isAdmin || p.isSuperAdmin) }));
          const me = row.phone ? `${row.phone}@c.us` : '';
          await this.prisma.whatsapp_chats.update({ where: { id: g.id }, data: { group_meta: { ...meta, subject: info?.name || meta.subject, participants, participants_count: participants.length, is_admin: participants.some((p: any) => p.id === me && p.is_admin), fetched_at: new Date().toISOString() } } }).catch(() => undefined);
        } catch (e: any) {
          this.logger.debug(`groupInfo ${g.chat_id}: ${e?.message || e}`);
        }
      }
      if (!participants.length) { warnings.push(`Grupo "${chat?.name || meta.subject || g.chat_id}": não foi possível listar os membros${isReady(row) ? '' : ' (número desconectado)'}.`); continue; }
      const members: Member[] = [];
      for (const p of participants) {
        const id = String(p?.id || '');
        let phone = String(p?.phone || phoneFromJid(id) || '').replace(/\D/g, '');
        const lid = isLidJid(id) ? id : null;
        if (!phone && lid) phone = String((await this.contacts.phoneOfLid(orgId, row, lid).catch(() => null)) || '');
        if (!phone) { unresolved++; continue; }
        if (ownPhones.has(phone)) continue;
        members.push({ phone, lid, name: p?.name ? String(p.name) : null });
      }
      perGroup.push({ row, group: g, members });
    }
    // contatos da org pelos telefones (uma consulta): contact_id + LGPD/bloqueio
    const phones = [...new Set(perGroup.flatMap((x) => x.members.map((m) => m.phone)))];
    const known = phones.length ? await this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, OR: [{ phone: { in: phones } }, { wa_id: { in: phones.map((ph) => `${ph}@c.us`) } }] }, select: { id: true, phone: true, wa_id: true, lid: true, is_blocked: true, opted_out_at: true, blocked_us_at: true } }) : [];
    const byPhone = new Map<string, (typeof known)[number]>();
    for (const c of known) { const ph = c.phone || phoneFromJid(c.wa_id) || ''; if (ph && !byPhone.has(ph)) byPhone.set(ph, c); }
    // lista única de membros (a mesma pessoa em 2 grupos conta 1×; quem já está na audiência não repete)
    type Picked = Member & { contact: (typeof known)[number] | null; group_jid: string; group_session: string };
    const picked: Picked[] = [];
    const seenPhone = new Set<string>();
    let excluded = 0;
    let duplicated = 0;
    for (const { group, members } of perGroup) {
      for (const m of members) {
        if (seenPhone.has(m.phone)) continue;
        seenPhone.add(m.phone);
        if (already.has(m.phone)) { duplicated++; continue; }
        const c = byPhone.get(m.phone) || null;
        if (c && (c.is_blocked || c.opted_out_at || c.blocked_us_at)) { excluded++; continue; }
        picked.push({ ...m, contact: c, group_jid: group.chat_id, group_session: group.session_id });
      }
    }
    // conversas que os números que ENVIAM já têm com esses membros (preferência de quem fala com quem)
    const poolIds = new Set(pool.map((r) => r.id));
    const jidCands = picked.flatMap((m) => [`${m.phone}@c.us`, m.contact?.wa_id, m.contact?.lid, m.lid].filter(Boolean) as string[]);
    const chats = jidCands.length ? await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, kind: 'individual', session_id: { in: [...poolIds] }, chat_id: { in: [...new Set(jidCands)] } }, select: { session_id: true, chat_id: true, last_message_at: true } }) : [];
    const chatsByJid = new Map<string, { session_id: string; chat_id: string; last_message_at: Date | null }[]>();
    for (const ch of chats) chatsByJid.set(ch.chat_id, [...(chatsByJid.get(ch.chat_id) || []), ch]);
    const hitsOfMember = (m: Picked) => [`${m.phone}@c.us`, m.contact?.wa_id, m.contact?.lid, m.lid].filter(Boolean).flatMap((j) => chatsByJid.get(j as string) || []).sort((a, b) => (b.last_message_at?.getTime() || 0) - (a.last_message_at?.getTime() || 0));
    // carga atual por número (contatos já repartidos) para a divisão continuar equilibrada
    const load = new Map(pool.map((r) => [r.id, 0] as [string, number]));
    for (const x of current) if (x.target_kind === 'contact' && load.has(x.session_id)) load.set(x.session_id, (load.get(x.session_id) || 0) + 1);
    const total = picked.length + [...load.values()].reduce((a, b) => a + b, 0);
    const quota = Math.ceil(total / pool.length);
    const leastLoaded = () => [...pool].sort((a, b) => (load.get(a.id) || 0) - (load.get(b.id) || 0))[0];
    const rowsByIdPool = new Map(pool.map((r) => [r.id, r] as const));
    const add = (row: SessionRow, m: Picked, chatJid?: string) => {
      const jid = chatJid || this.jidForSession(row, { wa_id: m.contact?.wa_id || `${m.phone}@c.us`, phone: m.phone, lid: m.contact?.lid || m.lid });
      if (!jid) { unresolved++; return; }
      targets.push({ session_id: row.id, chat_id: jid, contact_id: m.contact?.id || null, target_kind: 'contact', via_group: m.group_jid });
      load.set(row.id, (load.get(row.id) || 0) + 1);
    };
    const pending: Picked[] = [];
    for (const m of picked) {
      const hit = hitsOfMember(m)[0];
      if (mode === 'own') {
        // cada número os seus: quem já conversa com o membro; senão o número do grupo (se envia); senão o com menos carga
        if (hit) { add(rowsByIdPool.get(hit.session_id)!, m, hit.chat_id); continue; }
        const gs = rowsByIdPool.get(m.group_session);
        add(gs || leastLoaded(), m);
        continue;
      }
      // em conjunto: 1ª passada fica com quem já conversa (até a cota); o resto é dividido por igual
      if (hit && (load.get(hit.session_id) || 0) < quota) { add(rowsByIdPool.get(hit.session_id)!, m, hit.chat_id); continue; }
      pending.push(m);
    }
    for (const m of pending) add(leastLoaded(), m);
    void chosen;
    if (unresolved) warnings.push(`${unresolved} membro(s) de grupo sem telefone conhecido ficam de fora.`);
    if (excluded) warnings.push(`${excluded} membro(s) de grupo descadastrados/bloqueados ficam de fora.`);
    if (duplicated) warnings.push(`${duplicated.toLocaleString('pt-BR')} membro(s) de grupo já estavam na audiência de contatos e não recebem em dobro.`);
    return { targets, warnings };
  }

  /** Estimativa: `{ contacts, groups, group_members, total, by_session:[{session_id,label,color,connected,contacts,groups}], distribution, unassigned }`. */
  async audience(orgId: string, rawTargets: any, sessionIds?: string[], rawDistribution?: any, excludeInactiveDays?: number | null) {
    const distribution = normDistribution(rawDistribution);
    const all = await this.sessions.rowsOf(orgId);
    const ids = this.normSessionIds(sessionIds);
    const chosen = ids.length ? all.filter((r) => ids.includes(r.id)) : all;
    const ready = chosen.filter(isReady);
    const pool = ready.length ? ready : chosen; // sem ninguém conectado, estima como se todos estivessem
    const { targets, warnings, unassigned, filtered, sources } = await this.resolveAudience(orgId, rawTargets, chosen, pool, distribution, excludeInactiveDays);
    const stats = new Map<string, { contacts: number; groups: number }>();
    for (const x of targets) { const s = stats.get(x.session_id) || { contacts: 0, groups: 0 }; if (x.target_kind === 'group') s.groups++; else s.contacts++; stats.set(x.session_id, s); }
    const rowsFor = [...chosen, ...all.filter((r) => stats.has(r.id) && !chosen.some((c) => c.id === r.id))]; // grupos de números fora da seleção
    const by_session = rowsFor.map((r) => ({ session_id: r.id, label: sessionLabel(r), color: r.color || null, connected: isReady(r), contacts: stats.get(r.id)?.contacts || 0, groups: stats.get(r.id)?.groups || 0 }));
    const group_members = targets.filter((x) => x.target_kind === 'contact' && x.via_group).length;
    const contacts = targets.filter((x) => x.target_kind === 'contact').length - group_members;
    const groups = targets.length - contacts - group_members;
    // contatos de cada número da org nesta audiência (antes do filtro de origem): alimenta "Escolher números" na tela
    const source_by_session = all.map((r) => ({ session_id: r.id, label: sessionLabel(r), color: r.color || null, connected: isReady(r), contacts: sources.by_session[r.id] || 0 }));
    return { contacts, groups, group_members, total: targets.length, by_session, warnings, distribution: chosen.length > 1 ? distribution : 'shared', unassigned, filtered, source_by_session, unlinked: sources.unlinked };
  }

  // ---------------------------------------------------------------- CRUD
  private shape(b: any, extra: any = {}) {
    const pacing = this.normPacing(b.pacing, b.interval_ms);
    return { id: b.id, name: b.name, session_ids: this.normSessionIds(b.session_ids), distribution: normDistribution(b.distribution), pacing, targets: this.normTargets(b.targets), times: this.normTimes(b.times), mode: b.mode, delete_used: b.delete_used, randomize_copies: Boolean(b.randomize_copies), exclude_inactive_days: b.exclude_inactive_days ?? null, active: b.active, interval_ms: pacing.interval_ms, risk_ack_at: b.risk_ack_at, created_at: b.created_at, ...extra };
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
        else if (run.status === 'paused') time_status[String(t)] = 'paused';
        else if (run.status !== 'done') time_status[String(t)] = 'sending';
        else if (run.failed === 0 && run.blocked === 0) time_status[String(t)] = 'sent';
        else if (run.sent > 0) time_status[String(t)] = 'sent_with_errors';
        else time_status[String(t)] = 'failed';
      }
      const warmup = (await Promise.all(sids.map(warmOf))).filter(Boolean);
      // run pausada (disjuntor/manual) mais recente — a linha mostra o aviso e os botões Retomar / Enviar mesmo assim
      const pausedRun = await this.prisma.whatsapp_broadcast_runs.findFirst({ where: { broadcast_id: b.id, status: 'paused' }, orderBy: { paused_at: 'desc' }, select: { id: true, run_at: true, paused_at: true, pause_reason: true, sent: true, total: true, blocked: true } });
      out.push(this.shape(b, {
        paused_run: pausedRun || null,
        copies_count: b._count.copies,
        sessions: sids.map((s) => smap.get(s)).filter(Boolean),
        warmup,
        audience: await this.audience(orgId, b.targets, sids, b.distribution, b.exclude_inactive_days),
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
    if (targets.contacts !== 'none' && targets.source === 'custom' && !targets.source_session_ids.length) throw new BadRequestException('Escolha de quais números vem a audiência.');
    const ex = dto.exclude_inactive_days === null || dto.exclude_inactive_days === undefined || dto.exclude_inactive_days === '' ? null : Math.min(365, Math.max(1, Math.round(Number(dto.exclude_inactive_days) || 0))) || null;
    return { name, targets, times: this.normTimes(dto.times), mode: dto.mode === 'random' ? 'random' : 'sequential', delete_used: Boolean(dto.delete_used), randomize_copies: Boolean(dto.randomize_copies), exclude_inactive_days: ex };
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
    // o DTO chega com as chaves ausentes como `undefined` (campos de classe ES2022): não podem apagar o que já existe
    const given = Object.fromEntries(Object.entries(dto || {}).filter(([, v]) => v !== undefined));
    const v = this.validateInput({ ...b, ...given, targets: given.targets ?? b.targets, times: given.times ?? b.times });
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
    for (const [sid, v] of Object.entries<any>(raw)) out[sid] = { total: Number(v?.total || 0), sent: Number(v?.sent || 0), failed: Number(v?.failed || 0), blocked: Number(v?.blocked || 0), paced: Number(v?.paced || 0), pending: Number(v?.pending || 0), skipped: Number(v?.skipped || 0) };
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
    if (q.status === 'paused') where.status = 'paused';
    if (q.status === 'done') where.status = 'done';
    if (q.status === 'clean') { where.status = 'done'; where.failed = 0; where.blocked = 0; }
    if (q.status === 'errors') where.OR = [{ failed: { gt: 0 } }, { blocked: { gt: 0 } }];
    const [total, found] = await Promise.all([this.prisma.whatsapp_broadcast_runs.count({ where }), this.prisma.whatsapp_broadcast_runs.findMany({ where, orderBy: { run_at: 'desc' }, skip: (page - 1) * size, take: size })]);
    // run em andamento: os contadores da linha só são gravados a cada 25 envios e no fim → recalcula
    // agora a partir da fila (`reconcile`) para a tela acompanhar em tempo real
    let rows = found;
    const live = found.filter((r) => r.status === 'running' || r.status === 'paused');
    if (live.length) {
      await Promise.all(live.map((r) => this.reconcile(r.id).catch(() => undefined)));
      const fresh = await this.prisma.whatsapp_broadcast_runs.findMany({ where: { id: { in: live.map((r) => r.id) } } });
      rows = found.map((r) => fresh.find((f) => f.id === r.id) || r);
    }
    const smap = await this.presenter.sessionMap(orgId);
    const items: any[] = [];
    for (const r of rows) {
      const by = this.bySessionOf(r);
      const sum = (k: keyof SessionStats) => Object.values(by).reduce((a, s) => a + s[k], 0);
      const hasBy = Object.keys(by).length > 0;
      const paced = hasBy ? sum('paced') : await this.prisma.whatsapp_broadcast_sends.count({ where: { run_id: r.id, status: 'PACED' } });
      const pending = hasBy ? sum('pending') : await this.prisma.whatsapp_broadcast_sends.count({ where: { run_id: r.id, status: 'PENDING' } });
      items.push({
        id: r.id, run_at: r.run_at, total: r.total, sent: r.sent, failed: r.failed, blocked: r.blocked, skipped: r.skipped || 0, replied: r.replied || 0, paced, pending, status: r.status, finished_at: r.finished_at, paused_at: r.paused_at, pause_reason: r.pause_reason, forced_at: r.forced_at, randomized: Array.isArray(r.copies) && (r.copies as any[]).length > 1,
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
        return { id: r.id, chat_id: ch?.id || null, jid: r.chat_id, session_id: r.session_id, session: (r.session_id && smap.get(r.session_id)) || null, target_kind: r.target_kind, name: c?.name || c?.push_name || ch?.name || (phoneFromJid(r.chat_id) ? `+${phoneFromJid(r.chat_id)}` : r.chat_id), status: r.status, attempts: r.attempts, last_error: r.last_error, skip_reason: r.skip_reason || null, replied_at: r.replied_at || null, copy_index: r.copy_index ?? null, sent_at: r.sent_at };
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
    const { targets, warnings } = await this.resolveAudience(orgId, b.targets, chosen, ready, normDistribution(b.distribution), b.exclude_inactive_days ?? null);
    if (!targets.length) throw new BadRequestException(warnings[0] ? `Audiência vazia. ${warnings[0]}` : 'Audiência vazia. Confira de quais números vem a audiência e os filtros da campanha.');
    const pacing = this.normPacing(b.pacing, b.interval_ms);
    const firstAt = pacing.window && !this.inWindow(pacing.window) ? this.nextWindowStart(pacing.window) : new Date();
    const by_session: Record<string, SessionStats> = {};
    for (const t of targets) {
      const s = by_session[t.session_id] || (by_session[t.session_id] = { total: 0, sent: 0, failed: 0, blocked: 0, paced: 0, pending: 0, skipped: 0 });
      s.total++; s.pending++;
    }
    // "Randomizar envio": TODAS as copies entram na run e cada destinatário recebe uma sorteada
    const randomize = Boolean(b.randomize_copies) && copies.length > 1;
    let run: any;
    try {
      run = await this.prisma.whatsapp_broadcast_runs.create({ data: { broadcast_id: id, organization_id: orgId, run_at: runAt, copy_id: randomize ? null : copy.id, messages: copy.messages as any, copies: randomize ? (copies.map((c) => c.messages) as any) : undefined, by_session: by_session as any, total: targets.length, status: 'running' } });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new BadRequestException('Já existe um disparo neste minuto.');
      throw e;
    }
    for (let i = 0; i < targets.length; i += 500) {
      await this.prisma.whatsapp_broadcast_sends.createMany({ data: targets.slice(i, i + 500).map((a) => ({ organization_id: orgId, session_id: a.session_id, broadcast_id: id, run_id: run.id, target_kind: a.target_kind, chat_id: a.chat_id, contact_id: a.contact_id, status: 'PENDING', next_at: firstAt, copy_index: randomize ? Math.floor(Math.random() * copies.length) : null })) });
    }
    await this.prisma.whatsapp_broadcasts.update({ where: { id }, data: { last_copy_index: (b.last_copy_index + 1) % Math.max(1, copies.length) } });
    if (b.delete_used && !randomize) await this.prisma.whatsapp_broadcast_copies.delete({ where: { id: copy.id } }).catch(() => undefined);
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
  // Uma fila por (run × número): campanhas no MESMO horário e no MESMO número andam em paralelo, cada uma
  // no seu ritmo (uma não atrapalha a outra). Dentro de uma fila, 1 envio por vez com o intervalo da campanha.
  private readonly busy = new Set<string>(); // `${run_id}|${session_id}`
  private readonly breaker = new Map<string, { outcomes: string[]; consecBlocked: number; consecFailed: number }>();

  onModuleInit() {
    this.hooks.on('message', (e) => this.onInbound(e));
    this.hooks.on('session_restricted', (e) => this.pauseRunsOfSession(e));
    this.loop().catch((e) => this.logger.error(`worker parou: ${e?.message || e}`));
  }
  onModuleDestroy() { this.stopped = true; }

  private async loop() {
    if (this.loopRunning) return;
    this.loopRunning = true;
    while (!this.stopped) {
      let did = false;
      try {
        const groups = await this.prisma.whatsapp_broadcast_sends.groupBy({ by: ['organization_id', 'run_id', 'session_id'], where: { status: 'PENDING', next_at: { lte: new Date() }, session_id: { not: null } } });
        for (const g of groups) {
          const sid = g.session_id as string;
          const key = `${g.run_id}|${sid}`;
          if (!sid || this.busy.has(key)) continue;
          this.busy.add(key);
          did = true;
          this.processRunSession(g.organization_id, g.run_id, sid).catch((e) => this.logger.warn(`run ${g.run_id} · número ${sid}: ${e?.message || e}`)).finally(() => this.busy.delete(key));
        }
      } catch (e: any) {
        this.logger.warn(`loop: ${e?.message || e}`);
      }
      await sleep(did ? 1000 : 3000);
    }
  }

  private async processRunSession(orgId: string, runId: string, sessionId: string) {
    const row = await this.sessions.rowById(orgId, sessionId);
    if (!row?.openwa_session_id || row.status !== 'ready') return;
    if (!(await this.access.isOrgActive(orgId))) return;
    const run: any = await this.prisma.whatsapp_broadcast_runs.findUnique({ where: { id: runId } });
    const bc: any = run ? await this.prisma.whatsapp_broadcasts.findUnique({ where: { id: run.broadcast_id } }) : null;
    if (!run || !bc) {
      await this.prisma.whatsapp_broadcast_sends.updateMany({ where: { run_id: runId, status: 'PENDING' }, data: { status: 'FAILED', last_error: 'broadcast removido' } });
      return;
    }
    if (run.status !== 'running') return; // pausada (disjuntor/manual) ou concluída
    const pc = this.normPacing(bc.pacing, bc.interval_ms);
    const pacingRow = { id: row.id, paired_at: row.paired_at, pacing_enabled: row.pacing_enabled, organization_id: orgId };
    const contactCache = new Map<string, any>();
    let sinceReconcile = 0;
    for (let i = 0; i < 2000; i++) {
      if (this.stopped) break;
      // alguém pausou/retomou enquanto isso? (relê a cada 10 envios)
      if (i > 0 && i % 10 === 0) {
        const st = await this.prisma.whatsapp_broadcast_runs.findUnique({ where: { id: runId }, select: { status: true, forced_at: true } });
        if (!st || st.status !== 'running') break;
        run.forced_at = st.forced_at;
      }
      const send = await this.prisma.whatsapp_broadcast_sends.findFirst({ where: { run_id: runId, session_id: sessionId, status: 'PENDING', next_at: { lte: new Date() } }, orderBy: { created_at: 'asc' } });
      if (!send) break;
      // janela de horário: fora dela, tudo deste número/run espera o próximo início
      if (pc.window && !this.inWindow(pc.window)) {
        await this.prisma.whatsapp_broadcast_sends.updateMany({ where: { run_id: runId, session_id: sessionId, status: 'PENDING' }, data: { next_at: this.nextWindowStart(pc.window) } });
        break;
      }
      // só dispara se o número existe no WhatsApp e se o contato não bloqueou o número
      const skip = await this.checkTarget(row, send, contactCache);
      if (skip) {
        await this.prisma.whatsapp_broadcast_sends.update({ where: { id: send.id }, data: { status: 'SKIPPED', skip_reason: skip } });
        sinceReconcile++;
        continue;
      }
      // aquecimento do número + limite diário da campanha → o resto da fila deste número espera amanhã
      const can = await this.pacing.canSend(pacingRow, send.chat_id, pc.daily_limit);
      if (!can.ok) {
        const r = await this.prisma.whatsapp_broadcast_sends.updateMany({ where: { run_id: runId, session_id: sessionId, status: 'PENDING', chat_id: { endsWith: '@c.us' } }, data: { status: 'PACED', next_at: this.tomorrowStart(pc.window), last_error: can.reason || null } });
        this.logger.log(`Broadcast ${bc.name} · ${sessionLabel(row)}: ${can.reason} — ${r.count} envio(s) voltam amanhã`);
        break;
      }
      const status = await this.sendOne(row, send, run, bc);
      if (status === 'DONE') this.pacing.noteSent(sessionId, Boolean(can.cold));
      if (++sinceReconcile >= 25) { await this.reconcile(runId); sinceReconcile = 0; }
      // disjuntor: bloqueios/falhas em sequência pausam a run inteira (até "Retomar" / "Enviar mesmo assim")
      if (status === 'DONE' || status === 'BLOCKED' || status === 'FAILED') {
        if (await this.breakerCheck(runId, sessionId, run, row, status)) break;
      }
      // pausa a cada N envios concluídos deste número nesta run
      if (status === 'DONE' && pc.pause_every > 0 && pc.pause_minutes > 0) {
        const done = await this.prisma.whatsapp_broadcast_sends.count({ where: { run_id: runId, session_id: sessionId, status: 'DONE' } });
        if (done > 0 && done % pc.pause_every === 0) {
          const at = new Date(Date.now() + pc.pause_minutes * 60_000);
          const r = await this.prisma.whatsapp_broadcast_sends.updateMany({ where: { run_id: runId, session_id: sessionId, status: 'PENDING' }, data: { next_at: at } });
          if (r.count) this.logger.log(`Broadcast ${bc.name} · ${sessionLabel(row)}: pausa de ${pc.pause_minutes} min após ${done} envios (${r.count} na fila)`);
          break;
        }
      }
      await sleep(this.intervalFor(pc));
    }
    await this.reconcile(runId);
  }

  /** Motivo para PULAR este destino (null = pode enviar): contato bloqueou o número, descadastrado, número sem WhatsApp. */
  private async checkTarget(row: SessionRow, send: any, cache: Map<string, any>): Promise<string | null> {
    if (send.target_kind !== 'contact' || !send.contact_id) return null;
    let c = cache.get(send.contact_id);
    if (c === undefined) {
      c = (await this.prisma.whatsapp_contacts.findUnique({ where: { id: send.contact_id } })) || null;
      cache.set(send.contact_id, c);
    }
    if (!c) return null;
    if (c.blocked_us_at) return 'O contato bloqueou este número';
    if (c.opted_out_at) return 'Contato descadastrado (LGPD)';
    const fresh = c.wa_checked_at && Date.now() - new Date(c.wa_checked_at).getTime() < 30 * 86_400_000;
    if (c.wa_exists === false && fresh) return 'Número não tem WhatsApp';
    if (c.wa_exists === true && fresh) return null;
    const phone = c.phone || phoneFromJid(send.chat_id);
    if (!phone) return null;
    try {
      const r = await this.openwa.checkNumber(row.openwa_session_id!, phone);
      const exists = Boolean(r?.exists);
      await this.prisma.whatsapp_contacts.update({ where: { id: c.id }, data: { wa_exists: exists, wa_checked_at: new Date() } }).catch(() => undefined);
      c.wa_exists = exists; c.wa_checked_at = new Date();
      return exists ? null : 'Número não tem WhatsApp';
    } catch (e: any) {
      this.logger.debug(`check ${phone}: ${e?.message || e}`);
      return null; // gateway indisponível para checar: não bloqueia o envio
    }
  }

  /** Disjuntor por (run × número). true = pausou a run. */
  private async breakerCheck(runId: string, sessionId: string, run: any, row: SessionRow, status: string) {
    const key = `${runId}|${sessionId}`;
    const b = this.breaker.get(key) || { outcomes: [], consecBlocked: 0, consecFailed: 0 };
    b.outcomes.push(status);
    if (b.outcomes.length > 50) b.outcomes.shift();
    b.consecBlocked = status === 'BLOCKED' ? b.consecBlocked + 1 : status === 'DONE' ? 0 : b.consecBlocked;
    b.consecFailed = status === 'FAILED' ? b.consecFailed + 1 : status === 'DONE' ? 0 : b.consecFailed;
    this.breaker.set(key, b);
    if (run.forced_at) return false; // "enviar mesmo assim": disjuntor desligado nesta run
    const n = b.outcomes.length;
    const blocked = b.outcomes.filter((x) => x === 'BLOCKED').length;
    const label = sessionLabel(row);
    let reason: string | null = null;
    if (b.consecBlocked >= 3) reason = `${b.consecBlocked} contatos seguidos bloquearam o número ${label}`;
    else if (n >= 20 && blocked / n >= 0.08) reason = `${blocked} de ${n} envios recentes foram bloqueados no número ${label}`;
    else if (b.consecFailed >= 5) reason = `${b.consecFailed} falhas seguidas no número ${label}`;
    if (!reason) return false;
    await this.pauseRun(run.organization_id, runId, reason, true);
    return true;
  }

  /** Pausa a run (disjuntor ou manual). Só muda se estava rodando; avisa o dono por notificação. */
  async pauseRun(orgId: string, runId: string, reason: string, auto: boolean) {
    const r = await this.prisma.whatsapp_broadcast_runs.updateMany({ where: { id: runId, organization_id: orgId, status: 'running' }, data: { status: 'paused', paused_at: new Date(), pause_reason: reason.slice(0, 255) } });
    if (!r.count) return false;
    const run = await this.prisma.whatsapp_broadcast_runs.findUnique({ where: { id: runId } });
    const bc = run ? await this.prisma.whatsapp_broadcasts.findUnique({ where: { id: run.broadcast_id } }).catch(() => null) : null;
    this.logger.warn(`Broadcast ${bc?.name || runId} PAUSADO (${auto ? 'disjuntor' : 'manual'}): ${reason}`);
    if (auto) this.hooks.emit('broadcast_paused', { orgId, run, broadcast: bc, reason });
    return true;
  }

  /** Retoma a run. `force` = "enviar mesmo assim": o disjuntor deixa de pausar esta run. */
  async resumeRun(orgId: string, broadcastId: string, runId: string, force: boolean) {
    const run = await this.prisma.whatsapp_broadcast_runs.findFirst({ where: { id: runId, broadcast_id: broadcastId, organization_id: orgId } });
    if (!run) throw new NotFoundException('Disparo não encontrado.');
    if (run.status !== 'paused') throw new BadRequestException('Este disparo não está pausado.');
    for (const k of [...this.breaker.keys()]) if (k.startsWith(`${runId}|`)) this.breaker.delete(k);
    const upd = await this.prisma.whatsapp_broadcast_runs.update({ where: { id: runId }, data: { status: 'running', paused_at: null, ...(force ? { forced_at: new Date() } : {}) } });
    await this.prisma.whatsapp_broadcast_sends.updateMany({ where: { run_id: runId, status: 'PENDING' }, data: { next_at: new Date() } });
    this.logger.log(`Broadcast run ${runId} retomada${force ? ' (enviar mesmo assim — disjuntor desligado)' : ''}`);
    return { id: upd.id, status: upd.status, forced_at: upd.forced_at };
  }

  async pauseRunManual(orgId: string, broadcastId: string, runId: string) {
    const run = await this.prisma.whatsapp_broadcast_runs.findFirst({ where: { id: runId, broadcast_id: broadcastId, organization_id: orgId } });
    if (!run) throw new NotFoundException('Disparo não encontrado.');
    if (run.status !== 'running') throw new BadRequestException('Este disparo não está em andamento.');
    await this.pauseRun(orgId, runId, 'Pausado manualmente', false);
    return { id: runId, status: 'paused' };
  }

  /** Restrição do WhatsApp num número → pausa toda run em andamento com fila nesse número. */
  private async pauseRunsOfSession(e: { orgId: string; row: any; reason?: string | null }) {
    const runs = await this.prisma.whatsapp_broadcast_sends.groupBy({ by: ['run_id'], where: { organization_id: e.orgId, session_id: e.row?.id, status: 'PENDING' } }).catch(() => []);
    for (const r of runs) await this.pauseRun(e.orgId, r.run_id, `Restrição do WhatsApp no número ${sessionLabel(e.row)}${e.reason ? `: ${e.reason}` : ''}`, true).catch(() => undefined);
  }

  /** Mensagem recebida: marca "respondeu" no último envio concluído desta conversa (30 dias). */
  private async onInbound(e: { orgId: string; sessionId: string; chatId: string }) {
    if (!e?.chatId || isGroupJid(e.chatId)) return;
    const send = await this.prisma.whatsapp_broadcast_sends.findFirst({ where: { organization_id: e.orgId, session_id: e.sessionId, chat_id: e.chatId, status: 'DONE', replied_at: null, sent_at: { gte: new Date(Date.now() - 30 * 86_400_000) } }, orderBy: { sent_at: 'desc' } });
    if (!send) return;
    await this.prisma.whatsapp_broadcast_sends.update({ where: { id: send.id }, data: { replied_at: new Date() } }).catch(() => undefined);
    await this.prisma.whatsapp_broadcast_runs.update({ where: { id: send.run_id }, data: { replied: { increment: 1 } } }).catch(() => undefined);
  }

  /** Quem respondeu aos disparos desta campanha nos últimos N dias (+ quantos não responderam). */
  async replies(orgId: string, id: string, q: { days?: any; page?: any; page_size?: any } = {}) {
    const b = await this.prisma.whatsapp_broadcasts.findFirst({ where: { id, organization_id: orgId } });
    if (!b) throw new NotFoundException('Broadcast não encontrado.');
    const days = Math.min(365, Math.max(1, parseInt(String(q.days || 7), 10) || 7));
    const page = Math.max(1, parseInt(String(q.page || 1), 10) || 1);
    const size = Math.min(100, Math.max(5, parseInt(String(q.page_size || 25), 10) || 25));
    const cutoff = new Date(Date.now() - days * 86_400_000);
    const runs = await this.prisma.whatsapp_broadcast_runs.findMany({ where: { broadcast_id: id, run_at: { gte: cutoff } }, select: { id: true, run_at: true } });
    const runIds = runs.map((r) => r.id);
    if (!runIds.length) return { days, runs: 0, sent: 0, contacts: 0, replied: 0, rate: 0, items: [], total: 0, page, pages: 1 };
    const base = { run_id: { in: runIds }, status: 'DONE', target_kind: 'contact' };
    const [sent, repliedRows, distinct] = await Promise.all([
      this.prisma.whatsapp_broadcast_sends.count({ where: base }),
      this.prisma.whatsapp_broadcast_sends.findMany({ where: { ...base, replied_at: { not: null } }, select: { contact_id: true, chat_id: true, session_id: true } }),
      this.prisma.whatsapp_broadcast_sends.groupBy({ by: ['contact_id'], where: base }),
    ]);
    const repliedKeys = new Set(repliedRows.map((r) => r.contact_id || `${r.session_id}|${r.chat_id}`));
    const total = repliedKeys.size;
    const rows = await this.prisma.whatsapp_broadcast_sends.findMany({ where: { ...base, replied_at: { not: null } }, orderBy: { replied_at: 'desc' }, distinct: ['contact_id'], skip: (page - 1) * size, take: size });
    const ids = rows.map((r) => r.contact_id).filter(Boolean) as string[];
    const contacts = ids.length ? await this.prisma.whatsapp_contacts.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, push_name: true, phone: true } }) : [];
    const cmap = new Map(contacts.map((c) => [c.id, c]));
    const smap = await this.presenter.sessionMap(orgId);
    const runAt = new Map(runs.map((r) => [r.id, r.run_at]));
    const items = await Promise.all(rows.map(async (r) => {
      const c = r.contact_id ? cmap.get(r.contact_id) : null;
      const chatUuid = r.session_id ? await this.presenter.chatUuid(orgId, r.session_id, r.chat_id).catch(() => null) : null;
      return { contact_id: r.contact_id, chat_id: chatUuid, jid: r.chat_id, name: c?.name || c?.push_name || (phoneFromJid(r.chat_id) ? `+${phoneFromJid(r.chat_id)}` : r.chat_id), phone: c?.phone || phoneFromJid(r.chat_id) || null, session: (r.session_id && smap.get(r.session_id)) || null, sent_at: r.sent_at, replied_at: r.replied_at, run_at: runAt.get(r.run_id) || null };
    }));
    const contactsCount = distinct.length;
    return { days, runs: runs.length, sent, contacts: contactsCount, replied: total, not_replied: Math.max(0, contactsCount - total), rate: sent ? Math.round((total / contactsCount) * 1000) / 10 : 0, items, total, page, pages: Math.max(1, Math.ceil(total / size)) };
  }

  private async sendOne(row: SessionRow, send: any, run: any, bc: any): Promise<'DONE' | 'PENDING' | 'BLOCKED' | 'FAILED'> {
    const orgId = row.organization_id as string;
    const pool: any[] = Array.isArray(run.copies) && (run.copies as any[]).length > 1 ? (run.copies as any[]) : [];
    const msgs = this.normMessages(pool.length ? pool[Math.min(pool.length - 1, Math.max(0, Number(send.copy_index ?? 0)))] : run.messages);
    const phoneOfTarget = phoneFromJid(send.chat_id) || null;
    // membro de grupo sem contato na org: tenta o contato pelo telefone (nome da agenda/pushName)
    const contact = send.contact_id
      ? await this.prisma.whatsapp_contacts.findUnique({ where: { id: send.contact_id } })
      : send.target_kind === 'contact' && phoneOfTarget
        ? await this.prisma.whatsapp_contacts.findFirst({ where: { organization_id: orgId, OR: [{ phone: phoneOfTarget }, { wa_id: send.chat_id }] } })
        : null;
    const vars: Record<string, string> = personVars(contact, phoneOfTarget);
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
        // o contato bloqueou este número (ou o jid não existe): sai das próximas audiências até alguém reativar
        if (send.contact_id && /blocked/i.test(msg)) await this.prisma.whatsapp_contacts.update({ where: { id: send.contact_id }, data: { blocked_us_at: new Date() } }).catch(() => undefined);
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
    const tot: SessionStats = { total: 0, sent: 0, failed: 0, blocked: 0, paced: 0, pending: 0, skipped: 0 };
    for (const x of g) {
      const sid = x.session_id || 'unknown';
      const s = by[sid] || (by[sid] = { total: 0, sent: 0, failed: 0, blocked: 0, paced: 0, pending: 0, skipped: 0 });
      const n = x._count._all;
      const key: keyof SessionStats | null = x.status === 'DONE' ? 'sent' : x.status === 'FAILED' ? 'failed' : x.status === 'BLOCKED' ? 'blocked' : x.status === 'PACED' ? 'paced' : x.status === 'PENDING' ? 'pending' : x.status === 'SKIPPED' ? 'skipped' : null;
      s.total += n; tot.total += n;
      if (key) { s[key] += n; tot[key] += n; }
    }
    const open = tot.pending + tot.paced;
    const prev = await this.prisma.whatsapp_broadcast_runs.findUnique({ where: { id: runId } });
    if (!prev) return;
    const replied = await this.prisma.whatsapp_broadcast_sends.count({ where: { run_id: runId, replied_at: { not: null } } });
    // pausada (disjuntor/manual) continua pausada enquanto houver fila; sem fila = concluída
    const status = open ? (prev.status === 'paused' ? 'paused' : 'running') : 'done';
    await this.prisma.whatsapp_broadcast_runs.update({ where: { id: runId }, data: { sent: tot.sent, failed: tot.failed, blocked: tot.blocked, skipped: tot.skipped, replied, by_session: by as any, status, ...(open ? {} : { finished_at: new Date(), paused_at: null }) } });
    // terminou agora → notificação
    if (!open && prev && prev.status !== 'done') {
      const b = await this.prisma.whatsapp_broadcasts.findUnique({ where: { id: prev.broadcast_id } }).catch(() => null);
      this.hooks.emit('broadcast_done', { orgId: prev.organization_id, broadcast: b, run: prev, stats: tot });
    }
  }
}
