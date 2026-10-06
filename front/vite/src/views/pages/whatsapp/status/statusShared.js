// =============================================================================
// WhatsApp → Status: constantes visuais + normalização dos status dos contatos.
// Puro (sem React) — usado pela página, pela faixa de contatos e pelo viewer.
// Contrato (multi-número): GET /whatsapp/contact-statuses →
//   { sessions: [ { session: {id,label,color,phone,connected}, contacts: [...] } ], synced_at }
// O mesmo contato pode aparecer em 2 números e `chat_id` (uuid da conversa) pode ser null →
// a chave única de um contato é `key = "<session_id>:<jid>"`.
// =============================================================================

// paleta de fundos no estilo dos status de texto do WhatsApp (composer)
export const PALETTE = [
  '#075E54',
  '#128C7E',
  '#1FA855',
  '#00A884',
  '#0B8ECF',
  '#5E35B1',
  '#8E24AA',
  '#D81B60',
  '#E65100',
  '#F09819',
  '#546E7A',
  '#1F2C34'
];

// fontes do composer (índice enviado ao gateway) — 3 estilos oferecidos
export const FONTS = [
  { id: 0, label: 'Sans', family: '"Ubuntu", "Helvetica Neue", Arial, sans-serif' },
  { id: 1, label: 'Serif', family: 'Georgia, "Times New Roman", serif' },
  { id: 2, label: 'Mono', family: '"SFMono-Regular", Menlo, Consolas, monospace' }
];
export const fontFamily = (id) => (FONTS.find((f) => f.id === Number(id)) || FONTS[0]).family;

// fontes dos status RECEBIDOS — segue a numeração do WhatsApp (0..5) e aceita nome
const VIEW_FONTS = [
  { family: '"Ubuntu", "Helvetica Neue", Arial, sans-serif', weight: 600 },
  { family: 'Georgia, "Times New Roman", serif', weight: 600 },
  { family: '"Brush Script MT", "Segoe Script", cursive', weight: 500 },
  { family: '"Marker Felt", "Comic Sans MS", "Segoe Print", cursive', weight: 600 },
  { family: '"Bebas Neue", "Oswald", Impact, "Arial Narrow", sans-serif', weight: 700, upper: true },
  { family: '"Oswald", Impact, "Arial Black", sans-serif', weight: 800 }
];
const FONT_NAMES = {
  SANS_SERIF: 0,
  SERIF: 1,
  NORICAN_REGULAR: 2,
  BRYNDAN_WRITE: 3,
  BEBASNEUE_REGULAR: 4,
  OSWALD_HEAVY: 5
};
export const viewerFont = (font) => {
  if (font === null || font === undefined || font === '') return VIEW_FONTS[0];
  const n = Number(font);
  if (Number.isFinite(n)) return VIEW_FONTS[Math.abs(Math.trunc(n)) % VIEW_FONTS.length];
  const byName = FONT_NAMES[String(font).toUpperCase()];
  return VIEW_FONTS[byName ?? 0];
};

// cor de fundo: '#RRGGBB' | '#AARRGGBB' (WhatsApp) | inteiro ARGB | 'rgb(...)'
export const normColor = (v, fallback = PALETTE[1]) => {
  if (v === null || v === undefined || v === '') return fallback;
  if (typeof v === 'number' && Number.isFinite(v)) {
    const hex = (v >>> 0).toString(16).padStart(8, '0');
    return `#${hex.slice(2)}`;
  }
  const s = String(v).trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s;
  if (/^#[0-9a-f]{8}$/i.test(s)) return `#${s.slice(3)}`;
  if (/^#[0-9a-f]{3}$/i.test(s)) return s;
  if (/^[0-9a-f]{6}$/i.test(s)) return `#${s}`;
  if (/^rgba?\(/i.test(s)) return s;
  if (/^-?\d+$/.test(s)) return normColor(Number(s), fallback);
  return fallback;
};

// ----------------------------------------------------------------------------
// Normalização dos status dos contatos
// ----------------------------------------------------------------------------
const ts = (v) => {
  const n = v ? new Date(v).getTime() : NaN;
  return Number.isFinite(n) ? n : 0;
};

export const TYPES = ['text', 'image', 'video', 'voice'];

export function normStatus(s = {}) {
  let type = String(s.type || '').toLowerCase();
  if (type === 'audio' || type === 'ptt') type = 'voice';
  if (!TYPES.includes(type)) type = s.media ? 'image' : 'text';
  return {
    ...s,
    id: String(s.id ?? ''),
    type,
    text: s.text ?? s.body ?? '',
    caption: s.caption ?? '',
    media: s.media && s.media.url ? s.media : null,
    media_omitted: Boolean(s.media_omitted),
    viewed: Boolean(s.viewed)
  };
}

// telefone "de exibição" a partir do jid, quando o back não mandou nome
export const phoneFromJid = (jid) => {
  const m = /^(\d{6,})@(c\.us|s\.whatsapp\.net)$/.exec(String(jid || ''));
  return m ? m[1] : '';
};

// chave única do contato dentro da página (número + jid)
export const contactKey = (sessionId, jid, chatId) => `${sessionId || ''}:${jid || chatId || ''}`;

export function normContact(c = {}, session = null) {
  const statuses = (Array.isArray(c.statuses) ? c.statuses : [])
    .map(normStatus)
    .filter((s) => s.id)
    .sort((a, b) => ts(a.posted_at) - ts(b.posted_at)); // mais antigo primeiro (ordem do WhatsApp)
  const lastPosted = statuses.length ? statuses[statuses.length - 1].posted_at : null;
  const last_at = ts(c.last_at) >= ts(lastPosted) ? c.last_at || lastPosted : lastPosted;
  const sessionId = String(c.session_id || session?.id || '');
  const jid = String(c.jid || '');
  const chat_id = c.chat_id ? String(c.chat_id) : null; // uuid da conversa (null = ainda não existe conversa nesse número)
  return {
    ...c,
    key: contactKey(sessionId, jid, chat_id),
    session_id: sessionId,
    session: c.session || session || null,
    jid,
    chat_id,
    name: c.name || c.push_name || '',
    phone: c.phone || phoneFromJid(jid),
    photo_path: c.photo_path || null,
    last_at,
    statuses,
    all_viewed: statuses.length ? statuses.every((s) => s.viewed) : true
  };
}

export const normList = (list, session = null) =>
  Array.isArray(list) ? list.map((c) => normContact(c, session)).filter((c) => c.jid || c.chat_id) : [];

// resposta agrupada por número → [{ session, contacts }] (um bloco por número, mesmo vazio)
export const normBlocks = (sessions) =>
  Array.isArray(sessions)
    ? sessions.filter((b) => b && b.session && b.session.id).map((b) => ({ session: b.session, contacts: normList(b.contacts, b.session) }))
    : [];

// não vistos primeiro; dentro de cada grupo, atualização mais recente primeiro
export const sortContacts = (list) =>
  [...list].sort((a, b) => {
    if (a.all_viewed !== b.all_viewed) return a.all_viewed ? 1 : -1;
    return ts(b.last_at) - ts(a.last_at);
  });

// descarta os status vencidos (24 h) e os contatos sem nenhum status vivo
export const dropExpired = (list, now = Date.now()) =>
  list
    .map((c) => {
      const alive = c.statuses.filter((s) => {
        const exp = s.expires_at ? ts(s.expires_at) : ts(s.posted_at) + 24 * 3600 * 1000;
        return !exp || exp > now;
      });
      if (alive.length === c.statuses.length) return c;
      return { ...c, statuses: alive, all_viewed: alive.every((s) => s.viewed) };
    })
    .filter((c) => c.statuses.length > 0);

// índice do 1º status ainda não visto (o WhatsApp abre por ele)
export const firstUnviewedIndex = (c) => {
  const i = (c?.statuses || []).findIndex((s) => !s.viewed);
  return i >= 0 ? i : 0;
};

// marca um status como visto (imutável); `key` limita a um contato
export function applyViewed(list, statusId, key) {
  return list.map((c) => {
    if (key && c.key !== key) return c;
    if (!c.statuses.some((s) => s.id === statusId && !s.viewed)) return c;
    const statuses = c.statuses.map((s) => (s.id === statusId ? { ...s, viewed: true } : s));
    return { ...c, statuses, all_viewed: statuses.every((s) => s.viewed) };
  });
}

// evento em tempo real `wa:status` { session_id, contact_chat_id, contact_jid, status, contact? }
// aplicado à lista de contatos do NÚMERO do evento → sobe o contato pro topo
export const payloadKey = (payload) => contactKey(payload?.session_id, payload?.contact_jid, payload?.contact_chat_id || payload?.chat_id);

export function mergeIncoming(list, payload, session = null) {
  const key = payloadKey(payload);
  const raw = payload?.status;
  if (!payload?.session_id || key.endsWith(':') || !raw || raw.id === undefined || raw.id === null) return { list, stub: false };
  const s = normStatus({ ...raw, posted_at: raw.posted_at || new Date().toISOString() });
  const idx = list.findIndex((c) => c.key === key);
  const extra = payload?.contact && typeof payload.contact === 'object' ? payload.contact : {};
  const jid = String(payload.contact_jid || '');
  const base =
    idx >= 0
      ? list[idx]
      : {
          session_id: String(payload.session_id),
          session,
          jid,
          chat_id: payload.contact_chat_id ? String(payload.contact_chat_id) : null,
          name: extra.name || raw.contact_name || '',
          phone: extra.phone || phoneFromJid(jid),
          photo_path: null,
          statuses: []
        };
  const exists = base.statuses.some((x) => x.id === s.id);
  const statuses = exists
    ? base.statuses.map((x) => (x.id === s.id ? { ...x, ...s, viewed: x.viewed || s.viewed } : x))
    : [...base.statuses, s];
  const next = normContact(
    {
      ...base,
      ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== null && v !== undefined && v !== '')),
      chat_id: base.chat_id || (payload.contact_chat_id ? String(payload.contact_chat_id) : null),
      last_at: null,
      statuses
    },
    base.session || session
  );
  const rest = idx >= 0 ? list.filter((_, i) => i !== idx) : list;
  return { list: [next, ...rest], stub: idx < 0 && !extra.name };
}

export const displayName = (c) => c?.name || (c?.phone ? `+${String(c.phone).replace(/\D/g, '')}` : 'Contato');

// "há 5 min" (curto, para a faixa)
export const agoShort = (v, now = Date.now()) => {
  if (!v) return '';
  const s = Math.max(0, Math.round((now - ts(v)) / 1000));
  if (s < 60) return 'agora';
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`;
};
