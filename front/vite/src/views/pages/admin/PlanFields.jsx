// =============================================================================
// PlanFields — editor de plano da CONTA (preço em centavos + período) e
// helpers de formatação/status de acesso compartilhados por Usuários e
// Pagamentos (Administração).
// =============================================================================
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import { useEffect, useState } from 'react';

import { IconInfinity, IconCalendarRepeat, IconReceipt2 } from '@tabler/icons-react';

// ------------------------------------------------------------------ helpers
export const fmtBRL = (cents) => ((Number(cents) || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const fmtDate = (v) => {
  if (!v) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(v));
  } catch {
    return '—';
  }
};
export const fmtDateTime = (v) => {
  if (!v) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(v));
  } catch {
    return '—';
  }
};
const ddmm = (v) => {
  if (!v) return '';
  try {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(v));
  } catch {
    return '';
  }
};

/** "R$ 97,00 / 30 dias" | "R$ 497,00 · vitalício" | "Grátis" */
export function planLabel(priceCents, periodDays) {
  const p = Number(priceCents) || 0;
  if (p <= 0) return 'Grátis';
  const d = periodDays == null ? null : Number(periodDays);
  return d && d > 0 ? `${fmtBRL(p)} / ${d} dias` : `${fmtBRL(p)} · vitalício`;
}

/** Frase-resumo ao vivo do plano (usada abaixo do editor). */
export function planSummary(priceCents, periodDays) {
  const p = Number(priceCents) || 0;
  if (p <= 0) return 'Gratuito · sem cobrança';
  const d = periodDays == null ? null : Number(periodDays);
  return d && d > 0 ? `${fmtBRL(p)} a cada ${d} dias · cobra no primeiro login` : `${fmtBRL(p)} · pagamento único (vitalício)`;
}

/** Pill de status efetivo da conta (`access.status`). */
const ACCESS_STATUS = {
  FREE: { label: 'Grátis', color: 'default' },
  PENDING: { label: 'Aguardando pagamento', color: 'warning' },
  ACTIVE: { label: 'Ativo', color: 'success' },
  EXPIRED: { label: 'Vencido', color: 'error' },
  BLOCKED: { label: 'Bloqueado', color: 'default' }
};
export function accessStatusLabel(access) {
  const s = ACCESS_STATUS[access?.status] || { label: access?.status || '—', color: 'default' };
  if (access?.status === 'ACTIVE') {
    const until = access?.lifetime || !access?.access_until ? '' : ddmm(access.access_until);
    return until ? `Ativo · até ${until}` : 'Ativo · vitalício';
  }
  return s.label;
}
export function AccessPill({ access, size = 'small' }) {
  const st = access?.status;
  const cfg = ACCESS_STATUS[st] || { label: st || '—', color: 'default' };
  const label = accessStatusLabel(access);
  const soon = st === 'ACTIVE' && access?.expiring_soon && access?.days_left != null;
  const tip =
    st === 'ACTIVE' && access?.access_until
      ? `Acesso até ${fmtDateTime(access.access_until)}${access?.days_left != null ? ` · ${access.days_left} dia(s) restante(s)` : ''}`
      : st === 'PENDING'
        ? 'Nunca pagou — verá a tela de pagamento no próximo login'
        : st === 'EXPIRED'
          ? `Venceu em ${fmtDate(access?.access_until)}`
          : st === 'BLOCKED'
            ? 'Bloqueado manualmente pela administração'
            : '';
  const chip = (
    <Chip
      size={size}
      label={label}
      color={cfg.color}
      variant={cfg.color === 'default' ? 'outlined' : 'filled'}
      sx={{ fontWeight: 700, ...(st === 'BLOCKED' ? { color: 'text.secondary', borderStyle: 'dashed' } : {}) }}
    />
  );
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" useFlexGap flexWrap="wrap">
      {tip ? (
        <Tooltip title={tip} arrow>
          <span>{chip}</span>
        </Tooltip>
      ) : (
        chip
      )}
      {soon ? (
        <Chip
          size="small"
          color="warning"
          variant="outlined"
          label={access.days_left <= 0 ? 'vence hoje' : `vence em ${access.days_left} dia${access.days_left === 1 ? '' : 's'}`}
          sx={{ height: 20, fontSize: 10.5, fontWeight: 700 }}
        />
      ) : null}
    </Stack>
  );
}

// ------------------------------------------------------------------ MoneyField
// Campo "estilo caixa eletrônico": o usuário digita só números e o valor vai
// se formando da direita pra esquerda (1 → 0,01; 9700 → 97,00). Valor em CENTAVOS.
export function MoneyField({ valueCents, onChange, label = 'Preço', helperText, autoFocus, disabled, size = 'small' }) {
  const n = Number(valueCents) || 0;
  const display = n === 0 ? '' : fmtBRL(n).replace(/^R\$\s?/, '');
  return (
    <TextField
      size={size}
      fullWidth
      label={label}
      value={display}
      placeholder="0,00"
      autoFocus={autoFocus}
      disabled={disabled}
      onChange={(e) => {
        const digits = String(e.target.value || '')
          .replace(/\D+/g, '')
          .slice(0, 9);
        // teto do backend: R$ 100.000,00
        onChange(digits ? Math.min(parseInt(digits, 10), 10_000_000) : 0);
      }}
      InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
      inputProps={{ inputMode: 'numeric' }}
      helperText={helperText ?? 'Digite só os números: 9700 vira R$ 97,00 · 0 = gratuito'}
    />
  );
}

// ------------------------------------------------------------------ PlanFields
const QUICK_DAYS = [30, 90, 180, 365];

/**
 * props: priceCents:number, periodDays:number|null, onChange({price_cents, period_days, period_invalid}), disabled?
 * period_days null = vitalício. O modo de cobrança (vitalício × período) é estado LOCAL:
 * limpar o campo "Dias" NÃO vira vitalício — emite period_days:null + period_invalid:true
 * (o pai desabilita Salvar/Criar enquanto `period_invalid`). Só o toggle emite vitalício.
 */
export default function PlanFields({ priceCents, periodDays, onChange, disabled = false, dense = false }) {
  const [mode, setMode] = useState(periodDays != null ? 'period' : 'lifetime');
  // se o pai passar um período válido (ex.: plano carregado depois do mount), garante o modo "período"
  useEffect(() => {
    if (periodDays != null) setMode('period');
  }, [periodDays]);

  const lifetime = mode === 'lifetime';
  const price = Number(priceCents) || 0;
  const daysNum = periodDays == null ? null : Number(periodDays) > 0 ? Number(periodDays) : null;
  const days = lifetime ? '' : (daysNum ?? '');
  const periodInvalid = !lifetime && daysNum == null;

  const emit = (patch, nextMode = mode) => {
    const next = { price_cents: price, period_days: nextMode === 'lifetime' ? null : daysNum, ...patch };
    onChange({ ...next, period_invalid: nextMode === 'period' && next.period_days == null });
  };

  return (
    <Stack spacing={dense ? 1.25 : 1.75}>
      <MoneyField valueCents={price} onChange={(c) => emit({ price_cents: c })} disabled={disabled} />

      <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 0.75 }}>
          Cobrança
        </Typography>
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          color="primary"
          disabled={disabled}
          value={lifetime ? 'lifetime' : 'period'}
          onChange={(_e, v) => {
            if (!v || v === mode) return;
            setMode(v);
            if (v === 'lifetime') emit({ period_days: null }, 'lifetime');
            else emit({ period_days: daysNum ?? 30 }, 'period');
          }}
          sx={{ '& .MuiToggleButton-root': { fontWeight: 700, textTransform: 'none', gap: 0.75, py: 0.75 } }}
        >
          <ToggleButton value="lifetime">
            <IconInfinity size={16} stroke={2} /> Vitalício
          </ToggleButton>
          <ToggleButton value="period">
            <IconCalendarRepeat size={16} stroke={2} /> Por período
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {!lifetime ? (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
          <TextField
            size="small"
            type="number"
            label="Dias"
            value={days}
            disabled={disabled}
            onChange={(e) => {
              const v = parseInt(String(e.target.value || '').replace(/\D+/g, ''), 10);
              // campo vazio/0 continua montado (modo período) e sinaliza inválido — não vira vitalício
              emit({ period_days: Number.isFinite(v) && v > 0 ? Math.min(v, 3650) : null });
            }}
            error={periodInvalid}
            helperText={periodInvalid ? 'Informe os dias' : undefined}
            inputProps={{ min: 1, max: 3650, inputMode: 'numeric' }}
            sx={{ width: { xs: '100%', sm: 130 }, flex: '0 0 auto' }}
          />
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            {QUICK_DAYS.map((d) => {
              const on = daysNum === d;
              return (
                <Chip
                  key={d}
                  label={`${d} dias`}
                  size="small"
                  clickable={!disabled}
                  disabled={disabled}
                  color={on ? 'primary' : 'default'}
                  variant={on ? 'filled' : 'outlined'}
                  onClick={() => emit({ period_days: d })}
                  sx={{ fontWeight: 700 }}
                />
              );
            })}
          </Stack>
        </Stack>
      ) : null}

      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={(t) => ({
          px: 1.5,
          py: 1,
          borderRadius: 2,
          bgcolor: price > 0 ? `rgba(${t.vars.palette.primary.mainChannel} / 0.08)` : 'action.hover',
          color: price > 0 ? 'primary.main' : 'text.secondary'
        })}
      >
        <IconReceipt2 size={17} stroke={1.9} />
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {periodInvalid && price > 0
            ? `${fmtBRL(price)} a cada — dias · informe o período`
            : planSummary(price, lifetime ? null : daysNum)}
        </Typography>
      </Stack>
    </Stack>
  );
}

// ===== Estender dias =====
export function ExtendDialog({ open, orgName, loading, onClose, onSubmit }) {
  const [days, setDays] = useState(30);
  useEffect(() => {
    if (open) setDays(30);
  }, [open]);
  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (days >= 1 && days <= 3650) onSubmit(days);
        }}
      >
        <DialogTitle>Estender acesso</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Conta <strong>{orgName}</strong>. Os dias são somados ao vencimento atual (ou a partir de hoje, se já venceu).
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                autoFocus
                size="small"
                type="number"
                label="Dias"
                value={days || ''}
                onChange={(e) => {
                  const v = parseInt(String(e.target.value || '').replace(/\D+/g, ''), 10);
                  // clamp 0..3650 (0 = vazio); confirmar exige 1..3650
                  setDays(Number.isFinite(v) ? Math.min(3650, Math.max(0, v)) : 0);
                }}
                error={days > 3650}
                inputProps={{ min: 1, max: 3650, inputMode: 'numeric' }}
                sx={{ width: 120 }}
              />
              {[7, 15, 30, 90].map((d) => (
                <Chip
                  key={d}
                  label={`+${d}`}
                  size="small"
                  clickable
                  variant={days === d ? 'filled' : 'outlined'}
                  color={days === d ? 'primary' : 'default'}
                  onClick={() => setDays(d)}
                  sx={{ fontWeight: 700 }}
                />
              ))}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={loading || days < 1 || days > 3650}>
            Estender
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
