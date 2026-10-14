import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { IconCircleX } from '@tabler/icons-react';

import { CrmModal } from '../crm/crmKit';
import { moveOrder, orderErr } from './orderKit';

// ============================================================================
// Cancelar pedido: motivo (vai no texto do cliente via {{pedido.motivo}}) e
// "Avisar o cliente". A cobrança PIX aberta é cancelada pelo servidor.
// ============================================================================

export default function CancelOrderDialog({ order, onClose, onDone }) {
  const open = Boolean(order);
  const [reason, setReason] = useState('');
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setReason('');
      setNotify(true);
    }
  }, [open, order?.id]);

  const submit = async () => {
    setBusy(true);
    try {
      const r = await moveOrder(order.id, 'canceled', { reason: reason.trim() || null, notify });
      toast.success(`Pedido ${order.code} cancelado.`);
      onDone?.(r);
      onClose?.();
    } catch (e) {
      toast.error(orderErr(e, 'Não foi possível cancelar.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <CrmModal
      open={open}
      onClose={() => !busy && onClose?.()}
      disableClose={busy}
      title={`Cancelar o pedido ${order?.code || ''}`}
      subtitle={
        order?.charge && order.payment_status !== 'paid'
          ? 'A cobrança PIX em aberto também é cancelada.'
          : order?.payment_status === 'paid'
            ? 'Este pedido já foi pago — combine o estorno com o cliente.'
            : undefined
      }
      maxWidth="xs"
      footer={
        <>
          <Button color="inherit" onClick={onClose} disabled={busy} sx={{ textTransform: 'none' }}>
            Voltar
          </Button>
          <Button
            variant="contained"
            color="error"
            disableElevation
            onClick={submit}
            disabled={busy}
            startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <IconCircleX size={16} />}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
          >
            Cancelar pedido
          </Button>
        </>
      }
    >
      <Stack spacing={2}>
        <TextField
          size="small"
          label="Motivo (opcional)"
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 255))}
          fullWidth
          multiline
          minRows={2}
          autoFocus
          placeholder="Ex.: produto em falta"
          helperText="Aparece no histórico e no aviso ao cliente."
        />
        <Stack
          direction="row"
          spacing={1}
          alignItems="flex-start"
          sx={{ p: 1.25, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}
        >
          <Switch size="small" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Avisar o cliente pelo WhatsApp
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Só envia se o aviso de cancelamento estiver ligado nas Configurações.
            </Typography>
          </Box>
        </Stack>
      </Stack>
    </CrmModal>
  );
}
