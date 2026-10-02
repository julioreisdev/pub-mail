import { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { IconBolt, IconFileText, IconMicrophone, IconPhoto, IconSettings, IconVideo } from '@tabler/icons-react';

import { tint } from '../waShared';
import { ACTIVE_FG, THIN_SCROLL, fold } from './chatKit';

// ============================================================================
// Respostas rápidas no composer: "/" no início do campo (ou o botão ⚡) abre a
// lista; ↑/↓ navegam, Enter/Tab inserem, Esc fecha. Nada é enviado sozinho.
// ============================================================================

export function filterQuickReplies(list, query) {
  const items = Array.isArray(list) ? list : [];
  const f = fold(String(query || '').trim());
  if (!f) return items;
  const score = (r) => {
    const s = fold(r.shortcut);
    if (s === f) return 0;
    if (s.startsWith(f)) return 1;
    if (s.includes(f)) return 2;
    return 3;
  };
  return items
    .filter((r) => fold(r.shortcut).includes(f) || fold(r.title).includes(f) || fold(r.text).includes(f))
    .sort((a, b) => score(a) - score(b));
}

export function fillQuickReply(text, { name, phone }) {
  return String(text || '')
    .replace(/\{\{\s*nome\s*\}\}/gi, name || '')
    .replace(/\{\{\s*telefone\s*\}\}/gi, phone || '');
}

export const quickMediaKind = (m) => {
  if (!m) return null;
  const k = String(m.kind || '').toLowerCase();
  const mime = String(m.mime || m.mimetype || '');
  if (k === 'image' || mime.startsWith('image/')) return 'image';
  if (k === 'video' || mime.startsWith('video/')) return 'video';
  if (k === 'voice') return 'voice';
  if (k === 'audio' || mime.startsWith('audio/')) return 'audio';
  return 'document';
};

const MEDIA_META = {
  image: { icon: IconPhoto, label: 'Imagem' },
  video: { icon: IconVideo, label: 'Vídeo' },
  voice: { icon: IconMicrophone, label: 'Áudio' },
  audio: { icon: IconMicrophone, label: 'Áudio' },
  document: { icon: IconFileText, label: 'Arquivo' }
};
export const quickMediaMeta = (m) => MEDIA_META[quickMediaKind(m)] || MEDIA_META.document;

export function QuickRepliesPopper({ anchorEl, open, items, total, loading, index, query, onHover, onPick, onClose, onManage }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(`[data-qr-index="${index}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [open, index]);

  const width = anchorEl?.clientWidth ? Math.min(560, Math.max(280, anchorEl.clientWidth)) : 360;

  return (
    <Popper
      open={Boolean(open && anchorEl)}
      anchorEl={anchorEl}
      placement="top-start"
      modifiers={[{ name: 'offset', options: { offset: [0, 8] } }]}
      sx={{ zIndex: (t) => t.zIndex.modal + 1 }}
    >
      <ClickAwayListener onClickAway={onClose}>
        <Paper elevation={8} sx={{ width, maxWidth: 'calc(100vw - 24px)', borderRadius: 2.5, overflow: 'hidden' }}>
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.75}
            sx={{ px: 1.5, py: 0.9, borderBottom: '1px solid', borderColor: 'divider' }}
          >
            <Box sx={[ACTIVE_FG, { display: 'grid', placeItems: 'center' }]}>
              <IconBolt size={16} />
            </Box>
            <Typography variant="caption" sx={{ fontWeight: 800, flex: 1 }}>
              Respostas rápidas
              {query ? (
                <Box component="span" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  {' '}
                  · /{query}
                </Box>
              ) : null}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11, display: { xs: 'none', sm: 'block' } }}>
              ↑↓ navegar · Enter inserir · Esc fechar
            </Typography>
          </Stack>
          <Box ref={listRef} sx={[THIN_SCROLL, { maxHeight: 290, overflowY: 'auto', py: 0.5 }]}>
            {loading && !total ? (
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ py: 2.5, color: 'text.secondary' }}>
                <CircularProgress size={16} sx={{ color: 'inherit' }} />
                <Typography variant="body2">Carregando respostas…</Typography>
              </Stack>
            ) : !total ? (
              <Stack alignItems="center" spacing={1} sx={{ py: 2.25, px: 2, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Nenhuma resposta rápida cadastrada ainda.
                </Typography>
                <Button
                  size="small"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={onManage}
                  startIcon={<IconSettings size={15} />}
                  sx={[{ fontWeight: 700, textTransform: 'none' }, ACTIVE_FG]}
                >
                  Cadastrar em Configurações
                </Button>
              </Stack>
            ) : items.length === 0 ? (
              <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 2.25, px: 2 }}>
                Nenhum atalho encontrado para “/{query}”.
              </Typography>
            ) : (
              items.map((r, i) => {
                const on = i === index;
                const mm = r.media ? quickMediaMeta(r.media) : null;
                return (
                  <Stack
                    key={r.id}
                    data-qr-index={i}
                    direction="row"
                    spacing={1.25}
                    alignItems="flex-start"
                    onMouseEnter={() => onHover(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onPick(r)}
                    sx={{
                      mx: 0.5,
                      px: 1.25,
                      py: 0.9,
                      borderRadius: 1.75,
                      cursor: 'pointer',
                      bgcolor: on ? (t) => tint(t, 'success', 0.12) : 'transparent'
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={0.75} alignItems="baseline" sx={{ minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          sx={[ACTIVE_FG, { fontWeight: 800, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5, flexShrink: 0 }]}
                        >
                          /{r.shortcut}
                        </Typography>
                        {r.title ? (
                          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                            {r.title}
                          </Typography>
                        ) : null}
                      </Stack>
                      {r.text ? (
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.15 }} noWrap>
                          {r.text}
                        </Typography>
                      ) : null}
                    </Box>
                    {mm ? (
                      <Stack
                        direction="row"
                        spacing={0.4}
                        alignItems="center"
                        sx={{
                          flexShrink: 0,
                          mt: 0.2,
                          px: 0.75,
                          height: 20,
                          borderRadius: 10,
                          fontSize: 10.5,
                          fontWeight: 800,
                          color: 'text.secondary',
                          bgcolor: 'action.hover'
                        }}
                      >
                        <mm.icon size={12} />
                        <span>{mm.label}</span>
                      </Stack>
                    ) : null}
                  </Stack>
                );
              })
            )}
          </Box>
        </Paper>
      </ClickAwayListener>
    </Popper>
  );
}
