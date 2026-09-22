import { useEffect, useRef, useState } from 'react';
import { Box, IconButton, Popover, Stack, Tooltip, Typography } from '@mui/material';
import { FormatBoldIcon as FormatBoldIcon } from 'ui-component/icons';
import { FormatItalicIcon as FormatItalicIcon } from 'ui-component/icons';
import { FormatUnderlinedIcon as FormatUnderlinedIcon } from 'ui-component/icons';
import { EmojiEmotionsRoundedIcon as EmojiEmotionsRoundedIcon } from 'ui-component/icons';

// Tags permitidas no HTML emitido. Tudo que não estiver aqui é "desempacotado"
// pelo sanitizer (filhos preservados, tag removida).
const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR']);

// Detecta formatação via style inline — alguns browsers (Safari, Edge antigo)
// implementam execCommand('bold') como `<span style="font-weight:bold">` em vez
// de `<b>`. Convertemos isso para tags semânticas antes do strip do whitelist.
const STYLE_FORMATS = [
  { tag: 'b', regex: /font-weight\s*:\s*(?:bold|bolder|[6-9]00)/i },
  { tag: 'i', regex: /font-style\s*:\s*italic/i },
  { tag: 'u', regex: /text-decoration[\w-]*\s*:[^;"]*\bunderline\b/i }
];

export function sanitizeRichText(unsafeHtml) {
  if (typeof document === 'undefined' || !unsafeHtml) return '';
  const wrapper = document.createElement('div');
  wrapper.innerHTML = String(unsafeHtml);

  // Pass 1: para cada elemento com `style`, se o estilo indica B/I/U,
  // envolve o conteúdo em tags semânticas e remove o elemento original.
  Array.from(wrapper.querySelectorAll('[style]')).forEach((el) => {
    if (!el.parentNode) return;
    const style = el.getAttribute('style') || '';
    let inner = el.innerHTML;
    let formatted = false;
    for (const fmt of STYLE_FORMATS) {
      if (fmt.regex.test(style)) {
        inner = `<${fmt.tag}>${inner}</${fmt.tag}>`;
        formatted = true;
      }
    }
    if (formatted) {
      // Substitui o elemento pelo conteúdo já envolto.
      el.outerHTML = inner;
    } else {
      // Sem formatação relevante — só remove o style; o pass 3 desempacota
      // se a tag não estiver no whitelist.
      el.removeAttribute('style');
    }
  });

  // Pass 2: <font color="..."> e similares legados são apenas formatação visual.
  // Não interessam — vão ser desempacotados no pass 3 normalmente.

  // Pass 3: whitelist — desempacota tags não permitidas, mantém filhos.
  const cleanNode = (node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) return;
      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.remove();
        return;
      }
      const tag = child.tagName.toUpperCase();
      if (ALLOWED_TAGS.has(tag)) {
        Array.from(child.attributes).forEach((a) => child.removeAttribute(a.name));
        cleanNode(child);
      } else {
        cleanNode(child);
        const parent = child.parentNode;
        while (child.firstChild) parent.insertBefore(child.firstChild, child);
        parent.removeChild(child);
      }
    });
  };

  cleanNode(wrapper);
  return wrapper.innerHTML;
}

// Emojis curados — os mais usados em chat (8 colunas).
const EMOJI_LIST = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
  '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
  '😘', '😋', '😛', '😜', '🤪', '🤨', '🧐', '🤓',
  '😎', '🤩', '🥳', '😏', '🥺', '😢', '😭', '😤',
  '🤔', '🤗', '🤭', '🤫', '🤥', '🥱', '😴', '😵',
  '🙏', '🤝', '👍', '👎', '👌', '✌️', '🤞', '👏',
  '💪', '🫶', '🫡', '🙌', '🤲', '👋', '🖐️', '✋',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🤍', '🖤',
  '💯', '🔥', '⭐', '✨', '🎉', '🎊', '🎁', '🎈',
  '✅', '❌', '⚠️', '📌', '📩', '📞', '💬', '🚀'
];

/**
 * Mini editor de texto rico com B/I/U e emoji picker.
 * - value/onChange controlam HTML sanitizado
 * - aceita texto puro como valor inicial (vai ser exibido como texto)
 * - placeholder via prop
 */
export default function RichTextField({
  value = '',
  onChange,
  placeholder = '',
  label = '',
  helperText = '',
  minHeight = 56,
  fullWidth = true,
  ariaLabel
}) {
  const editorRef = useRef(null);
  // Sentinel `null` garante que o primeiro useEffect sempre sincroniza o DOM
  // com o valor inicial (caso contrário, ref e value coincidem no mount e o
  // editor ficaria vazio mesmo com valor já salvo).
  const lastEmittedRef = useRef(null);
  const emojiBtnRef = useRef(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Sincroniza valor externo com o DOM apenas quando há diferença real
  // (evita resetar o caret a cada keystroke).
  useEffect(() => {
    if (!editorRef.current) return;
    const incoming = String(value || '');
    if (incoming !== lastEmittedRef.current) {
      editorRef.current.innerHTML = incoming;
      lastEmittedRef.current = incoming;
    }
  }, [value]);

  // Garante que execCommand use tags semânticas (<b>, <i>, <u>) em vez de
  // <span style="...">.
  useEffect(() => {
    try {
      document.execCommand('styleWithCSS', false, false);
    } catch {
      // Browsers que não suportam — ignora, o sanitizer cuida do resto.
    }
  }, []);

  const emit = () => {
    if (!editorRef.current || typeof onChange !== 'function') return;
    const html = sanitizeRichText(editorRef.current.innerHTML);
    lastEmittedRef.current = html;
    onChange(html);
  };

  const runCommand = (command) => {
    editorRef.current?.focus();
    document.execCommand(command, false);
    emit();
  };

  const insertEmoji = (emoji) => {
    editorRef.current?.focus();
    // Se o editor já não está focado, podemos perder o caret. Usa execCommand
    // para inserir no ponto do caret (compatível com texto + tags).
    const inserted = document.execCommand('insertText', false, emoji);
    if (!inserted) {
      // Fallback: append no final.
      editorRef.current.innerHTML = (editorRef.current.innerHTML || '') + emoji;
    }
    setEmojiOpen(false);
    emit();
  };

  const isEmpty = !String(value || '').trim();

  return (
    <Box sx={{ width: fullWidth ? '100%' : 'auto' }}>
      {label ? (
        <Typography
          variant="caption"
          sx={{ display: 'block', mb: 0.5, color: 'text.secondary', fontWeight: 600 }}
        >
          {label}
        </Typography>
      ) : null}
      <Box
        sx={{
          border: '1px solid',
          borderColor: isFocused ? 'primary.main' : 'divider',
          borderRadius: 2,
          bgcolor: 'background.paper',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          boxShadow: isFocused ? `0 0 0 3px rgba(55, 126, 240, 0.15)` : 'none',
          overflow: 'hidden'
        }}
      >
        <Stack
          direction="row"
          spacing={0.25}
          sx={{
            px: 0.5,
            py: 0.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: 'action.hover'
          }}
          alignItems="center"
        >
          <Tooltip title="Negrito (Ctrl+B)">
            <IconButton
              size="small"
              onMouseDown={(e) => {
                e.preventDefault();
                runCommand('bold');
              }}
              aria-label="Negrito"
            >
              <FormatBoldIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Itálico (Ctrl+I)">
            <IconButton
              size="small"
              onMouseDown={(e) => {
                e.preventDefault();
                runCommand('italic');
              }}
              aria-label="Itálico"
            >
              <FormatItalicIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Sublinhado (Ctrl+U)">
            <IconButton
              size="small"
              onMouseDown={(e) => {
                e.preventDefault();
                runCommand('underline');
              }}
              aria-label="Sublinhado"
            >
              <FormatUnderlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Inserir emoji">
            <IconButton
              ref={emojiBtnRef}
              size="small"
              onMouseDown={(e) => {
                e.preventDefault();
                setEmojiOpen(true);
              }}
              aria-label="Inserir emoji"
            >
              <EmojiEmotionsRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
        <Box
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onPaste={(e) => {
            // Cola apenas texto puro — evita estilos vindos de fora.
            e.preventDefault();
            const text = e.clipboardData.getData('text/plain');
            document.execCommand('insertText', false, text);
            emit();
          }}
          aria-label={ariaLabel || label || placeholder || 'Editor de texto'}
          sx={{
            minHeight,
            px: 1.5,
            py: 1,
            outline: 'none',
            fontSize: 14,
            lineHeight: 1.5,
            wordBreak: 'break-word',
            position: 'relative',
            '&:empty::before': {
              content: `"${placeholder.replace(/"/g, '\\"')}"`,
              color: 'text.disabled',
              pointerEvents: 'none'
            }
          }}
        />
      </Box>
      {helperText ? (
        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
          {helperText}
        </Typography>
      ) : null}
      <Popover
        open={emojiOpen}
        anchorEl={emojiBtnRef.current}
        onClose={() => setEmojiOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box
          sx={{
            p: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(8, 1fr)',
            gap: 0.25,
            maxWidth: 320
          }}
        >
          {EMOJI_LIST.map((emoji) => (
            <IconButton
              key={emoji}
              size="small"
              onClick={() => insertEmoji(emoji)}
              sx={{ fontSize: 20, width: 32, height: 32 }}
              aria-label={`Inserir ${emoji}`}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>{emoji}</span>
            </IconButton>
          ))}
        </Box>
      </Popover>
      {/* Garantia visual: se valor está vazio mas o foco já passou, ainda mostra placeholder via &:empty::before
          O isEmpty é só para garantir que mantemos o tamanho mínimo */}
      {isEmpty && !isFocused ? null : null}
    </Box>
  );
}
