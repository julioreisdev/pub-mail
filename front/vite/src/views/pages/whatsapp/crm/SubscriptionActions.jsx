import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import {
  IconArrowsExchange,
  IconBan,
  IconCheck,
  IconDotsVertical,
  IconHistory,
  IconPencil,
  IconPlayerPause,
  IconPlayerPlay,
  IconRotateClockwise,
  IconTrash
} from '@tabler/icons-react';

import { post } from 'api/api';
import { TgConfirmDialog } from 'views/pages/telegram/ui';
import { errMsg, tint } from '../waShared';
import { CANCEL_POLICIES, CrmModal, billingShort, fmtDateBR, formatBRL, isoPlusDays, todayIso, waPrimaryBtn } from './crmKit';

// ============================================================================
// Ações de uma assinatura (menu ⋮ da linha na aba Assinaturas do cliente):
// cancelar (política + motivo), pausar, retomar, trocar de plano, reativar,
// linha do tempo, editar, excluir.
// POST /whatsapp/subscriptions/:id/{cancel|pause|resume|change-plan|reactivate}
// As rotas devolvem a assinatura; quem chama recarrega o cliente (`onChanged`).
// ============================================================================

const OTHER = '__other';
const isOtherLabel = (r) =>
  String(r || '')
    .trim()
    .toLowerCase() === 'outro';

/** Pode cancelar: viva e sem cancelamento já agendado. */
export const canCancel = (s) => s.status !== 'canceled' && !s.cancel_at;
export const canPause = (s) => (s.status === 'active' || s.status === 'overdue') && !s.cancel_at;
export const canResume = (s) => s.status === 'paused';
export const canChangePlan = (s) => ['active', 'overdue', 'paused'].includes(s.status) && !s.cancel_at;
export const canReactivate = (s) => s.status === 'canceled' || Boolean(s.cancel_at);

// ----------------------------------------------------------------------------
// Cartão de escolha (rádio visual)
// ----------------------------------------------------------------------------
function ChoiceCard({ selected, title, hint, onClick }) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        flex: 1,
        minWidth: 0,
        p: 1.25,
        borderRadius: 2,
        textAlign: 'left',
        display: 'block',
        border: '1.5px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: selected ? (t) => tint(t, 'primary', 0.08) : 'transparent'
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <Box
          sx={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            border: '2px solid',
            borderColor: selected ? 'primary.main' : 'text.disabled',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0
          }}
        >
          {selected ? <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main' }} /> : null}
        </Box>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
      </Stack>
      {hint ? (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5, pl: 3 }}>
          {hint}
        </Typography>
      ) : null}
    </ButtonBase>
  );
}

// ----------------------------------------------------------------------------
// Cancelar
// ----------------------------------------------------------------------------
function CancelDialog({ open, onClose, sub, product, reasons, onDone }) {
  const [policy, setPolicy] = useState('end_of_cycle');
  const [reason, setReason] = useState('');
  const [other, setOther] = useState('');
  const [busy, setBusy] = useState(false);
  const list = useMemo(() => (reasons || []).filter((r) => !isOtherLabel(r)), [reasons]);
  useEffect(() => {
    if (!open) return;
    setPolicy(product?.cancel_policy === 'immediate' ? 'immediate' : 'end_of_cycle');
    setReason('');
    setOther('');
    setBusy(false);
  }, [open, product]);
  if (!sub) return null;
  const until = sub.next_due_at ? fmtDateBR(sub.next_due_at) : '';
  const save = async () => {
    const finalReason = reason === OTHER ? other.trim() || 'Outro' : reason || null;
    setBusy(true);
    try {
      await post(`/whatsapp/subscriptions/${sub.id}/cancel`, { policy, reason: finalReason });
      toast.success(policy === 'immediate' ? 'Assinatura cancelada.' : `Cancelamento agendado${until ? ` para ${until}` : ''}.`);
      onDone?.();
      onClose();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível cancelar.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <CrmModal
      open={open}
      onClose={() => !busy && onClose()}
      title="Cancelar assinatura"
      subtitle={`${sub.product_name} · ${sub.amount_label || sub.price_label}${billingShort(sub.billing)}`}
      maxWidth="xs"
      disableClose={busy}
      footer={
        <>
          <Button color="inherit" onClick={onClose} disabled={busy} sx={{ textTransform: 'none' }}>
            Voltar
          </Button>
          <Button
            variant="contained"
            color="error"
            disableElevation
            onClick={save}
            disabled={busy}
            startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <IconBan size={16} />}
            sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 2 }}
          >
            {policy === 'immediate' ? 'Cancelar agora' : 'Agendar cancelamento'}
          </Button>
        </>
      }
    >
      <Stack spacing={1.5}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          Quando o cancelamento vale
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          {CANCEL_POLICIES.map((p) => (
            <ChoiceCard
              key={p.value}
              selected={policy === p.value}
              onClick={() => setPolicy(p.value)}
              title={p.value === 'end_of_cycle' && until ? `${p.label} (continua até ${until})` : p.label}
              hint={p.hint}
            />
          ))}
        </Stack>
        {product?.cancel_policy ? (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            A política do produto é <b>{CANCEL_POLICIES.find((p) => p.value === product.cancel_policy)?.label}</b>; aqui você pode escolher
            outra só para este cancelamento.
          </Typography>
        ) : null}
        <TextField select size="small" label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} fullWidth>
          <MenuItem value="">
            <em>Não informado</em>
          </MenuItem>
          {list.map((r) => (
            <MenuItem key={r} value={r}>
              {r}
            </MenuItem>
          ))}
          <MenuItem value={OTHER}>Outro (escrever)</MenuItem>
        </TextField>
        {reason === OTHER ? (
          <TextField
            size="small"
            label="Qual o motivo?"
            value={other}
            onChange={(e) => setOther(e.target.value.slice(0, 255))}
            fullWidth
            autoFocus
            multiline
            maxRows={4}
          />
        ) : null}
        <Alert severity={policy === 'immediate' ? 'warning' : 'info'} sx={{ borderRadius: 2 }}>
          {policy === 'immediate'
            ? 'A assinatura encerra agora e as cobranças em aberto dela são canceladas no gateway.'
            : `Nada muda até ${until || 'o próximo vencimento'}; depois disso ela encerra sozinha e não gera nova cobrança. Dá para desfazer com "Reativar".`}
        </Alert>
      </Stack>
    </CrmModal>
  );
}

// ----------------------------------------------------------------------------
// Pausar
// ----------------------------------------------------------------------------
function PauseDialog({ open, onClose, sub, onDone }) {
  const [mode, setMode] = useState('days');
  const [days, setDays] = useState(30);
  const [until, setUntil] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setMode('days');
    setDays(30);
    setUntil(isoPlusDays(30));
    setBusy(false);
  }, [open]);
  if (!sub) return null;
  const target = mode === 'days' ? isoPlusDays(days) : until;
  const save = async () => {
    if (mode === 'until' && (!until || until <= todayIso())) return toast.error('Escolha uma data a partir de amanhã.');
    setBusy(true);
    try {
      await post(`/whatsapp/subscriptions/${sub.id}/pause`, mode === 'days' ? { days } : { until });
      toast.success(`Assinatura pausada até ${fmtDateBR(target)}.`);
      onDone?.();
      onClose();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível pausar.'));
    } finally {
      setBusy(false);
    }
    return undefined;
  };
  return (
    <CrmModal
      open={open}
      onClose={() => !busy && onClose()}
      title="Pausar assinatura"
      subtitle={sub.product_name}
      maxWidth="xs"
      disableClose={busy}
      footer={
        <>
          <Button color="inherit" onClick={onClose} disabled={busy} sx={{ textTransform: 'none' }}>
            Voltar
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={save}
            disabled={busy}
            startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <IconPlayerPause size={16} />}
            sx={waPrimaryBtn}
          >
            Pausar
          </Button>
        </>
      }
    >
      <Stack spacing={1.5}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={mode}
          onChange={(_, v) => v && setMode(v)}
          fullWidth
          sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 700 } }}
        >
          <ToggleButton value="days">Por N dias</ToggleButton>
          <ToggleButton value="until">Até uma data</ToggleButton>
        </ToggleButtonGroup>
        {mode === 'days' ? (
          <TextField
            size="small"
            type="number"
            label="Dias"
            value={days}
            onChange={(e) => setDays(Math.min(365, Math.max(1, parseInt(e.target.value || '1', 10) || 1)))}
            inputProps={{ min: 1, max: 365, inputMode: 'numeric' }}
            InputProps={{ endAdornment: <InputAdornment position="end">dias</InputAdornment> }}
            helperText={`Volta a valer em ${fmtDateBR(target)}`}
            fullWidth
          />
        ) : (
          <TextField
            size="small"
            type="date"
            label="Pausada até"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: isoPlusDays(1) }}
            fullWidth
          />
        )}
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          Durante a pausa não há cobrança: as cobranças em aberto que ainda não venceram são canceladas e o próximo vencimento é empurrado
          pelo tempo pausado. Ela volta sozinha na data (ou antes, com "Retomar").
        </Alert>
      </Stack>
    </CrmModal>
  );
}

// ----------------------------------------------------------------------------
// Trocar de plano
// ----------------------------------------------------------------------------
function ChangePlanDialog({ open, onClose, sub, products, onDone }) {
  const [productId, setProductId] = useState('');
  const [busy, setBusy] = useState(false);
  const options = useMemo(() => (products || []).filter((p) => p.active && p.id !== sub?.product_id), [products, sub]);
  useEffect(() => {
    if (!open) return;
    setProductId('');
    setBusy(false);
  }, [open]);
  if (!sub) return null;
  const picked = options.find((p) => p.id === productId);
  const save = async () => {
    if (!productId) return toast.error('Escolha o novo plano.');
    setBusy(true);
    try {
      await post(`/whatsapp/subscriptions/${sub.id}/change-plan`, { product_id: productId });
      toast.success(`Plano trocado para ${picked?.name || 'o novo produto'}.`);
      onDone?.();
      onClose();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível trocar o plano.'));
    } finally {
      setBusy(false);
    }
    return undefined;
  };
  return (
    <CrmModal
      open={open}
      onClose={() => !busy && onClose()}
      title="Trocar de plano"
      subtitle={`Plano atual: ${sub.product_name} · ${sub.price_label}${billingShort(sub.billing)}`}
      maxWidth="xs"
      disableClose={busy}
      footer={
        <>
          <Button color="inherit" onClick={onClose} disabled={busy} sx={{ textTransform: 'none' }}>
            Voltar
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={save}
            disabled={busy || !productId}
            startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <IconCheck size={16} />}
            sx={waPrimaryBtn}
          >
            Trocar plano
          </Button>
        </>
      }
    >
      <Stack spacing={1.5}>
        {options.length ? (
          <TextField select size="small" label="Novo plano" value={productId} onChange={(e) => setProductId(e.target.value)} fullWidth>
            {options.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name} · {formatBRL(p.price_cents)}
                {billingShort(p.billing)}
              </MenuItem>
            ))}
          </TextField>
        ) : (
          <Alert severity="warning" sx={{ borderRadius: 2 }}>
            Não há outro produto ativo no catálogo. Cadastre em WhatsApp → Produtos.
          </Alert>
        )}
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          O crédito do período não usado do plano atual vira desconto na próxima cobrança. Não há estorno.
        </Alert>
      </Stack>
    </CrmModal>
  );
}

// ============================================================================
// Menu ⋮ da assinatura
// ============================================================================
export default function SubscriptionActions({
  sub,
  products = [],
  cancelReasons = [],
  onChanged,
  onEdit,
  onRemove,
  timelineOpen,
  onToggleTimeline
}) {
  const [anchor, setAnchor] = useState(null);
  const [dlg, setDlg] = useState(null); // 'cancel' | 'pause' | 'plan' | 'resume' | 'reactivate'
  const [busy, setBusy] = useState(false);
  const product = products.find((p) => p.id === sub.product_id) || null;
  const close = () => setAnchor(null);
  const open = (k) => {
    close();
    setDlg(k);
  };
  const after = (fn) => {
    close();
    fn?.();
  };

  const simple = async (path, okMsg) => {
    setBusy(true);
    try {
      await post(`/whatsapp/subscriptions/${sub.id}/${path}`, {});
      toast.success(okMsg);
      setDlg(null);
      onChanged?.();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível concluir.'));
    } finally {
      setBusy(false);
    }
  };

  const items = [
    {
      key: 'timeline',
      icon: IconHistory,
      label: timelineOpen ? 'Esconder linha do tempo' : 'Linha do tempo',
      onClick: () => after(onToggleTimeline)
    },
    { key: 'edit', icon: IconPencil, label: 'Editar', onClick: () => after(onEdit) },
    canPause(sub) ? { key: 'pause', icon: IconPlayerPause, label: 'Pausar', onClick: () => open('pause') } : null,
    canResume(sub) ? { key: 'resume', icon: IconPlayerPlay, label: 'Retomar', onClick: () => open('resume') } : null,
    canChangePlan(sub) ? { key: 'plan', icon: IconArrowsExchange, label: 'Trocar de plano', onClick: () => open('plan') } : null,
    canReactivate(sub)
      ? {
          key: 'reactivate',
          icon: IconRotateClockwise,
          label: sub.status === 'canceled' ? 'Reativar' : 'Desfazer cancelamento',
          onClick: () => open('reactivate')
        }
      : null,
    canCancel(sub) ? { key: 'cancel', icon: IconBan, label: 'Cancelar assinatura', danger: true, onClick: () => open('cancel') } : null,
    'divider',
    { key: 'remove', icon: IconTrash, label: 'Excluir do cadastro', danger: true, onClick: () => after(onRemove) }
  ].filter(Boolean);

  return (
    <>
      <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)} disabled={busy} sx={{ p: 1 }} aria-label="Ações da assinatura">
        {busy ? <CircularProgress size={16} /> : <IconDotsVertical size={16} />}
      </IconButton>
      <Menu open={Boolean(anchor)} anchorEl={anchor} onClose={close} slotProps={{ paper: { sx: { borderRadius: 2.5, minWidth: 220 } } }}>
        {items.map((it, i) =>
          it === 'divider' ? (
            <Divider key={`d${i}`} />
          ) : (
            <MenuItem key={it.key} onClick={it.onClick} sx={it.danger ? { color: 'error.main' } : undefined}>
              <ListItemIcon sx={it.danger ? { color: 'error.main' } : undefined}>
                <it.icon size={18} />
              </ListItemIcon>
              <ListItemText>{it.label}</ListItemText>
            </MenuItem>
          )
        )}
      </Menu>

      <CancelDialog
        open={dlg === 'cancel'}
        onClose={() => setDlg(null)}
        sub={sub}
        product={product}
        reasons={cancelReasons}
        onDone={onChanged}
      />
      <PauseDialog open={dlg === 'pause'} onClose={() => setDlg(null)} sub={sub} onDone={onChanged} />
      <ChangePlanDialog open={dlg === 'plan'} onClose={() => setDlg(null)} sub={sub} products={products} onDone={onChanged} />
      <TgConfirmDialog
        open={dlg === 'resume' || dlg === 'reactivate'}
        onClose={() => !busy && setDlg(null)}
        loading={busy}
        title={
          dlg === 'resume' ? 'Retomar a assinatura?' : sub.status === 'canceled' ? 'Reativar a assinatura?' : 'Desfazer o cancelamento?'
        }
        message={
          dlg === 'resume'
            ? `${sub.product_name} volta a valer hoje${sub.paused_until ? ` (a pausa ia até ${fmtDateBR(sub.paused_until)})` : ''}; o próximo vencimento é recalculado.`
            : sub.status === 'canceled'
              ? `${sub.product_name} volta a ficar ativa e as cobranças recomeçam no próximo vencimento.`
              : `O cancelamento agendado para ${fmtDateBR(sub.cancel_at)} é desfeito e ${sub.product_name} continua normalmente.`
        }
        confirmLabel={dlg === 'resume' ? 'Retomar' : sub.status === 'canceled' ? 'Reativar' : 'Desfazer'}
        onConfirm={() =>
          dlg === 'resume'
            ? simple('resume', 'Assinatura retomada.')
            : simple('reactivate', sub.status === 'canceled' ? 'Assinatura reativada.' : 'Cancelamento desfeito.')
        }
      />
    </>
  );
}
