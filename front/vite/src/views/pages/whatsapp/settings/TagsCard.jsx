import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  Popover,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import {
  IconCheck,
  IconDeviceMobile,
  IconHourglass,
  IconLock,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconRobot,
  IconTags,
  IconTrash,
  IconUser,
  IconX
} from '@tabler/icons-react';

import { get, post, put, remove } from 'api/api';
import { TgCard, TgConfirmDialog } from 'views/pages/telegram/ui';
import { waButtonSx } from '../waKit';
import { SettingsCardHeader, cardSx, errText, plural } from './settingsKit';

// ============================================================================
// Card "Etiquetas": catálogo de etiquetas da org (cor + nome), com contagem
// de uso. Criar/renomear/trocar cor: qualquer usuário do módulo; excluir: só
// dono/admin (o back exige). Etiquetas automáticas são só explicadas aqui.
// ============================================================================

export const TAG_COLORS = ['#25D366', '#128C7E', '#34B7F1', '#7C3AED', '#F59E0B', '#EF4444', '#EC4899', '#64748B'];
const RESERVED = ['bot', 'aguardando', 'encerrado', 'celular'];
const NAME_MAX = 40;
const HEX_RE = /^#[0-9a-f]{6}$/i;

const AUTO_TAGS = [
  { icon: IconRobot, label: 'Bot', color: '#7C3AED', hint: 'O fluxo do bot está conduzindo a conversa.' },
  { icon: IconHourglass, label: 'Na fila', color: '#F59E0B', hint: 'O cliente está esperando um atendente.' },
  { icon: IconUser, label: 'Nome do atendente', color: '#25D366', hint: 'Quem assumiu a conversa no painel.' },
  { icon: IconDeviceMobile, label: 'Celular', color: '#64748B', hint: 'A conversa foi respondida direto pelo celular.' }
];

const validateName = (name) => {
  const n = String(name || '').trim();
  if (!n) return 'Dê um nome à etiqueta.';
  if (RESERVED.includes(n.toLowerCase())) return 'Esse nome é reservado para as etiquetas automáticas.';
  return '';
};

// ----------------------------------------------------------------------------
// Paleta: 8 cores + hex personalizado
// ----------------------------------------------------------------------------
function ColorPalette({ anchorEl, value, onClose, onPick }) {
  const [hex, setHex] = useState(value || '');
  useEffect(() => {
    if (anchorEl) setHex(value || '');
  }, [anchorEl, value]);
  const valid = HEX_RE.test(hex);
  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      slotProps={{ paper: { sx: { p: 1.5, borderRadius: 2.5, width: 232 } } }}
    >
      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1 }}>
        Cor da etiqueta
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, mb: 1.5 }}>
        {TAG_COLORS.map((c) => {
          const on = String(value || '').toLowerCase() === c.toLowerCase();
          return (
            <Box
              key={c}
              role="button"
              aria-label={`Cor ${c}`}
              tabIndex={0}
              onClick={() => onPick(c)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPick(c)}
              sx={{
                width: 36,
                height: 36,
                mx: 'auto',
                borderRadius: '50%',
                bgcolor: c,
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
                boxShadow: on ? (t) => `0 0 0 2px ${t.vars.palette.background.paper}, 0 0 0 4px ${c}` : 'none',
                transition: 'transform .12s ease',
                '&:hover': { transform: 'scale(1.08)' }
              }}
            >
              {on ? <IconCheck size={18} stroke={2.6} /> : null}
            </Box>
          );
        })}
      </Box>
      <Divider sx={{ mb: 1.25 }} />
      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.75 }}>
        Personalizada
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center">
        <Box
          component="label"
          sx={{
            position: 'relative',
            width: 34,
            height: 34,
            flexShrink: 0,
            borderRadius: 1.5,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: valid ? hex : 'transparent',
            backgroundImage: valid ? 'none' : 'conic-gradient(#EF4444, #F59E0B, #25D366, #34B7F1, #7C3AED, #EC4899, #EF4444)',
            cursor: 'pointer',
            overflow: 'hidden'
          }}
        >
          <input
            type="color"
            value={valid ? hex : '#25d366'}
            onChange={(e) => setHex(e.target.value)}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
            aria-label="Escolher cor"
          />
        </Box>
        <TextField
          size="small"
          value={hex}
          onChange={(e) => {
            let v = e.target.value.trim();
            if (v && !v.startsWith('#')) v = `#${v}`;
            setHex(v.slice(0, 7));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && valid) onPick(hex.toLowerCase());
          }}
          placeholder="#25d366"
          error={Boolean(hex) && !valid}
          inputProps={{ style: { fontFamily: 'ui-monospace, Menlo, monospace' }, 'aria-label': 'Cor em hexadecimal' }}
          sx={{ flex: 1 }}
        />
        <IconButton size="small" disabled={!valid} onClick={() => onPick(hex.toLowerCase())} aria-label="Aplicar cor">
          <IconCheck size={18} />
        </IconButton>
      </Stack>
    </Popover>
  );
}

function ColorDot({ color, onClick, disabled, size = 16, label = 'Trocar cor' }) {
  return (
    <Tooltip title={disabled ? '' : label}>
      <Box
        component="button"
        type="button"
        onClick={disabled ? undefined : onClick}
        aria-label={label}
        sx={{
          width: size + 12,
          height: size + 12,
          p: 0,
          border: 0,
          borderRadius: '50%',
          bgcolor: 'transparent',
          display: 'grid',
          placeItems: 'center',
          cursor: disabled ? 'default' : 'pointer',
          flexShrink: 0,
          '&:hover > span': disabled ? {} : { transform: 'scale(1.15)' }
        }}
      >
        <Box
          component="span"
          sx={{
            width: size,
            height: size,
            borderRadius: '50%',
            bgcolor: color,
            boxShadow: `0 0 0 3px ${color}33`,
            transition: 'transform .12s ease'
          }}
        />
      </Box>
    </Tooltip>
  );
}

// ----------------------------------------------------------------------------
function TagRow({ tag, canDelete, busy, onRename, onColor, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tag.name);
  const [err, setErr] = useState('');
  const committing = useRef(false);

  useEffect(() => {
    if (!editing) setName(tag.name);
  }, [tag.name, editing]);

  const commit = async () => {
    if (committing.current) return;
    const n = name.trim();
    if (n === tag.name) {
      setEditing(false);
      setErr('');
      return;
    }
    const v = validateName(n);
    if (v) {
      setErr(v);
      return;
    }
    committing.current = true;
    const ok = await onRename(tag, n);
    committing.current = false;
    if (ok) {
      setEditing(false);
      setErr('');
    }
  };
  const cancel = () => {
    setName(tag.name);
    setEditing(false);
    setErr('');
  };

  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      sx={{
        px: 1,
        py: 0.75,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        transition: 'background-color .12s ease',
        '&:hover': { bgcolor: 'action.hover' },
        '&:hover .tag-actions': { opacity: 1 }
      }}
    >
      <ColorDot color={tag.color} onClick={(e) => onColor(e.currentTarget, tag)} disabled={busy} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <TextField
            size="small"
            autoFocus
            fullWidth
            value={name}
            onChange={(e) => {
              setName(e.target.value.slice(0, NAME_MAX));
              setErr('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') cancel();
            }}
            onBlur={commit}
            error={Boolean(err)}
            helperText={err || undefined}
            disabled={busy}
            inputProps={{ 'aria-label': 'Nome da etiqueta' }}
            sx={{ '& .MuiInputBase-input': { py: 0.6 } }}
          />
        ) : (
          <Typography
            variant="body2"
            noWrap
            onDoubleClick={() => setEditing(true)}
            sx={{ fontWeight: 700, cursor: 'text' }}
            title="Clique duas vezes para renomear"
          >
            {tag.name}
          </Typography>
        )}
      </Box>
      {!editing ? (
        <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
          {plural(tag.count || 0, 'conversa', 'conversas')}
        </Typography>
      ) : null}
      {editing ? (
        <Stack direction="row" spacing={0.25}>
          <IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={commit} disabled={busy} aria-label="Salvar nome">
            {busy ? <CircularProgress size={16} /> : <IconCheck size={17} />}
          </IconButton>
          <IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={cancel} disabled={busy} aria-label="Cancelar">
            <IconX size={17} />
          </IconButton>
        </Stack>
      ) : (
        <Stack
          direction="row"
          spacing={0.25}
          className="tag-actions"
          sx={{ opacity: { xs: 1, md: 0.55 }, transition: 'opacity .12s ease' }}
        >
          <Tooltip title="Renomear">
            <IconButton size="small" onClick={() => setEditing(true)} disabled={busy} aria-label="Renomear etiqueta">
              <IconPencil size={16} />
            </IconButton>
          </Tooltip>
          {canDelete ? (
            <Tooltip title="Excluir">
              <IconButton
                size="small"
                onClick={() => onDelete(tag)}
                disabled={busy}
                aria-label="Excluir etiqueta"
                sx={{ '&:hover': { color: 'error.main' } }}
              >
                <IconTrash size={16} />
              </IconButton>
            </Tooltip>
          ) : null}
        </Stack>
      )}
    </Stack>
  );
}

// ----------------------------------------------------------------------------
export default function TagsCard({ canEdit }) {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [newTag, setNewTag] = useState({ name: '', color: TAG_COLORS[0], err: '' });
  const [creating, setCreating] = useState(false);
  const [palette, setPalette] = useState(null); // { el, target: 'new' | tag }
  const [confirm, setConfirm] = useState(null); // tag
  const [deleting, setDeleting] = useState(false);
  const colorTouched = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await get('/whatsapp/tags');
      setTags(Array.isArray(r) ? r : []);
    } catch (e) {
      setError(errText(e, 'Não foi possível carregar as etiquetas.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // sugere a próxima cor da paleta enquanto o usuário não escolher uma
  useEffect(() => {
    if (!colorTouched.current) setNewTag((t) => ({ ...t, color: TAG_COLORS[tags.length % TAG_COLORS.length] }));
  }, [tags.length]);

  const create = async () => {
    const v = validateName(newTag.name);
    if (v) {
      setNewTag((t) => ({ ...t, err: v }));
      return;
    }
    setCreating(true);
    try {
      const t = await post('/whatsapp/tags', { name: newTag.name.trim(), color: newTag.color });
      setTags((list) => [...list, { count: 0, ...t }]);
      colorTouched.current = false;
      setNewTag({ name: '', color: TAG_COLORS[(tags.length + 1) % TAG_COLORS.length], err: '' });
      toast.success(`Etiqueta “${t?.name || newTag.name.trim()}” criada.`);
    } catch (e) {
      setNewTag((t) => ({ ...t, err: errText(e, 'Não foi possível criar a etiqueta.') }));
    } finally {
      setCreating(false);
    }
  };

  const patch = async (tag, body) => {
    setBusyId(tag.id);
    try {
      const u = await put(`/whatsapp/tags/${tag.id}`, body);
      setTags((list) => list.map((x) => (x.id === tag.id ? { ...x, ...u, count: x.count } : x)));
      return true;
    } catch (e) {
      toast.error(errText(e, 'Não foi possível atualizar a etiqueta.'));
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const onRename = async (tag, name) => {
    const ok = await patch(tag, { name });
    if (ok) toast.success('Etiqueta renomeada.');
    return ok;
  };

  const pickColor = async (color) => {
    const target = palette?.target;
    setPalette(null);
    if (!target) return;
    if (target === 'new') {
      colorTouched.current = true;
      setNewTag((t) => ({ ...t, color }));
      return;
    }
    if (String(target.color).toLowerCase() !== color.toLowerCase()) await patch(target, { color });
  };

  const doDelete = async () => {
    const tag = confirm;
    if (!tag) return;
    setDeleting(true);
    try {
      const r = await remove(`/whatsapp/tags/${tag.id}`);
      setTags((list) => list.filter((x) => x.id !== tag.id));
      const n = Number(r?.removed_from) || 0;
      toast.success(n ? `Etiqueta excluída e retirada de ${plural(n, 'conversa', 'conversas')}.` : 'Etiqueta excluída.');
      setConfirm(null);
    } catch (e) {
      toast.error(errText(e, 'Não foi possível excluir a etiqueta.'));
    } finally {
      setDeleting(false);
    }
  };

  const confirmCount = Number(confirm?.count) || 0;

  return (
    <TgCard hover={false} sx={cardSx}>
      <SettingsCardHeader
        icon={IconTags}
        title="Etiquetas"
        subtitle="Organize as conversas por assunto, etapa ou prioridade"
        action={!loading && !error ? <Chip size="small" label={`${tags.length}/100`} sx={{ fontWeight: 700 }} /> : null}
      />

      {/* nova etiqueta */}
      <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1.5 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Nova etiqueta, ex.: Orçamento"
          value={newTag.name}
          onChange={(e) => setNewTag((t) => ({ ...t, name: e.target.value.slice(0, NAME_MAX), err: '' }))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') create();
          }}
          error={Boolean(newTag.err)}
          helperText={newTag.err || undefined}
          disabled={creating || loading || Boolean(error) || tags.length >= 100}
          inputProps={{ 'aria-label': 'Nome da nova etiqueta' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start" sx={{ ml: -1, mr: 0.25 }}>
                <ColorDot
                  color={newTag.color}
                  size={14}
                  label="Escolher cor"
                  onClick={(e) => setPalette({ el: e.currentTarget, target: 'new' })}
                />
              </InputAdornment>
            )
          }}
        />
        <Button
          variant="contained"
          disableElevation
          onClick={create}
          disabled={creating || !newTag.name.trim() || tags.length >= 100}
          startIcon={creating ? <CircularProgress size={16} color="inherit" /> : <IconPlus size={18} />}
          sx={{ ...waButtonSx, flexShrink: 0, height: 40 }}
        >
          Criar
        </Button>
      </Stack>

      {/* lista */}
      {loading ? (
        <Stack spacing={1}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={44} />
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
      ) : tags.length === 0 ? (
        <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2.5, py: 3, px: 2, textAlign: 'center' }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              mx: 'auto',
              mb: 1,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              color: '#128C7E',
              bgcolor: 'rgba(37,211,102,0.14)'
            }}
          >
            <IconTags size={24} />
          </Box>
          <Typography sx={{ fontWeight: 700 }}>Nenhuma etiqueta ainda</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 340, mx: 'auto' }}>
            Crie etiquetas como “Orçamento”, “Pós-venda” ou “VIP” e aplique nas conversas pelo chat.
          </Typography>
        </Box>
      ) : (
        <Stack spacing={0.75} sx={{ maxHeight: 316, overflowY: 'auto', overscrollBehavior: 'contain', pr: 0.5, mr: -0.5 }}>
          {tags.map((t) => (
            <TagRow
              key={t.id}
              tag={t}
              canDelete={canEdit}
              busy={busyId === t.id}
              onRename={onRename}
              onColor={(el, tag) => setPalette({ el, target: tag })}
              onDelete={(tag) => setConfirm(tag)}
            />
          ))}
        </Stack>
      )}

      {/* automáticas */}
      <Box sx={{ mt: 2, p: 1.5, borderRadius: 2.5, bgcolor: 'action.hover' }}>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
          <IconLock size={14} />
          <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase' }}>
            Etiquetas automáticas
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
          {AUTO_TAGS.map(({ icon: Icon, label, color, hint }) => (
            <Tooltip key={label} title={hint}>
              <Chip
                size="small"
                icon={<Icon size={14} />}
                label={label}
                variant="outlined"
                sx={{
                  fontWeight: 700,
                  borderColor: `${color}66`,
                  bgcolor: 'background.paper',
                  '& .MuiChip-icon': { color }
                }}
              />
            </Tooltip>
          ))}
        </Stack>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.5 }}>
          Aparecem sozinhas conforme a situação do atendimento e não podem ser editadas. Por isso, os nomes Bot, Aguardando, Encerrado e
          Celular são reservados.
        </Typography>
      </Box>

      {!canEdit && tags.length ? (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
          Só o dono ou um admin da organização exclui etiquetas.
        </Typography>
      ) : null}

      <ColorPalette
        anchorEl={palette?.el || null}
        value={palette?.target === 'new' ? newTag.color : palette?.target?.color}
        onClose={() => setPalette(null)}
        onPick={pickColor}
      />

      <TgConfirmDialog
        open={Boolean(confirm)}
        onClose={() => !deleting && setConfirm(null)}
        onConfirm={doDelete}
        danger
        loading={deleting}
        icon={IconTrash}
        title={`Excluir a etiqueta “${confirm?.name || ''}”?`}
        message={
          confirmCount
            ? `Ela será retirada de ${plural(confirmCount, 'conversa', 'conversas')} e sumirá dos filtros do chat. Essa ação não pode ser desfeita.`
            : 'Ela não está em nenhuma conversa. Essa ação não pode ser desfeita.'
        }
        confirmLabel="Excluir etiqueta"
      />
    </TgCard>
  );
}
