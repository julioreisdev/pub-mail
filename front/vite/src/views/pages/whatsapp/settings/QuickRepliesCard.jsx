import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import {
  IconFile,
  IconMessageBolt,
  IconMicrophone,
  IconPaperclip,
  IconPencil,
  IconPlayerPlay,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash
} from '@tabler/icons-react';

import { get, post, put, remove } from 'api/api';
import { TgCard, TgConfirmDialog, TgModal } from 'views/pages/telegram/ui';
import WhatsAppMediaField from '../WhatsAppMediaField';
import { mediaKind, waButtonSx } from '../waKit';
import { SettingsCardHeader, WaBubble, WaWallpaper, WA_DARK, cardSx, errText, formatWa, insertAtCursor, plural } from './settingsKit';

// ============================================================================
// Card "Respostas rápidas": mensagens prontas que a equipe insere no chat
// digitando "/atalho". Texto com {{nome}}/{{telefone}} + anexo opcional.
// GET/POST/PUT/DELETE /whatsapp/quick-replies (cada escrita devolve a lista).
// ============================================================================

const TEXT_MAX = 4096;
const SAMPLE = { nome: 'Maria', telefone: '+55 (11) 99999-0000' };
const VARS = [
  { key: '{{nome}}', label: 'Nome do contato' },
  { key: '{{telefone}}', label: 'Telefone' }
];

// espelha o cleanShortcut do servidor (minúsculas, sem espaço, sem "/" no começo)
export const normalizeShortcut = (v) =>
  String(v || '')
    .trim()
    .replace(/^\/+/, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_\-à-ú]/gi, '')
    .slice(0, 40);

const fillVars = (text) => String(text || '').replace(/\{\{\s*(nome|telefone)\s*\}\}/gi, (m, k) => SAMPLE[k.toLowerCase()] ?? '');
const KIND_LABEL = { image: 'Imagem', video: 'Vídeo', voice: 'Áudio', document: 'Documento' };

function ShortcutChip({ shortcut }) {
  return (
    <Box
      component="span"
      sx={[
        {
          display: 'inline-block',
          flexShrink: 0,
          px: 0.9,
          py: 0.25,
          borderRadius: 1.25,
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: 12.5,
          fontWeight: 700,
          lineHeight: 1.5,
          color: WA_DARK,
          bgcolor: 'rgba(37,211,102,0.14)',
          border: '1px solid rgba(37,211,102,0.35)',
          whiteSpace: 'nowrap',
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        },
        (t) => t.applyStyles('dark', { color: '#5ee89a' })
      ]}
    >
      /{shortcut}
    </Box>
  );
}

function MediaThumb({ media }) {
  const kind = mediaKind(media);
  const Icon = kind === 'voice' ? IconMicrophone : kind === 'video' ? IconPlayerPlay : IconFile;
  return (
    <Tooltip title={`${KIND_LABEL[kind] || 'Arquivo'}${media?.filename ? ` · ${media.filename}` : ''}`}>
      <Box
        sx={{
          width: 48,
          height: 48,
          flexShrink: 0,
          borderRadius: 1.75,
          overflow: 'hidden',
          display: 'grid',
          placeItems: 'center',
          color: WA_DARK,
          bgcolor: 'rgba(37,211,102,0.12)',
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        {kind === 'image' && media?.url ? (
          <Box component="img" src={media.url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <Icon size={22} />
        )}
      </Box>
    </Tooltip>
  );
}

function ReplyRow({ item, onEdit, onDelete }) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="flex-start"
      onClick={() => onEdit(item)}
      sx={{
        p: 1.25,
        borderRadius: 2.5,
        border: '1px solid',
        borderColor: 'divider',
        cursor: 'pointer',
        transition: 'background-color .12s ease, border-color .12s ease',
        '&:hover': { bgcolor: 'action.hover', borderColor: 'rgba(37,211,102,0.45)' },
        '&:hover .qr-actions': { opacity: 1 }
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.4, minWidth: 0 }}>
          <ShortcutChip shortcut={item.shortcut} />
          {item.title ? (
            <Typography variant="body2" noWrap sx={{ fontWeight: 700, minWidth: 0 }}>
              {item.title}
            </Typography>
          ) : null}
          {item.media ? (
            <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary', flexShrink: 0 }}>
              <IconPaperclip size={14} />
            </Box>
          ) : null}
        </Stack>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-word',
            whiteSpace: 'pre-line',
            lineHeight: 1.45
          }}
        >
          {item.text ? formatWa(item.text) : item.media ? <em>Só o anexo, sem texto.</em> : ''}
        </Typography>
      </Box>
      {item.media ? <MediaThumb media={item.media} /> : null}
      <Stack
        direction="column"
        spacing={0.25}
        className="qr-actions"
        sx={{ opacity: { xs: 1, md: 0.55 }, transition: 'opacity .12s ease', mt: -0.5, mr: -0.5 }}
        onClick={(e) => e.stopPropagation()}
      >
        <Tooltip title="Editar">
          <IconButton size="small" onClick={() => onEdit(item)} aria-label="Editar resposta rápida">
            <IconPencil size={16} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Excluir">
          <IconButton
            size="small"
            onClick={() => onDelete(item)}
            aria-label="Excluir resposta rápida"
            sx={{ '&:hover': { color: 'error.main' } }}
          >
            <IconTrash size={16} />
          </IconButton>
        </Tooltip>
      </Stack>
    </Stack>
  );
}

// ----------------------------------------------------------------------------
// Modal criar/editar
// ----------------------------------------------------------------------------
const EMPTY = { id: null, shortcut: '', title: '', text: '', media: null };

function ReplyEditor({ open, initial, existing, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [shortcutErr, setShortcutErr] = useState('');
  const textRef = useRef(null);

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...EMPTY, ...initial, title: initial.title || '', text: initial.text || '' } : EMPTY);
      setShortcutErr('');
    }
  }, [open, initial]);

  const norm = normalizeShortcut(form.shortcut);
  const duplicate = norm && existing.some((r) => r.shortcut === norm && r.id !== form.id);
  const hasContent = Boolean(form.text.trim()) || Boolean(form.media?.id);
  const canSave = Boolean(norm) && !duplicate && hasContent && !saving;

  const insertVar = (v) => {
    const next = insertAtCursor(textRef.current, form.text, v, TEXT_MAX);
    setForm((f) => ({ ...f, text: next }));
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      let list;
      if (form.id) {
        const body = {};
        if (norm !== initial.shortcut) body.shortcut = norm;
        if ((form.title || '') !== (initial.title || '')) body.title = form.title.trim() || null;
        if ((form.text || '') !== (initial.text || '')) body.text = form.text;
        const was = initial.media?.id || null;
        const now = form.media?.id || null;
        if (was !== now) body.media_id = now;
        if (!Object.keys(body).length) {
          onClose();
          return;
        }
        list = await put(`/whatsapp/quick-replies/${form.id}`, body);
      } else {
        list = await post('/whatsapp/quick-replies', {
          shortcut: norm,
          title: form.title.trim() || undefined,
          text: form.text,
          media_id: form.media?.id || undefined
        });
      }
      onSaved(list, form.id ? 'Resposta rápida atualizada.' : `Resposta /${norm} criada.`);
    } catch (e) {
      const msg = errText(e, 'Não foi possível salvar.');
      if (/atalho/i.test(msg)) setShortcutErr(msg);
      else toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const shortcutHelper = shortcutErr
    ? shortcutErr
    : duplicate
      ? `Já existe uma resposta com /${norm}.`
      : norm
        ? null
        : 'Sem espaços. Ex.: boas-vindas, pix, horario';

  return (
    <TgModal
      open={open}
      onClose={() => !saving && onClose()}
      disableClose={saving}
      title={form.id ? 'Editar resposta rápida' : 'Nova resposta rápida'}
      subtitle="No chat, digite / e o atalho para inserir a resposta."
      maxWidth="md"
      footer={
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button onClick={onClose} disabled={saving} color="inherit">
            Cancelar
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={save}
            disabled={!canSave}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
            sx={waButtonSx}
          >
            {form.id ? 'Salvar alterações' : 'Criar resposta'}
          </Button>
        </Stack>
      }
    >
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.25fr) minmax(0, 1fr)' } }}>
        <Stack spacing={2}>
          <Box>
            <TextField
              label="Atalho"
              size="small"
              fullWidth
              autoFocus={!initial}
              value={form.shortcut}
              onChange={(e) => {
                setForm((f) => ({ ...f, shortcut: e.target.value.replace(/^\s*\/+/, '').slice(0, 60) }));
                setShortcutErr('');
              }}
              error={Boolean(shortcutErr) || Boolean(duplicate)}
              helperText={shortcutHelper}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start" sx={{ fontFamily: 'ui-monospace, Menlo, monospace', fontWeight: 800 }}>
                    /
                  </InputAdornment>
                )
              }}
              inputProps={{ style: { fontFamily: 'ui-monospace, Menlo, monospace' } }}
            />
            {norm ? (
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.75 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  No chat:
                </Typography>
                <ShortcutChip shortcut={norm} />
              </Stack>
            ) : null}
          </Box>
          <TextField
            label="Título (opcional)"
            size="small"
            fullWidth
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value.slice(0, 80) }))}
            helperText="Ajuda a achar a resposta na lista do chat."
          />
          <Box>
            <TextField
              label="Mensagem"
              fullWidth
              multiline
              minRows={5}
              maxRows={12}
              inputRef={textRef}
              value={form.text}
              onChange={(e) => setForm((f) => ({ ...f, text: e.target.value.slice(0, TEXT_MAX) }))}
              placeholder="Olá, {{nome}}! Obrigado pelo contato…"
              helperText={`${form.text.length}/${TEXT_MAX} · *negrito* _itálico_ ~riscado~`}
            />
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center" sx={{ mt: 0.75 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                Inserir variável:
              </Typography>
              {VARS.map((v) => (
                <Tooltip key={v.key} title={v.label}>
                  <Chip
                    size="small"
                    icon={<IconPlus size={13} />}
                    label={v.key}
                    onClick={() => insertVar(v.key)}
                    sx={{ fontWeight: 700, fontFamily: 'ui-monospace, Menlo, monospace' }}
                  />
                </Tooltip>
              ))}
            </Stack>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 0.75 }}>
              Anexo (opcional)
            </Typography>
            <WhatsAppMediaField
              value={form.media}
              onChange={(m) => setForm((f) => ({ ...f, media: m }))}
              kinds={['image', 'video', 'voice', 'document']}
              label="Anexar imagem, vídeo, áudio ou documento"
            />
          </Box>
        </Stack>

        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 0.75 }}>
            Prévia (com dados de exemplo)
          </Typography>
          <WaWallpaper minHeight={180} sx={{ position: { md: 'sticky' }, top: { md: 0 } }}>
            {hasContent ? (
              <Stack>
                <WaBubble text={fillVars(form.text)} media={form.media} />
              </Stack>
            ) : (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Escreva a mensagem ou adicione um anexo para ver a prévia.
              </Typography>
            )}
          </WaWallpaper>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
            {'{{nome}}'} vira o nome do contato e {'{{telefone}}'} o número dele na hora do envio.
          </Typography>
        </Box>
      </Box>
    </TgModal>
  );
}

// ----------------------------------------------------------------------------
export default function QuickRepliesCard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [editor, setEditor] = useState({ open: false, initial: null });
  const [confirm, setConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await get('/whatsapp/quick-replies');
      setItems(Array.isArray(r) ? r : []);
    } catch (e) {
      setError(errText(e, 'Não foi possível carregar as respostas rápidas.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/^\//, '');
    if (!s) return items;
    return items.filter((r) =>
      [r.shortcut, r.title, r.text].some((v) =>
        String(v || '')
          .toLowerCase()
          .includes(s)
      )
    );
  }, [items, q]);

  const openNew = () => setEditor({ open: true, initial: null });
  const openEdit = (item) => setEditor({ open: true, initial: item });

  const onSaved = (list, msg) => {
    if (Array.isArray(list)) setItems(list);
    setEditor({ open: false, initial: null });
    toast.success(msg);
  };

  const doDelete = async () => {
    if (!confirm) return;
    setDeleting(true);
    try {
      const list = await remove(`/whatsapp/quick-replies/${confirm.id}`);
      setItems(Array.isArray(list) ? list : (prev) => prev.filter((x) => x.id !== confirm.id));
      toast.success(`Resposta /${confirm.shortcut} excluída.`);
      setConfirm(null);
    } catch (e) {
      toast.error(errText(e, 'Não foi possível excluir.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <TgCard hover={false} sx={cardSx}>
      <SettingsCardHeader
        icon={IconMessageBolt}
        title="Respostas rápidas"
        stackAction
        subtitle="Mensagens prontas: digite / no chat para usar"
        action={
          !loading && !error && items.length ? (
            <Button variant="contained" disableElevation size="small" startIcon={<IconPlus size={16} />} onClick={openNew} sx={waButtonSx}>
              Nova resposta
            </Button>
          ) : null
        }
      />

      {loading ? (
        <Stack spacing={1}>
          {[0, 1, 2].map((i) => (
            <Box key={i} sx={{ p: 1.25, borderRadius: 2.5, border: '1px solid', borderColor: 'divider' }}>
              <Skeleton width={120} height={22} />
              <Skeleton width="90%" height={18} />
              <Skeleton width="60%" height={18} />
            </Box>
          ))}
        </Stack>
      ) : error ? (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              size="small"
              startIcon={<IconRefresh size={16} />}
              onClick={load}
              sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              Tentar de novo
            </Button>
          }
        >
          {error}
        </Alert>
      ) : items.length === 0 ? (
        <Box sx={{ flex: 1, display: 'grid', placeItems: 'center' }}>
          <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2.5, py: 4, px: 2, textAlign: 'center', width: '100%' }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                mx: 'auto',
                mb: 1.25,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                color: WA_DARK,
                bgcolor: 'rgba(37,211,102,0.14)'
              }}
            >
              <IconMessageBolt size={28} />
            </Box>
            <Typography sx={{ fontWeight: 700 }}>Nenhuma resposta rápida ainda</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 380, mx: 'auto', mt: 0.5, mb: 2 }}>
              Salve as mensagens que a equipe repete todo dia. No chat, basta digitar <strong>/</strong> e o atalho, por exemplo{' '}
              <strong>/boas-vindas</strong>, para inserir a resposta.
            </Typography>
            <Button variant="contained" disableElevation startIcon={<IconPlus size={18} />} onClick={openNew} sx={waButtonSx}>
              Criar a primeira resposta
            </Button>
          </Box>
        </Box>
      ) : (
        <>
          {items.length > 5 ? (
            <TextField
              size="small"
              fullWidth
              placeholder="Buscar por atalho, título ou texto"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              sx={{ mb: 1.25 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <IconSearch size={17} />
                  </InputAdornment>
                )
              }}
            />
          ) : null}
          {filtered.length ? (
            <Stack spacing={0.75} sx={{ maxHeight: 420, overflowY: 'auto', overscrollBehavior: 'contain', pr: 0.5, mr: -0.5 }}>
              {filtered.map((it) => (
                <ReplyRow key={it.id} item={it} onEdit={openEdit} onDelete={setConfirm} />
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary', py: 2, textAlign: 'center' }}>
              Nenhuma resposta encontrada para “{q}”.
            </Typography>
          )}
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1.25 }}>
            {plural(items.length, 'resposta', 'respostas')} · compartilhadas com toda a equipe da organização.
          </Typography>
        </>
      )}

      <ReplyEditor
        open={editor.open}
        initial={editor.initial}
        existing={items}
        onClose={() => setEditor({ open: false, initial: null })}
        onSaved={onSaved}
      />

      <TgConfirmDialog
        open={Boolean(confirm)}
        onClose={() => !deleting && setConfirm(null)}
        onConfirm={doDelete}
        danger
        loading={deleting}
        icon={IconTrash}
        title={`Excluir /${confirm?.shortcut || ''}?`}
        message="A resposta deixa de aparecer no chat para toda a equipe. Mensagens já enviadas com ela não mudam."
        confirmLabel="Excluir resposta"
      />
    </TgCard>
  );
}
