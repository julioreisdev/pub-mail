import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { IconBrandWhatsapp, IconPaperclip, IconPhone, IconTicket, IconUser } from '@tabler/icons-react';

import { get, post } from 'api/api';
import { WaNumberChip, WaNumberSelect, useWaSessions } from '../waKit';
import { fmtPhone, onlyDigits } from '../waShared';
import { CrmModal, waPrimaryBtn } from '../crm/crmKit';
import { PendingAttachments, uploadTicketMedia } from './ticketMedia';
import CustomFieldsInputs from '../crm/CustomFieldsInputs';
import { customErrorsFrom, customErrorsText, customPayload, useCustomFieldDefs, validateCustomLocal } from '../crm/customFields';
import { API, PRIORITY, PRIORITY_KEYS, SectionLabel, ticketErr } from './ticketKit';

// ============================================================================
// Novo chamado (painel): cliente cadastrado (busca) ou telefone — ou a conversa já
// fixa quando aberto de dentro do chat —, categoria, prioridade (padrão = a da
// categoria), assunto (opcional: em branco = 1ª linha da descrição), descrição,
// até 5 anexos, "Avisar o cliente pelo WhatsApp" e responsável → POST /whatsapp/tickets.
// `prefill` = { chat?: { chat_id (uuid), name, phone, session }, customer?: { id, name, phone } }.
// ============================================================================

const MAX_ATTACH = 5;
const normalizePhone = (v) => {
  const d = onlyDigits(v);
  if (!d) return '';
  return d.length === 10 || d.length === 11 ? `55${d}` : d;
};

export default function NewTicketDialog({ open, onClose, onCreated, categories = [], assignees = [], prefill }) {
  const { sessions } = useWaSessions(open ? 60000 : 0);
  const connected = useMemo(() => sessions.filter((s) => s.connected || s.status === 'ready'), [sessions]);
  const active = useMemo(() => categories.filter((c) => c.active !== false), [categories]);
  const fixedChat = prefill?.chat || null;
  const fixedCustomer = prefill?.customer || null;

  const [mode, setMode] = useState('customer'); // chat | customer | phone
  const [customer, setCustomer] = useState(null);
  const [q, setQ] = useState('');
  const [options, setOptions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('normal');
  const [priorityTouched, setPriorityTouched] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(0);
  const [notify, setNotify] = useState(true);
  const [assignee, setAssignee] = useState('__cat__');
  const [busy, setBusy] = useState(false);
  // Fase 7: campos personalizados do chamado
  const { defs: cfDefs } = useCustomFieldDefs('ticket');
  const [custom, setCustom] = useState({});
  const [cfErr, setCfErr] = useState(null);
  const searchSeq = useRef(0);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setMode(fixedChat ? 'chat' : 'customer');
    setCustomer(fixedCustomer || null);
    setQ('');
    setPhone('');
    setName('');
    setSessionId('');
    const first = active[0];
    setCategory(first?.key || '');
    setPriority(first?.default_priority || 'normal');
    setPriorityTouched(false);
    setSubject('');
    setDescription('');
    setAttachments([]);
    setNotify(true);
    setAssignee('__cat__');
    setCustom({});
    setCfErr(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // categoria ainda não carregada quando o diálogo abriu
  useEffect(() => {
    if (open && !category && active.length) {
      setCategory(active[0].key);
      if (!priorityTouched) setPriority(active[0].default_priority || 'normal');
    }
  }, [open, category, active, priorityTouched]);

  // busca de cliente
  useEffect(() => {
    if (!open || mode !== 'customer' || fixedCustomer) return undefined;
    const t = window.setTimeout(async () => {
      const s = ++searchSeq.current;
      setSearching(true);
      try {
        // rota leve (id/nome/telefone/código): vale também sem a permissão de CRM (revisão 14/10/2026, P7-6)
        const r = await get('/whatsapp/customer-pick', { params: { q: q.trim() || undefined } });
        if (s === searchSeq.current) setOptions(r?.items || []);
      } catch {
        if (s === searchSeq.current) setOptions([]);
      } finally {
        if (s === searchSeq.current) setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [q, open, mode, fixedCustomer]);

  const cat = active.find((c) => c.key === category) || null;
  const catAssignee = cat?.assignee_id ? assignees.find((u) => u.id === cat.assignee_id) : null;

  const pickCategory = (k) => {
    setCategory(k);
    const c = active.find((x) => x.key === k);
    if (c && !priorityTouched) setPriority(c.default_priority || 'normal');
  };

  const onPickFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    const room = MAX_ATTACH - attachments.length;
    if (files.length > room) toast.error(`No máximo ${MAX_ATTACH} anexos por chamado.`);
    for (const file of files.slice(0, Math.max(0, room))) {
      setUploading(1);
      try {
        const m = await uploadTicketMedia(file, (p) => setUploading(Math.max(1, p)));
        setAttachments((list) => [...list, m].slice(0, MAX_ATTACH));
      } catch (err) {
        toast.error(ticketErr(err, `Falha no envio de ${file.name}.`));
      }
    }
    setUploading(0);
  };

  const askNumber = mode === 'phone' && connected.length > 1;

  const submit = async () => {
    if (!category) return toast.error('Escolha a categoria.');
    if (description.trim().length < 3) return toast.error('Descreva o chamado (pelo menos 3 caracteres).');
    if (mode === 'customer' && !customer) return toast.error('Escolha o cliente (ou mude para "Telefone").');
    const digits = normalizePhone(phone);
    if (mode === 'phone' && digits.length < 12) return toast.error('Informe o WhatsApp com DDD.');
    const localErr = cfDefs.length ? validateCustomLocal(cfDefs, custom) : null;
    setCfErr(localErr);
    if (localErr) return toast.error(customErrorsText(cfDefs, localErr));
    setBusy(true);
    try {
      const body = {
        category,
        priority,
        subject: subject.trim() || undefined,
        description: description.trim(),
        media_ids: attachments.length ? attachments.map((m) => m.id) : undefined,
        notify,
        assigned_user_id: assignee === '__cat__' ? undefined : assignee || null,
        ...(cfDefs.length ? { custom: customPayload(cfDefs, custom) } : {})
      };
      if (mode === 'chat') {
        body.chat_id = fixedChat.chat_id;
        if (fixedCustomer?.id) body.customer_id = fixedCustomer.id;
      } else if (mode === 'customer') {
        body.customer_id = customer.id;
      } else {
        const chat = await post('/whatsapp/chats/open', {
          phone: digits,
          session_id: sessionId || undefined,
          ...(name.trim() ? { name: name.trim() } : {})
        });
        if (chat?.chat_id) body.chat_id = chat.chat_id;
        else if (chat?.jid) {
          body.chat_id = chat.jid;
          body.session_id = chat.session_id;
        }
      }
      const r = await post(API, body);
      toast.success(`Chamado ${r?.protocol || ''} aberto${notify ? ' — o cliente recebe o protocolo pelo WhatsApp' : ''}.`);
      onCreated?.(r);
      onClose?.();
    } catch (e) {
      const ce = customErrorsFrom(e);
      if (ce) setCfErr(ce);
      toast.error(ce ? customErrorsText(cfDefs, ce) : ticketErr(e, 'Não foi possível abrir o chamado.'));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <CrmModal
      open={open}
      onClose={() => !busy && onClose?.()}
      title="Novo chamado"
      subtitle="Gera um protocolo sequencial e conta o prazo (SLA) a partir de agora."
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
            disabled={busy || Boolean(uploading) || !active.length}
            startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <IconTicket size={16} />}
            sx={waPrimaryBtn}
          >
            Abrir chamado
          </Button>
        </>
      }
    >
      {open ? (
        <Stack spacing={2}>
          {/* Quem */}
          <Box>
            <SectionLabel>Cliente</SectionLabel>
            {mode === 'chat' ? (
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                <IconBrandWhatsapp size={18} />
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {fixedCustomer?.name || fixedChat?.name || fmtPhone(fixedChat?.phone) || 'Contato desta conversa'}
                </Typography>
                {fixedChat?.phone ? (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {fmtPhone(fixedChat.phone)}
                  </Typography>
                ) : null}
                {fixedChat?.session && sessions.length > 1 ? <WaNumberChip session={fixedChat.session} /> : null}
              </Stack>
            ) : fixedCustomer ? (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75 }}>
                <IconUser size={18} />
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {fixedCustomer.name}
                </Typography>
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
                            {o.code ? ` · cód. ${o.code}` : ''}
                          </Typography>
                        </Stack>
                      </li>
                    )}
                    renderInput={(params) => (
                      <TextField {...params} size="small" label="Buscar cliente" placeholder="Nome, telefone ou código" />
                    )}
                    noOptionsText={q ? 'Nenhum cliente encontrado' : 'Digite para buscar'}
                  />
                ) : (
                  <Stack spacing={1.5}>
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
                    {askNumber ? (
                      <WaNumberSelect
                        sessions={connected}
                        value={sessionId}
                        onChange={setSessionId}
                        allowAll
                        allLabel="Automático (1º número conectado)"
                        label="Falar pelo número"
                      />
                    ) : null}
                  </Stack>
                )}
              </>
            )}
          </Box>

          {/* Categoria + prioridade */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              select
              size="small"
              label="Categoria"
              value={category}
              onChange={(e) => pickCategory(e.target.value)}
              fullWidth
              helperText={
                !active.length
                  ? 'Nenhuma categoria ativa — cadastre em Configurações.'
                  : cat?.description || (cat?.sla_hours ? `Prazo desta categoria: ${cat.sla_hours} h` : ' ')
              }
            >
              {active.map((c) => (
                <MenuItem key={c.key} value={c.key}>
                  {c.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Prioridade"
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                setPriorityTouched(true);
              }}
              fullWidth
              helperText={priorityTouched ? ' ' : 'Padrão da categoria.'}
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
          </Stack>

          <TextField
            size="small"
            label="Assunto (opcional)"
            value={subject}
            onChange={(e) => setSubject(e.target.value.slice(0, 160))}
            fullWidth
            placeholder="Em branco = a primeira linha da descrição"
          />
          <TextField
            size="small"
            label="Descrição"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 5000))}
            fullWidth
            required
            multiline
            minRows={4}
            maxRows={10}
            placeholder="O que aconteceu? Quanto mais detalhes, mais rápido resolvemos."
            helperText={`${description.length.toLocaleString('pt-BR')}/5.000`}
          />

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

          {/* Anexos */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <input ref={fileRef} type="file" hidden multiple onChange={onPickFiles} />
              <Button
                size="small"
                variant="outlined"
                startIcon={uploading ? <CircularProgress size={14} /> : <IconPaperclip size={15} />}
                disabled={Boolean(uploading) || attachments.length >= MAX_ATTACH || busy}
                onClick={() => fileRef.current?.click()}
                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
              >
                {uploading ? `Enviando… ${uploading > 1 ? `${uploading}%` : ''}` : 'Anexar arquivos'}
              </Button>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Opcional · até {MAX_ATTACH} (fotos, PDF, áudio…)
              </Typography>
            </Stack>
            {attachments.length ? (
              <Box sx={{ mt: 1 }}>
                <PendingAttachments
                  items={attachments}
                  onRemove={(id) => setAttachments((list) => list.filter((m) => m.id !== id))}
                  disabled={busy}
                />
              </Box>
            ) : null}
          </Box>

          {/* Responsável + aviso */}
          <TextField select size="small" label="Responsável" value={assignee} onChange={(e) => setAssignee(e.target.value)} fullWidth>
            <MenuItem value="__cat__">
              {catAssignee ? `Padrão da categoria (${catAssignee.name || catAssignee.email})` : 'Padrão da categoria (ninguém)'}
            </MenuItem>
            <MenuItem value="">Sem responsável</MenuItem>
            {assignees.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.name || u.email}
              </MenuItem>
            ))}
          </TextField>
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
                Envia o protocolo, a categoria e o prazo (texto &quot;Chamado aberto&quot; das Configurações).
              </Typography>
            </Box>
          </Stack>
        </Stack>
      ) : null}
    </CrmModal>
  );
}
