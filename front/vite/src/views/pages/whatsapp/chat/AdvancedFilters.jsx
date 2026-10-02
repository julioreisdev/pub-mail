import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import ListSubheader from '@mui/material/ListSubheader';
import MenuItem from '@mui/material/MenuItem';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { IconAdjustmentsHorizontal, IconFilterOff, IconX } from '@tabler/icons-react';

import { WA_DARK, WA_GREEN, tint, startOfDay } from '../waShared';
import { ACTIVE_FG, THIN_SCROLL, safeColor } from './chatKit';

// ============================================================================
// Filtros avançados da lista de conversas (etiquetas, atendimento, atendente,
// sem resposta, período). Persistidos no navegador; combinam com o chip ativo.
// ============================================================================
export const ADV_KEY = 'wa-chat-adv-filters';
export const ADV_DEFAULT = Object.freeze({ tags: [], tagsMode: 'any', service: '', assigned: '', noReply: 0, period: '' });

export const SERVICE_OPTS = [
  { v: '', l: 'Todos' },
  { v: 'bot', l: 'Bot' },
  { v: 'waiting', l: 'Na fila' },
  { v: 'human', l: 'Em atendimento' },
  { v: 'closed', l: 'Encerrado' },
  { v: 'none', l: 'Sem atendimento' }
];
export const NO_REPLY_OPTS = [
  { v: 0, l: 'Desligado' },
  { v: 0.5, l: '30 min' },
  { v: 1, l: '1 h' },
  { v: 4, l: '4 h' },
  { v: 24, l: '24 h' }
];
export const PERIOD_OPTS = [
  { v: '', l: 'Qualquer data' },
  { v: 'today', l: 'Hoje' },
  { v: '7d', l: '7 dias' },
  { v: '30d', l: '30 dias' }
];

const SERVICE_SET = new Set(SERVICE_OPTS.map((o) => o.v));
const NO_REPLY_SET = new Set(NO_REPLY_OPTS.map((o) => o.v));
const PERIOD_SET = new Set(PERIOD_OPTS.map((o) => o.v));

export function normalizeAdv(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    tags: Array.isArray(r.tags) ? [...new Set(r.tags.map(String).filter(Boolean))].slice(0, 20) : [],
    tagsMode: r.tagsMode === 'all' ? 'all' : 'any',
    service: SERVICE_SET.has(r.service) ? r.service : '',
    assigned: typeof r.assigned === 'string' ? r.assigned.slice(0, 64) : '',
    noReply: NO_REPLY_SET.has(Number(r.noReply)) ? Number(r.noReply) : 0,
    period: PERIOD_SET.has(r.period) ? r.period : ''
  };
}

export const advActiveCount = (a) =>
  (a.tags.length ? 1 : 0) + (a.service ? 1 : 0) + (a.assigned ? 1 : 0) + (a.noReply ? 1 : 0) + (a.period ? 1 : 0);

export function loadAdv() {
  try {
    const raw = window.localStorage.getItem(ADV_KEY);
    return raw ? normalizeAdv(JSON.parse(raw)) : { ...ADV_DEFAULT, tags: [] };
  } catch {
    return { ...ADV_DEFAULT, tags: [] };
  }
}

export function saveAdv(a) {
  try {
    if (advActiveCount(a) === 0 && a.tagsMode === 'any') window.localStorage.removeItem(ADV_KEY);
    else window.localStorage.setItem(ADV_KEY, JSON.stringify(a));
  } catch {
    /* navegador sem storage (aba anônima, bloqueio) — segue sem persistir */
  }
}

const periodFrom = (period, now = Date.now()) => {
  if (period === 'today') return startOfDay(now).getTime();
  if (period === '7d') return now - 7 * 86400000;
  if (period === '30d') return now - 30 * 86400000;
  return null;
};

/** Parâmetros do GET /whatsapp/chats (undefined = ausente). */
export function advToParams(a) {
  const from = periodFrom(a.period);
  return {
    tags: a.tags.length ? a.tags.join(',') : undefined,
    tags_mode: a.tags.length > 1 ? a.tagsMode : undefined,
    service: a.service || undefined,
    assigned: a.assigned || undefined,
    no_reply_hours: a.noReply || undefined,
    from: from ? new Date(from).toISOString() : undefined
  };
}

/** Mesma regra do servidor, para o tempo real não inserir conversas fora do filtro. */
export function advMatches(c, a, myId, now = Date.now()) {
  if (!a) return true;
  if (a.tags.length) {
    const ids = new Set((c.tags || []).map((t) => (t && typeof t === 'object' ? t.id : t)));
    const ok = a.tagsMode === 'all' ? a.tags.every((id) => ids.has(id)) : a.tags.some((id) => ids.has(id));
    if (!ok) return false;
  }
  if (a.service) {
    const st = c.service?.status || 'none';
    if (a.service === 'open' ? !['bot', 'waiting', 'human'].includes(st) : st !== a.service) return false;
  }
  if (a.assigned) {
    const aid = c.service?.assigned_user?.id || null;
    if (a.assigned === 'me') {
      if (!aid || aid !== myId) return false;
    } else if (a.assigned === 'none') {
      if (aid) return false;
    } else if (aid !== a.assigned) return false;
  }
  if (a.noReply) {
    if (c.kind !== 'individual' || c.last_message_direction !== 'IN' || !c.last_inbound_at) return false;
    if (new Date(c.last_inbound_at).getTime() >= now - a.noReply * 3600000) return false;
  }
  if (a.period) {
    const from = periodFrom(a.period, now);
    if (!c.last_message_at || new Date(c.last_message_at).getTime() < from) return false;
  }
  return true;
}

const assignedLabel = (v, attendants, myId) => {
  if (v === 'me') return 'Meus';
  if (v === 'none') return 'Sem atendente';
  const a = attendants.find((x) => x.id === v);
  if (!a) return 'Atendente removido';
  return a.id === myId ? `${a.name} (você)` : a.name;
};

// ----------------------------------------------------------------------------
function OptChip({ label, selected, onClick, dot }) {
  return (
    <Chip
      size="small"
      label={
        dot ? (
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6 }}>
            <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: dot, flexShrink: 0 }} />
            {label}
          </Box>
        ) : (
          label
        )
      }
      onClick={onClick}
      sx={[
        {
          fontWeight: 700,
          borderRadius: 4,
          maxWidth: 200,
          border: '1px solid',
          borderColor: selected ? WA_GREEN : 'transparent',
          bgcolor: selected ? (t) => tint(t, 'success', 0.16) : 'action.hover',
          color: 'text.secondary',
          '&:hover': { bgcolor: selected ? (t) => tint(t, 'success', 0.22) : 'action.selected' }
        },
        selected && ACTIVE_FG
      ]}
    />
  );
}

function Section({ title, hint, children }) {
  return (
    <Box>
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 0.75 }}>
        <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '.01em' }}>
          {title}
        </Typography>
        {hint ? (
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>
            {hint}
          </Typography>
        ) : null}
      </Stack>
      {children}
    </Box>
  );
}

export function AdvancedFiltersPopover({ anchorEl, onClose, value, onChange, tags, attendants, myId }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const toggleTag = (id) => set({ tags: value.tags.includes(id) ? value.tags.filter((x) => x !== id) : [...value.tags, id] });
  const active = advActiveCount(value);

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{ paper: { sx: { borderRadius: 3, width: 348, maxWidth: 'calc(100vw - 24px)', mt: 0.75, overflow: 'hidden' } } }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, pt: 1.75, pb: 1.25 }}>
        <IconAdjustmentsHorizontal size={18} />
        <Typography sx={{ fontWeight: 800, flex: 1 }}>Filtros avançados</Typography>
        {active ? (
          <Chip size="small" label={`${active} ativo${active === 1 ? '' : 's'}`} sx={{ height: 20, fontWeight: 700, fontSize: 11 }} />
        ) : null}
      </Stack>
      <Divider />
      <Stack spacing={2} sx={[THIN_SCROLL, { px: 2, py: 1.75, maxHeight: 'min(62vh, 520px)', overflowY: 'auto' }]}>
        <Section
          title="Etiquetas"
          hint={value.tags.length > 1 ? (value.tagsMode === 'all' ? 'com todas as marcadas' : 'com qualquer uma') : null}
        >
          {tags.length ? (
            <>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
                {tags.map((t) => (
                  <OptChip
                    key={t.id}
                    dot={safeColor(t.color)}
                    label={t.count != null ? `${t.name} · ${t.count}` : t.name}
                    selected={value.tags.includes(t.id)}
                    onClick={() => toggleTag(t.id)}
                  />
                ))}
              </Box>
              {value.tags.length > 1 ? (
                <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mt: 1 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', mr: 0.25 }}>
                    Combinar:
                  </Typography>
                  <OptChip label="Qualquer uma" selected={value.tagsMode !== 'all'} onClick={() => set({ tagsMode: 'any' })} />
                  <OptChip label="Todas" selected={value.tagsMode === 'all'} onClick={() => set({ tagsMode: 'all' })} />
                </Stack>
              ) : null}
            </>
          ) : (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              Nenhuma etiqueta criada ainda. Crie pelo botão de etiquetas no topo de uma conversa.
            </Typography>
          )}
        </Section>

        <Section title="Atendimento">
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
            {SERVICE_OPTS.map((o) => (
              <OptChip key={o.v || 'all'} label={o.l} selected={value.service === o.v} onClick={() => set({ service: o.v })} />
            ))}
          </Box>
        </Section>

        <Section title="Atendente">
          <TextField
            select
            fullWidth
            size="small"
            value={value.assigned}
            onChange={(e) => set({ assigned: e.target.value })}
            SelectProps={{ displayEmpty: true, MenuProps: { slotProps: { paper: { sx: { maxHeight: 320 } } } } }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="me">Meus atendimentos</MenuItem>
            <MenuItem value="none">Sem atendente</MenuItem>
            {attendants.length ? (
              <ListSubheader sx={{ lineHeight: '30px', fontWeight: 800, fontSize: 11.5, color: 'text.secondary' }}>
                Atendentes
              </ListSubheader>
            ) : null}
            {attendants.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {a.name}
                {a.id === myId ? ' (você)' : ''}
              </MenuItem>
            ))}
          </TextField>
        </Section>

        <Section title="Sem resposta há" hint={value.noReply ? 'só conversas individuais' : null}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
            {NO_REPLY_OPTS.map((o) => (
              <OptChip key={o.v} label={o.l} selected={value.noReply === o.v} onClick={() => set({ noReply: o.v })} />
            ))}
          </Box>
        </Section>

        <Section title="Última mensagem">
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
            {PERIOD_OPTS.map((o) => (
              <OptChip key={o.v || 'any'} label={o.l} selected={value.period === o.v} onClick={() => set({ period: o.v })} />
            ))}
          </Box>
        </Section>
      </Stack>
      <Divider />
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.25 }}>
        <Button
          size="small"
          color="inherit"
          startIcon={<IconFilterOff size={15} />}
          disabled={!active}
          onClick={() => onChange({ ...ADV_DEFAULT, tags: [] })}
          sx={{ fontWeight: 700, textTransform: 'none', color: 'text.secondary' }}
        >
          Limpar filtros
        </Button>
        <Button
          size="small"
          variant="contained"
          disableElevation
          onClick={onClose}
          sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 2, px: 2, bgcolor: WA_GREEN, '&:hover': { bgcolor: WA_DARK } }}
        >
          Pronto
        </Button>
      </Stack>
    </Popover>
  );
}

// ----------------------------------------------------------------------------
// Chips removíveis dos filtros avançados ativos (abaixo da busca)
// ----------------------------------------------------------------------------
function ActiveChip({ label, dot, onRemove, title }) {
  return (
    <Chip
      size="small"
      title={title}
      label={
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
          {dot ? <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: dot, flexShrink: 0 }} /> : null}
          <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {label}
          </Box>
        </Box>
      }
      onDelete={onRemove}
      deleteIcon={<IconX size={12} />}
      sx={{
        height: 22,
        maxWidth: 200,
        fontSize: 11.5,
        fontWeight: 700,
        borderRadius: 4,
        color: 'text.primary',
        bgcolor: (t) => tint(t, 'success', 0.1),
        border: '1px solid',
        borderColor: (t) => tint(t, 'success', 0.28),
        '& .MuiChip-label': { px: 0.9 },
        '& .MuiChip-deleteIcon': { color: 'text.secondary', mr: 0.5, ml: -0.25, '&:hover': { color: 'text.primary' } }
      }}
    />
  );
}

export function ActiveAdvChips({ value, onChange, tags, attendants, myId, sx }) {
  if (!advActiveCount(value)) return null;
  const set = (patch) => onChange({ ...value, ...patch });
  const tagById = new Map(tags.map((t) => [t.id, t]));
  const mode = value.tags.length > 1 ? (value.tagsMode === 'all' ? 'com todas as etiquetas' : 'com qualquer uma das etiquetas') : '';
  const svc = SERVICE_OPTS.find((o) => o.v === value.service);
  const nr = NO_REPLY_OPTS.find((o) => o.v === value.noReply);
  const per = PERIOD_OPTS.find((o) => o.v === value.period);
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5, ...sx }}>
      {value.tags.map((id) => {
        const t = tagById.get(id);
        return (
          <ActiveChip
            key={id}
            dot={safeColor(t?.color)}
            label={t?.name || 'Etiqueta removida'}
            title={mode ? `Conversas ${mode}` : undefined}
            onRemove={() => set({ tags: value.tags.filter((x) => x !== id) })}
          />
        );
      })}
      {value.service ? <ActiveChip label={`Atendimento: ${svc?.l || value.service}`} onRemove={() => set({ service: '' })} /> : null}
      {value.assigned ? (
        <ActiveChip label={`Atendente: ${assignedLabel(value.assigned, attendants, myId)}`} onRemove={() => set({ assigned: '' })} />
      ) : null}
      {value.noReply ? (
        <ActiveChip label={`Sem resposta há ${nr?.l || `${value.noReply} h`}+`} onRemove={() => set({ noReply: 0 })} />
      ) : null}
      {value.period ? <ActiveChip label={`Última msg: ${per?.l || value.period}`} onRemove={() => set({ period: '' })} /> : null}
      <Typography
        component="button"
        type="button"
        variant="caption"
        onClick={() => onChange({ ...ADV_DEFAULT, tags: [] })}
        sx={{
          border: 0,
          bgcolor: 'transparent',
          p: 0,
          ml: 0.25,
          cursor: 'pointer',
          fontWeight: 700,
          color: 'text.secondary',
          textDecoration: 'underline',
          textUnderlineOffset: 2,
          '&:hover': { color: 'text.primary' }
        }}
      >
        Limpar filtros
      </Typography>
    </Box>
  );
}
