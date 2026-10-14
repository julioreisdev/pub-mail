import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { IconMapPinPlus, IconTrash } from '@tabler/icons-react';

import { maskCep } from './customFields';
import { UFS } from './UnitsManager';

// ============================================================================
// Endereços de atendimento/entrega do cliente (Fase 7, contrato §11.2): lista de até 10
// {id, kind:'service'|'delivery'|'billing'|'other', label, street, number, complement, district,
// city, state, zip, notes, is_default}. O `address` antigo do cliente continua sendo o de COBRANÇA (boleto).
// ============================================================================

export const ADDRESS_KINDS = [
  { value: 'service', label: 'Atendimento / instalação' },
  { value: 'delivery', label: 'Entrega' },
  { value: 'billing', label: 'Cobrança' },
  { value: 'other', label: 'Outro' }
];
export const MAX_ADDRESSES = 10;

let seq = 0;
export const newAddressId = () => `a${Date.now().toString(36)}${(seq += 1)}`;
export const emptyAddress = (isDefault = false) => ({
  id: newAddressId(),
  kind: 'service',
  label: '',
  street: '',
  number: '',
  complement: '',
  district: '',
  city: '',
  state: '',
  zip: '',
  notes: '',
  is_default: isDefault
});

/** Para o payload: tira os vazios (sem rua, cidade nem CEP) e normaliza o CEP. */
export const cleanAddresses = (list) =>
  (list || [])
    .map((a) => ({ ...a, zip: String(a.zip || '').replace(/\D/g, '') }))
    .filter((a) => String(a.street || '').trim() || String(a.city || '').trim() || a.zip);

export default function AddressesEditor({ value = [], onChange, disabled }) {
  const list = Array.isArray(value) ? value : [];
  const patch = (id, p) => onChange(list.map((a) => (a.id === id ? { ...a, ...p } : a)));
  const setDefault = (id, on) => onChange(list.map((a) => ({ ...a, is_default: a.id === id ? on : on ? false : a.is_default })));
  const removeOne = (id) => {
    const next = list.filter((a) => a.id !== id);
    if (next.length && !next.some((a) => a.is_default) && list.find((a) => a.id === id)?.is_default)
      next[0] = { ...next[0], is_default: true };
    onChange(next);
  };

  return (
    <Stack spacing={1.25}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Onde o cliente é atendido ou recebe as entregas (pode ter vários). O endereço de <strong>cobrança do boleto</strong> fica na aba
        Dados.
      </Typography>
      {list.map((a, i) => (
        <Box key={a.id} sx={{ p: 1.5, border: '1px solid', borderColor: a.is_default ? 'success.main' : 'divider', borderRadius: 2.5 }}>
          <Stack spacing={1.25}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', flex: 1 }}>
                Endereço {i + 1}
              </Typography>
              <FormControlLabel
                sx={{ mr: 0 }}
                control={
                  <Switch
                    size="small"
                    checked={Boolean(a.is_default)}
                    onChange={(e) => setDefault(a.id, e.target.checked)}
                    disabled={disabled}
                  />
                }
                label={<Typography variant="caption">Padrão</Typography>}
              />
              <Tooltip title="Remover endereço">
                <IconButton size="small" color="error" onClick={() => removeOne(a.id)} disabled={disabled} aria-label="Remover endereço">
                  <IconTrash size={16} />
                </IconButton>
              </Tooltip>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
              <TextField
                select
                size="small"
                label="Tipo"
                value={a.kind || 'service'}
                onChange={(e) => patch(a.id, { kind: e.target.value })}
                disabled={disabled}
                sx={{ width: { sm: 220 } }}
              >
                {ADDRESS_KINDS.map((k) => (
                  <MenuItem key={k.value} value={k.value}>
                    {k.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                label="Apelido"
                placeholder="Casa, Loja centro, Sítio…"
                value={a.label || ''}
                onChange={(e) => patch(a.id, { label: e.target.value.slice(0, 60) })}
                disabled={disabled}
                fullWidth
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
              <TextField
                size="small"
                label="CEP"
                value={maskCep(a.zip)}
                onChange={(e) => patch(a.id, { zip: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                inputProps={{ inputMode: 'numeric' }}
                disabled={disabled}
                sx={{ width: { sm: 150 } }}
              />
              <TextField
                size="small"
                label="Rua"
                value={a.street || ''}
                onChange={(e) => patch(a.id, { street: e.target.value.slice(0, 120) })}
                disabled={disabled}
                fullWidth
              />
              <TextField
                size="small"
                label="Nº"
                value={a.number || ''}
                onChange={(e) => patch(a.id, { number: e.target.value.slice(0, 20) })}
                disabled={disabled}
                sx={{ width: { sm: 110 } }}
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
              <TextField
                size="small"
                label="Complemento"
                value={a.complement || ''}
                onChange={(e) => patch(a.id, { complement: e.target.value.slice(0, 60) })}
                disabled={disabled}
                fullWidth
              />
              <TextField
                size="small"
                label="Bairro"
                value={a.district || ''}
                onChange={(e) => patch(a.id, { district: e.target.value.slice(0, 80) })}
                disabled={disabled}
                fullWidth
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
              <TextField
                size="small"
                label="Cidade"
                value={a.city || ''}
                onChange={(e) => patch(a.id, { city: e.target.value.slice(0, 80) })}
                disabled={disabled}
                fullWidth
              />
              <TextField
                select
                size="small"
                label="UF"
                value={a.state || ''}
                onChange={(e) => patch(a.id, { state: e.target.value })}
                disabled={disabled}
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
            <TextField
              size="small"
              label="Observações"
              placeholder="Ponto de referência, horário para entrega, portão…"
              value={a.notes || ''}
              onChange={(e) => patch(a.id, { notes: e.target.value.slice(0, 200) })}
              disabled={disabled}
              fullWidth
            />
          </Stack>
        </Box>
      ))}
      {list.length < MAX_ADDRESSES ? (
        <Button
          startIcon={<IconMapPinPlus size={16} />}
          onClick={() => onChange([...list, emptyAddress(!list.length)])}
          disabled={disabled}
          sx={{ alignSelf: 'flex-start', fontWeight: 700, textTransform: 'none' }}
        >
          Adicionar endereço
        </Button>
      ) : (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Limite de {MAX_ADDRESSES} endereços por cliente.
        </Typography>
      )}
    </Stack>
  );
}
