// Fluxo do Bot do WhatsApp — peças PURAS do runtime dos blocos de CHAMADOS (Fase 6B, contrato em
// docs/whatsapp-assinaturas-contrato.md §10.5). Sem banco e sem Nest (mesmo desenho do wa-bot-booking.runtime.ts):
//  - `TICKET_ACTIONS`: ações que o runtime executa no WhatsAppTicketsService e respondem com `crm_result`
//  - `flowUsesTickets`: o fluxo precisa dos chamados em andamento no contexto (condição / {{chamado.*}} fora dos blocos)?
//  - formatos do serviço → motor: `toBotTicket`, `toBotCategories`, `mediaKindOf`
//  - simulador: `simulateTicketAction` (categorias / chamados EM MEMÓRIA, nada é gravado), `fixtureTickets`,
//    `cleanTicketFixture`, `describeTicketAction`.
import {
  BotAction,
  BotDefinition,
  BotEventPayload,
  BotState,
  BotTicket,
  BotTicketCategory,
  BotCustomField,
  cfDisplay,
  isTicketType,
  normalizeProtocol,
} from './wa-bot.engine';

/** Ações de chamado que o runtime executa e respondem com `crm_result`. */
export const TICKET_ACTIONS = new Set(['ticket_categories', 'ticket_create', 'ticket_list', 'ticket_lookup', 'ticket_add_info']);
/** Só leitura (o simulador com dados reais da org consulta de verdade; as demais são simuladas). */
export const TICKET_READ_ACTIONS = new Set(['ticket_categories', 'ticket_list', 'ticket_lookup']);

const TICKET_VAR_RE = /\{\{\s*chamados?\./i;

/**
 * O fluxo usa os chamados do contato FORA dos blocos de chamado? Condição `source:'ticket'` ou texto com
 * `{{chamado.*}}`/`{{chamados.lista}}` em blocos comuns. (Os blocos de chamado buscam o que precisam pelas ações.)
 */
export function flowUsesTickets(def: BotDefinition | null | undefined): boolean {
  const nodes = Array.isArray(def?.nodes) ? def!.nodes : [];
  const others: any[] = [];
  for (const n of nodes) {
    const t = String(n?.type || '');
    const d: any = n?.data || {};
    if (t === 'condition' && Array.isArray(d.rules) && d.rules.some((r: any) => r?.source === 'ticket')) return true;
    if (!isTicketType(t)) others.push(d);
  }
  try {
    return TICKET_VAR_RE.test(JSON.stringify(others));
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------ formatos do serviço → motor
const str = (v: any) => (v == null ? '' : String(v));
const iso = (v: any) => (v instanceof Date ? v.toISOString() : v ? String(v) : null);

/** Chamado no formato do `WhatsAppTicketsService` (shape) → `BotTicket`. `last_update` = última atualização pública. */
export function toBotTicket(t: any, extra: { last_update?: string | null; can_add_info?: boolean; fields?: { key?: string; label: string; display: string }[] } = {}): BotTicket {
  return {
    id: str(t?.id),
    protocol: str(t?.protocol),
    status: str(t?.status),
    status_label: str(t?.status_label_customer || ''),
    category: str(t?.category),
    category_label: str(t?.category_label || t?.category),
    subject: str(t?.subject),
    priority: str(t?.priority),
    priority_label: str(t?.priority_label),
    sla_label: str(t?.sla_label),
    sla_relative: str(t?.sla_relative),
    last_update: extra.last_update ?? null,
    created_at: iso(t?.created_at),
    media_count: Array.isArray(t?.media_ids) ? t.media_ids.length : 0,
    ...(extra.can_add_info === false ? { can_add_info: false } : {}),
    ...(extra.fields?.length ? { fields: extra.fields } : {}),
  };
}

/** Categorias ATIVAS da configuração de chamados (`settings(org).categories`). */
export function toBotCategories(settings: any): BotTicketCategory[] {
  const list = Array.isArray(settings?.categories) ? settings.categories : [];
  return list
    .filter((c: any) => c && c.key && c.active !== false)
    .slice(0, 20)
    .map((c: any) => ({ key: str(c.key), label: str(c.label || c.key), description: c.description ? str(c.description) : null, active: true }));
}

/**
 * Tipo da mensagem recebida → tipo de ARQUIVO que o motor entende (`image`/`document`/`video`/`audio`/`sticker`);
 * texto, localização, contato, enquete… = null (não é arquivo).
 */
export function mediaKindOf(type: unknown): string | null {
  const t = String(type || '').toLowerCase();
  if (t === 'image') return 'image';
  if (t === 'sticker') return 'sticker';
  if (t === 'document' || t === 'file') return 'document';
  if (t === 'video') return 'video';
  if (t === 'audio' || t === 'voice' || t === 'ptt') return 'audio';
  return null;
}

// ================================================================== simulador (sem banco)
export type TicketFixture = {
  categories?: any[]; // categorias reais (GET /whatsapp/tickets/settings → categories) ou de exemplo
  tickets?: any[]; // chamados fictícios do contato (formato BotTicket)
  fail_create?: boolean; // simula falha ao abrir (testa a porta "Deu erro")
};

export const SAMPLE_TICKET_CATEGORIES: BotTicketCategory[] = [
  { key: 'duvida', label: 'Dúvida', active: true },
  { key: 'problema', label: 'Problema / reclamação', active: true },
  { key: 'solicitacao', label: 'Solicitação', active: true },
];
const STATUS_LABEL: Record<string, string> = { open: 'Aberto', pending: 'Aguardando você', resolved: 'Resolvido', closed: 'Encerrado' };
const PRIORITY_LABEL: Record<string, string> = { low: 'Baixa', normal: 'Normal', high: 'Alta', urgent: 'Urgente' };
const ACTIVE = new Set(['open', 'pending']);
const SLA_HOURS: Record<string, number> = { low: 120, normal: 48, high: 24, urgent: 4 };

/** Fixture do simulador (`crm_fixture.tickets`), copiada e limitada; nunca lança. */
export function cleanTicketFixture(raw: any): TicketFixture {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return {
    categories: Array.isArray(raw.categories) ? raw.categories.slice(0, 40) : undefined,
    tickets: Array.isArray(raw.tickets) ? raw.tickets.slice(0, 10) : undefined,
    fail_create: Boolean(raw.fail_create),
  };
}

function fixtureCategories(fx: TicketFixture): BotTicketCategory[] {
  const list = Array.isArray(fx.categories) && fx.categories.length ? toBotCategories({ categories: fx.categories }) : SAMPLE_TICKET_CATEGORIES;
  return list.length ? list : SAMPLE_TICKET_CATEGORIES;
}

const shapeFixtureTicket = (t: any): BotTicket => ({
  id: str(t?.id),
  protocol: str(t?.protocol),
  status: str(t?.status || 'open'),
  status_label: str(t?.status_label || STATUS_LABEL[str(t?.status || 'open')] || ''),
  category: str(t?.category),
  category_label: str(t?.category_label || t?.category),
  subject: str(t?.subject),
  priority: str(t?.priority || 'normal'),
  priority_label: str(t?.priority_label || PRIORITY_LABEL[str(t?.priority || 'normal')] || ''),
  sla_label: str(t?.sla_label),
  sla_relative: str(t?.sla_relative),
  last_update: t?.last_update ? str(t.last_update) : null,
  created_at: t?.created_at ? str(t.created_at) : null,
  media_count: Number(t?.media_count) || 0,
  ...(t?.can_add_info === false ? { can_add_info: false } : {}),
  ...(Array.isArray(t?.fields) ? { fields: t.fields.slice(0, 20) } : {}),
});

/** Chamados fictícios do contato: os abertos na simulação (`state.__fixture_tickets`) + os da fixture (mais recentes primeiro). */
export function fixtureTickets(state: BotState | null, fx: TicketFixture): BotTicket[] {
  const made: BotTicket[] = Array.isArray((state as any)?.__fixture_tickets) ? (state as any).__fixture_tickets : [];
  const base = (Array.isArray(fx.tickets) ? fx.tickets : []).map(shapeFixtureTicket).filter((t) => t.id && t.protocol && !made.some((m) => m.id === t.id));
  return [...[...made].reverse(), ...base];
}
function saveTicket(state: BotState, t: BotTicket) {
  const made: BotTicket[] = Array.isArray((state as any).__fixture_tickets) ? [...(state as any).__fixture_tickets] : [];
  const i = made.findIndex((x) => x.id === t.id);
  if (i >= 0) made[i] = t;
  else made.push(t);
  (state as any).__fixture_tickets = made.slice(-10);
}

/** "15/10 às 14:30" em BRT (igual ao `fmtDueAbsolute` do serviço, sem o ano). */
function brtLabel(d: Date) {
  const b = new Date(d.getTime() - 3 * 3_600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(b.getUTCDate())}/${p(b.getUTCMonth() + 1)} às ${p(b.getUTCHours())}:${p(b.getUTCMinutes())}`;
}

/**
 * Resolve uma ação de chamado EM MEMÓRIA (simulador). Devolve o `crm_result` e notas extras. Chamados "abertos"
 * ficam em `state.__fixture_tickets` (o estado viaja de volta pelo front). Nada é gravado.
 */
export function simulateTicketAction(a: BotAction, state: BotState, fx: TicketFixture, now: Date = new Date(), defs: BotCustomField[] = []): { payload: BotEventPayload | null; extra: any[] } {
  const extra: any[] = [];
  const cats = fixtureCategories(fx);
  const all = fixtureTickets(state, fx);
  switch (a.type) {
    case 'ticket_categories':
      return { payload: { ok: true, categories: cats }, extra };
    case 'ticket_create': {
      if (fx.fail_create) return { payload: { ok: false, error: 'Simulação: falha ao abrir o chamado.' }, extra };
      const cat = cats.find((c) => c.key === a.category);
      if (!cat) return { payload: { ok: false, error: 'Categoria inexistente ou desativada.' }, extra };
      const priority = a.priority || 'normal';
      const n = all.length + 41;
      const year = new Date(now.getTime() - 3 * 3_600_000).getUTCFullYear();
      const desc = String(a.description || '');
      const t: BotTicket = {
        id: `sim-tk-${Math.random().toString(36).slice(2, 10)}`,
        protocol: `${year}${String(n).padStart(6, '0')}`,
        status: 'open',
        status_label: STATUS_LABEL.open,
        category: cat.key,
        category_label: cat.label,
        subject: a.subject || (desc.split('\n').find((l) => l.trim()) || cat.label).slice(0, 80),
        priority,
        priority_label: PRIORITY_LABEL[priority] || priority,
        sla_label: brtLabel(new Date(now.getTime() + (SLA_HOURS[priority] || 48) * 3_600_000)),
        sla_relative: `em ${SLA_HOURS[priority] || 48} h`,
        last_update: null,
        created_at: now.toISOString(),
        media_count: (a.media_ids || []).length,
      };
      // campos personalizados respondidos no bloco → os visíveis ao cliente aparecem em "Meus chamados"
      const cus: any = a.custom && typeof a.custom === 'object' ? a.custom : {};
      const fields = (defs || []).filter((f) => f.visible_to_customer === true).map((f) => ({ key: f.key, label: f.label, display: cfDisplay(f, cus[f.key]) })).filter((x) => x.display);
      if (fields.length) t.fields = fields;
      saveTicket(state, t);
      extra.push({ type: 'info', text: `Simulação: protocolo fictício ${t.protocol}${t.media_count ? ` com ${t.media_count} anexo(s)` : ''} — nada foi gravado.` });
      return { payload: { ok: true, ticket: t }, extra };
    }
    case 'ticket_list': {
      const list = all.filter((t) => a.show === 'all' || ACTIVE.has(t.status)).slice(0, Math.max(1, Math.min(10, Number(a.limit) || 5)));
      return { payload: { ok: true, tickets: list }, extra };
    }
    case 'ticket_lookup': {
      const p = normalizeProtocol(a.protocol);
      const t = all.find((x) => normalizeProtocol(x.protocol) === p) || null;
      return { payload: { ok: true, ticket: t }, extra };
    }
    case 'ticket_add_info': {
      const cur = all.find((x) => x.id === a.id);
      if (!cur) return { payload: { ok: false, error: 'Chamado não encontrado.' }, extra };
      if (cur.can_add_info === false)
        return { payload: { ok: false, error: 'só leitura', user_text: 'Para enviar informações, confirme o seu CPF/CNPJ (o código sozinho só permite consultar).' }, extra };
      if (cur.status === 'closed') return { payload: { ok: false, code: 'CLOSED', error: 'Chamado encerrado.', ticket: cur }, extra };
      const t: BotTicket = { ...cur, status: 'open', status_label: STATUS_LABEL.open, media_count: (cur.media_count || 0) + (a.media_id ? 1 : 0) };
      saveTicket(state, t);
      extra.push({ type: 'info', text: `Simulação: mensagem juntaria ao protocolo ${cur.protocol}${cur.status !== 'open' ? ' (voltaria para "Aberto")' : ''} — nada foi gravado.` });
      return { payload: { ok: true, ticket: t }, extra };
    }
    default:
      return { payload: null, extra };
  }
}

/** Texto "o que o runtime faria" (log/simulador). */
export function describeTicketAction(a: BotAction): string {
  switch (a.type) {
    case 'ticket_categories':
      return 'Buscando as categorias de chamado…';
    case 'ticket_create':
      return `Abrindo o chamado${a.media_ids?.length ? ` com ${a.media_ids.length} anexo(s)` : ''}…`;
    case 'ticket_list':
      return a.show === 'all' ? 'Buscando os chamados do contato…' : 'Buscando os chamados em andamento do contato…';
    case 'ticket_lookup':
      return `Procurando o protocolo ${a.protocol}…`;
    case 'ticket_add_info':
      return 'Juntando a mensagem ao chamado…';
    default:
      return `Ação ${a.type}.`;
  }
}
