import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Tooltip,
  Typography
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import MainCard from 'ui-component/cards/MainCard';
import { get, patch } from '../../../api/api';
import { WEBCHAT_PRESETS } from './webchatPresets';
import {
  WEBCHAT_FONT_OPTIONS,
  WEBCHAT_FONT_SIZE_OPTIONS,
  WEBCHAT_DEFAULT_FONT,
  WEBCHAT_DEFAULT_FONT_SIZE,
  resolveFontStack,
  clampWebchatFontSize
} from './webchatFontCatalog';
import RichTextField, { sanitizeRichText } from './RichTextField';
import FunnelBuilder from './FunnelBuilder';
import { DEFAULT_FUNIL, normalizeFunil } from './funnel-utils';

// Dimensão fixa do preview (celular moderno tipo Pixel 7 / iPhone 14 Plus).
const PREVIEW_SIZE = { width: 412, height: 780 };

// Detecta se um valor parece HTML (tem tag) — usado para escapar legados em texto puro.
function looksLikeHtml(value) {
  return /<\/?[a-z][^>]*>/i.test(String(value || ''));
}

function escapeHtmlChars(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Devolve HTML seguro pronto para dangerouslySetInnerHTML. Aceita texto puro
// (faz escape) ou HTML rico (sanitiza).
function richHtmlForRender(value) {
  const source = String(value || '');
  if (!source.trim()) return '';
  return looksLikeHtml(source) ? sanitizeRichText(source) : escapeHtmlChars(source);
}

// Cor automática para o fundo dos botões — no tema WhatsApp usa o verde
// (primaryColor) com texto branco; nos demais usa um cinza sutil. O usuário
// pode sobrescrever pelo campo "Cor de fundo dos botões".
function resolveAutoQuickReplyBg(theme) {
  const isWhatsApp = String(theme?.layoutPreset || '').toLowerCase() === 'whatsapp';
  if (isWhatsApp) return theme?.primaryColor || '#075e54';
  const isDark = Boolean(theme?.darkMode);
  return isDark ? '#1f2a33' : '#f5f6f7';
}

function resolveQuickReplyBg(theme) {
  const explicit = String(theme?.quickReplyBgColor || '').trim();
  if (explicit) return explicit;
  return resolveAutoQuickReplyBg(theme);
}

const MAX_IMAGE_UPLOAD_FILE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_UPLOAD_DATA_URL_BYTES = 900 * 1024;
const MAX_IMAGE_UPLOAD_DIMENSION = 1280;

const DEFAULT_PERSONALIZACAO = {
  theme: {
    layoutPreset: 'bubble',
    primaryColor: '#2979ff',
    secondaryColor: '#ffffff',
    backgroundColor: '#f4f6fb',
    font: WEBCHAT_DEFAULT_FONT,
    fontSize: WEBCHAT_DEFAULT_FONT_SIZE,
    logoUrl: '',
    avatarUrl: '',
    darkMode: false,
    borderRadius: 18,
    bubbleShadow: true,
    backgroundImageUrl: '',
    userBubbleColor: '#2979ff',
    botBubbleColor: '#f1f0f0',
    quickReplyBgColor: ''
  },
  header: {
    show: true,
    text: 'Pub Mail',
    align: 'center',
    style: ''
  },
  quickReplies: [{ text: 'Quero saber mais!', href: '' }],
  welcomeMessages: ['Seja bem-vindo(a)!'],
  welcomeBotMessage: 'Seja bem-vindo(a)!',
  animation: {
    type: 'fade',
    duration: 400
  },
  placeholderInput: 'Digite sua mensagem...',
  botName: '',
  footerText: '',
  customCSS: '',
  legalPages: [],
  funil: DEFAULT_FUNIL
};

const getErrorMessage = (err, fallback = 'Falha ao processar a ação') =>
  err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function safeText(value) {
  return String(value ?? '').trim();
}

function safeInput(value) {
  return String(value ?? '');
}

function normalizeQuickReplyHref(value) {
  const href = safeText(value);
  if (!href) return '';
  const normalized = href.toLowerCase();
  if (normalized.startsWith('javascript:') || normalized.startsWith('data:')) return '';
  return href;
}

function toEditableQuickReplies(rawQuickReplies) {
  const source = Array.isArray(rawQuickReplies) ? rawQuickReplies : [];
  return source.map((item) => {
    if (typeof item === 'string') {
      return { text: safeInput(item), href: '', cssClass: '' };
    }

    const value = toObject(item);
    return {
      text: safeInput(value.text || value.label || value.title || value.nome),
      href: safeInput(value.href || value.url || value.link),
      cssClass: safeInput(value.cssClass)
    };
  });
}

function normalizeQuickRepliesList(rawQuickReplies) {
  const source = Array.isArray(rawQuickReplies) ? rawQuickReplies : [];
  const unique = [];
  const seen = new Set();

  source.forEach((item) => {
    const value = typeof item === 'string' ? { text: item } : toObject(item);
    const text = safeText(value.text || value.label || value.title || value.nome);
    if (!text) return;
    const href = normalizeQuickReplyHref(value.href || value.url || value.link);
    const cssClass = String(value.cssClass ?? '').slice(0, 200);
    const key = `${text.toLowerCase()}::${href.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    unique.push({ text, href, cssClass });
  });

  return unique;
}

function toEditableLegalPages(rawPages) {
  const source = Array.isArray(rawPages) ? rawPages : [];
  return source.map((item) => {
    const value = toObject(item);
    return {
      label: safeInput(value.label || value.text || value.title),
      href: safeInput(value.href || value.url || value.link)
    };
  });
}

function normalizeLegalPagesList(rawPages) {
  const source = Array.isArray(rawPages) ? rawPages : [];
  const out = [];
  source.forEach((item) => {
    const value = typeof item === 'string' ? { label: item } : toObject(item);
    const label = safeText(value.label || value.text || value.title);
    if (!label) return;
    const href = normalizeQuickReplyHref(value.href || value.url || value.link);
    out.push({ label: label.slice(0, 80), href });
  });
  return out;
}

function mergeDeep(target, source) {
  const base = toObject(target);
  const addon = toObject(source);
  const out = { ...base };

  Object.keys(addon).forEach((key) => {
    const sourceValue = addon[key];
    if (Array.isArray(sourceValue)) {
      out[key] = [...sourceValue];
      return;
    }
    if (sourceValue && typeof sourceValue === 'object') {
      out[key] = mergeDeep(toObject(base[key]), sourceValue);
      return;
    }
    out[key] = sourceValue;
  });

  return out;
}

// Normaliza welcomeMessages para array de strings não-vazias.
// Se array estiver vazio, usa welcomeBotMessage (legado) como fallback.
function normalizeWelcomeMessagesList(rawArray, legacySingle) {
  const source = Array.isArray(rawArray) ? rawArray : [];
  const cleaned = source
    .map((item) => safeInput(item))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (cleaned.length > 0) return cleaned;
  const fallback = safeInput(legacySingle).trim();
  return fallback ? [fallback] : [];
}

function normalizePersonalizacao(value) {
  const merged = mergeDeep(clone(DEFAULT_PERSONALIZACAO), toObject(value));
  const normalized = toObject(merged);
  normalized.quickReplies = normalizeQuickRepliesList(normalized.quickReplies);
  normalized.legalPages = normalizeLegalPagesList(normalized.legalPages);
  // Reconcilia welcomeMessages e welcomeBotMessage para retro-compat.
  const welcomeArray = normalizeWelcomeMessagesList(
    normalized.welcomeMessages,
    normalized.welcomeBotMessage
  );
  normalized.welcomeMessages = welcomeArray.length > 0 ? welcomeArray : ['Seja bem-vindo(a)!'];
  normalized.welcomeBotMessage = normalized.welcomeMessages[0] || '';
  if (Object.prototype.hasOwnProperty.call(normalized, 'welcomeScreen')) {
    delete normalized.welcomeScreen;
  }
  normalized.funil = normalizeFunil(normalized.funil);
  return normalized;
}

function estimateDataUrlBytes(dataUrl) {
  const base64 = String(dataUrl || '').split(',')[1] || '';
  const padding = (base64.match(/=+$/) || [''])[0].length;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Não foi possível processar a imagem selecionada.'));
    };
    image.src = objectUrl;
  });
}

function renderCompressedImage(image, mimeType, quality, maxDimension) {
  const width = Number(image?.naturalWidth || image?.width || 0);
  const height = Number(image?.naturalHeight || image?.height || 0);
  if (!width || !height) throw new Error('Imagem inválida para upload.');

  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível preparar a imagem para upload.');
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  return canvas.toDataURL(mimeType, quality);
}

async function readAsOptimizedImageDataUrl(file) {
  if (!String(file?.type || '').startsWith('image/')) {
    throw new Error('Selecione um arquivo de imagem válido.');
  }
  if (Number(file?.size || 0) > MAX_IMAGE_UPLOAD_FILE_BYTES) {
    throw new Error('Imagem muito grande. Use um arquivo de até 10MB.');
  }

  const image = await fileToImage(file);
  const attempts = [
    { quality: 0.82, maxDimension: MAX_IMAGE_UPLOAD_DIMENSION },
    { quality: 0.72, maxDimension: 1152 },
    { quality: 0.62, maxDimension: 1024 },
    { quality: 0.52, maxDimension: 900 }
  ];

  for (const attempt of attempts) {
    const webpDataUrl = renderCompressedImage(image, 'image/webp', attempt.quality, attempt.maxDimension);
    if (webpDataUrl.startsWith('data:image/webp') && estimateDataUrlBytes(webpDataUrl) <= MAX_IMAGE_UPLOAD_DATA_URL_BYTES) {
      return webpDataUrl;
    }

    const jpegDataUrl = renderCompressedImage(image, 'image/jpeg', attempt.quality, attempt.maxDimension);
    if (estimateDataUrlBytes(jpegDataUrl) <= MAX_IMAGE_UPLOAD_DATA_URL_BYTES) {
      return jpegDataUrl;
    }
  }

  throw new Error('Imagem muito pesada após compressão. Tente uma imagem menor.');
}

function parseInlineCss(styleText) {
  const raw = safeText(styleText);
  if (!raw) return {};

  return raw.split(';').reduce((acc, rule) => {
    const [prop, ...rest] = rule.split(':');
    if (!prop || rest.length === 0) return acc;
    const key = prop
      .trim()
      .replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const value = rest.join(':').trim();
    if (!key || !value) return acc;
    acc[key] = value;
    return acc;
  }, {});
}

function buildAnimationStyle(animation) {
  const cfg = toObject(animation);
  const type = safeText(cfg.type).toLowerCase();
  const duration = Number(cfg.duration) > 0 ? Number(cfg.duration) : 350;

  if (type === 'none' || !type) return {};
  if (type === 'slide') return { animation: `pubmail-slide-in ${duration}ms ease-out` };
  if (type === 'zoom') return { animation: `pubmail-zoom-in ${duration}ms ease-out` };
  return { animation: `pubmail-fade-in ${duration}ms ease-out` };
}

// Réplica da resolveLayoutStyles do PublicWebchat — usada pra que o
// preview do builder calcule bubbleRadius com a mesma fórmula do que o
// lead realmente vê (cada preset tem regras próprias).
function resolvePreviewLayoutStyles(layoutPreset, borderRadius) {
  const baseRadius = Number.isFinite(Number(borderRadius)) ? Number(borderRadius) : 18;
  const preset = safeInput(layoutPreset).toLowerCase();
  if (preset === 'flat') return { bubbleRadius: 10 };
  if (preset === 'ios') return { bubbleRadius: Math.max(baseRadius, 22) };
  if (preset === 'android') return { bubbleRadius: Math.max(baseRadius, 14) };
  if (preset === 'minimal') return { bubbleRadius: 8 };
  if (preset === 'whatsapp') return { bubbleRadius: Math.max(0, baseRadius) };
  return { bubbleRadius: Math.max(baseRadius, 12) };
}

function PreviewChat({ personalizacao }) {
  const theme = toObject(personalizacao.theme);
  const header = toObject(personalizacao.header);
  const animation = buildAnimationStyle(personalizacao.animation);
  const quickReplies = normalizeQuickRepliesList(personalizacao.quickReplies);
  // Mostra TODAS as quick replies configuradas (mesma regra do PublicWebchat).
  const previewQuickReplies = quickReplies;
  const isWhatsAppLayout = safeText(theme.layoutPreset).toLowerCase() === 'whatsapp';

  const previewSize = PREVIEW_SIZE;
  // Usa a mesma fórmula que o webchat público (resolveLayoutStyles): cada
  // layoutPreset (ios, flat, whatsapp, minimal, etc) tem regras próprias
  // pra bubbleRadius — antes o preview usava theme.borderRadius cru e
  // discordava do que o lead via.
  const layoutStyles = resolvePreviewLayoutStyles(theme.layoutPreset, theme.borderRadius);
  const bubbleRadius = layoutStyles.bubbleRadius;
  // tailRadius: canto "achatado" do bubble (lado do remetente). Mesma
  // lógica do PublicWebchat.
  const tailRadius = Math.min(
    bubbleRadius,
    isWhatsAppLayout ? 4 : Math.max(4, Math.floor(bubbleRadius / 3))
  );
  const showDark = Boolean(theme.darkMode);
  const textColor = isWhatsAppLayout ? (showDark ? '#e9edef' : '#111b21') : showDark ? '#f7f7f7' : '#111111';
  // Cores: theme.X sempre vence; defaults só preenchem quando user não setou.
  // Mesma regra do applyThemeVariables no PublicWebchat — antes os defaults
  // eram hardcoded para WhatsApp e ignoravam o usuário.
  const chatBackgroundColor =
    theme.backgroundColor ||
    (isWhatsAppLayout ? (showDark ? '#0b141a' : '#efeae2') : showDark ? '#101522' : '#f4f6fb');
  const chatBackgroundImage = theme.backgroundImageUrl
    ? `url(${theme.backgroundImageUrl})`
    : isWhatsAppLayout
      ? showDark
        ? 'radial-gradient(circle at 20% 20%, rgba(134,150,160,0.08) 0 1.2px, transparent 1.3px), radial-gradient(circle at 80% 80%, rgba(134,150,160,0.06) 0 1px, transparent 1.2px)'
        : 'radial-gradient(circle at 20% 20%, rgba(7,94,84,0.08) 0 1.2px, transparent 1.3px), radial-gradient(circle at 80% 80%, rgba(7,94,84,0.06) 0 1px, transparent 1.2px)'
      : 'none';
  const headerBgColor =
    isWhatsAppLayout
      ? (showDark ? '#202c33' : (theme.primaryColor || '#075e54'))
      : (showDark ? '#101522' : '#ffffff');
  const userBubbleColor =
    theme.userBubbleColor ||
    (isWhatsAppLayout ? (showDark ? '#005c4b' : '#d9fdd3') : theme.primaryColor || '#2979ff');
  const botBubbleColor =
    theme.botBubbleColor ||
    (isWhatsAppLayout ? (showDark ? '#202c33' : '#ffffff') : '#f1f0f0');
  const title = safeText(header.text) || safeText(personalizacao.botName) || 'Pub Mail';
  const avatarSource = safeText(theme.avatarUrl) || safeText(theme.logoUrl);
  const fontStack = resolveFontStack(theme.font);
  const fontSize = clampWebchatFontSize(theme.fontSize);
  // Proporções derivadas do fontSize base — header, bubbles e footer escalam juntos.
  const titleSize = Math.round(fontSize + 2);          // 17 quando base 15
  const onlineSize = Math.round(fontSize - 2);         // 13
  const bubbleSize = fontSize;
  const quickReplySize = Math.max(12, fontSize - 1);
  const inputSize = Math.max(14, fontSize);
  const avatarSize = isWhatsAppLayout ? 44 : 38;
  const sendBtnSize = isWhatsAppLayout ? 46 : 'auto';

  return (
    <Card
      sx={{
        p: 2,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.default'
      }}
    >
      <Box
        sx={{
          mx: 'auto',
          width: previewSize.width,
          maxWidth: '100%',
          height: previewSize.height,
          borderRadius: 4,
          border: '2px solid',
          borderColor: 'divider',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: showDark ? '#101522' : '#ffffff',
          color: textColor,
          fontFamily: fontStack,
          fontSize,
          position: 'relative'
        }}
      >
        <style>
          {`
            @keyframes pubmail-fade-in { from { opacity: 0; } to { opacity: 1; } }
            @keyframes pubmail-slide-in { from { transform: translateY(14px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            @keyframes pubmail-zoom-in { from { transform: scale(.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }
          `}
        </style>

        {header.show ? (
          <Box
            sx={{
              px: isWhatsAppLayout ? 2 : 2.25,
              py: isWhatsAppLayout ? 1.4 : 1.6,
              borderBottom: '1px solid',
              borderColor: isWhatsAppLayout ? (showDark ? '#2a3942' : '#0f6a5f') : showDark ? '#243042' : '#e5e7eb',
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              justifyContent: isWhatsAppLayout ? 'flex-start' : header.align || 'center',
              bgcolor: headerBgColor,
              color: isWhatsAppLayout ? '#ffffff' : textColor,
              ...(parseInlineCss(header.style) || {})
            }}
          >
            {isWhatsAppLayout ? (
              <>
                {avatarSource ? (
                  <Box
                    component="img"
                    src={avatarSource}
                    alt="Avatar"
                    sx={{
                      width: avatarSize,
                      height: avatarSize,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      bgcolor: '#dfe5e7'
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: avatarSize,
                      height: avatarSize,
                      borderRadius: '50%',
                      bgcolor: '#dfe5e7',
                      color: '#1f2c34',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: titleSize
                    }}
                  >
                    {(safeText(title).charAt(0) || 'I').toUpperCase()}
                  </Box>
                )}
                <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                  <Stack direction="row" spacing={0.8} alignItems="center">
                    <Typography
                      sx={{ fontWeight: 700, color: '#ffffff', fontSize: titleSize, lineHeight: 1.15, maxWidth: 200 }}
                      noWrap
                    >
                      {title}
                    </Typography>
                    <Box
                      sx={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        bgcolor: '#53bdeb',
                        color: '#ffffff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 900
                      }}
                    >
                      ✓
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={0.7} alignItems="center">
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#25d366' }} />
                    <Typography sx={{ fontSize: onlineSize, color: '#d1f4ed', lineHeight: 1.1 }}>online</Typography>
                  </Stack>
                </Box>
              </>
            ) : (
              <>
                {theme.logoUrl ? (
                  <Box
                    component="img"
                    src={theme.logoUrl}
                    alt="Logo"
                    sx={{ width: avatarSize, height: avatarSize, borderRadius: 2, objectFit: 'cover' }}
                  />
                ) : null}
                <Typography sx={{ fontWeight: 800, fontSize: titleSize, color: theme.primaryColor || '#2979ff' }}>
                  {title}
                </Typography>
                {theme.avatarUrl ? (
                  <Box
                    component="img"
                    src={theme.avatarUrl}
                    alt="Avatar"
                    sx={{ width: avatarSize, height: avatarSize, borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : null}
              </>
            )}
          </Box>
        ) : null}

        <Box
          sx={{
            flex: 1,
            px: 1.5,
            py: 1.5,
            bgcolor: chatBackgroundColor,
            backgroundImage: chatBackgroundImage,
            backgroundSize: isWhatsAppLayout && !theme.backgroundImageUrl ? '28px 28px' : 'cover',
            backgroundRepeat: isWhatsAppLayout && !theme.backgroundImageUrl ? 'repeat' : 'no-repeat',
            backgroundPosition: 'center',
            overflowY: 'auto',
            position: 'relative'
          }}
        >
          <Stack spacing={1.4}>
            {(() => {
              // Quando o funil está habilitado, o preview mostra a primeira
              // sequência (mensagens + opções) ao invés das boas-vindas + QR.
              // Sem animação de typing — apenas o estado final pra dar a ideia.
              const funil = personalizacao.funil;
              const funilOn = funil?.enabled === true && funil?.startSequenceId
                && funil?.sequences?.[funil.startSequenceId];
              if (funilOn) {
                const startSeq = funil.sequences[funil.startSequenceId];
                const messages = Array.isArray(startSeq.messages) ? startSeq.messages : [];
                const ending = startSeq.ending || { type: 'end' };
                const previewOptions = ending.type === 'options'
                  ? (ending.options || []).filter((o) => o?.label?.trim())
                  : [];
                return (
                  <Box sx={{ ...animation, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1.2 }}>
                    <Box
                      sx={{
                        alignSelf: 'flex-start',
                        bgcolor: showDark ? '#1f2a33' : '#fff5e0',
                        color: showDark ? '#ffd28a' : '#7a4a00',
                        px: 1,
                        py: 0.4,
                        borderRadius: 1,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: 0.4,
                      }}
                    >
                      ▶ Funil — {startSeq.name || 'Sequência inicial'}
                    </Box>
                    {messages.length === 0 ? (
                      <Box
                        sx={{
                          alignSelf: 'flex-start',
                          maxWidth: '82%',
                          px: 1.75,
                          py: 1.25,
                          borderRadius: `${bubbleRadius}px`,
                          borderBottomLeftRadius: `${tailRadius}px`,
                          bgcolor: botBubbleColor,
                          color: textColor,
                          fontSize: bubbleSize,
                          fontStyle: 'italic',
                          opacity: 0.7,
                        }}
                      >
                        Esta sequência ainda não tem mensagens.
                      </Box>
                    ) : (
                      messages.map((msg, mIdx) => (
                        <Box
                          key={`funnel-msg-${msg.id || mIdx}`}
                          sx={{
                            alignSelf: 'flex-start',
                            maxWidth: '82%',
                            px: msg.type === 'image' || msg.type === 'audio' ? 0.5 : 1.75,
                            py: msg.type === 'image' || msg.type === 'audio' ? 0.5 : 1.25,
                            borderRadius: `${bubbleRadius}px`,
                            borderBottomLeftRadius: `${tailRadius}px`,
                            bgcolor: botBubbleColor,
                            border: isWhatsAppLayout
                              ? `1px solid ${showDark ? '#2a3942' : '#e5e8eb'}`
                              : `1px solid ${(theme.primaryColor || '#2979ff')}22`,
                            color: textColor,
                            fontSize: bubbleSize,
                            lineHeight: 1.45,
                            boxShadow: theme.bubbleShadow ? (isWhatsAppLayout ? '0 1px 1px #00000022' : '0 2px 10px #00000022') : 'none',
                            overflow: 'hidden',
                          }}
                        >
                          {msg.type === 'image' && msg.dataUrl ? (
                            <>
                              {/* eslint-disable-next-line jsx-a11y/alt-text */}
                              <img
                                src={msg.dataUrl}
                                style={{ maxWidth: '100%', maxHeight: 180, display: 'block', borderRadius: 8 }}
                              />
                              {msg.caption ? (
                                <Box sx={{ p: 0.75, fontSize: 12 }}>{safeInput(msg.caption)}</Box>
                              ) : null}
                            </>
                          ) : msg.type === 'audio' && msg.dataUrl ? (
                            <audio controls src={msg.dataUrl} style={{ width: 220, display: 'block' }} />
                          ) : msg.type === 'image' || msg.type === 'audio' ? (
                            <Box sx={{ p: 1.25, fontStyle: 'italic', opacity: 0.6, fontSize: 12 }}>
                              [{msg.type === 'image' ? 'Imagem' : 'Áudio'} sem mídia]
                            </Box>
                          ) : (
                            <Box
                              dangerouslySetInnerHTML={{
                                __html: richHtmlForRender(msg.html || '') || escapeHtmlChars(msg.html || ''),
                              }}
                            />
                          )}
                        </Box>
                      ))
                    )}

                    {previewOptions.length > 0 ? (
                      <Stack direction="column" spacing={1} alignItems="stretch" sx={{ mt: 0.5, width: '100%' }}>
                        {previewOptions.map((opt, optIdx) => (
                          <Box
                            key={`funnel-opt-${opt.id || optIdx}`}
                            component="button"
                            type="button"
                            sx={{
                              border: isWhatsAppLayout
                                ? '1px solid transparent'
                                : `1px solid ${theme.primaryColor || '#2979ff'}`,
                              bgcolor: resolveQuickReplyBg(theme),
                              color: isWhatsAppLayout ? '#ffffff' : theme.primaryColor || '#1d4ed8',
                              px: 2.25,
                              py: 1.5,
                              borderRadius: '999px',
                              fontSize: quickReplySize,
                              fontWeight: 600,
                              lineHeight: 1.4,
                              textAlign: 'center',
                              width: '100%',
                              boxSizing: 'border-box',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                              cursor: 'default',
                            }}
                            dangerouslySetInnerHTML={{
                              __html: richHtmlForRender(opt.label),
                            }}
                          />
                        ))}
                      </Stack>
                    ) : ending.type === 'wait_input' ? (
                      <Box
                        sx={{
                          alignSelf: 'flex-start',
                          fontSize: 11,
                          color: showDark ? '#7a8c98' : '#5b6b78',
                          fontStyle: 'italic',
                          mt: 0.5,
                        }}
                      >
                        ⌨️ Esperando resposta digitada
                        {ending.captureVariable ? ` → {{${ending.captureVariable}}}` : ''}
                      </Box>
                    ) : ending.type === 'end' ? (
                      <Box
                        sx={{
                          alignSelf: 'flex-start',
                          fontSize: 11,
                          color: showDark ? '#7a8c98' : '#5b6b78',
                          fontStyle: 'italic',
                          mt: 0.5,
                        }}
                      >
                        🏁 Esta sequência encerra o funil
                      </Box>
                    ) : null}
                  </Box>
                );
              }

              // Modo híbrido: render padrão (welcome + quick replies)
              return (
                <Box sx={{ ...animation, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1.2 }}>
                  {(() => {
                    const welcomes = (() => {
                      const arr = Array.isArray(personalizacao.welcomeMessages) ? personalizacao.welcomeMessages : [];
                      const cleaned = arr
                        .map((m) => safeInput(m))
                        .filter((m) => m.trim().length > 0);
                      if (cleaned.length > 0) return cleaned;
                      const legacy = safeInput(personalizacao.welcomeBotMessage).trim();
                      return legacy ? [legacy] : ['Seja bem-vindo(a)!'];
                    })();
                    return welcomes.map((wText, wIdx) => (
                      <Box
                        key={`welcome-bubble-${wIdx}`}
                        sx={{
                          alignSelf: 'flex-start',
                          maxWidth: '82%',
                          px: 1.75,
                          py: 1.25,
                          borderRadius: `${bubbleRadius}px`,
                          borderBottomLeftRadius: `${tailRadius}px`,
                          bgcolor: botBubbleColor,
                          border: isWhatsAppLayout
                            ? `1px solid ${showDark ? '#2a3942' : '#e5e8eb'}`
                            : `1px solid ${(theme.primaryColor || '#2979ff')}22`,
                          color: textColor,
                          fontSize: bubbleSize,
                          lineHeight: 1.45,
                          boxShadow: theme.bubbleShadow ? (isWhatsAppLayout ? '0 1px 1px #00000022' : '0 2px 10px #00000022') : 'none'
                        }}
                        dangerouslySetInnerHTML={{
                          __html: richHtmlForRender(wText) || escapeHtmlChars(wText)
                        }}
                      />
                    ));
                  })()}

                  {previewQuickReplies.length > 0 ? (
                    <Stack direction="column" spacing={1} alignItems="stretch" sx={{ width: '100%' }}>
                      {previewQuickReplies.map((item, index) => (
                        <Box
                          key={`${item.text}-${item.href}-${index}`}
                          component="button"
                          type="button"
                          sx={{
                            border: isWhatsAppLayout
                              ? '1px solid transparent'
                              : `1px solid ${theme.primaryColor || '#2979ff'}`,
                            bgcolor: resolveQuickReplyBg(theme),
                            color: isWhatsAppLayout ? '#ffffff' : theme.primaryColor || '#1d4ed8',
                            px: 2.25,
                            py: 1.5,
                            borderRadius: '999px',
                            fontSize: quickReplySize,
                            fontWeight: 600,
                            lineHeight: 1.4,
                            textAlign: 'center',
                            width: '100%',
                            boxSizing: 'border-box',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                            cursor: 'default'
                          }}
                          dangerouslySetInnerHTML={{ __html: richHtmlForRender(item.text) }}
                        />
                      ))}
                    </Stack>
                  ) : null}
                </Box>
              );
            })()}

          </Stack>
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: isWhatsAppLayout ? 1.2 : 1.4,
            borderTop: '1px solid',
            borderColor: showDark ? '#243042' : '#e5e7eb',
            bgcolor: showDark ? '#121a29' : '#ffffff'
          }}
        >
          <TextField
            size="small"
            fullWidth
            disabled
            placeholder={safeText(personalizacao.placeholderInput) || 'Digite sua mensagem...'}
            InputProps={{
              sx: {
                borderRadius: 99,
                bgcolor: showDark ? '#0f1626' : '#ffffff',
                fontSize: inputSize,
                py: 0.5,
                '& input': { py: 1.1, px: 1.25 }
              }
            }}
          />
          <Box
            sx={{
              width: sendBtnSize,
              height: sendBtnSize,
              minWidth: sendBtnSize,
              borderRadius: '50%',
              display: isWhatsAppLayout ? 'inline-flex' : 'none',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: '#25d366',
              color: '#075e54',
              fontSize: titleSize,
              fontWeight: 800,
              boxShadow: '0 2px 6px rgba(37, 211, 102, 0.45)'
            }}
          >
            ➤
          </Box>
        </Box>
        {safeText(personalizacao.footerText) ? (
          <Box sx={{ px: 1.5, pb: 1, bgcolor: showDark ? '#121a29' : '#ffffff' }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
              {personalizacao.footerText}
            </Typography>
          </Box>
        ) : null}
        {(() => {
          const pages = normalizeLegalPagesList(personalizacao.legalPages).filter((p) => p.href);
          if (pages.length === 0) return null;
          return (
            <Box
              sx={{
                px: 1.5,
                pb: 1,
                pt: 0.5,
                bgcolor: showDark ? '#121a29' : '#ffffff',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '4px 8px'
              }}
            >
              {pages.map((p, i) => (
                <Box key={`prev-legal-${i}`} component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                  {i > 0 ? (
                    <Box component="span" sx={{ color: 'text.disabled', fontSize: 11 }}>
                      ·
                    </Box>
                  ) : null}
                  <Box
                    component="a"
                    href={p.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ color: 'text.secondary', textDecoration: 'none', fontSize: 11, lineHeight: 1.3 }}
                  >
                    {p.label}
                  </Box>
                </Box>
              ))}
            </Box>
          );
        })()}
      </Box>
    </Card>
  );
}

// Memo'd: PreviewChat só re-renderiza se personalizacao mudar de
// referência. Sem isso, cada troca de aba re-renderizava o preview
// inteiro (parse de imagens, fontes, etc) → travamento perceptível.
const PreviewChatMemo = memo(PreviewChat);

export default function WebchatBuilder() {
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const [tab, setTab] = useState('theme');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [webchat, setWebchat] = useState(null);
  const [settings, setSettings] = useState({});
  const [personalizacao, setPersonalizacao] = useState(clone(DEFAULT_PERSONALIZACAO));
  const [selectedPresetId, setSelectedPresetId] = useState('custom');
  const [funnelModalOpen, setFunnelModalOpen] = useState(false);
  // Auto-save: marca quando foi o último save bem-sucedido + hash do
  // estado salvo. O effect de auto-save dispara periodicamente e só
  // salva se o estado mudou (evita PATCH inúteis).
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState(null);
  const lastSavedHashRef = useRef('');
  const autoSavingRef = useRef(false);

  // Estabiliza onChange do FunnelBuilder pra que o React.memo dele não
  // re-renderize ReactFlow inteiro a cada keystroke em outras abas.
  const handleFunnelChange = useCallback((nextFunil) => {
    setPersonalizacao((prev) => ({ ...prev, funil: nextFunil }));
  }, []);

  // Estado local string pro input de borderRadius — evita bugs com
  // controlled-number TextField (ex: digitação intermediária com value=""
  // disparava Number("" || 18) = 18 e atrapalhava o valor que o user
  // realmente queria). Comita só no blur, com clamp 0-40.
  const [borderRadiusInput, setBorderRadiusInput] = useState(
    String(personalizacao?.theme?.borderRadius ?? 18),
  );
  useEffect(() => {
    const current = personalizacao?.theme?.borderRadius;
    if (current !== undefined && current !== null) {
      setBorderRadiusInput(String(current));
    }
  }, [personalizacao?.theme?.borderRadius]);
  const commitBorderRadius = () => {
    const n = parseInt(borderRadiusInput, 10);
    const clamped = Number.isFinite(n) ? Math.min(40, Math.max(0, n)) : 18;
    setBorderRadiusInput(String(clamped));
    if (clamped !== Number(personalizacao?.theme?.borderRadius)) {
      setPersonalizacao((prev) => ({
        ...prev,
        theme: { ...toObject(prev.theme), borderRadius: clamped },
      }));
    }
  };

  const quickReplies = useMemo(
    () => toEditableQuickReplies(personalizacao.quickReplies),
    [personalizacao.quickReplies]
  );

  const legalPages = useMemo(
    () => toEditableLegalPages(personalizacao.legalPages),
    [personalizacao.legalPages]
  );

  const loadWebchat = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const data = await get(`/webchats/${id}`);
      const loadedSettings = toObject(data?.settings);
      const loadedPersonalizacao = toObject(loadedSettings.personalizacao);
      const merged = normalizePersonalizacao(loadedPersonalizacao);
      const webchatName = safeText(data?.name || data?.nome);
      const agentName = safeText(
        data?.agentes_ia?.name ||
          data?.agent?.name ||
          data?.agente?.name ||
          data?.agente?.nome
      );
      const loadedHeader = toObject(loadedPersonalizacao.header);

      if (webchatName && !safeText(loadedHeader.text)) {
        merged.header = {
          ...toObject(merged.header),
          text: webchatName
        };
      }

      if (agentName && !safeText(loadedPersonalizacao.botName)) {
        merged.botName = agentName;
      }
      setWebchat(data);
      setSettings(loadedSettings);
      setPersonalizacao(merged);
      setSelectedPresetId('custom');
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar o builder.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadWebchat();
  }, [loadWebchat]);

  const updateSectionField = (section, field, value) => {
    setPersonalizacao((prev) => ({
      ...prev,
      [section]: {
        ...toObject(prev[section]),
        [field]: value
      }
    }));
  };

  const updateRootField = (field, value) => {
    setPersonalizacao((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  // ===== Welcome messages (array) =====
  const getWelcomeList = (prev) => {
    const arr = Array.isArray(prev?.welcomeMessages) ? prev.welcomeMessages : [];
    if (arr.length === 0) {
      const legacy = safeInput(prev?.welcomeBotMessage);
      return legacy ? [legacy] : [''];
    }
    return arr.map((item) => safeInput(item));
  };

  const handleWelcomeMessageChange = (index, value) => {
    setPersonalizacao((prev) => {
      const list = getWelcomeList(prev);
      list[index] = value;
      return {
        ...prev,
        welcomeMessages: list,
        welcomeBotMessage: list[0] || ''
      };
    });
  };

  const handleAddWelcomeMessage = () => {
    setPersonalizacao((prev) => {
      const list = getWelcomeList(prev);
      list.push('');
      return { ...prev, welcomeMessages: list, welcomeBotMessage: list[0] || '' };
    });
  };

  const handleRemoveWelcomeMessage = (index) => {
    setPersonalizacao((prev) => {
      const list = getWelcomeList(prev);
      if (list.length <= 1) return prev; // mantém pelo menos uma
      list.splice(index, 1);
      return { ...prev, welcomeMessages: list, welcomeBotMessage: list[0] || '' };
    });
  };

  const handleMoveWelcomeMessage = (index, direction) => {
    setPersonalizacao((prev) => {
      const list = getWelcomeList(prev);
      const next = index + direction;
      if (next < 0 || next >= list.length) return prev;
      const tmp = list[index];
      list[index] = list[next];
      list[next] = tmp;
      return { ...prev, welcomeMessages: list, welcomeBotMessage: list[0] || '' };
    });
  };

  const moveQuickReply = (index, direction) => {
    setPersonalizacao((prev) => {
      const list = toEditableQuickReplies(prev.quickReplies);
      const next = index + direction;
      if (next < 0 || next >= list.length) return prev;
      const temp = list[index];
      list[index] = list[next];
      list[next] = temp;
      return { ...prev, quickReplies: list };
    });
  };

  const handleAddQuickReply = () => {
    setPersonalizacao((prev) => ({
      ...prev,
      quickReplies: [...toEditableQuickReplies(prev.quickReplies), { text: '', href: '', cssClass: '' }]
    }));
  };

  const handleRemoveQuickReply = (index) => {
    setPersonalizacao((prev) => {
      const list = toEditableQuickReplies(prev.quickReplies);
      list.splice(index, 1);
      return { ...prev, quickReplies: list };
    });
  };

  const handleQuickReplyText = (index, value) => {
    setPersonalizacao((prev) => {
      const list = toEditableQuickReplies(prev.quickReplies);
      const current = toObject(list[index]);
      list[index] = { ...current, text: value };
      return { ...prev, quickReplies: list };
    });
  };

  const handleQuickReplyLink = (index, value) => {
    setPersonalizacao((prev) => {
      const list = toEditableQuickReplies(prev.quickReplies);
      const current = toObject(list[index]);
      list[index] = { ...current, href: value };
      return { ...prev, quickReplies: list };
    });
  };

  const handleQuickReplyClass = (index, value) => {
    setPersonalizacao((prev) => {
      const list = toEditableQuickReplies(prev.quickReplies);
      const current = toObject(list[index]);
      list[index] = { ...current, cssClass: value };
      return { ...prev, quickReplies: list };
    });
  };

  const moveLegalPage = (index, direction) => {
    setPersonalizacao((prev) => {
      const list = toEditableLegalPages(prev.legalPages);
      const next = index + direction;
      if (next < 0 || next >= list.length) return prev;
      const temp = list[index];
      list[index] = list[next];
      list[next] = temp;
      return { ...prev, legalPages: list };
    });
  };

  const handleAddLegalPage = () => {
    setPersonalizacao((prev) => ({
      ...prev,
      legalPages: [...toEditableLegalPages(prev.legalPages), { label: '', href: '' }]
    }));
  };

  const handleRemoveLegalPage = (index) => {
    setPersonalizacao((prev) => {
      const list = toEditableLegalPages(prev.legalPages);
      list.splice(index, 1);
      return { ...prev, legalPages: list };
    });
  };

  const handleLegalPageLabel = (index, value) => {
    setPersonalizacao((prev) => {
      const list = toEditableLegalPages(prev.legalPages);
      const current = toObject(list[index]);
      list[index] = { ...current, label: value };
      return { ...prev, legalPages: list };
    });
  };

  const handleLegalPageHref = (index, value) => {
    setPersonalizacao((prev) => {
      const list = toEditableLegalPages(prev.legalPages);
      const current = toObject(list[index]);
      list[index] = { ...current, href: value };
      return { ...prev, legalPages: list };
    });
  };

  const handleApplyPreset = (presetId) => {
    const preset = WEBCHAT_PRESETS.find((item) => item.id === presetId);
    setSelectedPresetId(presetId);
    if (!preset) return;
    setPersonalizacao((prev) => normalizePersonalizacao(mergeDeep(clone(prev), clone(preset.personalizacao))));
  };

  const handleExportPreset = () => {
    const json = JSON.stringify(personalizacao, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `webchat-preset-${id || 'custom'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportPreset = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const imported = normalizePersonalizacao(parsed);
      setPersonalizacao(imported);
      setSelectedPresetId('custom');
      setError('');
    } catch {
      setError('Preset inválido. Envie um JSON válido.');
    } finally {
      event.target.value = '';
    }
  };

  const handleImageUpload = async (field, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readAsOptimizedImageDataUrl(file);
      updateSectionField('theme', field, dataUrl);
      setSelectedPresetId('custom');
      setError('');
    } catch (err) {
      setError(err?.message || 'Não foi possível processar a imagem selecionada.');
    } finally {
      event.target.value = '';
    }
  };

  // Compute do payload de save — usado tanto pelo handleSave manual
  // quanto pelo auto-save. Centraliza o commit do borderRadius (state
  // local) e a normalização da personalização.
  const buildSavePayload = useCallback(() => {
    const parsedBR = parseInt(borderRadiusInput, 10);
    const clampedBR = Number.isFinite(parsedBR)
      ? Math.min(40, Math.max(0, parsedBR))
      : Number(personalizacao?.theme?.borderRadius ?? 18);
    const personalizacaoToSave = {
      ...personalizacao,
      theme: { ...toObject(personalizacao.theme), borderRadius: clampedBR },
    };
    const nextSettings = {
      ...toObject(settings),
      personalizacao: normalizePersonalizacao(personalizacaoToSave),
    };
    return { personalizacaoToSave, nextSettings, clampedBR };
  }, [borderRadiusInput, personalizacao, settings]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const { personalizacaoToSave, nextSettings, clampedBR } = buildSavePayload();
      await patch(`/webchats/${id}`, { settings: nextSettings });
      setSettings(nextSettings);
      setPersonalizacao(personalizacaoToSave);
      setBorderRadiusInput(String(clampedBR));
      lastSavedHashRef.current = JSON.stringify(nextSettings.personalizacao);
      setLastAutoSavedAt(new Date());
      setSuccess('Builder salvo com sucesso.');
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível salvar o builder.'));
    } finally {
      setSaving(false);
    }
  };

  // Auto-save: a cada 60s, verifica se o estado mudou desde o último
  // save e dispara um PATCH silencioso (sem alert verde). Funciona
  // mesmo com o modal do funil aberto — toda mudança em personalizacao
  // (incluindo dentro do funil) é coberta. Ignora se já está salvando
  // ou se nada mudou.
  useEffect(() => {
    if (!id) return undefined;
    const interval = window.setInterval(async () => {
      if (autoSavingRef.current || saving) return;
      try {
        const { personalizacaoToSave, nextSettings, clampedBR } = buildSavePayload();
        const currentHash = JSON.stringify(nextSettings.personalizacao);
        if (currentHash === lastSavedHashRef.current) return;
        autoSavingRef.current = true;
        await patch(`/webchats/${id}`, { settings: nextSettings });
        lastSavedHashRef.current = currentHash;
        setSettings(nextSettings);
        setPersonalizacao(personalizacaoToSave);
        setBorderRadiusInput(String(clampedBR));
        setLastAutoSavedAt(new Date());
      } catch {
        // Auto-save é silencioso por design — falhou? user vê próximo
        // tick ou ao clicar em Salvar manualmente.
      } finally {
        autoSavingRef.current = false;
      }
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [id, saving, buildSavePayload]);

  // Inicializa hash ao carregar (assim auto-save não dispara antes da
  // primeira edição real do user).
  useEffect(() => {
    if (!loading && personalizacao && !lastSavedHashRef.current) {
      try {
        lastSavedHashRef.current = JSON.stringify(
          normalizePersonalizacao(personalizacao),
        );
      } catch {
        /* ignore */
      }
    }
  }, [loading, personalizacao]);

  if (loading) {
    return (
      <Box sx={{ minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
        <CircularProgress size={22} />
        <Typography>Carregando builder...</Typography>
      </Box>
    );
  }

  if (!webchat) {
    return (
      <Box sx={{ maxWidth: 640, mx: 'auto', mt: 3 }}>
        <Alert severity="warning">Webchat não encontrado.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <MainCard
        content={false}
        sx={{
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden'
        }}
      >
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Tooltip title="Voltar para Webchats">
            <IconButton size="small" onClick={() => navigate('/webchat/webchats')}>
              <ArrowBackRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Typography variant="h4" sx={{ fontWeight: 900 }}>
            Builder do Webchat
          </Typography>
          <Chip label={webchat?.name || 'Sem nome'} size="small" sx={{ borderRadius: 2, fontWeight: 800 }} />

          <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<DownloadRoundedIcon fontSize="small" />}
              onClick={handleExportPreset}
            >
              Exportar preset
            </Button>

            <Button size="small" variant="outlined" component="label" startIcon={<UploadFileRoundedIcon fontSize="small" />}>
              Importar preset
              <input hidden type="file" accept="application/json" onChange={handleImportPreset} />
            </Button>

            {lastAutoSavedAt ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: { xs: 'none', sm: 'inline-flex' }, alignItems: 'center', whiteSpace: 'nowrap' }}
              >
                Salvo automaticamente às {lastAutoSavedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </Typography>
            ) : null}

            <Button
              size="small"
              variant="contained"
              color="secondary"
              startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveRoundedIcon fontSize="small" />}
              disabled={saving}
              onClick={handleSave}
            >
              Salvar
            </Button>
          </Box>
        </Box>

        <Divider />

        <Box sx={{ p: 2 }}>
          <Stack spacing={1.25}>
            {error ? (
              <Alert severity="error" onClose={() => setError('')}>
                {error}
              </Alert>
            ) : null}
            {success ? (
              <Alert severity="success" onClose={() => setSuccess('')}>
                {success}
              </Alert>
            ) : null}
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 2 }}>
            <Box sx={{ flex: 1.2, minWidth: 0 }}>
              <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', p: 1.5, mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>
                  Presets
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {WEBCHAT_PRESETS.map((preset) => (
                    <Chip
                      key={preset.id}
                      onClick={() => handleApplyPreset(preset.id)}
                      clickable
                      label={`${preset.icon} ${preset.name}`}
                      color={selectedPresetId === preset.id ? 'secondary' : 'default'}
                      variant={selectedPresetId === preset.id ? 'filled' : 'outlined'}
                      sx={{ borderRadius: 2, fontWeight: 800 }}
                    />
                  ))}
                  <Chip
                    clickable
                    onClick={() => setSelectedPresetId('custom')}
                    label="🎨 Customizado"
                    color={selectedPresetId === 'custom' ? 'secondary' : 'default'}
                    variant={selectedPresetId === 'custom' ? 'filled' : 'outlined'}
                    sx={{ borderRadius: 2, fontWeight: 800 }}
                  />
                </Stack>
              </Card>

              <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', p: 2 }}>
                <Tabs
                  value={tab}
                  onChange={(_, next) => setTab(next)}
                  variant="scrollable"
                  allowScrollButtonsMobile
                  sx={{ mb: 2 }}
                >
                  <Tab value="theme" label="Aparência" />
                  <Tab value="header" label="Cabeçalho" />
                  <Tab value="bot" label="Bot/Texto" />
                  <Tab value="quick" label="Botões" />
                  <Tab value="funnel" label="Funil" />
                  <Tab value="animation" label="Animação" />
                  <Tab value="legal" label="Páginas Legais" />
                </Tabs>

                {tab === 'theme' ? (
                  <Stack spacing={1.5}>
                    <TextField
                      select
                      label="Layout visual"
                      value={safeText(personalizacao?.theme?.layoutPreset) || 'bubble'}
                      onChange={(e) => updateSectionField('theme', 'layoutPreset', e.target.value)}
                    >
                      <MenuItem value="bubble">Bolha (padrão)</MenuItem>
                      <MenuItem value="flat">Flat / Material</MenuItem>
                      <MenuItem value="ios">iOS</MenuItem>
                      <MenuItem value="android">Android</MenuItem>
                      <MenuItem value="whatsapp">WhatsApp</MenuItem>
                      <MenuItem value="minimal">Minimalista</MenuItem>
                    </TextField>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                      <TextField
                        type="color"
                        label="Cor principal"
                        value={safeText(personalizacao?.theme?.primaryColor) || '#2979ff'}
                        onChange={(e) => updateSectionField('theme', 'primaryColor', e.target.value)}
                        sx={{ flex: 1 }}
                      />
                      <TextField
                        type="color"
                        label="Cor fundo"
                        value={safeText(personalizacao?.theme?.backgroundColor) || '#f4f6fb'}
                        onChange={(e) => updateSectionField('theme', 'backgroundColor', e.target.value)}
                        sx={{ flex: 1 }}
                      />
                    </Stack>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                      <TextField
                        type="color"
                        label="Bolha usuário"
                        value={safeText(personalizacao?.theme?.userBubbleColor) || '#2979ff'}
                        onChange={(e) => updateSectionField('theme', 'userBubbleColor', e.target.value)}
                        sx={{ flex: 1 }}
                      />
                      <TextField
                        type="color"
                        label="Bolha bot"
                        value={safeText(personalizacao?.theme?.botBubbleColor) || '#f1f0f0'}
                        onChange={(e) => updateSectionField('theme', 'botBubbleColor', e.target.value)}
                        sx={{ flex: 1 }}
                      />
                    </Stack>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems="center">
                      <TextField
                        type="color"
                        label="Cor de fundo dos botões"
                        value={
                          safeText(personalizacao?.theme?.quickReplyBgColor) ||
                          resolveAutoQuickReplyBg(personalizacao?.theme)
                        }
                        onChange={(e) => updateSectionField('theme', 'quickReplyBgColor', e.target.value)}
                        sx={{ flex: 1 }}
                        helperText="Por padrão um tom levemente diferente da bolha do bot."
                      />
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => updateSectionField('theme', 'quickReplyBgColor', '')}
                        disabled={!safeText(personalizacao?.theme?.quickReplyBgColor)}
                      >
                        Usar automático
                      </Button>
                    </Stack>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                      <TextField
                        select
                        label="Fonte"
                        value={
                          WEBCHAT_FONT_OPTIONS.some(
                            (f) => f.id.toLowerCase() === safeText(personalizacao?.theme?.font).toLowerCase()
                          )
                            ? safeText(personalizacao?.theme?.font)
                            : WEBCHAT_DEFAULT_FONT
                        }
                        onChange={(e) => updateSectionField('theme', 'font', e.target.value)}
                        sx={{ flex: 1 }}
                      >
                        {WEBCHAT_FONT_OPTIONS.map((opt) => (
                          <MenuItem key={opt.id} value={opt.id} sx={{ fontFamily: opt.stack }}>
                            {opt.label}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        select
                        label="Tamanho do texto"
                        value={clampWebchatFontSize(personalizacao?.theme?.fontSize)}
                        onChange={(e) =>
                          updateSectionField('theme', 'fontSize', clampWebchatFontSize(e.target.value))
                        }
                        sx={{ flex: 1 }}
                      >
                        {WEBCHAT_FONT_SIZE_OPTIONS.map((opt) => (
                          <MenuItem key={opt.id} value={opt.id}>
                            {opt.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Stack>

                    <TextField
                      type="number"
                      label="Arredondamento das mensagens (px)"
                      helperText="0 = mensagens quadradas. Vale para todos os temas, inclusive WhatsApp."
                      value={borderRadiusInput}
                      onChange={(e) => setBorderRadiusInput(e.target.value)}
                      onBlur={commitBorderRadius}
                      inputProps={{ min: 0, max: 40, step: 1 }}
                    />

                    <TextField
                      label="Imagem de fundo (URL)"
                      value={safeInput(personalizacao?.theme?.backgroundImageUrl)}
                      onChange={(e) => updateSectionField('theme', 'backgroundImageUrl', e.target.value)}
                      placeholder="https://..."
                    />

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                      <TextField
                        label="Logo (URL)"
                        value={safeInput(personalizacao?.theme?.logoUrl)}
                        onChange={(e) => updateSectionField('theme', 'logoUrl', e.target.value)}
                        sx={{ flex: 1 }}
                      />
                      <Button component="label" variant="outlined" startIcon={<UploadFileRoundedIcon />}>
                        Upload logo
                        <input hidden type="file" accept="image/*" onChange={(e) => handleImageUpload('logoUrl', e)} />
                      </Button>
                    </Stack>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                      <TextField
                        label="Avatar (URL)"
                        value={safeInput(personalizacao?.theme?.avatarUrl)}
                        onChange={(e) => updateSectionField('theme', 'avatarUrl', e.target.value)}
                        sx={{ flex: 1 }}
                      />
                      <Button component="label" variant="outlined" startIcon={<UploadFileRoundedIcon />}>
                        Upload avatar
                        <input hidden type="file" accept="image/*" onChange={(e) => handleImageUpload('avatarUrl', e)} />
                      </Button>
                    </Stack>

                    <Stack direction="row" spacing={1.5}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={Boolean(personalizacao?.theme?.bubbleShadow)}
                            onChange={(e) => updateSectionField('theme', 'bubbleShadow', e.target.checked)}
                          />
                        }
                        label="Sombra nas bolhas"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={Boolean(personalizacao?.theme?.darkMode)}
                            onChange={(e) => updateSectionField('theme', 'darkMode', e.target.checked)}
                          />
                        }
                        label="Modo escuro"
                      />
                    </Stack>
                  </Stack>
                ) : null}

                {tab === 'header' ? (
                  <Stack spacing={1.5}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={Boolean(personalizacao?.header?.show)}
                          onChange={(e) => updateSectionField('header', 'show', e.target.checked)}
                        />
                      }
                      label="Exibir cabeçalho"
                    />

                    <TextField
                      label="Texto do cabeçalho"
                      value={safeInput(personalizacao?.header?.text)}
                      onChange={(e) => updateSectionField('header', 'text', e.target.value)}
                    />

                    <TextField
                      select
                      label="Alinhamento"
                      value={safeText(personalizacao?.header?.align) || 'center'}
                      onChange={(e) => updateSectionField('header', 'align', e.target.value)}
                    >
                      <MenuItem value="left">Esquerda</MenuItem>
                      <MenuItem value="center">Centro</MenuItem>
                      <MenuItem value="right">Direita</MenuItem>
                    </TextField>

                    <TextField
                      label="CSS inline do cabeçalho (opcional)"
                      value={safeInput(personalizacao?.header?.style)}
                      onChange={(e) => updateSectionField('header', 'style', e.target.value)}
                      placeholder="color: #fff; letter-spacing: .03em;"
                    />
                  </Stack>
                ) : null}

                {tab === 'bot' ? (
                  <Stack spacing={1.5}>
                    <Stack spacing={1}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        Mensagens de boas-vindas
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Aparecerão uma de cada vez no chat público, com indicador de digitação entre elas.
                        A última mensagem recebe os botões.
                      </Typography>
                      {getWelcomeList(personalizacao).map((welcomeText, index, arr) => (
                        <Box
                          key={`welcome-${index}`}
                          sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 2,
                            p: 1.25,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 0.9,
                            bgcolor: 'background.paper'
                          }}
                        >
                          <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="space-between">
                            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                              Mensagem #{index + 1}
                            </Typography>
                            <Stack direction="row" spacing={0}>
                              <Tooltip title="Subir">
                                <span>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleMoveWelcomeMessage(index, -1)}
                                    disabled={index === 0}
                                  >
                                    <ArrowUpwardRoundedIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title="Descer">
                                <span>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleMoveWelcomeMessage(index, 1)}
                                    disabled={index === arr.length - 1}
                                  >
                                    <ArrowDownwardRoundedIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title={arr.length <= 1 ? 'É necessário pelo menos uma mensagem' : 'Remover'}>
                                <span>
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleRemoveWelcomeMessage(index)}
                                    disabled={arr.length <= 1}
                                  >
                                    <DeleteRoundedIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Stack>
                          </Stack>
                          <RichTextField
                            value={welcomeText}
                            onChange={(html) => handleWelcomeMessageChange(index, html)}
                            placeholder={`Mensagem de boas-vindas #${index + 1}`}
                            minHeight={64}
                          />
                        </Box>
                      ))}
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<AddRoundedIcon />}
                        onClick={handleAddWelcomeMessage}
                        sx={{ alignSelf: 'flex-start' }}
                      >
                        Adicionar mensagem
                      </Button>
                    </Stack>
                    <TextField
                      label="Nome do bot"
                      value={safeInput(personalizacao?.botName)}
                      onChange={(e) => updateRootField('botName', e.target.value)}
                    />
                    <TextField
                      label="Placeholder do input"
                      value={safeInput(personalizacao?.placeholderInput)}
                      onChange={(e) => updateRootField('placeholderInput', e.target.value)}
                    />
                    <TextField
                      label="Texto de rodapé (opcional)"
                      value={safeInput(personalizacao?.footerText)}
                      onChange={(e) => updateRootField('footerText', e.target.value)}
                    />
                    <TextField
                      label="CSS customizado (opcional)"
                      value={safeInput(personalizacao?.customCSS)}
                      onChange={(e) => updateRootField('customCSS', e.target.value)}
                      fullWidth
                      multiline
                      minRows={4}
                      helperText="Aplicado no webchat público. Use com cuidado."
                    />
                  </Stack>
                ) : null}

                {tab === 'quick' ? (
                  <Stack spacing={1.2}>
                    <Typography variant="caption" color="text.secondary">
                      No chat público, apenas 2 botões são exibidos por mensagem do bot, em ordem randômica. Link preenchido vira redirecionamento.
                    </Typography>
                    {quickReplies.map((reply, index) => (
                      <Box
                        key={`quick-${index}`}
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 2,
                          p: 1.25,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 0.9,
                          bgcolor: 'background.paper'
                        }}
                      >
                        <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="space-between">
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                            Botão #{index + 1}
                          </Typography>
                          <Stack direction="row" spacing={0}>
                            <Tooltip title="Subir">
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={() => moveQuickReply(index, -1)}
                                  disabled={index === 0}
                                >
                                  <ArrowUpwardRoundedIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Descer">
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={() => moveQuickReply(index, 1)}
                                  disabled={index === quickReplies.length - 1}
                                >
                                  <ArrowDownwardRoundedIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Remover">
                              <IconButton size="small" color="error" onClick={() => handleRemoveQuickReply(index)}>
                                <DeleteRoundedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </Stack>
                        <RichTextField
                          value={safeInput(reply.text)}
                          onChange={(html) => handleQuickReplyText(index, html)}
                          placeholder={`Texto do botão #${index + 1}`}
                          minHeight={44}
                        />
                        <TextField
                          fullWidth
                          size="small"
                          value={safeInput(reply.href)}
                          onChange={(e) => handleQuickReplyLink(index, e.target.value)}
                          placeholder="https://seu-link.com (opcional)"
                        />
                        <TextField
                          fullWidth
                          size="small"
                          value={safeInput(reply.cssClass)}
                          onChange={(e) => handleQuickReplyClass(index, e.target.value)}
                          placeholder="Classes CSS (opcional): ex. meu-botao destaque"
                        />
                      </Box>
                    ))}
                    <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={handleAddQuickReply}>
                      Adicionar botão
                    </Button>
                  </Stack>
                ) : null}

                {tab === 'funnel' ? (
                  <Stack spacing={2}>
                    <Alert severity={personalizacao.funil?.enabled ? 'warning' : 'info'} sx={{ py: 0.75 }}>
                      {personalizacao.funil?.enabled ? (
                        <>
                          <strong>Modo Funil ativo.</strong> A IA está desabilitada — todo o fluxo do chat será controlado pelo funil.
                          Mensagens de boas-vindas e botões configurados em outras abas são ignorados.
                        </>
                      ) : (
                        <>
                          O Construtor de Funil é uma alternativa opcional ao modo híbrido (boas-vindas + IA). Ative o toggle abaixo
                          para que o webchat siga 100% o fluxograma que você desenhar.
                        </>
                      )}
                    </Alert>

                    <FormControlLabel
                      control={
                        <Switch
                          checked={personalizacao.funil?.enabled === true}
                          onChange={(e) =>
                            setPersonalizacao((prev) => ({
                              ...prev,
                              funil: { ...(prev.funil || DEFAULT_FUNIL), enabled: e.target.checked },
                            }))
                          }
                        />
                      }
                      label="Habilitar Construtor de Funil"
                    />

                    <Box>
                      <Button
                        variant="contained"
                        size="large"
                        startIcon={<AccountTreeRoundedIcon />}
                        onClick={() => setFunnelModalOpen(true)}
                        disabled={!personalizacao.funil?.enabled}
                        sx={{ borderRadius: 2, fontWeight: 800 }}
                      >
                        Abrir construtor de funil
                      </Button>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                        Toda a edição (sequências, mensagens, botões, áudios) acontece no construtor em tela cheia. Suas alterações
                        são preservadas ao fechar — basta clicar em <strong>Salvar</strong> no rodapé do builder pra persistir.
                      </Typography>
                    </Box>

                    {personalizacao.funil?.enabled ? (
                      <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'background.default', border: '1px dashed', borderColor: 'divider' }}>
                        <Typography variant="caption" color="text.secondary">
                          Resumo: {Object.keys(personalizacao.funil.sequences || {}).length} sequência(s) cadastrada(s).
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Ative o toggle acima para liberar o botão.
                      </Typography>
                    )}
                  </Stack>
                ) : null}

                {/* Modal em tela cheia com o construtor de funil */}
                <Dialog
                  open={funnelModalOpen}
                  onClose={() => setFunnelModalOpen(false)}
                  fullScreen
                >
                  <AppBar position="sticky" color="default" elevation={1}>
                    <Toolbar sx={{ gap: 1 }}>
                      <AccountTreeRoundedIcon color="primary" />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                          Construtor de Funil
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          As alterações são salvas localmente. Clique em <strong>Salvar</strong> no builder para persistir.
                        </Typography>
                      </Box>
                      <Button
                        variant="contained"
                        onClick={() => setFunnelModalOpen(false)}
                        sx={{ borderRadius: 2, fontWeight: 700 }}
                      >
                        Concluir
                      </Button>
                      <IconButton aria-label="fechar" onClick={() => setFunnelModalOpen(false)}>
                        <CloseRoundedIcon />
                      </IconButton>
                    </Toolbar>
                  </AppBar>
                  <DialogContent sx={{ p: { xs: 1.5, md: 2.5 }, bgcolor: 'background.default', height: 'calc(100vh - 64px)' }}>
                    {personalizacao.funil?.enabled ? (
                      <FunnelBuilder
                        value={personalizacao.funil}
                        onChange={handleFunnelChange}
                        height="calc(100vh - 130px)"
                      />
                    ) : (
                      <Alert severity="info">
                        Ative o toggle &quot;Habilitar Construtor de Funil&quot; antes de editar.
                      </Alert>
                    )}
                  </DialogContent>
                </Dialog>

                {tab === 'animation' ? (
                  <Stack spacing={1.5}>
                    <TextField
                      select
                      label="Tipo de animação"
                      value={safeText(personalizacao?.animation?.type) || 'fade'}
                      onChange={(e) => updateSectionField('animation', 'type', e.target.value)}
                    >
                      <MenuItem value="fade">Fade</MenuItem>
                      <MenuItem value="slide">Slide</MenuItem>
                      <MenuItem value="zoom">Zoom</MenuItem>
                      <MenuItem value="none">Nenhuma</MenuItem>
                    </TextField>
                    <TextField
                      type="number"
                      label="Duração (ms)"
                      value={Number(personalizacao?.animation?.duration ?? 400)}
                      onChange={(e) => updateSectionField('animation', 'duration', Number(e.target.value || 400))}
                      inputProps={{ min: 0, max: 2500 }}
                    />
                  </Stack>
                ) : null}

                {tab === 'legal' ? (
                  <Stack spacing={1.5}>
                    <Typography variant="body2" color="text.secondary">
                      Links exibidos num rodapé discreto no fim do webchat (ex.: Política de Privacidade, Termos de Uso).
                    </Typography>
                    {legalPages.map((page, index) => (
                      <Box
                        key={`legal-${index}`}
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 2,
                          p: 1.25,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 0.9,
                          bgcolor: 'background.paper'
                        }}
                      >
                        <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="space-between">
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                            Página #{index + 1}
                          </Typography>
                          <Stack direction="row" spacing={0}>
                            <Tooltip title="Subir">
                              <span>
                                <IconButton size="small" onClick={() => moveLegalPage(index, -1)} disabled={index === 0}>
                                  <ArrowUpwardRoundedIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Descer">
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={() => moveLegalPage(index, 1)}
                                  disabled={index === legalPages.length - 1}
                                >
                                  <ArrowDownwardRoundedIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Remover">
                              <IconButton size="small" color="error" onClick={() => handleRemoveLegalPage(index)}>
                                <DeleteRoundedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </Stack>
                        <TextField
                          fullWidth
                          size="small"
                          label="Label"
                          value={safeInput(page.label)}
                          onChange={(e) => handleLegalPageLabel(index, e.target.value)}
                          placeholder="Ex.: Política de Privacidade"
                          inputProps={{ maxLength: 80 }}
                        />
                        <TextField
                          fullWidth
                          size="small"
                          label="Link"
                          value={safeInput(page.href)}
                          onChange={(e) => handleLegalPageHref(index, e.target.value)}
                          placeholder="https://..."
                        />
                      </Box>
                    ))}
                    <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={handleAddLegalPage}>
                      Adicionar página
                    </Button>
                  </Stack>
                ) : null}
              </Card>
            </Box>

            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center' }}>
              <PreviewChatMemo personalizacao={personalizacao} />
            </Box>
          </Stack>
        </Box>
      </MainCard>
    </Box>
  );
}
