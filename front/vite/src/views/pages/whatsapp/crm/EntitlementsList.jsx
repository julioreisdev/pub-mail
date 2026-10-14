import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  IconAlertTriangle,
  IconBan,
  IconCircleCheck,
  IconClock,
  IconFileDownload,
  IconLockAccess,
  IconPlayerPause,
  IconPlugConnected,
  IconRefresh,
  IconRotateClockwise,
  IconTag,
  IconUsersGroup
} from '@tabler/icons-react';

import { get, post } from 'api/api';
import { WaNumberChip } from '../waKit';
import { errMsg, tint } from '../waShared';
import { StatusChip } from './crmKit';

// ============================================================================
// "Acessos liberados" do cliente (Fase 5) — GET /whatsapp/entitlements?customer_id=
// Cada linha = uma regra de um produto (grupo, etiqueta, arquivo, integração) aplicada
// a uma assinatura. O motor no servidor aplica a diferença entre `status` e `desired`
// sozinho (alguns segundos depois de pagar/atrasar/cancelar); aqui só mostramos e
// deixamos tentar de novo quando falhou.
// ============================================================================

export const ENT_KINDS = {
  group_member: { label: 'Grupo do WhatsApp', icon: IconUsersGroup },
  tag: { label: 'Etiqueta', icon: IconTag },
  digital_file: { label: 'Arquivo digital', icon: IconFileDownload },
  external: { label: 'Integração externa', icon: IconPlugConnected }
};

const ENT_STATUS = {
  active: { label: 'Ativo', icon: IconCircleCheck, color: '#128C7E', dark: '#25D366', token: 'success' },
  suspended: { label: 'Suspenso', icon: IconPlayerPause, color: '#B45309', dark: '#FBBF24', token: 'warning' },
  revoked: { label: 'Revogado', icon: IconBan, color: '#64748B', dark: '#94A3B8', token: 'info' },
  pending: { label: 'Pendente', icon: IconClock, color: '#2563EB', dark: '#60A5FA', token: 'info' },
  failed: { label: 'Falhou', icon: IconAlertTriangle, color: '#DC2626', dark: '#F87171', token: 'error' },
  none: { label: '—', color: '#64748B', dark: '#94A3B8', token: 'info' }
};
// a caminho do estado desejado (o motor ainda vai aplicar)
const GOING = { active: 'Liberando…', suspended: 'Suspendendo…', revoked: 'Revogando…' };

const fmtBRT = (v) => {
  if (!v) return '';
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(v));
  } catch {
    return '';
  }
};
const fmtPhone = (p) => {
  const d = String(p || '').replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('55')) return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12 && d.startsWith('55')) return `+55 (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  return d ? `+${d}` : '';
};

function statusOf(e) {
  if (e.status === 'failed') return { key: 'failed', label: null };
  if (e.desired && e.status !== e.desired && GOING[e.desired]) return { key: 'pending', label: GOING[e.desired] };
  return { key: ENT_STATUS[e.status] ? e.status : 'none', label: null };
}

function EntitlementRow({ e, canManage, busy, onRetry }) {
  const kind = ENT_KINDS[e.kind] || { label: e.kind, icon: IconLockAccess };
  const Icon = kind.icon;
  const st = statusOf(e);
  const when = e.updated_at || e.activated_at || e.suspended_at || e.revoked_at;
  const errorTip = e.error ? `${e.error}${e.attempts ? ` (${e.attempts} tentativa${e.attempts === 1 ? '' : 's'})` : ''}` : '';
  return (
    <Stack
      direction="row"
      spacing={1.25}
      alignItems="center"
      sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 2, minWidth: 0 }}
    >
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 1.5,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          color: 'primary.main',
          bgcolor: (t) => tint(t, 'primary', 0.1)
        }}
      >
        <Icon size={17} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap title={e.label || kind.label}>
          {e.label || kind.label}
        </Typography>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0, flexWrap: 'wrap', rowGap: 0.25 }} useFlexGap>
          <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
            {kind.label}
            {e.product_name ? ` · ${e.product_name}` : ''}
            {e.kind === 'group_member' && e.target_phone ? ` · ${fmtPhone(e.target_phone)}` : ''}
            {when ? ` · ${fmtBRT(when)}` : ''}
          </Typography>
          {e.kind === 'group_member' && e.session ? <WaNumberChip session={e.session} /> : null}
        </Stack>
        {e.error && st.key !== 'failed' ? (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', overflowWrap: 'anywhere' }}>
            {e.error}
          </Typography>
        ) : null}
      </Box>
      <Tooltip title={errorTip} disableHoverListener={!errorTip}>
        <span>
          <StatusChip map={ENT_STATUS} status={st.key} label={st.label || undefined} />
        </span>
      </Tooltip>
      {canManage && e.status === 'failed' ? (
        <Button
          size="small"
          onClick={onRetry}
          disabled={busy}
          startIcon={busy ? <CircularProgress size={13} color="inherit" /> : <IconRotateClockwise size={15} />}
          sx={{ textTransform: 'none', fontWeight: 700, flexShrink: 0 }}
        >
          Tentar de novo
        </Button>
      ) : null}
    </Stack>
  );
}

/**
 * Lista de acessos liberados de um cliente. `reloadKey` muda depois de cada ação na assinatura —
 * recarrega na hora e de novo 4 s depois (o motor aplica em segundo plano).
 */
export default function EntitlementsList({ customerId, reloadKey, canManage }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!customerId) return;
    const s = ++seq.current;
    setLoading(true);
    try {
      const r = await get(`/whatsapp/entitlements?customer_id=${encodeURIComponent(customerId)}`);
      if (s !== seq.current) return;
      setItems(Array.isArray(r) ? r : Array.isArray(r?.items) ? r.items : []);
      setError('');
    } catch (e) {
      if (s !== seq.current) return;
      setError(errMsg(e, 'Não foi possível carregar os acessos.'));
      setItems((p) => p || []);
    } finally {
      if (s === seq.current) setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    load();
    const t = setTimeout(load, 4000);
    return () => clearTimeout(t);
  }, [load, reloadKey]);

  const retry = async (e) => {
    setBusyId(e.id);
    try {
      await post(`/whatsapp/entitlements/${e.id}/retry`, {});
      toast.success('Vamos tentar de novo em instantes.');
      await load();
      setTimeout(load, 4000);
    } catch (err) {
      toast.error(errMsg(err, 'Não foi possível tentar de novo.'));
    } finally {
      setBusyId(null);
    }
  };

  if (!customerId) return null;
  // sem nenhum acesso e sem erro: não ocupa espaço (a maioria dos produtos não tem regras)
  if (items !== null && !items.length && !error) return null;

  return (
    <Box sx={{ pt: 0.5 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
        <IconLockAccess size={16} />
        <Typography variant="body2" sx={{ fontWeight: 800, flex: 1 }}>
          Acessos liberados
        </Typography>
        <Tooltip title="Atualizar">
          <span>
            <IconButton size="small" onClick={load} disabled={loading} aria-label="Atualizar acessos">
              {loading ? <CircularProgress size={14} /> : <IconRefresh size={16} />}
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      {items === null ? (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Carregando…
        </Typography>
      ) : (
        <Stack spacing={0.75}>
          {error ? (
            <Typography variant="caption" sx={{ color: 'error.main' }}>
              {error}
            </Typography>
          ) : null}
          {items.map((e) => (
            <EntitlementRow key={e.id} e={e} canManage={canManage} busy={busyId === e.id} onRetry={() => retry(e)} />
          ))}
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Liberados pelas regras dos produtos (WhatsApp → Produtos → “Ao pagar, liberar…”). Mudam sozinhos quando a assinatura é paga,
            atrasa, pausa ou é cancelada.
          </Typography>
        </Stack>
      )}
    </Box>
  );
}
