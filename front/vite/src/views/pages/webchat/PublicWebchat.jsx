import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, CircularProgress } from '@mui/material';
import { useParams } from 'react-router-dom';
import { get, post } from '../../../api/api';
import {
  WEBCHAT_DEFAULT_FONT_SIZE,
  WEBCHAT_GOOGLE_FONTS_HREF,
  resolveFontStack,
  clampWebchatFontSize
} from './webchatFontCatalog';
import { sanitizeRichText } from './RichTextField';
import {
  normalizeFunil,
  substituteVariables,
  VARIAVEIS_LEAD,
  getLeadCaptureFields,
} from './funnel-utils';

const DEFAULT_WELCOME_MESSAGE = 'Seja bem-vindo(a)!';
const DEFAULT_MAX_LEAD_ATTEMPTS = 3;
const DEFAULT_REQUIRED_LEAD_FIELDS = [
  {
    key: 'nome',
    label: 'Nome',
    type: 'texto',
    required: true
  },
  {
    key: 'email',
    label: 'E-mail',
    type: 'email',
    required: true
  }
];
const FORBIDDEN_TAGS = ['script', 'iframe', 'object', 'embed', 'style', 'meta', 'link', 'form'];
const AD_EVENT_NAMES = new Set([
  'requested',
  'rendered',
  'empty',
  'viewable',
  'clicked',
  'closed',
  'error'
]);
const SESSION_CONVERSATION_LIMIT = 80;
const WHATSAPP_CHECKMARK_STEP_MS = 500;

function toObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function safeText(value) {
  return String(value ?? '').trim();
}

function normalizeQuickReplyHref(value) {
  const href = safeText(value);
  if (!href) return '';
  const normalized = href.toLowerCase();
  if (normalized.startsWith('javascript:') || normalized.startsWith('data:')) return '';
  return href;
}

// Classes CSS customizadas que o usuário adiciona a um botão. Sanitiza pra
// permitir só caracteres válidos de class (letras, números, _ , - e espaço),
// evitando injeção no atributo class.
function sanitizeCssClass(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9_\- ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

function normalizeQuickReply(rawItem) {
  if (typeof rawItem === 'string') {
    const text = safeText(rawItem);
    if (!text) return null;
    return { text, href: '' };
  }

  const item = toObject(rawItem);
  const text = safeText(item.text || item.label || item.title || item.nome);
  if (!text) return null;

  // Preserva __funnelOptionId quando presente — esse marker é o que permite
  // o click no quick reply ser despachado pra engine local do funil em vez
  // de ir pra IA (sendMessage). Sem isso, todas opções do funil viravam
  // mensagens normais → bot respondia com IA → bug visível.
  const out = {
    text,
    href: normalizeQuickReplyHref(item.href || item.url || item.link),
    cssClass: sanitizeCssClass(item.cssClass || item.classes || item.className),
  };
  if (item.__funnelOptionId) {
    out.__funnelOptionId = String(item.__funnelOptionId);
  }
  return out;
}

function normalizeQuickReplies(rawQuickReplies) {
  const source = Array.isArray(rawQuickReplies) ? rawQuickReplies : [];
  const unique = [];
  const seen = new Set();

  source.forEach((item) => {
    const normalized = normalizeQuickReply(item);
    if (!normalized) return;
    // No modo funil, cada opção tem id próprio mesmo com label igual.
    // Inclui o id no key pra não fazer merge indevido.
    const key = normalized.__funnelOptionId
      ? `funnel::${normalized.__funnelOptionId}`
      : `${normalized.text.toLowerCase()}::${normalized.href.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(normalized);
  });

  return unique;
}

// Páginas legais/links exibidos num rodapé discreto do webchat. Cada item
// precisa de label E href válido. O href passa pelo mesmo saneamento dos botões.
function normalizeLegalPages(raw) {
  const source = Array.isArray(raw) ? raw : [];
  const out = [];
  source.forEach((item) => {
    const obj = toObject(item);
    const label = safeText(obj.label || obj.text || obj.title);
    const href = normalizeQuickReplyHref(obj.href || obj.url || obj.link);
    if (!label || !href) return;
    out.push({ label: label.slice(0, 80), href });
  });
  return out.slice(0, 12);
}

function resolveWelcomeMessage(config) {
  const settings = toObject(config?.settings);
  const personalizacao = toObject(config?.personalizacao);
  const leadCapture = {
    ...toObject(settings.lead_capture),
    ...toObject(personalizacao.leadCapture)
  };

  const welcomeFromConfig = safeText(leadCapture.welcome_message || personalizacao.welcomeBotMessage || settings.welcomeBotMessage);

  return welcomeFromConfig || DEFAULT_WELCOME_MESSAGE;
}

// Resolve a lista completa de mensagens de boas-vindas. Suporta o formato
// novo (welcomeMessages: array) e o legado (welcomeBotMessage: string).
function resolveWelcomeMessagesList(config) {
  const personalizacao = toObject(config?.personalizacao);
  const arr = personalizacao.welcomeMessages;
  if (Array.isArray(arr)) {
    const cleaned = arr.map((m) => safeText(m)).filter((m) => m.length > 0);
    if (cleaned.length > 0) return cleaned;
  }
  const fallback = resolveWelcomeMessage(config);
  return fallback ? [fallback] : [];
}

function normalizeLeadFieldKey(value) {
  const key = safeText(value).toLowerCase();
  if (!key) return '';
  if (['name', 'first_name', 'firstname'].includes(key)) return 'nome';
  if (['e-mail', 'mail'].includes(key)) return 'email';
  if (['phone', 'celular', 'whatsapp'].includes(key)) return 'telefone';
  return key.replace(/[^a-z0-9_]/g, '_').slice(0, 80);
}

function normalizeLeadFields(rawFields) {
  const source = Array.isArray(rawFields) ? rawFields : [];
  const normalized = [];
  const seen = new Set();

  source.forEach((field) => {
    const value = toObject(field);
    const key = normalizeLeadFieldKey(value.key || value.name || value.nome);
    if (!key || seen.has(key)) return;
    seen.add(key);
    normalized.push({
      key,
      label: safeText(value.label || value.nome || value.name || key),
      type: safeText(value.type || value.tipo || 'texto') || 'texto',
      required: value.required !== false && value.obrigatorio !== false
    });
  });

  if (normalized.length > 0) return normalized;
  return DEFAULT_REQUIRED_LEAD_FIELDS.map((field) => ({ ...field }));
}

function buildInitialLeadState(config) {
  const fields = normalizeLeadFields(toObject(config?.agent?.ia_config).campos_lead);
  return {
    required_fields: fields,
    collected: {},
    attempts: {},
    max_attempts: DEFAULT_MAX_LEAD_ATTEMPTS,
    allow_continue_after_attempts: true,
    released: false,
    capture_completed: false
  };
}

function normalizeLeadCapture(rawLeadCapture, previousLeadState) {
  const fromApi = toObject(rawLeadCapture);
  const prev = toObject(previousLeadState);
  const requiredFields = Array.isArray(fromApi.required_fields)
    ? normalizeLeadFields(fromApi.required_fields)
    : Array.isArray(prev.required_fields)
      ? normalizeLeadFields(prev.required_fields)
      : DEFAULT_REQUIRED_LEAD_FIELDS.map((field) => ({ ...field }));

  return {
    required_fields: requiredFields,
    collected: {
      ...toObject(prev.collected),
      ...toObject(fromApi.collected)
    },
    attempts: {
      ...toObject(prev.attempts),
      ...toObject(fromApi.attempts)
    },
    max_attempts: Number.isFinite(Number(fromApi.max_attempts))
      ? Number(fromApi.max_attempts)
      : Number.isFinite(Number(prev.max_attempts))
        ? Number(prev.max_attempts)
        : DEFAULT_MAX_LEAD_ATTEMPTS,
    allow_continue_after_attempts:
      fromApi.allow_continue_after_attempts !== undefined
        ? Boolean(fromApi.allow_continue_after_attempts)
        : prev.allow_continue_after_attempts !== false,
    released: Boolean(fromApi.released ?? prev.released),
    capture_completed: Boolean(fromApi.capture_completed ?? prev.capture_completed),
    next_field: typeof fromApi.next_field === 'string' ? fromApi.next_field : null,
    missing_required_fields: Array.isArray(fromApi.missing_required_fields) ? fromApi.missing_required_fields : [],
    persisted: Boolean(fromApi.persisted ?? prev.persisted),
    persisted_lead_id: fromApi.persisted_lead_id || prev.persisted_lead_id || null,
    routed_to: fromApi.routed_to || prev.routed_to || null
  };
}

function createId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getOrCreateLocalStorage(key, prefix) {
  if (typeof window === 'undefined') return createId(prefix);
  const current = localStorage.getItem(key);
  if (current) return current;
  const created = createId(prefix);
  localStorage.setItem(key, created);
  return created;
}

function escapeHtml(input) {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeHtml(unsafeHtml) {
  if (typeof document === 'undefined') return String(unsafeHtml || '');

  const template = document.createElement('template');
  template.innerHTML = String(unsafeHtml || '');

  FORBIDDEN_TAGS.forEach((tag) => {
    template.content.querySelectorAll(tag).forEach((el) => el.remove());
  });

  template.content.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = String(attr.value || '');
      if (name.startsWith('on') || name === 'style') {
        el.removeAttribute(attr.name);
        return;
      }
      if (name === 'href' || name === 'src') {
        const normalized = value.trim().toLowerCase();
        if (normalized.startsWith('javascript:') || normalized.startsWith('data:')) {
          el.removeAttribute(attr.name);
        }
      }
    });
  });

  return template.innerHTML;
}

function markdownToSimpleHtml(value) {
  let html = escapeHtml(value);
  html = html.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\n/g, '<br/>');
  return html;
}

function formatAssistantHtml(text) {
  const source = safeText(text);
  if (!source) return '';
  const hasHtml = /<\/?[a-z][\s\S]*>/i.test(source);
  return sanitizeHtml(hasHtml ? source : markdownToSimpleHtml(source));
}

// Constrói uma mensagem do bot a partir de um nó de mensagem do funil.
// Suporta texto (com substituição de variáveis), imagem e áudio.
function buildFunnelBotMessage(msg, variables) {
  const id = `funmsg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  if (msg.type === 'image') {
    return {
      id,
      type: 'bot',
      mediaType: 'image',
      mediaUrl: String(msg.dataUrl || ''),
      caption: substituteVariables(msg.caption || '', variables),
      mediaLinkUrl: String(msg.linkUrl || '').trim(),
      text: '',
      html: '',
    };
  }
  if (msg.type === 'audio') {
    return {
      id,
      type: 'bot',
      mediaType: 'audio',
      mediaUrl: String(msg.dataUrl || ''),
      durationSec: Number(msg.durationSec) || 0,
      text: '',
      html: '',
    };
  }
  // texto (default)
  const html = substituteVariables(formatAssistantHtml(msg.html || ''), variables);
  return {
    id,
    type: 'bot',
    text: '',
    html,
  };
}

// Quick reply: aceita texto puro (escapa) ou HTML rico (sanitiza com whitelist
// minimalista b/i/u/strong/em/br). O click envia a versão em texto puro.
function quickReplyHtml(value) {
  const source = String(value || '');
  if (!source.trim()) return '';
  const looksLikeHtml = /<\/?[a-z][^>]*>/i.test(source);
  return looksLikeHtml ? sanitizeRichText(source) : escapeHtml(source);
}

function quickReplyPlainText(value) {
  const source = String(value || '');
  if (!source.trim()) return '';
  if (typeof document === 'undefined') return source;
  const tmp = document.createElement('div');
  tmp.innerHTML = sanitizeRichText(source);
  return (tmp.textContent || tmp.innerText || '').trim();
}

function parseSizes(rawSizes) {
  if (!rawSizes) return [300, 100];
  if (Array.isArray(rawSizes)) return rawSizes;
  if (typeof rawSizes === 'string') {
    const compact = rawSizes.replace(/\s+/g, '');
    const match = compact.match(/^(\d{2,4})x(\d{2,4})$/i);
    if (match) {
      return [Number(match[1]), Number(match[2])];
    }
    try {
      const parsed = JSON.parse(rawSizes);
      return Array.isArray(parsed) ? parsed : [300, 100];
    } catch {
      return [300, 100];
    }
  }
  return [300, 100];
}

function normalizeConfig(raw) {
  const source = toObject(raw);
  const settings = toObject(source.settings);
  const personalizacao = toObject(settings.personalizacao) || toObject(source.personalizacao) || {};
  const hasPersonalizacao =
    Object.keys(toObject(settings.personalizacao)).length > 0 ||
    Object.keys(toObject(source.personalizacao)).length > 0 ||
    Boolean(settings.theme || settings.header || settings.welcomeScreen);

  const resolvedPersonalizacao = hasPersonalizacao
    ? Object.keys(toObject(settings.personalizacao)).length > 0
      ? toObject(settings.personalizacao)
      : Object.keys(toObject(source.personalizacao)).length > 0
        ? toObject(source.personalizacao)
        : settings
    : {};

  const adsConfig =
    Object.keys(toObject(source.ads_config)).length > 0
      ? toObject(source.ads_config)
      : Object.keys(toObject(source.anuncios)).length > 0
        ? toObject(source.anuncios)
        : toObject(settings.anuncios);

  return {
    id: source.id || null,
    slug: source.slug || null,
    name: source.name || source.nome || 'Webchat',
    domain: source.domain || source.dominio || '',
    settings,
    headerAdsCode: source.header_scripts || source.header_ads_code || settings.header_ads_code || null,
    footerAdsCode: source.footer_scripts || source.footer_ads_code || settings.footer_ads_code || null,
    personalizacao: resolvedPersonalizacao || personalizacao,
    anuncios: adsConfig,
    split: source.split || null,
    agent: toObject(source.agent).id ? toObject(source.agent) : toObject(source.agente)
  };
}

function resolvePublicDomain() {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  const fromQuery = safeText(params.get('domain'));
  if (fromQuery) return fromQuery.toLowerCase();
  return safeText(window.location.hostname).toLowerCase();
}

function resolveWebchatPageIcon(config) {
  const personalizacao = toObject(config?.personalizacao);
  const theme = toObject(personalizacao.theme);
  return safeText(theme.logoUrl) || safeText(theme.avatarUrl) || '';
}

// Sorteio ponderado de um membro do split (pesos relativos).
function weightedPickSplit(members) {
  const list = (Array.isArray(members) ? members : []).filter(
    (m) => m && m.domain && m.slug
  );
  if (list.length === 0) return null;
  const total = list.reduce((sum, m) => sum + Math.max(0, Number(m.weight) || 0), 0);
  if (total <= 0) return list[Math.floor(Math.random() * list.length)];
  let r = Math.random() * total;
  for (const m of list) {
    r -= Math.max(0, Number(m.weight) || 0);
    if (r < 0) return m;
  }
  return list[list.length - 1];
}

function normalizeMessageResponse(raw) {
  const source = toObject(raw);
  const data = toObject(source.data);
  const reply = data.reply || data.resposta || source.reply || source.resposta || source.message || '';
  const leadCapture = Object.keys(toObject(source.lead_capture)).length > 0 ? toObject(source.lead_capture) : toObject(data.lead_capture);

  // Opções sugeridas pela IA — vêm como string[] e são plotadas no front como
  // quick replies. Capadas em 3 para evitar que o modelo ultrapasse o limite.
  const optionsRaw = Array.isArray(source.options)
    ? source.options
    : Array.isArray(data.options)
      ? data.options
      : [];
  const options = optionsRaw
    .map((opt) => safeText(opt))
    .filter((opt) => opt.length > 0)
    .slice(0, 3)
    .map((text) => ({ text, href: '' }));

  return {
    reply: safeText(reply),
    anuncios: Object.keys(toObject(source.anuncios)).length > 0 ? toObject(source.anuncios) : toObject(data.anuncios),
    leadCapture,
    options
  };
}

function buildConversationHistory(rawMessages, maxItems = 12) {
  const source = Array.isArray(rawMessages) ? rawMessages : [];
  const max = Number.isFinite(Number(maxItems)) ? Math.max(1, Number(maxItems)) : 12;
  const history = source
    .filter((msg) => msg?.type === 'user' || msg?.type === 'bot')
    .map((msg) => {
      const role = msg.type === 'user' ? 'user' : 'assistant';
      const content = safeText(msg.text);
      if (!content) return null;
      return { role, content };
    })
    .filter(Boolean);

  return history.slice(-max);
}

function normalizeConversationHistoryEntries(rawEntries, maxItems = SESSION_CONVERSATION_LIMIT) {
  const source = Array.isArray(rawEntries) ? rawEntries : [];
  const max = Number.isFinite(Number(maxItems)) ? Math.max(1, Number(maxItems)) : SESSION_CONVERSATION_LIMIT;
  const normalized = source
    .map((entry) => {
      const value = toObject(entry);
      const roleRaw = safeText(value.role || value.type || value.author).toLowerCase();
      const content = safeText(value.content || value.message || value.text);
      if (!content) return null;
      if (['assistant', 'bot', 'model', 'ai'].includes(roleRaw)) return { role: 'assistant', content };
      if (['user', 'human', 'client', 'cliente'].includes(roleRaw)) return { role: 'user', content };
      return null;
    })
    .filter(Boolean);

  const deduped = [];
  normalized.forEach((entry) => {
    const previous = deduped[deduped.length - 1];
    if (previous && previous.role === entry.role && previous.content === entry.content) return;
    deduped.push(entry);
  });

  return deduped.slice(-max);
}

function normalizeConversationPairs(rawPairs, maxItems = SESSION_CONVERSATION_LIMIT) {
  const source = Array.isArray(rawPairs) ? rawPairs : [];
  const max = Number.isFinite(Number(maxItems)) ? Math.max(1, Number(maxItems)) : SESSION_CONVERSATION_LIMIT;
  return source
    .map((entry) => {
      const value = toObject(entry);
      const chat = safeText(value.chat);
      const lead = safeText(value.lead);
      if (!chat && !lead) return null;
      return { chat, lead };
    })
    .filter(Boolean)
    .slice(-max);
}

function buildMessagesFromConversationPairs(rawPairs) {
  const pairs = normalizeConversationPairs(rawPairs);
  const messages = [];

  pairs.forEach((pair) => {
    if (pair.chat) {
      messages.push({
        id: createId('msg'),
        type: 'bot',
        text: pair.chat,
        html: formatAssistantHtml(pair.chat)
      });
    }
    if (pair.lead) {
      messages.push({
        id: createId('msg'),
        type: 'user',
        text: pair.lead,
        html: ''
      });
    }
  });

  return messages;
}

function buildMessagesFromConversationHistory(rawHistory) {
  const history = normalizeConversationHistoryEntries(rawHistory);
  return history.map((entry) =>
    entry.role === 'assistant'
      ? { id: createId('msg'), type: 'bot', text: entry.content, html: formatAssistantHtml(entry.content) }
      : { id: createId('msg'), type: 'user', text: entry.content, html: '' }
  );
}

// Apenas normaliza mensagens preservando QR existentes. Não preenche
// automaticamente — o caller (loadConfig) é responsável por atribuir as QR
// das welcomes; bot replies de meio-de-conversa só recebem QR via "options"
// devolvidas pela IA.
function applyQuickRepliesToMessages(rawMessages /* rawQuickReplies (não usado) */) {
  const messages = Array.isArray(rawMessages) ? rawMessages : [];

  return messages.map((entry) => {
    const message = toObject(entry);
    const type = safeText(message.type).toLowerCase();
    const normalizedType = type || 'bot';
    const normalizedMessage = {
      ...message,
      id: safeText(message.id) || createId('msg'),
      type: normalizedType
    };

    if (normalizedType !== 'bot') {
      delete normalizedMessage.quickReplies;
      return normalizedMessage;
    }

    const existingQuickReplies = normalizeQuickReplies(message.quickReplies);
    if (existingQuickReplies.length > 0) {
      normalizedMessage.quickReplies = existingQuickReplies;
    } else {
      delete normalizedMessage.quickReplies;
    }

    return normalizedMessage;
  });
}

function normalizeSessionStateResponse(raw) {
  const source = toObject(raw);
  const data = toObject(source.data);
  const leadStateFromSource = toObject(source.lead_state);
  const leadStateFromData = toObject(data.lead_state);
  const leadState =
    Object.keys(leadStateFromSource).length > 0
      ? leadStateFromSource
      : leadStateFromData;

  return {
    leadState,
    conversationHistory:
      Array.isArray(source.conversation_history) && source.conversation_history.length > 0
        ? source.conversation_history
        : Array.isArray(data.conversation_history)
          ? data.conversation_history
          : [],
    messages:
      Array.isArray(source.messages) && source.messages.length > 0
        ? source.messages
        : Array.isArray(data.messages)
          ? data.messages
          : []
  };
}

function resolveErrorMessage(err, fallback) {
  return err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;
}

function ensureGptScript() {
  if (typeof document === 'undefined') return;
  if (window.googletag) return;
  const existing = document.querySelector('script[data-gpt-webchat="1"]');
  if (existing) return;
  const script = document.createElement('script');
  script.src = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js';
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.setAttribute('data-gpt-webchat', '1');
  document.head.appendChild(script);
}

function waitForGoogletag(timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function poll() {
      if (typeof window === 'undefined') {
        reject(new Error('Window indisponivel'));
        return;
      }
      if (window.googletag && window.googletag.cmd) {
        resolve(window.googletag);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        reject(new Error('Timeout aguardando googletag'));
        return;
      }
      setTimeout(poll, 40);
    }
    poll();
  });
}

function destroyGptSlot(divId) {
  if (typeof window !== 'undefined' && window.googletag) {
    window.gptSlots = window.gptSlots || {};
    if (window.gptSlots[divId]) {
      window.googletag.destroySlots([window.gptSlots[divId]]);
      window.gptSlots[divId] = null;
    }
  }
  if (typeof document === 'undefined') return;
  const node = document.getElementById(divId);
  if (node && node.parentNode) node.parentNode.removeChild(node);
}

function destroyCodeAdSlot(slotDivId) {
  if (typeof document === 'undefined') return;
  document.querySelectorAll(`[data-webchat-ad-slot="${slotDivId}"]`).forEach((node) => node.remove());
}

function resolveAdCode(anuncio) {
  return safeText(anuncio?.codigo_tag || anuncio?.codigo || '');
}

function resolveAdFixedHtml(anuncio) {
  return safeText(anuncio?.anuncio_fixed || anuncio?.html || '');
}

// Rótulo discreto exibido acima de cada anúncio (default: "PUBLICIDADE").
// Política do Google AdSense/AdManager pede identificação visual de
// publicidade pra não banir a conta — sem isso o slot pode ser flagado
// como deceptive labeling.
function resolveAdRotulo(anuncio) {
  // Permite desativar o rótulo — algumas ADX já trazem o rótulo no próprio
  // criativo. rotuloAtivo === false => sem rótulo.
  if (anuncio?.rotuloAtivo === false) return '';
  const raw = safeText(anuncio?.rotulo).trim();
  return (raw || 'PUBLICIDADE').slice(0, 100);
}

function buildAdLabelElement(rotulo) {
  const text = String(rotulo || '').trim();
  if (!text) return null;
  const label = document.createElement('div');
  label.setAttribute('data-webchat-ad-label', '1');
  label.textContent = text;
  label.style.fontSize = '10px';
  label.style.lineHeight = '1.2';
  label.style.letterSpacing = '0.08em';
  label.style.textTransform = 'uppercase';
  label.style.color = 'rgba(0, 0, 0, 0.45)';
  label.style.textAlign = 'center';
  label.style.fontFamily =
    'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  label.style.margin = '0 auto 4px auto';
  label.style.userSelect = 'none';
  label.style.pointerEvents = 'none';
  return label;
}

function buildAdContainerStyles(sizes) {
  const minWidth = `${Array.isArray(sizes) ? sizes[0] : 300}px`;
  const minHeight = `${Array.isArray(sizes) ? sizes[1] : 100}px`;
  return { minWidth, minHeight };
}

function looksLikeHtmlSnippet(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) return false;
  return /<\/?[a-z][\s\S]*>/i.test(value) || /&lt;\/?[a-z][\s\S]*&gt;/i.test(value);
}

function resolveGptSlotFromAd(anuncio, code) {
  const explicit = safeText(anuncio?.gpt_slot);
  if (explicit) return explicit;

  const source = String(code || '');
  const fromDefineSlot = source.match(/defineSlot\(\s*['"]([^'"]+)['"]/i)?.[1];
  if (fromDefineSlot) return safeText(fromDefineSlot);

  const compact = safeText(source);
  if (compact.startsWith('/') && !looksLikeHtmlSnippet(compact)) {
    return compact;
  }

  return '';
}

function resolveGptDivIdFromAd(anuncio, code, fallbackDivId) {
  const explicit = safeText(anuncio?.gpt_div_id);
  if (explicit) return explicit;

  const source = String(code || '');
  const fromDefineSlot = source.match(/defineSlot\(\s*['"][^'"]+['"]\s*,\s*\[[^\]]+\]\s*,\s*['"]([^'"]+)['"]/i)?.[1];
  if (fromDefineSlot) return safeText(fromDefineSlot);

  const fromDisplay = source.match(/display\(\s*['"]([^'"]+)['"]\s*\)/i)?.[1];
  if (fromDisplay) return safeText(fromDisplay);

  return safeText(fallbackDivId) || 'gpt-ad-slot';
}

function resolveGptSizesFromAd(anuncio, code, fallbackSizes = '[300,100]') {
  if (anuncio?.gpt_sizes) return anuncio.gpt_sizes;

  const source = String(code || '');
  const fromDefineSlot = source.match(/defineSlot\(\s*['"][^'"]+['"]\s*,\s*(\[[\s\S]*?\])\s*,/i)?.[1];
  return fromDefineSlot || fallbackSizes;
}

function mountAdMarkup(container, rawHtml) {
  if (!container) return;
  const html = String(rawHtml || '').trim();
  if (!html) return;

  const template = document.createElement('template');
  template.innerHTML = html;
  if (!template.content.firstElementChild && /&lt;\/?[a-z][\s\S]*&gt;/i.test(html)) {
    const decoder = document.createElement('textarea');
    decoder.innerHTML = html;
    template.innerHTML = decoder.value;
  }
  const scripts = Array.from(template.content.querySelectorAll('script'));
  scripts.forEach((script) => script.remove());
  container.appendChild(template.content.cloneNode(true));

  scripts.forEach((scriptNode) => {
    const script = document.createElement('script');
    Array.from(scriptNode.attributes).forEach((attr) => script.setAttribute(attr.name, attr.value));
    if (scriptNode.textContent) {
      script.text = scriptNode.textContent;
    }
    container.appendChild(script);
  });
}

function renderGptSlot(anuncio, position, containerId, slotDivId) {
  if (typeof window === 'undefined') return;
  const container = document.getElementById(containerId);
  if (!container) return;

  const code = resolveAdCode(anuncio);
  const fixedHtml = resolveAdFixedHtml(anuncio);
  const gptSlot = resolveGptSlotFromAd(anuncio, code);
  const gptDivId = resolveGptDivIdFromAd(anuncio, code, slotDivId);
  const gptSizes = resolveGptSizesFromAd(anuncio, code, '[320,100]');
  const rotulo = resolveAdRotulo(anuncio);
  destroyCodeAdSlot(slotDivId);
  destroyGptSlot(slotDivId);
  if (gptDivId !== slotDivId) {
    destroyGptSlot(gptDivId);
  }

  // Wrapper externo: column flex com tudo centralizado horizontalmente
  // (rótulo em cima, slot embaixo). data-webchat-ad-slot continua marcando
  // o nó pra cleanup.
  const buildOuterWrapper = () => {
    const outer = document.createElement('div');
    outer.setAttribute('data-webchat-ad-slot', slotDivId);
    outer.style.width = '100%';
    outer.style.maxWidth = '100%';
    outer.style.display = 'flex';
    outer.style.flexDirection = 'column';
    outer.style.alignItems = 'center';
    outer.style.justifyContent = 'center';
    outer.style.margin = '10px auto';
    const labelEl = buildAdLabelElement(rotulo);
    if (labelEl) outer.appendChild(labelEl);
    return outer;
  };

  const attach = (outer) => {
    if (position === 'topo') {
      container.insertBefore(outer, container.firstChild);
    } else {
      container.appendChild(outer);
    }
  };

  if (fixedHtml) {
    const sizes = parseSizes(gptSizes);
    const { minWidth, minHeight } = buildAdContainerStyles(sizes);
    const outer = buildOuterWrapper();
    const inner = document.createElement('div');
    inner.style.display = 'flex';
    inner.style.justifyContent = 'center';
    inner.style.alignItems = 'center';
    inner.style.minWidth = minWidth;
    inner.style.minHeight = minHeight;
    inner.style.maxWidth = '100%';
    mountAdMarkup(inner, fixedHtml);
    outer.appendChild(inner);
    attach(outer);
    return;
  }

  if (gptSlot && window.googletag) {
    const outer = buildOuterWrapper();
    const slotDiv = document.createElement('div');
    slotDiv.id = gptDivId;
    slotDiv.style.display = 'flex';
    slotDiv.style.justifyContent = 'center';
    slotDiv.style.alignItems = 'center';
    outer.appendChild(slotDiv);
    attach(outer);

    const sizes = parseSizes(gptSizes);
    window.googletag.cmd.push(() => {
      window.gptSlots = window.gptSlots || {};
      window.gptSlots[gptDivId] = window.googletag.defineSlot(gptSlot, sizes, gptDivId).addService(window.googletag.pubads());
      window.googletag.enableServices();
      window.googletag.display(gptDivId);
    });
    return;
  }

  if (code && looksLikeHtmlSnippet(code)) {
    const sizes = parseSizes(gptSizes);
    const { minWidth, minHeight } = buildAdContainerStyles(sizes);
    const outer = buildOuterWrapper();
    const inner = document.createElement('div');
    inner.style.display = 'flex';
    inner.style.justifyContent = 'center';
    inner.style.alignItems = 'center';
    inner.style.minWidth = minWidth;
    inner.style.minHeight = minHeight;
    inner.style.maxWidth = '100%';
    mountAdMarkup(inner, code);
    outer.appendChild(inner);
    attach(outer);
    return;
  }
}

let inlineGptSlotCounter = 0;
function createInlineAdMessageId() {
  return `inline_ad_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function renderInlineMessageAdInSlot(anuncio, slotDivId) {
  if (typeof window === 'undefined') return { gptDivId: null };
  const container = document.getElementById(slotDivId);
  if (!container) return { gptDivId: null };

  const code = resolveAdCode(anuncio);
  const fixedHtml = resolveAdFixedHtml(anuncio);
  const gptSlot = resolveGptSlotFromAd(anuncio, code);
  const gptDivBase = resolveGptDivIdFromAd(anuncio, code, 'gpt-ad-inline');
  const gptSizes = resolveGptSizesFromAd(anuncio, code, '[300,100]');
  const rotulo = resolveAdRotulo(anuncio);

  container.innerHTML = '';
  destroyCodeAdSlot(slotDivId);

  // Wrapper externo (column flex centralizado): rótulo em cima, slot embaixo.
  const buildOuterWrapper = () => {
    const outer = document.createElement('div');
    outer.setAttribute('data-webchat-ad-slot', slotDivId);
    outer.style.display = 'flex';
    outer.style.flexDirection = 'column';
    outer.style.alignItems = 'center';
    outer.style.justifyContent = 'center';
    outer.style.margin = '12px auto';
    outer.style.maxWidth = '100%';
    const labelEl = buildAdLabelElement(rotulo);
    if (labelEl) outer.appendChild(labelEl);
    return outer;
  };

  if (fixedHtml) {
    const sizes = parseSizes(gptSizes);
    const { minWidth, minHeight } = buildAdContainerStyles(sizes);
    const outer = buildOuterWrapper();
    const inner = document.createElement('div');
    inner.style.minWidth = minWidth;
    inner.style.minHeight = minHeight;
    inner.style.maxWidth = '100%';
    inner.style.display = 'flex';
    inner.style.justifyContent = 'center';
    inner.style.alignItems = 'center';
    mountAdMarkup(inner, fixedHtml);
    outer.appendChild(inner);
    container.appendChild(outer);
    return { gptDivId: null };
  }

  if (gptSlot && window.googletag) {
    inlineGptSlotCounter += 1;
    const gptSlotDivId = `${gptDivBase}-${inlineGptSlotCounter}`;
    const sizes = parseSizes(gptSizes);
    const { minWidth, minHeight } = buildAdContainerStyles(sizes);

    const outer = buildOuterWrapper();
    const slotDiv = document.createElement('div');
    slotDiv.id = gptSlotDivId;
    slotDiv.style.minWidth = minWidth;
    slotDiv.style.minHeight = minHeight;
    slotDiv.style.display = 'flex';
    slotDiv.style.justifyContent = 'center';
    slotDiv.style.alignItems = 'center';
    outer.appendChild(slotDiv);
    container.appendChild(outer);

    window.googletag.cmd.push(() => {
      window.gptSlots = window.gptSlots || {};
      window.gptSlots[gptSlotDivId] = window.googletag.defineSlot(gptSlot, sizes, gptSlotDivId).addService(window.googletag.pubads());
      window.googletag.enableServices();
      window.googletag.display(gptSlotDivId);
    });
    return { gptDivId: gptSlotDivId };
  }

  if (code && looksLikeHtmlSnippet(code)) {
    const sizes = parseSizes(gptSizes);
    const { minWidth, minHeight } = buildAdContainerStyles(sizes);
    const outer = buildOuterWrapper();
    const inner = document.createElement('div');
    inner.style.minWidth = minWidth;
    inner.style.minHeight = minHeight;
    inner.style.maxWidth = '100%';
    inner.style.display = 'flex';
    inner.style.justifyContent = 'center';
    inner.style.alignItems = 'center';
    mountAdMarkup(inner, code);
    outer.appendChild(inner);
    container.appendChild(outer);
    return { gptDivId: null };
  }

  return { gptDivId: null };
}

function resolveInlineAdsConfig(anuncios) {
  const map = toObject(anuncios);
  const inlineConfig = toObject(map['entre-mensagens'] || map.entre_mensagens);
  if (!inlineConfig || Object.keys(inlineConfig).length === 0) {
    return null;
  }

  const sequenceRaw = Array.isArray(inlineConfig.sequence_ads) ? inlineConfig.sequence_ads : [];
  const sequence = sequenceRaw
    .map((entry) => toObject(entry))
    .filter(
      (entry) =>
        entry.ativo !== false &&
        (resolveAdCode(entry) || entry.gpt_slot || resolveAdFixedHtml(entry))
    );

  if (sequence.length === 0 && inlineConfig.ativo !== false) {
    const legacyCode = resolveAdCode(inlineConfig);
    if (legacyCode || inlineConfig.gpt_slot || resolveAdFixedHtml(inlineConfig)) {
      sequence.push(inlineConfig);
    }
  }

  const intervalRaw = Number(
    inlineConfig.intervalo_mensagens ??
      inlineConfig.intervaloMensagens ??
      inlineConfig.interval ??
      inlineConfig.a_cada_mensagens
  );
  if (!Number.isFinite(intervalRaw) || intervalRaw <= 0) {
    return null;
  }
  const interval = Math.floor(intervalRaw);

  return {
    ativo: inlineConfig.ativo !== false,
    interval,
    sequence
  };
}

function resolveInterstitialRefreshPopupConfig(config) {
  const settings = toObject(config?.settings);
  const source = toObject(
    settings.interstitial_refresh_popup ||
      settings.interstitialPopup ||
      settings.popup_interstitial_refresh
  );

  const enabled = source.enabled === true;
  const intervalRaw = Number(source.interval_minutes ?? source.minutes ?? source.interval ?? 10);
  const intervalMinutes = Number.isFinite(intervalRaw) && intervalRaw > 0 ? Math.floor(intervalRaw) : 10;
  const titleTemplate = safeText(source.title) || 'Você está no chat por mais de {X} min, atualize a página!';
  const messageTemplate =
    safeText(source.message) ||
    'Para carregar novos anúncios intersticiais, atualize a página e continue o chat.';

  return {
    enabled,
    intervalMinutes,
    title: titleTemplate.replace('{X}', String(intervalMinutes)),
    message: messageTemplate.replace('{X}', String(intervalMinutes)),
    ctaLabel: safeText(source.cta_label || source.ctaText) || 'ATUALIZAR'
  };
}

function pickInlineAdForNextMessage(anuncios, nextLeadCount, sequenceIndexRef, cooldownRef) {
  const inlineConfig = resolveInlineAdsConfig(anuncios);
  if (!inlineConfig?.ativo) return null;
  if (!Array.isArray(inlineConfig.sequence) || inlineConfig.sequence.length === 0) return null;

  const interval = Number(inlineConfig.interval);
  if (!Number.isFinite(interval) || interval <= 0) return null;
  if (nextLeadCount % interval !== 0) return null;

  const cooldownByKey = cooldownRef.current || {};
  const now = Date.now();
  const sequence = inlineConfig.sequence;
  const size = sequence.length;
  const start = Number.isFinite(Number(sequenceIndexRef.current)) ? Number(sequenceIndexRef.current) % size : 0;

  for (let offset = 0; offset < size; offset += 1) {
    const index = (start + offset) % size;
    const anuncio = toObject(sequence[index]);
    const key = String(anuncio.id || anuncio.codigo_tag || anuncio.codigo || `seq_${index}`);
    const lastRenderedAt = Number(cooldownByKey[key] || 0);

    if (now - lastRenderedAt < 60000) continue;

    cooldownByKey[key] = now;
    cooldownRef.current = cooldownByKey;
    sequenceIndexRef.current = (index + 1) % size;
    return { ...anuncio };
  }

  return null;
}

function InlineAdMessage({ messageId, anuncio, animationStyle }) {
  const slotDivId = `inline-ad-slot-${messageId}`;

  useEffect(() => {
    const rendered = renderInlineMessageAdInSlot(anuncio, slotDivId);
    scrollMessagesContainerToBottom();
    return () => {
      destroyCodeAdSlot(slotDivId);
      if (rendered?.gptDivId) {
        destroyGptSlot(rendered.gptDivId);
      }
      const container = document.getElementById(slotDivId);
      if (container) container.innerHTML = '';
    };
  }, [anuncio, slotDivId]);

  return (
    <div
      style={{
        ...animationStyle,
        alignSelf: 'center',
        width: '100%',
        display: 'flex',
        justifyContent: 'center'
      }}
    >
      <div id={slotDivId} style={{ width: '100%', display: 'flex', justifyContent: 'center' }} />
    </div>
  );
}

function parseInlineCss(styleText) {
  const source = safeText(styleText);
  if (!source) return {};

  return source.split(';').reduce((acc, rule) => {
    const [rawProp, ...rest] = rule.split(':');
    if (!rawProp || rest.length === 0) return acc;
    const prop = rawProp.trim().replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    const value = rest.join(':').trim();
    if (!prop || !value) return acc;
    acc[prop] = value;
    return acc;
  }, {});
}

function resolveHeaderJustify(align) {
  const value = safeText(align).toLowerCase();
  if (value === 'center') return 'center';
  if (value === 'right') return 'flex-end';
  return 'flex-start';
}

function scrollMessagesContainerToBottom() {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('messages');
  if (!container) return;
  container.scrollTop = container.scrollHeight;
}

function resolveSlotPositionByDivId(slotElementId, slotPositionMap) {
  const map = toObject(slotPositionMap);
  const direct = map[slotElementId];
  if (direct) return direct;

  const prefixMatch = Object.entries(map).find(([key]) => {
    if (!key.endsWith(':prefix')) return false;
    const prefix = key.slice(0, -7);
    return Boolean(prefix) && slotElementId.startsWith(prefix);
  });
  if (prefixMatch) return prefixMatch[1];

  if (slotElementId.includes('rodape')) return 'rodape';
  if (slotElementId.includes('topo')) return 'topo';
  if (slotElementId.includes('inline')) return 'entre-mensagens';
  return '';
}

function resolveLayoutStyles(layoutPreset, borderRadius) {
  const baseRadius = Number.isFinite(Number(borderRadius)) ? Number(borderRadius) : 18;
  const preset = safeText(layoutPreset).toLowerCase();

  if (preset === 'flat') {
    return {
      chatRadius: 10,
      bubbleRadius: 10,
      inputRadius: 10,
      bubbleShadow: false
    };
  }

  if (preset === 'ios') {
    return {
      chatRadius: 28,
      bubbleRadius: Math.max(baseRadius, 22),
      inputRadius: 24,
      bubbleShadow: true
    };
  }

  if (preset === 'android') {
    return {
      chatRadius: 14,
      bubbleRadius: Math.max(baseRadius, 14),
      inputRadius: 16,
      bubbleShadow: true
    };
  }

  if (preset === 'minimal') {
    return {
      chatRadius: 8,
      bubbleRadius: 8,
      inputRadius: 10,
      bubbleShadow: false
    };
  }

  if (preset === 'whatsapp') {
    return {
      chatRadius: 12,
      bubbleRadius: Math.max(0, baseRadius),
      inputRadius: 22,
      bubbleShadow: true
    };
  }

  return {
    chatRadius: Math.max(baseRadius, 12),
    bubbleRadius: Math.max(baseRadius, 12),
    inputRadius: Math.max(baseRadius, 14),
    bubbleShadow: true
  };
}

function resolveAnimationStyle(animation) {
  const config = toObject(animation);
  const type = safeText(config.type).toLowerCase();
  const duration = Number(config.duration) > 0 ? Number(config.duration) : 350;

  if (!type || type === 'none') return {};
  if (type === 'slide') return { animation: `pubmail-slide-in ${duration}ms ease-out` };
  if (type === 'zoom') return { animation: `pubmail-zoom-in ${duration}ms ease-out` };
  return { animation: `pubmail-fade-in ${duration}ms ease-out` };
}

function normalizeCustomCss(rawCss) {
  return String(rawCss || '')
    .replace(/<\/?style[^>]*>/gi, '')
    .trim();
}

function isWhatsAppLayoutPreset(layoutPreset) {
  return safeText(layoutPreset).toLowerCase() === 'whatsapp';
}

function normalizeWhatsAppDeliveryStatus(rawStatus) {
  const status = safeText(rawStatus).toLowerCase();
  if (status === 'single_gray') return 'single_gray';
  if (status === 'double_gray') return 'double_gray';
  return 'double_blue';
}

function WhatsAppCheckmarks({ status }) {
  const normalizedStatus = normalizeWhatsAppDeliveryStatus(status);
  const isRead = normalizedStatus === 'double_blue';
  const showDouble = normalizedStatus !== 'single_gray';
  const color = isRead ? '#53bdeb' : '#8696a0';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 12,
        lineHeight: 1,
        transform: 'translateY(1px)',
        marginLeft: 4
      }}
      aria-hidden="true"
    >
      <span
        style={{
          fontSize: 12,
          color,
          fontWeight: 700,
          letterSpacing: -0.9,
          marginRight: showDouble ? -5 : 0,
          transition: 'color 160ms ease'
        }}
      >
        ✓
      </span>
      {showDouble ? (
        <span
          style={{
            fontSize: 12,
            color,
            fontWeight: 700,
            letterSpacing: -0.9,
            transition: 'color 160ms ease'
          }}
        >
          ✓
        </span>
      ) : null}
    </span>
  );
}

function applyThemeVariables(personalizacao) {
  if (typeof document === 'undefined') return;
  const theme = toObject(personalizacao?.theme);
  const isWhatsAppLayout = isWhatsAppLayoutPreset(theme.layoutPreset);
  const isDark = Boolean(theme.darkMode);
  const root = document.documentElement.style;
  const set = (key, value) => {
    if (value === undefined || value === null || value === '') return;
    root.setProperty(key, String(value));
  };

  // Defaults sensatos por preset, mas TODOS respeitam theme.X se o usuário
  // configurou. Pegada anterior: o branch WhatsApp ignorava várias
  // configurações de cor, então mudanças no builder não refletiam.
  const defaults = isWhatsAppLayout
    ? {
        primary: '#075e54',
        secondary: '#ffffff',
        bg: isDark ? '#0b141a' : '#efeae2',
        chatSurface: isDark ? '#202c33' : '#f0f2f5',
        chatText: isDark ? '#e9edef' : '#111b21',
        chatMuted: isDark ? '#8696a0' : '#667781',
        borderColor: isDark ? '#2a3942' : '#d1d7db',
        headerBg: isDark ? '#202c33' : (theme.primaryColor || '#075e54'),
        userBubble: isDark ? '#005c4b' : (theme.userBubbleColor || '#d9fdd3'),
        botBubble: isDark ? '#202c33' : (theme.botBubbleColor || '#ffffff'),
        bubbleShadow: theme.bubbleShadow ? '0 1px 1px rgba(11, 20, 26, 0.2)' : 'none',
        radius: 14
      }
    : {
        primary: '#2979ff',
        secondary: '#ffffff',
        bg: '#e5ddd5',
        chatSurface: isDark ? '#121a29' : '#ffffff',
        chatText: isDark ? '#f8fafc' : '#111111',
        chatMuted: isDark ? '#cbd5e1' : '#6b7280',
        borderColor: isDark ? '#253042' : '#d1d5db',
        headerBg: isDark ? '#111827' : 'rgba(255,255,255,0.97)',
        userBubble: theme.userBubbleColor || theme.primaryColor || '#2979ff',
        botBubble: theme.botBubbleColor || '#f1f0f0',
        bubbleShadow: theme.bubbleShadow ? '0 2px 8px #2979ff33' : 'none',
        radius: 18
      };

  const quickReplyBgExplicit = String(theme.quickReplyBgColor || '').trim();
  // Auto (sem cor custom): tema WhatsApp usa o verde (primary); demais, cinza sutil.
  const autoQuickReplyBg = isWhatsAppLayout
    ? (theme.primaryColor || '#075e54')
    : (isDark ? '#1f2a33' : '#f5f6f7');

  set('--pubmail-primary', theme.primaryColor || defaults.primary);
  set('--pubmail-secondary', theme.secondaryColor || defaults.secondary);
  // backgroundColor agora SEMPRE respeita o usuário, em qualquer layout.
  set('--pubmail-bg', theme.backgroundColor || defaults.bg);
  set('--pubmail-font', resolveFontStack(theme.font));
  set('--pubmail-font-size', `${clampWebchatFontSize(theme.fontSize)}px`);
  set('--pubmail-radius', `${theme.borderRadius ?? defaults.radius}px`);
  set('--pubmail-chat-surface', defaults.chatSurface);
  set('--pubmail-chat-text', defaults.chatText);
  set('--pubmail-chat-muted', defaults.chatMuted);
  set('--pubmail-border-color', defaults.borderColor);
  set('--pubmail-header-bg', defaults.headerBg);
  set('--pubmail-chat-bg-image', theme.backgroundImageUrl ? `url(${theme.backgroundImageUrl})` : 'none');
  set('--pubmail-user-bubble-color', defaults.userBubble);
  set('--pubmail-bot-bubble-color', defaults.botBubble);
  set('--pubmail-quick-reply-bg', quickReplyBgExplicit || autoQuickReplyBg);
  set('--pubmail-bubble-shadow', defaults.bubbleShadow);
}

function Header({ config, layoutStyles }) {
  const personalizacao = toObject(config?.personalizacao);
  const header = toObject(personalizacao.header);
  const theme = toObject(personalizacao.theme);
  const isWhatsAppLayout = isWhatsAppLayoutPreset(theme.layoutPreset);
  const show = header.show !== false;
  if (!show) return null;

  const headerCss = parseInlineCss(header.style);
  const title = safeText(header.text) || safeText(personalizacao.botName) || config?.name || 'Pub Mail';
  const justifyContent = resolveHeaderJustify(header.align);
  const baseTextColor = theme.darkMode ? '#f8fafc' : '#111111';
  const baseFontSize = clampWebchatFontSize(theme.fontSize);
  const logoSize = isWhatsAppLayout ? 46 : 42;
  const titleFontSize = baseFontSize + 2;       // 17 quando base 15
  const onlineFontSize = baseFontSize - 2;      // 13
  const headerTextColor = isWhatsAppLayout ? '#ffffff' : baseTextColor;
  const avatarSource = safeText(theme.avatarUrl) || safeText(theme.logoUrl);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: isWhatsAppLayout ? '14px 18px' : '18px 20px 14px 20px',
        borderBottom: '1px solid var(--pubmail-border-color, #eee)',
        background: 'var(--pubmail-header-bg, rgba(255,255,255,0.97))',
        borderRadius: `${layoutStyles.chatRadius}px ${layoutStyles.chatRadius}px 0 0`,
        minHeight: isWhatsAppLayout ? 70 : 62,
        justifyContent: isWhatsAppLayout ? 'flex-start' : justifyContent,
        color: headerTextColor,
        ...headerCss
      }}
    >
      {isWhatsAppLayout ? (
        <>
          {avatarSource ? (
            <img
              src={avatarSource}
              alt="Avatar"
              style={{
                width: logoSize,
                height: logoSize,
                borderRadius: '50%',
                objectFit: 'cover',
                background: '#dfe5e7'
              }}
            />
          ) : (
            <div
              style={{
                width: logoSize,
                height: logoSize,
                borderRadius: '50%',
                background: '#dfe5e7',
                color: '#1f2c34',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: titleFontSize + 2
              }}
            >
              {safeText(title).charAt(0).toUpperCase() || 'I'}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: titleFontSize,
                  letterSpacing: -0.1,
                  maxWidth: 240,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.2
                }}
              >
                {title}
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: '#53bdeb',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 900
                }}
                aria-label="Conta verificada"
                title="Conta verificada"
              >
                ✓
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: '#25d366',
                  display: 'inline-block',
                  boxShadow: '0 0 0 2px rgba(37, 211, 102, 0.18)'
                }}
              />
              <span style={{ fontSize: onlineFontSize, color: '#d1f4ed', lineHeight: 1, fontWeight: 500 }}>online</span>
            </div>
          </div>
        </>
      ) : (
        <>
          {theme.logoUrl ? (
            <img src={theme.logoUrl} alt="Logo" style={{ width: logoSize, height: logoSize, borderRadius: 14 }} />
          ) : null}
          <span
            style={{
              fontWeight: 800,
              fontSize: titleFontSize + 1,
              letterSpacing: -0.2,
              flex: 1,
              textAlign: justifyContent === 'center' ? 'center' : justifyContent === 'flex-end' ? 'right' : 'left'
            }}
          >
            {title}
          </span>
          {theme.avatarUrl ? (
            <img src={theme.avatarUrl} alt="Avatar" style={{ width: logoSize, height: logoSize, borderRadius: '50%' }} />
          ) : null}
        </>
      )}
    </div>
  );
}

export default function PublicWebchat() {
  const { slug = '' } = useParams();
  const domain = useMemo(() => resolvePublicDomain(), []);
  const sessionId = useMemo(() => getOrCreateLocalStorage(`webchat_session:${domain}:${slug}`, 'session'), [domain, slug]);
  const originalTitleRef = useRef('');
  const messageInputRef = useRef(null);
  const originalFaviconRef = useRef({
    hadElement: false,
    rel: 'icon',
    type: '',
    href: ''
  });

  const [config, setConfig] = useState(null);
  // Ref espelhando o config atual, pra que callbacks possam acessar o
  // último valor sem virar dependência (evita loop em loadConfig).
  const configRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const messagesRef = useRef([]);
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState('');
  const [chatError, setChatError] = useState('');
  const [sending, setSending] = useState(false);
  const [interstitialFired, setInterstitialFired] = useState(false);

  // ===== SPLIT (redirecionamento ponderado) =====
  // Ao carregar o config, se este webchat pertence a um split com >1 membro,
  // sorteia (por peso) e redireciona. Trava anti-loop: o redirect carrega
  // ?nsr=1, que suprime o sorteio nesse "pulo" e depois é limpo da URL — então
  // cada nova visita/reload re-sorteia, mas nunca entra em loop A→B→A.
  const splitHandledRef = useRef(false);
  useEffect(() => {
    if (!config || splitHandledRef.current || typeof window === 'undefined') return;
    splitHandledRef.current = true;

    const params = new URLSearchParams(window.location.search);
    if (params.get('nsr') === '1') {
      params.delete('nsr');
      const qs = params.toString();
      window.history.replaceState(
        {},
        '',
        window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash
      );
      return;
    }

    const members = Array.isArray(config?.split?.members) ? config.split.members : [];
    if (members.length <= 1) return;
    const chosen = weightedPickSplit(members);
    if (!chosen) return;

    const curDomain = safeText(config.domain).toLowerCase();
    const curSlug = safeText(config.slug);
    const chosenDomain = safeText(chosen.domain).toLowerCase();
    const chosenSlug = safeText(chosen.slug);
    if (
      chosenDomain &&
      chosenSlug &&
      (chosenDomain !== curDomain || chosenSlug !== curSlug)
    ) {
      window.location.replace(
        `https://${chosenDomain}/webchat/${encodeURIComponent(chosenSlug)}?nsr=1`
      );
    }
  }, [config]);

  // ===== MODO FUNIL =====
  // Quando config.personalizacao.funil.enabled = true, todo o fluxo passa
  // por essa engine local — IA é desligada, welcomes são ignoradas.
  // funnelState: estado da execução do funil
  //   currentSequenceId: id da sequência atualmente em curso
  //   variables: { nome, email, telefone, resposta, ...} capturadas
  //   awaitingInput: bool (se input do user está habilitado)
  //   awaitingInputVariable: string (variável onde armazenar a resposta)
  //   awaitingInputNextSeq: id da próxima sequência após o input
  //   pendingOptions: opções a renderizar quando playSequence terminar
  const [funnelState, setFunnelState] = useState({
    currentSequenceId: null,
    variables: {},
    awaitingInput: false,
    awaitingInputVariable: '',
    awaitingInputNextSeq: '',
    // Captação intermediária:
    //   leadCaptureActive: bool (estamos no meio de uma captação?)
    //   leadCaptureFields: array de campos restantes a perguntar
    //   leadCaptureNextSeq: aonde ir após terminar a captura
    //   leadCaptureDone: bool (uma captura já foi feita nesta sessão; bloqueia repeat)
    leadCaptureActive: false,
    leadCaptureFields: [],
    leadCaptureNextSeq: '',
    leadCaptureDone: false,
  });
  const funnelStateRef = useRef(funnelState);
  const funnelTimersRef = useRef([]);
  // Ref pra sendMessage (declarado MUITO depois neste arquivo). Permite
  // que handleFunnelOptionClick (action send_to_ai) chame sendMessage
  // sem violar TDZ na lista de deps do useCallback.
  const sendMessageRef = useRef(null);
  // Ref pra enqueueAdEvent (declarado MUITO depois). pickFunnelInlineAd
  // usa enqueueAdEvent — sem ref, o `[enqueueAdEvent]` nas deps de
  // useCallback dispara TDZ porque a const ainda não foi inicializada.
  const enqueueAdEventRef = useRef(null);
  // Ref pra triggerFunnelEnd (declarado depois de playFunnelSequence,
  // que precisa chamá-lo no finalizer pra sequências type='end').
  const triggerFunnelEndRef = useRef(null);
  useEffect(() => {
    funnelStateRef.current = funnelState;
  }, [funnelState]);
  useEffect(() => {
    configRef.current = config;
  }, [config]);
  // funnelExited: lead clicou numa opção send_to_ai. Encerra o funil
  // mid-flow e cai no modo IA pelo resto da sessão (se reload, cache do
  // localStorage também armazena esse flag).
  const [funnelExited, setFunnelExited] = useState(false);
  const funnelMode =
    config?.personalizacao?.funil?.enabled === true && !funnelExited;

  // Carrega o catálogo de fontes do webchat (apenas uma vez por página).
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const id = 'pubmail-webchat-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = WEBCHAT_GOOGLE_FONTS_HREF;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }, []);
  const [refreshPopupOpen, setRefreshPopupOpen] = useState(false);
  const [leadState, setLeadState] = useState(() => buildInitialLeadState(null));
  const inlineSequenceIndexRef = useRef(0);
  const inlineAdCooldownRef = useRef({});
  const adEventsQueueRef = useRef([]);
  const adEventsFlushTimerRef = useRef(null);
  const slotPositionByDivIdRef = useRef({});
  const deliveryStatusTimersRef = useRef([]);
  const animatedMessageIdsRef = useRef(new Set());
  const welcomeSequenceTimersRef = useRef([]);

  const flushAdEvents = useCallback(async () => {
    const queue = Array.isArray(adEventsQueueRef.current) ? adEventsQueueRef.current : [];
    if (queue.length === 0 || !slug) return;
    const payloadEvents = queue.splice(0, 20);
    adEventsQueueRef.current = queue;
    if (payloadEvents.length === 0) return;

    try {
      await post(`/public/webchat/${slug}/ad-events?domain=${encodeURIComponent(domain)}`, {
        session_id: sessionId,
        events: payloadEvents
      });
    } catch {
      // Silently drop failures to avoid impacting chat UX.
    }
  }, [domain, sessionId, slug]);

  const updateMessageDeliveryStatus = useCallback((messageId, status) => {
    const id = safeText(messageId);
    if (!id) return;
    const nextStatus = normalizeWhatsAppDeliveryStatus(status);

    setMessages((prev) =>
      prev.map((entry) => {
        if (safeText(entry?.id) !== id) return entry;
        if (safeText(entry?.type).toLowerCase() !== 'user') return entry;
        return {
          ...entry,
          deliveryStatus: nextStatus
        };
      })
    );
  }, []);

  const scheduleWhatsAppCheckmarkProgress = useCallback(
    (messageId) => {
      if (typeof window === 'undefined') return;
      const id = safeText(messageId);
      if (!id) return;

      const timerToDoubleGray = window.setTimeout(() => {
        updateMessageDeliveryStatus(id, 'double_gray');
      }, WHATSAPP_CHECKMARK_STEP_MS);
      const timerToDoubleBlue = window.setTimeout(() => {
        updateMessageDeliveryStatus(id, 'double_blue');
      }, WHATSAPP_CHECKMARK_STEP_MS * 2);

      const list = Array.isArray(deliveryStatusTimersRef.current) ? deliveryStatusTimersRef.current : [];
      list.push(timerToDoubleGray, timerToDoubleBlue);
      deliveryStatusTimersRef.current = list.slice(-200);
    },
    [updateMessageDeliveryStatus]
  );

  const clearDeliveryStatusTimers = useCallback(() => {
    if (typeof window === 'undefined') return;
    const list = Array.isArray(deliveryStatusTimersRef.current) ? deliveryStatusTimersRef.current : [];
    list.forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    deliveryStatusTimersRef.current = [];
  }, []);

  const clearWelcomeSequenceTimers = useCallback(() => {
    if (typeof window === 'undefined') return;
    const list = Array.isArray(welcomeSequenceTimersRef.current) ? welcomeSequenceTimersRef.current : [];
    list.forEach((timerId) => window.clearTimeout(timerId));
    welcomeSequenceTimersRef.current = [];
  }, []);

  // ===== ENGINE DO FUNIL =====

  const clearFunnelTimers = useCallback(() => {
    if (typeof window === 'undefined') return;
    funnelTimersRef.current.forEach((id) => window.clearTimeout(id));
    funnelTimersRef.current = [];
  }, []);

  // Persiste lead no back quando temos dados mínimos (nome + email/telefone).
  // Reusa o endpoint existente captureLead — back faz upsert.
  const persistFunnelLead = useCallback(
    async (variables) => {
      const nome = String(variables.nome || '').trim();
      const email = String(variables.email || '').trim();
      const telefone = String(variables.telefone || '').trim();
      if (!nome || (!email && !telefone)) return;
      try {
        await post(
          `/public/webchat/${slug}/leads?domain=${encodeURIComponent(domain)}`,
          {
            name: nome,
            email: email || undefined,
            phone: telefone || undefined,
            source: 'webchat-funil',
            session_id: sessionId,
            context: { domain, page_url: window.location.href },
          },
        );
      } catch {
        // Silencioso — funil continua mesmo se persistência falhar.
      }
    },
    [slug, domain, sessionId],
  );

  // Toca uma sequência: emite mensagens uma a uma com typing delay,
  // depois finaliza com options/wait_input/end conforme configurado.
  // Lê config via ref pra ESTABILIZAR a referência do callback — sem isso,
  // toda mudança de config recriaria essa fn, recriaria loadConfig, e
  // dispararia loop infinito no useEffect que chama loadConfig.
  const playFunnelSequence = useCallback(
    (sequenceId) => {
      if (typeof window === 'undefined') return;
      const funil = configRef.current?.personalizacao?.funil;
      if (!funil?.sequences) return;
      const seq = funil.sequences[sequenceId];
      if (!seq) return;

      clearFunnelTimers();
      setFunnelState((prev) => ({
        ...prev,
        currentSequenceId: sequenceId,
        awaitingInput: false,
        awaitingInputVariable: '',
        awaitingInputNextSeq: '',
      }));

      const variables = funnelStateRef.current.variables || {};

      // Renderiza mensagens uma após a outra com typing entre.
      let cursorMs = 0;
      const messages = Array.isArray(seq.messages) ? seq.messages : [];

      messages.forEach((msg) => {
        const typingMs = Math.max(0, Number(msg.typingDurationMs) || 0);

        // Mostra typing antes da mensagem
        if (typingMs > 0) {
          const showTypingId = window.setTimeout(() => {
            const typingMsg = {
              id: createId('typing'),
              type: 'typing',
            };
            setMessages((prev) => [...prev.filter((m) => m?.type !== 'typing'), typingMsg]);
          }, cursorMs);
          funnelTimersRef.current.push(showTypingId);
          cursorMs += typingMs;
        }

        // Substitui typing por mensagem real
        const renderId = window.setTimeout(() => {
          setMessages((prev) => {
            const cleaned = prev.filter((m) => m?.type !== 'typing');
            const built = buildFunnelBotMessage(msg, variables);
            return [...cleaned, built];
          });
        }, cursorMs);
        funnelTimersRef.current.push(renderId);
        cursorMs += 100; // gap mínimo entre mensagens
      });

      // Finalização (após todas mensagens)
      const finalizerId = window.setTimeout(() => {
        const ending = seq.ending || { type: 'end' };
        setMessages((prev) => prev.filter((m) => m?.type !== 'typing'));

        if (ending.type === 'options') {
          // Anexa opções como quickReplies à última mensagem do bot
          const opts = (ending.options || []).filter((o) => o.label?.trim());
          if (opts.length > 0) {
            const quickReplies = opts.map((o) => ({
              text: substituteVariables(o.label, variables),
              href: o.action?.type === 'redirect' ? String(o.action.url || '') : '',
              cssClass: o.cssClass,
              __funnelOptionId: o.id,
            }));
            setMessages((prev) => {
              const arr = [...prev];
              for (let i = arr.length - 1; i >= 0; i -= 1) {
                if (arr[i]?.type === 'bot') {
                  arr[i] = { ...arr[i], quickReplies };
                  break;
                }
              }
              return arr;
            });
          }
          if (opts.length === 0) {
            // Sequência marcada como 'options' mas sem opções válidas →
            // tratar como fim do funil.
            triggerFunnelEndRef.current?.();
          } else {
            setFunnelState((prev) => ({ ...prev, awaitingInput: false }));
          }
        } else if (ending.type === 'wait_input') {
          setFunnelState((prev) => ({
            ...prev,
            awaitingInput: true,
            awaitingInputVariable: ending.captureVariable || '',
            awaitingInputNextSeq: ending.nextSequenceId || '',
          }));
        } else if (ending.type === 'end') {
          triggerFunnelEndRef.current?.();
        }
      }, cursorMs + 50);
      funnelTimersRef.current.push(finalizerId);
    },
    [clearFunnelTimers],
  );

  // Defaults pra mensagens da captação (quando admin deixa vazio).
  const LEAD_CAPTURE_DEFAULT_PROMPTS = {
    intro: 'Antes de continuar, só preciso de algumas informações.',
    closing: 'Obrigado! Vamos continuar… ✨',
    nome: 'Pra começar, qual é o seu nome? 👋',
    telefone: 'Qual seu telefone com DDD? 📱',
    email: 'Qual seu melhor e-mail? 📩',
  };

  // Resolve o texto da pergunta usando prompts custom do admin (se houver),
  // com substituição de variáveis ({{nome}} etc) e fallback pro default.
  const resolveLeadCapturePrompt = useCallback((field, prompts, variables) => {
    const custom = prompts && typeof prompts === 'object' ? String(prompts[field] || '').trim() : '';
    const raw = custom || LEAD_CAPTURE_DEFAULT_PROMPTS[field] || `Qual seu ${field}?`;
    return substituteVariables(raw, variables || {});
  }, []);

  // Emite uma mensagem do bot precedida por typing indicator.
  // Reutilizada nas mensagens da captação intermediária pra dar UX
  // consistente com o resto do funil.
  const emitBotMessageWithTyping = useCallback((textOrHtml, typingMs = 800) => {
    if (typeof window === 'undefined') return;
    // Mostra typing imediatamente (substitui qualquer typing pendente)
    const typingMsg = { id: createId('typing'), type: 'typing' };
    setMessages((prev) => [...prev.filter((m) => m?.type !== 'typing'), typingMsg]);
    // Após delay, troca pelo bubble real
    const t = window.setTimeout(() => {
      const botMsg = {
        id: createId('msg'),
        type: 'bot',
        text: String(textOrHtml || ''),
        html: String(textOrHtml || ''),
      };
      setMessages((prev) => [...prev.filter((m) => m?.type !== 'typing'), botMsg]);
    }, Math.max(0, typingMs));
    funnelTimersRef.current.push(t);
  }, []);

  // Encerra o funil — exibe a mensagem final (se configurada) e, se
  // aiTakeover=true, libera a IA pra continuar (funnelExited=true).
  // Acionado de TODOS os caminhos de "fim do funil": opção end, opção
  // inválida, sequência sem opções/wait_input, wait_input sem próxima.
  const triggerFunnelEnd = useCallback(() => {
    if (typeof window === 'undefined') return;
    const cfg = configRef.current?.personalizacao?.funil?.ending || {};
    const variables = funnelStateRef.current.variables || {};
    // Considera "tem mensagem" só se houver TEXTO real — o RichTextField pode
    // deixar HTML residual (ex.: <p></p>, <br>) que renderiza bolha em branco.
    const hasMessage = Boolean(quickReplyPlainText(cfg.message || ''));
    if (hasMessage) {
      const text = substituteVariables(String(cfg.message), variables);
      emitBotMessageWithTyping(text, 700);
    }
    setFunnelState((prev) => ({
      ...prev,
      awaitingInput: false,
      currentSequenceId: null,
      awaitingInputVariable: '',
      awaitingInputNextSeq: '',
    }));
    if (cfg.aiTakeover) {
      // Espera o typing+bubble settle antes de liberar a IA, pra não
      // sobrepor a mensagem final com placeholder de input.
      const delay = hasMessage ? 900 : 0;
      const t = window.setTimeout(() => {
        setFunnelExited(true);
      }, delay);
      funnelTimersRef.current.push(t);
      // Scroll duplo: o input aparecendo cobre a última bubble. Faz
      // scroll após o bubble settle E depois de o input renderizar
      // pra garantir que a mensagem final fica visível.
      const scroll1 = window.setTimeout(() => scrollMessagesContainerToBottom(), delay + 50);
      const scroll2 = window.setTimeout(() => scrollMessagesContainerToBottom(), delay + 350);
      funnelTimersRef.current.push(scroll1, scroll2);
    } else if (hasMessage) {
      // Sem aiTakeover: scroll só pra garantir que a mensagem final
      // fica visível após o typing.
      const scroll = window.setTimeout(() => scrollMessagesContainerToBottom(), 800);
      funnelTimersRef.current.push(scroll);
    }
  }, [emitBotMessageWithTyping]);

  useEffect(() => {
    triggerFunnelEndRef.current = triggerFunnelEnd;
  }, [triggerFunnelEnd]);

  // Inicia uma captação intermediária de lead. Mostra um bubble de
  // intro + pergunta o primeiro campo (com typing entre cada msg),
  // habilita input e marca o estado.
  const tryStartLeadCapture = useCallback(
    (targetSequenceId) => {
      const stateNow = funnelStateRef.current;
      if (stateNow.leadCaptureDone) return false;
      const cfg = configRef.current?.personalizacao?.funil?.leadCapture;
      if (!cfg?.triggerSequenceId || !cfg?.fields) return false;
      if (cfg.triggerSequenceId !== stateNow.currentSequenceId) return false;
      const fields = getLeadCaptureFields(cfg.fields);
      if (!fields.length) return false;

      const firstField = fields[0];
      const variables = stateNow.variables || {};
      const introText = resolveLeadCapturePrompt('intro', cfg.prompts, variables);
      const promptText = resolveLeadCapturePrompt(firstField, cfg.prompts, variables);

      // Sequência: typing → intro custom → typing → pergunta
      // Cada msg vem com seu próprio typing pra simular conversa real.
      emitBotMessageWithTyping(introText, 700);
      const t = window.setTimeout(() => {
        emitBotMessageWithTyping(promptText, 700);
      }, 1100);
      funnelTimersRef.current.push(t);

      // Atualiza state DEPOIS do setTimeout do prompt — input habilita
      // junto com a pergunta aparecendo. Evita o lead digitar antes de
      // saber o que perguntar.
      const enableT = window.setTimeout(() => {
        setFunnelState((prev) => ({
          ...prev,
          leadCaptureActive: true,
          leadCaptureFields: fields,
          leadCaptureNextSeq: targetSequenceId || '',
          awaitingInput: true,
          awaitingInputVariable: firstField,
          awaitingInputNextSeq: '',
        }));
      }, 1100 + 700);
      funnelTimersRef.current.push(enableT);
      return true;
    },
    [emitBotMessageWithTyping, resolveLeadCapturePrompt],
  );

  // Calcula e dispara um possível anúncio inline (entre-mensagens) após
  // uma ação do user no funil. Retorna o objeto de mensagem 'ad' a ser
  // inserido logo após a bubble do user (ou null se não rolar).
  const pickFunnelInlineAd = useCallback(() => {
    const userCountAfter =
      messagesRef.current.filter((m) => m?.type === 'user').length + 1;
    const adsForInline = configRef.current?.anuncios;
    if (!adsForInline) return null;
    const inlineAd = pickInlineAdForNextMessage(
      adsForInline,
      userCountAfter,
      inlineSequenceIndexRef,
      inlineAdCooldownRef,
    );
    if (!inlineAd) return null;
    const inlineId = createInlineAdMessageId();
    const inlineCode = resolveAdCode(inlineAd);
    const inlineKey =
      resolveGptSlotFromAd(inlineAd, inlineCode) || inlineCode || String(inlineAd.id || 'inline');
    const inlineDivBase = resolveGptDivIdFromAd(inlineAd, inlineCode, 'gpt-ad-inline');
    if (enqueueAdEventRef.current) {
      enqueueAdEventRef.current('requested', 'entre-mensagens', { adKey: inlineKey });
    }
    slotPositionByDivIdRef.current[`inline-ad-slot-${inlineId}`] = 'entre-mensagens';
    slotPositionByDivIdRef.current[`${inlineDivBase}:prefix`] = 'entre-mensagens';
    return { type: 'ad', id: inlineId, anuncio: inlineAd };
  }, []);

  // Handler quando o lead clica em uma opção do funil (não-redirect).
  const handleFunnelOptionClick = useCallback(
    (option) => {
      if (!option?.action) return;
      // Marca a mensagem do bot que continha quickReplies como "consumida"
      // (esconde os botões pra não ser clicada de novo).
      setMessages((prev) =>
        prev.map((m) => (m.quickReplies ? { ...m, quickReplies: null } : m)),
      );

      const action = option.action || {};

      // send_to_ai: encerra o funil e envia mensagem pra IA como se o
      // lead tivesse digitado. O texto exibido como bubble do user é a
      // triggerMessage configurada (não o label do botão).
      if (action.type === 'send_to_ai') {
        const triggerText = String(action.triggerMessage || '').trim() || option.label || '';
        // Limpa timers e estado do funil. funnelExited=true desativa o
        // funnelMode → IA assume.
        clearFunnelTimers();
        setFunnelState((prev) => ({
          ...prev,
          awaitingInput: false,
          currentSequenceId: null,
        }));
        setFunnelExited(true);
        // Envia pra IA via sendMessage normal (vai aparecer como bubble
        // user e bot vai responder via /messages). Pequeno delay pra
        // garantir que a mudança de funnelExited propagou nas refs.
        const t = window.setTimeout(() => {
          if (sendMessageRef.current) sendMessageRef.current(triggerText);
        }, 50);
        funnelTimersRef.current.push(t);
        return;
      }

      // Adiciona a "fala" do user com o texto da opção (extrai plain
      // do HTML rico — option.label pode conter <b>/<i>/<u> e emojis;
      // user bubble renderiza só text, então decapamos a marcação).
      const labelPlain = quickReplyPlainText(option.label || '') || option.label || '';
      const userMsg = {
        id: createId('msg'),
        type: 'user',
        text: labelPlain,
        html: '',
      };
      const inlineAdMsg = pickFunnelInlineAd();
      setMessages((prev) => {
        const out = [...prev, userMsg];
        if (inlineAdMsg) out.push(inlineAdMsg);
        return out;
      });

      if (action.type === 'redirect') {
        if (action.url) {
          try {
            window.open(action.url, '_blank', 'noopener,noreferrer');
          } catch {
            window.location.href = action.url;
          }
        }
        // Redirect também encerra o funil — exibe mensagem final
        // (se configurada) e libera IA se aiTakeover.
        triggerFunnelEnd();
        return;
      }
      if (action.type === 'goto' && action.sequenceId) {
        // Antes de avançar, checa se a sequência atual é trigger de
        // captação intermediária. Se sim, intercepta — captação dispara
        // primeiro, depois o avanço acontece.
        if (tryStartLeadCapture(action.sequenceId)) return;
        playFunnelSequence(action.sequenceId);
        return;
      }
      // 'end' ou inválida → encerra o funil (mensagem final + aiTakeover)
      triggerFunnelEnd();
    },
    [playFunnelSequence, clearFunnelTimers, pickFunnelInlineAd, tryStartLeadCapture, triggerFunnelEnd],
  );

  // Handler quando o lead digita uma resposta em uma sequência wait_input.
  const handleFunnelTextInput = useCallback(
    (text) => {
      const trimmed = String(text || '').trim();
      if (!trimmed) return;
      const stateNow = funnelStateRef.current;
      if (!stateNow.awaitingInput) return;

      // Adiciona bubble do user
      const userMsg = {
        id: createId('msg'),
        type: 'user',
        text: trimmed,
        html: '',
      };
      const inlineAdMsg = pickFunnelInlineAd();
      setMessages((prev) => {
        const out = [...prev, userMsg];
        if (inlineAdMsg) out.push(inlineAdMsg);
        return out;
      });

      // Captura variável
      const varKey = String(stateNow.awaitingInputVariable || '').toLowerCase();
      const nextVariables = { ...stateNow.variables };
      if (varKey) {
        // Validações leves pra variáveis especiais
        if (varKey === 'email') {
          const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRe.test(trimmed)) {
            // Reabre input com mensagem de validação
            const errMsg = {
              id: createId('msg'),
              type: 'bot',
              text: 'Hum, esse e-mail não parece válido. Tente novamente?',
              html: 'Hum, esse e-mail não parece válido. Tente novamente?',
            };
            setMessages((prev) => [...prev, errMsg]);
            return;
          }
        }
        if (varKey === 'telefone') {
          const digits = trimmed.replace(/\D+/g, '');
          if (digits.length < 8) {
            const errMsg = {
              id: createId('msg'),
              type: 'bot',
              text: 'Esse número parece incompleto. Pode digitar com DDD?',
              html: 'Esse número parece incompleto. Pode digitar com DDD?',
            };
            setMessages((prev) => [...prev, errMsg]);
            return;
          }
        }
        nextVariables[varKey] = trimmed;
      }

      // Modo CAPTAÇÃO INTERMEDIÁRIA: o input atual é parte de uma sequência
      // de captura de lead disparada após uma sequência trigger. Pergunta
      // próximo campo (com typing) ou, se acabou, persiste lead e avança.
      if (stateNow.leadCaptureActive) {
        const remaining = (stateNow.leadCaptureFields || []).slice(1);
        const cfg = configRef.current?.personalizacao?.funil?.leadCapture;
        const customPrompts = cfg?.prompts || {};
        if (remaining.length > 0) {
          const nextField = remaining[0];
          const promptText = resolveLeadCapturePrompt(
            nextField,
            customPrompts,
            nextVariables,
          );
          // Desabilita input enquanto typing está rolando, reabilita após.
          setFunnelState((prev) => ({
            ...prev,
            variables: nextVariables,
            leadCaptureFields: remaining,
            awaitingInput: false,
            awaitingInputVariable: nextField,
          }));
          emitBotMessageWithTyping(promptText, 700);
          const enableT = window.setTimeout(() => {
            setFunnelState((prev) => ({
              ...prev,
              awaitingInput: true,
              awaitingInputVariable: nextField,
            }));
          }, 700);
          funnelTimersRef.current.push(enableT);
          return;
        }
        // Última captura concluída — persiste e avança.
        const targetSeqId = stateNow.leadCaptureNextSeq;
        const closingText = resolveLeadCapturePrompt('closing', customPrompts, nextVariables);
        setFunnelState((prev) => ({
          ...prev,
          variables: nextVariables,
          awaitingInput: false,
          awaitingInputVariable: '',
          awaitingInputNextSeq: '',
          leadCaptureActive: false,
          leadCaptureFields: [],
          leadCaptureNextSeq: '',
          leadCaptureDone: true,
        }));
        emitBotMessageWithTyping(closingText, 600);
        void persistFunnelLead(nextVariables);
        if (targetSeqId) {
          // Espera typing + thanks msg renderizar antes de avançar.
          const t = window.setTimeout(() => playFunnelSequence(targetSeqId), 1500);
          funnelTimersRef.current.push(t);
        } else {
          // Sem próxima sequência configurada → fim do funil
          const t = window.setTimeout(() => triggerFunnelEnd(), 1500);
          funnelTimersRef.current.push(t);
        }
        return;
      }

      setFunnelState((prev) => ({
        ...prev,
        variables: nextVariables,
        awaitingInput: false,
      }));

      // Persiste lead se possível (silencioso)
      if (VARIAVEIS_LEAD.includes(varKey)) {
        void persistFunnelLead(nextVariables);
      }

      // Avança pra próxima sequência (ou encerra)
      const nextId = stateNow.awaitingInputNextSeq;
      if (nextId) {
        // Antes de avançar, checa se a sequência atual é trigger de
        // captação intermediária. Se sim, intercepta — captação dispara
        // primeiro, depois o avanço acontece.
        if (tryStartLeadCapture(nextId)) return;
        // Pequeno delay pra UX (typing entre user msg e próxima sequence)
        const t = window.setTimeout(() => playFunnelSequence(nextId), 300);
        funnelTimersRef.current.push(t);
      } else {
        // wait_input sem próxima sequência → fim do funil
        const t = window.setTimeout(() => triggerFunnelEnd(), 300);
        funnelTimersRef.current.push(t);
      }
    },
    [
      playFunnelSequence,
      persistFunnelLead,
      pickFunnelInlineAd,
      tryStartLeadCapture,
      emitBotMessageWithTyping,
      resolveLeadCapturePrompt,
      triggerFunnelEnd,
    ],
  );


  // Agenda a sequência de welcome: typing → mensagem → typing → mensagem → ... → typing → quickReplies
  // Cada step usa `setMessages(prev => ...)` para preservar mensagens já existentes.
  const scheduleWelcomeSequence = useCallback(
    (welcomeMessages, availableQuickReplies) => {
      if (typeof window === 'undefined') return;
      clearWelcomeSequenceTimers();
      if (!Array.isArray(welcomeMessages) || welcomeMessages.length === 0) return;

      const TYPING_BEFORE_MSG = 800;
      const MSG_TO_NEXT_TYPING = 280;
      const TYPING_BEFORE_QR = 600;
      const INITIAL_DELAY = 200;

      const timers = welcomeSequenceTimersRef.current;
      let cumDelay = 0;

      const schedule = (delay, fn) => {
        cumDelay += delay;
        const id = window.setTimeout(fn, cumDelay);
        timers.push(id);
      };

      // Para cada mensagem: mostra typing, depois substitui por bot bubble.
      welcomeMessages.forEach((rawText, idx) => {
        const text = safeText(rawText);
        // Typing antes da mensagem
        schedule(idx === 0 ? INITIAL_DELAY : MSG_TO_NEXT_TYPING, () => {
          setMessages((prev) => {
            const cleaned = prev.filter((m) => m?.type !== 'typing');
            return [...cleaned, { id: createId('msg'), type: 'typing' }];
          });
        });
        // Mensagem efetiva
        schedule(TYPING_BEFORE_MSG, () => {
          setMessages((prev) => {
            const cleaned = prev.filter((m) => m?.type !== 'typing');
            return [
              ...cleaned,
              {
                id: createId('msg'),
                type: 'bot',
                text,
                html: formatAssistantHtml(text)
              }
            ];
          });
        });
      });

      // Typing final + revelação das quick replies (atreladas à última welcome)
      schedule(MSG_TO_NEXT_TYPING, () => {
        setMessages((prev) => {
          const cleaned = prev.filter((m) => m?.type !== 'typing');
          return [...cleaned, { id: createId('msg'), type: 'typing' }];
        });
      });
      schedule(TYPING_BEFORE_QR, () => {
        setMessages((prev) => {
          const cleaned = prev.filter((m) => m?.type !== 'typing');
          if (cleaned.length === 0) return cleaned;
          const lastIdx = cleaned.length - 1;
          const last = cleaned[lastIdx];
          if (last?.type !== 'bot') return cleaned;
          // Atribui TODAS as quick replies configuradas (não um subset random).
          // Conforme regra: as QR cadastradas no front aparecem só junto com a
          // welcome final; depois disso, só aparecem se a IA devolver "options".
          const qr = normalizeQuickReplies(availableQuickReplies);
          if (qr.length === 0) return cleaned;
          const next = [...cleaned];
          next[lastIdx] = { ...last, quickReplies: qr };
          return next;
        });
      });
    },
    [clearWelcomeSequenceTimers]
  );

  const enqueueAdEvent = useCallback(
    (eventName, adPosition, options = {}) => {
      const normalizedEvent = safeText(eventName).toLowerCase();
      if (!AD_EVENT_NAMES.has(normalizedEvent)) return;

      const normalizedPosition = safeText(adPosition).toLowerCase();
      if (!normalizedPosition) return;

      const payload = toObject(options.payload);
      const entry = {
        event_name: normalizedEvent,
        ad_position: normalizedPosition,
        ad_key: safeText(options.adKey) || null,
        payload: Object.keys(payload).length > 0 ? payload : null
      };

      const queue = Array.isArray(adEventsQueueRef.current) ? adEventsQueueRef.current : [];
      queue.push(entry);
      adEventsQueueRef.current = queue.slice(-80);

      if (adEventsFlushTimerRef.current) {
        window.clearTimeout(adEventsFlushTimerRef.current);
      }
      adEventsFlushTimerRef.current = window.setTimeout(() => {
        flushAdEvents();
      }, 400);
    },
    [flushAdEvents]
  );

  // Sincroniza o ref de enqueueAdEvent — pickFunnelInlineAd (declarado
  // ~315 linhas acima) precisa chamar enqueueAdEvent mas não pode ter
  // ele nas deps por TDZ.
  useEffect(() => {
    enqueueAdEventRef.current = enqueueAdEvent;
  }, [enqueueAdEvent]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);


  useEffect(() => {
    scrollMessagesContainerToBottom();
  }, [messages]);

  useEffect(
    () => () => {
      if (adEventsFlushTimerRef.current) {
        window.clearTimeout(adEventsFlushTimerRef.current);
      }
      flushAdEvents();
    },
    [flushAdEvents]
  );

  useEffect(() => () => {
    clearDeliveryStatusTimers();
    clearWelcomeSequenceTimers();
  }, [clearDeliveryStatusTimers, clearWelcomeSequenceTimers]);

  useEffect(() => {
    ensureGptScript();
  }, []);

  const focusMessageInput = useCallback(() => {
    if (typeof window === 'undefined' || !messageInputRef.current) return;
    window.requestAnimationFrame(() => {
      if (!messageInputRef.current || messageInputRef.current.disabled) return;
      messageInputRef.current.focus();
    });
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    originalTitleRef.current = document.title;
    // Snapshot do estado original de TODOS os link de ícone (icon, shortcut icon,
    // apple-touch-icon) pra restaurar no unmount. Antes só guardava o primeiro
    // e o `shortcut icon` ficava com a logo do webchat anterior pra sempre.
    const existingIconLinks = document.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');
    originalFaviconRef.current = {
      hadElements: existingIconLinks.length > 0,
      links: Array.from(existingIconLinks).map((link) => ({
        rel: link.getAttribute('rel') || 'icon',
        type: link.getAttribute('type') || '',
        href: link.getAttribute('href') || '',
      })),
    };

    return () => {
      document.title = originalTitleRef.current || document.title;
      const original = originalFaviconRef.current;

      // Remove qualquer link de ícone que adicionamos (data-webchat-page-icon=1)
      // ou que tenhamos modificado. Depois recria a partir do snapshot original.
      const currentLinks = document.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');
      currentLinks.forEach((link) => {
        if (link.getAttribute('data-webchat-page-icon') === '1') {
          link.remove();
        }
      });

      if (original?.hadElements && original.links?.length) {
        original.links.forEach((snap) => {
          // Se o link original ainda existe (não foi removido acima), só restaura href.
          const stillThere = document.querySelector(`link[rel="${snap.rel}"]`);
          if (stillThere) {
            if (snap.type) stillThere.setAttribute('type', snap.type);
            if (snap.href) stillThere.setAttribute('href', snap.href);
            stillThere.removeAttribute('data-webchat-page-icon');
          } else {
            const link = document.createElement('link');
            link.setAttribute('rel', snap.rel);
            if (snap.type) link.setAttribute('type', snap.type);
            if (snap.href) link.setAttribute('href', snap.href);
            document.head.appendChild(link);
          }
        });
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined' || !config) return;

    document.title = safeText(config?.name) || 'Webchat';

    const iconHref = resolveWebchatPageIcon(config);
    if (!iconHref) return;

    // Atualiza TODOS os <link rel*="icon"> existentes (icon, shortcut icon,
    // apple-touch-icon etc). Antes usávamos querySelector singular que só
    // pegava o primeiro — Chrome prefere `rel="shortcut icon"` pra tab,
    // então o favicon do webchat não substituía o do Pub Mail.
    const iconLinks = document.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');
    if (iconLinks.length === 0) {
      const link = document.createElement('link');
      link.setAttribute('rel', 'icon');
      link.setAttribute('data-webchat-page-icon', '1');
      link.setAttribute('href', iconHref);
      document.head.appendChild(link);
      return;
    }

    iconLinks.forEach((link) => {
      link.setAttribute('data-webchat-page-icon', '1');
      link.setAttribute('href', iconHref);
      // Remove `type` antigo (image/png hardcoded no HTML) — o iconHref pode ser
      // data:image/webp;base64,... ou outro formato. Browser detecta sozinho.
      link.removeAttribute('type');
    });
  }, [config]);

  const loadConfig = useCallback(async () => {
    if (!slug) return;
    clearDeliveryStatusTimers();
    setLoading(true);
    setFatalError('');
    setChatError('');
    try {
      const raw = await get(`/public/webchat/${slug}/config`, { params: { domain } });
      const normalized = normalizeConfig(raw);
      const welcomeMessagesList = resolveWelcomeMessagesList(normalized);
      const baseLeadState = buildInitialLeadState(normalized);
      const availableQuickReplies = normalizeQuickReplies(toObject(normalized.personalizacao).quickReplies);

      let restoredLeadState = baseLeadState;
      let restoredMessages = [];
      let serverHasMessages = false;

      try {
        const sessionRaw = await get(`/public/webchat/${slug}/session`, {
          params: {
            domain,
            session_id: sessionId,
          },
        });
        const normalizedSession = normalizeSessionStateResponse(sessionRaw);
        const sessionMessagesFromHistory = buildMessagesFromConversationHistory(
          normalizedSession.conversationHistory
        );
        const sessionMessagesFromPairs = buildMessagesFromConversationPairs(
          normalizedSession.messages
        );
        const sessionMessages =
          sessionMessagesFromHistory.length > 0
            ? sessionMessagesFromHistory
            : sessionMessagesFromPairs;

        if (sessionMessages.length > 0) {
          serverHasMessages = true;
          // Server retorna apenas pares user-bot (sem as welcomes sintetizadas
          // pelo front). Reconciliamos abaixo com welcomeMessagesList.
          restoredMessages = sessionMessages;
        }
        restoredLeadState = normalizeLeadCapture(
          normalizedSession.leadState,
          restoredLeadState
        );
      } catch {
        // Session restore is best-effort to avoid blocking chat bootstrap.
      }

      // Conta quantas mensagens do bot estão no início (antes de qualquer user).
      const countLeadingBots = (arr) => {
        let n = 0;
        for (const m of arr) {
          if (m?.type !== 'bot') break;
          n += 1;
        }
        return n;
      };

      const isFirstVisit = restoredMessages.length === 0 && !serverHasMessages;

      // Reconcilia welcomes: substitui as N primeiras bot messages pelos
      // textos atuais (preservando quickReplies/id da última), e anexa as
      // faltantes. Garante que a ÚLTIMA welcome receba as quick replies
      // configuradas (todas elas) caso ainda não tenha.
      const reconcileWelcomes = (messagesArr) => {
        const result = [];
        const leadingBots = countLeadingBots(messagesArr);
        const tail = messagesArr.slice(leadingBots);
        for (let i = 0; i < welcomeMessagesList.length; i += 1) {
          const text = welcomeMessagesList[i];
          const isLastWelcome = i === welcomeMessagesList.length - 1;
          const existing = i < leadingBots ? messagesArr[i] : null;
          if (existing) {
            const existingQr = normalizeQuickReplies(existing.quickReplies);
            const next = {
              ...existing,
              text,
              html: formatAssistantHtml(text),
            };
            if (isLastWelcome) {
              // Última welcome: garante que todas as QR configuradas estão lá
              // (preserva as que já existem; senão usa as do config).
              next.quickReplies = existingQr.length > 0 ? existingQr : availableQuickReplies;
            } else {
              // Welcomes intermediárias nunca têm QR.
              delete next.quickReplies;
            }
            result.push(next);
          } else {
            const fresh = {
              id: createId('msg'),
              type: 'bot',
              text,
              html: formatAssistantHtml(text),
            };
            if (isLastWelcome && availableQuickReplies.length > 0) {
              fresh.quickReplies = availableQuickReplies;
            }
            result.push(fresh);
          }
        }
        return [...result, ...tail];
      };

      // Cleanup de timers da sequência anterior (caso loadConfig rodou denovo)
      clearWelcomeSequenceTimers();
      clearFunnelTimers();

      // ===== MODO FUNIL =====
      // Se o funil está habilitado, ignora completamente welcome/IA e
      // toca a sequência inicial do funil. Sem cache local: cada reload
      // começa do início.
      const funilCfg = normalized?.personalizacao?.funil;
      if (funilCfg?.enabled === true && funilCfg.startSequenceId) {
        setConfig(normalized);
        applyThemeVariables(normalized.personalizacao);
        setLeadState(restoredLeadState);
        setMessages([]);
        setFunnelState({
          currentSequenceId: null,
          variables: {},
          awaitingInput: false,
          awaitingInputVariable: '',
          awaitingInputNextSeq: '',
          leadCaptureActive: false,
          leadCaptureFields: [],
          leadCaptureNextSeq: '',
          leadCaptureDone: false,
        });
        setFunnelExited(false);
        const t = window.setTimeout(() => {
          playFunnelSequence(funilCfg.startSequenceId);
        }, 150);
        funnelTimersRef.current.push(t);
        return;
      }

      if (isFirstVisit && welcomeMessagesList.length > 0) {
        // Primeira visita real (sem nada local nem no servidor): toca a
        // sequência typing → welcome → typing → ... → typing → quickReplies.
        setConfig(normalized);
        applyThemeVariables(normalized.personalizacao);
        setLeadState(restoredLeadState);
        setMessages([]); // começa vazio; o scheduler preenche
        scheduleWelcomeSequence(welcomeMessagesList, availableQuickReplies);
      } else {
        // Já existe estado: reconcilia welcomes mantendo o histórico.
        // Se primeira é user ou nada, prepende a lista completa de welcomes.
        let withWelcomes = restoredMessages;
        if (welcomeMessagesList.length > 0) {
          if (countLeadingBots(restoredMessages) === 0) {
            // Nenhuma welcome presente — prepende todas (histórico do server).
            // A última welcome recebe TODAS as quick replies configuradas.
            const prepended = welcomeMessagesList.map((text, i) => {
              const isLast = i === welcomeMessagesList.length - 1;
              const base = {
                id: createId('msg'),
                type: 'bot',
                text,
                html: formatAssistantHtml(text),
              };
              if (isLast && availableQuickReplies.length > 0) {
                base.quickReplies = availableQuickReplies;
              }
              return base;
            });
            withWelcomes = [...prepended, ...restoredMessages];
          } else {
            withWelcomes = reconcileWelcomes(restoredMessages);
          }
        }

        setConfig(normalized);
        applyThemeVariables(normalized.personalizacao);
        setLeadState(restoredLeadState);
        setMessages(applyQuickRepliesToMessages(withWelcomes));
      }
    } catch (err) {
      setConfig(null);
      setMessages([]);
      setFatalError(resolveErrorMessage(err, 'Falha ao carregar a configuracao do webchat.'));
    } finally {
      setLoading(false);
    }
  }, [clearDeliveryStatusTimers, clearWelcomeSequenceTimers, clearFunnelTimers, domain, playFunnelSequence, scheduleWelcomeSequence, sessionId, slug]);

  useEffect(() => {
    setInterstitialFired(false);
    setRefreshPopupOpen(false);
    inlineSequenceIndexRef.current = 0;
    inlineAdCooldownRef.current = {};
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    const html = config?.headerAdsCode;
    if (!html || typeof document === 'undefined') return undefined;

    const previous = document.querySelectorAll('[data-webchat-header-script="1"]');
    previous.forEach((el) => el.remove());

    const scripts = [];
    const inlineScripts = [];
    const regex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = regex.exec(String(html)))) {
      const attrs = match[1] || '';
      const src = attrs.match(/src=["']([^"']+)["']/i)?.[1];
      if (src) {
        const external = document.createElement('script');
        external.src = src;
        external.async = true;
        external.setAttribute('data-webchat-header-script', '1');
        document.head.appendChild(external);
        scripts.push(external);
      } else if (safeText(match[2])) {
        inlineScripts.push(match[2]);
      }
    }

    let inlineTimer = null;
    inlineTimer = window.setTimeout(() => {
      inlineScripts.forEach((content) => {
        const inline = document.createElement('script');
        inline.type = 'text/javascript';
        inline.text = content;
        inline.setAttribute('data-webchat-header-script', '1');
        document.head.appendChild(inline);
        scripts.push(inline);
      });
    }, 800);

    return () => {
      if (inlineTimer) window.clearTimeout(inlineTimer);
      scripts.forEach((script) => script.remove());
    };
  }, [config?.headerAdsCode]);

  // Footer scripts: HTML/scripts que precisam estar antes de </body>.
  // Casos típicos: Meta Pixel, GA4 noscript fallback, Hotjar tracker,
  // pixels de conversão. Diferente do header (carrega antes do conteúdo),
  // o footer roda quando a página já existe — adequado pra trackers que
  // medem permanência/engajamento.
  //
  // Estratégia: parsear HTML e:
  //   - <script src=...>: cria <script> async no document.body
  //   - <script>...</script> inline: cria <script> inline no body
  //   - Outros nodes (noscript, img de pixel, divs): injetam num container
  //     dedicado <div data-webchat-footer-container> no fim do body.
  useEffect(() => {
    const html = config?.footerAdsCode;
    if (!html || typeof document === 'undefined') return undefined;

    // Cleanup de execução anterior (caso config mude em hot reload)
    document
      .querySelectorAll('[data-webchat-footer-script="1"]')
      .forEach((el) => el.remove());
    const prevContainer = document.getElementById('webchat-footer-container');
    if (prevContainer) prevContainer.remove();

    const created = [];

    // Container pra HTML não-script (noscript, img pixel, divs)
    const container = document.createElement('div');
    container.id = 'webchat-footer-container';
    container.setAttribute('data-webchat-footer-script', '1');
    container.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;';
    document.body.appendChild(container);
    created.push(container);

    // Injeta o HTML no container — vai cuidar de noscript, img, etc
    // (scripts <script> dentro do innerHTML não são executados pelo browser
    // por padrão, então tratamos eles separadamente abaixo).
    const sanitizedNonScript = String(html).replace(
      /<script\b[\s\S]*?<\/script>/gi,
      '',
    );
    if (sanitizedNonScript.trim()) {
      container.innerHTML = sanitizedNonScript;
    }

    // Extrai e re-injeta scripts (pra garantir execução)
    const externalScripts = [];
    const inlineScripts = [];
    const regex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = regex.exec(String(html)))) {
      const attrs = match[1] || '';
      const src = attrs.match(/src=["']([^"']+)["']/i)?.[1];
      const type = attrs.match(/type=["']([^"']+)["']/i)?.[1];
      if (src) {
        externalScripts.push({ src, type });
      } else if (safeText(match[2])) {
        inlineScripts.push({ content: match[2], type });
      }
    }

    externalScripts.forEach(({ src, type }) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      if (type) script.type = type;
      script.setAttribute('data-webchat-footer-script', '1');
      document.body.appendChild(script);
      created.push(script);
    });

    // Inline scripts com pequeno delay pra dar tempo dos externos carregarem
    // (ex: gtag.js antes de gtag('config', ...)).
    let inlineTimer = null;
    inlineTimer = window.setTimeout(() => {
      inlineScripts.forEach(({ content, type }) => {
        const script = document.createElement('script');
        script.type = type || 'text/javascript';
        script.text = content;
        script.setAttribute('data-webchat-footer-script', '1');
        document.body.appendChild(script);
        created.push(script);
      });
    }, 800);

    return () => {
      if (inlineTimer) window.clearTimeout(inlineTimer);
      created.forEach((node) => node.remove());
    };
  }, [config?.footerAdsCode]);

  useEffect(() => {
    if (loading || fatalError || sending) return;
    focusMessageInput();
  }, [loading, fatalError, sending, focusMessageInput]);

  // Autofocus quando o funil entra em wait_input — input acabou de
  // aparecer (estava escondido em modo opções), e queremos que o lead
  // já possa digitar sem precisar clicar no campo.
  useEffect(() => {
    if (!funnelMode) return;
    if (!funnelState.awaitingInput) return;
    if (loading || fatalError) return;
    // Pequeno delay pra garantir que o input já foi montado no DOM.
    const t = window.setTimeout(() => focusMessageInput(), 50);
    return () => window.clearTimeout(t);
  }, [funnelMode, funnelState.awaitingInput, loading, fatalError, focusMessageInput]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const styleId = 'webchat-custom-css';
    const previous = document.getElementById(styleId);
    if (previous) previous.remove();

    const css = normalizeCustomCss(config?.personalizacao?.customCSS);
    if (!css) return undefined;

    const styleTag = document.createElement('style');
    styleTag.id = styleId;
    styleTag.type = 'text/css';
    styleTag.textContent = css;
    document.head.appendChild(styleTag);

    return () => {
      styleTag.remove();
    };
  }, [config?.personalizacao?.customCSS]);

  useEffect(() => {
    destroyCodeAdSlot('gpt-ad-topo');
    destroyCodeAdSlot('gpt-ad-rodape');
    destroyGptSlot('gpt-ad-topo');
    destroyGptSlot('gpt-ad-rodape');
    slotPositionByDivIdRef.current = {};
    if (!config) return undefined;

    let cancelled = false;
    let retryTimer = null;
    let attemptCount = 0;
    const maxAttempts = 12;

    const registerSlotMap = (position, anuncio, defaultDivId) => {
      const code = resolveAdCode(anuncio);
      const gptDivId = resolveGptDivIdFromAd(anuncio, code, defaultDivId);
      slotPositionByDivIdRef.current[defaultDivId] = position;
      slotPositionByDivIdRef.current[gptDivId] = position;
    };

    const renderTopAndFooter = () => {
      if (cancelled) return;

      if (config.anuncios?.topo) {
        registerSlotMap('topo', config.anuncios.topo, 'gpt-ad-topo');
        enqueueAdEvent('requested', 'topo', {
          adKey: resolveGptSlotFromAd(config.anuncios.topo, resolveAdCode(config.anuncios.topo)) || resolveAdCode(config.anuncios.topo)
        });
        renderGptSlot(config.anuncios.topo, 'topo', 'messages', 'gpt-ad-topo');
      }
      if (config.anuncios?.rodape) {
        registerSlotMap('rodape', config.anuncios.rodape, 'gpt-ad-rodape');
        enqueueAdEvent('requested', 'rodape', {
          adKey: resolveGptSlotFromAd(config.anuncios.rodape, resolveAdCode(config.anuncios.rodape)) || resolveAdCode(config.anuncios.rodape)
        });
        renderGptSlot(config.anuncios.rodape, 'rodape', 'anuncio-rodape', 'gpt-ad-rodape');
      }
      scrollMessagesContainerToBottom();
    };

    const requiresGoogletag =
      Boolean(resolveGptSlotFromAd(config.anuncios?.topo, resolveAdCode(config.anuncios?.topo))) ||
      Boolean(resolveGptSlotFromAd(config.anuncios?.rodape, resolveAdCode(config.anuncios?.rodape)));

    const run = () => {
      if (!requiresGoogletag || (typeof window !== 'undefined' && window.googletag?.cmd)) {
        renderTopAndFooter();
        return;
      }
      if (attemptCount >= maxAttempts) {
        renderTopAndFooter();
        return;
      }
      attemptCount += 1;
      retryTimer = window.setTimeout(run, 250);
    };

    run();

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      destroyCodeAdSlot('gpt-ad-topo');
      destroyCodeAdSlot('gpt-ad-rodape');
      destroyGptSlot('gpt-ad-topo');
      destroyGptSlot('gpt-ad-rodape');
    };
  }, [config, enqueueAdEvent]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    let detached = false;
    let renderHandler = null;
    let viewableHandler = null;

    waitForGoogletag()
      .then(() => {
        if (detached) return;
        window.googletag.cmd.push(() => {
          if (detached) return;
          const pubads = window.googletag.pubads();
          renderHandler = (event) => {
            const slotElementId = safeText(event?.slot?.getSlotElementId?.());
            const slotPath = safeText(event?.slot?.getAdUnitPath?.());
            const position = resolveSlotPositionByDivId(slotElementId, slotPositionByDivIdRef.current);
            if (!position) return;
            enqueueAdEvent(event?.isEmpty ? 'empty' : 'rendered', position, {
              adKey: slotPath || slotElementId,
              payload: {
                slot_div_id: slotElementId || null,
                size: event?.size || null
              }
            });
            scrollMessagesContainerToBottom();
          };
          viewableHandler = (event) => {
            const slotElementId = safeText(event?.slot?.getSlotElementId?.());
            const slotPath = safeText(event?.slot?.getAdUnitPath?.());
            const position = resolveSlotPositionByDivId(slotElementId, slotPositionByDivIdRef.current);
            if (!position) return;
            enqueueAdEvent('viewable', position, {
              adKey: slotPath || slotElementId
            });
          };
          pubads.addEventListener('slotRenderEnded', renderHandler);
          pubads.addEventListener('impressionViewable', viewableHandler);
        });
      })
      .catch(() => {});

    return () => {
      detached = true;
      if (!window.googletag?.cmd) return;
      window.googletag.cmd.push(() => {
        const pubads = window.googletag.pubads();
        if (renderHandler) pubads.removeEventListener('slotRenderEnded', renderHandler);
        if (viewableHandler) pubads.removeEventListener('impressionViewable', viewableHandler);
      });
    };
  }, [enqueueAdEvent]);

  useEffect(() => {
    const interstitial = toObject(config?.anuncios?.intersticial);
    if (!interstitial?.ativo || interstitialFired) {
      return undefined;
    }

    const interstitialCode = resolveAdCode(interstitial);
    const interstitialFixedHtml = resolveAdFixedHtml(interstitial);
    const interstitialSlot = resolveGptSlotFromAd(interstitial, interstitialCode);
    const interstitialKey = interstitialSlot || interstitialCode || 'intersticial';

    if (interstitialFixedHtml) {
      setInterstitialFired(true);
      enqueueAdEvent('requested', 'intersticial', { adKey: interstitialKey });
      const containerId = 'webchat-interstitial-code';
      const previous = document.getElementById(containerId);
      if (previous) previous.remove();

      const container = document.createElement('div');
      container.id = containerId;
      container.style.display = 'none';
      document.body.appendChild(container);
      mountAdMarkup(container, interstitialFixedHtml);
      enqueueAdEvent('rendered', 'intersticial', { adKey: interstitialKey });

      return () => {
        container.remove();
      };
    }

    if (interstitialSlot) {
      let cancelled = false;
      let clickHandler = null;
      let keyHandler = null;
      let touchHandler = null;
      let delayedTry = null;
      let firstGestureFired = false;
      const removeListeners = () => {
        if (clickHandler) document.removeEventListener('click', clickHandler, true);
        if (keyHandler) document.removeEventListener('keydown', keyHandler, true);
        if (touchHandler) document.removeEventListener('touchstart', touchHandler, true);
        clickHandler = null;
        keyHandler = null;
        touchHandler = null;
      };
      const attemptDisplay = (markAsFired = true) => {
        if (cancelled || interstitialFired || !window.webchatInterstitialSlot || !window.googletag) return;
        if (markAsFired) {
          setInterstitialFired(true);
        }
        enqueueAdEvent('requested', 'intersticial', {
          adKey: interstitialKey
        });
        window.googletag.display(window.webchatInterstitialSlot);
        if (markAsFired) {
          removeListeners();
        }
      };

      waitForGoogletag()
        .then(() => {
          if (cancelled) return;
          window.googletag.cmd.push(() => {
            if (window.webchatInterstitialSlot) {
              window.googletag.destroySlots([window.webchatInterstitialSlot]);
            }
            window.webchatInterstitialSlot = window.googletag.defineOutOfPageSlot(
              interstitialSlot,
              window.googletag.enums.OutOfPageFormat.INTERSTITIAL
            );
            if (window.webchatInterstitialSlot) {
              window.webchatInterstitialSlot.addService(window.googletag.pubads());
              // Tenta exibir no load e mantém fallback no primeiro gesto do usuário.
              delayedTry = window.setTimeout(() => {
                if (!cancelled) {
                  window.googletag.cmd.push(() => attemptDisplay(false));
                }
              }, 400);

              clickHandler = () => {
                if (firstGestureFired) return;
                firstGestureFired = true;
                window.googletag.cmd.push(() => attemptDisplay());
              };
              keyHandler = () => {
                if (firstGestureFired) return;
                firstGestureFired = true;
                window.googletag.cmd.push(() => attemptDisplay());
              };
              touchHandler = () => {
                if (firstGestureFired) return;
                firstGestureFired = true;
                window.googletag.cmd.push(() => attemptDisplay());
              };
              document.addEventListener('click', clickHandler, true);
              document.addEventListener('keydown', keyHandler, true);
              document.addEventListener('touchstart', touchHandler, true);
            }
          });
        })
        .catch(() => {
          enqueueAdEvent('error', 'intersticial', { adKey: interstitialKey });
        });

      return () => {
        cancelled = true;
        if (delayedTry) window.clearTimeout(delayedTry);
        removeListeners();
      };
    }

    if (!interstitialCode || !looksLikeHtmlSnippet(interstitialCode)) return undefined;

    setInterstitialFired(true);
    enqueueAdEvent('requested', 'intersticial', { adKey: interstitialKey });
    const containerId = 'webchat-interstitial-code';
    const previous = document.getElementById(containerId);
    if (previous) previous.remove();

    const container = document.createElement('div');
    container.id = containerId;
    container.style.display = 'none';
    document.body.appendChild(container);
    mountAdMarkup(container, interstitialCode);
    enqueueAdEvent('rendered', 'intersticial', { adKey: interstitialKey });

    return () => {
      container.remove();
    };
  }, [config, enqueueAdEvent, interstitialFired]);

  useEffect(() => {
    if (!config) return undefined;

    const popupConfig = resolveInterstitialRefreshPopupConfig(config);
    if (!popupConfig.enabled) {
      setRefreshPopupOpen(false);
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setRefreshPopupOpen(true);
    }, popupConfig.intervalMinutes * 60 * 1000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [config]);

  const sendMessage = useCallback(
    async (text, options = {}) => {
      const content = safeText(text);
      const background = options?.background === true;
      if (!content || !slug) return;
      if (sending && !background) return;
      // Se o lead manda mensagem durante a sequência de welcome, interrompe-a.
      // Limpa também qualquer typing pendente para evitar que apareça depois.
      clearWelcomeSequenceTimers();
      setMessages((prev) => prev.filter((m) => m?.type !== 'typing'));
      const isWhatsAppLayout = isWhatsAppLayoutPreset(toObject(config?.personalizacao?.theme).layoutPreset);
      const currentUserMessagesCount = messagesRef.current.filter((msg) => msg.type === 'user').length;
      const nextLeadCount = currentUserMessagesCount + 1;
      const userMessageId = createId('msg');
      const typingMessageId = background ? null : createId('msg');

      if (currentUserMessagesCount === 0 && !interstitialFired && typeof window !== 'undefined' && window.googletag && window.webchatInterstitialSlot) {
        window.googletag.cmd.push(() => {
          if (!window.webchatInterstitialSlot) return;
          setInterstitialFired(true);
          enqueueAdEvent('requested', 'intersticial', { adKey: 'intersticial-first-message' });
          window.googletag.display(window.webchatInterstitialSlot);
        });
      }

      if (!background) {
        setSending(true);
        setChatError('');
      }
      setMessages((prev) => {
        const next = [
          ...prev,
          {
            id: userMessageId,
            type: 'user',
            text: content,
            html: '',
            deliveryStatus: isWhatsAppLayout ? 'single_gray' : null
          }
        ];
        if (typingMessageId) {
          next.push({ id: typingMessageId, type: 'typing' });
        }
        return next;
      });
      if (isWhatsAppLayout) {
        scheduleWhatsAppCheckmarkProgress(userMessageId);
      }

      try {
        const conversationHistory = buildConversationHistory(messagesRef.current);
        const context =
          typeof window === 'undefined'
            ? { domain }
            : {
                domain,
                page_url: window.location.href,
                user_agent: window.navigator.userAgent
              };

        // Timeout 90s alinhado com o back (AI_CALL_TIMEOUT_MS=90s) +
        // pequena margem. O default do axios (30s) era muito apertado:
        // sob cycling de providers no ai-router (cada um com timeout 45s),
        // requests legítimas demoravam mais de 30s e o front desistia
        // mesmo o back tendo processado e salvado a sessão. Aí o lead
        // via "timeout of 30000ms exceeded" e ao recarregar via a msg.
        const raw = await post(
          `/public/webchat/${slug}/messages?domain=${encodeURIComponent(domain)}`,
          {
            message: content,
            session_id: sessionId,
            lead_state: leadState,
            conversation_history: conversationHistory,
            context
          },
          { timeout: 95_000 }
        );

        const normalized = normalizeMessageResponse(raw);
        const reply = normalized.reply || 'A IA nao retornou uma resposta valida.';
        const replyHtml = formatAssistantHtml(reply);
        // Quick replies durante a conversa só vêm das "options" devolvidas
        // pela IA (já normalizadas, capadas em 3). Se a IA não devolveu
        // options, o bot reply não tem quick replies.
        const selectedQuickReplies = normalizeQuickReplies(normalized.options);

        const adsForInline = Object.keys(toObject(normalized.anuncios)).length > 0 ? normalized.anuncios : config?.anuncios;
        const inlineAd = pickInlineAdForNextMessage(
          adsForInline,
          nextLeadCount,
          inlineSequenceIndexRef,
          inlineAdCooldownRef
        );
        const inlineId = inlineAd ? createInlineAdMessageId() : null;

        if (inlineAd && inlineId) {
          const inlineCode = resolveAdCode(inlineAd);
          const inlineKey = resolveGptSlotFromAd(inlineAd, inlineCode) || inlineCode || String(inlineAd.id || 'inline');
          const inlineDivBase = resolveGptDivIdFromAd(inlineAd, inlineCode, 'gpt-ad-inline');
          enqueueAdEvent('requested', 'entre-mensagens', { adKey: inlineKey });
          slotPositionByDivIdRef.current[`inline-ad-slot-${inlineId}`] = 'entre-mensagens';
          slotPositionByDivIdRef.current[`${inlineDivBase}:prefix`] = 'entre-mensagens';
        }

        setMessages((prev) => {
          const next = typingMessageId
            ? prev.filter((entry) => safeText(entry?.id) !== typingMessageId)
            : prev;
          const withReply = [...next];
          if (inlineAd && inlineId) {
            withReply.push({
              type: 'ad',
              id: inlineId,
              anuncio: inlineAd
            });
          }
          const replyMessage = {
            id: createId('msg'),
            type: 'bot',
            text: reply,
            html: replyHtml,
          };
          if (selectedQuickReplies.length > 0) {
            replyMessage.quickReplies = selectedQuickReplies;
          }
          withReply.push(replyMessage);
          return withReply;
        });
        setLeadState((prev) => normalizeLeadCapture(normalized.leadCapture, prev));
      } catch (err) {
        if (background) {
          return;
        }
        const message = resolveErrorMessage(err, 'Falha ao enviar mensagem para o webchat.');
        setChatError(message);
        setMessages((prev) => {
          const next = typingMessageId
            ? prev.filter((entry) => safeText(entry?.id) !== typingMessageId)
            : prev;
          return [
            ...next,
            {
              id: createId('msg'),
              type: 'bot',
              text: `Erro: ${message}`,
              html: formatAssistantHtml(`Erro: ${message}`)
            }
          ];
        });
      } finally {
        if (!background) {
          setSending(false);
        }
      }
    },
    [
      sending,
      slug,
      domain,
      sessionId,
      config?.anuncios,
      config?.personalizacao,
      leadState,
      interstitialFired,
      enqueueAdEvent,
      scheduleWhatsAppCheckmarkProgress,
      clearWelcomeSequenceTimers
    ]
  );

  // Sincroniza o ref de sendMessage (usado pelo handleFunnelOptionClick
  // pra ação send_to_ai — declarado bem antes de sendMessage neste arquivo).
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  if (loading) {
    return (
      <div
        role="status"
        aria-label="..."
        style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <CircularProgress size={28} thickness={4} />
      </div>
    );
  }

  if (fatalError) {
    return (
      <div style={{ maxWidth: 560, margin: '48px auto', padding: '0 16px' }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={loadConfig}>
              Tentar novamente
            </Button>
          }
        >
          {fatalError}
        </Alert>
      </div>
    );
  }

  if (!config) {
    return (
      <div style={{ maxWidth: 560, margin: '48px auto', padding: '0 16px' }}>
        <Alert severity="warning">Webchat nao encontrado.</Alert>
      </div>
    );
  }

  const personalizacao = toObject(config.personalizacao);
  const theme = toObject(personalizacao.theme);
  const header = toObject(personalizacao.header);
  const isWhatsAppLayout = isWhatsAppLayoutPreset(theme.layoutPreset);
  const layoutStyles = resolveLayoutStyles(theme.layoutPreset, theme.borderRadius);
  const animationStyle = resolveAnimationStyle(personalizacao.animation);
  const placeholderText = safeText(personalizacao.placeholderInput) || 'Digite sua mensagem...';
  const footerText = safeText(personalizacao.footerText);
  const legalPages = normalizeLegalPages(personalizacao.legalPages);
  const isDark = Boolean(theme.darkMode);
  const userTextColor = isWhatsAppLayout ? (isDark ? '#e9edef' : '#111b21') : safeText(theme.secondaryColor) || '#ffffff';
  const headerVisible = header.show !== false;
  const bubbleShadow = theme.bubbleShadow === false || !layoutStyles.bubbleShadow ? 'none' : 'var(--pubmail-bubble-shadow, none)';
  // Track de IDs já animados — animação só roda na PRIMEIRA renderização de
  // cada mensagem. Isso evita que mensagens antigas "tremam" / re-disparem a
  // animação a cada re-render (ex: quando o lead manda mensagem nova ou os
  // checkmarks de delivery atualizam o estado).
  // Mutação segura durante render: o set só cresce; double-render do
  // StrictMode é idempotente.
  const animationStyleFor = (messageId) => {
    if (!messageId) return animationStyle;
    if (animatedMessageIdsRef.current.has(messageId)) return {};
    animatedMessageIdsRef.current.add(messageId);
    return animationStyle;
  };
  // Raio do "tail" (canto que aponta para o remetente). Nunca excede o
  // bubbleRadius — assim, se o usuário escolher 0, todos os 4 cantos ficam 0.
  const tailRadius = Math.min(
    layoutStyles.bubbleRadius,
    isWhatsAppLayout ? 4 : Math.max(4, Math.floor(layoutStyles.bubbleRadius / 3))
  );
  const messagesBackgroundImage =
    isWhatsAppLayout && !safeText(theme.backgroundImageUrl)
      ? isDark
        ? 'radial-gradient(circle at 20% 20%, rgba(134,150,160,0.08) 0 1.2px, transparent 1.3px), radial-gradient(circle at 80% 80%, rgba(134,150,160,0.06) 0 1px, transparent 1.2px)'
        : 'radial-gradient(circle at 20% 20%, rgba(7,94,84,0.08) 0 1.2px, transparent 1.3px), radial-gradient(circle at 80% 80%, rgba(7,94,84,0.06) 0 1px, transparent 1.2px)'
      : 'var(--pubmail-chat-bg-image, none)';
  const refreshPopupConfig = resolveInterstitialRefreshPopupConfig(config);

  const baseFontSize = clampWebchatFontSize(theme.fontSize);

  return (
    <div
      className="pubmail-shell"
      style={{
        width: '100%',
        height: '100dvh',
        display: 'flex',
        justifyContent: 'center',
        // As laterais (visíveis quando o chat é centralizado no desktop) usam
        // o MESMO fundo da área de mensagens — fica contínuo com o chat.
        background: 'var(--pubmail-bg, #e5ddd5)',
        backgroundImage: messagesBackgroundImage,
        backgroundSize: isWhatsAppLayout && !safeText(theme.backgroundImageUrl) ? '28px 28px' : 'cover',
        backgroundRepeat: isWhatsAppLayout && !safeText(theme.backgroundImageUrl) ? 'repeat' : 'no-repeat',
        backgroundPosition: 'center'
      }}
    >
    <div
      id="chat"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        width: '100%',
        background: 'var(--pubmail-chat-surface, #fff)',
        color: 'var(--pubmail-chat-text, #111111)',
        fontFamily: 'var(--pubmail-font, Inter, sans-serif)',
        fontSize: `var(--pubmail-font-size, ${WEBCHAT_DEFAULT_FONT_SIZE}px)`
      }}
    >
      <style>
        {`
          @keyframes pubmail-fade-in { from { opacity: 0; } to { opacity: 1; } }
          @keyframes pubmail-slide-in { from { transform: translateY(14px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
          @keyframes pubmail-zoom-in { from { transform: scale(.97); opacity: 0; } to { transform: scale(1); opacity: 1; } }
          @keyframes pubmail-typing-bounce {
            0%, 60%, 100% { transform: translateY(0); opacity: 0.45; }
            30% { transform: translateY(-5px); opacity: 1; }
          }

          /* Largura base do bloco de mensagem do bot */
          .pubmail-msg-wrap { max-width: 85%; }

          /* Desktop: proporções maiores — bloco da mensagem >= ~50% da tela,
             texto e botões maiores. */
          @media (min-width: 768px) {
            /* Chat vira uma coluna centralizada; as laterais mostram o fundo. */
            #chat {
              font-size: ${baseFontSize + 2}px !important;
              max-width: 720px;
            }
            .pubmail-msg-wrap { min-width: 52%; max-width: 80%; }
            .pubmail-bot-bubble { min-width: 100%; box-sizing: border-box; }
            .pubmail-qr-btn {
              font-size: ${Math.max(15, baseFontSize + 1)}px !important;
              padding-top: 15px !important;
              padding-bottom: 15px !important;
            }
          }

          /* Mobile: o bloco do bot ocupa todo o container -> botões 100% do
             container do chat (com o padding normal). Bolhas inalteradas. */
          @media (max-width: 767px) {
            .pubmail-msg-wrap { width: 100%; max-width: 100%; }
          }
        `}
      </style>

      <Header config={config} layoutStyles={layoutStyles} />

      <div style={{ padding: chatError ? '12px 12px 0 12px' : 0 }}>
        {chatError ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => setChatError('')}>
                Fechar
              </Button>
            }
          >
            {chatError}
          </Alert>
        ) : null}
      </div>

      <div
        id="messages"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 12,
          background: 'var(--pubmail-bg, #e5ddd5)',
          backgroundImage: messagesBackgroundImage,
          backgroundSize: isWhatsAppLayout && !safeText(theme.backgroundImageUrl) ? '28px 28px' : 'cover',
          backgroundRepeat: isWhatsAppLayout && !safeText(theme.backgroundImageUrl) ? 'repeat' : 'no-repeat',
          backgroundPosition: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          borderRadius: headerVisible ? '0' : `${layoutStyles.chatRadius}px ${layoutStyles.chatRadius}px 0 0`
        }}
      >
        {messages.map((msg, index) => {
          const key = msg.id || `${msg.type}-${index}`;

          if (msg.type === 'ad' && msg.anuncio) {
            return (
              <InlineAdMessage
                key={key}
                messageId={String(msg.id || index)}
                anuncio={toObject(msg.anuncio)}
                animationStyle={animationStyleFor(key)}
              />
            );
          }

          if (msg.type === 'user') {
            const deliveryStatus = normalizeWhatsAppDeliveryStatus(msg.deliveryStatus);
            const deliveryLabel =
              deliveryStatus === 'single_gray'
                ? 'Mensagem enviada'
                : deliveryStatus === 'double_gray'
                  ? 'Mensagem entregue'
                  : 'Mensagem visualizada';
            return (
              <div
                key={key}
                style={{
                  ...animationStyleFor(key),
                  alignSelf: 'flex-end',
                  background: 'var(--pubmail-user-bubble-color, #2979ff)',
                  color: userTextColor,
                  borderBottomRightRadius: tailRadius,
                  maxWidth: '80%',
                  padding: '12px 16px',
                  borderRadius: layoutStyles.bubbleRadius,
                  border: isWhatsAppLayout ? '1px solid rgba(17, 27, 33, 0.06)' : 'none',
                  boxShadow: bubbleShadow,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}
              >
                <div>{msg.text}</div>
                {isWhatsAppLayout ? (
                  <div
                    style={{
                      marginTop: 3,
                      minHeight: 12,
                      textAlign: 'right',
                      lineHeight: 1
                    }}
                    aria-label={deliveryLabel}
                    title={deliveryLabel}
                  >
                    <WhatsAppCheckmarks status={deliveryStatus} />
                  </div>
                ) : null}
              </div>
            );
          }

          if (msg.type === 'typing') {
            const dotColor = isDark ? '#f8fafc' : '#6b7280';
            const dotStyle = {
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: dotColor,
              display: 'inline-block',
              animation: 'pubmail-typing-bounce 1.2s infinite ease-in-out'
            };
            return (
              <div
                key={key}
                aria-label="..."
                role="status"
                style={{
                  ...animationStyleFor(key),
                  alignSelf: 'flex-start',
                  background: 'var(--pubmail-bot-bubble-color, #f1f0f0)',
                  borderBottomLeftRadius: tailRadius,
                  border:
                    isWhatsAppLayout
                      ? '1px solid rgba(17, 27, 33, 0.08)'
                      : safeText(theme.layoutPreset).toLowerCase() === 'minimal'
                      ? '1px solid transparent'
                      : '1px solid var(--pubmail-primary, #2979ff)',
                  padding: '14px 16px',
                  borderRadius: layoutStyles.bubbleRadius,
                  boxShadow: bubbleShadow,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  lineHeight: 0
                }}
              >
                <span style={{ ...dotStyle, animationDelay: '0s' }} />
                <span style={{ ...dotStyle, animationDelay: '0.18s' }} />
                <span style={{ ...dotStyle, animationDelay: '0.36s' }} />
              </div>
            );
          }

          // Sem slice: welcomes mostram TODAS as QR configuradas; bot replies
          // mostram as "options" devolvidas pela IA (já capadas em 3).
          const messageQuickReplies = normalizeQuickReplies(msg.quickReplies);
          return (
            <div
              key={key}
              className="pubmail-msg-wrap"
              style={{
                ...animationStyleFor(key),
                alignSelf: 'flex-start',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 8
              }}
            >
              {msg.mediaType === 'audio' && msg.mediaUrl ? (
                // Áudio: tag solta no chat, SEM bubble e SEM cor de fundo.
                // Wrapper com width fixa garante que <audio> tenha dimensão
                // mesmo em flex-column com alignItems: flex-start (sem
                // wrapper, alguns navegadores colapsam o player pra 0).
                <div style={{ width: 320, maxWidth: '100%' }}>
                  <audio
                    controls
                    preload="metadata"
                    src={msg.mediaUrl}
                    onError={(e) => {
                      // eslint-disable-next-line no-console
                      console.warn('[webchat-funnel] audio load error:', e?.target?.error);
                    }}
                    style={{
                      width: '100%',
                      display: 'block',
                      colorScheme: isDark ? 'dark' : undefined,
                    }}
                  />
                </div>
              ) : (
                <div
                  className="pubmail-bot-bubble"
                  style={{
                    background: 'var(--pubmail-bot-bubble-color, #f1f0f0)',
                    color: isDark ? '#f8fafc' : '#111111',
                    borderBottomLeftRadius: tailRadius,
                    border:
                      isWhatsAppLayout
                        ? '1px solid rgba(17, 27, 33, 0.08)'
                        : safeText(theme.layoutPreset).toLowerCase() === 'minimal'
                        ? '1px solid transparent'
                        : '1px solid var(--pubmail-primary, #2979ff)',
                    maxWidth: '100%',
                    padding: msg.mediaType ? '6px 6px 8px 6px' : '12px 16px',
                    borderRadius: layoutStyles.bubbleRadius,
                    boxShadow: bubbleShadow,
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.mediaType === 'image' && msg.mediaUrl ? (
                    <>
                      {msg.mediaLinkUrl ? (
                        <a
                          href={msg.mediaLinkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'block', cursor: 'pointer' }}
                          onClick={() => {
                            // Click em imagem com link encerra o funil
                            // (mesma ação de redirect option). Só dispara
                            // no modo funil pra não interferir no modo IA.
                            if (funnelMode) {
                              triggerFunnelEndRef.current?.();
                            }
                          }}
                        >
                          <img
                            src={msg.mediaUrl}
                            alt=""
                            style={{
                              width: '100%',
                              height: 'auto',
                              borderRadius: 10,
                              display: 'block',
                            }}
                          />
                        </a>
                      ) : (
                        <img
                          src={msg.mediaUrl}
                          alt=""
                          style={{
                            width: '100%',
                            height: 'auto',
                            borderRadius: 10,
                            display: 'block',
                          }}
                        />
                      )}
                      {msg.caption ? (
                        <div
                          style={{ padding: '6px 8px 0 8px', fontSize: 14 }}
                          dangerouslySetInnerHTML={{ __html: msg.caption }}
                        />
                      ) : null}
                    </>
                  ) : (
                    <div dangerouslySetInnerHTML={{ __html: msg.html }} />
                  )}
                </div>
              )}

              {messageQuickReplies.length > 0 ? (
                <div
                  className="pubmail-qr"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    width: '100%'
                  }}
                >
                  {messageQuickReplies.map((reply, replyIndex) => (
                    <a
                      key={`${key}-quick-${replyIndex}`}
                      className={reply.cssClass ? `pubmail-qr-btn ${reply.cssClass}` : 'pubmail-qr-btn'}
                      href={reply.href || '#'}
                      aria-disabled={sending ? 'true' : 'false'}
                      onClick={(event) => {
                        if (sending) {
                          event.preventDefault();
                          return;
                        }
                        // Botões com URL = LINK HTML PURO. Não fazemos
                        // preventDefault, window.open nem abrimos nova aba: o
                        // navegador navega na mesma aba e scripts de anúncio
                        // (ex.: classe swp-run-rewarded da ADX) conseguem
                        // interceptar o clique, exibir o anúncio e só então
                        // redirecionar. Qualquer JS aqui quebraria esse fluxo.
                        if (reply.href) return;

                        // Modo Funil (sem URL): despacha pra engine local.
                        if (funnelMode && reply.__funnelOptionId) {
                          event.preventDefault();
                          const funil = config?.personalizacao?.funil;
                          const seq = funil?.sequences?.[funnelState.currentSequenceId];
                          const opt = seq?.ending?.options?.find((o) => o.id === reply.__funnelOptionId);
                          if (opt) handleFunnelOptionClick(opt);
                          return;
                        }

                        // Quick reply normal (sem URL): envia como mensagem.
                        event.preventDefault();
                        sendMessage(quickReplyPlainText(reply.text));
                      }}
                      onMouseEnter={(e) => {
                        if (sending) return;
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = isWhatsAppLayout
                          ? '0 4px 10px rgba(11, 20, 26, 0.18)'
                          : '0 8px 20px rgba(37, 99, 235, 0.22)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = '';
                        e.currentTarget.style.boxShadow = isWhatsAppLayout
                          ? '0 1px 2px rgba(11, 20, 26, 0.15)'
                          : '0 4px 12px rgba(37, 99, 235, 0.18)';
                      }}
                      style={{
                        border: isWhatsAppLayout
                          ? '1px solid transparent'
                          : `1px solid ${theme.primaryColor || '#2979ff'}`,
                        background:
                          'var(--pubmail-quick-reply-bg, ' +
                          (isWhatsAppLayout
                            ? theme.primaryColor || '#075e54'
                            : isDark
                            ? '#1f2a33'
                            : '#f5f6f7') +
                          ')',
                        color: isWhatsAppLayout ? '#ffffff' : theme.primaryColor || '#1d4ed8',
                        padding: '12px 18px',
                        borderRadius: 999,
                        textDecoration: 'none',
                        // Botão padrão: ocupa toda a largura, empilhado, texto
                        // centralizado e em negrito. display:block + width:100%.
                        display: 'block',
                        width: '100%',
                        boxSizing: 'border-box',
                        textAlign: 'center',
                        wordBreak: 'break-word',
                        fontSize: Math.max(13, baseFontSize - 1),
                        fontFamily: 'inherit',
                        lineHeight: 1.4,
                        cursor: sending ? 'not-allowed' : 'pointer',
                        fontWeight: 600,
                        opacity: sending ? 0.6 : 1,
                        boxShadow: sending
                          ? 'none'
                          : isWhatsAppLayout
                            ? '0 1px 2px rgba(11, 20, 26, 0.15)'
                            : '0 4px 12px rgba(37, 99, 235, 0.18)',
                        transition: 'transform 0.12s ease, box-shadow 0.15s ease'
                      }}
                      dangerouslySetInnerHTML={{ __html: quickReplyHtml(reply.text) }}
                    />

                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div id="anuncio-rodape" />

      {(() => {
        const inputLocked = sending || (funnelMode && !funnelState.awaitingInput);
        // Em modo funil sem awaitingInput o footer some completamente —
        // o lead deve usar as opções acima. Visualmente fica mais limpo
        // do que deixar o input desabilitado/opaco.
        const hideFooter = funnelMode && !funnelState.awaitingInput;
        if (hideFooter) return null;
        return (
      <div
        aria-disabled={inputLocked ? 'true' : 'false'}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: isWhatsAppLayout ? '12px 14px' : '14px 16px',
          gap: 10,
          borderTop: '1px solid var(--pubmail-border-color, #ccc)',
          background: 'var(--pubmail-chat-surface, #fff)',
          borderRadius: `0 0 ${layoutStyles.chatRadius}px ${layoutStyles.chatRadius}px`,
          transition: 'opacity 0.2s ease',
        }}
      >
        <input
          ref={messageInputRef}
          type="text"
          placeholder={
            placeholderText
          }
          disabled={inputLocked}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            const value = safeText(event.currentTarget.value);
            if (!value) return;
            if (funnelMode) {
              if (!funnelState.awaitingInput) return;
              handleFunnelTextInput(value);
              event.currentTarget.value = '';
              return;
            }
            sendMessage(value);
            event.currentTarget.value = '';
          }}
          style={{
            flex: 1,
            padding: isWhatsAppLayout ? '14px 18px' : '14px 18px',
            border: '1px solid var(--pubmail-border-color, #ccc)',
            borderRadius: isWhatsAppLayout ? 28 : Math.max(layoutStyles.inputRadius, 14),
            fontSize: Math.max(15, baseFontSize),
            fontFamily: 'inherit',
            outline: 'none',
            background: isDark ? '#0f172a' : '#ffffff',
            color: isDark ? '#f8fafc' : '#111111',
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            cursor: inputLocked ? 'not-allowed' : 'text',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = isWhatsAppLayout ? '#25d366' : 'var(--pubmail-primary, #2979ff)';
            e.currentTarget.style.boxShadow = isWhatsAppLayout
              ? '0 0 0 3px rgba(37, 211, 102, 0.15)'
              : '0 0 0 3px rgba(41, 121, 255, 0.18)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '';
            e.currentTarget.style.boxShadow = '';
          }}
        />
        <button
          type="button"
          aria-label="Enviar mensagem"
          onClick={() => {
            const input = messageInputRef.current;
            if (!input) return;
            const value = safeText(input.value);
            if (!value) return;
            if (funnelMode) {
              if (!funnelState.awaitingInput) return;
              handleFunnelTextInput(value);
              input.value = '';
              return;
            }
            sendMessage(value);
            input.value = '';
          }}
          disabled={inputLocked}
          style={{
            background: isWhatsAppLayout ? '#25d366' : 'var(--pubmail-primary, #2979ff)',
            border: 'none',
            color: isWhatsAppLayout ? '#075e54' : theme.secondaryColor || '#fff',
            width: isWhatsAppLayout ? 52 : 'auto',
            height: 52,
            minWidth: 52,
            padding: isWhatsAppLayout ? 0 : '0 22px',
            borderRadius: isWhatsAppLayout ? '50%' : Math.max(layoutStyles.inputRadius, 14),
            fontSize: isWhatsAppLayout ? 20 : Math.max(14, baseFontSize - 1),
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
            cursor: inputLocked ? 'not-allowed' : 'pointer',
            opacity: sending ? 0.5 : 1,
            boxShadow: isWhatsAppLayout
              ? '0 4px 12px rgba(37, 211, 102, 0.35)'
              : '0 4px 12px rgba(41, 121, 255, 0.30)',
            transition: 'transform 0.12s ease, box-shadow 0.15s ease, opacity 0.15s ease'
          }}
          onMouseDown={(e) => {
            if (inputLocked) return;
            e.currentTarget.style.transform = 'scale(0.96)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = '';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = '';
          }}
        >
          {isWhatsAppLayout ? '➤' : 'Enviar'}
        </button>
      </div>
        );
      })()}

      {footerText ? (
        <div
          style={{
            padding: '6px 12px 10px 12px',
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--pubmail-chat-muted, #6b7280)',
            background: 'var(--pubmail-chat-surface, #fff)'
          }}
        >
          {footerText}
        </div>
      ) : null}

      {legalPages.length > 0 ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '4px 8px',
            padding: '8px 12px 10px 12px',
            background: 'var(--pubmail-chat-surface, #fff)',
            borderTop: footerText ? 'none' : '1px solid var(--pubmail-border-color, #eee)'
          }}
        >
          {legalPages.map((p, i) => (
            <span key={`legal-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {i > 0 ? (
                <span aria-hidden="true" style={{ color: 'var(--pubmail-chat-muted, #9ca3af)', opacity: 0.6, fontSize: 11 }}>
                  ·
                </span>
              ) : null}
              <a
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'var(--pubmail-chat-muted, #6b7280)',
                  textDecoration: 'none',
                  fontSize: 11,
                  lineHeight: 1.3
                }}
              >
                {p.label}
              </a>
            </span>
          ))}
        </div>
      ) : null}

      {refreshPopupOpen && refreshPopupConfig.enabled ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.52)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              background: isDark ? '#111827' : '#ffffff',
              color: isDark ? '#f8fafc' : '#111111',
              borderRadius: 14,
              border: '1px solid var(--pubmail-border-color, #d1d5db)',
              padding: 18,
              boxShadow: '0 10px 30px rgba(0,0,0,0.25)'
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
              {refreshPopupConfig.title}
            </div>
            <div
              style={{
                fontSize: 14,
                color: isDark ? '#cbd5e1' : '#4b5563',
                marginBottom: 14,
                lineHeight: 1.4
              }}
            >
              {refreshPopupConfig.message}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                border: 'none',
                borderRadius: 10,
                padding: '10px 14px',
                background: 'var(--pubmail-primary, #2979ff)',
                color: theme.secondaryColor || '#ffffff',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {refreshPopupConfig.ctaLabel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
    </div>
  );
}
