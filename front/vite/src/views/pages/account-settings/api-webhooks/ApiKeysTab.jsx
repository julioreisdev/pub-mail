import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { IconCheck, IconKey, IconPencil, IconPlus, IconRefresh, IconTrash } from '@tabler/icons-react';

import { get, post, put, remove } from 'api/api';
import { TgCard, TgConfirmDialog, TgEmptyState, TgListSkeleton, TgStatusPill } from 'views/pages/telegram/ui';
import { CrmModal } from 'views/pages/whatsapp/crm/crmKit';
import { ALL_SCOPES, READ_SCOPES, SCOPE_GROUPS, SecretBox, errMsg, fmtDT, monoSx, scopeLabel } from './apiKit';

// ============================================================================
// Aba "Chaves de API": GET/POST/PUT/DELETE /org/api-keys (dono/admin).
// A chave inteira só volta na criação (`key`); a lista mostra o prefixo.
// ============================================================================

const MAX_KEYS = 20;
const prefixOf = (k) => {
  const p = String(k.prefix || k.key_prefix || '');
  if (!p) return 'pm_…';
  return `${p.startsWith('pm_') ? p : `pm_${p}`}_…`;
};

function ScopeChips({ scopes }) {
  const list = Array.isArray(scopes) ? scopes : [];
  if (list.length === ALL_SCOPES.length)
    return <Chip size="small" label="Acesso total" color="warning" sx={{ height: 22, fontWeight: 700 }} />;
  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
      {list.map((s) => (
        <Chip
          key={s}
          size="small"
          label={scopeLabel(s)}
          variant="outlined"
          sx={{
            height: 22,
            fontWeight: 600,
            borderRadius: 1.5,
            maxWidth: '100%',
            borderColor: s.endsWith(':read') ? 'divider' : 'warning.main'
          }}
        />
      ))}
      {!list.length ? (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Sem permissões
        </Typography>
      ) : null}
    </Stack>
  );
}

function ScopePicker({ value, onChange }) {
  const set = new Set(value);
  const toggle = (s) => {
    const n = new Set(set);
    if (n.has(s)) n.delete(s);
    else n.add(s);
    onChange(ALL_SCOPES.filter((x) => n.has(x)));
  };
  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography variant="body2" sx={{ fontWeight: 700, flex: 1 }}>
          Permissões
        </Typography>
        <Button size="small" onClick={() => onChange(READ_SCOPES)} sx={{ textTransform: 'none' }}>
          Só leitura
        </Button>
        <Button size="small" onClick={() => onChange(ALL_SCOPES)} sx={{ textTransform: 'none' }}>
          Tudo
        </Button>
        <Button size="small" color="inherit" onClick={() => onChange([])} sx={{ textTransform: 'none' }}>
          Nenhuma
        </Button>
      </Stack>
      <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' } }}>
        {SCOPE_GROUPS.map((g) => (
          <Box key={g.key} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 2, minWidth: 0 }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {g.label}
            </Typography>
            {g.scopes.map((s) => (
              <FormControlLabel
                key={s.value}
                sx={{ display: 'flex', mr: 0, '& .MuiFormControlLabel-label': { fontSize: 13.5, minWidth: 0 } }}
                control={<Checkbox size="small" checked={set.has(s.value)} onChange={() => toggle(s.value)} />}
                label={
                  <span>
                    {s.label}{' '}
                    <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ...monoSx }}>
                      {s.value}
                    </Typography>
                  </span>
                }
              />
            ))}
          </Box>
        ))}
      </Box>
      {value.some((s) => !s.endsWith(':read')) ? (
        <Typography variant="caption" sx={{ color: 'warning.main' }}>
          Esta chave poderá alterar dados (criar, cancelar, enviar mensagens). Dê só o que o seu sistema precisa.
        </Typography>
      ) : null}
    </Stack>
  );
}

export default function ApiKeysTab({ canManage }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [dlg, setDlg] = useState(null); // {id?, name, scopes}
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null); // {name, key}
  const [confirm, setConfirm] = useState(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const s = ++seq.current;
    try {
      const r = await get('/org/api-keys');
      if (s !== seq.current) return;
      setItems(Array.isArray(r) ? r : Array.isArray(r?.items) ? r.items : []);
      setError('');
    } catch (e) {
      if (s !== seq.current) return;
      setError(errMsg(e, 'Não foi possível carregar as chaves.'));
      setItems((p) => p || []);
    }
  }, []);
  useEffect(() => {
    if (canManage) load();
  }, [canManage, load]);

  if (!canManage) {
    return (
      <Alert severity="info" sx={{ borderRadius: 2.5, maxWidth: 760 }}>
        Só o dono ou um admin da organização cria e vê as chaves de API. A aba <strong>Documentação</strong> mostra como a API funciona.
      </Alert>
    );
  }

  const active = (items || []).filter((k) => !k.revoked_at);

  const save = async () => {
    const name = String(dlg.name || '').trim();
    if (!name) return toast.error('Dê um nome à chave (ex.: "Sistema da clínica").');
    if (!dlg.scopes.length) return toast.error('Marque pelo menos uma permissão.');
    setBusy(true);
    try {
      if (dlg.id) {
        await put(`/org/api-keys/${dlg.id}`, { name: name.slice(0, 80), scopes: dlg.scopes });
        toast.success('Chave atualizada.');
      } else {
        const r = await post('/org/api-keys', { name: name.slice(0, 80), scopes: dlg.scopes });
        if (r?.key) setCreated({ name, key: r.key });
        else toast.success('Chave criada.');
      }
      setDlg(null);
      load();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível salvar a chave.'));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  const revoke = async () => {
    setBusy(true);
    try {
      await remove(`/org/api-keys/${confirm.id}`);
      toast.success('Chave revogada. Quem usava recebe 401 a partir de agora.');
      setConfirm(null);
      load();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível revogar.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 960 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', flex: 1 }}>
          Chaves para o seu sistema falar com o Pub Mail: consultar clientes, criar assinaturas, gerar cobranças, mandar mensagens. Envie no
          cabeçalho <code>Authorization: Bearer pm_…</code>.
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Atualizar">
            <IconButton onClick={load} aria-label="Atualizar chaves">
              <IconRefresh size={18} />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            disableElevation
            startIcon={<IconPlus size={18} />}
            disabled={active.length >= MAX_KEYS}
            onClick={() => setDlg({ name: '', scopes: READ_SCOPES })}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, flex: { xs: 1, sm: 'none' } }}
          >
            Nova chave
          </Button>
        </Stack>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {error}
        </Alert>
      ) : null}

      {items === null ? (
        <TgListSkeleton rows={3} />
      ) : !items.length ? (
        <TgEmptyState
          icon={IconKey}
          title="Nenhuma chave de API"
          description="Crie uma chave para integrar o seu sistema (site, ERP, área de membros) com os clientes, assinaturas e cobranças do WhatsApp."
          dense
        />
      ) : (
        <Stack spacing={1}>
          {items.map((k) => {
            const revoked = Boolean(k.revoked_at);
            return (
              <TgCard key={k.id} hover={false} sx={{ p: 1.75, opacity: revoked ? 0.6 : 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 38,
                      height: 38,
                      borderRadius: 2,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                      bgcolor: 'action.selected'
                    }}
                  >
                    <IconKey size={18} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }} flexWrap="wrap" useFlexGap>
                      <Typography sx={{ fontWeight: 800, minWidth: 0 }} noWrap title={k.name}>
                        {k.name}
                      </Typography>
                      {revoked ? <TgStatusPill status="error" label="Revogada" /> : <TgStatusPill status="active" label="Ativa" />}
                    </Stack>
                    <Typography variant="body2" sx={{ ...monoSx, color: 'text.secondary', mt: 0.25 }} noWrap>
                      {prefixOf(k)}
                    </Typography>
                    <Box sx={{ mt: 0.75 }}>
                      <ScopeChips scopes={k.scopes} />
                    </Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
                      {revoked
                        ? `Revogada em ${fmtDT(k.revoked_at)}`
                        : k.last_used_at
                          ? `Último uso ${fmtDT(k.last_used_at)}${k.last_ip ? ` · IP ${k.last_ip}` : ''}`
                          : 'Nunca usada'}
                      {k.created_at ? ` · criada em ${fmtDT(k.created_at)}` : ''}
                    </Typography>
                  </Box>
                  {!revoked ? (
                    <Stack direction="row" spacing={0.25}>
                      <Tooltip title="Editar nome e permissões">
                        <IconButton
                          size="small"
                          onClick={() => setDlg({ id: k.id, name: k.name || '', scopes: Array.isArray(k.scopes) ? k.scopes : [] })}
                          aria-label="Editar chave"
                        >
                          <IconPencil size={16} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Revogar">
                        <IconButton size="small" color="error" onClick={() => setConfirm(k)} aria-label="Revogar chave">
                          <IconTrash size={16} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  ) : null}
                </Stack>
              </TgCard>
            );
          })}
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {active.length} de {MAX_KEYS} chaves ativas.
          </Typography>
        </Stack>
      )}

      <CrmModal
        open={Boolean(dlg)}
        onClose={() => !busy && setDlg(null)}
        title={dlg?.id ? 'Editar chave' : 'Nova chave de API'}
        subtitle={
          dlg?.id
            ? 'A chave continua a mesma; só muda o que ela pode fazer.'
            : 'A chave inteira aparece uma única vez, logo depois de criar.'
        }
        maxWidth="md"
        disableClose={busy}
        footer={
          <>
            <Button color="inherit" onClick={() => setDlg(null)} disabled={busy} sx={{ textTransform: 'none' }}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              disableElevation
              onClick={save}
              disabled={busy}
              startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <IconCheck size={16} />}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {dlg?.id ? 'Salvar' : 'Criar chave'}
            </Button>
          </>
        }
      >
        {dlg ? (
          <Stack spacing={2}>
            <TextField
              size="small"
              label="Nome"
              value={dlg.name}
              onChange={(e) => setDlg((d) => ({ ...d, name: e.target.value.slice(0, 80) }))}
              placeholder='Ex.: "Sistema da clínica", "Área de membros"'
              autoFocus
              fullWidth
            />
            <ScopePicker value={dlg.scopes} onChange={(scopes) => setDlg((d) => ({ ...d, scopes }))} />
          </Stack>
        ) : null}
      </CrmModal>

      <CrmModal
        open={Boolean(created)}
        onClose={() => setCreated(null)}
        title="Chave criada"
        subtitle={created?.name}
        footer={
          <Button variant="contained" disableElevation onClick={() => setCreated(null)} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Já copiei
          </Button>
        }
      >
        {created ? (
          <SecretBox
            value={created.key}
            title="Sua chave de API"
            warning="Copie agora e guarde num lugar seguro (variável de ambiente do seu sistema). Por segurança, ela não aparece de novo — se perder, revogue e crie outra."
          />
        ) : null}
      </CrmModal>

      <TgConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={revoke}
        loading={busy}
        danger
        title="Revogar esta chave?"
        message={`"${confirm?.name}" para de funcionar na hora (o sistema que usa recebe 401). Não dá para desfazer.`}
        confirmLabel="Revogar"
      />
    </Box>
  );
}
