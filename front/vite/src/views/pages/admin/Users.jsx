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
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import Paper from '@mui/material/Paper';

import { AddRoundedIcon as AddRoundedIcon } from 'ui-component/icons';
import { EditRoundedIcon as EditRoundedIcon } from 'ui-component/icons';
import { DeleteRoundedIcon as DeleteRoundedIcon } from 'ui-component/icons';
import { RefreshRoundedIcon as RefreshRoundedIcon } from 'ui-component/icons';
import { KeyRoundedIcon as KeyRoundedIcon } from 'ui-component/icons';

import MainCard from 'ui-component/cards/MainCard';
import { get, post, patch, remove } from 'api/api';

const ROLE_OPTIONS = ['SUPER_ADMIN', 'OWNER', 'ADMIN', 'MEMBER'];

const ROLE_LABEL = {
  SUPER_ADMIN: 'Super Admin',
  OWNER: 'Dono',
  ADMIN: 'Admin',
  MEMBER: 'Membro'
};

const getErrorMessage = (err, fallback = 'Falha ao processar a ação') =>
  err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;

// ===== Confirm dialog =====
function ConfirmDialog({ open, title, message, confirmLabel = 'Confirmar', loading, onClose, onConfirm }) {
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
        <Button color="error" variant="contained" onClick={onConfirm} disabled={loading}>
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
      <Box component="form" onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>
        <DialogTitle>{mode === 'edit' ? 'Editar organização' : 'Nova organização'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <TextField label="Nome da organização" value={form.name || ''} onChange={set('name')} required fullWidth />
            {mode === 'edit' ? (
              <TextField select label="Status" value={form.status ? 'true' : 'false'} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value === 'true' }))} fullWidth>
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
                <TextField label="E-mail do admin" type="email" value={form.admin_email || ''} onChange={set('admin_email')} required fullWidth />
                <TextField label="Senha do admin" type="password" value={form.admin_password || ''} onChange={set('admin_password')} required fullWidth helperText="Mínimo 6 caracteres" />
                <TextField select label="Permissão" value={form.admin_role || 'ADMIN'} onChange={set('admin_role')} fullWidth>
                  {['OWNER', 'ADMIN', 'MEMBER'].map((r) => (
                    <MenuItem key={r} value={r}>{ROLE_LABEL[r]}</MenuItem>
                  ))}
                </TextField>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={loading}>{mode === 'edit' ? 'Salvar' : 'Criar'}</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

// ===== Usuário: criar/editar =====
function UserFormDialog({ open, mode, initial, orgs, loading, error, onClose, onSubmit }) {
  const [form, setForm] = useState({});

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit') {
      setForm({ name: initial?.name || '', role: initial?.role || 'MEMBER', active: initial?.active !== false });
    } else {
      setForm({ organization_id: '', name: '', email: '', password: '', role: 'ADMIN' });
    }
  }, [open, mode, initial]);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>
        <DialogTitle>{mode === 'edit' ? 'Editar usuário' : 'Novo usuário'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            {mode === 'edit' ? (
              <>
                <TextField label="Nome" value={form.name || ''} onChange={set('name')} required fullWidth />
                <TextField select label="Permissão" value={form.role || 'MEMBER'} onChange={set('role')} fullWidth>
                  {ROLE_OPTIONS.map((r) => (
                    <MenuItem key={r} value={r}>{ROLE_LABEL[r]}</MenuItem>
                  ))}
                </TextField>
                <TextField select label="Status" value={form.active ? 'true' : 'false'} onChange={(e) => setForm((p) => ({ ...p, active: e.target.value === 'true' }))} fullWidth>
                  <MenuItem value="true">Ativo</MenuItem>
                  <MenuItem value="false">Inativo</MenuItem>
                </TextField>
              </>
            ) : (
              <>
                <TextField select label="Organização" value={form.organization_id || ''} onChange={set('organization_id')} required fullWidth>
                  <MenuItem value="">— selecione —</MenuItem>
                  {orgs.map((o) => (
                    <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>
                  ))}
                </TextField>
                <TextField label="Nome" value={form.name || ''} onChange={set('name')} required fullWidth />
                <TextField label="E-mail" type="email" value={form.email || ''} onChange={set('email')} required fullWidth />
                <TextField label="Senha" type="password" value={form.password || ''} onChange={set('password')} required fullWidth helperText="Mínimo 6 caracteres" />
                <TextField select label="Permissão" value={form.role || 'ADMIN'} onChange={set('role')} fullWidth>
                  {ROLE_OPTIONS.map((r) => (
                    <MenuItem key={r} value={r}>{ROLE_LABEL[r]}</MenuItem>
                  ))}
                </TextField>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={loading}>{mode === 'edit' ? 'Salvar' : 'Criar'}</Button>
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
      <Box component="form" onSubmit={(e) => { e.preventDefault(); onSubmit(password); }}>
        <DialogTitle>Alterar senha</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <Typography variant="body2" color="text.secondary">
              {target?.email}
            </Typography>
            <TextField label="Nova senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required fullWidth helperText="Mínimo 6 caracteres" autoFocus />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={loading}>Salvar</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

// ===== Página principal =====
export default function AdminUsers() {
  const [tab, setTab] = useState('orgs');
  const [orgs, setOrgs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // dialogs
  const [orgDialog, setOrgDialog] = useState({ open: false, mode: 'create', initial: null });
  const [userDialog, setUserDialog] = useState({ open: false, mode: 'create', initial: null });
  const [passDialog, setPassDialog] = useState({ open: false, target: null });
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

  useEffect(() => {
    loadData();
  }, [loadData]);

  const orgsById = useMemo(() => {
    const m = {};
    orgs.forEach((o) => { m[o.id] = o; });
    return m;
  }, [orgs]);

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
      if (userDialog.mode === 'edit') {
        await patch(`/admin/users/${userDialog.initial.id}`, { name: form.name, role: form.role, active: form.active });
      } else {
        await post('/admin/users', {
          organization_id: form.organization_id,
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role
        });
      }
      setUserDialog({ open: false, mode: 'create', initial: null });
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
      action: () => remove(`/admin/organizations/${org.id}`)
    });

  const askDeleteUser = (user) =>
    setConfirm({
      open: true,
      title: 'Apagar usuário',
      message: `Apagar "${user.email}" PERMANENTEMENTE? Ação irreversível.`,
      confirmLabel: 'Apagar',
      action: () => remove(`/admin/users/${user.id}`)
    });

  return (
    <MainCard
      title="Usuários & Organizações"
      secondary={
        <Tooltip title="Recarregar">
          <span>
            <IconButton onClick={loadData} disabled={loading}>
              <RefreshRoundedIcon />
            </IconButton>
          </span>
        </Tooltip>
      }
    >
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {actionError ? <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError('')}>{actionError}</Alert> : null}

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab value="orgs" label="Organizações" />
          <Tab value="users" label="Usuários" />
        </Tabs>
        {tab === 'orgs' ? (
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setOrgDialog({ open: true, mode: 'create', initial: null })}>
            Nova organização
          </Button>
        ) : (
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setUserDialog({ open: true, mode: 'create', initial: null })}>
            Novo usuário
          </Button>
        )}
      </Stack>

      {loading ? (
        <Stack spacing={1}>
          {[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={48} />)}
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
                <TableCell align="center">Status</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orgs.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ color: 'text.secondary', py: 3 }}>Nenhuma organização.</TableCell></TableRow>
              ) : orgs.map((o) => (
                <TableRow key={o.id} hover>
                  <TableCell>{o.name}</TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                      {o.id}
                    </Typography>
                  </TableCell>
                  <TableCell>{o.document_id || '—'}</TableCell>
                  <TableCell align="center">{o.users_count ?? 0}</TableCell>
                  <TableCell align="center">
                    <Chip size="small" label={o.status ? 'Ativa' : 'Desativada'} color={o.status ? 'success' : 'default'} variant={o.status ? 'filled' : 'outlined'} />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => setOrgDialog({ open: true, mode: 'edit', initial: o })}>
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Apagar">
                      <IconButton size="small" color="error" onClick={() => askDeleteOrg(o)}>
                        <DeleteRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>E-mail</TableCell>
                <TableCell>Organização</TableCell>
                <TableCell align="center">Permissão</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ color: 'text.secondary', py: 3 }}>Nenhum usuário.</TableCell></TableRow>
              ) : users.map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.organizations?.name || orgsById[u.organization_id]?.name || '—'}</TableCell>
                  <TableCell align="center">
                    <Chip size="small" label={ROLE_LABEL[u.role] || u.role} color={u.role === 'SUPER_ADMIN' ? 'secondary' : 'default'} variant="outlined" />
                  </TableCell>
                  <TableCell align="center">
                    <Chip size="small" label={u.active ? 'Ativo' : 'Inativo'} color={u.active ? 'success' : 'default'} variant={u.active ? 'filled' : 'outlined'} />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => setUserDialog({ open: true, mode: 'edit', initial: u })}>
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Alterar senha">
                      <IconButton size="small" onClick={() => setPassDialog({ open: true, target: u })}>
                        <KeyRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Apagar">
                      <IconButton size="small" color="error" onClick={() => askDeleteUser(u)}>
                        <DeleteRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
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
        onClose={() => { setOrgDialog({ open: false, mode: 'create', initial: null }); setActionError(''); }}
        onSubmit={submitOrg}
      />
      <UserFormDialog
        open={userDialog.open}
        mode={userDialog.mode}
        initial={userDialog.initial}
        orgs={orgs}
        loading={actionLoading}
        error={userDialog.open ? actionError : ''}
        onClose={() => { setUserDialog({ open: false, mode: 'create', initial: null }); setActionError(''); }}
        onSubmit={submitUser}
      />
      <PasswordDialog
        open={passDialog.open}
        target={passDialog.target}
        loading={actionLoading}
        error={passDialog.open ? actionError : ''}
        onClose={() => { setPassDialog({ open: false, target: null }); setActionError(''); }}
        onSubmit={submitPassword}
      />
      <ConfirmDialog
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        confirmLabel={confirm.confirmLabel}
        loading={actionLoading}
        onClose={() => setConfirm({ open: false })}
        onConfirm={runConfirm}
      />
    </MainCard>
  );
}
