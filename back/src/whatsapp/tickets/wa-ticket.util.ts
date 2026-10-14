// ============================================================================
// Chamados / protocolos (Fase 6B — contrato `docs/whatsapp-assinaturas-contrato.md` §10).
// Funções PURAS (sem Nest/Prisma): normalização da configuração, protocolo, prazos (SLA) e textos.
// Testes: docs/tools/wa_ticket_util_test.mjs.
// ============================================================================

export const TICKET_STATUSES = ['open', 'pending', 'resolved', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const ACTIVE_TICKET = ['open', 'pending'] as const;
export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const STATUS_LABEL: Record<TicketStatus, string> = { open: 'Aberto', pending: 'Aguardando você', resolved: 'Resolvido', closed: 'Encerrado' };
/** Rótulo para a EQUIPE (o "pending" é "aguardando o cliente" do lado de cá). */
export const STATUS_LABEL_STAFF: Record<TicketStatus, string> = { open: 'Aberto', pending: 'Aguardando cliente', resolved: 'Resolvido', closed: 'Encerrado' };
export const PRIORITY_LABEL: Record<TicketPriority, string> = { low: 'Baixa', normal: 'Normal', high: 'Alta', urgent: 'Urgente' };

export type TicketCategory = {
  key: string; label: string; description: string; sla_hours: number | null; first_response_hours: number | null;
  default_priority: TicketPriority; assignee_id: string | null; active: boolean;
};
export type TicketTexts = { created: string; status_changed: string; resolved: string; closed: string; pending: string; comment: string; reopened: string };
export type TicketSettings = {
  prefix: string; reset_yearly: boolean; categories: TicketCategory[];
  sla_hours: Record<TicketPriority, number>; first_response_hours: Record<TicketPriority, number>;
  warn_before_minutes: number; auto_close_days: number; reopen_days: number; customer_reply_reopens: boolean;
  notify_customer: { created: boolean; status: boolean; resolved: boolean; comment: boolean };
  texts: TicketTexts;
};

export const DEFAULT_TICKET_TEXTS: TicketTexts = {
  created:
    'Recebemos seu chamado ✅\n\n📄 Protocolo: *{{chamado.protocolo}}*\n📂 {{chamado.categoria}}\n⏱️ Prazo para retorno: {{chamado.prazo}}\n\nGuarde este número para acompanhar.',
  status_changed: 'Atualização do protocolo *{{chamado.protocolo}}*: agora está *{{chamado.status}}*.',
  resolved: 'Seu chamado *{{chamado.protocolo}}* foi resolvido ✅\n\nSe ainda precisar de algo, é só responder por aqui.',
  closed: 'O chamado *{{chamado.protocolo}}* foi encerrado. Obrigado pelo contato!',
  pending: 'Precisamos de uma informação sua para continuar o protocolo *{{chamado.protocolo}}*:\n\n{{chamado.comentario}}\n\nÉ só responder por aqui.',
  comment: 'Atualização do protocolo *{{chamado.protocolo}}*:\n\n{{chamado.comentario}}',
  reopened: 'Reabrimos o protocolo *{{chamado.protocolo}}* com a sua mensagem. Em breve retornamos.',
};

export const DEFAULT_CATEGORIES: TicketCategory[] = [
  { key: 'duvida', label: 'Dúvida', description: '', sla_hours: null, first_response_hours: null, default_priority: 'normal', assignee_id: null, active: true },
  { key: 'problema', label: 'Problema / reclamação', description: '', sla_hours: null, first_response_hours: null, default_priority: 'high', assignee_id: null, active: true },
  { key: 'solicitacao', label: 'Solicitação', description: '', sla_hours: null, first_response_hours: null, default_priority: 'normal', assignee_id: null, active: true },
];

const DEF_SLA: Record<TicketPriority, number> = { low: 120, normal: 48, high: 24, urgent: 4 };
const DEF_FIRST: Record<TicketPriority, number> = { low: 24, normal: 8, high: 4, urgent: 1 };
const MAX_CATEGORIES = 40;

const clampInt = (v: unknown, min: number, max: number, def: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max) : '');
const bool = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def);

export const isPriority = (p: unknown): p is TicketPriority => typeof p === 'string' && (TICKET_PRIORITIES as readonly string[]).includes(p);
export const isTicketStatus = (s: unknown): s is TicketStatus => typeof s === 'string' && (TICKET_STATUSES as readonly string[]).includes(s);

/** Chave da categoria: minúsculas, sem acento, [a-z0-9_-], até 40. */
export function categoryKey(raw: unknown): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function hoursMap(raw: any, def: Record<TicketPriority, number>, max: number): Record<TicketPriority, number> {
  const o = raw && typeof raw === 'object' ? raw : {};
  return Object.fromEntries(TICKET_PRIORITIES.map((p) => [p, clampInt(o[p], 1, max, def[p])])) as Record<TicketPriority, number>;
}

/** Nunca lança: mescla o JSON salvo (parcial/antigo) com os padrões. */
export function normalizeTicketSettings(raw: any): TicketSettings {
  const r = raw && typeof raw === 'object' ? raw : {};
  const seen = new Set<string>();
  const cats: TicketCategory[] = [];
  const src = Array.isArray(r.categories) ? r.categories : DEFAULT_CATEGORIES;
  for (const c of src.slice(0, MAX_CATEGORIES)) {
    if (!c || typeof c !== 'object') continue;
    const label = str(c.label, 60);
    const key = categoryKey(c.key || label);
    if (!label || !key || seen.has(key)) continue;
    seen.add(key);
    cats.push({
      key, label, description: str(c.description, 200),
      sla_hours: c.sla_hours == null || c.sla_hours === '' ? null : clampInt(c.sla_hours, 1, 8760, 48),
      first_response_hours: c.first_response_hours == null || c.first_response_hours === '' ? null : clampInt(c.first_response_hours, 1, 8760, 8),
      default_priority: isPriority(c.default_priority) ? c.default_priority : 'normal',
      assignee_id: typeof c.assignee_id === 'string' && /^[0-9a-f-]{36}$/i.test(c.assignee_id) ? c.assignee_id : null,
      active: bool(c.active, true),
    });
  }
  const t = r.texts && typeof r.texts === 'object' ? r.texts : {};
  const texts = Object.fromEntries(Object.keys(DEFAULT_TICKET_TEXTS).map((k) => [k, str(t[k], 1500) || (DEFAULT_TICKET_TEXTS as any)[k]])) as TicketTexts;
  const n = r.notify_customer && typeof r.notify_customer === 'object' ? r.notify_customer : {};
  return {
    prefix: String(r.prefix ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6),
    reset_yearly: bool(r.reset_yearly, true),
    categories: cats,
    sla_hours: hoursMap(r.sla_hours, DEF_SLA, 8760),
    first_response_hours: hoursMap(r.first_response_hours, DEF_FIRST, 8760),
    warn_before_minutes: clampInt(r.warn_before_minutes, 5, 10080, 60),
    auto_close_days: clampInt(r.auto_close_days, 0, 365, 7),
    reopen_days: clampInt(r.reopen_days, 0, 365, 7),
    customer_reply_reopens: bool(r.customer_reply_reopens, true),
    notify_customer: { created: bool(n.created, true), status: bool(n.status, true), resolved: bool(n.resolved, true), comment: bool(n.comment, true) },
    texts,
  };
}

/** Ano corrente em BRT (UTC−3 fixo). */
export const brtYear = (d: Date = new Date()) => new Date(d.getTime() - 3 * 3600_000).getUTCFullYear();

/** Nome do contador do protocolo. */
export const counterName = (s: Pick<TicketSettings, 'reset_yearly'>, now: Date = new Date()) => (s.reset_yearly ? `ticket:${brtYear(now)}` : 'ticket');

/** Protocolo: prefixo + AAAA + 6 dígitos (reinício anual) ou prefixo + 8 dígitos. */
export function formatProtocol(s: Pick<TicketSettings, 'prefix' | 'reset_yearly'>, number: number, now: Date = new Date()): string {
  const n = Math.max(1, Math.floor(number));
  return s.reset_yearly ? `${s.prefix}${brtYear(now)}${String(n).padStart(6, '0')}` : `${s.prefix}${String(n).padStart(8, '0')}`;
}

/** Só dígitos/letras, maiúsculo — para achar o protocolo que a pessoa digitou ("2026-000042" → "2026000042"). */
export const normalizeProtocolInput = (raw: unknown) => String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24);

export function slaHoursFor(s: TicketSettings, category: string, priority: TicketPriority) {
  const c = s.categories.find((x) => x.key === category);
  return {
    solve: c?.sla_hours ?? s.sla_hours[priority] ?? 48,
    first: c?.first_response_hours ?? s.first_response_hours[priority] ?? 8,
  };
}

/** Prazos (horas corridas) a partir da criação. */
export function computeDue(s: TicketSettings, category: string, priority: TicketPriority, createdAt: Date) {
  const h = slaHoursFor(s, category, priority);
  return { sla_due_at: new Date(+createdAt + h.solve * 3600_000), first_response_due_at: new Date(+createdAt + h.first * 3600_000) };
}

export type SlaState = 'ok' | 'due_soon' | 'overdue' | 'met' | 'breached_met' | 'none';
export function slaState(t: { status: string; sla_due_at?: Date | string | null; resolved_at?: Date | string | null; closed_at?: Date | string | null }, warnMinutes: number, now: number = Date.now()): SlaState {
  if (!t.sla_due_at) return 'none';
  const due = +new Date(t.sla_due_at);
  if (t.status === 'resolved' || t.status === 'closed') {
    const end = +new Date(t.resolved_at || t.closed_at || now);
    return end <= due ? 'met' : 'breached_met';
  }
  if (now > due) return 'overdue';
  if (due - now <= warnMinutes * 60_000) return 'due_soon';
  return 'ok';
}

/** "em 2 h", "em 3 dias", "há 5 h" — prazo legível em pt-BR. */
export function fmtDueRelative(due: Date | string | null | undefined, now: number = Date.now()): string {
  if (!due) return '';
  const diff = +new Date(due) - now;
  const abs = Math.abs(diff);
  const min = Math.round(abs / 60_000);
  let txt: string;
  if (min < 60) txt = `${Math.max(1, min)} min`;
  else if (min < 48 * 60) txt = `${Math.round(min / 60)} h`;
  else txt = `${Math.round(min / 1440)} dias`;
  return diff >= 0 ? `em ${txt}` : `há ${txt}`;
}

/** Data/hora BRT "15/10 às 14:30" (ou "15/10/2027 às 14:30" se outro ano). */
export function fmtDueAbsolute(due: Date | string | null | undefined, now: Date = new Date()): string {
  if (!due) return '';
  const d = new Date(+new Date(due) - 3 * 3600_000);
  const n = new Date(+now - 3 * 3600_000);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yy = d.getUTCFullYear() !== n.getUTCFullYear() ? `/${d.getUTCFullYear()}` : '';
  return `${dd}/${mm}${yy} às ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** Assunto padrão = 1ª linha da descrição (até 80). */
export function defaultSubject(description: string, categoryLabel: string): string {
  const first = String(description || '').split('\n').map((l) => l.trim()).find(Boolean) || '';
  const s = first.length > 80 ? `${first.slice(0, 77).trimEnd()}…` : first;
  return s || categoryLabel || 'Chamado';
}

const COURTESY = new Set([
  'ok', 'okay', 'oki', 'okk', 'blz', 'beleza', 'certo', 'ta', 'tá', 'ta bom', 'tá bom', 'tudo bem', 'show', 'top', 'perfeito', 'otimo', 'ótimo',
  'obrigado', 'obrigada', 'obg', 'brigado', 'brigada', 'valeu', 'vlw', 'muito obrigado', 'muito obrigada', 'obrigado!', 'grato', 'grata',
  'de nada', 'entendi', 'entendido', 'combinado', 'sim', 'ok obrigado', 'ok obrigada', 'ok, obrigado', 'ok, obrigada', 'thanks', 'thank you',
]);

/** Agradecimento/confirmação curta ("ok", "obrigado", "👍") — não reabre chamado resolvido. */
export function isCourtesy(text: string): boolean {
  const t = String(text || '').trim().toLowerCase();
  if (!t) return true;
  const letters = t.replace(/[\p{P}\p{S}\s]/gu, '');
  if (!letters) return true; // só emoji/pontuação
  if (t.split(/\s+/).length > 4) return false;
  const norm = t.replace(/[!.?,;:]+/g, ' ').replace(/\s+/g, ' ').trim();
  return COURTESY.has(norm) || COURTESY.has(norm.replace(/[\p{Extended_Pictographic}️]/gu, '').trim());
}
