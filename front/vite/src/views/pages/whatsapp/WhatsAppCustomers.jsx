import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Pagination from '@mui/material/Pagination';
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
  IconCheck,
  IconListDetails,
  IconMessage,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconUserDollar,
  IconUsers,
  IconX,
  IconDownload,
  IconUpload
} from '@tabler/icons-react';

import { api, get, post, put } from 'api/api';
import { useAuth } from 'contexts/AuthContext';
import { TgAvatar, TgCard, TgEmptyState, TgFilterBar, TgListSkeleton, TgModal } from 'views/pages/telegram/ui';
import { WaPageHeader } from './waKit';
import { WA_DARK, errMsg, fmtPhone, tint, useWaSession } from './waShared';
import CustomerDialog from './crm/CustomerDialog';
import { BILLING_STATUS, CrmKpi, StatusChip, dueText, waPrimaryBtn } from './crm/crmKit';

// ============================================================================
// WhatsApp → Clientes: contatos que são clientes de verdade — o que usam/pagam,
// situação (em dia / em atraso), próximo vencimento. Abre a conversa com 1 clique.
// ============================================================================

const PAGE_SIZES = [25, 50, 100];
const MODEL_CSV =
  'phone,name,doc,email,zip,street,number,district,city,state,notes,product,price,due_day\n5511999990000,Maria Silva,529.982.247-25,maria@exemplo.com,01001-000,Praça da Sé,1,Centro,São Paulo,SP,Cliente desde 2024,Plano Premium,129.90,10\n';
const FIELD_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Data' },
  { value: 'select', label: 'Lista de opções' }
];

// ----------------------------------------------------------------------------
// Campos personalizados (dono/admin)
// ----------------------------------------------------------------------------
function FieldsDialog({ open, onClose, fields, onSaved }) {
  const [list, setList] = useState(fields);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setList(fields.map((f) => ({ ...f, options: (f.options || []).join(', ') })));
  }, [open, fields]);
  const patch = (i, p) => setList((xs) => xs.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const save = async () => {
    setBusy(true);
    try {
      const r = await put('/whatsapp/crm-settings', {
        custom_fields: list
          .filter((f) => f.label.trim())
          .map((f) => ({
            key: f.key || f.label,
            label: f.label.trim(),
            type: f.type || 'text',
            options:
              f.type === 'select'
                ? String(f.options || '')
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                : undefined
          }))
      });
      onSaved(r.custom_fields || []);
      toast.success('Campos salvos.');
      onClose();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível salvar.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <TgModal
      open={open}
      onClose={() => !busy && onClose()}
      title="Campos personalizados"
      subtitle="Informações próprias do seu negócio no cadastro de cada cliente (número do contrato, placa, matrícula…). Viram variáveis {{cliente.<campo>}} nas mensagens."
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
            onClick={save}
            disabled={busy}
            startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <IconCheck size={16} />}
            sx={waPrimaryBtn}
          >
            Salvar
          </Button>
        </>
      }
    >
      <Stack spacing={1.25}>
        {list.map((f, i) => (
          <Stack key={f.key || i} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
            <TextField
              size="small"
              label="Nome do campo"
              value={f.label}
              onChange={(e) => patch(i, { label: e.target.value.slice(0, 60) })}
              sx={{ flex: 1 }}
            />
            <TextField
              select
              size="small"
              label="Tipo"
              value={f.type || 'text'}
              onChange={(e) => patch(i, { type: e.target.value })}
              sx={{ width: { sm: 160 } }}
            >
              {FIELD_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>
                  {t.label}
                </MenuItem>
              ))}
            </TextField>
            {f.type === 'select' ? (
              <TextField
                size="small"
                label="Opções (vírgula)"
                value={f.options || ''}
                onChange={(e) => patch(i, { options: e.target.value })}
                sx={{ flex: 1 }}
              />
            ) : null}
            <IconButton size="small" onClick={() => setList((xs) => xs.filter((_, j) => j !== i))}>
              <IconTrash size={16} />
            </IconButton>
          </Stack>
        ))}
        {list.length < 20 ? (
          <Button
            startIcon={<IconPlus size={16} />}
            onClick={() => setList((xs) => [...xs, { key: '', label: '', type: 'text', options: '' }])}
            sx={{ alignSelf: 'flex-start', fontWeight: 700, textTransform: 'none' }}
          >
            Adicionar campo
          </Button>
        ) : null}
        {!list.length ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Nenhum campo ainda. Exemplos: "Número do contrato", "Plano de internet", "Data da última visita".
          </Typography>
        ) : null}
      </Stack>
    </TgModal>
  );
}

// ============================================================================
export default function WhatsAppCustomers() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = ['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(user?.user?.role);
  const { connected } = useWaSession(30000);

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
  const [fields, setFields] = useState([]);
  const [dlg, setDlg] = useState(null); // {customer?}
  const [fieldsDlg, setFieldsDlg] = useState(false);
  const [rowBusy, setRowBusy] = useState({});
  const seqRef = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);
  useEffect(() => {
    setPage(1);
  }, [debouncedQ, status, billing, productId, pageSize]);

  useEffect(() => {
    get('/whatsapp/products')
      .then((r) => setProducts(Array.isArray(r) ? r : []))
      .catch(() => setProducts([]));
    get('/whatsapp/crm-settings')
      .then((r) => setFields(r?.custom_fields || []))
      .catch(() => setFields([]));
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
    [debouncedQ, status, billing, productId, page, pageSize]
  );
  useEffect(() => {
    load();
  }, [load]);

  const patchRow = (c) => setData((d) => ({ ...d, items: d.items.map((x) => (x.id === c.id ? c : x)) }));

  const openConversation = async (c) => {
    if (!connected) return toast.error('Conecte o WhatsApp para abrir conversas.');
    setRowBusy((m) => ({ ...m, [c.id]: true }));
    try {
      let chatId = c.chat_id;
      if (!chatId) {
        const chat = await post('/whatsapp/chats/open', { phone: c.phone });
        chatId = chat?.chat_id;
      }
      if (!chatId) throw new Error('Não foi possível abrir a conversa.');
      navigate(`/whatsapp/chat?chat=${encodeURIComponent(chatId)}`);
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível abrir a conversa.'));
    } finally {
      setRowBusy((m) => ({ ...m, [c.id]: false }));
    }
    return undefined;
  };

  const counts = data.counts;
  const items = data.items;
  const total = data.total;
  const from = total ? (data.page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, data.page * pageSize);
  const filtered = Boolean(debouncedQ || status !== 'all' || billing !== 'all' || productId);

  const [importDlg, setImportDlg] = useState(null);
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
  const importCsv = async () => {
    if (!importDlg?.file) return toast.error('Escolha um arquivo CSV.');
    setImportDlg((d) => ({ ...d, loading: true }));
    try {
      const fd = new FormData();
      fd.append('file', importDlg.file, importDlg.file.name);
      const r = await post('/whatsapp/customers/import', fd, { headers: { 'Content-Type': undefined }, timeout: 180000 });
      setImportDlg((d) => ({ ...d, loading: false, result: r, file: null }));
      toast.success(
        `${r?.imported ?? 0} novos · ${r?.updated ?? 0} atualizados · ${r?.subscriptions ?? 0} assinaturas · ${r?.skipped ?? 0} ignorados.`
      );
      load({ silent: true });
    } catch (e) {
      setImportDlg((d) => (d ? { ...d, loading: false } : d));
      toast.error(errMsg(e, 'Não foi possível importar.'));
    }
    return undefined;
  };
  const headerAction = useMemo(
    () => (
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="flex-end">
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
            onClick={() => setImportDlg({ file: null, result: null, loading: false })}
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
            sx={{ fontWeight: 700, borderRadius: 2 }}
          >
            Campos personalizados
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

      <TgFilterBar>
        <TextField
          size="small"
          placeholder="Buscar por nome, telefone, e-mail ou CPF/CNPJ"
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
        <TextField select size="small" label="Situação" value={billing} onChange={(e) => setBilling(e.target.value)} sx={{ minWidth: 150 }}>
          <MenuItem value="all">Todas</MenuItem>
          <MenuItem value="overdue">Em atraso</MenuItem>
        </TextField>
        <TextField select size="small" label="Cliente" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 140 }}>
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
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Atualizar">
          <span>
            <IconButton onClick={() => load()} disabled={loading}>
              <IconRefresh size={18} />
            </IconButton>
          </span>
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
              ? 'Tente outra busca ou limpe os filtros.'
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
          <TableContainer>
            <Table size="small" sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}>
              <TableHead>
                <TableRow>
                  <TableCell>Cliente</TableCell>
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
                            {c.email ? ` · ${c.email}` : ''}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
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
                      <Tooltip title="Abrir conversa">
                        <span>
                          <IconButton size="small" onClick={() => openConversation(c)} disabled={rowBusy[c.id]}>
                            {rowBusy[c.id] ? <CircularProgress size={14} /> : <IconMessage size={17} />}
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => setDlg({ customer: c })}>
                          <IconPencil size={17} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ sm: 'center' }}
            justifyContent="space-between"
            sx={{ px: 2, py: 1.25, borderTop: '1px solid', borderColor: 'divider' }}
          >
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Mostrando {from}–{to} de {total.toLocaleString('pt-BR')}
            </Typography>
            <Pagination size="small" count={data.pages} page={data.page} onChange={(_, p) => setPage(p)} />
          </Stack>
        </TgCard>
      )}

      <TgModal
        open={Boolean(importDlg)}
        onClose={() => !importDlg?.loading && setImportDlg(null)}
        title="Importar clientes (CSV)"
        subtitle="Colunas: phone,name,doc,email,zip,street,number,district,city,state,notes,product,price,due_day — só phone e name são obrigatórias."
        maxWidth="sm"
        footer={
          <>
            <Button color="inherit" onClick={() => setImportDlg(null)} disabled={importDlg?.loading} sx={{ textTransform: 'none' }}>
              Fechar
            </Button>
            <Button
              variant="contained"
              disableElevation
              onClick={importCsv}
              disabled={!importDlg?.file || importDlg?.loading}
              startIcon={importDlg?.loading ? <CircularProgress size={15} color="inherit" /> : <IconUpload size={16} />}
              sx={waPrimaryBtn}
            >
              Importar
            </Button>
          </>
        }
      >
        <Stack spacing={1.5}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Telefone com DDI e DDD (ex.: 5511999999999). Cliente que já existe é atualizado. <code>product</code> vincula uma assinatura
            pelo nome do produto (cria o produto se não existir e <code>price</code> vier preenchido); <code>due_day</code> = dia do
            vencimento (1–28).
          </Typography>
          <Button component="label" variant="outlined" sx={{ textTransform: 'none', fontWeight: 700, alignSelf: 'flex-start' }}>
            {importDlg?.file ? importDlg.file.name : 'Escolher arquivo .csv'}
            <input
              hidden
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setImportDlg((d) => ({ ...d, file: e.target.files?.[0] || null, result: null }))}
            />
          </Button>
          <Button
            size="small"
            onClick={() => {
              const a = document.createElement('a');
              a.href = URL.createObjectURL(new Blob([MODEL_CSV], { type: 'text/csv;charset=utf-8' }));
              a.download = 'modelo-clientes.csv';
              a.click();
            }}
            sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
          >
            Baixar modelo
          </Button>
          {importDlg?.result ? (
            <Alert severity={importDlg.result.errors?.length ? 'warning' : 'success'} sx={{ borderRadius: 2 }}>
              {importDlg.result.imported} novos · {importDlg.result.updated} atualizados · {importDlg.result.subscriptions} assinaturas ·{' '}
              {importDlg.result.skipped} ignorados
              {importDlg.result.errors?.length ? (
                <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2 }}>
                  {importDlg.result.errors.map((er) => (
                    <li key={er}>
                      <Typography variant="caption">{er}</Typography>
                    </li>
                  ))}
                </Box>
              ) : null}
            </Alert>
          ) : null}
        </Stack>
      </TgModal>
      <CustomerDialog
        open={Boolean(dlg)}
        onClose={() => setDlg(null)}
        customer={dlg?.customer || null}
        products={products}
        fields={fields}
        canDelete={canEdit}
        onSaved={(c) => {
          patchRow(c);
          load({ silent: true });
        }}
        onDeleted={() => load({ silent: true })}
      />
      <FieldsDialog open={fieldsDlg} onClose={() => setFieldsDlg(false)} fields={fields} onSaved={setFields} />
    </Box>
  );
}
