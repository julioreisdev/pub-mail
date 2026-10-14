import { useState } from 'react';
import toast from 'react-hot-toast';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { IconCheck, IconPencil } from '@tabler/icons-react';

import { errMsg } from '../waShared';
import {
  customErrorsFrom,
  customErrorsText,
  customFormValues,
  customPayload,
  formatCustomValue,
  maskDoc,
  maskPhone,
  validateCustomLocal
} from './customFields';

export {
  useCustomFieldDefs,
  customErrorsFrom,
  customErrorsText,
  customFormValues,
  customPayload,
  validateCustomLocal,
  formatCustomValue
} from './customFields';

// ============================================================================
// Entradas dos campos personalizados (Fase 7) — um input por tipo:
// text · number · date · select · bool (switch) · phone · email · cpf (máscaras leves).
// `values` = {key: valor}; `onChange(next)` devolve o objeto inteiro; `errors` = {key: mensagem}
// (de `customErrorsFrom(e)` ou `validateCustomLocal`). Grade de 2 colunas a partir de `sm`.
// ============================================================================

export default function CustomFieldsInputs({
  defs = [],
  values = {},
  onChange,
  errors = null,
  disabled = false,
  columns = 2,
  size = 'small',
  sx
}) {
  if (!defs.length) return null;
  const set = (k, v) => onChange?.({ ...(values || {}), [k]: v });
  return (
    <Box
      sx={[
        {
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: columns > 1 ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)' }
        },
        ...(Array.isArray(sx) ? sx : [sx])
      ]}
    >
      {defs.map((d) => (
        <CustomFieldInput
          key={d.key}
          def={d}
          value={values?.[d.key]}
          error={errors?.[d.key] || ''}
          onChange={(v) => set(d.key, v)}
          disabled={disabled}
          size={size}
        />
      ))}
    </Box>
  );
}

export function CustomFieldInput({ def: d, value, error, onChange, disabled, size = 'small' }) {
  const helper = error || d.help || '';
  const common = {
    size,
    fullWidth: true,
    label: d.label,
    required: Boolean(d.required),
    error: Boolean(error),
    helperText: helper || undefined,
    disabled
  };

  if (d.type === 'bool') {
    return (
      <Box sx={{ minWidth: 0 }}>
        <FormControlLabel
          sx={{ mr: 0, minHeight: 40 }}
          control={<Switch size="small" checked={value === true} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />}
          label={
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
              {d.label}
              {d.required ? ' *' : ''}
              <Box component="span" sx={{ color: 'text.secondary', ml: 0.75 }}>
                {value === true ? 'Sim' : value === false ? 'Não' : '—'}
              </Box>
            </Typography>
          }
        />
        {helper ? (
          <FormHelperText error={Boolean(error)} sx={{ mt: -0.5, ml: 0 }}>
            {helper}
          </FormHelperText>
        ) : null}
      </Box>
    );
  }
  if (d.type === 'select') {
    return (
      <TextField select {...common} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <MenuItem value="">
          <em>—</em>
        </MenuItem>
        {(d.options || []).map((o) => (
          <MenuItem key={o} value={o}>
            {o}
          </MenuItem>
        ))}
        {value && !(d.options || []).includes(value) ? (
          <MenuItem value={value} disabled>
            {value} (fora da lista)
          </MenuItem>
        ) : null}
      </TextField>
    );
  }
  if (d.type === 'date') {
    return (
      <TextField
        {...common}
        type="date"
        value={value ? String(value).slice(0, 10) : ''}
        onChange={(e) => onChange(e.target.value)}
        InputLabelProps={{ shrink: true }}
      />
    );
  }
  if (d.type === 'number') {
    return (
      <TextField
        {...common}
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        inputProps={{ step: 'any', inputMode: 'decimal' }}
      />
    );
  }
  if (d.type === 'phone') {
    return (
      <TextField
        {...common}
        value={maskPhone(value)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 13))}
        inputProps={{ inputMode: 'tel' }}
        placeholder="(11) 99999-9999"
      />
    );
  }
  if (d.type === 'cpf') {
    return (
      <TextField
        {...common}
        value={maskDoc(value)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 14))}
        inputProps={{ inputMode: 'numeric' }}
      />
    );
  }
  if (d.type === 'email') {
    return <TextField {...common} type="email" value={value ?? ''} onChange={(e) => onChange(e.target.value.slice(0, 160))} />;
  }
  return <TextField {...common} value={value ?? ''} onChange={(e) => onChange(e.target.value.slice(0, 500))} />;
}

/** Exibição só-leitura (detalhes): rótulo + valor formatado; esconde os vazios (a menos que `showEmpty`). */
export function CustomFieldsView({ defs = [], values = {}, showEmpty = false, emptyText = 'Nenhum campo preenchido.', sx }) {
  const rows = defs.map((d) => ({ d, text: formatCustomValue(d, values?.[d.key]) })).filter((r) => showEmpty || r.text);
  if (!rows.length)
    return emptyText ? (
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {emptyText}
      </Typography>
    ) : null;
  return (
    <Box
      sx={[
        { display: 'grid', gap: 1, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' } },
        ...(Array.isArray(sx) ? sx : [sx])
      ]}
    >
      {rows.map(({ d, text }) => (
        <Box key={d.key} sx={{ minWidth: 0 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.3 }}>
            {d.label}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
            {text || '—'}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

/**
 * Bloco editável dos campos personalizados em telas de detalhe (chamado, agendamento…): mostra os valores
 * formatados; "Editar" troca para os inputs; `onSave(changed)` recebe SÓ as chaves que mudaram e deve lançar
 * o erro da API (o bloco mostra os erros por campo de `CUSTOM_REQUIRED`/`CUSTOM_INVALID`).
 */
export function CustomFieldsBlock({ defs = [], custom, canEdit = true, onSave, title, emptyText = 'Nenhum campo preenchido.' }) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({});
  const [initial, setInitial] = useState({});
  const [errors, setErrors] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!defs.length) return null;
  const start = () => {
    const v = customFormValues(defs, custom);
    setValues(v);
    setInitial(v);
    setErrors(null);
    setEditing(true);
  };
  const save = async () => {
    const changed = customPayload(defs, values, { initial, onlyTouched: true });
    if (!Object.keys(changed).length) return setEditing(false);
    let local = validateCustomLocal(defs, values, { mode: 'update' });
    if (local) {
      local = Object.fromEntries(Object.entries(local).filter(([k]) => k in changed));
      if (Object.keys(local).length) {
        setErrors(local);
        return toast.error(customErrorsText(defs, local));
      }
    }
    setBusy(true);
    try {
      await onSave?.(changed);
      setEditing(false);
    } catch (e) {
      const ce = customErrorsFrom(e);
      setErrors(ce);
      toast.error(ce ? customErrorsText(defs, ce) : errMsg(e, 'Não foi possível salvar os campos.'));
    } finally {
      setBusy(false);
    }
    return undefined;
  };
  return (
    <Stack spacing={1}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box sx={{ flex: 1, minWidth: 0 }}>{title}</Box>
        {canEdit && !editing ? (
          <Button
            size="small"
            startIcon={<IconPencil size={14} />}
            onClick={start}
            sx={{ textTransform: 'none', fontWeight: 700, minHeight: 28 }}
          >
            Editar
          </Button>
        ) : null}
      </Stack>
      {editing ? (
        <>
          <CustomFieldsInputs defs={defs} values={values} onChange={setValues} errors={errors} disabled={busy} />
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button size="small" color="inherit" onClick={() => setEditing(false)} disabled={busy} sx={{ textTransform: 'none' }}>
              Cancelar
            </Button>
            <Button
              size="small"
              variant="contained"
              disableElevation
              onClick={save}
              disabled={busy}
              startIcon={busy ? <CircularProgress size={13} color="inherit" /> : <IconCheck size={15} />}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
            >
              Salvar campos
            </Button>
          </Stack>
        </>
      ) : (
        <CustomFieldsView defs={defs} values={custom || {}} emptyText={emptyText} />
      )}
    </Stack>
  );
}
