import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { IconBarcode, IconCash, IconQrcode, IconSend } from '@tabler/icons-react';

import { get, post } from 'api/api';
import { TgModal } from 'views/pages/telegram/ui';
import { errMsg, fmtPhone } from '../waShared';
import { MoneyField, billingShort, formatBRL, todayIso, waPrimaryBtn } from './crmKit';

// ============================================================================
// Nova cobrança (PIX e/ou boleto) — usada na tela Cobranças e no botão "Cobrar"
// da conversa. Com `customer` fixo não mostra a busca de cliente.
// ============================================================================

const hasBoletoData = (c) =>
  Boolean(c?.doc && c?.email && c?.address?.zip && c?.address?.street && c?.address?.number && c?.address?.city && c?.address?.state);

export default function ChargeDialog({ open, onClose, customer: fixedCustomer, products = [], onCreated }) {
  const [settings, setSettings] = useState(null);
  const [customer, setCustomer] = useState(fixedCustomer || null);
  const [options, setOptions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');
  const [f, setF] = useState({
    subscription_id: '',
    product_id: '',
    amount_cents: 0,
    description: '',
    kind: 'pix',
    due_at: todayIso(),
    send: true
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCustomer(fixedCustomer || null);
    setBusy(false);
    get('/whatsapp/charges/settings')
      .then((s) => {
        setSettings(s);
        setF((x) => ({
          ...x,
          kind: s?.default_kind === 'boleto' || s?.default_kind === 'both' ? (s.boleto_available ? s.default_kind : 'pix') : 'pix'
        }));
      })
      .catch(() => setSettings({ gateway_ready: false, boleto_available: false }));
    setF((x) => ({ ...x, subscription_id: '', product_id: '', amount_cents: 0, description: '', due_at: todayIso(), send: true }));
  }, [open, fixedCustomer]);

  // busca de cliente (quando não veio fixo)
  useEffect(() => {
    if (!open || fixedCustomer) return undefined;
    const t = window.setTimeout(async () => {
      setSearching(true);
      try {
        const r = await get('/whatsapp/customers', { params: { q: q.trim() || undefined, status: 'active', page_size: 20 } });
        setOptions(r?.items || []);
      } catch {
        setOptions([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [q, open, fixedCustomer]);

  // ao escolher cliente com 1 assinatura ativa, já pré-seleciona
  useEffect(() => {
    if (!customer) return;
    const live = (customer.subscriptions || []).filter((s) => s.status === 'active' || s.status === 'overdue');
    if (live.length === 1) pickSub(live[0].id, customer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id]);

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const pickSub = (id, c = customer) => {
    const s = (c?.subscriptions || []).find((x) => x.id === id);
    setF((x) => ({
      ...x,
      subscription_id: id,
      product_id: '',
      ...(s
        ? {
            amount_cents: s.price_cents,
            description: s.product_name,
            due_at: s.next_due_at && s.next_due_at >= todayIso() ? s.next_due_at : x.due_at
          }
        : {})
    }));
  };
  const pickProduct = (id) => {
    const p = products.find((x) => x.id === id);
    setF((x) => ({ ...x, product_id: id, subscription_id: '', ...(p ? { amount_cents: p.price_cents, description: p.name } : {}) }));
  };

  const live = useMemo(() => (customer?.subscriptions || []).filter((s) => s.status === 'active' || s.status === 'overdue'), [customer]);
  const boletoOk = Boolean(settings?.boleto_available);
  const boletoData = hasBoletoData(customer);
  const wantsBoleto = f.kind === 'boleto' || f.kind === 'both';

  const submit = async () => {
    if (!customer) return toast.error('Escolha o cliente.');
    if (!(f.amount_cents >= 100)) return toast.error('Informe um valor de pelo menos R$ 1,00.');
    if (!f.description.trim()) return toast.error('Descreva a cobrança (ex.: Mensalidade de outubro).');
    if (wantsBoleto && !boletoData) return toast.error('Para boleto, complete CPF/CNPJ, e-mail e endereço do cliente.');
    setBusy(true);
    try {
      const r = await post('/whatsapp/charges', {
        customer_id: customer.id,
        subscription_id: f.subscription_id || undefined,
        product_id: f.product_id || undefined,
        amount_cents: f.amount_cents,
        description: f.description.trim(),
        kind: f.kind,
        due_at: f.due_at,
        send: f.send
      });
      toast.success(f.send ? 'Cobrança enviada no WhatsApp.' : 'Cobrança criada.');
      onCreated?.(r);
      onClose?.();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível criar a cobrança.'));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <TgModal
      open={open}
      onClose={() => !busy && onClose?.()}
      title="Nova cobrança"
      subtitle={customer ? `${customer.name} · ${fmtPhone(customer.phone)}` : 'PIX e/ou boleto enviados direto na conversa do WhatsApp'}
      maxWidth="sm"
      disableClose={busy}
      footer={
        <>
          <Button color="inherit" onClick={onClose} disabled={busy} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={submit}
            disabled={busy || !settings?.gateway_ready}
            startIcon={busy ? <CircularProgress size={15} color="inherit" /> : f.send ? <IconSend size={16} /> : <IconCash size={16} />}
            sx={waPrimaryBtn}
          >
            {f.send ? 'Gerar e enviar' : 'Gerar cobrança'}
          </Button>
        </>
      }
    >
      <Stack spacing={1.5}>
        {settings && !settings.gateway_ready ? (
          <Alert severity="warning" sx={{ borderRadius: 2 }}>
            Configure o gateway de pagamento em <strong>Configurações → Pagamentos</strong> (Mercado Pago ou PushinPay) para gerar
            cobranças.
          </Alert>
        ) : null}
        {!fixedCustomer ? (
          <Autocomplete
            options={options}
            value={customer}
            loading={searching}
            onChange={(_, v) => setCustomer(v)}
            onInputChange={(_, v) => setQ(v)}
            getOptionLabel={(o) => o?.name || ''}
            isOptionEqualToValue={(a, b) => a?.id === b?.id}
            filterOptions={(x) => x}
            renderOption={(props, o) => (
              <li {...props} key={o.id}>
                <Stack sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                    {o.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                    {fmtPhone(o.phone)}
                    {o.products?.length ? ` · ${o.products.join(', ')}` : ''}
                  </Typography>
                </Stack>
              </li>
            )}
            renderInput={(params) => (
              <TextField {...params} size="small" label="Cliente" placeholder="Buscar por nome ou telefone" autoFocus />
            )}
            noOptionsText={q ? 'Nenhum cliente ativo com esse nome' : 'Digite para buscar'}
          />
        ) : null}

        {customer && live.length ? (
          <TextField
            select
            size="small"
            label="Assinatura (opcional)"
            value={f.subscription_id}
            onChange={(e) => pickSub(e.target.value)}
            fullWidth
            helperText="Ao pagar, o vencimento da assinatura avança sozinho."
          >
            <MenuItem value="">
              <em>Cobrança avulsa</em>
            </MenuItem>
            {live.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.product_name} · {s.price_label}
                {billingShort(s.billing)}
                {s.next_due_label ? ` · vence ${s.next_due_label}` : ''}
              </MenuItem>
            ))}
          </TextField>
        ) : null}
        {!f.subscription_id && products.length ? (
          <TextField
            select
            size="small"
            label="Produto (opcional)"
            value={f.product_id}
            onChange={(e) => pickProduct(e.target.value)}
            fullWidth
          >
            <MenuItem value="">
              <em>Valor livre</em>
            </MenuItem>
            {products
              .filter((p) => p.active)
              .map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name} · {formatBRL(p.price_cents)}
                </MenuItem>
              ))}
          </TextField>
        ) : null}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <MoneyField label="Valor" valueCents={f.amount_cents} onChange={(c) => set('amount_cents', c)} />
          <TextField
            size="small"
            type="date"
            label="Vencimento"
            value={f.due_at}
            onChange={(e) => set('due_at', e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: todayIso() }}
            fullWidth
          />
        </Stack>
        <TextField
          size="small"
          label="Descrição (aparece na mensagem e no extrato)"
          value={f.description}
          onChange={(e) => set('description', e.target.value.slice(0, 255))}
          fullWidth
          placeholder="Ex.: Mensalidade de outubro"
        />

        <Stack spacing={0.75}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
            Como o cliente paga
          </Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={f.kind}
            onChange={(_, v) => v && set('kind', v)}
            fullWidth
            sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 700, gap: 0.75 } }}
          >
            <ToggleButton value="pix">
              <IconQrcode size={16} /> PIX
            </ToggleButton>
            <ToggleButton value="boleto" disabled={!boletoOk}>
              <IconBarcode size={16} /> Boleto
            </ToggleButton>
            <ToggleButton value="both" disabled={!boletoOk}>
              PIX + Boleto
            </ToggleButton>
          </ToggleButtonGroup>
          {settings && !boletoOk && settings.gateway_ready ? (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Boleto só com o Mercado Pago (o gateway atual é {settings.provider === 'pushinpay' ? 'PushinPay' : 'outro'}).
            </Typography>
          ) : null}
          {wantsBoleto && customer && !boletoData ? (
            <Alert severity="warning" sx={{ borderRadius: 2, py: 0.5 }}>
              Para boleto o cliente precisa de <strong>CPF/CNPJ, e-mail e endereço completo</strong>. Complete o cadastro em Clientes.
            </Alert>
          ) : null}
          {settings ? (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              PIX vale até {settings.pix_days} dia{settings.pix_days === 1 ? '' : 's'} após o vencimento; boleto até {settings.boleto_days}.
              A confirmação é automática.
            </Typography>
          ) : null}
        </Stack>
        <FormControlLabel
          control={<Switch size="small" checked={f.send} onChange={(e) => set('send', e.target.checked)} />}
          label={<Typography variant="body2">Enviar agora na conversa do WhatsApp</Typography>}
        />
      </Stack>
    </TgModal>
  );
}
