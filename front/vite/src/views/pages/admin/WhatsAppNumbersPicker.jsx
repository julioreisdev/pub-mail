// =============================================================================
// WhatsAppNumbersPicker — quais números do WhatsApp (whatsapp_sessions) um
// usuário pode usar (Administração → Usuários).
//   value: null  = todos os números (inclusive os conectados depois)
//          []    = nenhum
//          [ids] = só esses
// Donos/admins/superadmin sempre veem todos → o picker vira só uma nota.
// Lista da org: GET /admin/organizations/:id/whatsapp-sessions
//   → [{ id, label, color, phone, status, connected }] (cache por org, 60 s).
// Dark-mode: só tokens e theme.vars (nunca theme.palette em callback sx).
// =============================================================================
import { useCallback, useEffect, useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';

import { IconBrandWhatsapp, IconRefresh } from '@tabler/icons-react';

import { get } from 'api/api';
import { TgStatusPill } from 'views/pages/telegram/ui';
import { WaNumberDot, SESSION_STATUS_UI, fmtPhoneBR, sessionLabel } from 'views/pages/whatsapp/waKit';

// ------------------------------------------------------------------ helpers
/** Roles que sempre veem todos os números (o back ignora `whatsapp_sessions` p/ eles). */
export const WA_SEES_ALL_ROLES = ['OWNER', 'ADMIN', 'SUPER_ADMIN'];
export const roleSeesAllNumbers = (role) => WA_SEES_ALL_ROLES.includes(String(role || '').toUpperCase());

/** `whatsapp_sessions` cru → `null` (todos) ou array de ids únicos (sem vazios). */
export const normalizeWaSessions = (raw) => {
  if (raw === null || raw === undefined) return null;
  if (!Array.isArray(raw)) return null;
  const out = [];
  raw.forEach((v) => {
    const s = String(v || '').trim();
    if (s && !out.includes(s)) out.push(s);
  });
  return out;
};

/** Igualdade de dois valores (null/array) ignorando a ordem. */
export const sameWaSessions = (a, b) => {
  const na = normalizeWaSessions(a);
  const nb = normalizeWaSessions(b);
  if (na === null || nb === null) return na === nb;
  if (na.length !== nb.length) return false;
  const set = new Set(nb);
  return na.every((id) => set.has(id));
};

const getErrorMessage = (err, fallback) => {
  const m = err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;
  return Array.isArray(m) ? m.join(' | ') : String(m || fallback);
};

// ------------------------------------------------------------------ cache por org
// Uma requisição por org (a tabela de usuários pode ter vários usuários da mesma conta).
const CACHE_TTL_MS = 60_000;
const cache = new Map(); // orgId → { items, at, promise }
const listeners = new Set(); // notifica os hooks montados quando uma org atualiza

const notify = (orgId) => listeners.forEach((fn) => fn(orgId));

export async function fetchOrgWaSessions(orgId, { force = false } = {}) {
  if (!orgId) return [];
  const entry = cache.get(orgId);
  if (entry?.promise) return entry.promise;
  if (!force && entry?.items && Date.now() - entry.at < CACHE_TTL_MS) return entry.items;
  const promise = get(`/admin/organizations/${orgId}/whatsapp-sessions`)
    .then((r) => {
      const items = Array.isArray(r) ? r : Array.isArray(r?.items) ? r.items : [];
      cache.set(orgId, { items, at: Date.now(), promise: null });
      notify(orgId);
      return items;
    })
    .catch((err) => {
      // mantém a lista antiga (se houver) e libera p/ tentar de novo
      cache.set(orgId, { items: entry?.items || null, at: 0, promise: null });
      notify(orgId);
      throw err;
    });
  cache.set(orgId, { ...(entry || {}), promise });
  return promise;
}

/** Lê os números de uma org (cache compartilhado). `enabled=false` não busca nada. */
export function useOrgWaSessions(orgId, { enabled = true, force = false } = {}) {
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (opts = {}) => {
      if (!orgId) return;
      setLoading(true);
      setError('');
      try {
        await fetchOrgWaSessions(orgId, { force: opts.force ?? force });
      } catch (err) {
        setError(getErrorMessage(err, 'Falha ao carregar os números do WhatsApp.'));
      } finally {
        setLoading(false);
      }
    },
    [orgId, force]
  );

  useEffect(() => {
    const fn = (changed) => {
      if (changed === orgId) setTick((t) => t + 1);
    };
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, [orgId]);

  useEffect(() => {
    if (!enabled || !orgId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, orgId]);

  const entry = cache.get(orgId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sessions = useMemo(() => (Array.isArray(entry?.items) ? entry.items : null), [entry?.items, tick]);
  const byId = useMemo(() => new Map((sessions || []).map((s) => [s.id, s])), [sessions]);
  return { sessions, byId, loading, error, reload: () => load({ force: true }), loaded: sessions !== null };
}

// ------------------------------------------------------------------ chip da tabela
/**
 * Chip discreto p/ a listagem: "WhatsApp: todos os números" / "WhatsApp: 2 números".
 * Só faz sentido quando o usuário tem o módulo `whatsapp` (quem chama decide).
 * Resolve os nomes dos números pela lista da org (cache) só quando é uma lista.
 */
export function WhatsAppAccessChip({ user, orgId, size = 'small' }) {
  const seesAll = roleSeesAllNumbers(user?.role);
  const value = seesAll ? null : normalizeWaSessions(user?.whatsapp_sessions);
  const isList = Array.isArray(value);
  const { sessions, byId } = useOrgWaSessions(orgId, { enabled: isList && !!orgId });

  let label;
  if (!isList) label = 'todos os números';
  else if (value.length === 0) label = 'nenhum número';
  else label = `${value.length} ${value.length === 1 ? 'número' : 'números'}`;

  let title;
  if (!isList) {
    title = seesAll ? 'Donos e admins veem todos os números da conta.' : 'Todos os números da conta, inclusive os conectados depois.';
  } else if (value.length === 0) {
    title = 'Tem o módulo, mas nenhum número liberado.';
  } else if (!sessions) {
    title = 'Carregando os números…';
  } else {
    const names = value.map((id) => {
      const s = byId.get(id);
      return s ? `${sessionLabel(s)}${s.phone ? ` · ${fmtPhoneBR(s.phone)}` : ''}` : 'número removido';
    });
    title = (
      <Box component="span" sx={{ display: 'block' }}>
        {names.map((n, i) => (
          <Box key={`${n}-${i}`} component="span" sx={{ display: 'block' }}>
            • {n}
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Tooltip title={title} arrow>
      <Chip
        size={size}
        icon={<IconBrandWhatsapp size={12} stroke={2} />}
        label={`WhatsApp: ${label}`}
        variant="outlined"
        sx={(t) => ({
          height: 20,
          fontSize: 10.5,
          fontWeight: 600,
          color: isList && value.length === 0 ? 'text.secondary' : 'success.main',
          borderColor: isList && value.length === 0 ? 'divider' : `rgba(${t.vars.palette.success.mainChannel} / 0.4)`,
          bgcolor: isList && value.length === 0 ? 'transparent' : `rgba(${t.vars.palette.success.mainChannel} / 0.06)`,
          '& .MuiChip-icon': { color: 'inherit', ml: 0.6 },
          '& .MuiChip-label': { px: 0.75 }
        })}
      />
    </Tooltip>
  );
}

// ------------------------------------------------------------------ linha de número
function NumberRow({ session, checked, disabled, onToggle }) {
  const ui = SESSION_STATUS_UI[session.status] || SESSION_STATUS_UI.none;
  const connected = session.connected || session.status === 'ready';
  return (
    <FormControlLabel
      disabled={disabled}
      control={<Checkbox size="small" checked={checked} onChange={onToggle} sx={{ py: 0.5 }} />}
      sx={(t) => ({
        m: 0,
        px: 1,
        borderRadius: 2,
        border: '1px solid',
        borderColor: checked ? `rgba(${t.vars.palette.success.mainChannel} / 0.5)` : 'divider',
        bgcolor: checked ? `rgba(${t.vars.palette.success.mainChannel} / 0.06)` : 'background.paper',
        transition: 'border-color .15s, background-color .15s',
        alignItems: 'center',
        '& .MuiFormControlLabel-label': { flex: 1, minWidth: 0, py: 0.5 }
      })}
      label={
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          <WaNumberDot session={session} size={10} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>
              {sessionLabel(session)}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.3 }} noWrap>
              {session.phone ? fmtPhoneBR(session.phone) : 'Sem número pareado'}
            </Typography>
          </Box>
          <TgStatusPill status={ui.pill} label={ui.label} sx={{ flexShrink: 0, opacity: connected ? 1 : 0.85 }} />
        </Stack>
      }
    />
  );
}

// ------------------------------------------------------------------ picker
/**
 * props:
 *  - orgId: organização cujos números serão listados (sem orgId → pede p/ escolher a conta)
 *  - value: null | string[]
 *  - onChange(next: null | string[])
 *  - disabled?: boolean
 *  - role: role do usuário (OWNER/ADMIN/SUPER_ADMIN → só a nota)
 */
export default function WhatsAppNumbersPicker({ orgId, value, onChange, disabled = false, role }) {
  const seesAll = roleSeesAllNumbers(role);
  const current = normalizeWaSessions(value);
  const { sessions, loading, error, reload, loaded } = useOrgWaSessions(orgId, { enabled: !seesAll && !!orgId, force: true });
  const hasNumbers = Array.isArray(sessions) && sessions.length > 0;

  // Org sem número: o único valor válido é `null` (todos quando houver).
  useEffect(() => {
    if (seesAll || !loaded || hasNumbers) return;
    if (current !== null) onChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seesAll, loaded, hasNumbers]);

  const mode = current === null ? 'all' : 'some';
  const selected = useMemo(() => new Set(current || []), [current]);
  // ids liberados que a org não tem mais (número removido) — o back descarta; avisamos
  const stale = useMemo(() => {
    if (!hasNumbers || current === null) return 0;
    const ids = new Set(sessions.map((s) => s.id));
    return current.filter((id) => !ids.has(id)).length;
  }, [current, sessions, hasNumbers]);

  const toggle = (id) => {
    if (disabled) return;
    const next = new Set(current || []);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  if (seesAll) {
    return (
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
        Donos e admins veem <strong>todos os números</strong> da conta — não há o que restringir.
      </Typography>
    );
  }

  if (!orgId) {
    return (
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
        Selecione a conta para escolher os números liberados.
      </Typography>
    );
  }

  if (error && !loaded) {
    return (
      <Alert
        severity="error"
        sx={{ py: 0.5 }}
        action={
          <Button color="inherit" size="small" onClick={reload} disabled={loading}>
            Tentar novamente
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  if (!loaded) {
    return (
      <Stack spacing={1}>
        <Skeleton variant="rounded" height={32} />
        <Skeleton variant="rounded" height={44} />
      </Stack>
    );
  }

  if (!hasNumbers) {
    return (
      <Alert severity="info" sx={{ py: 0.5 }} icon={<IconBrandWhatsapp size={18} />}>
        Esta organização ainda não conectou nenhum número; o usuário terá acesso a <strong>todos</strong> quando houver.
      </Alert>
    );
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
          {mode === 'all'
            ? `Todos os ${sessions.length} ${sessions.length === 1 ? 'número' : 'números'} da conta`
            : `${selected.size} de ${sessions.length} ${sessions.length === 1 ? 'número' : 'números'}`}
        </Typography>
        <Tooltip title="Recarregar a lista de números">
          <span>
            <Chip
              size="small"
              variant="outlined"
              clickable
              disabled={loading}
              icon={<IconRefresh size={13} />}
              label="Atualizar"
              onClick={reload}
              sx={{ height: 22, fontSize: 11, fontWeight: 700, '& .MuiChip-icon': { ml: 0.6 } }}
            />
          </span>
        </Tooltip>
      </Stack>

      <RadioGroup
        value={mode}
        onChange={(e) => {
          if (disabled) return;
          onChange(e.target.value === 'all' ? null : current || []);
        }}
      >
        <FormControlLabel
          value="all"
          disabled={disabled}
          control={<Radio size="small" />}
          label={
            <Typography variant="body2" sx={{ fontWeight: mode === 'all' ? 700 : 500 }}>
              Todos os números <span style={{ fontWeight: 400, opacity: 0.75 }}>(inclusive os conectados depois)</span>
            </Typography>
          }
        />
        <FormControlLabel
          value="some"
          disabled={disabled}
          control={<Radio size="small" />}
          label={
            <Typography variant="body2" sx={{ fontWeight: mode === 'some' ? 700 : 500 }}>
              Só estes:
            </Typography>
          }
        />
      </RadioGroup>

      <Stack spacing={0.75} sx={{ pl: { xs: 0, sm: 3.5 }, mt: 0.25, opacity: mode === 'some' ? 1 : 0.55 }}>
        {sessions.map((s) => (
          <NumberRow
            key={s.id}
            session={s}
            checked={mode === 'some' && selected.has(s.id)}
            disabled={disabled || mode !== 'some'}
            onToggle={() => toggle(s.id)}
          />
        ))}
        {mode === 'some' && selected.size === 0 ? (
          <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 600 }}>
            Nenhum número marcado — o usuário terá o módulo, mas não verá conversa alguma.
          </Typography>
        ) : null}
        {stale > 0 ? (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {stale === 1
              ? '1 número liberado antes foi removido da conta e será ignorado ao salvar.'
              : `${stale} números liberados antes foram removidos da conta e serão ignorados ao salvar.`}
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
}
