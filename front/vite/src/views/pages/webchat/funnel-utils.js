// Utilitários compartilhados entre o construtor de funil (FunnelBuilder) e o
// runtime do webchat público (PublicWebchat). O funil é um grafo direcionado
// onde cada nó é uma "sequência" (1+ mensagens) que termina em opções OU
// espera de input. Ver shape em DEFAULT_FUNIL.

export const DEFAULT_FUNIL = {
  enabled: false,
  startSequenceId: '',
  sequences: {},
  // Captação de lead intermediária — disparada APÓS uma sequência
  // específica terminar e antes de avançar pra próxima. Só pode ser
  // configurada em UMA sequência por funil.
  //   triggerSequenceId: id da sequência que dispara a captação
  //   fields: 'nome_telefone' | 'nome_email' | 'nome_telefone_email' | ''
  //   prompts: { intro, closing, nome, telefone, email } — mensagens
  //     custom do bot. intro vem antes de pedir o 1º campo; closing vem
  //     ao terminar. Se vazio, usa default.
  leadCapture: {
    triggerSequenceId: '',
    fields: '',
    prompts: {
      intro: '',
      closing: '',
      nome: '',
      telefone: '',
      email: '',
    },
  },
  // Encerramento do funil — mensagem final exibida quando o lead
  // chega ao fim (action=end, sequence ending=end, ou wait_input sem
  // próxima). Após exibir, opcionalmente libera o input pra IA assumir.
  ending: {
    message: '', // HTML; vazio = não mostra mensagem final
    aiTakeover: false, // se true, input habilita e a IA continua o atendimento
  },
};

// Resolve o conjunto de campos da captação intermediária pra array.
export const LEAD_CAPTURE_PRESETS = {
  nome_telefone: ['nome', 'telefone'],
  nome_email: ['nome', 'email'],
  nome_telefone_email: ['nome', 'telefone', 'email'],
};

export function getLeadCaptureFields(preset) {
  return LEAD_CAPTURE_PRESETS[preset] || [];
}

export const VARIAVEIS_LEAD = ['nome', 'telefone', 'email'];

// ===== Cobrança PIX (ending.type = 'charge') =====
// Uma sequência "de cobrança" toca suas mensagens normalmente e, no fim, o chat
// gera um PIX no gateway da organização (Configurações → Pagamentos) e mostra
// a bolha de pagamento: QR + código copia-e-cola + botão copiar + botão
// validar. Ao confirmar, o chat mostra `paidMessage` + `sendingMessage` e
// toca a sequência `onPaidSequenceId` (a ENTREGA: PDF, vídeo, fotos, texto…).
// Tudo aqui é personalizável pelo usuário leigo; textos vazios usam o default.
export const DEFAULT_CHARGE = {
  amountCents: 0,
  description: '', // aparece no extrato/gateway (opcional)
  showQr: true,
  pixMessage: 'Aqui está o seu PIX 👇 Copie o código e pague no app do seu banco.',
  copyButtonLabel: 'Clique para copiar o PIX',
  copiedMessage: 'Código PIX copiado! ✅ Agora é só colar no app do seu banco e pagar. Depois clique em "Validar pagamento".',
  validateButtonLabel: 'Validar pagamento',
  notPaidMessage: 'Ainda não identifiquei o seu pagamento. Se você já pagou, aguarde alguns segundos e clique novamente.',
  expiredMessage: 'Esse PIX expirou ⌛ Clique abaixo para gerar um novo.',
  newPixButtonLabel: 'Gerar novo PIX',
  paidMessage: '✅ Pagamento confirmado! Obrigado pela compra.',
  sendingMessage: 'Estou te enviando o conteúdo, só um instante… ⏳',
  onPaidSequenceId: '',
};

export function createDefaultCharge() {
  return { ...DEFAULT_CHARGE };
}

export function formatBRL(cents) {
  const n = Number(cents) || 0;
  return (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Rótulo curto de um arquivo pra UI (builder e chat).
export const PROTECTED_MESSAGE_TYPES = ['file', 'video'];

const ID_PREFIX = {
  sequence: 'seq',
  message: 'msg',
  option: 'opt',
};

let counter = 0;
export function makeId(kind = 'sequence') {
  counter += 1;
  const prefix = ID_PREFIX[kind] || kind;
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${counter}${random}`;
}

export function createDefaultMessage(kind = 'text') {
  const base = {
    id: makeId('message'),
    type: kind,
    typingDurationMs: 800,
  };
  if (kind === 'text') {
    return { ...base, html: 'Nova mensagem' };
  }
  if (kind === 'image') {
    return { ...base, dataUrl: '', caption: '', linkUrl: '' };
  }
  if (kind === 'audio') {
    return { ...base, dataUrl: '', durationSec: 0 };
  }
  // Vídeo PÚBLICO (upload em POST /webchats/media → MP4 em /uploads, ou URL .mp4 colada).
  // Toca no chat com o player próprio (play grande no centro; autoplay quando o navegador deixa).
  if (kind === 'clip') {
    return { ...base, url: '', caption: '', autoplay: true };
  }
  // Arquivo (PDF/zip…) e vídeo: guardados no SERVIDOR (upload protegido),
  // aqui fica só a referência. Só chegam ao lead depois do pagamento.
  if (kind === 'file' || kind === 'video') {
    return { ...base, assetId: '', name: '', label: '', size: 0, mime: '', caption: '' };
  }
  return { ...base, html: '' };
}

export function createDefaultOption() {
  return {
    id: makeId('option'),
    label: 'Botão',
    cssClass: '',
    action: { type: 'goto', sequenceId: '' },
  };
}

export function createDefaultSequence(name = 'Nova sequência') {
  return {
    id: makeId('sequence'),
    name,
    messages: [createDefaultMessage('text')],
    ending: {
      type: 'options', // 'options' | 'wait_input' | 'end'
      options: [createDefaultOption()],
      captureVariable: '',
      nextSequenceId: '',
    },
    position: { x: 0, y: 0 },
  };
}

export function normalizeFunil(value) {
  const source = value && typeof value === 'object' ? value : {};
  const sequencesRaw =
    source.sequences && typeof source.sequences === 'object' && !Array.isArray(source.sequences)
      ? source.sequences
      : {};

  const sequences = {};
  Object.entries(sequencesRaw).forEach(([key, seqRaw]) => {
    const seq = seqRaw && typeof seqRaw === 'object' ? seqRaw : {};
    const id = String(seq.id || key || makeId('sequence'));
    const messages = Array.isArray(seq.messages)
      ? seq.messages
          .map((m) => normalizeMessage(m))
          .filter(Boolean)
      : [];
    const ending = normalizeEnding(seq.ending);
    sequences[id] = {
      id,
      name: String(seq.name || 'Sequência').slice(0, 80),
      messages: messages.length > 0 ? messages : [createDefaultMessage('text')],
      ending,
      position: normalizePosition(seq.position),
    };
  });

  const sequenceIds = Object.keys(sequences);
  let startSequenceId = String(source.startSequenceId || '');
  if (!sequences[startSequenceId]) {
    startSequenceId = sequenceIds[0] || '';
  }

  // leadCapture intermediária — só persiste se triggerSequenceId aponta
  // pra uma sequência válida do funil e fields é um preset reconhecido.
  const lcRaw = source.leadCapture && typeof source.leadCapture === 'object' ? source.leadCapture : {};
  const lcFields = String(lcRaw.fields || '').trim();
  const lcTrigger = String(lcRaw.triggerSequenceId || '').trim();
  const lcPrompts =
    lcRaw.prompts && typeof lcRaw.prompts === 'object' && !Array.isArray(lcRaw.prompts)
      ? lcRaw.prompts
      : {};
  const leadCapture = {
    triggerSequenceId:
      lcTrigger && sequences[lcTrigger] && LEAD_CAPTURE_PRESETS[lcFields]
        ? lcTrigger
        : '',
    fields: LEAD_CAPTURE_PRESETS[lcFields] ? lcFields : '',
    prompts: {
      intro: String(lcPrompts.intro ?? '').slice(0, 500),
      closing: String(lcPrompts.closing ?? '').slice(0, 500),
      nome: String(lcPrompts.nome ?? '').slice(0, 300),
      telefone: String(lcPrompts.telefone ?? '').slice(0, 300),
      email: String(lcPrompts.email ?? '').slice(0, 300),
    },
  };

  // ending — mensagem final + flag de takeover pela IA
  const endRaw = source.ending && typeof source.ending === 'object' ? source.ending : {};
  const ending = {
    message: String(endRaw.message ?? '').slice(0, 1000),
    aiTakeover: endRaw.aiTakeover === true,
  };

  return {
    enabled: source.enabled === true,
    startSequenceId,
    sequences,
    leadCapture,
    ending,
  };
}

function normalizeMessage(raw) {
  const msg = raw && typeof raw === 'object' ? raw : {};
  const type = ['text', 'image', 'audio', 'clip', 'file', 'video'].includes(msg.type) ? msg.type : 'text';
  const base = {
    id: String(msg.id || makeId('message')),
    type,
    typingDurationMs: clampNumber(msg.typingDurationMs, 0, 5000, 800),
  };
  if (type === 'text') {
    return { ...base, html: String(msg.html ?? '') };
  }
  if (type === 'image') {
    return {
      ...base,
      dataUrl: String(msg.dataUrl ?? ''),
      caption: String(msg.caption ?? ''),
      // Link clicável opcional — quando preenchido, a imagem vira um <a>
      // que abre URL em nova aba ao clicar.
      linkUrl: normalizeRedirectUrl(msg.linkUrl).slice(0, 500),
    };
  }
  if (type === 'audio') {
    return {
      ...base,
      dataUrl: String(msg.dataUrl ?? ''),
      durationSec: clampNumber(msg.durationSec, 0, 600, 0),
    };
  }
  if (type === 'clip') {
    return {
      ...base,
      url: normalizeVideoUrl(msg.url),
      caption: String(msg.caption ?? ''),
      autoplay: msg.autoplay !== false,
    };
  }
  if (type === 'file' || type === 'video') {
    return {
      ...base,
      assetId: String(msg.assetId ?? '').slice(0, 40),
      name: String(msg.name ?? '').slice(0, 255),
      // Nome exibido no chat (e usado no download). Vazio = nome do arquivo.
      label: String(msg.label ?? '').slice(0, 150),
      size: clampNumber(msg.size, 0, 10 * 1024 * 1024 * 1024, 0),
      mime: String(msg.mime ?? '').slice(0, 128),
      caption: String(msg.caption ?? ''),
    };
  }
  return base;
}

// URL de vídeo público (mensagem "clip"): só http(s), sem esquema perigoso, até 600 chars.
export function normalizeVideoUrl(raw) {
  const url = String(raw ?? '').trim().slice(0, 600);
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) return '';
  return url;
}

// ===== Mensagens de boas-vindas (builder visual) =====
// Cada entrada de `personalizacao.welcomeMessages` é uma string (HTML do texto)
// OU um vídeo público { type:'clip', url, caption, autoplay }. Esta função
// normaliza uma entrada crua; devolve null quando não há nada aproveitável
// (texto vazio / vídeo sem URL válida).
export function normalizeWelcomeEntry(raw) {
  if (raw && typeof raw === 'object') {
    if (raw.type !== 'clip') return null;
    const url = normalizeVideoUrl(raw.url);
    if (!url) return null;
    return { type: 'clip', url, caption: String(raw.caption ?? ''), autoplay: raw.autoplay !== false };
  }
  const text = String(raw ?? '').trim();
  return text ? text : null;
}

export function isClipEntry(entry) {
  return Boolean(entry && typeof entry === 'object' && entry.type === 'clip');
}

// ===== URLs de redirecionamento =====
// Normaliza a URL digitada pelo usuário (botão "Abrir URL externa", link de
// imagem): tira espaços, prefixa `https://` quando parece domínio/caminho sem
// esquema (senão o browser trata como link relativo → 404 no domínio do chat)
// e rejeita esquemas perigosos (javascript:/data:/vbscript:) → ''.
const DANGEROUS_SCHEME_RE = /^(javascript|data|vbscript):/i;
const BARE_DOMAIN_RE = /^[\w.-]+\.[a-z]{2,}(?:[/?#].*)?$/i;
export function normalizeRedirectUrl(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  // Remove controle/espaços antes de olhar o esquema (`java\tscript:`).
  const probe = value.replace(/[\s\u0000-\u001f\u007f-\u009f]+/g, '');
  if (DANGEROUS_SCHEME_RE.test(probe)) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//') || value.startsWith('/') || value.startsWith('#')) {
    return value;
  }
  if (BARE_DOMAIN_RE.test(value)) return `https://${value}`;
  return value;
}

function normalizeCharge(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const str = (key, max) => {
    const v = c[key];
    return String(v ?? DEFAULT_CHARGE[key]).slice(0, max);
  };
  return {
    amountCents: Math.round(clampNumber(c.amountCents, 0, 100000000, 0)),
    description: String(c.description ?? '').slice(0, 120),
    showQr: c.showQr !== false,
    pixMessage: str('pixMessage', 1000),
    copyButtonLabel: str('copyButtonLabel', 80),
    copiedMessage: str('copiedMessage', 1000),
    validateButtonLabel: str('validateButtonLabel', 80),
    notPaidMessage: str('notPaidMessage', 1000),
    expiredMessage: str('expiredMessage', 1000),
    newPixButtonLabel: str('newPixButtonLabel', 80),
    paidMessage: str('paidMessage', 1000),
    sendingMessage: str('sendingMessage', 1000),
    onPaidSequenceId: String(c.onPaidSequenceId ?? ''),
  };
}

function normalizeEnding(raw) {
  const ending = raw && typeof raw === 'object' ? raw : {};
  const type = ['options', 'wait_input', 'end', 'charge'].includes(ending.type) ? ending.type : 'options';
  const options = Array.isArray(ending.options)
    ? ending.options
        .map((opt) => {
          const o = opt && typeof opt === 'object' ? opt : {};
          const action = o.action && typeof o.action === 'object' ? o.action : {};
          const actionType = ['goto', 'redirect', 'end', 'send_to_ai'].includes(action.type)
            ? action.type
            : 'goto';
          return {
            id: String(o.id || makeId('option')),
            label: String(o.label ?? '').slice(0, 200),
            cssClass: String(o.cssClass ?? '').slice(0, 200),
            action: {
              type: actionType,
              sequenceId: actionType === 'goto' ? String(action.sequenceId ?? '') : '',
              url: actionType === 'redirect' ? normalizeRedirectUrl(action.url) : '',
              // send_to_ai: encerra o funil e envia esta msg como se o lead
              // tivesse digitado — IA assume daqui em diante.
              triggerMessage:
                actionType === 'send_to_ai'
                  ? String(action.triggerMessage ?? '').slice(0, 500)
                  : '',
            },
          };
        })
        .filter(
          (o) =>
            o.label.trim() ||
            o.action.url ||
            o.action.sequenceId ||
            o.action.triggerMessage,
        )
    : [];

  return {
    type,
    options: type === 'options' ? options : [],
    captureVariable: type === 'wait_input' ? String(ending.captureVariable ?? '').slice(0, 40) : '',
    nextSequenceId: type === 'wait_input' ? String(ending.nextSequenceId ?? '') : '',
    charge: type === 'charge' ? normalizeCharge(ending.charge) : undefined,
  };
}

function normalizePosition(pos) {
  const p = pos && typeof pos === 'object' ? pos : {};
  return {
    x: Number.isFinite(Number(p.x)) ? Number(p.x) : 0,
    y: Number.isFinite(Number(p.y)) ? Number(p.y) : 0,
  };
}

function clampNumber(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

// Escapa um VALOR pra entrar em HTML (texto do lead nunca vira tag).
export function escapeHtmlValue(input) {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Substitui variáveis {{nome}}, {{email}} etc no texto/HTML.
// Os VALORES são HTML-escapados por padrão (o template já é HTML sanitizado;
// o que o lead digitou entra sempre como texto). Ordem certa nos callers:
// substituteVariables(sanitize(template), variables) — nunca sanitizar DEPOIS
// (o sanitizer não desfaz o escape, então não há duplo escape).
// `{ escape: false }` só pra contextos que NÃO renderizam HTML.
// Variáveis: {{nome}}, {{q_nome}} (da URL)… Valor padrão com barra vertical: {{q_nome|amigo}}
// → "amigo" quando a variável está vazia ou não existe (aspas em volta são opcionais).
// Sem padrão: variável da URL (q_*) ausente vira vazio; as demais ficam como estão
// (ex.: {{nome}} antes da captação).
export function substituteVariables(text, variables, options = {}) {
  const source = String(text ?? '');
  if (!source.includes('{{') || !variables) return source;
  const escape = options.escape !== false;
  const out = (v) => (escape ? escapeHtmlValue(v) : String(v));
  return source.replace(/\{\{\s*([a-z0-9_]+)\s*(?:\|([^}]*))?\}\}/gi, (match, key, fallbackRaw) => {
    const k = String(key).toLowerCase();
    const val = variables[k];
    const hasFallback = fallbackRaw !== undefined;
    const fallback = hasFallback ? String(fallbackRaw).trim().replace(/^(["'])(.*)\1$/, '$2') : '';
    const empty = val === undefined || val === null || String(val).trim() === '';
    if (!empty) return out(val);
    if (hasFallback) return out(fallback);
    if (val === undefined || val === null) return k.startsWith('q_') ? '' : match;
    return out(val);
  });
}

// TODO(A-72): unificar o render de HTML do bot (sanitizeHtml + linkify) num
// `renderBotHtml` exportado daqui, usado pelo PublicWebchat E pelo preview do
// WebchatBuilder — hoje os dois têm sanitizers diferentes. Fica pra quando o
// WebchatBuilder puder ser tocado junto.

// Aprox. tamanho em bytes de um data URL base64.
export function dataUrlBytes(dataUrl) {
  const base64 = String(dataUrl || '').split(',')[1] || '';
  if (!base64) return 0;
  const padding = (base64.match(/=+$/) || [''])[0].length;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

// Tamanho total de mídia no funil (pra avisar usuário se passar de 5MB).
export function calculateFunilMediaBytes(funil) {
  if (!funil?.sequences) return 0;
  let total = 0;
  Object.values(funil.sequences).forEach((seq) => {
    (seq.messages || []).forEach((msg) => {
      if (msg.dataUrl) total += dataUrlBytes(msg.dataUrl);
    });
  });
  return total;
}

export const FUNIL_MAX_MEDIA_BYTES = 5 * 1024 * 1024; // 5MB

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
