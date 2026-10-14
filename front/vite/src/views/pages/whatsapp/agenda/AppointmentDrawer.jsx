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
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  IconBrandWhatsapp,
  IconCalendarTime,
  IconCash,
  IconCheck,
  IconCircleCheck,
  IconClockHour4,
  IconCopy,
  IconDeviceFloppy,
  IconMapPin,
  IconPlayerPlay,
  IconReceipt2,
  IconUser,
  IconUserX,
  IconX
} from '@tabler/icons-react';

import { get, patch, post } from 'api/api';
import { TgConfirmDialog, TgListSkeleton } from 'views/pages/telegram/ui';
import { WaNumberChip } from '../waKit';
import { fmtDateTime, fmtPhone } from '../waShared';
import { CrmModal, chatUrl, formatBRL, waPrimaryBtn } from '../crm/crmKit';
import { THIN_SCROLL } from '../chat/chatKit';
import SlotPicker from './SlotPicker';
import { CustomFieldsBlock } from '../crm/CustomFieldsInputs';
import { useCustomFieldDefs } from '../crm/customFields';
import { API, ApptStatusChip, apptErr, brtParts, copyText, dayLongLabel, errCode, paymentLabel, resourceKind, timeOf } from './agendaKit';

// ============================================================================
// Gaveta do agendamento: cliente, serviço, horário, recurso, pagamento (cobrança,
// link, gerar cobrança), observações e ações (confirmar, iniciar, concluir, faltou,
// cancelar com política, remarcar com vagas reais, abrir conversa).
// `appointment` = linha da lista (mostra na hora); a gaveta busca a versão fresca.
// ============================================================================

const CANCEL_POLICY_TEXT = {
  credit: 'o valor pago vira crédito do cliente para o próximo agendamento',
  keep: 'o valor pago fica retido (sem devolução)',
  refund: 'o valor pago é estornado no gateway (quando o gateway permite; senão vira crédito)'
};

function Line({ icon: Icon, label, children }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="flex-start">
      <Box sx={{ color: 'text.secondary', pt: 0.25, flexShrink: 0 }}>
        <Icon size={17} />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.2 }}>
          {label}
        </Typography>
        <Box sx={{ typography: 'body2', fontWeight: 600, overflowWrap: 'anywhere' }}>{children}</Box>
      </Box>
    </Stack>
  );
}

export default function AppointmentDrawer({ appointment, onClose, onChanged, serviceById, resources = [] }) {
  const navigate = useNavigate();
  const open = Boolean(appointment);
  const [a, setA] = useState(appointment);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [notes, setNotes] = useState('');
  const [cancelDlg, setCancelDlg] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelPolicy, setCancelPolicy] = useState('');
  const [noShowDlg, setNoShowDlg] = useState(false);
  const [resched, setResched] = useState(false);
  const [reschedResource, setReschedResource] = useState('');
  const [reschedSlot, setReschedSlot] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const { defs: cfDefs } = useCustomFieldDefs('appointment'); // Fase 7: campos personalizados
  const seq = useRef(0);
  const id = appointment?.id;

  const load = useCallback(async () => {
    if (!id) return;
    const s = ++seq.current;
    setLoading(true);
    try {
      const r = await get(`${API}/appointments/${id}`);
      if (s !== seq.current) return;
      const row = r?.appointment || r;
      if (row?.id) {
        setA(row);
        setNotes(row.notes || '');
      }
    } catch {
      /* fica com a linha da lista */
    } finally {
      if (s === seq.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!open) return;
    setA(appointment);
    setNotes(appointment?.notes || '');
    setResched(false);
    setReschedSlot(null);
    setCancelDlg(false);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, open]);
  // atualização em tempo real da mesma linha (a lista repassa a versão nova)
  useEffect(() => {
    if (appointment && a && appointment.id === a.id && appointment !== a) setA((cur) => ({ ...cur, ...appointment }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointment]);

  const apply = (r) => {
    const row = r?.appointment || r;
    if (row?.id) {
      setA(row);
      onChanged?.(row);
    } else {
      load();
      onChanged?.(null);
    }
  };

  const act = async (action, body, okMsg) => {
    setBusy(action);
    try {
      const r = await post(`${API}/appointments/${a.id}/${action}`, body || {});
      apply(r);
      if (okMsg) toast.success(okMsg);
      return true;
    } catch (e) {
      if (errCode(e) === 'SLOT_TAKEN') {
        setReschedSlot(null);
        setReloadKey((k) => k + 1);
      }
      toast.error(apptErr(e, 'Não foi possível concluir a ação.'));
      return false;
    } finally {
      setBusy('');
    }
  };

  const saveNotes = async () => {
    setBusy('notes');
    try {
      const r = await patch(`${API}/appointments/${a.id}`, { notes: notes.trim() || null });
      apply(r);
      toast.success('Observações salvas.');
    } catch (e) {
      toast.error(apptErr(e, 'Não foi possível salvar.'));
    } finally {
      setBusy('');
    }
  };

  if (!open) return null;
  const st = a?.status;
  const service = a?.product_id ? serviceById?.get?.(a.product_id) : null;
  const policy = service?.booking?.cancel_policy || 'credit';
  const paid = (a?.paid_cents || 0) + (a?.credit_cents || 0);
  const canAct = ['pending_payment', 'booked', 'confirmed', 'in_progress'].includes(st);
  const kind = resourceKind(a?.resource?.kind);
  const KindIcon = kind.icon;
  const day = a?.starts_at ? brtParts(a.starts_at).day : '';

  return (
    <>
      <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 420 }, display: 'flex' } }}>
        <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 17 }} noWrap>
              {a?.service_name || 'Agendamento'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {day ? dayLongLabel(day) : ''} · {a?.time_label || timeOf(a?.starts_at)}–{a?.end_time_label || timeOf(a?.ends_at)}
            </Typography>
            <Box sx={{ mt: 0.75 }}>
              <ApptStatusChip status={st} size="md" />
            </Box>
          </Box>
          {loading ? <CircularProgress size={16} sx={{ mt: 0.5 }} /> : null}
          <IconButton size="small" onClick={onClose} aria-label="Fechar">
            <IconX size={18} />
          </IconButton>
        </Stack>

        <Box sx={(t) => ({ flex: 1, overflowY: 'auto', ...THIN_SCROLL(t) })}>
          {!a ? (
            <Box sx={{ p: 2 }}>
              <TgListSkeleton rows={5} />
            </Box>
          ) : (
            <>
              <Stack spacing={1.5} sx={{ p: 2 }}>
                <Line icon={IconUser} label="Cliente">
                  {a.customer?.name || 'Contato sem cadastro'}
                  {a.customer?.phone ? (
                    <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ml: 0.75 }}>
                      {fmtPhone(a.customer.phone)}
                    </Typography>
                  ) : null}
                </Line>
                <Line icon={KindIcon} label={kind.label}>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: a.resource?.color || '#2563EB', flexShrink: 0 }} />
                    <span>{a.resource?.name || '—'}</span>
                  </Stack>
                </Line>
                <Line icon={IconClockHour4} label="Horário">
                  {a.date_label || dayLongLabel(day)} · {a.time_label || timeOf(a.starts_at)} às {a.end_time_label || timeOf(a.ends_at)}
                  {a.reschedules ? (
                    <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ml: 0.75 }}>
                      · remarcado {a.reschedules}×
                    </Typography>
                  ) : null}
                </Line>
                {service?.booking?.address ? (
                  <Line icon={IconMapPin} label="Endereço">
                    {service.booking.address}
                  </Line>
                ) : null}
                {a.session ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Avisos pelo número
                    </Typography>
                    <WaNumberChip session={a.session} />
                  </Stack>
                ) : null}
                {a.chat_id ? (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<IconBrandWhatsapp size={16} />}
                    onClick={() => navigate(chatUrl(a.chat_id))}
                    sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                  >
                    Abrir conversa
                  </Button>
                ) : null}
              </Stack>
              <Divider />

              {/* Pagamento */}
              <Stack spacing={1} sx={{ p: 2 }}>
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}
                >
                  Pagamento
                </Typography>
                <Stack direction="row" spacing={1} alignItems="baseline" flexWrap="wrap" useFlexGap>
                  <Typography sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                    {a.price_label || formatBRL(a.price_cents)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {paymentLabel(a.payment)}
                    {a.paid_cents ? ` · pago ${formatBRL(a.paid_cents)}` : ''}
                    {a.credit_cents ? ` · crédito ${formatBRL(a.credit_cents)}` : ''}
                  </Typography>
                </Stack>
                {a.charge ? (
                  <Box sx={{ p: 1.25, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <IconReceipt2 size={16} />
                      <Typography variant="body2" sx={{ fontWeight: 700, flex: 1 }}>
                        Cobrança ·{' '}
                        {a.charge.status === 'PAID'
                          ? 'paga'
                          : a.charge.status === 'PENDING'
                            ? 'em aberto'
                            : String(a.charge.status || '').toLowerCase()}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                      {a.charge.pay_link ? (
                        <Button
                          size="small"
                          startIcon={<IconCopy size={14} />}
                          onClick={async () =>
                            toast[(await copyText(a.charge.pay_link)) ? 'success' : 'error']('Link de pagamento copiado.')
                          }
                          sx={{ textTransform: 'none', fontWeight: 700 }}
                        >
                          Copiar link
                        </Button>
                      ) : null}
                      {a.charge.pix_code ? (
                        <Button
                          size="small"
                          startIcon={<IconCopy size={14} />}
                          onClick={async () =>
                            toast[(await copyText(a.charge.pix_code)) ? 'success' : 'error']('PIX copia-e-cola copiado.')
                          }
                          sx={{ textTransform: 'none', fontWeight: 700 }}
                        >
                          Copiar PIX
                        </Button>
                      ) : null}
                    </Stack>
                  </Box>
                ) : null}
                {canAct && st !== 'in_progress' && (!a.charge || a.charge.status !== 'PAID') && paid < (a.price_cents || 0) ? (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={busy === 'charge' ? <CircularProgress size={14} /> : <IconCash size={16} />}
                    disabled={Boolean(busy)}
                    onClick={() => act('charge', {}, a.charge ? 'Cobrança reenviada ao cliente.' : 'Cobrança gerada e enviada ao cliente.')}
                    sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                  >
                    {a.charge ? 'Reenviar cobrança' : 'Gerar cobrança'}
                  </Button>
                ) : null}
              </Stack>
              <Divider />

              {/* Ações */}
              {canAct ? (
                <>
                  <Stack spacing={1} sx={{ p: 2 }}>
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}
                    >
                      Ações
                    </Typography>
                    <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
                      {st === 'booked' ? (
                        <Button
                          variant="contained"
                          disableElevation
                          startIcon={busy === 'confirm' ? <CircularProgress size={14} color="inherit" /> : <IconCheck size={16} />}
                          disabled={Boolean(busy)}
                          onClick={() => act('confirm', {}, 'Agendamento confirmado.')}
                          sx={waPrimaryBtn}
                        >
                          Confirmar
                        </Button>
                      ) : null}
                      {st === 'booked' || st === 'confirmed' ? (
                        <Button
                          variant="outlined"
                          startIcon={busy === 'start' ? <CircularProgress size={14} /> : <IconPlayerPlay size={16} />}
                          disabled={Boolean(busy)}
                          onClick={() => act('start', {}, 'Atendimento iniciado.')}
                          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                        >
                          Iniciar
                        </Button>
                      ) : null}
                      {st === 'in_progress' || st === 'confirmed' || st === 'booked' ? (
                        <Button
                          variant={st === 'in_progress' ? 'contained' : 'outlined'}
                          disableElevation
                          startIcon={busy === 'done' ? <CircularProgress size={14} /> : <IconCircleCheck size={16} />}
                          disabled={Boolean(busy)}
                          onClick={() => act('done', {}, 'Atendimento concluído.')}
                          sx={st === 'in_progress' ? waPrimaryBtn : { textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                        >
                          Concluir
                        </Button>
                      ) : null}
                      {st === 'booked' || st === 'confirmed' ? (
                        <Button
                          variant="outlined"
                          color="warning"
                          startIcon={<IconUserX size={16} />}
                          disabled={Boolean(busy)}
                          onClick={() => setNoShowDlg(true)}
                          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                        >
                          Faltou
                        </Button>
                      ) : null}
                      {st !== 'in_progress' ? (
                        <Button
                          variant="outlined"
                          startIcon={<IconCalendarTime size={16} />}
                          disabled={Boolean(busy)}
                          onClick={() => {
                            setReschedResource(a.resource?.id || '');
                            setReschedSlot(null);
                            setResched(true);
                          }}
                          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                        >
                          Remarcar
                        </Button>
                      ) : null}
                      {st !== 'in_progress' ? (
                        <Button
                          variant="outlined"
                          color="error"
                          startIcon={<IconX size={16} />}
                          disabled={Boolean(busy)}
                          onClick={() => {
                            setCancelReason('');
                            setCancelPolicy('');
                            setCancelDlg(true);
                          }}
                          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                        >
                          Cancelar
                        </Button>
                      ) : null}
                    </Box>
                    {a.cancel_deadline && st !== 'in_progress' ? (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {a.can_cancel_free
                          ? `Cancelamento sem custo até ${fmtDateTime(a.cancel_deadline)}.`
                          : `Prazo de cancelamento sem custo encerrado (${fmtDateTime(a.cancel_deadline)}).`}
                      </Typography>
                    ) : null}
                  </Stack>
                  <Divider />
                </>
              ) : a.cancel_reason ? (
                <>
                  <Box sx={{ p: 2 }}>
                    <Alert severity="info" sx={{ borderRadius: 2 }}>
                      {st === 'canceled' ? 'Cancelado' : 'Encerrado'}
                      {a.cancel_by ? ` por ${a.cancel_by === 'customer' ? 'cliente' : a.cancel_by === 'staff' ? 'equipe' : 'sistema'}` : ''}
                      : {a.cancel_reason}
                    </Alert>
                  </Box>
                  <Divider />
                </>
              ) : null}

              {/* Campos personalizados (Fase 7) — PATCH /whatsapp/scheduling/appointments/:id {custom} */}
              {cfDefs.length ? (
                <>
                  <Box sx={{ p: 2 }}>
                    <CustomFieldsBlock
                      defs={cfDefs}
                      custom={a.custom}
                      title={
                        <Typography
                          variant="caption"
                          sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}
                        >
                          Campos do agendamento
                        </Typography>
                      }
                      onSave={async (changed) => {
                        const r = await patch(`${API}/appointments/${a.id}`, { custom: changed });
                        apply(r);
                        toast.success('Campos salvos.');
                      }}
                    />
                  </Box>
                  <Divider />
                </>
              ) : null}

              {/* Observações */}
              <Stack spacing={1} sx={{ p: 2 }}>
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}
                >
                  Observações
                </Typography>
                <TextField
                  size="small"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
                  multiline
                  minRows={3}
                  maxRows={8}
                  fullWidth
                  placeholder="Visível só para a equipe"
                />
                <Button
                  size="small"
                  startIcon={busy === 'notes' ? <CircularProgress size={14} /> : <IconDeviceFloppy size={15} />}
                  disabled={Boolean(busy) || notes === (a.notes || '')}
                  onClick={saveNotes}
                  sx={{ alignSelf: 'flex-end', textTransform: 'none', fontWeight: 700 }}
                >
                  Salvar observações
                </Button>
              </Stack>
              <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', px: 2, pb: 2 }}>
                Criado {fmtDateTime(a.created_at)}
                {a.source ? ` · via ${a.source === 'bot' ? 'bot' : a.source === 'api' ? 'API' : 'painel'}` : ''}
              </Typography>
            </>
          )}
        </Box>
      </Drawer>

      {/* Cancelar */}
      <CrmModal
        open={cancelDlg}
        onClose={() => busy !== 'cancel' && setCancelDlg(false)}
        title="Cancelar agendamento"
        subtitle={`${a?.service_name || ''} · ${a?.date_label || ''} ${a?.time_label || ''}`}
        maxWidth="xs"
        disableClose={busy === 'cancel'}
        footer={
          <>
            <Button color="inherit" onClick={() => setCancelDlg(false)} disabled={busy === 'cancel'} sx={{ textTransform: 'none' }}>
              Voltar
            </Button>
            <Button
              variant="contained"
              color="error"
              disableElevation
              disabled={busy === 'cancel'}
              startIcon={busy === 'cancel' ? <CircularProgress size={14} color="inherit" /> : <IconX size={16} />}
              onClick={async () => {
                const ok = await act(
                  'cancel',
                  { reason: cancelReason.trim() || undefined, policy_override: cancelPolicy || undefined },
                  'Agendamento cancelado. O horário foi liberado.'
                );
                if (ok) setCancelDlg(false);
              }}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
            >
              Cancelar agendamento
            </Button>
          </>
        }
      >
        <Stack spacing={1.5}>
          <Alert severity={a?.can_cancel_free ? 'success' : 'warning'} sx={{ borderRadius: 2 }}>
            {a?.can_cancel_free
              ? `Dentro do prazo: cancela sem custo${paid ? ' — o valor pago vira crédito do cliente (ou é estornado, se o serviço estornar)' : ''}${a?.payment === 'included' ? '; o uso do plano é devolvido' : ''}.`
              : `Fora do prazo sem custo${a?.cancel_deadline ? ` (era até ${fmtDateTime(a.cancel_deadline)})` : ''}: pela política do serviço, ${CANCEL_POLICY_TEXT[policy] || CANCEL_POLICY_TEXT.credit}.`}
          </Alert>
          <TextField
            size="small"
            label="Motivo (opcional)"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value.slice(0, 255))}
            fullWidth
            multiline
            minRows={2}
          />
          {paid > 0 ? (
            <TextField
              select
              size="small"
              label="O que fazer com o valor pago"
              value={cancelPolicy}
              onChange={(e) => setCancelPolicy(e.target.value)}
              fullWidth
              helperText="Como equipe, você pode decidir diferente da política do serviço."
            >
              <MenuItem value="">Seguir a regra ({a?.can_cancel_free ? 'sem custo' : 'política do serviço'})</MenuItem>
              <MenuItem value="credit">Virar crédito do cliente</MenuItem>
              <MenuItem value="refund">Estornar no gateway</MenuItem>
              <MenuItem value="keep">Reter o valor</MenuItem>
            </TextField>
          ) : null}
        </Stack>
      </CrmModal>

      {/* Remarcar */}
      <CrmModal
        open={resched}
        onClose={() => busy !== 'reschedule' && setResched(false)}
        title="Remarcar"
        subtitle={`Hoje: ${a?.date_label || ''} ${a?.time_label || ''} · ${a?.resource?.name || ''}. O pagamento é mantido.`}
        maxWidth="sm"
        disableClose={busy === 'reschedule'}
        footer={
          <>
            <Button color="inherit" onClick={() => setResched(false)} disabled={busy === 'reschedule'} sx={{ textTransform: 'none' }}>
              Voltar
            </Button>
            <Button
              variant="contained"
              disableElevation
              disabled={!reschedSlot || busy === 'reschedule'}
              startIcon={busy === 'reschedule' ? <CircularProgress size={14} color="inherit" /> : <IconCalendarTime size={16} />}
              onClick={async () => {
                const ok = await act(
                  'reschedule',
                  { starts_at: reschedSlot.starts_at, resource_id: reschedResource || reschedSlot.resource_id || undefined },
                  'Agendamento remarcado. O cliente foi avisado.'
                );
                if (ok) setResched(false);
              }}
              sx={waPrimaryBtn}
            >
              Remarcar
            </Button>
          </>
        }
      >
        {resched ? (
          <Stack spacing={1.5}>
            <TextField
              select
              size="small"
              label="Profissional / recurso"
              value={reschedResource}
              onChange={(e) => {
                setReschedResource(e.target.value);
                setReschedSlot(null);
              }}
              fullWidth
            >
              <MenuItem value="">Qualquer</MenuItem>
              {resources.map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  {r.name}
                </MenuItem>
              ))}
            </TextField>
            {a?.product_id ? (
              <SlotPicker
                productId={a.product_id}
                resourceId={reschedResource}
                value={reschedSlot}
                onChange={setReschedSlot}
                reloadKey={reloadKey}
              />
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                O serviço deste agendamento não existe mais; arraste o bloco na agenda para remarcar.
              </Typography>
            )}
            {a?.can_reschedule === false ? (
              <Typography variant="caption" sx={{ color: 'warning.main' }}>
                O cliente já usou o limite de remarcações deste serviço; como equipe, você pode remarcar mesmo assim.
              </Typography>
            ) : null}
          </Stack>
        ) : null}
      </CrmModal>

      <TgConfirmDialog
        open={noShowDlg}
        onClose={() => setNoShowDlg(false)}
        onConfirm={async () => {
          const ok = await act('no-show', {}, 'Marcado como falta.');
          if (ok) setNoShowDlg(false);
        }}
        loading={busy === 'no-show'}
        title="Marcar como falta?"
        message={`${a?.customer?.name || 'O cliente'} não compareceu. A falta entra no histórico do cliente (pode passar a exigir sinal, conforme as configurações).`}
        confirmLabel="Marcar falta"
        icon={IconUserX}
      />
    </>
  );
}
