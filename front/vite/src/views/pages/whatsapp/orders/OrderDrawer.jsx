import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  IconArrowRight,
  IconBrandWhatsapp,
  IconBuildingStore,
  IconCash,
  IconCircleX,
  IconCopy,
  IconDeviceFloppy,
  IconMapPin,
  IconUser,
  IconX
} from '@tabler/icons-react';

import { get, patch, post } from 'api/api';
import { useAuth } from 'contexts/AuthContext';
import { useRealtimeEvent } from 'realtime/useRealtime';
import { TgListSkeleton } from 'views/pages/telegram/ui';
import { WaNumberChip } from '../waKit';
import { fmtDateTime, fmtPhone } from '../waShared';
import { chatUrl, formatBRL, waPrimaryBtn } from '../crm/crmKit';
import { THIN_SCROLL } from '../chat/chatKit';
import { SectionLabel, copyText } from '../tickets/ticketKit';
import CancelOrderDialog from './CancelOrderDialog';
import {
  API,
  CustomFieldInputs,
  DeliveryChip,
  OrderStatusChip,
  PAYMENT_METHOD_LABEL,
  PaymentChip,
  actionLabel,
  addressLine,
  customEntries,
  moveOrder,
  orderErr,
  orderPersonName,
  orderPersonPhone,
  orderStatusOf
} from './orderKit';

// ============================================================================
// Gaveta do pedido (`?order=<id>`): itens e totais, entrega, pagamento (PIX
// copia-e-cola, "Marcar como pago"), ações de andamento (próximos status
// permitidos; cancelar com motivo), unidade, observações, campos personalizados,
// histórico e "Abrir conversa". Tempo real `wa:order` atualiza o pedido aberto.
// ============================================================================

const BY_LABEL = { staff: 'Equipe', customer: 'Cliente', system: 'Sistema', bot: 'Bot', api: 'API' };
const SOURCE_LABEL = { bot: 'pelo bot', panel: 'pelo painel', api: 'pela API' };

function Money({ label, cents, strong, negative }) {
  return (
    <Stack direction="row" justifyContent="space-between" sx={{ py: 0.25 }}>
      <Typography
        variant={strong ? 'body1' : 'body2'}
        sx={{ fontWeight: strong ? 800 : 500, color: strong ? 'text.primary' : 'text.secondary' }}
      >
        {label}
      </Typography>
      <Typography variant={strong ? 'body1' : 'body2'} sx={{ fontWeight: strong ? 800 : 600, fontVariantNumeric: 'tabular-nums' }}>
        {negative && cents ? '− ' : ''}
        {formatBRL(cents)}
      </Typography>
    </Stack>
  );
}

export default function OrderDrawer({ orderId, initial, onClose, onChanged, fields = [], units = [] }) {
  const navigate = useNavigate();
  // "Marcar como pago" = baixa manual (dinheiro entrando): só dono/admin, igual à baixa manual de cobrança
  const { user } = useAuth();
  const canMarkPaid = ['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(user?.user?.role);
  const open = Boolean(orderId);
  const [o, setO] = useState(initial || null);
  const [busy, setBusy] = useState('');
  const [notify, setNotify] = useState(true);
  const [cancel, setCancel] = useState(false);
  const [notes, setNotes] = useState('');
  const [custom, setCustom] = useState({});
  const seq = useRef(0);
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  const sync = useCallback((row) => {
    setO(row);
    setNotes(row?.notes || '');
    setCustom(row?.custom || {});
  }, []);

  const load = useCallback(async () => {
    if (!orderId) return;
    const s = ++seq.current;
    try {
      const r = await get(`${API}/${orderId}`);
      if (s === seq.current && r?.id) sync(r);
    } catch (e) {
      if (s === seq.current) {
        toast.error(orderErr(e, 'Não foi possível abrir o pedido.'));
        if (e?.response?.status === 404) onClose?.();
      }
    }
  }, [orderId, onClose, sync]);

  useEffect(() => {
    if (!open) return;
    if (initial) sync(initial);
    else setO(null);
    setNotify(true);
    setCancel(false);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, open]);

  useRealtimeEvent('wa:order', (p) => {
    const row = p?.order;
    if (!row?.id || row.id !== orderId) return;
    setO(row); // notas/campos em edição ficam como estão
  });

  const apply = (row) => {
    if (row?.id) {
      sync(row);
      onChangedRef.current?.(row);
    }
  };

  const move = async (to) => {
    setBusy(to);
    try {
      const r = await moveOrder(o.id, to, { notify });
      apply(r);
      toast.success(`${o.code}: ${orderStatusOf(to).label.toLowerCase()}.`);
    } catch (e) {
      toast.error(orderErr(e, 'Não foi possível mudar o status.'));
      load();
    } finally {
      setBusy('');
    }
  };

  const markPaid = async () => {
    setBusy('paid');
    try {
      const r = await post(`${API}/${o.id}/mark-paid`);
      apply(r);
      toast.success(`${o.code} marcado como pago.`);
    } catch (e) {
      toast.error(orderErr(e, 'Não foi possível marcar como pago.'));
    } finally {
      setBusy('');
    }
  };

  const save = async (key, data, okMsg) => {
    setBusy(key);
    try {
      const r = await patch(`${API}/${o.id}`, data);
      apply(r);
      toast.success(okMsg);
    } catch (e) {
      toast.error(orderErr(e, 'Não foi possível salvar.'));
    } finally {
      setBusy('');
    }
  };

  const copyPix = async () => {
    const ok = await copyText(o?.charge?.pix_code || '');
    toast[ok ? 'success' : 'error'](ok ? 'Código PIX copiado.' : 'Não foi possível copiar.');
  };

  if (!open) return null;
  const person = orderPersonName(o);
  const phone = orderPersonPhone(o);
  const forward = (o?.next_statuses || []).filter((s) => s !== 'canceled');
  const canCancel = (o?.next_statuses || []).includes('canceled');
  const isDelivery = o?.delivery?.mode === 'delivery';
  const addr = isDelivery ? addressLine(o?.delivery?.address) : '';
  const notesDirty = (notes || '') !== (o?.notes || '');
  const customDirty = JSON.stringify(custom || {}) !== JSON.stringify(o?.custom || {});
  const extraCustom = customEntries([], o?.custom || {}).filter((x) => !fields.some((f) => f.key === x.key));
  const history = [...(o?.history || [])].reverse();

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 520 }, height: '100dvh', display: 'flex', flexDirection: 'column' } }}
    >
      {/* Cabeçalho */}
      <Box sx={{ p: 2, pb: 1.5, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
        <Stack direction="row" alignItems="flex-start" spacing={1}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography sx={{ fontWeight: 800, fontSize: 20, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}>
                {o?.code || 'Pedido'}
              </Typography>
              {o ? <OrderStatusChip status={o.status} label={o.status_label} size="md" /> : null}
              {o ? <Typography sx={{ fontWeight: 800, ml: 'auto !important' }}>{o.total_label}</Typography> : null}
            </Stack>
            {o ? (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
                Criado {SOURCE_LABEL[o.source] || ''} em {fmtDateTime(o.created_at)}
              </Typography>
            ) : null}
          </Box>
          <IconButton size="small" onClick={onClose} aria-label="Fechar">
            <IconX size={18} />
          </IconButton>
        </Stack>
      </Box>

      {!o ? (
        <Box sx={{ p: 2 }}>
          <TgListSkeleton rows={4} />
        </Box>
      ) : (
        <Box sx={(t) => ({ ...THIN_SCROLL(t), overflowY: 'auto', flex: 1 })}>
          {/* Andamento */}
          {forward.length || canCancel ? (
            <Box sx={{ p: 2 }}>
              <SectionLabel sx={{ mb: 1 }}>Andamento</SectionLabel>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {forward.map((s, i) => (
                  <Button
                    key={s}
                    size="small"
                    variant={i === 0 ? 'contained' : 'outlined'}
                    disableElevation
                    disabled={Boolean(busy)}
                    onClick={() => move(s)}
                    startIcon={busy === s ? <CircularProgress size={14} color="inherit" /> : <IconArrowRight size={15} />}
                    sx={
                      i === 0
                        ? { ...waPrimaryBtn, flex: { xs: '1 1 100%', sm: '0 0 auto' } }
                        : { textTransform: 'none', fontWeight: 700, borderRadius: 2 }
                    }
                  >
                    {actionLabel(s, o)}
                  </Button>
                ))}
                {canCancel ? (
                  <Button
                    size="small"
                    color="error"
                    variant="text"
                    disabled={Boolean(busy)}
                    onClick={() => setCancel(true)}
                    startIcon={<IconCircleX size={15} />}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    Cancelar pedido
                  </Button>
                ) : null}
              </Stack>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1 }}>
                <Switch size="small" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Avisar o cliente pelo WhatsApp (conforme os avisos ligados nas Configurações)
                </Typography>
              </Stack>
            </Box>
          ) : null}
          {o.status === 'canceled' ? (
            <Alert severity="warning" sx={{ mx: 2, mb: 1 }}>
              Pedido cancelado{o.canceled_at ? ` em ${fmtDateTime(o.canceled_at)}` : ''}
              {o.cancel_reason ? ` — ${o.cancel_reason}` : '.'}
            </Alert>
          ) : null}
          <Divider />

          {/* Cliente */}
          <Box sx={{ p: 2 }}>
            <SectionLabel sx={{ mb: 1 }}>Cliente</SectionLabel>
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
              <Box sx={{ color: 'text.secondary', display: 'flex' }}>
                <IconUser size={18} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                  {person || fmtPhone(phone) || 'Sem contato'}
                  {o.customer?.code ? (
                    <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ml: 0.75 }}>
                      cód. {o.customer.code}
                    </Typography>
                  ) : null}
                </Typography>
                {person && phone ? (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {fmtPhone(phone)}
                  </Typography>
                ) : null}
              </Box>
              {o.session ? <WaNumberChip session={o.session} /> : null}
            </Stack>
            {o.chat_id ? (
              <Button
                size="small"
                variant="outlined"
                startIcon={<IconBrandWhatsapp size={16} />}
                onClick={() => navigate(chatUrl(o.chat_id))}
                sx={{ mt: 1.25, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
              >
                Abrir conversa
              </Button>
            ) : null}
          </Box>
          <Divider />

          {/* Itens */}
          <Box sx={{ p: 2 }}>
            <SectionLabel sx={{ mb: 1 }}>
              Itens ({o.items_count} {o.items_count === 1 ? 'unidade' : 'unidades'})
            </SectionLabel>
            <Stack divider={<Divider flexItem />} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              {(o.items || []).map((it, i) => (
                <Stack key={`${it.product_id}-${i}`} direction="row" spacing={1} alignItems="flex-start" sx={{ px: 1.25, py: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 800, minWidth: 34, fontVariantNumeric: 'tabular-nums' }}>
                    {it.qty}×
                  </Typography>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
                      {it.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                      {formatBRL(it.unit_cents)} cada
                      {it.notes ? ` · ${it.notes}` : ''}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {formatBRL(it.total_cents)}
                  </Typography>
                </Stack>
              ))}
            </Stack>
            <Box sx={{ mt: 1.25, px: 0.5 }}>
              <Money label="Subtotal" cents={o.subtotal_cents} />
              {o.delivery_fee_cents ? <Money label="Taxa de entrega" cents={o.delivery_fee_cents} /> : null}
              {o.discount_cents ? <Money label="Desconto" cents={o.discount_cents} negative /> : null}
              <Divider sx={{ my: 0.75 }} />
              <Money label="Total" cents={o.total_cents} strong />
            </Box>
          </Box>
          <Divider />

          {/* Entrega */}
          <Box sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <SectionLabel sx={{ flex: 1 }}>Entrega</SectionLabel>
              <DeliveryChip order={o} />
            </Stack>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Box sx={{ color: 'text.secondary', pt: 0.25 }}>
                {isDelivery ? <IconMapPin size={17} /> : <IconBuildingStore size={17} />}
              </Box>
              <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                {isDelivery ? addr || 'Endereço não informado' : o.delivery_text?.replace(/^\S+\s/, '') || 'Retirada no local'}
              </Typography>
            </Stack>
            {o.delivery?.notes ? (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5, ml: 3.25 }}>
                {o.delivery.notes}
              </Typography>
            ) : null}
          </Box>
          <Divider />

          {/* Pagamento */}
          <Box sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <SectionLabel sx={{ flex: 1 }}>Pagamento</SectionLabel>
              <PaymentChip order={o} />
            </Stack>
            <Typography variant="body2">
              {o.payment_method_label || PAYMENT_METHOD_LABEL[o.payment_method] || o.payment_method}
              {o.paid_at ? ` · pago em ${fmtDateTime(o.paid_at)}` : ''}
            </Typography>
            {o.status === 'canceled' && o.payment_status === 'paid' ? (
              <Alert severity="warning" sx={{ mt: 1.25, borderRadius: 2 }}>
                O cliente pagou depois que o pedido foi cancelado. Estorne o valor pelo gateway ou combine com o cliente.
              </Alert>
            ) : null}
            {o.charge?.pix_code && o.payment_status === 'pending' && o.status !== 'canceled' ? (
              <Box sx={{ mt: 1.25, p: 1.25, borderRadius: 2, border: '1px dashed', borderColor: 'divider', bgcolor: 'action.hover' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                  PIX copia e cola
                </Typography>
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.25 }}>
                  <Typography
                    variant="caption"
                    sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', flex: 1, minWidth: 0 }}
                    noWrap
                    title={o.charge.pix_code}
                  >
                    {o.charge.pix_code}
                  </Typography>
                  <Tooltip title="Copiar código PIX">
                    <IconButton size="small" onClick={copyPix} aria-label="Copiar código PIX">
                      <IconCopy size={16} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Box>
            ) : null}
            {canMarkPaid && o.payment_status !== 'paid' && o.status !== 'canceled' && o.payment_method !== 'none' ? (
              <Button
                size="small"
                variant="outlined"
                color="success"
                disabled={Boolean(busy)}
                onClick={markPaid}
                startIcon={busy === 'paid' ? <CircularProgress size={14} /> : <IconCash size={16} />}
                sx={{ mt: 1.25, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
              >
                Marcar como pago
              </Button>
            ) : null}
            {canMarkPaid && o.payment_status !== 'paid' && o.charge && o.status !== 'canceled' ? (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                Marcar à mão (dinheiro, maquininha) dá baixa manual na cobrança PIX em aberto — o valor entra no Financeiro.
              </Typography>
            ) : null}
          </Box>
          <Divider />

          {/* Unidade */}
          {units.length ? (
            <>
              <Box sx={{ p: 2 }}>
                <SectionLabel sx={{ mb: 1 }}>Unidade</SectionLabel>
                <TextField
                  select
                  size="small"
                  fullWidth
                  value={o.unit_id || ''}
                  disabled={busy === 'unit'}
                  onChange={(e) => save('unit', { unit_id: e.target.value || null }, 'Unidade atualizada.')}
                >
                  <MenuItem value="">Sem unidade</MenuItem>
                  {units.map((u) => (
                    <MenuItem key={u.id} value={u.id}>
                      {u.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
              <Divider />
            </>
          ) : null}

          {/* Observações */}
          <Box sx={{ p: 2 }}>
            <SectionLabel sx={{ mb: 1 }}>Observações internas</SectionLabel>
            <TextField
              size="small"
              fullWidth
              multiline
              minRows={2}
              maxRows={8}
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
              placeholder="Anotações da equipe (o cliente não vê)"
            />
            {notesDirty ? (
              <Button
                size="small"
                variant="contained"
                disableElevation
                disabled={busy === 'notes'}
                onClick={() => save('notes', { notes: notes.trim() || null }, 'Observações salvas.')}
                startIcon={busy === 'notes' ? <CircularProgress size={14} color="inherit" /> : <IconDeviceFloppy size={15} />}
                sx={{ ...waPrimaryBtn, mt: 1 }}
              >
                Salvar observações
              </Button>
            ) : null}
          </Box>

          {fields.length || extraCustom.length ? (
            <>
              <Divider />
              <Box sx={{ p: 2 }}>
                <SectionLabel sx={{ mb: 1.25 }}>Campos personalizados</SectionLabel>
                <CustomFieldInputs fields={fields} value={custom} onChange={setCustom} />
                {extraCustom.length ? (
                  <Stack spacing={0.5} sx={{ mt: 1 }}>
                    {extraCustom.map((x) => (
                      <Typography key={x.key} variant="caption" sx={{ color: 'text.secondary' }}>
                        {x.label}: {x.value}
                      </Typography>
                    ))}
                  </Stack>
                ) : null}
                {customDirty && fields.length ? (
                  <Button
                    size="small"
                    variant="contained"
                    disableElevation
                    disabled={busy === 'custom'}
                    onClick={() => save('custom', { custom }, 'Campos salvos.')}
                    startIcon={busy === 'custom' ? <CircularProgress size={14} color="inherit" /> : <IconDeviceFloppy size={15} />}
                    sx={{ ...waPrimaryBtn, mt: 0.5 }}
                  >
                    Salvar campos
                  </Button>
                ) : null}
              </Box>
            </>
          ) : null}
          <Divider />

          {/* Histórico */}
          <Box sx={{ p: 2, pb: 4 }}>
            <SectionLabel sx={{ mb: 1.25 }}>Histórico</SectionLabel>
            {history.length ? (
              <Box sx={{ position: 'relative', pl: 2.5 }}>
                <Box sx={{ position: 'absolute', left: 7, top: 6, bottom: 6, width: 2, bgcolor: 'divider', borderRadius: 1 }} />
                <Stack spacing={1.5}>
                  {history.map((h, i) => {
                    const st = orderStatusOf(h.status);
                    return (
                      <Box key={`${h.at}-${i}`} sx={{ position: 'relative' }}>
                        <Box
                          sx={(t) => ({
                            position: 'absolute',
                            left: -22,
                            top: 3,
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            bgcolor: st.color,
                            border: '2px solid',
                            borderColor: 'background.paper',
                            ...t.applyStyles('dark', { bgcolor: st.dark })
                          })}
                        />
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {h.note && /^pag/i.test(h.note) ? 'Pagamento confirmado' : st.label}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                          {fmtDateTime(h.at)} · {BY_LABEL[h.by] || h.by || '—'}
                          {h.note ? ` · ${h.note}` : ''}
                        </Typography>
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Sem registros.
              </Typography>
            )}
          </Box>
        </Box>
      )}

      <CancelOrderDialog order={cancel ? o : null} onClose={() => setCancel(false)} onDone={(r) => apply(r)} />
    </Drawer>
  );
}
