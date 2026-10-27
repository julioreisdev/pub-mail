import { useCallback, useEffect, useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import InputAdornment from '@mui/material/InputAdornment';
import Divider from '@mui/material/Divider';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';

import toast from 'react-hot-toast';
import {
  IconPlus,
  IconUserPlus,
  IconEdit,
  IconTrash,
  IconRefresh,
  IconKey,
  IconEye,
  IconEyeOff,
  IconShieldCheck,
  IconCalendarPlus,
  IconCash,
  IconLock,
  IconLockOpen,
  IconUser,
  IconReceipt2,
  IconBrandWhatsapp,
  IconClock
} from '@tabler/icons-react';

import MainCard from 'ui-component/cards/MainCard';
import { get, post, patch, remove } from 'api/api';

import ModulesPicker, { ModuleChips, ALL_MODULE_KEYS, normalizeModules } from './ModulesPicker';
import PlanFields, { planLabel, AccessPill, fmtBRL, fmtDate, fmtDateTime, ExtendDialog } from './PlanFields';
import WhatsAppNumbersPicker, {
  WhatsAppAccessChip,
  roleSeesAllNumbers,
  normalizeWaSessions,
  sameWaSessions
} from './WhatsAppNumbersPicker';

// Último login do usuário, em uma linha discreta sob o e-mail (a tabela já está cheia — sem coluna nova).
function LastLogin({ value }) {
  const never = !value;
  const when = never ? null : new Date(value);
  const diffH = when ? (Date.now() - when.getTime()) / 36e5 : null;
  const rel =
    diffH === null ? '' : diffH < 1 ? 'agora há pouco' : diffH < 24 ? `há ${Math.floor(diffH)} h` : diffH < 24 * 30 ? `há ${Math.floor(diffH / 24)} d` : '';
  return (
    <Tooltip title={never ? 'Este usuário nunca entrou no painel' : `Último acesso em ${fmtDateTime(value)}`} placement="top-start">
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          mt: 0.25,
          fontSize: 11,
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          color: never ? 'warning.main' : 'text.disabled'
        }}
      >
        <IconClock size={12} stroke={1.8} />
        {never ? 'Nunca acessou' : `Acesso ${fmtDateTime(value)}${rel ? ` · ${rel}` : ''}`}
      </Box>
    </Tooltip>
  );
}
import WaPermissionsPicker, { WaPermsChip, initialWaPerms, modulesWithWaPerms, sameWaPerms } from './WaPermissionsPicker';
import { WA_SUB_KEYS } from 'views/pages/access/modules';

const ROLE_OPTIONS = ['SUPER_ADMIN', 'OWNER', 'ADMIN', 'MEMBER'];

const ROLE_LABEL = {
  SUPER_ADMIN: 'Super Admin',
  OWNER: 'Dono',
  ADMIN: 'Admin',
  MEMBER: 'Membro'
};

const getErrorMessage = (err, fallback = 'Falha ao processar a ação') => {
  const m = err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;
  return Array.isArray(m) ? m.join(' | ') : String(m);
};

// ===== Cabeçalho de seção (dialogs) =====
function SectionHeader({ icon: Icon, title, hint }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ pt: 0.5 }}>
      <Box
        sx={(t) => ({
          width: 26,
          height: 26,
          borderRadius: 1.5,
          display: 'grid',
          placeItems: 'center',
          color: 'primary.main',
          bgcolor: `rgba(${t.vars.palette.primary.mainChannel} / 0.12)`
        })}
      >
        {Icon ? <Icon size={15} stroke={2} /> : null}
      </Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 11.5 }}>
        {title}
      </Typography>
      {hint ? (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {hint}
        </Typography>
      ) : null}
      <Divider sx={{ flex: 1, ml: 1 }} />
    </Stack>
  );
}

// ===== Senha com mostrar/ocultar =====
function PasswordField({ value, onChange, label = 'Senha', helperText = 'Mínimo 6 caracteres', autoFocus, required = true }) {
  const [show, setShow] = useState(false);
  return (
    <TextField
      label={label}
      type={show ? 'text' : 'password'}
      value={value}
      onChange={onChange}
      required={required}
      fullWidth
      autoFocus={autoFocus}
      helperText={helperText}
      autoComplete="new-password"
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <Tooltip title={show ? 'Ocultar' : 'Mostrar'}>
              <IconButton size="small" edge="end" onClick={() => setShow((s) => !s)} tabIndex={-1}>
                {show ? <IconEyeOff size={18} /> : <IconEye size={18} />}
              </IconButton>
            </Tooltip>
          </InputAdornment>
        )
      }}
    />
  );
}

const SETTINGS_WARNING = 'Sem Configurações o usuário não cadastra chaves de IA/Resend nem domínios — Webchat e E-mail ficam limitados.';

// ===== Números do WhatsApp liberados p/ o usuário =====
// Só aparece quando o módulo `whatsapp` está marcado. Para OWNER/ADMIN/SUPER_ADMIN o
// picker vira só a nota "donos e admins veem todos os números" (o back ignora o campo).
const hasWhatsApp = (modules) => Array.isArray(modules) && modules.includes('whatsapp');

/**
 * Valor de `whatsapp_sessions` p/ o payload:
 *  - módulo WhatsApp + MEMBER → `null` (todos) ou array de ids
 *  - demais casos → `undefined` (não envia; no PATCH = não mexe, no create = todos)
 */
const waSessionsForPayload = (modules, role, value) => {
  if (!hasWhatsApp(modules) || roleSeesAllNumbers(role)) return undefined;
  return normalizeWaSessions(value);
};

function WaNumbersSection({ orgId, role, value, onChange, disabled }) {
  return (
    <>
      <SectionHeader
        icon={IconBrandWhatsapp}
        title="Números do WhatsApp"
        hint={roleSeesAllNumbers(role) ? undefined : 'quais números este usuário pode usar'}
      />
      <WhatsAppNumbersPicker orgId={orgId} role={role} value={value} onChange={onChange} disabled={disabled} />
    </>
  );
}

// Fase 7: sub-permissões do WhatsApp (cobranças / clientes / configurações) — só pesa para MEMBER
function WaPermsSection({ role, value, onChange, disabled }) {
  return (
    <>
      <SectionHeader
        icon={IconBrandWhatsapp}
        title="Permissões no WhatsApp"
        hint={roleSeesAllNumbers(role) ? undefined : 'o que este usuário pode ver e mexer'}
      />
      <WaPermissionsPicker role={role} value={value} onChange={onChange} disabled={disabled} />
    </>
  );
}

// ===== Confirm dialog =====
function ConfirmDialog({ open, title, message, confirmLabel = 'Confirmar', color = 'error', loading, onClose, onConfirm }) {
  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2">{message}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button color={color} variant="contained" onClick={onConfirm} disabled={loading}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ===== Organização: criar/editar =====
function OrgFormDialog({ open, mode, initial, loading, error, onClose, onSubmit }) {
  const [form, setForm] = useState({});

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit') {
      setForm({ name: initial?.name || '', status: initial?.status !== false });
    } else {
      setForm({
        name: '',
        document_id: '',
        admin_name: '',
        admin_email: '',
        admin_password: '',
        admin_role: 'ADMIN'
      });
    }
  }, [open, mode, initial]);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(form);
        }}
      >
        <DialogTitle>{mode === 'edit' ? 'Editar organização' : 'Nova organização'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <TextField label="Nome da organização" value={form.name || ''} onChange={set('name')} required fullWidth />
            {mode === 'edit' ? (
              <TextField
                select
                label="Status"
                value={form.status ? 'true' : 'false'}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value === 'true' }))}
                fullWidth
              >
                <MenuItem value="true">Ativa</MenuItem>
                <MenuItem value="false">Desativada</MenuItem>
              </TextField>
            ) : (
              <>
                <TextField label="Documento (CNPJ/CPF) — opcional" value={form.document_id || ''} onChange={set('document_id')} fullWidth />
                <Typography variant="caption" color="text.secondary">
                  Usuário administrador da organização:
                </Typography>
                <TextField label="Nome do admin" value={form.admin_name || ''} onChange={set('admin_name')} required fullWidth />
                <TextField
                  label="E-mail do admin"
                  type="email"
                  value={form.admin_email || ''}
                  onChange={set('admin_email')}
                  required
                  fullWidth
                />
                <PasswordField label="Senha do admin" value={form.admin_password || ''} onChange={set('admin_password')} />
                <TextField select label="Permissão" value={form.admin_role || 'ADMIN'} onChange={set('admin_role')} fullWidth>
                  {['OWNER', 'ADMIN', 'MEMBER'].map((r) => (
                    <MenuItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </MenuItem>
                  ))}
                </TextField>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {mode === 'edit' ? 'Salvar' : 'Criar'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

// ===== Novo cliente (conta + usuário + plano) =====
function ClientFormDialog({ open, loading, error, onClose, onSubmit }) {
  const blank = {
    name: '',
    email: '',
    password: '',
    org_name: '',
    role: 'OWNER',
    modules: [...ALL_MODULE_KEYS],
    wa_perms: [...WA_SUB_KEYS],
    price_cents: 0,
    period_days: 30
  };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (open) setForm({ ...blank, modules: [...ALL_MODULE_KEYS], wa_perms: [...WA_SUB_KEYS] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const noSettings = !form.modules.includes('settings');

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(form);
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          Novo cliente
          <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 400, mt: 0.25 }}>
            Cria a conta, o usuário dono e o plano de acesso de uma vez.
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {error ? <Alert severity="error">{error}</Alert> : null}

            <SectionHeader icon={IconUser} title="Dados" />
            <TextField label="Nome" value={form.name} onChange={set('name')} required fullWidth autoFocus />
            <TextField label="E-mail" type="email" value={form.email} onChange={set('email')} required fullWidth autoComplete="off" />
            <PasswordField value={form.password} onChange={set('password')} />
            <TextField
              label="Nome da conta"
              value={form.org_name}
              onChange={set('org_name')}
              fullWidth
              placeholder={form.name || 'Ex.: Agência Silva'}
              helperText="Deixe vazio para usar o nome"
            />
            <TextField select label="Permissão do usuário" value={form.role} onChange={set('role')} fullWidth size="small">
              {['OWNER', 'ADMIN', 'MEMBER'].map((r) => (
                <MenuItem key={r} value={r}>
                  {ROLE_LABEL[r]}
                </MenuItem>
              ))}
            </TextField>

            <SectionHeader icon={IconShieldCheck} title="Acesso" hint="módulos liberados + plano da conta" />
            <ModulesPicker value={form.modules} onChange={(modules) => setForm((p) => ({ ...p, modules }))} />
            {noSettings ? (
              <Alert severity="warning" sx={{ py: 0.5 }}>
                {SETTINGS_WARNING}
              </Alert>
            ) : null}
            {hasWhatsApp(form.modules) ? (
              <WaPermsSection
                role={form.role}
                value={form.wa_perms}
                onChange={(wa_perms) => setForm((p) => ({ ...p, wa_perms }))}
                disabled={loading}
              />
            ) : null}
            {hasWhatsApp(form.modules) && !roleSeesAllNumbers(form.role) ? (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                A conta nova ainda não tem número do WhatsApp — o usuário terá acesso a todos os que forem conectados. Para restringir, use
                a ação <strong>Acesso</strong> depois.
              </Typography>
            ) : null}
            <PlanFields
              priceCents={form.price_cents}
              periodDays={form.period_days}
              onChange={({ price_cents, period_days, period_invalid }) =>
                setForm((p) => ({ ...p, price_cents, period_days, period_invalid: !!period_invalid }))
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || form.modules.length === 0 || form.period_invalid}
            startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <IconPlus size={16} />}
          >
            Criar cliente
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

// ===== Usuário: criar (em conta existente) / editar =====
function UserFormDialog({ open, mode, initial, orgs, loading, error, onClose, onSubmit }) {
  const [form, setForm] = useState({});

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit') {
      setForm({
        name: initial?.name || '',
        role: initial?.role || 'MEMBER',
        active: initial?.active !== false,
        modules: normalizeModules(initial?.modules || []),
        whatsapp_sessions: normalizeWaSessions(initial?.whatsapp_sessions),
        wa_perms: initialWaPerms(initial)
      });
    } else {
      setForm({
        organization_id: '',
        name: '',
        email: '',
        password: '',
        role: 'ADMIN',
        modules: [...ALL_MODULE_KEYS],
        whatsapp_sessions: null,
        wa_perms: [...WA_SUB_KEYS]
      });
    }
  }, [open, mode, initial]);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const selectedOrg = mode === 'create' ? orgs.find((o) => o.id === form.organization_id) : null;
  const noSettings = Array.isArray(form.modules) && !form.modules.includes('settings');
  const waOrgId = mode === 'edit' ? initial?.organization_id || initial?.organizations?.id : form.organization_id;
  const setWaSessions = (whatsapp_sessions) => setForm((p) => ({ ...p, whatsapp_sessions }));
  const setWaPerms = (wa_perms) => setForm((p) => ({ ...p, wa_perms }));

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(form);
        }}
      >
        <DialogTitle>{mode === 'edit' ? 'Editar usuário' : 'Adicionar usuário a uma conta'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            {mode === 'edit' ? (
              <>
                <TextField label="Nome" value={form.name || ''} onChange={set('name')} required fullWidth />
                <TextField select label="Permissão" value={form.role || 'MEMBER'} onChange={set('role')} fullWidth>
                  {ROLE_OPTIONS.map((r) => (
                    <MenuItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Status"
                  value={form.active ? 'true' : 'false'}
                  onChange={(e) => setForm((p) => ({ ...p, active: e.target.value === 'true' }))}
                  fullWidth
                >
                  <MenuItem value="true">Ativo</MenuItem>
                  <MenuItem value="false">Inativo</MenuItem>
                </TextField>
                <SectionHeader icon={IconShieldCheck} title="Módulos" />
                <ModulesPicker value={form.modules || []} onChange={(modules) => setForm((p) => ({ ...p, modules }))} />
                {noSettings ? (
                  <Alert severity="warning" sx={{ py: 0.5 }}>
                    {SETTINGS_WARNING}
                  </Alert>
                ) : null}
                {hasWhatsApp(form.modules) ? (
                  <WaNumbersSection
                    orgId={waOrgId}
                    role={form.role}
                    value={form.whatsapp_sessions}
                    onChange={setWaSessions}
                    disabled={loading}
                  />
                ) : null}
                {hasWhatsApp(form.modules) ? (
                  <WaPermsSection role={form.role} value={form.wa_perms} onChange={setWaPerms} disabled={loading} />
                ) : null}
              </>
            ) : (
              <>
                <TextField
                  select
                  label="Conta (organização)"
                  value={form.organization_id || ''}
                  onChange={set('organization_id')}
                  required
                  fullWidth
                >
                  <MenuItem value="">— selecione —</MenuItem>
                  {orgs.map((o) => (
                    <MenuItem key={o.id} value={o.id}>
                      {o.name}
                      {o.status === false ? ' (desativada)' : ''}
                    </MenuItem>
                  ))}
                </TextField>
                <Alert severity="info" sx={{ py: 0.5 }} icon={<IconReceipt2 size={18} />}>
                  Herda o plano da conta selecionada
                  {selectedOrg?.access ? (
                    <>
                      : <strong>{planLabel(selectedOrg.access.price_cents, selectedOrg.access.period_days)}</strong>
                    </>
                  ) : (
                    '.'
                  )}
                </Alert>
                <TextField label="Nome" value={form.name || ''} onChange={set('name')} required fullWidth />
                <TextField
                  label="E-mail"
                  type="email"
                  value={form.email || ''}
                  onChange={set('email')}
                  required
                  fullWidth
                  autoComplete="off"
                />
                <PasswordField value={form.password || ''} onChange={set('password')} />
                <TextField select label="Permissão" value={form.role || 'ADMIN'} onChange={set('role')} fullWidth>
                  {ROLE_OPTIONS.map((r) => (
                    <MenuItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </MenuItem>
                  ))}
                </TextField>
                <SectionHeader icon={IconShieldCheck} title="Módulos" />
                <ModulesPicker value={form.modules || []} onChange={(modules) => setForm((p) => ({ ...p, modules }))} />
                {noSettings ? (
                  <Alert severity="warning" sx={{ py: 0.5 }}>
                    {SETTINGS_WARNING}
                  </Alert>
                ) : null}
                {hasWhatsApp(form.modules) ? (
                  <WaNumbersSection
                    orgId={waOrgId}
                    role={form.role}
                    value={form.whatsapp_sessions}
                    onChange={setWaSessions}
                    disabled={loading}
                  />
                ) : null}
                {hasWhatsApp(form.modules) ? (
                  <WaPermsSection role={form.role} value={form.wa_perms} onChange={setWaPerms} disabled={loading} />
                ) : null}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {mode === 'edit' ? 'Salvar' : 'Criar'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

// ===== Trocar senha =====
function PasswordDialog({ open, target, loading, error, onClose, onSubmit }) {
  const [password, setPassword] = useState('');
  useEffect(() => {
    if (open) setPassword('');
  }, [open]);
  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(password);
        }}
      >
        <DialogTitle>Alterar senha</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <Typography variant="body2" color="text.secondary">
              {target?.email}
            </Typography>
            <PasswordField label="Nova senha" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={loading}>
            Salvar
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

// ===== Acesso da conta (módulos do usuário + plano + ações) =====
function AccessDialog({ open, user, loading, onClose, onReload }) {
  const [sub, setSub] = useState(null);
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState('');
  const [modules, setModules] = useState([]);
  // números do WhatsApp liberados (null = todos)
  const [waSessions, setWaSessions] = useState(null);
  // sub-permissões do WhatsApp (Fase 7)
  const [waPerms, setWaPerms] = useState([...WA_SUB_KEYS]);
  // null = ainda não carregado (o PlanFields só monta com o plano fresco da conta)
  const [plan, setPlan] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState('');
  const [extendOpen, setExtendOpen] = useState(false);
  const [confirm, setConfirm] = useState({ open: false });

  const orgId = user?.organization_id || user?.organizations?.id;
  const orgName = user?.organizations?.name || sub?.organization_name || '';

  const loadSub = useCallback(async () => {
    if (!orgId) return;
    setSubLoading(true);
    setSubError('');
    try {
      const s = await get(`/admin/billing/subscriptions/${orgId}`);
      setSub(s);
      setPlan({
        price_cents: s?.access?.price_cents || 0,
        period_days: s?.access?.lifetime ? null : (s?.access?.period_days ?? null),
        notes: s?.access?.notes || '',
        period_invalid: false
      });
    } catch (err) {
      setSubError(getErrorMessage(err, 'Falha ao carregar o plano da conta.'));
    } finally {
      setSubLoading(false);
    }
  }, [orgId]);

  // só reinicializa ao abrir / trocar de usuário (o reload em background não zera edições)
  useEffect(() => {
    if (!open) return;
    setModules(normalizeModules(user?.modules || []));
    setWaSessions(normalizeWaSessions(user?.whatsapp_sessions));
    setWaPerms(initialWaPerms(user));
    setSub(null);
    setSubError('');
    setPlan(null); // zera preço/período/observações do usuário anterior
    loadSub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id]);

  const modulesDirty = useMemo(() => {
    const a = normalizeModules(user?.modules || []).join(',');
    return a !== modules.join(',');
  }, [user, modules]);
  // só conta como mudança quando o campo vai no payload (módulo WhatsApp + MEMBER)
  const waPayload = waSessionsForPayload(modules, user?.role, waSessions);
  const waDirty = waPayload !== undefined && !sameWaSessions(user?.whatsapp_sessions, waPayload);
  const permsDirty = hasWhatsApp(modules) && !sameWaPerms(initialWaPerms(user), waPerms);
  const planDirty = useMemo(() => {
    if (!sub || !plan) return false;
    const a = sub.access || {};
    const curPeriod = a.lifetime ? null : (a.period_days ?? null);
    return (a.price_cents || 0) !== plan.price_cents || curPeriod !== plan.period_days || (a.notes || '') !== (plan.notes || '');
  }, [sub, plan]);

  const saveAll = async () => {
    setSaving(true);
    try {
      if (modulesDirty || waDirty || permsDirty) {
        await patch(`/admin/users/${user.id}`, {
          modules: modulesWithWaPerms(modules, waPerms),
          ...(waPayload !== undefined ? { whatsapp_sessions: waPayload } : {})
        });
      }
      if (planDirty) {
        const s = await patch(`/admin/billing/subscriptions/${orgId}`, {
          price_cents: plan.price_cents,
          period_days: plan.period_days,
          notes: plan.notes || ''
        });
        setSub(s);
      }
      toast.success('Acesso atualizado.');
      await onReload();
      if (!planDirty) await loadSub();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (key, fn, okMsg) => {
    setBusy(key);
    try {
      const s = await fn();
      if (s?.access) setSub(s);
      toast.success(okMsg);
      setConfirm({ open: false });
      setExtendOpen(false);
      await onReload();
      if (!s?.access) await loadSub();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const access = sub?.access || user?.access;
  const blocked = access?.status === 'BLOCKED';
  const noSettings = !modules.includes('settings');

  return (
    <>
      <Dialog open={open} onClose={saving || busy ? undefined : onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          Acesso de {user?.name || user?.email}
          <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 400, mt: 0.25 }}>
            Conta <strong>{orgName || '—'}</strong> · o plano vale para todos os usuários da conta; os módulos são deste usuário.
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
              sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.default' }}
            >
              <Box sx={{ flex: 1, minWidth: 160 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block' }}>
                  Situação atual
                </Typography>
                {subLoading && !sub ? <Skeleton width={140} /> : <AccessPill access={access} />}
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block' }}>
                  Último pagamento
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {fmtDate(access?.last_paid_at)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block' }}>
                  Total pago
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {sub ? fmtBRL(sub.total_paid_cents) : '—'}
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Button
                size="small"
                variant="outlined"
                startIcon={<IconCalendarPlus size={16} />}
                disabled={!!busy || !sub}
                onClick={() => setExtendOpen(true)}
              >
                Estender dias…
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="success"
                startIcon={<IconCash size={16} />}
                disabled={!!busy || !sub || (access?.price_cents || 0) <= 0}
                onClick={() =>
                  setConfirm({
                    open: true,
                    title: 'Marcar como pago',
                    color: 'success',
                    confirmLabel: 'Marcar como pago',
                    message: `Registrar um pagamento manual de ${fmtBRL(access?.price_cents)} para "${orgName}" e ativar o acesso pelo período do plano (${access?.lifetime || !access?.period_days ? 'vitalício' : `${access.period_days} dias`})?${blocked ? ' Isso também desbloqueia a conta.' : ''}`,
                    action: () =>
                      runAction(
                        'paid',
                        () => post(`/admin/billing/subscriptions/${orgId}/mark-paid`, {}),
                        'Pagamento registrado e acesso ativado.'
                      )
                  })
                }
              >
                Marcar como pago
              </Button>
              {blocked ? (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<IconLockOpen size={16} />}
                  disabled={!!busy || !sub}
                  onClick={() =>
                    setConfirm({
                      open: true,
                      title: 'Desbloquear conta',
                      color: 'primary',
                      confirmLabel: 'Desbloquear',
                      message: `Liberar o acesso de "${orgName}"? A conta volta ao status normal do plano.`,
                      action: () =>
                        runAction('unblock', () => post(`/admin/billing/subscriptions/${orgId}/unblock`, {}), 'Conta desbloqueada.')
                    })
                  }
                >
                  Desbloquear
                </Button>
              ) : (
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<IconLock size={16} />}
                  disabled={!!busy || !sub}
                  onClick={() =>
                    setConfirm({
                      open: true,
                      title: 'Bloquear conta',
                      confirmLabel: 'Bloquear',
                      message: `Bloquear "${orgName}"? Todos os usuários da conta perdem o acesso à plataforma até o desbloqueio.`,
                      action: () => runAction('block', () => post(`/admin/billing/subscriptions/${orgId}/block`, {}), 'Conta bloqueada.')
                    })
                  }
                >
                  Bloquear
                </Button>
              )}
              {busy ? <CircularProgress size={18} sx={{ alignSelf: 'center' }} /> : null}
            </Stack>

            <SectionHeader icon={IconShieldCheck} title="Módulos do usuário" />
            <ModulesPicker value={modules} onChange={setModules} />
            {noSettings ? (
              <Alert severity="warning" sx={{ py: 0.5 }}>
                {SETTINGS_WARNING}
              </Alert>
            ) : null}
            {hasWhatsApp(modules) ? (
              <WaNumbersSection orgId={orgId} role={user?.role} value={waSessions} onChange={setWaSessions} disabled={saving} />
            ) : null}
            {hasWhatsApp(modules) ? <WaPermsSection role={user?.role} value={waPerms} onChange={setWaPerms} disabled={saving} /> : null}

            <SectionHeader icon={IconReceipt2} title="Plano da conta" hint="mudanças valem na próxima cobrança" />
            {subError ? (
              <Alert
                severity="error"
                action={
                  <Button color="inherit" size="small" onClick={loadSub} disabled={subLoading}>
                    Tentar novamente
                  </Button>
                }
              >
                {subError}
              </Alert>
            ) : !sub || !plan ? (
              <Stack spacing={1}>
                <Skeleton variant="rounded" height={40} />
                <Skeleton variant="rounded" height={40} />
              </Stack>
            ) : (
              <>
                <PlanFields
                  priceCents={plan.price_cents}
                  periodDays={plan.period_days}
                  onChange={({ price_cents, period_days, period_invalid }) =>
                    setPlan((p) => ({ ...p, price_cents, period_days, period_invalid: !!period_invalid }))
                  }
                  dense
                />
                <TextField
                  size="small"
                  label="Observações (internas)"
                  value={plan.notes}
                  onChange={(e) => setPlan((p) => ({ ...p, notes: e.target.value.slice(0, 255) }))}
                  fullWidth
                  multiline
                  minRows={2}
                  placeholder="Ex.: negociado com desconto até dez/2026"
                  inputProps={{ maxLength: 255 }}
                  helperText={`${(plan.notes || '').length}/255`}
                  FormHelperTextProps={{ sx: { textAlign: 'right', mx: 0.5 } }}
                />
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving || !!busy}>
            Fechar
          </Button>
          <Button
            variant="contained"
            onClick={saveAll}
            disabled={saving || !!busy || loading || (!modulesDirty && !waDirty && !permsDirty && !planDirty) || !!plan?.period_invalid}
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
          >
            Salvar alterações
          </Button>
        </DialogActions>
      </Dialog>

      <ExtendDialog
        open={extendOpen}
        orgName={orgName}
        loading={busy === 'extend'}
        onClose={() => setExtendOpen(false)}
        onSubmit={(days) =>
          runAction('extend', () => post(`/admin/billing/subscriptions/${orgId}/extend`, { days }), `Acesso estendido em ${days} dia(s).`)
        }
      />
      <ConfirmDialog
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        confirmLabel={confirm.confirmLabel}
        color={confirm.color || 'error'}
        loading={!!busy}
        onClose={() => setConfirm({ open: false })}
        onConfirm={() => confirm.action?.()}
      />
    </>
  );
}

// ===== Página principal =====
export default function AdminUsers() {
  const [tab, setTab] = useState('users');
  const [orgs, setOrgs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // dialogs
  const [orgDialog, setOrgDialog] = useState({ open: false, mode: 'create', initial: null });
  const [userDialog, setUserDialog] = useState({ open: false, mode: 'create', initial: null });
  const [clientDialog, setClientDialog] = useState(false);
  const [passDialog, setPassDialog] = useState({ open: false, target: null });
  const [accessDialog, setAccessDialog] = useState({ open: false, user: null });
  const [confirm, setConfirm] = useState({ open: false });
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [orgsData, usersData] = await Promise.all([get('/admin/organizations'), get('/admin/users')]);
      setOrgs(Array.isArray(orgsData) ? orgsData : []);
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Falha ao carregar dados.'));
    } finally {
      setLoading(false);
    }
  }, []);

  // recarrega sem piscar a tabela (usado após ações)
  const refresh = useCallback(async () => {
    try {
      const [orgsData, usersData] = await Promise.all([get('/admin/organizations'), get('/admin/users')]);
      setOrgs(Array.isArray(orgsData) ? orgsData : []);
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Falha ao carregar dados.'));
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const orgsById = useMemo(() => {
    const m = {};
    orgs.forEach((o) => {
      m[o.id] = o;
    });
    return m;
  }, [orgs]);

  // mantém o usuário do dialog de acesso sincronizado após reload
  useEffect(() => {
    if (!accessDialog.open || !accessDialog.user) return;
    const fresh = users.find((u) => u.id === accessDialog.user.id);
    if (fresh && fresh !== accessDialog.user) setAccessDialog((d) => ({ ...d, user: fresh }));
  }, [users, accessDialog.open, accessDialog.user]);

  // ---- Org actions ----
  const submitOrg = async (form) => {
    setActionLoading(true);
    setActionError('');
    try {
      if (orgDialog.mode === 'edit') {
        await patch(`/admin/organizations/${orgDialog.initial.id}`, { name: form.name, status: form.status });
      } else {
        await post('/admin/organizations', {
          name: form.name,
          document_id: form.document_id || undefined,
          admin_name: form.admin_name,
          admin_email: form.admin_email,
          admin_password: form.admin_password,
          admin_role: form.admin_role
        });
      }
      setOrgDialog({ open: false, mode: 'create', initial: null });
      toast.success(orgDialog.mode === 'edit' ? 'Organização atualizada.' : 'Organização criada.');
      await loadData();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  // ---- Client (conta + usuário + plano) ----
  const submitClient = async (form) => {
    setActionLoading(true);
    setActionError('');
    try {
      await post('/admin/clients', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        org_name: form.org_name.trim() || undefined,
        modules: modulesWithWaPerms(form.modules, form.wa_perms),
        price_cents: Number(form.price_cents) || 0,
        period_days: form.period_days == null ? null : Number(form.period_days),
        role: form.role
      });
      setClientDialog(false);
      toast.success(`Cliente "${form.name.trim()}" criado.`);
      await loadData();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  // ---- User actions ----
  const submitUser = async (form) => {
    setActionLoading(true);
    setActionError('');
    try {
      const modules = normalizeModules(form.modules);
      // null = todos os números · [ids] = só esses · undefined = não envia (sem módulo ou dono/admin)
      const whatsapp_sessions = waSessionsForPayload(modules, form.role, form.whatsapp_sessions);
      if (userDialog.mode === 'edit') {
        await patch(`/admin/users/${userDialog.initial.id}`, {
          name: form.name,
          role: form.role,
          active: form.active,
          modules: modulesWithWaPerms(modules, form.wa_perms),
          ...(whatsapp_sessions !== undefined ? { whatsapp_sessions } : {})
        });
      } else {
        await post('/admin/users', {
          organization_id: form.organization_id,
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          modules: modulesWithWaPerms(modules, form.wa_perms),
          ...(whatsapp_sessions !== undefined ? { whatsapp_sessions } : {})
        });
      }
      setUserDialog({ open: false, mode: 'create', initial: null });
      toast.success(userDialog.mode === 'edit' ? 'Usuário atualizado.' : 'Usuário criado.');
      await loadData();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const submitPassword = async (password) => {
    setActionLoading(true);
    setActionError('');
    try {
      await patch(`/admin/users/${passDialog.target.id}/password`, { password });
      setPassDialog({ open: false, target: null });
      toast.success('Senha alterada.');
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const runConfirm = async () => {
    setActionLoading(true);
    setActionError('');
    try {
      await confirm.action();
      setConfirm({ open: false });
      toast.success(confirm.successMessage || 'Feito.');
      await loadData();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const askDeleteOrg = (org) =>
    setConfirm({
      open: true,
      title: 'Apagar organização',
      message: `Apagar "${org.name}" PERMANENTEMENTE? Isso remove a organização e TODO o conteúdo dela (webchats, leads, projetos, posts, transações, etc.). Ação irreversível.`,
      confirmLabel: 'Apagar',
      successMessage: 'Organização apagada.',
      action: () => remove(`/admin/organizations/${org.id}`)
    });

  const askDeleteUser = (user) =>
    setConfirm({
      open: true,
      title: 'Apagar usuário',
      message: `Apagar "${user.email}" PERMANENTEMENTE? Ação irreversível.`,
      confirmLabel: 'Apagar',
      successMessage: 'Usuário apagado.',
      action: () => remove(`/admin/users/${user.id}`)
    });

  const userAccess = (u) => u.access || orgsById[u.organization_id]?.access || orgsById[u.organizations?.id]?.access;

  return (
    <MainCard
      title="Usuários & Organizações"
      secondary={
        <Tooltip title="Recarregar">
          <span>
            <IconButton onClick={loadData} disabled={loading}>
              <IconRefresh size={20} />
            </IconButton>
          </span>
        </Tooltip>
      }
    >
      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}
      {actionError && !userDialog.open && !orgDialog.open && !passDialog.open && !clientDialog ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError('')}>
          {actionError}
        </Alert>
      ) : null}

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={1}
        sx={{ mb: 2 }}
      >
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab value="users" label="Usuários" />
          <Tab value="orgs" label="Organizações" />
        </Tabs>
        {tab === 'orgs' ? (
          <Button
            variant="contained"
            startIcon={<IconPlus size={18} />}
            onClick={() => {
              setActionError('');
              setOrgDialog({ open: true, mode: 'create', initial: null });
            }}
          >
            Nova organização
          </Button>
        ) : (
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" justifyContent="flex-end">
            <Button
              variant="outlined"
              startIcon={<IconUserPlus size={18} />}
              onClick={() => {
                setActionError('');
                setUserDialog({ open: true, mode: 'create', initial: null });
              }}
            >
              Adicionar usuário a uma conta
            </Button>
            <Button
              variant="contained"
              startIcon={<IconPlus size={18} />}
              onClick={() => {
                setActionError('');
                setClientDialog(true);
              }}
            >
              Novo cliente
            </Button>
          </Stack>
        )}
      </Stack>

      {loading ? (
        <Stack spacing={1}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={48} />
          ))}
        </Stack>
      ) : tab === 'orgs' ? (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Organização</TableCell>
                <TableCell>ID</TableCell>
                <TableCell>Documento</TableCell>
                <TableCell align="center">Usuários</TableCell>
                <TableCell>Plano</TableCell>
                <TableCell>Acesso</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orgs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                    Nenhuma organização.
                  </TableCell>
                </TableRow>
              ) : (
                orgs.map((o) => (
                  <TableRow key={o.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{o.name}</TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                        {o.id}
                      </Typography>
                    </TableCell>
                    <TableCell>{o.document_id || '—'}</TableCell>
                    <TableCell align="center">{o.users_count ?? 0}</TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {o.access ? planLabel(o.access.price_cents, o.access.lifetime ? null : o.access.period_days) : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>{o.access ? <AccessPill access={o.access} /> : '—'}</TableCell>
                    <TableCell align="center">
                      <Chip
                        size="small"
                        label={o.status ? 'Ativa' : 'Desativada'}
                        color={o.status ? 'success' : 'default'}
                        variant={o.status ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="Editar">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setActionError('');
                            setOrgDialog({ open: true, mode: 'edit', initial: o });
                          }}
                        >
                          <IconEdit size={17} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Apagar">
                        <IconButton size="small" color="error" onClick={() => askDeleteOrg(o)}>
                          <IconTrash size={17} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Usuário</TableCell>
                <TableCell>Conta</TableCell>
                <TableCell align="center">Permissão</TableCell>
                <TableCell>Módulos</TableCell>
                <TableCell>Plano</TableCell>
                <TableCell>Acesso</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                    Nenhum usuário.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => {
                  const access = userAccess(u);
                  return (
                    <TableRow key={u.id} hover sx={{ opacity: u.active === false ? 0.6 : 1 }}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                          {u.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                          {u.email}
                        </Typography>
                        <LastLogin value={u.last_login_at} />
                      </TableCell>
                      <TableCell>{u.organizations?.name || orgsById[u.organization_id]?.name || '—'}</TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={ROLE_LABEL[u.role] || u.role}
                          color={u.role === 'SUPER_ADMIN' ? 'secondary' : 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        {u.role === 'SUPER_ADMIN' ? (
                          <Tooltip title="Super Admin acessa tudo" arrow>
                            <Chip size="small" label="Tudo" color="secondary" variant="outlined" sx={{ height: 22, fontWeight: 700 }} />
                          </Tooltip>
                        ) : (
                          <Stack spacing={0.5} alignItems="flex-start">
                            <ModuleChips value={u.modules} />
                            {hasWhatsApp(u.modules) ? (
                              <WhatsAppAccessChip user={u} orgId={u.organization_id || u.organizations?.id} />
                            ) : null}
                            <WaPermsChip user={u} />
                          </Stack>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {access ? planLabel(access.price_cents, access.lifetime ? null : access.period_days) : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>{access ? <AccessPill access={access} /> : '—'}</TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={u.active ? 'Ativo' : 'Inativo'}
                          color={u.active ? 'success' : 'default'}
                          variant={u.active ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        <Tooltip title="Acesso (módulos e plano)">
                          <IconButton size="small" color="primary" onClick={() => setAccessDialog({ open: true, user: u })}>
                            <IconShieldCheck size={17} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Editar">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setActionError('');
                              setUserDialog({ open: true, mode: 'edit', initial: u });
                            }}
                          >
                            <IconEdit size={17} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Alterar senha">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setActionError('');
                              setPassDialog({ open: true, target: u });
                            }}
                          >
                            <IconKey size={17} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Apagar">
                          <IconButton size="small" color="error" onClick={() => askDeleteUser(u)}>
                            <IconTrash size={17} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <OrgFormDialog
        open={orgDialog.open}
        mode={orgDialog.mode}
        initial={orgDialog.initial}
        loading={actionLoading}
        error={orgDialog.open ? actionError : ''}
        onClose={() => {
          setOrgDialog({ open: false, mode: 'create', initial: null });
          setActionError('');
        }}
        onSubmit={submitOrg}
      />
      <ClientFormDialog
        open={clientDialog}
        loading={actionLoading}
        error={clientDialog ? actionError : ''}
        onClose={() => {
          setClientDialog(false);
          setActionError('');
        }}
        onSubmit={submitClient}
      />
      <UserFormDialog
        open={userDialog.open}
        mode={userDialog.mode}
        initial={userDialog.initial}
        orgs={orgs}
        loading={actionLoading}
        error={userDialog.open ? actionError : ''}
        onClose={() => {
          setUserDialog({ open: false, mode: 'create', initial: null });
          setActionError('');
        }}
        onSubmit={submitUser}
      />
      <PasswordDialog
        open={passDialog.open}
        target={passDialog.target}
        loading={actionLoading}
        error={passDialog.open ? actionError : ''}
        onClose={() => {
          setPassDialog({ open: false, target: null });
          setActionError('');
        }}
        onSubmit={submitPassword}
      />
      <AccessDialog
        open={accessDialog.open}
        user={accessDialog.user}
        loading={actionLoading}
        onClose={() => setAccessDialog({ open: false, user: null })}
        onReload={refresh}
      />
      <ConfirmDialog
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        confirmLabel={confirm.confirmLabel}
        loading={actionLoading}
        onClose={() => {
          setConfirm({ open: false });
          setActionError('');
        }}
        onConfirm={runConfirm}
      />
    </MainCard>
  );
}
