import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  IconArrowDown,
  IconArrowUp,
  IconBuildingStore,
  IconCheck,
  IconMapPin,
  IconPencil,
  IconPlus,
  IconTrash,
  IconUsers
} from '@tabler/icons-react';

import { get, post, put, remove } from 'api/api';
import { TgCard, TgConfirmDialog, TgEmptyState, TgListSkeleton } from 'views/pages/telegram/ui';
import { WaNumberDot, WaNumberSelect, sessionLabel, useWaSessions } from '../waKit';
import { errMsg, tint } from '../waShared';
import { CrmModal, fmtCep, waPrimaryBtn } from './crmKit';
import { maskCep, maskPhone } from './customFields';

// ============================================================================
// Unidades / filiais (Fase 7, contrato §11.2): CRUD /whatsapp/units + reordenar (PUT /reorder).
// Escrita só dono/admin. Apagar unidade SOLTA o vínculo dos clientes/pedidos (não apaga dados).
// `useUnits()` = lista com cache no módulo (selects da tela de clientes e do diálogo do cliente).
// ============================================================================

export const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

let unitsCache = null;
let unitsInflight = null;
const unitListeners = new Set();
const setUnitsCache = (list) => {
  unitsCache = Array.isArray(list) ? list : [];
  unitListeners.forEach((fn) => fn(unitsCache));
};
function loadUnits(force = false) {
  if (unitsCache && !force) return Promise.resolve(unitsCache);
  if (unitsInflight) return unitsInflight;
  unitsInflight = get('/whatsapp/units')
    .then((r) => {
      setUnitsCache(r);
      return unitsCache;
    })
    .finally(() => {
      unitsInflight = null;
    });
  return unitsInflight;
}

/** Lista de unidades (cache compartilhado). `enabled=false` não busca (ex.: diálogo fechado). */
export function useUnits(enabled = true) {
  const [units, setUnits] = useState(unitsCache || []);
  const [loading, setLoading] = useState(!unitsCache && enabled);
  useEffect(() => {
    let alive = true;
    const fn = (l) => alive && setUnits(l);
    unitListeners.add(fn);
    if (enabled)
      loadUnits()
        .catch(() => undefined)
        .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
      unitListeners.delete(fn);
    };
  }, [enabled]);
  const reload = useCallback(() => loadUnits(true).catch(() => undefined), []);
  return { units, loading, reload };
}

export const addressLine = (a) => {
  if (!a || typeof a !== 'object') return '';
  const street = [a.street, a.number].filter(Boolean).join(', ');
  const city = [a.city, a.state].filter(Boolean).join('/');
  return [street, a.complement, a.district, city, a.zip ? fmtCep(a.zip) : ''].filter(Boolean).join(' · ');
};

const emptyUnit = () => ({
  name: '',
  code: '',
  phone: '',
  session_id: '',
  active: true,
  address: { zip: '', street: '', number: '', complement: '', district: '', city: '', state: '' }
});

function UnitDialog({ open, unit, sessions, onClose, onSaved }) {
  const [f, setF] = useState(emptyUnit);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setBusy(false);
    setF(
      unit
        ? {
            name: unit.name || '',
            code: unit.code || '',
            phone: unit.phone || '',
            session_id: unit.session_id || '',
            active: unit.active !== false,
            address: { ...emptyUnit().address, ...(unit.address || {}) }
          }
        : emptyUnit()
    );
  }, [open, unit]);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setA = (k, v) => setF((x) => ({ ...x, address: { ...x.address, [k]: v } }));

  const save = async () => {
    if (!f.name.trim()) return toast.error('Dê um nome à unidade.');
    setBusy(true);
    try {
      const body = {
        name: f.name.trim(),
        code: f.code.trim() || null,
        phone: f.phone.replace(/\D/g, '') || null,
        session_id: f.session_id || null,
        active: f.active,
        address: Object.values(f.address).some((v) => String(v || '').trim())
          ? { ...f.address, zip: f.address.zip.replace(/\D/g, '') }
          : null
      };
      const r = unit?.id ? await put(`/whatsapp/units/${unit.id}`, body) : await post('/whatsapp/units', body);
      toast.success(unit?.id ? 'Unidade salva.' : 'Unidade criada.');
      onSaved?.(r);
      onClose?.();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível salvar a unidade.'));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <CrmModal
      open={open}
      onClose={() => !busy && onClose?.()}
      title={unit?.id ? unit.name : 'Nova unidade'}
      subtitle="Filial, loja, clínica ou base de atendimento. O cliente pode ficar vinculado a uma unidade."
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
            {unit?.id ? 'Salvar' : 'Criar unidade'}
          </Button>
        </>
      }
    >
      <Stack spacing={1.5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            size="small"
            label="Nome da unidade"
            value={f.name}
            onChange={(e) => set('name', e.target.value.slice(0, 120))}
            fullWidth
            autoFocus={!unit?.id}
          />
          <TextField
            size="small"
            label="Código"
            value={f.code}
            onChange={(e) => set('code', e.target.value.slice(0, 32))}
            helperText="Opcional (ex.: LJ01)"
            sx={{ width: { sm: 180 } }}
          />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            size="small"
            label="Telefone da unidade"
            value={maskPhone(f.phone)}
            onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, 13))}
            inputProps={{ inputMode: 'tel' }}
            fullWidth
          />
          {sessions.length ? (
            <WaNumberSelect
              sessions={sessions}
              value={f.session_id}
              onChange={(v) => set('session_id', v)}
              allowAll
              allLabel="Nenhum em especial"
              label="Número do WhatsApp preferido"
              helperText="Para avisos desta unidade."
            />
          ) : null}
        </Stack>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
          Endereço
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            size="small"
            label="CEP"
            value={maskCep(f.address.zip)}
            onChange={(e) => setA('zip', e.target.value)}
            inputProps={{ inputMode: 'numeric' }}
            sx={{ width: { sm: 150 } }}
          />
          <TextField
            size="small"
            label="Rua"
            value={f.address.street}
            onChange={(e) => setA('street', e.target.value.slice(0, 120))}
            fullWidth
          />
          <TextField
            size="small"
            label="Nº"
            value={f.address.number}
            onChange={(e) => setA('number', e.target.value.slice(0, 20))}
            sx={{ width: { sm: 110 } }}
          />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            size="small"
            label="Complemento"
            value={f.address.complement}
            onChange={(e) => setA('complement', e.target.value.slice(0, 60))}
            fullWidth
          />
          <TextField
            size="small"
            label="Bairro"
            value={f.address.district}
            onChange={(e) => setA('district', e.target.value.slice(0, 80))}
            fullWidth
          />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            size="small"
            label="Cidade"
            value={f.address.city}
            onChange={(e) => setA('city', e.target.value.slice(0, 80))}
            fullWidth
          />
          <TextField
            select
            size="small"
            label="UF"
            value={f.address.state}
            onChange={(e) => setA('state', e.target.value)}
            sx={{ width: { sm: 110 } }}
          >
            <MenuItem value="">—</MenuItem>
            {UFS.map((u) => (
              <MenuItem key={u} value={u}>
                {u}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        <FormControlLabel
          control={<Switch checked={f.active} onChange={(e) => set('active', e.target.checked)} />}
          label={
            <Typography variant="body2">
              Unidade ativa{' '}
              <Box component="span" sx={{ color: 'text.secondary' }}>
                (desativada não aparece para novos cadastros)
              </Box>
            </Typography>
          }
        />
      </Stack>
    </CrmModal>
  );
}

/** Seção "Unidades" (aba da página Clientes). `onFilter(unitId)` = ver os clientes da unidade. */
export default function UnitsManager({ canEdit, onFilter }) {
  const { units, loading, reload } = useUnits(true);
  const { sessions } = useWaSessions(0);
  const [dlg, setDlg] = useState(null); // {unit|null}
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const reorder = async (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= units.length) return;
    const ids = units.map((u) => u.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setUnitsCache(ids.map((id) => units.find((u) => u.id === id)));
    try {
      setUnitsCache(await put('/whatsapp/units/reorder', { ids }));
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível reordenar.'));
      reload();
    }
  };
  const del = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await remove(`/whatsapp/units/${confirm.id}`);
      toast.success('Unidade apagada.');
      setConfirm(null);
      reload();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível apagar.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ mb: 1.5 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', flex: 1 }}>
          Filiais, lojas ou bases. Vincule cada cliente a uma unidade para filtrar a lista e separar o financeiro.
        </Typography>
        {canEdit ? (
          <Button
            variant="contained"
            disableElevation
            startIcon={<IconPlus size={18} />}
            onClick={() => setDlg({ unit: null })}
            sx={{ ...waPrimaryBtn, flexShrink: 0, minHeight: 40 }}
          >
            Nova unidade
          </Button>
        ) : null}
      </Stack>

      {loading && !units.length ? (
        <TgCard hover={false} sx={{ p: 2 }}>
          <TgListSkeleton rows={4} />
        </TgCard>
      ) : !units.length ? (
        <TgEmptyState
          icon={IconBuildingStore}
          title="Nenhuma unidade ainda"
          description="Tem mais de uma loja, clínica ou base? Cadastre aqui e escolha a unidade no cadastro de cada cliente."
          action={
            canEdit ? (
              <Button
                variant="contained"
                disableElevation
                startIcon={<IconPlus size={18} />}
                onClick={() => setDlg({ unit: null })}
                sx={waPrimaryBtn}
              >
                Cadastrar a primeira unidade
              </Button>
            ) : null
          }
        />
      ) : (
        <TgCard hover={false} sx={{ p: 0, overflow: 'hidden' }}>
          {units.map((u, i) => (
            <Stack
              key={u.id}
              direction="row"
              spacing={1}
              alignItems="flex-start"
              sx={{ px: { xs: 1, sm: 1.5 }, py: 1.25, borderBottom: i < units.length - 1 ? '1px solid' : 0, borderColor: 'divider' }}
            >
              {canEdit ? (
                <Stack sx={{ flexShrink: 0, mt: 0.25 }}>
                  <IconButton size="small" onClick={() => reorder(i, -1)} disabled={i === 0} aria-label="Subir" sx={{ p: 0.25 }}>
                    <IconArrowUp size={14} />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => reorder(i, 1)}
                    disabled={i === units.length - 1}
                    aria-label="Descer"
                    sx={{ p: 0.25 }}
                  >
                    <IconArrowDown size={14} />
                  </IconButton>
                </Stack>
              ) : null}
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  flexShrink: 0,
                  display: 'grid',
                  placeItems: 'center',
                  color: u.active ? 'success.main' : 'text.disabled',
                  bgcolor: (t) => (u.active ? tint(t, 'success', 0.12) : t.vars.palette.action.hover)
                }}
              >
                <IconBuildingStore size={18} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 0, overflowWrap: 'anywhere' }}>
                    {u.name}
                  </Typography>
                  {u.code ? (
                    <Chip size="small" label={u.code} sx={{ height: 20, fontSize: 11, fontWeight: 700, borderRadius: 1.5 }} />
                  ) : null}
                  {!u.active ? (
                    <Chip size="small" label="Inativa" sx={{ height: 20, fontSize: 11, fontWeight: 700, borderRadius: 1.5 }} />
                  ) : null}
                </Stack>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', overflowWrap: 'anywhere' }}>
                  {[u.phone ? maskPhone(u.phone) : '', addressLine(u.address)].filter(Boolean).join(' · ') || 'Sem endereço'}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                  <Button
                    size="small"
                    startIcon={<IconUsers size={14} />}
                    onClick={() => onFilter?.(u.id)}
                    sx={{ textTransform: 'none', fontWeight: 700, minHeight: 28, px: 1 }}
                  >
                    {u.customers || 0} cliente{u.customers === 1 ? '' : 's'}
                  </Button>
                  {u.session ? (
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <WaNumberDot session={u.session} />
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {sessionLabel(u.session)}
                      </Typography>
                    </Stack>
                  ) : null}
                  {u.address?.city ? (
                    <Stack direction="row" spacing={0.25} alignItems="center" sx={{ color: 'text.secondary' }}>
                      <IconMapPin size={13} />
                      <Typography variant="caption">{[u.address.city, u.address.state].filter(Boolean).join('/')}</Typography>
                    </Stack>
                  ) : null}
                </Stack>
              </Box>
              {canEdit ? (
                <Stack direction="row" sx={{ flexShrink: 0 }}>
                  <Tooltip title="Editar">
                    <IconButton size="small" onClick={() => setDlg({ unit: u })} aria-label="Editar unidade">
                      <IconPencil size={17} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Apagar">
                    <IconButton size="small" color="error" onClick={() => setConfirm(u)} aria-label="Apagar unidade">
                      <IconTrash size={17} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              ) : null}
            </Stack>
          ))}
        </TgCard>
      )}

      <UnitDialog open={Boolean(dlg)} unit={dlg?.unit || null} sessions={sessions} onClose={() => setDlg(null)} onSaved={() => reload()} />
      <TgConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={del}
        loading={busy}
        danger
        title={`Apagar a unidade "${confirm?.name || ''}"?`}
        message={
          confirm?.customers
            ? `${confirm.customers} cliente${confirm.customers === 1 ? '' : 's'} (e os pedidos) desta unidade só perdem o vínculo — nenhum cadastro é apagado.`
            : 'Nenhum cliente está nesta unidade. Pedidos antigos dela só perdem o vínculo.'
        }
        confirmLabel="Apagar"
      />
    </Box>
  );
}
