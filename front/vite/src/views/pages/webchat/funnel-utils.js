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
  const type = ['text', 'image', 'audio'].includes(msg.type) ? msg.type : 'text';
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
      linkUrl: String(msg.linkUrl ?? '').slice(0, 500),
    };
  }
  if (type === 'audio') {
    return {
      ...base,
      dataUrl: String(msg.dataUrl ?? ''),
      durationSec: clampNumber(msg.durationSec, 0, 600, 0),
    };
  }
  return base;
}

function normalizeEnding(raw) {
  const ending = raw && typeof raw === 'object' ? raw : {};
  const type = ['options', 'wait_input', 'end'].includes(ending.type) ? ending.type : 'options';
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
              url: actionType === 'redirect' ? String(action.url ?? '') : '',
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

// Substitui variáveis {{nome}}, {{email}} etc no texto/HTML.
export function substituteVariables(text, variables) {
  const source = String(text ?? '');
  if (!source.includes('{{') || !variables) return source;
  return source.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (match, key) => {
    const val = variables[String(key).toLowerCase()];
    return val !== undefined && val !== null ? String(val) : match;
  });
}

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
