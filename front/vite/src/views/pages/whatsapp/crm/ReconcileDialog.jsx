import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { IconCheck, IconScale } from '@tabler/icons-react';

import { get, post } from 'api/api';
import { errMsg } from '../waShared';
import { CrmModal, todayIso, waPrimaryBtn } from './crmKit';

// ============================================================================
// Conciliação (Fase 4): lista as cobranças do Asaas no período e compara com as do Pub Mail.
// "Corrigir" = reconfere no gateway e, se foi pago lá, liquida aqui (recibo, assinatura avança).
// ============================================================================

const KINDS = {
  paid_remote: {
    label: 'Pago no Asaas, aberto aqui',
    color: 'error',
    help: 'O cliente pagou, mas o Pub Mail não confirmou. Corrigir liquida a cobrança.'
  },
  stale: { label: 'Vencida no Asaas, aberta aqui', color: 'warning', help: 'Corrigir reconfere e atualiza o status.' },
  missing_remote: {
    label: 'Não está no Asaas',
    color: 'warning',
    help: 'A cobrança não apareceu na listagem do Asaas. Corrigir reconfere.'
  },
  paid_local: {
    label: 'Paga aqui, não no Asaas',
    color: 'info',
    help: 'Confira no Asaas (estorno, chargeback ou pagamento por outro meio).'
  },
  double_paid: {
    label: 'Pago duas vezes (PIX e cartão)',
    color: 'error',
    help: 'O cliente pagou pelos dois meios. Estorne um dos pagamentos no gateway.'
  },
  unknown: { label: 'Só no Asaas', color: 'default', help: 'Cobrança criada direto no Asaas (fora do Pub Mail).' }
};
const VIA = { pix: 'PIX', boleto: 'Boleto', card: 'Cartão' };
const minusDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export default function ReconcileDialog({ open, onClose, onFixed }) {
  const [from, setFrom] = useState(() => minusDays(todayIso(), 30));
  const [to, setTo] = useState(() => todayIso());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState({});
  // sequência: resposta antiga (ou chegada depois de fechar) não sobrescreve a atual
  const seqRef = useRef(0);

  const run = async () => {
    const seq = ++seqRef.current;
    setLoading(true);
    try {
      const r = await get('/whatsapp/charges/reconcile', { params: { from, to } });
      if (seq !== seqRef.current) return;
      setData(r);
    } catch (e) {
      if (seq !== seqRef.current) return;
      toast.error(errMsg(e, 'Não foi possível conciliar.'));
      setData(null);
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  };
  useEffect(() => {
    if (open) run();
    else {
      seqRef.current += 1; // invalida a busca em andamento
      setData(null);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fix = async (it) => {
    const seq = seqRef.current;
    setFixing((m) => ({ ...m, [it.charge_id]: true }));
    try {
      const r = await post(`/whatsapp/charges/${it.charge_id}/reconcile-fix`);
      if (r?.fixed) onFixed?.();
      if (seq !== seqRef.current) return; // fechou / conciliou de novo enquanto corrigia
      if (r?.fixed) toast.success(r.message || 'Corrigido.');
      else toast(r?.message || 'Nada a corrigir.');
      setData((d) =>
        d
          ? {
              ...d,
              items: d.items.map((x) => (x.charge_id === it.charge_id ? { ...x, done: Boolean(r?.fixed), done_msg: r?.message } : x))
            }
          : d
      );
    } catch (e) {
      toast.error(errMsg(e, 'Falha ao corrigir.'));
    } finally {
      setFixing((m) => ({ ...m, [it.charge_id]: false }));
    }
  };

  const items = data?.items || [];
  return (
    <CrmModal
      open={open}
      onClose={onClose}
      title="Conciliar com o gateway"
      subtitle="Compara as cobranças do Asaas com as do Pub Mail (por data de criação)"
      maxWidth="md"
      footer={
        <Button color="inherit" onClick={onClose} sx={{ textTransform: 'none' }}>
          Fechar
        </Button>
      }
    >
      <Stack spacing={1.5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ sm: 'center' }}>
          <TextField
            size="small"
            type="date"
            label="De"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ max: to }}
          />
          <TextField
            size="small"
            type="date"
            label="Até"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: from, max: todayIso() }}
          />
          <Button
            variant="contained"
            disableElevation
            onClick={run}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <IconScale size={16} />}
            sx={waPrimaryBtn}
          >
            Conciliar
          </Button>
        </Stack>
        {data && !data.supported ? (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            A conciliação usa a listagem do Asaas. Cadastre a chave do Asaas em Configurações → Pagamentos para usar.
          </Alert>
        ) : null}
        {data?.supported ? (
          <Alert severity={items.length ? 'warning' : 'success'} sx={{ borderRadius: 2 }}>
            {data.remote_total} cobrança{data.remote_total === 1 ? '' : 's'} no Asaas · {data.ok_count} conferida
            {data.ok_count === 1 ? '' : 's'} sem diferença
            {items.length ? ` · ${items.length} divergência${items.length === 1 ? '' : 's'}` : ' · tudo certo'}
          </Alert>
        ) : null}
        {data?.supported && data.truncated ? (
          <Alert severity="warning" sx={{ borderRadius: 2 }}>
            Lista incompleta: mais de 500 cobranças no período — reduza o intervalo de datas para conferir tudo.
          </Alert>
        ) : null}
        {loading && !data ? (
          <Box sx={{ py: 4, display: 'grid', placeItems: 'center' }}>
            <CircularProgress size={26} />
          </Box>
        ) : null}
        {items.map((it, i) => {
          const k = KINDS[it.kind] || KINDS.unknown;
          return (
            <Box key={`${it.remote_id || it.charge_id}-${i}`} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ sm: 'center' }}>
                <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Chip size="small" color={k.color} label={k.label} sx={{ fontWeight: 700 }} />
                    {it.via ? <Chip size="small" variant="outlined" label={VIA[it.via] || it.via} /> : null}
                    {it.remote_status ? <Chip size="small" variant="outlined" label={`Asaas: ${it.remote_status}`} /> : null}
                  </Stack>
                  <Typography variant="body2" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
                    {it.charge_id
                      ? `${it.customer} · ${it.description}`
                      : it.external_reference
                        ? `Referência ${it.external_reference}`
                        : `Cobrança ${it.remote_id}`}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                    {it.amount_label || it.remote_value_label || ''}
                    {it.due_at ? ` · vence ${it.due_at.split('-').reverse().join('/')}` : ''}
                    {it.local_status ? ` · aqui: ${it.local_status}` : ''}
                    {it.remote_id ? ` · ${it.remote_id}` : ''}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {it.done_msg || k.help}
                  </Typography>
                </Stack>
                {it.fixable && it.charge_id ? (
                  it.done ? (
                    <Chip color="success" icon={<IconCheck size={14} />} label="Corrigido" />
                  ) : (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => fix(it)}
                      disabled={Boolean(fixing[it.charge_id])}
                      sx={{ fontWeight: 700, borderRadius: 2, flexShrink: 0 }}
                    >
                      {fixing[it.charge_id] ? 'Corrigindo…' : 'Corrigir'}
                    </Button>
                  )
                ) : null}
              </Stack>
            </Box>
          );
        })}
      </Stack>
    </CrmModal>
  );
}
