import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import {
  IconBrandWhatsapp,
  IconBuildingStore,
  IconMessage,
  IconMinus,
  IconPlus,
  IconSearch,
  IconShoppingCartPlus,
  IconTrash,
  IconTruckDelivery,
  IconUser
} from '@tabler/icons-react';

import { get, post } from 'api/api';
import useAccess from 'hooks/useAccess';
import { TgListSkeleton } from 'views/pages/telegram/ui';
import { WaNumberChip, useWaSessions } from '../waKit';
import { fmtPhone, tint } from '../waShared';
import { CrmModal, MoneyField, formatBRL, waPrimaryBtn } from '../crm/crmKit';
import { THIN_SCROLL, fold } from '../chat/chatKit';
import { SectionLabel } from '../tickets/ticketKit';
import {
  ADDRESS_KIND_LABEL,
  API,
  CustomFieldInputs,
  DEFAULT_SETTINGS,
  PAYMENT_METHOD_LABEL,
  addressLine,
  computeTotals,
  orderErr
} from './orderKit';

// ============================================================================
// Novo pedido (painel): cliente cadastrado ou conversa (ou a conversa já fixa,
// quando aberto pelo chat), catálogo por categoria com quantidade, carrinho com
// prévia dos totais (a conta final é do servidor), entrega/retirada com endereços
// salvos do cliente ou digitado, forma de pagamento, desconto, observações,
// campos personalizados, unidade e "Avisar o cliente" → POST /whatsapp/orders.
// `prefill` = { chat?: { chat_id (uuid), name, phone, session }, customer?: { id, name, phone } }.
// Busca de cliente pela rota leve `GET /whatsapp/customer-pick` (vale sem a permissão de CRM); escolhido o cliente,
// os endereços/unidade vêm de `GET /whatsapp/customers/:id`. Desconto e "Sem cobrança" só com a permissão de
// cobranças (`whatsapp:finance`) — o back recusa sem ela.
// ============================================================================

const toggleSx = { '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 700, gap: 0.5, px: 1.5 } };

export default function NewOrderDialog({ open, onClose, onCreated, settings, units = [], fields = [], prefill }) {
  const s = settings || DEFAULT_SETTINGS;
  const { sessions } = useWaSessions(open ? 60000 : 0);
  const { hasPermission } = useAccess();
  const canFinance = hasPermission('whatsapp:finance');
  const fixedChat = prefill?.chat || null;

  const [mode, setMode] = useState('customer'); // chat | customer | conversation
  const [customer, setCustomer] = useState(null);
  const [chat, setChat] = useState(null);
  const [q, setQ] = useState('');
  const [options, setOptions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [linked, setLinked] = useState(null); // cliente da conversa escolhida (endereços salvos)
  const [catalog, setCatalog] = useState(null);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState({}); // product_id → qty
  const [deliveryMode, setDeliveryMode] = useState('pickup');
  const [addressId, setAddressId] = useState('');
  const [addressText, setAddressText] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [payment, setPayment] = useState('');
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [custom, setCustom] = useState({});
  const [unitId, setUnitId] = useState('');
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const searchSeq = useRef(0);
  const linkSeq = useRef(0);
  const custSeq = useRef(0);

  const methods = useMemo(() => (s.payment_methods || []).filter((m) => m !== 'link'), [s.payment_methods]);

  useEffect(() => {
    if (!open) return;
    setMode(fixedChat ? 'chat' : 'customer');
    setCustomer(prefill?.customer || null);
    setChat(fixedChat);
    setQ('');
    setOptions([]);
    setLinked(null);
    setSearch('');
    setCart({});
    setDeliveryMode(s.pickup?.enabled === false ? 'delivery' : 'pickup');
    setAddressId('');
    setAddressText('');
    setDeliveryNotes('');
    setPayment(methods[0] || 'none');
    setDiscount(0);
    setNotes('');
    setCustom({});
    setUnitId('');
    setNotify(true);
    get(`${API}/catalog`)
      .then((r) => setCatalog(r?.categories || []))
      .catch((e) => {
        setCatalog([]);
        toast.error(orderErr(e, 'Não foi possível carregar o catálogo.'));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // busca de cliente / conversa
  useEffect(() => {
    if (!open || mode === 'chat') return undefined;
    const t = window.setTimeout(async () => {
      const seq = ++searchSeq.current;
      setSearching(true);
      try {
        const r =
          mode === 'customer'
            ? await get('/whatsapp/customer-pick', { params: { q: q.trim() || undefined } })
            : await get('/whatsapp/chats', { params: { q: q.trim() || undefined, kind: 'dm', page_size: 20 } });
        if (seq === searchSeq.current) setOptions(Array.isArray(r) ? r : r?.items || []);
      } catch {
        if (seq === searchSeq.current) setOptions([]);
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [q, open, mode]);

  // cliente escolhido na busca (só id/nome/telefone) → cadastro completo (endereços salvos, unidade)
  const pickedId = mode === 'customer' && customer && !Array.isArray(customer.addresses) ? customer.id : null;
  useEffect(() => {
    if (!open || !pickedId) return;
    const seq = ++custSeq.current;
    get(`/whatsapp/customers/${encodeURIComponent(pickedId)}`)
      .then((r) => {
        const full = r?.customer || r;
        if (seq === custSeq.current && full?.id === pickedId) setCustomer((cur) => (cur?.id === pickedId ? { ...cur, ...full, addresses: Array.isArray(full.addresses) ? full.addresses : [] } : cur));
      })
      .catch(() => {
        if (seq === custSeq.current) setCustomer((cur) => (cur?.id === pickedId ? { ...cur, addresses: [] } : cur));
      });
  }, [open, pickedId]);

  // conversa escolhida → cliente dela (endereços salvos, unidade)
  const chatId = mode === 'chat' ? fixedChat?.chat_id : mode === 'conversation' ? chat?.chat_id : null;
  useEffect(() => {
    if (!open) return;
    const seq = ++linkSeq.current;
    if (!chatId) {
      setLinked(null);
      return;
    }
    if (mode === 'chat' && prefill?.customer?.addresses) {
      setLinked(prefill.customer);
      return;
    }
    get(`/whatsapp/customers/by-chat/${encodeURIComponent(chatId)}`, {
      params: prefill?.customer?.id && mode === 'chat' ? { customer_id: prefill.customer.id } : undefined
    })
      .then((r) => seq === linkSeq.current && setLinked(r?.customer || null))
      .catch(() => seq === linkSeq.current && setLinked(null));
  }, [open, chatId, mode, prefill?.customer]);

  const who = mode === 'customer' ? customer : linked;
  const addresses = useMemo(() => (Array.isArray(who?.addresses) ? who.addresses : []), [who]);
  // endereço padrão de entrega do cliente
  useEffect(() => {
    if (!addresses.length) {
      setAddressId('');
      return;
    }
    const def =
      addresses.find((a) => a.is_default && a.kind === 'delivery') ||
      addresses.find((a) => a.kind === 'delivery') ||
      addresses.find((a) => a.is_default) ||
      addresses[0];
    setAddressId(def?.id || '');
  }, [addresses]);
  useEffect(() => {
    if (who?.unit_id && !unitId) setUnitId(who.unit_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [who?.unit_id]);

  const products = useMemo(() => (catalog || []).flatMap((c) => c.products), [catalog]);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const filteredCatalog = useMemo(() => {
    const term = fold(search.trim());
    if (!term) return catalog || [];
    return (catalog || [])
      .map((c) => ({ ...c, products: c.products.filter((p) => fold(`${p.name} ${p.description || ''} ${c.name}`).includes(term)) }))
      .filter((c) => c.products.length);
  }, [catalog, search]);

  const lines = useMemo(
    () =>
      Object.entries(cart)
        .filter(([id, qty]) => qty > 0 && byId.has(id))
        .map(([id, qty]) => ({ product: byId.get(id), qty, unit_cents: byId.get(id).price_cents })),
    [cart, byId]
  );
  const totals = useMemo(() => computeTotals(lines, s, deliveryMode, discount), [lines, s, deliveryMode, discount]);
  const belowMin = s.min_order_cents > 0 && lines.length > 0 && totals.subtotal_cents < s.min_order_cents;
  const tooMany = lines.length > (s.max_items || 30);

  const setQty = (id, qty) => setCart((c) => ({ ...c, [id]: Math.max(0, Math.min(999, qty)) }));

  const submit = async () => {
    if (!lines.length) return toast.error('Adicione ao menos um produto.');
    if (mode === 'customer' && !customer) return toast.error('Escolha o cliente (ou mude para "Conversa").');
    if (mode === 'conversation' && !chat) return toast.error('Escolha a conversa.');
    if (deliveryMode === 'delivery' && !addressId && addressText.trim().length < 5) return toast.error('Informe o endereço de entrega.');
    setBusy(true);
    try {
      const body = {
        items: lines.map((l) => ({ product_id: l.product.id, qty: l.qty })),
        delivery: {
          mode: deliveryMode,
          ...(deliveryMode === 'delivery'
            ? addressId && addresses.some((a) => a.id === addressId)
              ? { address_id: addressId }
              : { address: addressText.trim() }
            : {}),
          ...(deliveryNotes.trim() ? { notes: deliveryNotes.trim() } : {})
        },
        payment_method: totals.total_cents > 0 ? payment || 'none' : 'none',
        discount_cents: canFinance ? discount || 0 : 0,
        notes: notes.trim() || undefined,
        custom: Object.keys(custom).length ? custom : undefined,
        unit_id: unitId || undefined,
        notify
      };
      if (mode === 'customer') body.customer_id = customer.id;
      else {
        body.chat_id = chatId;
        if (linked?.id) body.customer_id = linked.id;
      }
      const r = await post(API, body);
      const o = r?.order || r;
      toast.success(`Pedido ${o?.code || ''} criado${notify ? ' — o cliente recebe o resumo pelo WhatsApp' : ''}.`);
      onCreated?.(o);
      onClose?.();
    } catch (e) {
      toast.error(orderErr(e, 'Não foi possível criar o pedido.'));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  const whoBlock =
    mode === 'chat' ? (
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
        <IconBrandWhatsapp size={18} />
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {linked?.name || fixedChat?.name || fmtPhone(fixedChat?.phone) || 'Contato desta conversa'}
        </Typography>
        {fixedChat?.phone ? (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {fmtPhone(fixedChat.phone)}
          </Typography>
        ) : null}
        {fixedChat?.session && sessions.length > 1 ? <WaNumberChip session={fixedChat.session} /> : null}
      </Stack>
    ) : (
      <>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={mode}
          onChange={(_, v) => {
            if (!v) return;
            setMode(v);
            setOptions([]);
            setQ('');
          }}
          sx={{ mt: 0.75, mb: 1, ...toggleSx }}
        >
          <ToggleButton value="customer">
            <IconUser size={15} /> Cliente cadastrado
          </ToggleButton>
          <ToggleButton value="conversation">
            <IconMessage size={15} /> Conversa
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
                    {o.code ? ` · cód. ${o.code}` : ''}
                  </Typography>
                </Stack>
              </li>
            )}
            renderInput={(params) => <TextField {...params} size="small" label="Buscar cliente" placeholder="Nome, telefone ou código" />}
            noOptionsText={q ? 'Nenhum cliente encontrado' : 'Digite para buscar'}
          />
        ) : (
          <Autocomplete
            options={options}
            value={chat}
            loading={searching}
            onChange={(_, v) => setChat(v)}
            onInputChange={(_, v) => setQ(v)}
            getOptionLabel={(o) => o?.name || fmtPhone(o?.phone) || ''}
            isOptionEqualToValue={(a, b) => a?.chat_id === b?.chat_id}
            filterOptions={(x) => x}
            renderOption={(props, o) => (
              <li {...props} key={o.chat_id}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, width: '100%' }}>
                  <Stack sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                      {o.name || fmtPhone(o.phone)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                      {fmtPhone(o.phone)}
                    </Typography>
                  </Stack>
                  {sessions.length > 1 && o.session ? <WaNumberChip session={o.session} /> : null}
                </Stack>
              </li>
            )}
            renderInput={(params) => <TextField {...params} size="small" label="Buscar conversa" placeholder="Nome ou telefone" />}
            noOptionsText={q ? 'Nenhuma conversa encontrada' : 'Digite para buscar'}
          />
        )}
        {mode === 'conversation' && chat && !linked ? (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
            Contato ainda não é cliente — no PIX, o cadastro é criado sozinho.
          </Typography>
        ) : null}
      </>
    );

  return (
    <CrmModal
      open={open}
      onClose={() => !busy && onClose?.()}
      title="Novo pedido"
      subtitle="Preços sempre do cadastro de produtos (avulsos e ativos). O número do pedido é gerado ao salvar."
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
            disabled={busy || !lines.length || belowMin || tooMany || s.enabled === false}
            startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <IconShoppingCartPlus size={16} />}
            sx={waPrimaryBtn}
          >
            Criar pedido · {formatBRL(totals.total_cents)}
          </Button>
        </>
      }
    >
      {open ? (
        <Stack spacing={2}>
          {s.enabled === false ? (
            <Alert severity="warning">Pedidos estão desligados nas Configurações — ligue para criar pedidos.</Alert>
          ) : null}
          <Box>
            <SectionLabel>Cliente</SectionLabel>
            {whoBlock}
          </Box>

          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'minmax(0,7fr) minmax(0,5fr)' },
              alignItems: 'start'
            }}
          >
            {/* Catálogo */}
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <SectionLabel sx={{ flex: 1 }}>Catálogo</SectionLabel>
                <TextField
                  size="small"
                  placeholder="Buscar produto"
                  value={search}
                  onChange={(e) => setSearch(e.target.value.slice(0, 60))}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <IconSearch size={15} />
                      </InputAdornment>
                    )
                  }}
                  sx={{ width: { xs: '60%', sm: 220 } }}
                />
              </Stack>
              <Box
                sx={(t) => ({
                  ...THIN_SCROLL(t),
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  maxHeight: { xs: 'none', md: 420 },
                  overflowY: { xs: 'visible', md: 'auto' }
                })}
              >
                {catalog === null ? (
                  <Box sx={{ p: 1.5 }}>
                    <TgListSkeleton rows={3} />
                  </Box>
                ) : !filteredCatalog.length ? (
                  <Typography variant="body2" sx={{ p: 2, color: 'text.secondary' }}>
                    {search
                      ? 'Nenhum produto com esse nome.'
                      : 'Nenhum produto à venda. Cadastre produtos avulsos (tipo Produto, cobrança "Avulso") em Produtos.'}
                  </Typography>
                ) : (
                  filteredCatalog.map((cat) => (
                    <Box key={cat.name}>
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          px: 1.5,
                          py: 0.75,
                          fontWeight: 800,
                          color: 'text.secondary',
                          bgcolor: 'action.hover',
                          position: { md: 'sticky' },
                          top: 0,
                          zIndex: 1,
                          borderBottom: '1px solid',
                          borderColor: 'divider'
                        }}
                      >
                        {cat.name} · {cat.products.length}
                      </Typography>
                      {cat.products.map((p) => {
                        const qty = cart[p.id] || 0;
                        return (
                          <Stack
                            key={p.id}
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            sx={(t) => ({
                              px: 1.5,
                              py: 1,
                              borderBottom: '1px solid',
                              borderColor: 'divider',
                              bgcolor: qty ? tint(t, 'success', 0.07) : 'transparent'
                            })}
                          >
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
                                {p.name}
                              </Typography>
                              {p.description ? (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: 'text.secondary',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden'
                                  }}
                                >
                                  {p.description}
                                </Typography>
                              ) : null}
                              <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                                {p.price_label || formatBRL(p.price_cents)}
                              </Typography>
                            </Box>
                            {qty ? (
                              <Stack direction="row" alignItems="center" spacing={0.25} sx={{ flexShrink: 0 }}>
                                <IconButton size="small" onClick={() => setQty(p.id, qty - 1)} aria-label={`Menos ${p.name}`}>
                                  {qty === 1 ? <IconTrash size={16} /> : <IconMinus size={16} />}
                                </IconButton>
                                <TextField
                                  size="small"
                                  value={qty}
                                  onChange={(e) => setQty(p.id, parseInt(e.target.value.replace(/\D/g, '') || '0', 10))}
                                  inputProps={{ inputMode: 'numeric', style: { textAlign: 'center', padding: '4px 2px', width: 34 } }}
                                />
                                <IconButton size="small" onClick={() => setQty(p.id, qty + 1)} aria-label={`Mais ${p.name}`}>
                                  <IconPlus size={16} />
                                </IconButton>
                              </Stack>
                            ) : (
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<IconPlus size={14} />}
                                onClick={() => setQty(p.id, 1)}
                                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, flexShrink: 0 }}
                              >
                                Adicionar
                              </Button>
                            )}
                          </Stack>
                        );
                      })}
                    </Box>
                  ))
                )}
              </Box>
            </Box>

            {/* Carrinho */}
            <Box
              sx={{
                minWidth: 0,
                p: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                position: { md: 'sticky' },
                top: { md: 0 }
              }}
            >
              <SectionLabel sx={{ mb: 1 }}>Carrinho</SectionLabel>
              {lines.length ? (
                <Stack spacing={0.5}>
                  {lines.map((l) => (
                    <Stack key={l.product.id} direction="row" spacing={1} alignItems="baseline">
                      <Typography variant="body2" sx={{ fontWeight: 800, minWidth: 30 }}>
                        {l.qty}×
                      </Typography>
                      <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap title={l.product.name}>
                        {l.product.name}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {formatBRL(l.qty * l.unit_cents)}
                      </Typography>
                    </Stack>
                  ))}
                  <Divider sx={{ my: 0.75 }} />
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Subtotal
                    </Typography>
                    <Typography variant="body2">{formatBRL(totals.subtotal_cents)}</Typography>
                  </Stack>
                  {deliveryMode === 'delivery' ? (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Taxa de entrega
                      </Typography>
                      <Typography variant="body2">{totals.delivery_fee_cents ? formatBRL(totals.delivery_fee_cents) : 'Grátis'}</Typography>
                    </Stack>
                  ) : null}
                  {totals.discount_cents ? (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Desconto
                      </Typography>
                      <Typography variant="body2">− {formatBRL(totals.discount_cents)}</Typography>
                    </Stack>
                  ) : null}
                  <Stack direction="row" justifyContent="space-between">
                    <Typography sx={{ fontWeight: 800 }}>Total</Typography>
                    <Typography sx={{ fontWeight: 800 }}>{formatBRL(totals.total_cents)}</Typography>
                  </Stack>
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => setCart({})}
                    sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 600, mt: 0.5 }}
                  >
                    Limpar carrinho
                  </Button>
                </Stack>
              ) : (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Vazio — adicione produtos do catálogo.
                </Typography>
              )}
              {belowMin ? (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  Pedido mínimo: {formatBRL(s.min_order_cents)} (sem a taxa de entrega).
                </Alert>
              ) : null}
              {tooMany ? (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  No máximo {s.max_items} itens diferentes por pedido.
                </Alert>
              ) : null}
              {deliveryMode === 'delivery' && s.delivery?.free_from_cents > 0 && totals.delivery_fee_cents > 0 ? (
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
                  Entrega grátis a partir de {formatBRL(s.delivery.free_from_cents)}.
                </Typography>
              ) : null}
            </Box>
          </Box>

          {/* Entrega */}
          <Box>
            <SectionLabel>Entrega</SectionLabel>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={deliveryMode}
              onChange={(_, v) => v && setDeliveryMode(v)}
              sx={{ mt: 0.75, mb: 1, ...toggleSx }}
            >
              {s.pickup?.enabled !== false ? (
                <ToggleButton value="pickup">
                  <IconBuildingStore size={15} /> Retirada
                </ToggleButton>
              ) : null}
              {s.delivery?.enabled !== false ? (
                <ToggleButton value="delivery">
                  <IconTruckDelivery size={15} /> Entrega
                  {s.delivery?.fee_cents ? ` (${formatBRL(s.delivery.fee_cents)})` : ''}
                </ToggleButton>
              ) : null}
            </ToggleButtonGroup>
            {deliveryMode === 'pickup' ? (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Retirada no local{s.pickup?.address ? `: ${s.pickup.address}` : '.'}
              </Typography>
            ) : (
              <Stack spacing={1}>
                {addresses.length ? (
                  <Stack spacing={0.5}>
                    {addresses.map((a) => (
                      <Stack
                        key={a.id}
                        direction="row"
                        spacing={0.5}
                        alignItems="center"
                        onClick={() => setAddressId(a.id)}
                        sx={{
                          px: 0.5,
                          py: 0.25,
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: addressId === a.id ? 'primary.main' : 'divider',
                          cursor: 'pointer'
                        }}
                      >
                        <Radio size="small" checked={addressId === a.id} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
                            {addressLine(a)}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {a.label || ADDRESS_KIND_LABEL[a.kind] || 'Endereço'}
                            {a.is_default ? ' · padrão' : ''}
                          </Typography>
                        </Box>
                      </Stack>
                    ))}
                    <Stack
                      direction="row"
                      spacing={0.5}
                      alignItems="center"
                      onClick={() => setAddressId('')}
                      sx={{
                        px: 0.5,
                        py: 0.25,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: !addressId ? 'primary.main' : 'divider',
                        cursor: 'pointer'
                      }}
                    >
                      <Radio size="small" checked={!addressId} />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Outro endereço
                      </Typography>
                    </Stack>
                  </Stack>
                ) : null}
                {!addressId ? (
                  <TextField
                    size="small"
                    label="Endereço de entrega"
                    value={addressText}
                    onChange={(e) => setAddressText(e.target.value.slice(0, 255))}
                    fullWidth
                    multiline
                    minRows={2}
                    placeholder="Rua, número, complemento, bairro, cidade"
                  />
                ) : null}
                <TextField
                  size="small"
                  label="Referência para o entregador (opcional)"
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value.slice(0, 255))}
                  fullWidth
                />
              </Stack>
            )}
          </Box>

          {/* Pagamento + desconto + unidade */}
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(2, minmax(0,1fr))' } }}>
            <TextField
              select
              size="small"
              label="Forma de pagamento"
              value={totals.total_cents > 0 ? payment : 'none'}
              disabled={totals.total_cents <= 0}
              onChange={(e) => setPayment(e.target.value)}
              helperText={
                payment === 'pix' && totals.total_cents > 0
                  ? 'Gera a cobrança PIX e envia ao cliente.'
                  : payment === 'on_delivery'
                    ? 'O cliente paga ao receber/retirar.'
                    : ' '
              }
            >
              {methods.map((m) => (
                <MenuItem key={m} value={m}>
                  {PAYMENT_METHOD_LABEL[m] || m}
                </MenuItem>
              ))}
              {canFinance || payment === 'none' ? <MenuItem value="none">Sem cobrança</MenuItem> : null}
            </TextField>
            {canFinance ? (
              <MoneyField
                label="Desconto"
                valueCents={discount}
                onChange={setDiscount}
                helperText={discount ? `Desconto de ${formatBRL(totals.discount_cents)}` : 'Opcional'}
              />
            ) : null}
            {units.length ? (
              <TextField select size="small" label="Unidade" value={unitId} onChange={(e) => setUnitId(e.target.value)} helperText=" ">
                <MenuItem value="">Sem unidade{who?.unit_id ? ' (usa a do cliente)' : ''}</MenuItem>
                {units.map((u) => (
                  <MenuItem key={u.id} value={u.id}>
                    {u.name}
                  </MenuItem>
                ))}
              </TextField>
            ) : null}
          </Box>

          <TextField
            size="small"
            label="Observações (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
            fullWidth
            multiline
            minRows={2}
            placeholder="Ex.: sem cebola, troco para R$ 50"
          />

          {fields.length ? (
            <Box>
              <SectionLabel sx={{ mb: 1 }}>Campos do pedido</SectionLabel>
              <CustomFieldInputs fields={fields} value={custom} onChange={setCustom} />
            </Box>
          ) : null}

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
                Envia o resumo do pedido (texto &quot;Pedido recebido&quot; das Configurações). A cobrança PIX sai de qualquer jeito.
              </Typography>
            </Box>
          </Stack>
        </Stack>
      ) : null}
    </CrmModal>
  );
}
