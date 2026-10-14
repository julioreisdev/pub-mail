import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { IconBuildingStore, IconCalendarPlus, IconCash, IconPhone, IconSparkles, IconUser } from '@tabler/icons-react';

import { get, post } from 'api/api';
import { WaNumberSelect, useWaSessions } from '../waKit';
import { fmtPhone, onlyDigits } from '../waShared';
import { CrmModal, formatBRL, waPrimaryBtn } from '../crm/crmKit';
import SlotPicker from './SlotPicker';
import CustomFieldsInputs from '../crm/CustomFieldsInputs';
import { customErrorsFrom, customErrorsText, customPayload, useCustomFieldDefs, validateCustomLocal } from '../crm/customFields';
import { API, apptErr, errCode, paymentLabel, resourcesForService } from './agendaKit';

// ============================================================================
// Novo agendamento: cliente (busca) ou telefone, serviço, recurso (ou qualquer),
// calendário com vagas reais, pagamento (seguir o serviço / no local / cobrar agora),
// observações → POST /whatsapp/scheduling/appointments.
// `prefill` = { customer?, chat? {jid, session_id, name, phone, contact_id}, product_id?, resource_id? }
// (aberto de dentro da conversa ou de um horário vazio da agenda).
// 409 SLOT_TAKEN → recarrega os horários e avisa.
// ============================================================================

const normalizePhone = (v) => {
  const d = onlyDigits(v);
  if (!d) return '';
  return d.length === 10 || d.length === 11 ? `55${d}` : d;
};

const PAYMENT_HINT = {
  on_site: 'Este serviço é pago no local.',
  on_booking: 'Este serviço é pago na reserva: o cliente recebe o PIX e o horário fica reservado até o prazo de pagamento.',
  deposit: 'Este serviço pede um sinal na reserva.',
  included: 'Incluso nos planos de quem assina; sem plano (ou com os usos do ciclo esgotados), cobra na reserva.'
};

export default function NewAppointmentDialog({ open, onClose, onCreated, services = [], resources = [], prefill }) {
  const { sessions } = useWaSessions(open ? 60000 : 0);
  const connected = useMemo(() => sessions.filter((s) => s.connected || s.status === 'ready'), [sessions]);
  const [mode, setMode] = useState('customer'); // customer | phone
  const [customer, setCustomer] = useState(null);
  const [q, setQ] = useState('');
  const [options, setOptions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [productId, setProductId] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [slot, setSlot] = useState(null);
  const [payment, setPayment] = useState('auto');
  const [sessionId, setSessionId] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Fase 7: campos personalizados do agendamento
  const { defs: cfDefs } = useCustomFieldDefs('appointment');
  const [custom, setCustom] = useState({});
  const [cfErr, setCfErr] = useState(null);
  const searchSeq = useRef(0);

  const fixedChat = prefill?.chat || null;
  const fixedCustomer = prefill?.customer || null;

  useEffect(() => {
    if (!open) return;
    setMode(fixedCustomer || !fixedChat ? 'customer' : 'chat');
    setCustomer(fixedCustomer || null);
    setQ('');
    setPhone('');
    setName('');
    setProductId(prefill?.product_id || '');
    setResourceId(prefill?.resource_id || '');
    setSlot(null);
    setPayment('auto');
    setSessionId(fixedChat?.session_id || '');
    setNotes('');
    setCustom({});
    setCfErr(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // busca de cliente
  useEffect(() => {
    if (!open || mode !== 'customer' || fixedCustomer) return undefined;
    const t = window.setTimeout(async () => {
      const s = ++searchSeq.current;
      setSearching(true);
      try {
        const r = await get('/whatsapp/customers', { params: { q: q.trim() || undefined, status: 'active', page_size: 20 } });
        if (s === searchSeq.current) setOptions(r?.items || []);
      } catch {
        if (s === searchSeq.current) setOptions([]);
      } finally {
        if (s === searchSeq.current) setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [q, open, mode, fixedCustomer]);

  const service = services.find((s) => s.id === productId) || null;
  const svcResources = useMemo(() => resourcesForService(service, resources), [service, resources]);
  useEffect(() => {
    if (resourceId && service && !svcResources.some((r) => r.id === resourceId)) setResourceId('');
  }, [service, svcResources, resourceId]);
  useEffect(() => {
    setSlot(null);
  }, [productId, resourceId]);

  const policy = service?.booking?.payment || 'on_site';
  const showPayment = Boolean(service) && policy !== 'on_site';
  const askNumber = !fixedChat && mode !== 'chat' && connected.length > 1;

  const submit = async () => {
    if (!productId) return toast.error('Escolha o serviço.');
    if (!slot) return toast.error('Escolha um horário livre.');
    if (mode === 'customer' && !customer) return toast.error('Escolha o cliente (ou mude para "Telefone").');
    const digits = normalizePhone(phone);
    if (mode === 'phone' && digits.length < 12) return toast.error('Informe o WhatsApp com DDD.');
    const localErr = cfDefs.length ? validateCustomLocal(cfDefs, custom) : null;
    setCfErr(localErr);
    if (localErr) return toast.error(customErrorsText(cfDefs, localErr));
    setBusy(true);
    try {
      let chatJid = fixedChat?.jid || undefined;
      let sess = fixedChat?.session_id || sessionId || undefined;
      let contactId = fixedChat?.contact_id || undefined;
      if (mode === 'phone') {
        const chat = await post('/whatsapp/chats/open', { phone: digits, session_id: sess, ...(name.trim() ? { name: name.trim() } : {}) });
        chatJid = chat?.jid || undefined;
        sess = chat?.session_id || sess;
        contactId = chat?.contact_id || undefined;
      }
      const body = {
        product_id: productId,
        resource_id: resourceId || undefined,
        starts_at: slot.starts_at,
        customer_id: mode === 'customer' ? customer?.id : fixedCustomer?.id || undefined,
        contact_id: contactId,
        chat_id: chatJid,
        session_id: sess,
        payment: showPayment ? payment : 'auto',
        notes: notes.trim() || undefined,
        ...(cfDefs.length ? { custom: customPayload(cfDefs, custom) } : {})
      };
      const r = await post(`${API}/appointments`, body);
      const appt = r?.appointment || r;
      if (r?.charge) toast.success('Agendado. A cobrança foi gerada e enviada ao cliente.');
      else toast.success('Agendamento criado.');
      onCreated?.(appt, r);
      onClose?.();
    } catch (e) {
      if (errCode(e) === 'SLOT_TAKEN') {
        setSlot(null);
        setReloadKey((k) => k + 1);
      }
      const ce = customErrorsFrom(e);
      if (ce) setCfErr(ce);
      toast.error(ce ? customErrorsText(cfDefs, ce) : apptErr(e, 'Não foi possível agendar.'));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <CrmModal
      open={open}
      onClose={() => !busy && onClose?.()}
      title="Novo agendamento"
      subtitle="Só aparecem horários realmente livres (disponibilidade, bloqueios e capacidade)."
      maxWidth="md"
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
            disabled={busy || !slot}
            startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <IconCalendarPlus size={16} />}
            sx={waPrimaryBtn}
          >
            Agendar
          </Button>
        </>
      }
    >
      {open ? (
        <Stack spacing={2}>
          {/* Cliente */}
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Cliente
            </Typography>
            {mode === 'chat' ? (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75 }}>
                <IconUser size={18} />
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {fixedChat?.name || fmtPhone(fixedChat?.phone) || 'Contato desta conversa'}
                </Typography>
                {fixedChat?.phone && fixedChat?.name ? (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {fmtPhone(fixedChat.phone)}
                  </Typography>
                ) : null}
              </Stack>
            ) : fixedCustomer ? (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75 }}>
                <IconUser size={18} />
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {fixedCustomer.name}
                </Typography>
                {fixedCustomer.phone ? (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {fmtPhone(fixedCustomer.phone)}
                  </Typography>
                ) : null}
              </Stack>
            ) : (
              <>
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={mode}
                  onChange={(_, v) => v && setMode(v)}
                  sx={{ mt: 0.75, mb: 1, '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 700, gap: 0.5, px: 1.5 } }}
                >
                  <ToggleButton value="customer">
                    <IconUser size={15} /> Cliente cadastrado
                  </ToggleButton>
                  <ToggleButton value="phone">
                    <IconPhone size={15} /> Telefone
                  </ToggleButton>
                </ToggleButtonGroup>
                {mode === 'customer' ? (
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
                    renderInput={(params) => <TextField {...params} size="small" label="Buscar cliente" placeholder="Nome ou telefone" />}
                    noOptionsText={q ? 'Nenhum cliente com esse nome' : 'Digite para buscar'}
                  />
                ) : (
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <TextField
                      size="small"
                      label="WhatsApp"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.slice(0, 20))}
                      placeholder="(11) 98765-4321"
                      fullWidth
                      inputProps={{ inputMode: 'tel' }}
                      helperText="DDD + número; sem DDI usa +55."
                    />
                    <TextField
                      size="small"
                      label="Nome (opcional)"
                      value={name}
                      onChange={(e) => setName(e.target.value.slice(0, 80))}
                      fullWidth
                    />
                  </Stack>
                )}
              </>
            )}
          </Box>

          {/* Serviço + recurso */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              select
              size="small"
              label="Serviço"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              fullWidth
              helperText={
                service
                  ? `${service.duration_label || `${service.duration_minutes} min`} · ${service.price_label || formatBRL(service.price_cents)}`
                  : services.length
                    ? ' '
                    : 'Nenhum serviço cadastrado. Crie em Produtos (tipo Serviço).'
              }
            >
              {services.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                  <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>
                    {s.duration_label || `${s.duration_minutes} min`}
                  </Typography>
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Profissional / recurso"
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
              fullWidth
              disabled={!service}
              helperText={resourceId ? ' ' : 'Qualquer = o primeiro livre no horário escolhido.'}
            >
              <MenuItem value="">Qualquer</MenuItem>
              {svcResources.map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  {r.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          <SlotPicker productId={productId} resourceId={resourceId} value={slot} onChange={setSlot} reloadKey={reloadKey} />

          {showPayment ? (
            <Box>
              <Typography
                variant="caption"
                sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}
              >
                Pagamento
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={payment}
                onChange={(_, v) => v && setPayment(v)}
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  mt: 0.75,
                  '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 700, gap: 0.5, flex: 1 }
                }}
              >
                <ToggleButton value="auto">
                  <IconSparkles size={15} /> Seguir o serviço
                </ToggleButton>
                <ToggleButton value="on_site">
                  <IconBuildingStore size={15} /> No local
                </ToggleButton>
                <ToggleButton value="charge">
                  <IconCash size={15} /> Cobrar agora
                </ToggleButton>
              </ToggleButtonGroup>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                {payment === 'on_site'
                  ? 'O horário fica agendado sem cobrança; o cliente paga no atendimento.'
                  : payment === 'charge'
                    ? 'Gera a cobrança PIX e envia ao cliente; o horário fica reservado até o prazo de pagamento.'
                    : `${PAYMENT_HINT[policy] || paymentLabel(policy)}${
                        policy === 'deposit' && service?.booking?.deposit_cents
                          ? ` Sinal: ${formatBRL(service.booking.deposit_cents)}.`
                          : ''
                      }`}
              </Typography>
            </Box>
          ) : service ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              Pagamento no local — o agendamento fica confirmado sem cobrança.
            </Alert>
          ) : null}

          {askNumber ? (
            <WaNumberSelect
              sessions={connected}
              value={sessionId}
              onChange={setSessionId}
              allowAll
              allLabel="Automático (número da conversa do cliente)"
              label="Avisar pelo número"
            />
          ) : null}

          {cfDefs.length ? (
            <CustomFieldsInputs
              defs={cfDefs}
              values={custom}
              onChange={(v) => {
                setCustom(v);
                if (cfErr) setCfErr(null);
              }}
              errors={cfErr}
              disabled={busy}
            />
          ) : null}
          <TextField
            size="small"
            label="Observações (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 1000))}
            fullWidth
            multiline
            minRows={2}
            maxRows={5}
          />
        </Stack>
      ) : null}
    </CrmModal>
  );
}
