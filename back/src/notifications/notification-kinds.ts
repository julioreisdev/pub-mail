// =============================================================================
// Catálogo das notificações + preferências por usuário (forma única, normalizada aqui).
// O front mostra os mesmos rótulos (GET /notifications/catalog) — fonte única.
// Sem dependências: dá para testar em Node puro.
// =============================================================================

export const SOUNDS = ['default', 'chime', 'ping', 'alert', 'none'] as const;
export const VIBRATIONS = ['short', 'double', 'long', 'none'] as const;
export type Sound = (typeof SOUNDS)[number];
export type Vibration = (typeof VIBRATIONS)[number];

/** Padrões de vibração (ms) — o navegador recebe a lista pronta. */
export const VIBRATION_PATTERNS: Record<Vibration, number[]> = {
  short: [120],
  double: [100, 80, 100],
  long: [350],
  none: [],
};

export type KindGroup = 'messages' | 'attendance' | 'tasks' | 'agenda' | 'tickets' | 'orders' | 'billing' | 'pipeline' | 'connection' | 'other';

export type KindMeta = {
  key: string;
  group: KindGroup;
  label: string;
  description: string;
  /** importante = fica na tela até o usuário tocar (requireInteraction) */
  important?: boolean;
};

export const KIND_GROUPS: Record<KindGroup, { label: string; description: string }> = {
  messages: { label: 'Mensagens', description: 'O que chega nas conversas do WhatsApp.' },
  attendance: { label: 'Atendimento', description: 'Fila, atribuições e transferências entre atendentes.' },
  tasks: { label: 'Tarefas', description: 'Prazos e tarefas atribuídas a você.' },
  agenda: { label: 'Agenda', description: 'Agendamentos de serviços (os seus, se você é o profissional).' },
  tickets: { label: 'Chamados', description: 'Protocolos abertos pelos clientes, atribuições e prazos.' },
  orders: { label: 'Pedidos', description: 'Pedidos feitos pelo WhatsApp (bot, painel ou API) e pagamentos deles.' },
  billing: { label: 'Cobranças', description: 'Pagamentos e vencimentos dos clientes.' },
  pipeline: { label: 'Funil', description: 'Movimentação das conversas no funil de vendas.' },
  connection: { label: 'Conexão', description: 'Estado dos números conectados.' },
  other: { label: 'Outros', description: 'Equipe, avaliações, broadcasts e avisos personalizados.' },
};

export const KINDS: KindMeta[] = [
  { key: 'message', group: 'messages', label: 'Mensagem nova', description: 'Mensagem recebida numa conversa individual.' },
  { key: 'message_group', group: 'messages', label: 'Mensagem em grupo', description: 'Mensagem recebida num grupo (pode ser muita coisa).' },
  { key: 'mention', group: 'messages', label: 'Mencionaram você num grupo', description: 'Alguém citou o seu número com @ num grupo.' },
  { key: 'queue', group: 'attendance', label: 'Conversa entrou na fila', description: 'Um cliente está esperando atendimento humano.' },
  { key: 'assigned', group: 'attendance', label: 'Conversa atribuída a você', description: 'Distribuição automática ou um colega passou a conversa para você.' },
  { key: 'transferred', group: 'attendance', label: 'Transferência', description: 'Uma conversa sua foi transferida para outra pessoa.' },
  { key: 'handoff', group: 'attendance', label: 'Bot pediu um humano', description: 'O fluxo do bot encaminhou a conversa para atendimento.' },
  { key: 'task_due', group: 'tasks', label: 'Tarefa no prazo', description: 'Lembrete quando o prazo da tarefa chega.' },
  { key: 'task_assigned', group: 'tasks', label: 'Tarefa atribuída a você', description: 'Alguém criou ou passou uma tarefa para você.' },
  { key: 'appointment_booked', group: 'agenda', label: 'Novo agendamento', description: 'Um cliente (ou a equipe) marcou um horário.' },
  { key: 'appointment_canceled', group: 'agenda', label: 'Agendamento cancelado', description: 'Um horário foi cancelado pelo cliente ou pela equipe.' },
  { key: 'appointment_no_show', group: 'agenda', label: 'Falta', description: 'Um cliente não compareceu (marcado pela equipe ou automaticamente).' },
  { key: 'ticket_created', group: 'tickets', label: 'Novo chamado', description: 'Um cliente (ou a equipe) abriu um chamado — para o responsável da categoria ou para todos.' },
  { key: 'ticket_assigned', group: 'tickets', label: 'Chamado atribuído a você', description: 'Um colega (ou a categoria) passou um chamado para você.' },
  { key: 'ticket_sla', group: 'tickets', label: 'Prazo do chamado', description: 'Um chamado está perto de vencer ou passou do prazo.', important: true },
  { key: 'order_created', group: 'orders', label: 'Novo pedido', description: 'Um cliente fez um pedido (pelo bot, painel ou API).', important: true },
  { key: 'order_paid', group: 'orders', label: 'Pedido pago', description: 'O PIX de um pedido foi confirmado.' },
  { key: 'charge_paid', group: 'billing', label: 'Pagamento confirmado', description: 'PIX ou boleto de um cliente foi pago.', important: true },
  { key: 'charge_overdue', group: 'billing', label: 'Cobrança venceu', description: 'Uma cobrança passou do vencimento sem pagamento.' },
  { key: 'pipeline_moved', group: 'pipeline', label: 'Mudou de etapa', description: 'Uma conversa foi movida no funil.' },
  { key: 'pipeline_won', group: 'pipeline', label: 'Negócio ganho', description: 'Uma conversa chegou numa etapa de ganho.', important: true },
  { key: 'session_disconnected', group: 'connection', label: 'Número desconectou', description: 'Um número do WhatsApp caiu ou foi desconectado.', important: true },
  { key: 'session_connected', group: 'connection', label: 'Número conectou', description: 'Um número do WhatsApp voltou a ficar pronto.' },
  { key: 'rating', group: 'other', label: 'Avaliação recebida', description: 'Um cliente deu nota ao atendimento.' },
  { key: 'broadcast_done', group: 'other', label: 'Broadcast concluído', description: 'Um disparo em massa terminou.' },
  { key: 'broadcast_paused', group: 'other', label: 'Broadcast pausado', description: 'O disparo parou sozinho por bloqueios ou restrição — precisa da sua decisão.', important: true },
  { key: 'team_message', group: 'other', label: 'Mensagem da equipe', description: 'Alguém falou com você no chat interno.' },
  { key: 'custom', group: 'other', label: 'Avisos personalizados', description: 'Notificações criadas por você ou pela sua equipe.' },
];

export const KIND_KEYS = KINDS.map((k) => k.key);
export const kindMeta = (key: string) => KINDS.find((k) => k.key === key) || null;

export type ChatFilterEntry = { chat_id: string; name?: string | null; session_id?: string | null; jid?: string | null };

export type Prefs = {
  enabled: boolean;
  push: boolean;
  inapp: boolean;
  only_when_away: boolean;
  sound: Sound;
  vibrate: Vibration;
  quiet: { enabled: boolean; start: string; end: string };
  /** ícone padrão dos avisos: logo do Pub Mail, emoji (renderizado em PNG pelo painel) ou imagem (upload/URL) */
  icon: { mode: 'default' | 'emoji' | 'image'; emoji: string | null; url: string | null };
  /** mensagens/atendimento: usar a foto do contato ou do grupo como ícone (quando existir) */
  contact_photo: boolean;
  message: {
    enabled: boolean;
    scope: 'all' | 'mine' | 'unassigned';
    sessions: string[] | null;
    contacts: { mode: 'all' | 'only' | 'except'; chats: ChatFilterEntry[] };
  };
  message_group: boolean;
  mention: boolean;
  queue: boolean;
  assigned: boolean;
  transferred: boolean;
  handoff: boolean;
  task_due: boolean;
  task_assigned: boolean;
  appointment_booked: boolean;
  appointment_canceled: boolean;
  appointment_no_show: boolean;
  ticket_created: boolean;
  ticket_assigned: boolean;
  ticket_sla: boolean;
  order_created: boolean;
  order_paid: boolean;
  charge_paid: boolean;
  charge_overdue: boolean;
  pipeline: { enabled: boolean; stages: string[] | null };
  pipeline_won: boolean;
  session_disconnected: boolean;
  session_connected: boolean;
  rating: boolean;
  broadcast_done: boolean;
  broadcast_paused: boolean;
  team_message: boolean;
  custom: boolean;
};

export const DEFAULT_PREFS: Prefs = {
  enabled: true,
  push: true,
  inapp: true,
  only_when_away: true,
  sound: 'default',
  vibrate: 'short',
  quiet: { enabled: false, start: '22:00', end: '07:00' },
  icon: { mode: 'default', emoji: null, url: null },
  contact_photo: true,
  message: { enabled: true, scope: 'all', sessions: null, contacts: { mode: 'all', chats: [] } },
  message_group: false,
  mention: true,
  queue: true,
  assigned: true,
  transferred: true,
  handoff: true,
  task_due: true,
  task_assigned: true,
  appointment_booked: true,
  appointment_canceled: true,
  appointment_no_show: true,
  ticket_created: true,
  ticket_assigned: true,
  ticket_sla: true,
  order_created: true,
  order_paid: true,
  charge_paid: true,
  charge_overdue: true,
  pipeline: { enabled: false, stages: null },
  pipeline_won: true,
  session_disconnected: true,
  session_connected: false,
  rating: true,
  broadcast_done: true,
  broadcast_paused: true,
  team_message: true,
  custom: true,
};

const bool = (v: unknown, d: boolean) => (v === undefined || v === null ? d : Boolean(v));
const pick = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(String(v) as T) ? (String(v) as T) : d);
const hhmm = (v: unknown, d: string) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : d);
const idList = (v: unknown): string[] | null => {
  if (v === null || v === undefined) return null;
  if (!Array.isArray(v)) return null;
  const out = [...new Set(v.map((x) => String(x || '').trim()).filter(Boolean))].slice(0, 200);
  return out;
};

/** Mescla o JSON guardado (ou parcial vindo do PUT) com os padrões. Nunca lança. */
export function normalizePrefs(raw: any, base: Prefs = DEFAULT_PREFS): Prefs {
  const r = raw && typeof raw === 'object' ? raw : {};
  const msg = r.message && typeof r.message === 'object' ? r.message : {};
  const contacts = msg.contacts && typeof msg.contacts === 'object' ? msg.contacts : {};
  const chats = Array.isArray(contacts.chats)
    ? contacts.chats
        .filter((c: any) => c && typeof c === 'object' && c.chat_id)
        .slice(0, 300)
        .map((c: any) => ({
          chat_id: String(c.chat_id),
          name: c.name ? String(c.name).slice(0, 120) : null,
          session_id: c.session_id ? String(c.session_id) : null,
          jid: c.jid ? String(c.jid).slice(0, 64) : null,
        }))
    : base.message.contacts.chats;
  const quiet = r.quiet && typeof r.quiet === 'object' ? r.quiet : {};
  const icon = r.icon && typeof r.icon === 'object' ? r.icon : {};
  const iconUrl = typeof icon.url === 'string' && /^(https?:\/\/|\/)/.test(icon.url) ? icon.url.slice(0, 500) : icon.url === null ? null : base.icon.url;
  const iconMode = pick(icon.mode, ['default', 'emoji', 'image'] as const, base.icon.mode);
  const pipeline = r.pipeline && typeof r.pipeline === 'object' ? r.pipeline : {};
  return {
    enabled: bool(r.enabled, base.enabled),
    push: bool(r.push, base.push),
    inapp: bool(r.inapp, base.inapp),
    only_when_away: bool(r.only_when_away, base.only_when_away),
    sound: pick(r.sound, SOUNDS, base.sound),
    vibrate: pick(r.vibrate, VIBRATIONS, base.vibrate),
    quiet: { enabled: bool(quiet.enabled, base.quiet.enabled), start: hhmm(quiet.start, base.quiet.start), end: hhmm(quiet.end, base.quiet.end) },
    icon: { mode: iconMode === 'default' ? 'default' : iconUrl ? iconMode : 'default', emoji: typeof icon.emoji === 'string' ? icon.emoji.slice(0, 16) : icon.emoji === null ? null : base.icon.emoji, url: iconUrl },
    contact_photo: bool(r.contact_photo, base.contact_photo),
    message: {
      enabled: bool(msg.enabled, base.message.enabled),
      scope: pick(msg.scope, ['all', 'mine', 'unassigned'] as const, base.message.scope),
      sessions: msg.sessions === undefined ? base.message.sessions : idList(msg.sessions),
      contacts: { mode: pick(contacts.mode, ['all', 'only', 'except'] as const, base.message.contacts.mode), chats },
    },
    message_group: bool(r.message_group, base.message_group),
    mention: bool(r.mention, base.mention),
    queue: bool(r.queue, base.queue),
    assigned: bool(r.assigned, base.assigned),
    transferred: bool(r.transferred, base.transferred),
    handoff: bool(r.handoff, base.handoff),
    task_due: bool(r.task_due, base.task_due),
    task_assigned: bool(r.task_assigned, base.task_assigned),
    appointment_booked: bool(r.appointment_booked, base.appointment_booked),
    appointment_canceled: bool(r.appointment_canceled, base.appointment_canceled),
    appointment_no_show: bool(r.appointment_no_show, base.appointment_no_show),
    ticket_created: bool(r.ticket_created, base.ticket_created),
    ticket_assigned: bool(r.ticket_assigned, base.ticket_assigned),
    ticket_sla: bool(r.ticket_sla, base.ticket_sla),
    order_created: bool(r.order_created, base.order_created),
    order_paid: bool(r.order_paid, base.order_paid),
    charge_paid: bool(r.charge_paid, base.charge_paid),
    charge_overdue: bool(r.charge_overdue, base.charge_overdue),
    pipeline: { enabled: bool(pipeline.enabled, base.pipeline.enabled), stages: pipeline.stages === undefined ? base.pipeline.stages : idList(pipeline.stages) },
    pipeline_won: bool(r.pipeline_won, base.pipeline_won),
    session_disconnected: bool(r.session_disconnected, base.session_disconnected),
    session_connected: bool(r.session_connected, base.session_connected),
    rating: bool(r.rating, base.rating),
    broadcast_done: bool(r.broadcast_done, base.broadcast_done),
    broadcast_paused: bool(r.broadcast_paused, base.broadcast_paused),
    team_message: bool(r.team_message, base.team_message),
    custom: bool(r.custom, base.custom),
  };
}

// ---------------------------------------------------------------- decisão por usuário
export type NotifyContext = {
  kind: string;
  userId: string;
  sessionId?: string | null;
  chat?: { uuid?: string | null; jid?: string | null; group?: boolean; assigned_user_id?: string | null } | null;
  stageId?: string | null;
  /** o usuário tem alguma conexão aberta no painel */
  online?: boolean;
  /** minuto-do-dia em Brasília (0..1439); undefined = agora */
  brtMinute?: number;
};

/** `away_only`: não mandar push para os aparelhos em que o painel está aberto (o aviso já aparece lá). */
export type Decision = { send: boolean; reason: string; inapp: boolean; push: boolean; quiet: boolean; away_only: boolean };

export function brtMinuteOfDay(d = new Date()) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
  const h = Number(p.find((x) => x.type === 'hour')?.value || 0) % 24;
  const m = Number(p.find((x) => x.type === 'minute')?.value || 0);
  return h * 60 + m;
}

const toMin = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};

/** Horário silencioso em Brasília; faixa que cruza a meia-noite (22:00 → 07:00) funciona. */
export function inQuietHours(p: Prefs, minute: number) {
  if (!p.quiet.enabled) return false;
  const a = toMin(p.quiet.start);
  const b = toMin(p.quiet.end);
  if (a === b) return false;
  return a < b ? minute >= a && minute < b : minute >= a || minute < b;
}

/** Regras das preferências para UM usuário. `test`/`custom` passam pelos filtros de canal, não pelos de evento. */
export function decide(p: Prefs, ctx: NotifyContext): Decision {
  const no = (reason: string): Decision => ({ send: false, reason, inapp: false, push: false, quiet: false, away_only: p.only_when_away });
  if (!p.enabled && ctx.kind !== 'test') return no('off');
  const k = ctx.kind;
  const chat = ctx.chat || null;
  switch (k) {
    case 'test':
      break;
    case 'message':
    case 'message_group': {
      if (k === 'message_group') {
        if (!p.message_group) return no('kind_off');
      } else if (!p.message.enabled) return no('kind_off');
      const m = p.message;
      if (m.sessions && ctx.sessionId && !m.sessions.includes(String(ctx.sessionId))) return no('session_off');
      if (k === 'message') {
        if (m.scope === 'mine' && chat?.assigned_user_id !== ctx.userId) return no('scope');
        if (m.scope === 'unassigned' && chat?.assigned_user_id && chat.assigned_user_id !== ctx.userId) return no('scope');
      }
      if (m.contacts.mode !== 'all' && chat) {
        const hit = m.contacts.chats.some((c) => (chat.uuid && c.chat_id === chat.uuid) || (chat.jid && c.jid && c.jid === chat.jid));
        if (m.contacts.mode === 'only' && !hit) return no('contact_filter');
        if (m.contacts.mode === 'except' && hit) return no('contact_filter');
      }
      break;
    }
    case 'pipeline_moved':
      if (!p.pipeline.enabled) return no('kind_off');
      if (p.pipeline.stages && ctx.stageId && !p.pipeline.stages.includes(String(ctx.stageId))) return no('stage_off');
      break;
    default: {
      const flag = (p as any)[k];
      if (typeof flag !== 'boolean') return no('unknown_kind');
      if (!flag) return no('kind_off');
    }
  }
  const quiet = inQuietHours(p, ctx.brtMinute ?? brtMinuteOfDay());
  const inapp = p.inapp;
  // push vai para os aparelhos; `only_when_away` é decidido POR APARELHO no envio (pula os que estão com o painel aberto)
  const push = p.push && !quiet;
  if (!inapp && !push) return { send: false, reason: quiet && p.push ? 'quiet' : 'no_channel', inapp, push, quiet, away_only: p.only_when_away };
  return { send: true, reason: 'ok', inapp, push, quiet, away_only: p.only_when_away };
}
