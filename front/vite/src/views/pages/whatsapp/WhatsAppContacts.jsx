import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Pagination from '@mui/material/Pagination';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import {
  IconAddressBook,
  IconBuildingStore,
  IconBan,
  IconHandStop,
  IconBrandWhatsapp,
  IconCheck,
  IconDeviceMobile,
  IconDownload,
  IconFileSpreadsheet,
  IconInfoCircle,
  IconMessage,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTag,
  IconTrash,
  IconUpload,
  IconUserCheck,
  IconUserPlus,
  IconX
} from '@tabler/icons-react';

import { api, get, patch, post, remove } from 'api/api';
import { TgCard, TgAvatar, TgFilterBar, TgModal, TgConfirmDialog, TgEmptyState } from 'views/pages/telegram/ui';
import { WaPageHeader } from './waKit';
import { WA_GREEN, WA_DARK, WaNotConnected, useWaSession, tint, errMsg, fmtPhone, onlyDigits, fmtDateTime, fmtAgo } from './waShared';

// ============================================================================
// WhatsApp → Contatos: contatos da sessão (celular) + salvos na organização.
// Sincronizar / adicionar / importar CSV / exportar / tags / salvar / abrir conversa.
// ============================================================================

const PAGE_SIZES = [25, 50, 100];
const SAVED_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: '1', label: 'Salvos na organização' },
  { value: '0', label: 'Só da sessão' }
];
const SOURCE_LABEL = { session: 'do celular', manual: 'adicionado', import: 'importado' };

const SAMPLE_CSV = 'phone,name,tags\n5511999990000,Maria Silva,cliente|vip\n5521988887777,João Souza,lead\n';

const normTag = (t) =>
  String(t || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 40);

const parseTags = (v) => [
  ...new Set(
    String(v || '')
      .split(/[,|;\n]/)
      .map(normTag)
      .filter(Boolean)
  )
];

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
};

// ----------------------------------------------------------------------------
// KPI chip
// ----------------------------------------------------------------------------
function Kpi({ icon: Icon, label, value, accent }) {
  return (
    <TgCard hover={false} sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 2,
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          color: accent ? '#fff' : WA_DARK,
          background: accent ? `linear-gradient(135deg, ${WA_GREEN}, ${WA_DARK})` : (t) => tint(t, 'success', 0.14)
        }}
      >
        <Icon size={20} stroke={1.9} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 20, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
          {value == null ? '—' : value.toLocaleString('pt-BR')}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
          {label}
        </Typography>
      </Box>
    </TgCard>
  );
}

// ----------------------------------------------------------------------------
// Editor de tags (popover por linha e dialog em massa)
// ----------------------------------------------------------------------------
function TagsEditor({ value, onChange, suggestions = [], autoFocus }) {
  const [input, setInput] = useState('');
  const add = (raw) => {
    const tags = parseTags(raw);
    if (!tags.length) return;
    onChange([...new Set([...value, ...tags])]);
    setInput('');
  };
  const free = suggestions.filter((t) => !value.includes(t)).slice(0, 12);
  return (
    <Stack spacing={1.25}>
      <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.5}>
        {value.length ? (
          value.map((t) => (
            <Chip
              key={t}
              label={t}
              size="small"
              onDelete={() => onChange(value.filter((x) => x !== t))}
              sx={{ borderRadius: 1.5, fontWeight: 600, bgcolor: (th) => tint(th, 'success', 0.14), color: WA_DARK }}
            />
          ))
        ) : (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Nenhuma tag.
          </Typography>
        )}
      </Stack>
      <TextField
        autoFocus={autoFocus}
        size="small"
        fullWidth
        placeholder="Nova tag (Enter ou vírgula)"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add(input);
          } else if (e.key === 'Backspace' && !input && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => input.trim() && add(input)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <IconTag size={16} />
            </InputAdornment>
          )
        }}
      />
      {free.length ? (
        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.5}>
          {free.map((t) => (
            <Chip
              key={t}
              label={`+ ${t}`}
              size="small"
              variant="outlined"
              onClick={() => add(t)}
              sx={{ borderRadius: 1.5, cursor: 'pointer' }}
            />
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}

// ============================================================================
export default function WhatsAppContacts() {
  const navigate = useNavigate();
  const { session, loading: sessionLoading, connected } = useWaSession(20000);

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [saved, setSaved] = useState('all');
  const [optout, setOptout] = useState('all'); // LGPD: all | 1 (descadastrados)
  const [tag, setTag] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 1, tags: [], counts: null });
  const [loading, setLoading] = useState(true);
  const seqRef = useRef(0);

  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false); // ação de lote/sync/export
  const [rowBusy, setRowBusy] = useState({}); // id → true

  const [tagPop, setTagPop] = useState(null); // {anchor, contact, tags}
  const [addDlg, setAddDlg] = useState(null); // {phone, name, tags, loading}
  const [importDlg, setImportDlg] = useState(null); // {file, loading, result}
  const [bulkTagDlg, setBulkTagDlg] = useState(null); // {tags, loading}
  const [confirm, setConfirm] = useState(null); // {kind:'remove', contact} | {kind:'unsave-bulk'}
  const [syncResult, setSyncResult] = useState(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, saved, tag, optout, pageSize]);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      const seq = ++seqRef.current;
      if (!silent) setLoading(true);
      try {
        const r = await get('/whatsapp/contacts', {
          params: {
            q: debouncedQ || undefined,
            saved,
            tag: tag || undefined,
            optout: optout === '1' ? 1 : undefined,
            page,
            page_size: pageSize
          }
        });
        if (seq !== seqRef.current) return; // resposta fora de ordem
        setData({
          items: r.items || [],
          total: r.total || 0,
          page: r.page || page,
          pages: r.pages || 1,
          tags: Array.isArray(r.tags) ? r.tags : [],
          counts: r.counts || null
        });
      } catch (e) {
        if (seq === seqRef.current && !silent) toast.error(errMsg(e, 'Falha ao carregar contatos.'));
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    },
    [debouncedQ, saved, tag, optout, page, pageSize]
  );

  useEffect(() => {
    load();
  }, [load]);

  // seleção só entre os ids da página atual
  useEffect(() => {
    setSelected((prev) => {
      if (!prev.size) return prev;
      const ids = new Set(data.items.map((c) => c.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [data.items]);

  const patchRow = (id, patchData) => setData((d) => ({ ...d, items: d.items.map((c) => (c.id === id ? { ...c, ...patchData } : c)) }));
  const setRowLoading = (id, v) => setRowBusy((m) => ({ ...m, [id]: v }));

  // ---------------- ações por linha ----------------
  const setOptedOut = async (contact, next) => {
    setRowLoading(contact.id, true);
    try {
      const r = await patch(`/whatsapp/contacts/${contact.id}`, { opted_out: next });
      if (r && typeof r === 'object') patchRow(contact.id, r);
      toast.success(next ? 'Contato descadastrado.' : 'Contato reativado.');
      load({ silent: true });
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível atualizar.'));
    } finally {
      setRowLoading(contact.id, false);
    }
  };
  const toggleSaved = async (contact, next) => {
    patchRow(contact.id, { saved: next });
    setRowLoading(contact.id, true);
    try {
      const r = await patch(`/whatsapp/contacts/${contact.id}`, { saved: next });
      if (r && typeof r === 'object') patchRow(contact.id, r);
      load({ silent: true });
    } catch (e) {
      patchRow(contact.id, { saved: !next });
      toast.error(errMsg(e, 'Não foi possível atualizar.'));
    } finally {
      setRowLoading(contact.id, false);
    }
  };

  const saveTags = async () => {
    const { contact, tags } = tagPop;
    setTagPop(null);
    const before = contact.tags || [];
    if (JSON.stringify(before) === JSON.stringify(tags)) return;
    patchRow(contact.id, { tags });
    try {
      await patch(`/whatsapp/contacts/${contact.id}`, { tags });
      load({ silent: true }); // atualiza a lista global de tags
    } catch (e) {
      patchRow(contact.id, { tags: before });
      toast.error(errMsg(e, 'Não foi possível salvar as tags.'));
    }
  };

  const openConversation = async (contact) => {
    if (!connected) return toast.error('Conecte o WhatsApp para abrir conversas.');
    setRowLoading(contact.id, true);
    try {
      let chatId = contact.chat_id;
      if (!chatId) {
        const chat = await post('/whatsapp/chats/open', { phone: onlyDigits(contact.phone) });
        chatId = chat?.chat_id;
        if (chatId) patchRow(contact.id, { chat_id: chatId });
      }
      if (!chatId) throw new Error('Não foi possível abrir a conversa.');
      navigate(`/whatsapp/chat?chat=${encodeURIComponent(chatId)}`);
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível abrir a conversa.'));
    } finally {
      setRowLoading(contact.id, false);
    }
  };

  const checkWhatsApp = async (contact) => {
    if (!connected) return toast.error('Conecte o WhatsApp para verificar números.');
    setRowLoading(contact.id, true);
    try {
      const r = await get(`/whatsapp/contacts/${contact.id}/check`);
      if (r?.exists) {
        toast.success(`${contact.display_name || contact.name || fmtPhone(contact.phone)} tem WhatsApp.`);
        if (r.wa_id) patchRow(contact.id, { wa_id: r.wa_id });
      } else toast.error(`${fmtPhone(contact.phone)} não tem WhatsApp.`);
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível verificar.'));
    } finally {
      setRowLoading(contact.id, false);
    }
  };

  const doRemove = async () => {
    const contact = confirm?.contact;
    if (!contact) return;
    setBusy(true);
    try {
      await remove(`/whatsapp/contacts/${contact.id}`);
      toast.success('Contato removido.');
      setConfirm(null);
      setSelected((s) => {
        const n = new Set(s);
        n.delete(contact.id);
        return n;
      });
      load({ silent: true });
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível remover.'));
    } finally {
      setBusy(false);
    }
  };

  // ---------------- lote ----------------
  const bulk = async (body, okMsg) => {
    if (!selected.size) return;
    setBusy(true);
    try {
      await post('/whatsapp/contacts/bulk', { ids: [...selected], ...body });
      toast.success(okMsg);
      setSelected(new Set());
      setConfirm(null);
      setBulkTagDlg(null);
      await load({ silent: true });
    } catch (e) {
      toast.error(errMsg(e, 'Falha na ação em massa.'));
    } finally {
      setBusy(false);
    }
  };

  // ---------------- header ----------------
  const sync = async () => {
    if (!connected) return;
    setBusy(true);
    const tid = toast.loading('Sincronizando contatos do celular…');
    try {
      const r = await post('/whatsapp/contacts/sync');
      toast.dismiss(tid);
      setSyncResult({ ...r, at: new Date().toISOString() });
      toast.success(
        `Sincronizado: ${r?.imported ?? 0} novo${r?.imported === 1 ? '' : 's'}, ${r?.updated ?? 0} atualizado${r?.updated === 1 ? '' : 's'}.`
      );
      await load({ silent: true });
    } catch (e) {
      toast.dismiss(tid);
      toast.error(errMsg(e, 'Não foi possível sincronizar.'));
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    setBusy(true);
    try {
      const res = await api.get('/whatsapp/contacts/export', { params: { saved: saved === '0' ? 0 : 1 }, responseType: 'blob' });
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: 'text/csv;charset=utf-8' });
      downloadBlob(blob, `contatos-whatsapp-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success('Exportação pronta.');
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível exportar.'));
    } finally {
      setBusy(false);
    }
  };

  const addContact = async () => {
    const phone = onlyDigits(addDlg.phone);
    if (phone.length < 10 || phone.length > 15) return toast.error('Informe o número com DDI e DDD, ex.: 5511999999999.');
    setAddDlg((d) => ({ ...d, loading: true }));
    try {
      await post('/whatsapp/contacts', {
        phone,
        name: addDlg.name.trim() || undefined,
        tags: addDlg.tags.length ? addDlg.tags : undefined
      });
      toast.success('Contato adicionado e salvo na organização.');
      setAddDlg(null);
      load({ silent: true });
    } catch (e) {
      setAddDlg((d) => (d ? { ...d, loading: false } : d));
      toast.error(errMsg(e, 'Não foi possível adicionar.'));
    }
  };

  const importCsv = async () => {
    if (!importDlg?.file) return toast.error('Escolha um arquivo CSV.');
    setImportDlg((d) => ({ ...d, loading: true }));
    try {
      const fd = new FormData();
      fd.append('file', importDlg.file, importDlg.file.name);
      const r = await post('/whatsapp/contacts/import', fd, { headers: { 'Content-Type': undefined }, timeout: 120000 });
      setImportDlg((d) => ({ ...d, loading: false, result: r, file: null }));
      toast.success(`Importados ${r?.imported ?? 0} · ignorados ${r?.skipped ?? 0}.`);
      load({ silent: true });
    } catch (e) {
      setImportDlg((d) => (d ? { ...d, loading: false } : d));
      toast.error(errMsg(e, 'Não foi possível importar.'));
    }
  };

  // ---------------- derivados ----------------
  const items = data.items;
  const allSelected = items.length > 0 && items.every((c) => selected.has(c.id));
  const someSelected = items.some((c) => selected.has(c.id));
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s);
      if (allSelected) items.forEach((c) => n.delete(c.id));
      else items.forEach((c) => n.add(c.id));
      return n;
    });
  const toggleOne = (id) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const total = data.total;
  const from = total ? (data.page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, data.page * pageSize);
  const filtered = Boolean(debouncedQ || tag || saved !== 'all');
  const counts = data.counts;

  const headerAction = useMemo(
    () => (
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="flex-end">
        <Tooltip title={connected ? 'Puxa os contatos da agenda do celular conectado' : 'Conecte o WhatsApp para sincronizar'}>
          <span>
            <Button
              variant="outlined"
              startIcon={<IconDeviceMobile size={18} />}
              onClick={sync}
              disabled={!connected || busy}
              sx={{ fontWeight: 700, borderRadius: 2 }}
            >
              Sincronizar do celular
            </Button>
          </span>
        </Tooltip>
        <Button
          variant="outlined"
          startIcon={<IconUpload size={18} />}
          onClick={() => setImportDlg({ file: null, loading: false, result: null })}
          disabled={busy}
          sx={{ fontWeight: 700, borderRadius: 2 }}
        >
          Importar CSV
        </Button>
        <Button
          variant="outlined"
          startIcon={<IconDownload size={18} />}
          onClick={exportCsv}
          disabled={busy}
          sx={{ fontWeight: 700, borderRadius: 2 }}
        >
          Exportar
        </Button>
        <Button
          variant="contained"
          disableElevation
          startIcon={<IconUserPlus size={18} />}
          onClick={() => setAddDlg({ phone: '', name: '', tags: [], loading: false })}
          disabled={busy}
          sx={{ fontWeight: 700, borderRadius: 2, bgcolor: WA_GREEN, '&:hover': { bgcolor: WA_DARK } }}
        >
          Adicionar contato
        </Button>
      </Stack>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connected, busy, saved]
  );

  // ============================================================ render
  return (
    <Box>
      <WaPageHeader
        icon={IconAddressBook}
        title="Contatos"
        subtitle="Contatos do número conectado e os salvos na organização."
        sx={{ mb: 2.5 }}
        action={headerAction}
      />

      {!sessionLoading && !connected ? (
        <WaNotConnected session={session} title="Conecte o WhatsApp para gerenciar contatos" sx={{ py: { xs: 2, md: 4 } }} />
      ) : null}

      <Alert
        severity="info"
        icon={<IconInfoCircle size={20} />}
        sx={{ mb: 2.5, borderRadius: 2.5, '& .MuiAlert-message': { width: '100%' } }}
      >
        <strong>Salvo na organização</strong> = o contato fica com a organização no Pub Mail, mesmo se você desconectar ou trocar de número.
        Contatos <strong>só da sessão</strong> vêm da agenda do celular conectado e somem quando a sessão muda. Tags e observações só
        existem em contatos salvos ou adicionados aqui.
      </Alert>

      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, mb: 2.5 }}>
        <Kpi icon={IconAddressBook} label="Total de contatos" value={counts?.total} accent />
        <Kpi icon={IconUserCheck} label="Salvos na organização" value={counts?.saved} />
        <Kpi icon={IconDeviceMobile} label="Só na sessão (celular)" value={counts?.session} />
      </Box>

      <TgFilterBar>
        <TextField
          size="small"
          placeholder="Buscar por nome ou número"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ flex: 1, minWidth: 220 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <IconSearch size={16} />
              </InputAdornment>
            ),
            endAdornment: q ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setQ('')}>
                  <IconX size={14} />
                </IconButton>
              </InputAdornment>
            ) : null
          }}
        />
        <TextField select size="small" label="Salvos" value={saved} onChange={(e) => setSaved(e.target.value)} sx={{ minWidth: 200 }}>
          {SAVED_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="LGPD" value={optout} onChange={(e) => setOptout(e.target.value)} sx={{ minWidth: 170 }}>
          <MenuItem value="all">Todos</MenuItem>
          <MenuItem value="1">Só descadastrados</MenuItem>
        </TextField>
        <TextField select size="small" label="Tag" value={tag} onChange={(e) => setTag(e.target.value)} sx={{ minWidth: 170 }}>
          <MenuItem value="">Todas</MenuItem>
          {data.tags.map((t) => (
            <MenuItem key={t} value={t}>
              {t}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Por página"
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          sx={{ minWidth: 120 }}
        >
          {PAGE_SIZES.map((n) => (
            <MenuItem key={n} value={n}>
              {n}
            </MenuItem>
          ))}
        </TextField>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Atualizar">
          <span>
            <IconButton onClick={() => load()} disabled={loading}>
              <IconRefresh size={18} />
            </IconButton>
          </span>
        </Tooltip>
      </TgFilterBar>

      {syncResult ? (
        <Alert severity="success" onClose={() => setSyncResult(null)} sx={{ mb: 2, borderRadius: 2.5 }}>
          Sincronização concluída {fmtAgo(syncResult.at)}: <strong>{syncResult.imported ?? 0}</strong> novos e{' '}
          <strong>{syncResult.updated ?? 0}</strong> atualizados.
        </Alert>
      ) : null}

      {/* barra de seleção */}
      {selected.size ? (
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1}
          alignItems={{ md: 'center' }}
          sx={{
            mb: 1.5,
            px: 1.5,
            py: 1,
            borderRadius: 2.5,
            border: '1px solid',
            borderColor: WA_GREEN,
            bgcolor: (t) => tint(t, 'success', 0.08)
          }}
        >
          <Typography sx={{ fontWeight: 700, flex: 1 }}>
            {selected.size} contato{selected.size === 1 ? '' : 's'} selecionado{selected.size === 1 ? '' : 's'}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              size="small"
              variant="contained"
              disableElevation
              startIcon={<IconUserCheck size={16} />}
              onClick={() => bulk({ saved: true }, 'Contatos salvos na organização.')}
              disabled={busy}
              sx={{ fontWeight: 700, bgcolor: WA_GREEN, '&:hover': { bgcolor: WA_DARK } }}
            >
              Salvar na organização
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<IconBan size={16} />}
              onClick={() => setConfirm({ kind: 'unsave-bulk' })}
              disabled={busy}
              sx={{ fontWeight: 700 }}
            >
              Remover da organização
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<IconTag size={16} />}
              onClick={() => setBulkTagDlg({ tags: [], loading: false })}
              disabled={busy}
              sx={{ fontWeight: 700 }}
            >
              Adicionar tags…
            </Button>
            <Button size="small" color="inherit" onClick={() => setSelected(new Set())} sx={{ fontWeight: 600 }}>
              Limpar
            </Button>
          </Stack>
        </Stack>
      ) : null}

      <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper' }}>
        <Table size="small" sx={{ minWidth: 960 }}>
          <TableHead>
            <TableRow sx={{ '& th': { fontWeight: 800, bgcolor: 'action.hover', whiteSpace: 'nowrap' } }}>
              <TableCell padding="checkbox">
                <Checkbox
                  size="small"
                  checked={allSelected}
                  indeterminate={!allSelected && someSelected}
                  onChange={toggleAll}
                  sx={{ '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: WA_GREEN } }}
                />
              </TableCell>
              <TableCell>Contato</TableCell>
              <TableCell>Telefone</TableCell>
              <TableCell>Tags</TableCell>
              <TableCell align="center">Salvo na organização</TableCell>
              <TableCell>Última mensagem</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && !items.length ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={26} sx={{ color: WA_GREEN }} />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} sx={{ py: 3, border: 0 }}>
                  <TgEmptyState
                    dense
                    icon={IconAddressBook}
                    title={filtered ? 'Nenhum contato para este filtro' : 'Nenhum contato ainda'}
                    description={
                      filtered
                        ? 'Ajuste a busca ou os filtros acima.'
                        : connected
                          ? 'Sincronize a agenda do celular, adicione um contato ou importe um CSV.'
                          : 'Conecte o WhatsApp para sincronizar a agenda, ou adicione contatos manualmente.'
                    }
                    action={
                      connected && !filtered ? (
                        <Button
                          variant="contained"
                          disableElevation
                          startIcon={<IconDeviceMobile size={18} />}
                          onClick={sync}
                          disabled={busy}
                          sx={{ fontWeight: 700, bgcolor: WA_GREEN, '&:hover': { bgcolor: WA_DARK } }}
                        >
                          Sincronizar do celular
                        </Button>
                      ) : null
                    }
                    sx={{ border: 'none' }}
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((c) => {
                const name = c.display_name || c.name || c.push_name || fmtPhone(c.phone);
                const secondary = c.push_name && c.push_name !== name ? c.push_name : null;
                const isSel = selected.has(c.id);
                const rb = Boolean(rowBusy[c.id]);
                return (
                  <TableRow key={c.id} hover selected={isSel} sx={{ opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={isSel}
                        onChange={() => toggleOne(c.id)}
                        sx={{ '&.Mui-checked': { color: WA_GREEN } }}
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 220 }}>
                      <Stack direction="row" spacing={1.25} alignItems="center">
                        <TgAvatar name={name} photoPath={`/whatsapp/contacts/${c.id}/photo`} size={38} kind="contact" />
                        <Box sx={{ minWidth: 0 }}>
                          <Stack direction="row" spacing={0.6} alignItems="center">
                            <Typography sx={{ fontWeight: 700 }} noWrap>
                              {name}
                            </Typography>
                            {c.is_business ? (
                              <Tooltip title="Conta WhatsApp Business">
                                <Chip
                                  size="small"
                                  icon={<IconBuildingStore size={12} />}
                                  label="Business"
                                  sx={{
                                    height: 18,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    '& .MuiChip-icon': { ml: 0.5 },
                                    color: WA_DARK,
                                    bgcolor: (t) => tint(t, 'success', 0.14)
                                  }}
                                />
                              </Tooltip>
                            ) : null}
                            {c.opted_out ? (
                              <Tooltip
                                title={`Pediu para não receber mensagens (LGPD) em ${fmtDateTime(c.opted_out_at)}. Não entra em disparos em massa.`}
                              >
                                <Chip
                                  size="small"
                                  icon={<IconHandStop size={12} />}
                                  label="Descadastrado"
                                  color="warning"
                                  variant="outlined"
                                  sx={{ height: 18, fontSize: 10, fontWeight: 700 }}
                                />
                              </Tooltip>
                            ) : null}
                            {c.is_blocked ? (
                              <Chip
                                size="small"
                                icon={<IconBan size={12} />}
                                label="Bloqueado"
                                color="error"
                                variant="outlined"
                                sx={{ height: 18, fontSize: 10, fontWeight: 700 }}
                              />
                            ) : null}
                          </Stack>
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }} noWrap>
                            {secondary ? `${secondary} · ` : ''}
                            {SOURCE_LABEL[c.source] || c.source || ''}
                            {c.is_my_contact ? ' · na agenda' : ''}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Stack direction="row" spacing={0.6} alignItems="center">
                        <IconBrandWhatsapp size={15} color={WA_GREEN} />
                        <Typography sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: 13.5 }}>
                          {fmtPhone(c.phone)}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ minWidth: 180 }}>
                      <Stack
                        direction="row"
                        spacing={0.5}
                        flexWrap="wrap"
                        useFlexGap
                        alignItems="center"
                        onClick={(e) => setTagPop({ anchor: e.currentTarget, contact: c, tags: [...(c.tags || [])] })}
                        sx={{
                          cursor: 'pointer',
                          minHeight: 26,
                          borderRadius: 1.5,
                          px: 0.5,
                          mx: -0.5,
                          '&:hover': { bgcolor: 'action.hover' }
                        }}
                      >
                        {(c.tags || []).slice(0, 4).map((t) => (
                          <Chip
                            key={t}
                            label={t}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: 11,
                              fontWeight: 600,
                              borderRadius: 1.5,
                              color: WA_DARK,
                              bgcolor: (th) => tint(th, 'success', 0.14)
                            }}
                          />
                        ))}
                        {(c.tags || []).length > 4 ? (
                          <Chip
                            label={`+${c.tags.length - 4}`}
                            size="small"
                            variant="outlined"
                            sx={{ height: 20, fontSize: 11, borderRadius: 1.5 }}
                          />
                        ) : null}
                        {!(c.tags || []).length ? (
                          <Typography
                            variant="caption"
                            sx={{ color: 'text.disabled', display: 'inline-flex', alignItems: 'center', gap: 0.4 }}
                          >
                            <IconPlus size={12} /> tag
                          </Typography>
                        ) : null}
                      </Stack>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip
                        title={
                          c.saved
                            ? 'Salvo: fica com a organização mesmo trocando de número'
                            : 'Só da sessão: clique para salvar na organização'
                        }
                      >
                        <Switch
                          size="small"
                          checked={Boolean(c.saved)}
                          onChange={(e) => toggleSaved(c, e.target.checked)}
                          disabled={rb}
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': { color: WA_GREEN },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: WA_GREEN }
                          }}
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {c.last_message_at ? (
                        <Tooltip title={fmtDateTime(c.last_message_at)}>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {fmtAgo(c.last_message_at)}
                          </Typography>
                        </Tooltip>
                      ) : (
                        <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Stack direction="row" spacing={0.25} justifyContent="flex-end">
                        <Tooltip title="Abrir conversa">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => openConversation(c)}
                              disabled={rb || !connected}
                              sx={{ color: WA_DARK }}
                            >
                              {rb ? <CircularProgress size={16} /> : <IconMessage size={18} />}
                            </IconButton>
                          </span>
                        </Tooltip>
                        {c.opted_out ? (
                          <Tooltip title="Reativar: volta a receber disparos (use só com consentimento do contato)">
                            <span>
                              <IconButton size="small" color="warning" onClick={() => setOptedOut(c, false)} disabled={rb}>
                                <IconHandStop size={18} />
                              </IconButton>
                            </span>
                          </Tooltip>
                        ) : null}
                        <Tooltip title="Verificar se tem WhatsApp">
                          <span>
                            <IconButton size="small" onClick={() => checkWhatsApp(c)} disabled={rb || !connected}>
                              <IconCheck size={18} />
                            </IconButton>
                          </span>
                        </Tooltip>
                        {c.source === 'manual' || c.source === 'import' ? (
                          <Tooltip title="Remover contato">
                            <span>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setConfirm({ kind: 'remove', contact: c })}
                                disabled={rb}
                              >
                                <IconTrash size={18} />
                              </IconButton>
                            </span>
                          </Tooltip>
                        ) : null}
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        sx={{ mt: 2 }}
      >
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
          {total > 0 ? `Mostrando ${from}–${to} de ${total} contato${total === 1 ? '' : 's'}` : 'Mostrando 0 de 0 contatos'}
        </Typography>
        <Pagination
          color="primary"
          page={data.page}
          onChange={(_, v) => setPage(v)}
          count={Math.max(1, data.pages)}
          disabled={loading}
          shape="rounded"
        />
      </Stack>

      {/* ---------------- popover de tags ---------------- */}
      <Popover
        open={Boolean(tagPop)}
        anchorEl={tagPop?.anchor}
        onClose={saveTags}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { p: 1.75, width: 320, borderRadius: 2.5 } } }}
      >
        {tagPop ? (
          <Stack spacing={1.25}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Tags de <strong>{tagPop.contact.display_name || tagPop.contact.name || fmtPhone(tagPop.contact.phone)}</strong>
              {!tagPop.contact.saved ? ' (ao salvar, o contato passa a ser da organização)' : ''}
            </Typography>
            <TagsEditor autoFocus value={tagPop.tags} onChange={(tags) => setTagPop((p) => ({ ...p, tags }))} suggestions={data.tags} />
            <Button
              size="small"
              variant="contained"
              disableElevation
              onClick={saveTags}
              sx={{ alignSelf: 'flex-end', fontWeight: 700, bgcolor: WA_GREEN, '&:hover': { bgcolor: WA_DARK } }}
            >
              Aplicar
            </Button>
          </Stack>
        ) : null}
      </Popover>

      {/* ---------------- adicionar contato ---------------- */}
      <TgModal
        open={Boolean(addDlg)}
        onClose={() => !addDlg?.loading && setAddDlg(null)}
        title="Adicionar contato"
        subtitle="Fica salvo na organização, independente do celular conectado."
        maxWidth="xs"
        footer={
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={() => setAddDlg(null)} disabled={addDlg?.loading}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              disableElevation
              onClick={addContact}
              disabled={addDlg?.loading}
              startIcon={addDlg?.loading ? <CircularProgress size={16} color="inherit" /> : <IconUserPlus size={16} />}
              sx={{ fontWeight: 700, bgcolor: WA_GREEN, '&:hover': { bgcolor: WA_DARK } }}
            >
              Adicionar
            </Button>
          </Stack>
        }
      >
        {addDlg ? (
          <Stack spacing={1.75}>
            <TextField
              autoFocus
              label="Número com DDI e DDD"
              placeholder="5511999999999"
              size="small"
              fullWidth
              value={addDlg.phone}
              onChange={(e) => setAddDlg((d) => ({ ...d, phone: e.target.value.replace(/[^\d+() -]/g, '').slice(0, 24) }))}
              helperText={onlyDigits(addDlg.phone).length >= 10 ? fmtPhone(addDlg.phone) : 'Só dígitos, sem o sinal de +.'}
              inputProps={{ inputMode: 'tel' }}
            />
            <TextField
              label="Nome (opcional)"
              size="small"
              fullWidth
              value={addDlg.name}
              onChange={(e) => setAddDlg((d) => ({ ...d, name: e.target.value.slice(0, 80) }))}
            />
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.75 }}>
                Tags (opcional)
              </Typography>
              <TagsEditor value={addDlg.tags} onChange={(tags) => setAddDlg((d) => ({ ...d, tags }))} suggestions={data.tags} />
            </Box>
          </Stack>
        ) : null}
      </TgModal>

      {/* ---------------- importar CSV ---------------- */}
      <TgModal
        open={Boolean(importDlg)}
        onClose={() => !importDlg?.loading && setImportDlg(null)}
        title="Importar contatos (CSV)"
        subtitle="Colunas: phone, name, tags (tags separadas por |). Os contatos entram salvos na organização."
        maxWidth="sm"
        footer={
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={() => setImportDlg(null)} disabled={importDlg?.loading}>
              Fechar
            </Button>
            <Button
              variant="contained"
              disableElevation
              onClick={importCsv}
              disabled={importDlg?.loading || !importDlg?.file}
              startIcon={importDlg?.loading ? <CircularProgress size={16} color="inherit" /> : <IconUpload size={16} />}
              sx={{ fontWeight: 700, bgcolor: WA_GREEN, '&:hover': { bgcolor: WA_DARK } }}
            >
              Importar
            </Button>
          </Stack>
        }
      >
        {importDlg ? (
          <Stack spacing={2}>
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'background.default', border: '1px dashed', borderColor: 'divider' }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                  Exemplo do formato
                </Typography>
                <Button
                  size="small"
                  startIcon={<IconFileSpreadsheet size={14} />}
                  onClick={() => downloadBlob(new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8' }), 'exemplo-contatos.csv')}
                  sx={{ fontWeight: 700 }}
                >
                  Baixar exemplo
                </Button>
              </Stack>
              <Box
                component="pre"
                sx={{ m: 0, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, whiteSpace: 'pre-wrap', color: 'text.secondary' }}
              >
                {SAMPLE_CSV.trim()}
              </Box>
            </Box>
            <Box
              component="label"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 2,
                borderRadius: 2.5,
                border: '2px dashed',
                borderColor: importDlg.file ? WA_GREEN : 'divider',
                cursor: 'pointer',
                bgcolor: importDlg.file ? (t) => tint(t, 'success', 0.08) : 'transparent',
                '&:hover': { borderColor: WA_GREEN }
              }}
            >
              <input
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={(e) => setImportDlg((d) => ({ ...d, file: e.target.files?.[0] || null, result: null }))}
              />
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  display: 'grid',
                  placeItems: 'center',
                  color: WA_DARK,
                  bgcolor: (t) => tint(t, 'success', 0.14),
                  flexShrink: 0
                }}
              >
                <IconFileSpreadsheet size={22} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700 }} noWrap>
                  {importDlg.file ? importDlg.file.name : 'Escolher arquivo CSV'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {importDlg.file
                    ? `${(importDlg.file.size / 1024).toFixed(1)} KB · clique para trocar`
                    : 'Números com DDI e DDD, só dígitos. Linhas repetidas ou inválidas são ignoradas.'}
                </Typography>
              </Box>
            </Box>
            {importDlg.result ? (
              <Alert severity="success" sx={{ borderRadius: 2 }}>
                Importados <strong>{importDlg.result.imported ?? 0}</strong> · ignorados <strong>{importDlg.result.skipped ?? 0}</strong>.
              </Alert>
            ) : null}
          </Stack>
        ) : null}
      </TgModal>

      {/* ---------------- tags em massa ---------------- */}
      <TgModal
        open={Boolean(bulkTagDlg)}
        onClose={() => !busy && setBulkTagDlg(null)}
        title={`Adicionar tags a ${selected.size} contato${selected.size === 1 ? '' : 's'}`}
        subtitle="As tags são acrescentadas, sem remover as existentes."
        maxWidth="xs"
        footer={
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={() => setBulkTagDlg(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              disableElevation
              disabled={busy || !bulkTagDlg?.tags.length}
              onClick={() => bulk({ add_tags: bulkTagDlg.tags }, 'Tags adicionadas.')}
              startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <IconTag size={16} />}
              sx={{ fontWeight: 700, bgcolor: WA_GREEN, '&:hover': { bgcolor: WA_DARK } }}
            >
              Aplicar
            </Button>
          </Stack>
        }
      >
        {bulkTagDlg ? (
          <TagsEditor
            autoFocus
            value={bulkTagDlg.tags}
            onChange={(tags) => setBulkTagDlg((d) => ({ ...d, tags }))}
            suggestions={data.tags}
          />
        ) : null}
      </TgModal>

      <TgConfirmDialog
        open={confirm?.kind === 'remove'}
        onClose={() => setConfirm(null)}
        onConfirm={doRemove}
        danger
        loading={busy}
        title="Remover este contato?"
        message={`${confirm?.contact?.display_name || confirm?.contact?.name || fmtPhone(confirm?.contact?.phone)} sai da lista da organização. As conversas no WhatsApp não são afetadas.`}
        confirmLabel="Remover"
      />
      <TgConfirmDialog
        open={confirm?.kind === 'unsave-bulk'}
        onClose={() => setConfirm(null)}
        onConfirm={() => bulk({ saved: false }, 'Contatos removidos da organização.')}
        danger
        loading={busy}
        title={`Remover ${selected.size} contato${selected.size === 1 ? '' : 's'} da organização?`}
        message="Eles deixam de ser salvos na organização. Se ainda estiverem na agenda do celular conectado, continuam aparecendo como contatos da sessão."
        confirmLabel="Remover"
      />
    </Box>
  );
}
