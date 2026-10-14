import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { IconCheck } from '@tabler/icons-react';

import { post, put } from 'api/api';
import { errMsg } from '../waShared';
import { CrmModal, MoneyField, formatBRL, waPrimaryBtn } from './crmKit';

// ============================================================================
// Cupom de desconto (criar / editar) — WhatsApp → Produtos → aba Cupons.
// POST /whatsapp/coupons · PUT /whatsapp/coupons/:id
// ============================================================================

export const COUPON_DURATIONS = [
  { value: 'once', label: 'Só na 1ª cobrança' },
  { value: 'months', label: 'Por alguns meses' },
  { value: 'forever', label: 'Para sempre' }
];
export const couponDurationLabel = (c) => {
  if (!c) return '';
  if (c.duration === 'months') return `${c.months || 1} ${Number(c.months) === 1 ? 'mês' : 'meses'}`;
  return COUPON_DURATIONS.find((d) => d.value === c.duration)?.label || c.duration || '';
};

/** Resumo do desconto: "10% · 3 meses" / "R$ 20,00 · só na 1ª cobrança". */
export const couponSummary = (c) =>
  c ? `${c.value_label || (c.kind === 'percent' ? `${c.value}%` : formatBRL(c.value))} · ${couponDurationLabel(c)}` : '';

const normCode = (v) =>
  String(v || '')
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 32);

export const emptyCoupon = () => ({
  code: '',
  kind: 'percent',
  value: 10,
  duration: 'once',
  months: 3,
  max_uses: '',
  product_ids: [],
  expires_at: '',
  active: true
});

export default function CouponDialog({ open, onClose, coupon, products = [], onSaved }) {
  const [f, setF] = useState(emptyCoupon);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setBusy(false);
    setF(
      coupon
        ? {
            code: coupon.code || '',
            kind: coupon.kind || 'percent',
            value: coupon.value ?? (coupon.kind === 'fixed' ? 0 : 10),
            duration: coupon.duration || 'once',
            months: coupon.months || 3,
            max_uses: coupon.max_uses == null ? '' : String(coupon.max_uses),
            product_ids: Array.isArray(coupon.product_ids) ? coupon.product_ids : [],
            expires_at: coupon.expires_at || '',
            active: coupon.active !== false
          }
        : emptyCoupon()
    );
  }, [open, coupon]);

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    const code = normCode(f.code);
    if (code.length < 2) return toast.error('Código do cupom: 2 a 32 letras, números, "-" ou "_".');
    if (f.kind === 'percent' && !(f.value >= 1 && f.value <= 100)) return toast.error('Percentual entre 1 e 100.');
    if (f.kind === 'fixed' && !(f.value >= 1)) return toast.error('Informe o valor do desconto.');
    setBusy(true);
    try {
      const body = {
        code,
        kind: f.kind,
        value: Math.round(Number(f.value) || 0),
        duration: f.duration,
        months: f.duration === 'months' ? Math.max(1, Math.min(36, parseInt(f.months || '1', 10) || 1)) : null,
        max_uses: f.max_uses === '' ? null : Math.max(1, parseInt(f.max_uses, 10) || 1),
        product_ids: f.product_ids,
        expires_at: f.expires_at || null,
        active: Boolean(f.active)
      };
      const r = coupon?.id ? await put(`/whatsapp/coupons/${coupon.id}`, body) : await post('/whatsapp/coupons', body);
      toast.success(coupon?.id ? 'Cupom salvo.' : 'Cupom criado.');
      onSaved?.(r);
      onClose?.();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível salvar o cupom.'));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  const selected = products.filter((p) => f.product_ids.includes(p.id));

  return (
    <CrmModal
      open={open}
      onClose={() => !busy && onClose?.()}
      title={coupon?.id ? `Cupom ${coupon.code}` : 'Novo cupom'}
      subtitle="O cliente informa o código ao assinar (no painel ou pelo bot) e o desconto entra na assinatura."
      maxWidth="xs"
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
            {coupon?.id ? 'Salvar' : 'Criar cupom'}
          </Button>
        </>
      }
    >
      <Stack spacing={1.5}>
        <TextField
          size="small"
          label="Código"
          value={f.code}
          onChange={(e) => set('code', normCode(e.target.value))}
          fullWidth
          autoFocus={!coupon?.id}
          placeholder="Ex.: BEMVINDO10"
          helperText="Letras, números, - ou _. Vira maiúsculas."
          inputProps={{ style: { textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 } }}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            select
            size="small"
            label="Tipo"
            value={f.kind}
            onChange={(e) => set('kind', e.target.value)}
            sx={{ minWidth: { sm: 150 } }}
            fullWidth
          >
            <MenuItem value="percent">Percentual (%)</MenuItem>
            <MenuItem value="fixed">Valor fixo (R$)</MenuItem>
          </TextField>
          {f.kind === 'fixed' ? (
            <MoneyField label="Desconto" valueCents={f.value} onChange={(c) => set('value', c)} />
          ) : (
            <TextField
              size="small"
              type="number"
              label="Desconto"
              value={f.value}
              onChange={(e) => set('value', Math.min(100, Math.max(0, parseInt(e.target.value || '0', 10) || 0)))}
              inputProps={{ min: 1, max: 100, inputMode: 'numeric' }}
              InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
              fullWidth
            />
          )}
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField select size="small" label="Duração" value={f.duration} onChange={(e) => set('duration', e.target.value)} fullWidth>
            {COUPON_DURATIONS.map((d) => (
              <MenuItem key={d.value} value={d.value}>
                {d.label}
              </MenuItem>
            ))}
          </TextField>
          {f.duration === 'months' ? (
            <TextField
              size="small"
              type="number"
              label="Meses"
              value={f.months}
              onChange={(e) => set('months', Math.min(36, Math.max(1, parseInt(e.target.value || '1', 10) || 1)))}
              inputProps={{ min: 1, max: 36, inputMode: 'numeric' }}
              sx={{ width: { sm: 120 } }}
            />
          ) : null}
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            size="small"
            type="number"
            label="Limite de usos"
            value={f.max_uses}
            onChange={(e) => set('max_uses', e.target.value.replace(/\D/g, '').slice(0, 7))}
            inputProps={{ min: 1, inputMode: 'numeric' }}
            fullWidth
            helperText={coupon?.id && coupon.used ? `Já usado ${coupon.used}×. Vazio = ilimitado.` : 'Vazio = ilimitado'}
          />
          <TextField
            size="small"
            type="date"
            label="Válido até"
            value={f.expires_at}
            onChange={(e) => set('expires_at', e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
            helperText="Vazio = sem validade"
          />
        </Stack>
        <Autocomplete
          multiple
          size="small"
          options={products}
          value={selected}
          onChange={(_, v) =>
            set(
              'product_ids',
              v.map((p) => p.id)
            )
          }
          getOptionLabel={(p) => p.name}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          renderTags={(value, getTagProps) =>
            value.map((p, i) => <Chip size="small" label={p.name} {...getTagProps({ index: i })} key={p.id} sx={{ height: 24 }} />)
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label="Produtos em que vale"
              placeholder={selected.length ? '' : 'Todos os produtos'}
              helperText="Vazio = vale em qualquer produto"
            />
          )}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Switch size="small" checked={f.active} onChange={(e) => set('active', e.target.checked)} />
          <Typography variant="body2">{f.active ? 'Ativo — pode ser usado' : 'Inativo — recusado ao aplicar'}</Typography>
        </Box>
      </Stack>
    </CrmModal>
  );
}
