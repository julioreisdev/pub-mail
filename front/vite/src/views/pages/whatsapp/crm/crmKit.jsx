import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { IconAlertTriangle, IconCircleCheck, IconCircleDashed, IconUserOff, IconX } from '@tabler/icons-react';

import { TgCard } from 'views/pages/telegram/ui';
import { WA_DARK, WA_GREEN, tint } from '../waShared';
import { WaNumberChip, WaNumberSelect, sessionLabel } from '../waKit';

// ============================================================================
// Kit do CRM do WhatsApp (Produtos, Clientes, painel "Cliente" no chat):
// opções de cobrança, dinheiro, situação de cobrança, KPI.
// ============================================================================

export const BILLING_OPTIONS = [
  { value: 'once', label: 'Avulso', short: ' · avulso' },
  { value: 'monthly', label: 'Mensal', short: '/mês' },
  { value: 'quarterly', label: 'Trimestral', short: '/trim.' },
  { value: 'yearly', label: 'Anual', short: '/ano' }
];
export const billingLabel = (v) => BILLING_OPTIONS.find((o) => o.value === v)?.label || v || '';
export const billingShort = (v) => BILLING_OPTIONS.find((o) => o.value === v)?.short || '';
export const isRecurring = (v) => v === 'monthly' || v === 'quarterly' || v === 'yearly';

export const formatBRL = (cents) => (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const fmtDateBR = (iso) => {
  if (!iso) return '';
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split('-');
  return y && m && d ? `${d}/${m}/${y}` : s;
};
export const todayIso = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

export const fmtDoc = (doc) => {
  const d = String(doc || '').replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return doc || '';
};
export const fmtCep = (z) => {
  const d = String(z || '').replace(/\D/g, '');
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : z || '';
};

// ----------------------------------------------------------------------------
// Dinheiro: digita só números, formata como caixa eletrônico (1990 → R$ 19,90)
// ----------------------------------------------------------------------------
export function MoneyField({ valueCents, onChange, label = 'Valor', size = 'small', helperText, autoFocus, disabled, sx }) {
  const display = (Number(valueCents) || 0) === 0 ? '' : formatBRL(valueCents).replace(/^R\$\s?/, '');
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
          .slice(0, 10);
        onChange(digits ? parseInt(digits, 10) : 0);
      }}
      InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
      inputProps={{ inputMode: 'numeric' }}
      helperText={helperText}
      sx={sx}
    />
  );
}

// ----------------------------------------------------------------------------
// Situação de cobrança do cliente / assinatura
// ----------------------------------------------------------------------------
export const BILLING_STATUS = {
  ok: { label: 'Em dia', icon: IconCircleCheck, color: '#128C7E', dark: '#25D366', token: 'success' },
  overdue: { label: 'Em atraso', icon: IconAlertTriangle, color: '#B45309', dark: '#FBBF24', token: 'warning' },
  none: { label: 'Sem assinatura', icon: IconCircleDashed, color: '#64748B', dark: '#94A3B8', token: 'info' },
  inactive: { label: 'Inativo', icon: IconUserOff, color: '#64748B', dark: '#94A3B8', token: 'info' }
};
export const SUB_STATUS = {
  active: { label: 'Ativa', token: 'success', color: '#128C7E', dark: '#25D366' },
  overdue: { label: 'Em atraso', token: 'warning', color: '#B45309', dark: '#FBBF24' },
  paused: { label: 'Pausada', token: 'info', color: '#2563EB', dark: '#60A5FA' },
  canceled: { label: 'Cancelada', token: 'info', color: '#64748B', dark: '#94A3B8' }
};

export function StatusChip({ map = BILLING_STATUS, status, size = 'sm', label, sx }) {
  const s = map[status] || map.none || { label: status, color: '#64748B', dark: '#94A3B8', token: 'info' };
  const Icon = s.icon;
  return (
    <Chip
      size="small"
      icon={Icon ? <Icon size={13} /> : undefined}
      label={label || s.label}
      sx={[
        (t) => ({
          height: size === 'md' ? 24 : 20,
          fontSize: size === 'md' ? 12 : 11,
          fontWeight: 700,
          borderRadius: 1.5,
          color: s.color,
          bgcolor: tint(t, s.token, 0.12),
          '& .MuiChip-icon': { color: s.color },
          ...t.applyStyles('dark', { color: s.dark, '& .MuiChip-icon': { color: s.dark } })
        }),
        ...(Array.isArray(sx) ? sx : [sx])
      ]}
    />
  );
}

/** Texto curto da situação: "vence em 3 dias", "venceu há 2 dias", "vence hoje". */
export const dueText = (days) => {
  if (days == null) return '';
  if (days === 0) return 'vence hoje';
  if (days > 0) return `vence em ${days} dia${days === 1 ? '' : 's'}`;
  const n = Math.abs(days);
  return `venceu há ${n} dia${n === 1 ? '' : 's'}`;
};

// ----------------------------------------------------------------------------
// KPI (mesmo desenho dos Contatos)
// ----------------------------------------------------------------------------
export function CrmKpi({ icon: Icon, label, value, accent, hint }) {
  return (
    <TgCard hover={false} sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 2,
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          color: accent ? '#fff' : WA_DARK,
          background: accent ? `linear-gradient(135deg, ${WA_GREEN}, ${WA_DARK})` : (t) => tint(t, 'success', 0.14)
        }}
      >
        <Icon size={20} stroke={1.9} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 20, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }} noWrap>
          {value == null ? '—' : typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.25 }} display="block" title={hint}>
          {label}
        </Typography>
      </Box>
    </TgCard>
  );
}

export const waPrimaryBtn = { fontWeight: 700, textTransform: 'none', borderRadius: 2, bgcolor: WA_GREEN, '&:hover': { bgcolor: WA_DARK } };

/** `true` em celular (abaixo de `sm`): tabelas viram cards, diálogos viram tela cheia. */
export function useXs() {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down('sm'));
}

// ----------------------------------------------------------------------------
// CrmModal — mesmo desenho do TgModal (header/footer sticky), mas em CELULAR vira
// tela cheia e os botões do rodapé ocupam a largura toda (2 por linha; o 3º/único
// ocupa a linha inteira). Usado em todos os diálogos do módulo WhatsApp.
// ----------------------------------------------------------------------------
export function CrmModal({ open, onClose, title, subtitle, tabs, footer, maxWidth = 'sm', children, disableClose, contentSx }) {
  const xs = useXs();
  return (
    <Dialog
      open={open}
      onClose={() => !disableClose && onClose?.()}
      maxWidth={maxWidth}
      fullWidth
      fullScreen={xs}
      PaperProps={{ sx: { borderRadius: xs ? 0 : 3, overflow: 'hidden' } }}
    >
      <Box
        sx={{
          px: { xs: 2, sm: 3 },
          pt: { xs: 1.75, sm: 2.25 },
          pb: tabs ? 0 : { xs: 1.5, sm: 2 },
          borderBottom: '1px solid',
          borderColor: 'divider',
          position: 'sticky',
          top: 0,
          zIndex: 2,
          bgcolor: 'background.paper'
        }}
      >
        <Stack direction="row" alignItems="flex-start" spacing={1}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }} noWrap>
              {title}
            </Typography>
            {subtitle ? (
              <Typography variant="caption" component="div" sx={{ color: 'text.secondary', mt: 0.25 }}>
                {subtitle}
              </Typography>
            ) : null}
          </Box>
          <IconButton size="small" onClick={() => onClose?.()} disabled={disableClose} sx={{ mt: -0.5, mr: -0.5, p: 1 }}>
            <IconX size={18} />
          </IconButton>
        </Stack>
        {tabs ? <Box sx={{ mt: 1 }}>{tabs}</Box> : null}
      </Box>

      <DialogContent sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 2.5 }, ...contentSx }}>{children}</DialogContent>

      {footer ? (
        <DialogActions
          sx={{
            px: { xs: 2, sm: 3 },
            py: { xs: 1.5, sm: 1.75 },
            gap: 1,
            flexWrap: 'wrap',
            borderTop: '1px solid',
            borderColor: 'divider',
            position: 'sticky',
            bottom: 0,
            bgcolor: 'background.paper',
            '& > :not(style) ~ :not(style)': { ml: 0 },
            ...(xs
              ? {
                  pb: 'calc(12px + env(safe-area-inset-bottom))',
                  '& > .MuiButton-root': { flex: '1 1 calc(50% - 8px)', minHeight: 44, mr: '0 !important', ml: '0 !important' },
                  '& > .MuiButton-root:nth-of-type(3)': { flexBasis: '100%' }
                }
              : {})
          }}
        >
          {footer}
        </DialogActions>
      ) : null}
    </Dialog>
  );
}

// ----------------------------------------------------------------------------
// Multi-número (CRM): filtro "Número" persistido em ?session=, chips e links.
// A conversa é sempre identificada pelo uuid (`chat_id`); o jid fica em `jid`.
// ----------------------------------------------------------------------------

/** URL da conversa no Chat (`chat_id` = uuid da conversa). */
export const chatUrl = (chatId) => `/whatsapp/chat?chat=${encodeURIComponent(chatId)}`;

/**
 * Filtro por número persistido na URL (`?session=<id>`; vazio = todos).
 * Só vale um id que exista na lista (`sessions`); id desconhecido conta como "todos".
 * Devolve { value, set, multi } — `multi` = a org tem mais de um número (quando mostrar filtro/chips).
 */
export function useSessionFilter(sessions = []) {
  const [params, setParams] = useSearchParams();
  const raw = params.get('session') || '';
  const value = useMemo(() => (raw && sessions.some((s) => s.id === raw) ? raw : ''), [raw, sessions]);
  const set = useCallback(
    (id) =>
      setParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          if (id) n.set('session', id);
          else n.delete('session');
          return n;
        },
        { replace: true }
      ),
    [setParams]
  );
  return { value, set, multi: sessions.length > 1 };
}

/** Select "Número" com "Todos os números" — só aparece quando a org tem mais de um número. */
export function WaNumberFilter({ sessions = [], value, onChange, label = 'Número', sx, size = 'small' }) {
  if (sessions.length < 2) return null;
  return (
    <WaNumberSelect
      sessions={sessions}
      value={value}
      onChange={onChange}
      allowAll
      label={label}
      size={size}
      fullWidth={false}
      sx={{ minWidth: { xs: 0, md: 200 }, width: { xs: '100%', md: 'auto' }, ...sx }}
    />
  );
}

/**
 * Chips dos números em que o cliente tem conversa (`customer.chats[]`, mais recente primeiro).
 * Mostra até `max` + "+N". `onPick(chat)` torna cada chip clicável (abrir a conversa daquele número).
 */
export function CustomerNumberChips({ chats = [], byId, max = 3, onPick, size = 'small', sx }) {
  const list = (chats || []).filter((c) => c?.session_id);
  if (!list.length) return null;
  const shown = list.slice(0, max);
  const rest = list.length - shown.length;
  const sessionOf = (c) => c.session || byId?.get?.(c.session_id) || { id: c.session_id, label: 'Número' };
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap sx={sx}>
      {shown.map((c) => (
        <WaNumberChip
          key={c.chat_id || c.session_id}
          session={sessionOf(c)}
          size={size}
          onClick={
            onPick
              ? (e) => {
                  e.stopPropagation();
                  onPick(c);
                }
              : undefined
          }
        />
      ))}
      {rest > 0 ? (
        <Tooltip
          title={list
            .slice(max)
            .map((c) => sessionLabel(sessionOf(c)))
            .join(', ')}
        >
          <Chip size="small" label={`+${rest}`} sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />
        </Tooltip>
      ) : null}
    </Stack>
  );
}
