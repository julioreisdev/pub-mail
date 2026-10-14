import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  IconBrandWhatsapp,
  IconCheck,
  IconChevronDown,
  IconCircleCheck,
  IconHourglass,
  IconLock,
  IconNote,
  IconPaperclip,
  IconPencil,
  IconSend,
  IconUser,
  IconUserCheck,
  IconUserDollar,
  IconX
} from '@tabler/icons-react';

import { get, patch, post } from 'api/api';
import { useAuth } from 'contexts/AuthContext';
import { useRealtimeEvent } from 'realtime/useRealtime';
import { TgListSkeleton } from 'views/pages/telegram/ui';
import { WaNumberChip, useNow } from '../waKit';
import { fmtDateTime, fmtPhone } from '../waShared';
import { chatUrl, waPrimaryBtn } from '../crm/crmKit';
import { THIN_SCROLL } from '../chat/chatKit';
import TicketTimeline from './TicketTimeline';
import { CustomFieldsBlock } from '../crm/CustomFieldsInputs';
import { useCustomFieldDefs } from '../crm/customFields';
import { MediaList, PendingAttachments, uploadTicketMedia } from './ticketMedia';
import {
  API,
  PRIORITY,
  PRIORITY_KEYS,
  PriorityChip,
  ProtocolText,
  SOURCE_LABEL,
  STATUS_KEYS,
  SectionLabel,
  SlaChip,
  TICKET_STATUS,
  TicketStatusChip,
  ticketErr,
  ticketPersonName,
  ticketPersonPhone
} from './ticketKit';

// ============================================================================
// Gaveta do chamado: protocolo + situação, ações rápidas (situação, prioridade,
// categoria, responsável, "Pegar para mim", assunto), cliente e conversa,
// descrição e anexos, prazos, linha do tempo e caixa de resposta (ao cliente pelo
// WhatsApp ou nota interna) com "Enviar / Enviar e aguardar cliente / Enviar e resolver".
// `ticketId` abre; `initial` = linha da lista (mostra na hora); busca a versão fresca.
// Tempo real `wa:ticket` atualiza o chamado e a linha do tempo.
// ============================================================================

function Line({ icon: Icon, label, children }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ minWidth: 0 }}>
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

const SEND_OPTIONS = [
  { key: '', label: 'Enviar', icon: IconSend },
  { key: 'pending', label: 'Enviar e aguardar cliente', icon: IconHourglass },
  { key: 'resolved', label: 'Enviar e resolver', icon: IconCircleCheck }
];

export default function TicketDrawer({ ticketId, initial, onClose, onChanged, categories = [], categoryLabel, assignees = [] }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const myId = user?.user?.id || null;
  const now = useNow(60000);
  const open = Boolean(ticketId);
  const [t, setT] = useState(initial || null);
  const [events, setEvents] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [notifyStatus, setNotifyStatus] = useState(true);
  const [editSubject, setEditSubject] = useState(false);
  const [subject, setSubject] = useState('');
  // caixa de resposta
  const [visibility, setVisibility] = useState('public');
  const [body, setBody] = useState('');
  const [attach, setAttach] = useState(null);
  const [uploading, setUploading] = useState(0);
  const [menuEl, setMenuEl] = useState(null);
  const { defs: cfDefs } = useCustomFieldDefs('ticket'); // Fase 7: campos personalizados do chamado
  const fileRef = useRef(null);
  const seq = useRef(0);
  const evSeq = useRef(0);
  const rtTimer = useRef(null);
  const timelineEnd = useRef(null);
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  const load = useCallback(async () => {
    if (!ticketId) return;
    const s = ++seq.current;
    setLoading(true);
    try {
      const r = await get(`${API}/${ticketId}`);
      if (s === seq.current && r?.id) setT(r);
    } catch (e) {
      if (s === seq.current) {
        toast.error(ticketErr(e, 'Não foi possível abrir o chamado.'));
        if (e?.response?.status === 404) onClose?.();
      }
    } finally {
      if (s === seq.current) setLoading(false);
    }
  }, [ticketId, onClose]);

  const loadEvents = useCallback(async () => {
    if (!ticketId) return;
    const s = ++evSeq.current;
    try {
      const r = await get(`${API}/${ticketId}/events`);
      if (s === evSeq.current) setEvents(Array.isArray(r) ? r : r?.items || []);
    } catch {
      if (s === evSeq.current) setEvents((x) => x || []);
    }
  }, [ticketId]);

  useEffect(() => {
    if (!open) return;
    setT(initial || null);
    setEvents(null);
    setEditSubject(false);
    setBody('');
    setAttach(null);
    setVisibility('public');
    setNotifyStatus(true);
    load();
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, open]);

  // encerrado não aceita resposta ao cliente → nota interna
  useEffect(() => {
    if (t?.status === 'closed' && visibility === 'public') setVisibility('internal');
  }, [t?.status, visibility]);

  // rola para o fim da linha do tempo quando ela muda
  useEffect(() => {
    if (events?.length) timelineEnd.current?.scrollIntoView({ block: 'nearest' });
  }, [events?.length]);

  useRealtimeEvent('wa:ticket', (p) => {
    const row = p?.ticket;
    if (!row?.id || row.id !== ticketId) return;
    setT((cur) => ({ ...(cur || {}), ...row }));
    window.clearTimeout(rtTimer.current);
    rtTimer.current = window.setTimeout(() => loadEvents(), 400);
  });
  useEffect(() => () => window.clearTimeout(rtTimer.current), []);

  const apply = (row) => {
    if (row?.id) {
      setT(row);
      onChangedRef.current?.(row);
    }
    loadEvents();
  };

  const patchTicket = async (key, data, okMsg) => {
    setBusy(key);
    try {
      const r = await patch(`${API}/${t.id}`, data);
      apply(r);
      if (okMsg) toast.success(okMsg);
      return true;
    } catch (e) {
      toast.error(ticketErr(e, 'Não foi possível salvar.'));
      load();
      return false;
    } finally {
      setBusy('');
    }
  };

  const assign = async (userId) => {
    setBusy('assign');
    try {
      const r = await post(`${API}/${t.id}/assign`, { user_id: userId || null });
      apply(r);
      toast.success(userId ? (userId === myId ? 'O chamado agora é seu.' : 'Responsável atualizado.') : 'Chamado sem responsável.');
    } catch (e) {
      toast.error(ticketErr(e, 'Não foi possível atribuir.'));
    } finally {
      setBusy('');
    }
  };

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(1);
    try {
      const m = await uploadTicketMedia(file, (p) => setUploading(Math.max(1, p)));
      setAttach(m);
    } catch (err) {
      toast.error(ticketErr(err, 'Falha no envio do arquivo.'));
    } finally {
      setUploading(0);
    }
  };

  const send = async (status) => {
    setMenuEl(null);
    const text = body.trim();
    if (!text && !attach) {
      toast.error('Escreva a resposta (ou anexe um arquivo).');
      return;
    }
    setBusy('send');
    try {
      const r = await post(`${API}/${t.id}/comments`, {
        body: text || undefined,
        visibility,
        media_id: attach?.id || undefined,
        status: status || undefined
      });
      const row = r?.ticket || r;
      apply(row);
      setBody('');
      setAttach(null);
      toast.success(
        visibility === 'public'
          ? status === 'resolved'
            ? 'Resposta enviada ao cliente e chamado resolvido.'
            : status === 'pending'
              ? 'Resposta enviada. Aguardando o cliente.'
              : 'Resposta enviada ao cliente pelo WhatsApp.'
          : 'Nota interna registrada.'
      );
    } catch (e) {
      toast.error(ticketErr(e, 'Não foi possível enviar.'));
    } finally {
      setBusy('');
    }
  };

  if (!open) return null;
  const st = t?.status;
  const closed = st === 'closed';
  const person = ticketPersonName(t);
  const phone = ticketPersonPhone(t);
  const catOptions = categories.filter((c) => c.active !== false || c.key === t?.category);
  const knownCat = categories.some((c) => c.key === t?.category);
  const canReachCustomer = Boolean(t?.chat_id || t?.contact || t?.customer || t?.jid);
  const firstResp = t?.first_response_at
    ? `respondido em ${fmtDateTime(t.first_response_at)}`
    : t?.first_response_due_at
      ? `até ${fmtDateTime(t.first_response_due_at)}${new Date(t.first_response_due_at).getTime() < now && (st === 'open' || st === 'pending') ? ' · atrasada' : ''}`
      : '—';

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 540 }, height: '100dvh', display: 'flex', flexDirection: 'column' } }}
    >
      {/* Cabeçalho */}
      <Box sx={{ p: 2, pb: 1.5, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
        <Stack direction="row" alignItems="flex-start" spacing={1}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <ProtocolText protocol={t?.protocol} size="lg" />
              {st ? <TicketStatusChip status={st} size="md" /> : null}
            </Stack>
            {editSubject ? (
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.75 }}>
                <TextField
                  size="small"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value.slice(0, 160))}
                  autoFocus
                  fullWidth
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && subject.trim()) {
                      e.preventDefault();
                      if (await patchTicket('subject', { subject: subject.trim() }, 'Assunto atualizado.')) setEditSubject(false);
                    }
                    if (e.key === 'Escape') setEditSubject(false);
                  }}
                />
                <IconButton
                  size="small"
                  color="success"
                  disabled={!subject.trim() || busy === 'subject'}
                  onClick={async () => {
                    if (await patchTicket('subject', { subject: subject.trim() }, 'Assunto atualizado.')) setEditSubject(false);
                  }}
                  aria-label="Salvar assunto"
                >
                  {busy === 'subject' ? <CircularProgress size={16} /> : <IconCheck size={18} />}
                </IconButton>
                <IconButton size="small" onClick={() => setEditSubject(false)} aria-label="Cancelar">
                  <IconX size={18} />
                </IconButton>
              </Stack>
            ) : (
              <Stack direction="row" spacing={0.5} alignItems="flex-start" sx={{ mt: 0.5 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 16, lineHeight: 1.35, overflowWrap: 'anywhere', minWidth: 0 }}>
                  {t?.subject || (loading ? 'Carregando…' : 'Chamado')}
                </Typography>
                {t ? (
                  <Tooltip title="Editar assunto">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setSubject(t.subject || '');
                        setEditSubject(true);
                      }}
                      sx={{ p: 0.4, color: 'text.secondary' }}
                      aria-label="Editar assunto"
                    >
                      <IconPencil size={15} />
                    </IconButton>
                  </Tooltip>
                ) : null}
              </Stack>
            )}
            {t ? (
              <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                <PriorityChip priority={t.priority} />
                <SlaChip ticket={t} now={now} />
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  {t.category_label || categoryLabel?.(t.category)}
                </Typography>
              </Stack>
            ) : null}
          </Box>
          {loading ? <CircularProgress size={16} sx={{ mt: 0.75 }} /> : null}
          <IconButton size="small" onClick={onClose} aria-label="Fechar">
            <IconX size={18} />
          </IconButton>
        </Stack>
      </Box>

      {/* Corpo rolável */}
      <Box sx={(th) => ({ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', ...THIN_SCROLL(th) })}>
        {!t ? (
          <Box sx={{ p: 2 }}>
            <TgListSkeleton rows={5} />
          </Box>
        ) : (
          <>
            {/* Ações rápidas */}
            <Stack spacing={1.25} sx={{ p: 2 }}>
              <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
                <TextField
                  select
                  size="small"
                  label="Situação"
                  value={st || 'open'}
                  disabled={Boolean(busy)}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === st) return;
                    const reopen = (v === 'open' || v === 'pending') && (st === 'resolved' || st === 'closed');
                    patchTicket(
                      'status',
                      { status: v, notify: notifyStatus },
                      reopen ? 'Chamado reaberto (prazo novo a partir de agora).' : `Situação: ${TICKET_STATUS[v].label}.`
                    );
                  }}
                >
                  {STATUS_KEYS.map((k) => {
                    const Icon = TICKET_STATUS[k].icon;
                    return (
                      <MenuItem key={k} value={k}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Icon size={15} />
                          <span>{TICKET_STATUS[k].label}</span>
                        </Stack>
                      </MenuItem>
                    );
                  })}
                </TextField>
                <TextField
                  select
                  size="small"
                  label="Prioridade"
                  value={t.priority || 'normal'}
                  disabled={Boolean(busy)}
                  onChange={(e) =>
                    e.target.value !== t.priority &&
                    patchTicket('priority', { priority: e.target.value }, 'Prioridade atualizada (o prazo foi recalculado).')
                  }
                >
                  {PRIORITY_KEYS.map((k) => {
                    const Icon = PRIORITY[k].icon;
                    return (
                      <MenuItem key={k} value={k}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Icon size={15} />
                          <span>{PRIORITY[k].label}</span>
                        </Stack>
                      </MenuItem>
                    );
                  })}
                </TextField>
                <TextField
                  select
                  size="small"
                  label="Categoria"
                  value={t.category || ''}
                  disabled={Boolean(busy)}
                  onChange={(e) =>
                    e.target.value !== t.category &&
                    patchTicket('category', { category: e.target.value }, 'Categoria atualizada (o prazo foi recalculado).')
                  }
                >
                  {!knownCat && t.category ? (
                    <MenuItem value={t.category} disabled>
                      {t.category_label || t.category} (removida)
                    </MenuItem>
                  ) : null}
                  {catOptions.map((c) => (
                    <MenuItem key={c.key} value={c.key}>
                      {c.label}
                      {c.active === false ? ' (desativada)' : ''}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  size="small"
                  label="Responsável"
                  value={t.assigned_user_id || ''}
                  disabled={Boolean(busy)}
                  onChange={(e) => e.target.value !== (t.assigned_user_id || '') && assign(e.target.value)}
                >
                  <MenuItem value="">Sem responsável</MenuItem>
                  {t.assigned_user_id && !assignees.some((u) => u.id === t.assigned_user_id) ? (
                    <MenuItem value={t.assigned_user_id}>{t.assigned?.name || 'Usuário'}</MenuItem>
                  ) : null}
                  {assignees.map((u) => (
                    <MenuItem key={u.id} value={u.id}>
                      {u.name || u.email}
                      {u.id === myId ? ' (você)' : ''}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                {myId && t.assigned_user_id !== myId ? (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={busy === 'assign' ? <CircularProgress size={14} /> : <IconUserCheck size={16} />}
                    disabled={Boolean(busy)}
                    onClick={() => assign(myId)}
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                  >
                    Pegar para mim
                  </Button>
                ) : null}
                {t.chat_id ? (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<IconBrandWhatsapp size={16} />}
                    onClick={() => navigate(chatUrl(t.chat_id))}
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                  >
                    Abrir conversa
                  </Button>
                ) : null}
                <Box sx={{ flex: 1 }} />
                <FormControlLabel
                  control={<Switch size="small" checked={notifyStatus} onChange={(e) => setNotifyStatus(e.target.checked)} />}
                  label={
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Avisar o cliente ao mudar a situação
                    </Typography>
                  }
                  sx={{ mr: 0 }}
                />
              </Stack>
            </Stack>
            <Divider />

            {/* Cliente e prazos */}
            <Stack spacing={1.5} sx={{ p: 2 }}>
              <Line icon={IconUser} label={t.customer ? 'Cliente' : 'Contato'}>
                {person || (phone ? fmtPhone(phone) : 'Sem contato vinculado')}
                {person && phone ? (
                  <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ml: 0.75 }}>
                    {fmtPhone(phone)}
                  </Typography>
                ) : null}
                {t.customer?.code ? (
                  <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ml: 0.75 }}>
                    · cód. {t.customer.code}
                  </Typography>
                ) : null}
              </Line>
              {t.customer ? (
                <Button
                  size="small"
                  startIcon={<IconUserDollar size={15} />}
                  onClick={() => navigate('/whatsapp/customers')}
                  sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700, mt: -0.75 }}
                >
                  Ver em Clientes
                </Button>
              ) : null}
              {t.session ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Respostas saem pelo número
                  </Typography>
                  <WaNumberChip session={t.session} />
                </Stack>
              ) : null}
              <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    Prazo de solução
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {t.sla_label || '—'}
                  </Typography>
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    Primeira resposta
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {firstResp}
                  </Typography>
                </Box>
              </Box>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                Aberto em {fmtDateTime(t.created_at)} · via {SOURCE_LABEL[t.source] || t.source || 'painel'}
                {t.resolved_at ? ` · resolvido em ${fmtDateTime(t.resolved_at)}` : ''}
                {t.reopen_count ? ` · reaberto ${t.reopen_count}×` : ''}
              </Typography>
            </Stack>
            <Divider />

            {/* Descrição */}
            <Stack spacing={1} sx={{ p: 2 }}>
              <SectionLabel>Descrição</SectionLabel>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {t.description ?? t.excerpt ?? ''}
              </Typography>
              {t.media?.length ? (
                <Box sx={{ pt: 0.5 }}>
                  <MediaList media={t.media} />
                </Box>
              ) : null}
            </Stack>
            <Divider />

            {/* Campos personalizados (Fase 7) — PATCH /whatsapp/tickets/:id {custom} */}
            {cfDefs.length ? (
              <>
                <Box sx={{ p: 2 }}>
                  <CustomFieldsBlock
                    defs={cfDefs}
                    custom={t.custom}
                    title={<SectionLabel>Campos do chamado</SectionLabel>}
                    onSave={async (changed) => {
                      const r = await patch(`${API}/${t.id}`, { custom: changed });
                      apply(r);
                      toast.success('Campos salvos.');
                    }}
                  />
                </Box>
                <Divider />
              </>
            ) : null}

            {/* Linha do tempo */}
            <Stack spacing={1.25} sx={{ p: 2 }}>
              <SectionLabel>Histórico</SectionLabel>
              {events === null ? (
                <TgListSkeleton rows={3} />
              ) : (
                <TicketTimeline events={events} categoryLabel={categoryLabel} customerName={person || (phone ? fmtPhone(phone) : '')} />
              )}
              <div ref={timelineEnd} />
            </Stack>
          </>
        )}
      </Box>

      {/* Caixa de resposta */}
      {t ? (
        <Box
          sx={{
            flexShrink: 0,
            borderTop: '1px solid',
            borderColor: 'divider',
            px: 2,
            pt: 1.25,
            pb: 'calc(12px + env(safe-area-inset-bottom))',
            bgcolor: 'background.paper'
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={visibility}
              onChange={(_, v) => v && setVisibility(v)}
              sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 700, gap: 0.5, px: 1.25, py: 0.4 } }}
            >
              <ToggleButton value="public" disabled={closed}>
                <IconBrandWhatsapp size={15} /> Responder ao cliente
              </ToggleButton>
              <ToggleButton value="internal">
                <IconNote size={15} /> Nota interna
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <Typography
            variant="caption"
            sx={{ display: 'block', mb: 0.75, color: visibility === 'public' ? 'success.main' : 'text.secondary', fontWeight: 600 }}
          >
            {closed
              ? 'Chamado encerrado: reabra (Situação → Aberto) para responder ao cliente.'
              : visibility === 'public'
                ? canReachCustomer
                  ? 'Vai para o WhatsApp do cliente, junto com o protocolo.'
                  : 'Sem conversa vinculada: a resposta fica só registrada no chamado.'
                : 'Só a equipe vê. O cliente não recebe nada.'}
          </Typography>
          <TextField
            size="small"
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 4000))}
            placeholder={visibility === 'public' ? 'Escreva a resposta ao cliente…' : 'Escreva uma nota para a equipe…'}
            fullWidth
            multiline
            minRows={2}
            maxRows={6}
            disabled={busy === 'send'}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send('');
              }
            }}
            sx={(th) =>
              visibility === 'internal'
                ? {
                    '& .MuiOutlinedInput-root': { bgcolor: '#FEFCE8', ...th.applyStyles('dark', { bgcolor: 'rgba(250, 204, 21, 0.06)' }) }
                  }
                : {}
            }
          />
          {attach ? (
            <Box sx={{ mt: 0.75 }}>
              <PendingAttachments items={[attach]} onRemove={() => setAttach(null)} disabled={busy === 'send'} />
            </Box>
          ) : null}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
            <input ref={fileRef} type="file" hidden onChange={onPickFile} />
            <Tooltip title="Anexar arquivo (foto, PDF, áudio…)">
              <span>
                <IconButton
                  size="small"
                  onClick={() => fileRef.current?.click()}
                  disabled={Boolean(uploading) || busy === 'send' || Boolean(attach)}
                  aria-label="Anexar arquivo"
                >
                  {uploading ? (
                    <CircularProgress size={16} variant={uploading > 1 ? 'determinate' : 'indeterminate'} value={uploading} />
                  ) : (
                    <IconPaperclip size={18} />
                  )}
                </IconButton>
              </span>
            </Tooltip>
            <Typography variant="caption" sx={{ color: 'text.disabled', flex: 1, display: { xs: 'none', sm: 'block' } }}>
              Ctrl/⌘ + Enter envia
            </Typography>
            <Box sx={{ flex: { xs: 1, sm: 'none' } }} />
            <ButtonGroup variant="contained" disableElevation sx={{ '& .MuiButton-root': { ...waPrimaryBtn, borderRadius: 2 } }}>
              <Button
                onClick={() => send('')}
                disabled={busy === 'send' || Boolean(uploading)}
                startIcon={busy === 'send' ? <CircularProgress size={14} color="inherit" /> : <IconSend size={16} />}
              >
                Enviar
              </Button>
              <Button
                size="small"
                aria-label="Mais opções de envio"
                onClick={(e) => setMenuEl(e.currentTarget)}
                disabled={busy === 'send' || Boolean(uploading)}
                sx={{ px: 0.75, minWidth: 0 }}
              >
                <IconChevronDown size={16} />
              </Button>
            </ButtonGroup>
            <Menu
              anchorEl={menuEl}
              open={Boolean(menuEl)}
              onClose={() => setMenuEl(null)}
              anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
              transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
              {SEND_OPTIONS.map((o) => {
                const Icon = o.icon;
                const disabled = o.key && o.key === st;
                return (
                  <MenuItem key={o.key || 'send'} onClick={() => send(o.key)} disabled={Boolean(disabled)}>
                    <ListItemIcon>
                      <Icon size={17} />
                    </ListItemIcon>
                    <ListItemText
                      primary={o.label}
                      secondary={
                        o.key === 'pending'
                          ? 'Situação vira "Aguardando cliente"; volta a "Aberto" quando ele responder.'
                          : o.key === 'resolved'
                            ? 'Marca como resolvido e avisa o cliente.'
                            : 'Mantém a situação atual.'
                      }
                      secondaryTypographyProps={{ sx: { maxWidth: 260, whiteSpace: 'normal' } }}
                    />
                  </MenuItem>
                );
              })}
            </Menu>
          </Stack>
          {closed ? (
            <Alert severity="info" icon={<IconLock size={18} />} sx={{ mt: 1, borderRadius: 2, py: 0 }}>
              Encerrado em {fmtDateTime(t.closed_at)}.
            </Alert>
          ) : null}
        </Box>
      ) : null}
    </Drawer>
  );
}
