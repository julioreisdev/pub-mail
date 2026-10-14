import { useEffect, useMemo, useRef, useState } from 'react';
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
import { IconBarcode, IconCash, IconCreditCard, IconQrcode, IconSend } from '@tabler/icons-react';

import { get, post } from 'api/api';
import { WaNumberChip, WaNumberSelect, useWaSessions } from '../waKit';
import { errMsg, fmtPhone } from '../waShared';
import { CrmModal, MoneyField, billingShort, fmtDateBR, formatBRL, todayIso, waPrimaryBtn } from './crmKit';
import CustomFieldsInputs from './CustomFieldsInputs';
import { customErrorsFrom, customErrorsText, customPayload, useCustomFieldDefs, validateCustomLocal } from './customFields';

// ============================================================================
// Nova cobrança (PIX e/ou boleto) — usada na tela Cobranças e no botão "Cobrar"
// da conversa. Com `customer` fixo não mostra a busca de cliente.
// Multi-número: `chatId` (uuid da conversa) → a cobrança sai pelo número dessa conversa
// (POST com `chat_id`, sem seletor). Sem conversa (por cliente) e com > 1 número conectado,
// mostra "Enviar pelo número" (`session_id`; padrão = número da conversa mais recente do cliente).
// ============================================================================

// O que o cadastro precisa para cada gateway: Mercado Pago (boleto) = CPF, e-mail e endereço; Asaas = só CPF/CNPJ.
const hasDoc = (c) => [11, 14].includes(String(c?.doc || '').replace(/\D/g, '').length);
const hasBoletoData = (c, provider) =>
  provider === 'asaas'
    ? hasDoc(c)
    : Boolean(c?.doc && c?.email && c?.address?.zip && c?.address?.street && c?.address?.number && c?.address?.city && c?.address?.state);

/** Meio padrão das cobranças (Configurações de cobrança), respeitando o que o gateway consegue emitir. */
const defaultKind = (s) =>
  s?.default_kind === 'boleto' || s?.default_kind === 'both' ? (s.boleto_available ? s.default_kind : 'pix') : 'pix';
/**
 * Meio da cobrança a partir da forma de pagamento da assinatura (`payment_method` pix|boleto|both|card|null),
 * só se o gateway permitir; null = padrão das configurações.
 */
const kindFromSub = (sub, s) => {
  const pm = sub?.payment_method;
  if (pm === 'card' && s?.card_available) return { kind: 'card', payment_method_id: sub.payment_method_id || '' };
  if ((pm === 'boleto' || pm === 'both') && s?.boleto_available) return { kind: pm, payment_method_id: '' };
  if (pm === 'pix') return { kind: 'pix', payment_method_id: '' };
  return { kind: defaultKind(s), payment_method_id: '' };
};

export default function ChargeDialog({ open, onClose, customer: fixedCustomer, chatId, chat, products = [], onCreated }) {
  const { sessions, byId: sessionsById } = useWaSessions(open ? 30000 : 0);
  const connectedSessions = useMemo(() => sessions.filter((s) => s.connected || s.status === 'ready'), [sessions]);
  const [sessionId, setSessionId] = useState('');
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
    send: true,
    payment_method_id: '',
    installments: 1
  });
  const [busy, setBusy] = useState(false);
  const [cards, setCards] = useState([]);
  // Fase 7: campos personalizados da cobrança
  const { defs: cfDefs } = useCustomFieldDefs('charge');
  const [custom, setCustom] = useState({});
  const [cfErr, setCfErr] = useState(null);
  const searchSeq = useRef(0);
  const settingsSeq = useRef(0);

  // ao abrir: zera o formulário e busca as configurações (meio padrão, o que o gateway emite)
  useEffect(() => {
    if (!open) return;
    setBusy(false);
    setCustom({});
    setCfErr(null);
    setF((x) => ({
      ...x,
      subscription_id: '',
      product_id: '',
      amount_cents: 0,
      description: '',
      due_at: todayIso(),
      send: true,
      payment_method_id: '',
      installments: 1
    }));
    const seq = ++settingsSeq.current;
    get('/whatsapp/charges/settings')
      .then((s) => {
        if (seq !== settingsSeq.current) return;
        setSettings(s);
        setF((x) => ({ ...x, kind: defaultKind(s), payment_method_id: '', installments: 1 }));
      })
      .catch(() => seq === settingsSeq.current && setSettings({ gateway_ready: false, boleto_available: false }));
  }, [open]);
  // cliente fixo (botão "Cobrar" do chat): sincroniza por id — o objeto muda de identidade a cada
  // recarga do painel e não pode zerar o que o usuário já digitou
  const fixedId = fixedCustomer?.id || null;
  useEffect(() => {
    if (open) setCustomer(fixedCustomer || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fixedId]);

  // cartões salvos do cliente (Fase 4) — só quando o cartão está disponível
  useEffect(() => {
    if (!open || !customer?.id || !settings?.card_available) {
      setCards([]);
      return;
    }
    get(`/whatsapp/customers/${customer.id}/payment-methods`)
      .then((r) => setCards(Array.isArray(r) ? r : []))
      .catch(() => setCards([]));
  }, [open, customer?.id, settings?.card_available]);

  // busca de cliente (quando não veio fixo); sequência = resposta antiga não sobrescreve a mais nova
  useEffect(() => {
    if (!open || fixedId) return undefined;
    const t = window.setTimeout(async () => {
      const seq = ++searchSeq.current;
      setSearching(true);
      try {
        const r = await get('/whatsapp/customers', { params: { q: q.trim() || undefined, status: 'active', page_size: 20 } });
        if (seq !== searchSeq.current) return;
        setOptions(r?.items || []);
      } catch {
        if (seq === searchSeq.current) setOptions([]);
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [q, open, fixedId]);

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  // escolher assinatura: valor/descrição/vencimento dela e o MEIO da forma de pagamento dela (cartão salvo
  // → cobra no cartão; boleto/PIX+boleto só se o gateway emite boleto; sem forma → padrão das configurações)
  const pickSub = (id, c = customer, s0 = settings) => {
    const s = (c?.subscriptions || []).find((x) => x.id === id);
    setF((x) => ({
      ...x,
      subscription_id: id,
      product_id: '',
      installments: 1,
      ...(s
        ? {
            amount_cents: s.price_cents,
            description: s.product_name,
            due_at: s.next_due_at && s.next_due_at >= todayIso() ? s.next_due_at : x.due_at,
            ...kindFromSub(s, s0)
          }
        : { payment_method_id: '' })
    }));
  };

  // Abriu / trocou de cliente (ou as configurações chegaram): limpa o que era do cliente anterior
  // (assinatura, produto, cartão, valor, descrição, parcelas) e pré-seleciona de novo — cliente com 1
  // assinatura ativa já entra com ela; o número padrão é o da conversa mais recente dele (se conectado).
  const customerKey = customer?.id || null;
  useEffect(() => {
    if (!open) return;
    setF((x) => ({ ...x, subscription_id: '', product_id: '', payment_method_id: '', amount_cents: 0, description: '', installments: 1 }));
    if (!customer) {
      setSessionId('');
      return;
    }
    const live = (customer.subscriptions || []).filter((s) => s.status === 'active' || s.status === 'overdue');
    if (live.length === 1) pickSub(live[0].id, customer, settings);
    const recent = (customer.chats || []).find((c) => {
      const sess = sessionsById.get(c.session_id);
      return sess && (sess.connected || sess.status === 'ready');
    });
    setSessionId(recent?.session_id || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customerKey, settings]);
  const pickProduct = (id) => {
    const p = products.find((x) => x.id === id);
    setF((x) => ({
      ...x,
      product_id: id,
      subscription_id: '',
      installments: 1,
      ...(p ? { amount_cents: p.price_cents, description: p.name } : {})
    }));
  };

  const live = useMemo(() => (customer?.subscriptions || []).filter((s) => s.status === 'active' || s.status === 'overdue'), [customer]);
  const boletoOk = Boolean(settings?.boleto_available);
  const cardOk = Boolean(settings?.card_available);
  const boletoData = hasBoletoData(customer, settings?.providers?.boleto);
  const wantsBoleto = f.kind === 'boleto' || f.kind === 'both';
  const wantsPix = f.kind === 'pix' || f.kind === 'both';
  const docOk = hasDoc(customer);
  const pixNeedsDoc = wantsPix && settings?.providers?.pix === 'asaas' && customer && !docOk;
  const cardNeedsDoc = f.kind === 'card' && customer && !docOk;
  // parcelas: só produto avulso (sem assinatura) com `installments_max` > 1 e parcela ≥ R$ 5,00
  const product = products.find((p) => p.id === f.product_id);
  const maxInst =
    !f.subscription_id && product && product.billing === 'once'
      ? Math.max(1, Math.min(product.installments_max || 1, 12, Math.floor((f.amount_cents || 0) / 500)))
      : 1;
  // número pelo qual a cobrança sai: o da conversa (quando aberta de dentro do chat) ou o escolhido
  const chatSession = chat?.session || (chat?.session_id ? sessionsById.get(chat.session_id) : null) || null;
  const askNumber = !chatId && connectedSessions.length > 1;

  const submit = async () => {
    if (!customer) return toast.error('Escolha o cliente.');
    if (!(f.amount_cents >= 100)) return toast.error('Informe um valor de pelo menos R$ 1,00.');
    if (!f.description.trim()) return toast.error('Descreva a cobrança (ex.: Mensalidade de outubro).');
    if (wantsBoleto && !boletoData)
      return toast.error(
        settings?.providers?.boleto === 'asaas'
          ? 'Para boleto pelo Asaas, cadastre o CPF/CNPJ do cliente.'
          : 'Para boleto, complete CPF/CNPJ, e-mail e endereço do cliente.'
      );
    if (pixNeedsDoc || cardNeedsDoc) return toast.error('O Asaas exige o CPF/CNPJ do cliente. Complete o cadastro em Clientes.');
    const localErr = cfDefs.length ? validateCustomLocal(cfDefs, custom) : null;
    setCfErr(localErr);
    if (localErr) return toast.error(customErrorsText(cfDefs, localErr));
    setBusy(true);
    try {
      const r = await post('/whatsapp/charges', {
        customer_id: customer.id,
        ...(chatId ? { chat_id: chatId } : askNumber && sessionId ? { session_id: sessionId } : {}),
        subscription_id: f.subscription_id || undefined,
        product_id: f.product_id || undefined,
        amount_cents: f.amount_cents,
        description: f.description.trim(),
        kind: f.kind,
        due_at: f.due_at,
        send: f.send,
        ...(f.kind === 'card' && f.payment_method_id ? { payment_method_id: f.payment_method_id } : {}),
        ...(f.kind === 'card' && !f.payment_method_id && maxInst > 1 ? { installments: Math.min(maxInst, f.installments || 1) } : {}),
        ...(cfDefs.length ? { custom: customPayload(cfDefs, custom) } : {})
      });
      // o aviso diz o que de fato aconteceu: cartão salvo = debitado agora / agendado / recusado;
      // cartão pela página segura = link enviado; PIX/boleto = enviado ou só criado
      if (f.kind === 'card' && f.payment_method_id)
        toast.success(
          r?.status === 'PAID'
            ? 'Debitado no cartão salvo ✅'
            : r?.card?.error
              ? `Cartão recusado: ${r.card.error}`
              : `Débito agendado para ${r?.due_label || fmtDateBR(f.due_at)}`
        );
      else if (f.kind === 'card') toast.success(f.send ? 'Link do cartão enviado no WhatsApp.' : 'Cobrança criada.');
      else toast.success(f.send ? 'Cobrança enviada no WhatsApp.' : 'Cobrança criada.');
      onCreated?.(r);
      onClose?.();
    } catch (e) {
      const ce = customErrorsFrom(e);
      if (ce) setCfErr(ce);
      toast.error(ce ? customErrorsText(cfDefs, ce) : errMsg(e, 'Não foi possível criar a cobrança.'));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <CrmModal
      open={open}
      onClose={() => !busy && onClose?.()}
      title="Nova cobrança"
      subtitle={
        customer ? (
          <Stack direction="row" spacing={0.75} alignItems="center" component="span" sx={{ display: 'inline-flex', flexWrap: 'wrap' }}>
            <span>
              {customer.name} · {fmtPhone(customer.phone)}
            </span>
            {chatId && chatSession && sessions.length > 1 ? <WaNumberChip session={chatSession} /> : null}
          </Stack>
        ) : (
          'PIX e/ou boleto enviados direto na conversa do WhatsApp'
        )
      }
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
            Configure o gateway de pagamento em <strong>Configurações → Pagamentos</strong> (Mercado Pago, PushinPay ou Asaas) para gerar
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
            sx={{
              '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 700, gap: 0.75, minHeight: 40, px: { xs: 0.5, sm: 1.5 } }
            }}
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
            {cardOk ? (
              <ToggleButton value="card">
                <IconCreditCard size={16} /> Cartão
              </ToggleButton>
            ) : null}
          </ToggleButtonGroup>
          {settings && !boletoOk && settings.gateway_ready ? (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Boleto precisa de um gateway que emita boleto (Mercado Pago ou Asaas) em Configurações → Pagamentos.
            </Typography>
          ) : null}
          {wantsBoleto && customer && !boletoData ? (
            <Alert severity="warning" sx={{ borderRadius: 2, py: 0.5 }}>
              {settings?.providers?.boleto === 'asaas' ? (
                <>
                  Para boleto pelo Asaas o cliente precisa de <strong>CPF/CNPJ</strong>. Complete o cadastro em Clientes.
                </>
              ) : (
                <>
                  Para boleto o cliente precisa de <strong>CPF/CNPJ, e-mail e endereço completo</strong>. Complete o cadastro em Clientes.
                </>
              )}
            </Alert>
          ) : null}
          {pixNeedsDoc || cardNeedsDoc ? (
            <Alert severity="warning" sx={{ borderRadius: 2, py: 0.5 }}>
              {f.kind === 'card' ? 'O cartão' : 'O PIX'} sai pelo Asaas, que exige o <strong>CPF/CNPJ</strong> do cliente. Complete o
              cadastro em Clientes.
            </Alert>
          ) : null}
          {f.kind === 'card' && customer ? (
            <Stack spacing={1}>
              <TextField
                select
                size="small"
                label="Cartão"
                SelectProps={{ displayEmpty: true }}
                InputLabelProps={{ shrink: true }}
                value={f.payment_method_id}
                onChange={(e) => set('payment_method_id', e.target.value)}
                fullWidth
                helperText={
                  f.payment_method_id
                    ? 'Debitado sozinho no vencimento (se vencer hoje, na hora). Recusado: avisa o cliente e tenta de novo em 2 e 5 dias; depois vira PIX.'
                    : 'O cliente recebe o link da página segura do Asaas e digita o cartão lá — ele fica salvo para as próximas cobranças.'
                }
              >
                <MenuItem value="">Página segura (o cliente digita o cartão)</MenuItem>
                {cards.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.brand || 'Cartão'} final {c.last4 || '••••'}
                    {c.failures ? ` · ${c.failures} recusa${c.failures === 1 ? '' : 's'}` : ''}
                  </MenuItem>
                ))}
              </TextField>
              {!f.payment_method_id && maxInst > 1 ? (
                <TextField
                  select
                  size="small"
                  label="Parcelas"
                  value={Math.min(f.installments || 1, maxInst)}
                  onChange={(e) => set('installments', Number(e.target.value))}
                  fullWidth
                  helperText="O cliente pode mudar a quantidade de parcelas na página de pagamento."
                >
                  {Array.from({ length: maxInst }, (_, i) => i + 1).map((n) => (
                    <MenuItem key={n} value={n}>
                      {n === 1 ? 'À vista' : `${n}× de ${formatBRL(Math.round((f.amount_cents || 0) / n))}`}
                    </MenuItem>
                  ))}
                </TextField>
              ) : null}
            </Stack>
          ) : null}
          {settings && f.kind !== 'card' ? (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              PIX vale até {settings.pix_days} dia{settings.pix_days === 1 ? '' : 's'} após o vencimento; boleto até {settings.boleto_days}.
              A confirmação é automática.
            </Typography>
          ) : null}
        </Stack>
        {askNumber ? (
          <WaNumberSelect
            sessions={sessions}
            value={sessionId}
            onChange={setSessionId}
            onlyConnected
            allowAll
            allLabel="Automático (conversa mais recente do cliente)"
            label="Enviar pelo número"
            helperText="A cobrança, os lembretes e o recibo saem por este número."
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
        <FormControlLabel
          control={<Switch size="small" checked={f.send} onChange={(e) => set('send', e.target.checked)} />}
          label={<Typography variant="body2">Enviar agora na conversa do WhatsApp</Typography>}
        />
      </Stack>
    </CrmModal>
  );
}
