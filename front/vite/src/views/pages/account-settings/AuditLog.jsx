import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Pagination from '@mui/material/Pagination';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import {
  IconApi,
  IconArrowRight,
  IconChevronDown,
  IconFilterOff,
  IconHistory,
  IconLock,
  IconRefresh,
  IconSearch,
  IconShieldCheck,
  IconUser
} from '@tabler/icons-react';

import { get } from 'api/api';
import { useAuth } from 'contexts/AuthContext';
import useAccess from 'hooks/useAccess';
import { TgEmptyState, TgPageHeader } from '../telegram/ui';

// ============================================================================
// Configurações → Auditoria (Fase 8, contrato §12.4): quem mudou o quê e quando (clientes, produtos,
// assinaturas, cobranças, gateway, números, fluxos do bot, usuários…). Só dono/admin/superadmin.
// `AuditList` é reaproveitado na aba "Histórico" do diálogo do cliente (entity=customers&entity_id=).
// ============================================================================

const BRT = 'America/Sao_Paulo';
const brtDay = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: BRT }).format(d); // YYYY-MM-DD
const daysAgo = (n) => brtDay(new Date(Date.now() - n * 86_400_000));
const fmtWhen = (v) => {
  try {
    return new Intl.DateTimeFormat('pt-BR', { timeZone: BRT, dateStyle: 'short', timeStyle: 'medium' }).format(new Date(v));
  } catch {
    return '—';
  }
};

// ---------------------------------------------------------------- rótulos e formatação dos campos
const FIELD_LABELS = {
  name: 'Nome',
  title: 'Título',
  description: 'Descrição',
  doc: 'CPF/CNPJ',
  email: 'E-mail',
  phone: 'Telefone',
  code: 'Código',
  kind: 'Tipo',
  status: 'Situação',
  notes: 'Observações',
  custom: 'Campos personalizados',
  address: 'Endereço',
  addresses: 'Endereços',
  unit_id: 'Unidade',
  external_id: 'ID externo',
  since: 'Cliente desde',
  price_cents: 'Preço',
  amount_cents: 'Valor',
  base_amount_cents: 'Valor base',
  discount_cents: 'Desconto',
  billing: 'Cobrança',
  due_day: 'Dia de vencimento',
  due_at: 'Vencimento',
  next_due_at: 'Próximo vencimento',
  started_at: 'Início',
  trial_ends_at: 'Fim do teste',
  paused_until: 'Pausada até',
  cancel_at: 'Cancela em',
  canceled_at: 'Cancelada em',
  cancel_reason: 'Motivo do cancelamento',
  product_id: 'Produto',
  product_name: 'Produto',
  payment_method: 'Meio de pagamento',
  payment_method_id: 'Cartão salvo',
  paid_at: 'Pago em',
  paid_via: 'Pago via',
  active: 'Ativo',
  max_uses: 'Usos máximos',
  used: 'Usos',
  expires_at: 'Expira em',
  trial_days: 'Dias de teste',
  grace_days: 'Dias de carência',
  cancel_policy: 'Política de cancelamento',
  entitlement: 'Liberar ao pagar',
  installments_max: 'Parcelas',
  role: 'Papel',
  phone_label: 'Telefone'
};
const fieldLabel = (k) => FIELD_LABELS[k] || String(k).replace(/_/g, ' ');
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T|$)/;

function fmtValue(key, v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (typeof v === 'number' && /_cents$/.test(key)) return BRL.format(v / 100);
  if (typeof v === 'string' && ISO_DATE.test(v)) {
    const d = new Date(v);
    if (!Number.isNaN(+d)) return /T00:00:00(\.000)?Z$/.test(v) || v.length === 10 ? d.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : fmtWhen(v);
  }
  if (typeof v === 'object') {
    try {
      const s = JSON.stringify(v);
      return s.length > 400 ? `${s.slice(0, 399)}…` : s;
    } catch {
      return String(v);
    }
  }
  return String(v);
}

// ---------------------------------------------------------------- antes → depois
function KV({ obj }) {
  return (
    <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(120px, 200px) minmax(0, 1fr)' }, columnGap: 2, rowGap: 0.5 }}>
      {Object.entries(obj).map(([k, v]) => (
        <Box key={k} sx={{ display: 'contents' }}>
          <Typography component="dt" variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, pt: { xs: 0.75, sm: 0 } }}>
            {fieldLabel(k)}
          </Typography>
          <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere', fontFamily: typeof v === 'object' && v ? 'monospace' : undefined, fontSize: typeof v === 'object' && v ? 12 : undefined }}>
            {fmtValue(k, v)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export function AuditChanges({ changes }) {
  const c = changes && typeof changes === 'object' ? changes : {};
  const fields = Array.isArray(c.fields) ? c.fields : [];
  const before = c.before && typeof c.before === 'object' ? c.before : null;
  const body = c.body && typeof c.body === 'object' && !Array.isArray(c.body) ? c.body : c.body != null ? { valor: c.body } : null;


  return (
    <Stack spacing={1.5}>
      {fields.length ? (
        <Stack spacing={0.75}>
          {fields.map((f) => (
            <Box
              key={f.field}
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'minmax(120px, 190px) minmax(0, 1fr) auto minmax(0, 1fr)' },
                alignItems: 'center',
                gap: { xs: 0.25, sm: 1.25 },
                p: 1,
                borderRadius: 1.5,
                bgcolor: 'action.hover'
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary' }}>
                {fieldLabel(f.field)}
              </Typography>
              <Typography
                variant="body2"
                sx={(t) => ({
                  overflowWrap: 'anywhere',
                  color: t.vars.palette.error.main,
                  textDecoration: f.before == null ? 'none' : 'line-through',
                  textDecorationColor: `rgba(${t.vars.palette.error.mainChannel} / 0.5)`
                })}
              >
                {fmtValue(f.field, f.before)}
              </Typography>
              <Box sx={{ display: { xs: 'none', sm: 'flex' }, color: 'text.disabled' }}>
                <IconArrowRight size={15} />
              </Box>
              <Typography variant="body2" sx={(t) => ({ overflowWrap: 'anywhere', color: t.vars.palette.success.dark, fontWeight: 600 })}>
                {fmtValue(f.field, f.after)}
              </Typography>
            </Box>
          ))}
        </Stack>
      ) : null}
      {before ? (
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mb: 0.5 }}>
            Como estava antes de apagar
          </Typography>
          <KV obj={before} />
        </Box>
      ) : null}
      {body && Object.keys(body).length ? (
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mb: 0.5 }}>
            {fields.length ? 'Dados enviados' : 'O que foi enviado'}
          </Typography>
          <KV obj={body} />
        </Box>
      ) : null}
      {c.redacted && !(body && Object.keys(body).length) ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Os detalhes deste registro foram apagados a pedido do titular dos dados (LGPD).
        </Typography>
      ) : null}
      {!c.redacted && !fields.length && !before && !(body && Object.keys(body).length) ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Nenhum campo do cadastro mudou nesta ação.
        </Typography>
      ) : null}
      {c.truncated ? (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Registro resumido (passava de 8 KB).
        </Typography>
      ) : null}
    </Stack>
  );
}

// ---------------------------------------------------------------- uma linha
const ACTION_TONE = (action = '') => {
  if (/\.(delete|erase|cancel|purge|remove|logout)/.test(action) || /erase/.test(action)) return 'error';
  if (/\.create$|\.import$|\.apply$/.test(action)) return 'success';
  if (/\.(mark-paid|reactivate|resume|start)/.test(action)) return 'success';
  if (/\.(pause|stop)/.test(action)) return 'warning';
  return 'primary';
};

function AuditRow({ item, dense, showEntity = true }) {
  const [open, setOpen] = useState(false);
  const tone = ACTION_TONE(item.action);
  const api = item.actor === 'api';
  return (
    <Box
      sx={(t) => ({
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
        overflow: 'hidden',
        borderLeft: `3px solid ${t.vars.palette[tone].main}`
      })}
    >
      <Box
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, p: dense ? 1.25 : 1.5, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
      >
        <Box
          sx={(t) => ({
            width: 34,
            height: 34,
            flexShrink: 0,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            bgcolor: `rgba(${t.vars.palette[tone].mainChannel} / 0.12)`,
            color: t.vars.palette[tone].main
          })}
        >
          {api ? <IconApi size={17} /> : <IconUser size={17} />}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
            {item.summary || item.action}
          </Typography>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center" sx={{ mt: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {fmtWhen(item.created_at)}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              ·
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              {item.user_name || (api ? 'API' : 'Usuário removido')}
            </Typography>
            {showEntity && item.entity ? <Chip size="small" label={item.entity_label || item.entity} sx={{ height: 20, fontSize: 11, fontWeight: 700 }} /> : null}
            {api ? <Chip size="small" color="info" variant="outlined" label="API" sx={{ height: 20, fontSize: 11, fontWeight: 700 }} /> : null}
          </Stack>
        </Box>
        <IconButton size="small" aria-label={open ? 'Recolher detalhes' : 'Ver detalhes'} sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
          <IconChevronDown size={18} />
        </IconButton>
      </Box>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ px: dense ? 1.25 : 1.5, pb: 1.5, pt: 0.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ pt: 1 }}>
            <AuditChanges changes={item.changes} />
          </Box>
          <Typography variant="caption" component="div" sx={{ mt: 1.25, color: 'text.disabled', fontFamily: 'monospace', overflowWrap: 'anywhere' }}>
            {[item.action, item.method && item.path ? `${item.method} ${item.path}` : null, item.ip ? `IP ${item.ip}` : null, item.user_email]
              .filter(Boolean)
              .join(' · ')}
          </Typography>
        </Box>
      </Collapse>
    </Box>
  );
}

// ---------------------------------------------------------------- lista paginada (reaproveitada no cliente)
// `endpoint`: a página da conta usa `/org/audit` (módulo Configurações); o histórico do cliente usa `/whatsapp/audit`.
export function AuditList({ query, pageSize = 25, dense = false, showEntity = true, reloadKey = 0, emptyTitle, emptyText, endpoint = '/whatsapp/audit' }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const seq = useRef(0);
  const qKey = JSON.stringify(query || {});

  useEffect(() => {
    setPage(1);
  }, [qKey]);

  const load = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    setError('');
    try {
      const params = { ...(query || {}), page, page_size: pageSize };
      Object.keys(params).forEach((k) => (params[k] === '' || params[k] == null) && delete params[k]);
      const r = await get(endpoint, { params });
      if (my === seq.current) setData(r);
    } catch (e) {
      if (my !== seq.current) return;
      const st = e?.response?.status;
      const code = e?.response?.data?.code;
      setError(
        code === 'MODULE_DISABLED'
          ? 'Seu usuário não tem o módulo necessário para ver a auditoria. Peça ao dono da conta para liberar.'
          : st === 403
            ? 'Só o dono ou administradores da conta veem a auditoria.'
            : e?.response?.data?.message || 'Não foi possível carregar o histórico.'
      );
    } finally {
      if (my === seq.current) setLoading(false);
    }
    // qKey representa `query`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qKey, page, pageSize, endpoint]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const items = data?.items || [];
  if (error) {
    return <TgEmptyState icon={IconLock} title="Histórico indisponível" description={error} dense />;
  }
  if (loading && !data) {
    return (
      <Stack spacing={1}>
        {Array.from({ length: dense ? 3 : 6 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={dense ? 58 : 66} />
        ))}
      </Stack>
    );
  }
  if (!items.length) {
    return (
      <TgEmptyState
        icon={IconHistory}
        title={emptyTitle || 'Nada registrado'}
        description={emptyText || 'Quando alguém da equipe (ou a API) mudar algo, aparece aqui.'}
        dense
      />
    );
  }
  return (
    <Stack spacing={1} sx={{ opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
      {items.map((it) => (
        <AuditRow key={it.id} item={it} dense={dense} showEntity={showEntity} />
      ))}
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems="center" justifyContent="space-between" spacing={1} sx={{ pt: 1 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Mostrando {(data.page - 1) * data.page_size + 1}–{Math.min(data.total, data.page * data.page_size)} de {data.total}
        </Typography>
        {data.pages > 1 ? <Pagination size="small" count={data.pages} page={data.page} onChange={(_e, p) => setPage(p)} siblingCount={dense ? 0 : 1} /> : null}
      </Stack>
    </Stack>
  );
}

// ---------------------------------------------------------------- página
const PERIODS = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 90 dias' },
  { value: 'all', label: 'Tudo (até 400 dias)' },
  { value: 'custom', label: 'Personalizado' }
];

export default function AuditLog() {
  const { user } = useAuth();
  const role = user?.user?.role;
  const canSee = ['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(role);
  const { has } = useAccess();
  // a auditoria da conta fica em Configurações (`/org/audit`); quem só tem o WhatsApp usa a rota antiga
  const auditBase = has('settings') ? '/org/audit' : has('whatsapp') ? '/whatsapp/audit' : null;
  const theme = useTheme();
  const xs = useMediaQuery(theme.breakpoints.down('sm'));

  const [meta, setMeta] = useState(null);
  const [entity, setEntity] = useState('');
  const [userId, setUserId] = useState('');
  const [period, setPeriod] = useState('30');
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(brtDay());
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!canSee || !auditBase) return;
    get(`${auditBase}/meta`)
      .then(setMeta)
      .catch(() => setMeta({ users: [], entities: [] }));
  }, [canSee, auditBase]);

  const query = useMemo(() => {
    const out = { entity, q };
    if (userId === '__api') out.actor = 'api';
    else if (userId) out.user_id = userId;
    if (period === 'custom') {
      out.from = from;
      out.to = to;
    } else if (period !== 'all') out.from = daysAgo(Number(period) - 1);
    return out;
  }, [entity, userId, period, from, to, q]);

  const filtered = entity || userId || q || period !== '30';
  const clear = () => {
    setEntity('');
    setUserId('');
    setPeriod('30');
    setSearch('');
    setQ('');
  };

  if (!canSee) {
    return (
      <Box>
        <TgPageHeader icon={IconShieldCheck} title="Auditoria" subtitle="Quem mudou o quê e quando na sua conta." />
        <TgEmptyState icon={IconLock} title="Só para o dono e administradores" description="A auditoria da conta é visível para o dono ou um administrador. Peça acesso a eles se precisar." />
      </Box>
    );
  }
  if (!auditBase) {
    return (
      <Box>
        <TgPageHeader icon={IconShieldCheck} title="Auditoria" subtitle="Quem mudou o quê e quando na sua conta." />
        <TgEmptyState icon={IconLock} title="Seu usuário não tem acesso a Configurações" description="A auditoria da conta fica em Configurações. Peça ao dono da conta para liberar o módulo Configurações no seu usuário." />
      </Box>
    );
  }

  return (
    <Box>
      <TgPageHeader
        icon={IconShieldCheck}
        title="Auditoria"
        subtitle="Quem mudou o quê e quando: clientes, produtos, assinaturas, cobranças, gateway, números, fluxos do bot e usuários. Guardado por 400 dias."
        action={
          <Tooltip title="Atualizar">
            <IconButton onClick={() => setReloadKey((k) => k + 1)} aria-label="Atualizar">
              <IconRefresh size={19} />
            </IconButton>
          </Tooltip>
        }
      />

      <Box
        sx={{
          mb: 2,
          p: 1.25,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2.5,
          bgcolor: 'background.paper',
          display: 'grid',
          gap: 1.25,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'minmax(0, 1.6fr) repeat(3, minmax(0, 1fr)) auto' },
          alignItems: 'center'
        }}
      >
        <TextField
          size="small"
          placeholder="Buscar (resumo, ação, usuário, id)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <IconSearch size={16} />
              </InputAdornment>
            )
          }}
        />
        <TextField select size="small" label="O que" value={entity} onChange={(e) => setEntity(e.target.value)} fullWidth>
          <MenuItem value="">Tudo</MenuItem>
          {(meta?.entities || []).map((e) => (
            <MenuItem key={e.value} value={e.value}>
              {e.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="Quem" value={userId} onChange={(e) => setUserId(e.target.value)} fullWidth>
          <MenuItem value="">Todos</MenuItem>
          <MenuItem value="__api">API (chaves de integração)</MenuItem>
          {(meta?.users || []).map((u) => (
            <MenuItem key={u.id} value={u.id}>
              {u.name}
              {u.active === false ? ' (inativo)' : ''}
            </MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="Período" value={period} onChange={(e) => setPeriod(e.target.value)} fullWidth>
          {PERIODS.map((p) => (
            <MenuItem key={p.value} value={p.value}>
              {p.label}
            </MenuItem>
          ))}
        </TextField>
        <Button
          color="inherit"
          onClick={clear}
          disabled={!filtered}
          startIcon={<IconFilterOff size={16} />}
          sx={{ textTransform: 'none', fontWeight: 700, justifySelf: { xs: 'stretch', lg: 'end' } }}
        >
          Limpar
        </Button>
        {period === 'custom' ? (
          <Stack direction={xs ? 'column' : 'row'} spacing={1.25} sx={{ gridColumn: '1 / -1' }}>
            <TextField size="small" type="date" label="De" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
            <TextField size="small" type="date" label="Até" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
          </Stack>
        ) : null}
      </Box>

      <AuditList
        query={query}
        endpoint={auditBase}
        reloadKey={reloadKey}
        emptyTitle={filtered ? 'Nada com esses filtros' : 'Nada registrado ainda'}
        emptyText={filtered ? 'Mude o período ou limpe os filtros.' : 'Quando alguém da equipe (ou a API) criar, alterar ou apagar algo, aparece aqui.'}
      />
    </Box>
  );
}
