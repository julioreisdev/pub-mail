import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Pagination from '@mui/material/Pagination';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
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
  IconAlertTriangle,
  IconCash,
  IconBuildingStore,
  IconListDetails,
  IconMessage,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconUserDollar,
  IconUsers,
  IconX,
  IconDownload,
  IconUpload
} from '@tabler/icons-react';

import { api, get, post } from 'api/api';
import { useAuth } from 'contexts/AuthContext';
import { TgAvatar, TgCard, TgEmptyState, TgFilterBar, TgListSkeleton } from 'views/pages/telegram/ui';
import { WaNumberDot, WaPageHeader, sessionLabel, useWaSessions } from './waKit';
import { WA_DARK, errMsg, fmtPhone, tint } from './waShared';
import CustomerDialog from './crm/CustomerDialog';
import ImportDialog from './crm/ImportDialog';
import CustomFieldsEditor from './crm/CustomFieldsEditor';
import UnitsManager, { useUnits } from './crm/UnitsManager';
import { useCrmSettings } from './crm/customFields';
import {
  BILLING_STATUS,
  CrmKpi,
  CustomerNumberChips,
  StatusChip,
  WaNumberFilter,
  chatUrl,
  dueText,
  useSessionFilter,
  useXs,
  waPrimaryBtn
} from './crm/crmKit';

// ============================================================================
// WhatsApp → Clientes: contatos que são clientes de verdade — o que usam/pagam,
// situação (em dia / em atraso), próximo vencimento. Abre a conversa com 1 clique.
// Multi-número: o cliente é da org; `customer.chats[]` = conversas dele (uma por número,
// mais recente primeiro, `chat_id` = uuid). Chips dos números na tabela, filtro "Número"
// (?session=, aplicado no cliente sobre `chats[].session_id`) e menu para escolher por
// qual número abrir/iniciar a conversa quando há mais de um.
// ============================================================================

const PAGE_SIZES = [25, 50, 100];
// ============================================================================
export default function WhatsAppCustomers() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const xs = useXs();
  const canEdit = ['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(user?.user?.role);
  const { sessions, byId: sessionsById, connected } = useWaSessions(30000);
  const { value: sessionId, set: setSessionId, multi } = useSessionFilter(sessions);
  const connectedSessions = useMemo(() => sessions.filter((s) => s.connected || s.status === 'ready'), [sessions]);
  const [openMenu, setOpenMenu] = useState(null); // {anchor, customer, mode:'chats'|'sessions'}

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [status, setStatus] = useState('all');
  const [billing, setBilling] = useState('all');
  const [productId, setProductId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 1, counts: null });
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [unitId, setUnitId] = useState(''); // '' = todas · 'none' = sem unidade · id
  const [pageTab, setPageTab] = useState('customers'); // customers | units
  const [dlg, setDlg] = useState(null); // {customer?}
  const [fieldsDlg, setFieldsDlg] = useState(false);
  const { settings: crmSettings } = useCrmSettings();
  const identity = crmSettings?.identity || null;
  const { units } = useUnits(true);
  const [rowBusy, setRowBusy] = useState({});
  const seqRef = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);
  useEffect(() => {
    setPage(1);
  }, [debouncedQ, status, billing, productId, unitId, pageSize]);

  useEffect(() => {
    get('/whatsapp/products')
      .then((r) => setProducts(Array.isArray(r) ? r : []))
      .catch(() => setProducts([]));
  }, []);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      const seq = ++seqRef.current;
      if (!silent) setLoading(true);
      try {
        const r = await get('/whatsapp/customers', {
          params: {
            q: debouncedQ || undefined,
            status: status === 'all' ? undefined : status,
            billing: billing === 'all' ? undefined : billing,
            product_id: productId || undefined,
            unit_id: unitId || undefined,
            session_id: sessionId || undefined,
            page,
            page_size: pageSize
          }
        });
        if (seq !== seqRef.current) return;
        setData({ items: r.items || [], total: r.total || 0, page: r.page || page, pages: r.pages || 1, counts: r.counts || null });
      } catch (e) {
        if (seq === seqRef.current && !silent) toast.error(errMsg(e, 'Falha ao carregar clientes.'));
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    },
    [debouncedQ, status, billing, productId, unitId, sessionId, page, pageSize]
  );
  useEffect(() => {
    load();
  }, [load]);

  const patchRow = (c) => setData((d) => ({ ...d, items: d.items.map((x) => (x.id === c.id ? c : x)) }));

  // Inicia (ou acha) a conversa do cliente num número e vai para o Chat.
  const startConversation = async (c, sid) => {
    if (!connected) return toast.error('Conecte o WhatsApp para abrir conversas.');
    setRowBusy((m) => ({ ...m, [c.id]: true }));
    try {
      const existing = sid ? (c.chats || []).find((x) => x.session_id === sid) : null;
      let chatId = existing?.chat_id || null;
      if (!chatId) {
        const chat = await post('/whatsapp/chats/open', { phone: c.phone, ...(sid ? { session_id: sid } : {}) });
        chatId = chat?.chat_id;
      }
      if (!chatId) throw new Error('Não foi possível abrir a conversa.');
      navigate(chatUrl(chatId));
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível abrir a conversa.'));
    } finally {
      setRowBusy((m) => ({ ...m, [c.id]: false }));
    }
    return undefined;
  };
  // Clique em "Abrir conversa": 1 conversa → abre; várias → menu por número; nenhuma → menu dos
  // números conectados (ou direto, quando só há um).
  const openConversation = (c, anchor) => {
    const chats = c.chats || [];
    if (chats.length === 1) return navigate(chatUrl(chats[0].chat_id));
    if (chats.length > 1) return setOpenMenu({ anchor, customer: c, mode: 'chats' });
    if (connectedSessions.length > 1) return setOpenMenu({ anchor, customer: c, mode: 'sessions' });
    return startConversation(c, connectedSessions[0]?.id || null);
  };

  const counts = data.counts;
  // filtro por número (client-side: o cliente é da org; "está no número" = tem conversa lá)
  const items = useMemo(
    () => (sessionId ? data.items.filter((c) => (c.chats || []).some((x) => x.session_id === sessionId)) : data.items),
    [data.items, sessionId]
  );
  const total = data.total;
  const from = total ? (data.page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, data.page * pageSize);
  const filtered = Boolean(debouncedQ || status !== 'all' || billing !== 'all' || productId || unitId || sessionId);

  const [importOpen, setImportOpen] = useState(false);
  const exportCsv = useCallback(async () => {
    try {
      const res = await api.get('/whatsapp/customers/export', { responseType: 'blob' });
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `clientes-whatsapp-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 0);
      toast.success('Exportação pronta.');
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível exportar.'));
    }
  }, []);
  const headerAction = useMemo(
    () => (
      <Stack
        direction="row"
        spacing={1}
        flexWrap="wrap"
        useFlexGap
        justifyContent={{ xs: 'flex-start', md: 'flex-end' }}
        sx={{ width: { xs: '100%', md: 'auto' }, '& .MuiButton-root': { flex: { xs: '1 1 45%', md: '0 0 auto' }, minHeight: 40 } }}
      >
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<IconDownload size={18} />}
          onClick={exportCsv}
          sx={{ fontWeight: 700, borderRadius: 2 }}
        >
          Exportar
        </Button>
        {canEdit ? (
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<IconUpload size={18} />}
            onClick={() => setImportOpen(true)}
            sx={{ fontWeight: 700, borderRadius: 2 }}
          >
            Importar CSV
          </Button>
        ) : null}
        {canEdit ? (
          <Button
            variant="outlined"
            startIcon={<IconListDetails size={18} />}
            onClick={() => setFieldsDlg(true)}
            sx={{ fontWeight: 700, borderRadius: 2, whiteSpace: 'nowrap' }}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              Campos personalizados
            </Box>
            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
              Campos extras
            </Box>
          </Button>
        ) : null}
        <Button
          variant="contained"
          disableElevation
          startIcon={<IconPlus size={18} />}
          onClick={() => setDlg({ customer: null })}
          sx={waPrimaryBtn}
        >
          Novo cliente
        </Button>
      </Stack>
    ),
    [canEdit, exportCsv]
  );

  return (
    <Box>
      <WaPageHeader
        icon={IconUserDollar}
        title="Clientes"
        subtitle="Quem compra ou assina algo da sua empresa: o que usa, quanto paga e se está em dia."
        sx={{ mb: 2.5 }}
        action={headerAction}
      />

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
          mb: 2.5
        }}
      >
        <CrmKpi icon={IconUsers} label="Clientes ativos" value={counts?.active} accent />
        <CrmKpi icon={IconAlertTriangle} label="Em atraso" value={counts?.overdue} />
        <CrmKpi
          icon={IconCash}
          label="Receita recorrente / mês"
          value={counts ? counts.monthly_label : null}
          hint="Soma das assinaturas ativas convertida para o mês"
        />
        <CrmKpi icon={IconUserDollar} label="Total cadastrado" value={counts?.total} />
      </Box>

      <Tabs
        value={pageTab}
        onChange={(_, v) => setPageTab(v)}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{
          mb: 2,
          minHeight: 40,
          borderBottom: '1px solid',
          borderColor: 'divider',
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 40 }
        }}
      >
        <Tab value="customers" icon={<IconUsers size={17} />} iconPosition="start" label="Clientes" />
        <Tab
          value="units"
          icon={<IconBuildingStore size={17} />}
          iconPosition="start"
          label={`Unidades${units.length ? ` (${units.length})` : ''}`}
        />
      </Tabs>

      {pageTab === 'units' ? (
        <UnitsManager
          canEdit={canEdit}
          onFilter={(id) => {
            setUnitId(id);
            setPageTab('customers');
          }}
        />
      ) : (
        <>
          <TgFilterBar>
            <TextField
              size="small"
              placeholder="Buscar por nome, telefone, e-mail, CPF/CNPJ ou código"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              sx={{ flex: 1, minWidth: 240 }}
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
            <Box sx={{ display: { xs: 'grid', md: 'contents' }, gap: 1.25, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <TextField
                select
                size="small"
                label="Situação"
                value={billing}
                onChange={(e) => setBilling(e.target.value)}
                sx={{ minWidth: 150 }}
              >
                <MenuItem value="all">Todas</MenuItem>
                <MenuItem value="overdue">Em atraso</MenuItem>
              </TextField>
              <TextField
                select
                size="small"
                label="Cliente"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                sx={{ minWidth: 140 }}
              >
                <MenuItem value="all">Ativos e inativos</MenuItem>
                <MenuItem value="active">Ativos</MenuItem>
                <MenuItem value="inactive">Inativos</MenuItem>
              </TextField>
              <TextField
                select
                size="small"
                label="Produto"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">Todos</MenuItem>
                {products.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </TextField>
              {units.length ? (
                <TextField
                  select
                  size="small"
                  label="Unidade"
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  sx={{ minWidth: 160 }}
                >
                  <MenuItem value="">Todas</MenuItem>
                  <MenuItem value="none">Sem unidade</MenuItem>
                  {units.map((u) => (
                    <MenuItem key={u.id} value={u.id}>
                      {u.name}
                    </MenuItem>
                  ))}
                </TextField>
              ) : null}
              <WaNumberFilter
                sessions={sessions}
                value={sessionId}
                onChange={setSessionId}
                sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}
              />
              <TextField
                select
                size="small"
                label="Por página"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                sx={{ minWidth: 110 }}
              >
                {PAGE_SIZES.map((n) => (
                  <MenuItem key={n} value={n}>
                    {n}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
            <Box sx={{ flex: 1, display: { xs: 'none', md: 'block' } }} />
            <Tooltip title="Atualizar">
              <Box component="span" sx={{ alignSelf: { xs: 'flex-end', md: 'center' } }}>
                <IconButton onClick={() => load()} disabled={loading}>
                  <IconRefresh size={18} />
                </IconButton>
              </Box>
            </Tooltip>
          </TgFilterBar>

          {loading && !items.length ? (
            <TgCard hover={false} sx={{ p: 2 }}>
              <TgListSkeleton rows={6} />
            </TgCard>
          ) : items.length === 0 ? (
            <TgEmptyState
              icon={IconUserDollar}
              title={filtered ? 'Nenhum cliente com esses filtros' : 'Nenhum cliente ainda'}
              description={
                filtered
                  ? sessionId && data.items.length
                    ? 'Nenhum cliente desta página tem conversa nesse número. Mude de página ou limpe o filtro de número.'
                    : 'Tente outra busca ou limpe os filtros.'
                  : 'Cadastre aqui ou, na conversa do WhatsApp, abra o painel "Cliente" e clique em "Tornar cliente".'
              }
              action={
                !filtered ? (
                  <Button
                    variant="contained"
                    disableElevation
                    startIcon={<IconPlus size={18} />}
                    onClick={() => setDlg({ customer: null })}
                    sx={waPrimaryBtn}
                  >
                    Cadastrar o primeiro cliente
                  </Button>
                ) : null
              }
            />
          ) : (
            <TgCard hover={false} sx={{ p: 0, overflow: 'hidden' }}>
              {xs ? (
                <Box>
                  {items.map((c) => (
                    <Box
                      key={c.id}
                      onClick={() => setDlg({ customer: c })}
                      sx={{
                        p: 1.5,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        cursor: 'pointer',
                        opacity: c.status === 'inactive' ? 0.6 : 1,
                        '&:active': { bgcolor: 'action.hover' }
                      }}
                    >
                      <Stack direction="row" spacing={1.25} alignItems="flex-start">
                        <TgAvatar name={c.name} size={40} kind="contact" />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                            {c.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap display="block">
                            {fmtPhone(c.phone)}
                            {c.unit?.name ? ` · ${c.unit.name}` : ''}
                            {c.email ? ` · ${c.email}` : ''}
                          </Typography>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap alignItems="center" sx={{ mt: 0.75 }}>
                            <StatusChip map={BILLING_STATUS} status={c.billing_status} size="md" />
                            {c.products.slice(0, 2).map((p, i) => (
                              <Chip
                                key={i}
                                size="small"
                                label={p}
                                sx={{
                                  height: 22,
                                  fontWeight: 600,
                                  borderRadius: 1.5,
                                  bgcolor: (t) => tint(t, 'success', 0.12),
                                  color: WA_DARK
                                }}
                              />
                            ))}
                            {c.products.length > 2 ? (
                              <Chip size="small" label={`+${c.products.length - 2}`} sx={{ height: 22, borderRadius: 1.5 }} />
                            ) : null}
                          </Stack>
                          <Stack direction="row" spacing={1} alignItems="baseline" justifyContent="space-between" sx={{ mt: 0.75 }}>
                            <Typography
                              variant="caption"
                              sx={{ color: c.days_to_due < 0 ? 'warning.main' : 'text.secondary', minWidth: 0 }}
                            >
                              {c.next_due_label ? `${c.next_due_label} · ${dueText(c.days_to_due)}` : 'Sem vencimento'}
                            </Typography>
                            <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, flexShrink: 0 }}>
                              {c.monthly_cents ? `${c.monthly_label}/mês` : ''}
                            </Typography>
                          </Stack>
                          {multi && c.chats?.length ? (
                            <Box sx={{ mt: 0.75 }} onClick={(e) => e.stopPropagation()}>
                              <CustomerNumberChips
                                chats={c.chats}
                                byId={sessionsById}
                                max={3}
                                onPick={(ch) => navigate(chatUrl(ch.chat_id))}
                              />
                            </Box>
                          ) : null}
                        </Box>
                        <Stack spacing={0.25} onClick={(e) => e.stopPropagation()} sx={{ flexShrink: 0, mr: -0.5, mt: -0.5 }}>
                          <IconButton
                            onClick={(e) => openConversation(c, e.currentTarget)}
                            disabled={rowBusy[c.id]}
                            aria-label="Abrir conversa"
                          >
                            {rowBusy[c.id] ? <CircularProgress size={16} /> : <IconMessage size={19} />}
                          </IconButton>
                          <IconButton onClick={() => setDlg({ customer: c })} aria-label="Editar">
                            <IconPencil size={19} />
                          </IconButton>
                        </Stack>
                      </Stack>
                    </Box>
                  ))}
                </Box>
              ) : (
                <TableContainer>
                  <Table size="small" sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Cliente</TableCell>
                        {multi ? <TableCell>Números</TableCell> : null}
                        <TableCell>Produtos</TableCell>
                        <TableCell>Situação</TableCell>
                        <TableCell>Próximo vencimento</TableCell>
                        <TableCell align="right">Mensal</TableCell>
                        <TableCell align="right">Ações</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {items.map((c) => (
                        <TableRow
                          key={c.id}
                          hover
                          sx={{ cursor: 'pointer', opacity: c.status === 'inactive' ? 0.6 : 1 }}
                          onClick={() => setDlg({ customer: c })}
                        >
                          <TableCell sx={{ maxWidth: 300 }}>
                            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
                              <TgAvatar name={c.name} size={36} kind="contact" />
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                                  {c.name}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap display="block">
                                  {fmtPhone(c.phone)}
                                  {c.contacts?.length > 1 ? ` +${c.contacts.length - 1}` : ''}
                                  {c.code ? ` · ${c.code}` : ''}
                                  {c.unit?.name ? ` · ${c.unit.name}` : ''}
                                  {c.email ? ` · ${c.email}` : ''}
                                </Typography>
                              </Box>
                            </Stack>
                          </TableCell>
                          {multi ? (
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              {c.chats?.length ? (
                                <CustomerNumberChips
                                  chats={c.chats}
                                  byId={sessionsById}
                                  max={3}
                                  onPick={(ch) => navigate(chatUrl(ch.chat_id))}
                                />
                              ) : (
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  sem conversa
                                </Typography>
                              )}
                            </TableCell>
                          ) : null}
                          <TableCell sx={{ maxWidth: 260 }}>
                            {c.products.length ? (
                              <Stack direction="row" spacing={0.5} sx={{ overflow: 'hidden' }}>
                                {c.products.slice(0, 2).map((p, i) => (
                                  <Chip
                                    key={i}
                                    size="small"
                                    label={p}
                                    sx={{
                                      height: 22,
                                      fontWeight: 600,
                                      borderRadius: 1.5,
                                      bgcolor: (t) => tint(t, 'success', 0.12),
                                      color: WA_DARK
                                    }}
                                  />
                                ))}
                                {c.products.length > 2 ? (
                                  <Chip size="small" label={`+${c.products.length - 2}`} sx={{ height: 22, borderRadius: 1.5 }} />
                                ) : null}
                              </Stack>
                            ) : (
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                —
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <StatusChip map={BILLING_STATUS} status={c.billing_status} size="md" />
                          </TableCell>
                          <TableCell>
                            {c.next_due_label ? (
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {c.next_due_label}
                                </Typography>
                                <Typography variant="caption" sx={{ color: c.days_to_due < 0 ? 'warning.main' : 'text.secondary' }}>
                                  {dueText(c.days_to_due)}
                                </Typography>
                              </Box>
                            ) : (
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                —
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                            {c.monthly_cents ? c.monthly_label : '—'}
                          </TableCell>
                          <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                            <Tooltip title={c.chats?.length > 1 ? 'Abrir conversa (escolher o número)' : 'Abrir conversa'}>
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={(e) => openConversation(c, e.currentTarget)}
                                  disabled={rowBusy[c.id]}
                                  aria-label="Abrir conversa"
                                >
                                  {rowBusy[c.id] ? <CircularProgress size={14} /> : <IconMessage size={17} />}
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Editar">
                              <IconButton size="small" onClick={() => setDlg({ customer: c })} aria-label="Editar cliente">
                                <IconPencil size={17} />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ xs: 'center', sm: 'center' }}
                justifyContent="space-between"
                sx={{ px: 2, py: 1.25, borderTop: { sm: '1px solid' }, borderColor: 'divider' }}
              >
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Mostrando {from}–{to} de {total.toLocaleString('pt-BR')}
                </Typography>
                <Pagination
                  size={xs ? 'medium' : 'small'}
                  count={data.pages}
                  page={data.page}
                  onChange={(_, p) => setPage(p)}
                  siblingCount={xs ? 0 : 1}
                />
              </Stack>
            </TgCard>
          )}
        </>
      )}

      {/* escolha do número: conversas existentes do cliente ou números conectados para iniciar */}
      <Menu
        open={Boolean(openMenu)}
        anchorEl={openMenu?.anchor}
        onClose={() => setOpenMenu(null)}
        slotProps={{ paper: { sx: { borderRadius: 2.5, minWidth: 240 } } }}
      >
        <Typography variant="caption" sx={{ px: 2, py: 0.5, display: 'block', color: 'text.secondary', fontWeight: 700 }}>
          {openMenu?.mode === 'chats' ? 'Abrir a conversa pelo número' : 'Iniciar conversa pelo número'}
        </Typography>
        {openMenu?.mode === 'chats'
          ? (openMenu.customer.chats || []).map((ch) => {
              const sess = ch.session || sessionsById.get(ch.session_id) || { id: ch.session_id, label: 'Número' };
              return (
                <MenuItem
                  key={ch.chat_id}
                  onClick={() => {
                    setOpenMenu(null);
                    navigate(chatUrl(ch.chat_id));
                  }}
                >
                  <ListItemIcon>
                    <WaNumberDot session={sess} />
                  </ListItemIcon>
                  <ListItemText primary={sessionLabel(sess)} secondary={sess.phone ? fmtPhone(sess.phone) : null} />
                </MenuItem>
              );
            })
          : connectedSessions.map((sess) => (
              <MenuItem
                key={sess.id}
                onClick={() => {
                  const c = openMenu.customer;
                  setOpenMenu(null);
                  startConversation(c, sess.id);
                }}
              >
                <ListItemIcon>
                  <WaNumberDot session={sess} />
                </ListItemIcon>
                <ListItemText primary={sessionLabel(sess)} secondary={sess.phone ? fmtPhone(sess.phone) : null} />
              </MenuItem>
            ))}
      </Menu>

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onImported={() => load({ silent: true })} />
      <CustomerDialog
        open={Boolean(dlg)}
        onClose={() => setDlg(null)}
        customer={dlg?.customer || null}
        products={products}
        identity={identity}
        canDelete={canEdit}
        onSaved={(c) => {
          patchRow(c);
          load({ silent: true });
        }}
        onDeleted={() => load({ silent: true })}
      />
      <CustomFieldsEditor open={fieldsDlg} onClose={() => setFieldsDlg(false)} initialEntity="customer" />
    </Box>
  );
}
