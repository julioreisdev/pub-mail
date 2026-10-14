import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { WaNumberChip } from '../waKit';
import { formatBRL } from '../crm/crmKit';
import { ApptStatusChip, brtParts, dayLabel, statusOf, timeOf } from './agendaKit';

// ============================================================================
// Linha compacta de agendamento (Hoje, Lista no celular, aba Agenda da conversa).
// Faixa colorida da situação à esquerda; hora grande; cliente, serviço, recurso.
// ============================================================================

export default function ApptRow({ a, onClick, showDay = false, showCustomer = true, showSession = false, dense = false }) {
  const st = statusOf(a.status);
  const day = a.starts_at ? brtParts(a.starts_at).day : '';
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        width: '100%',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'stretch',
        gap: 1.25,
        p: dense ? 1 : 1.25,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        minWidth: 0,
        '&:hover': { bgcolor: 'action.hover' }
      }}
    >
      <Box sx={(t) => ({ width: 4, borderRadius: 2, flexShrink: 0, bgcolor: st.color, ...t.applyStyles('dark', { bgcolor: st.dark }) })} />
      <Box sx={{ flexShrink: 0, minWidth: 52 }}>
        <Typography sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
          {a.time_label || timeOf(a.starts_at)}
        </Typography>
        {showDay ? (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }} noWrap>
            {dayLabel(day)}
          </Typography>
        ) : (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            {a.end_time_label || timeOf(a.ends_at)}
          </Typography>
        )}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {showCustomer ? (
          <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
            {a.customer?.name || 'Contato sem cadastro'}
          </Typography>
        ) : null}
        <Typography
          variant={showCustomer ? 'caption' : 'body2'}
          sx={{ color: showCustomer ? 'text.secondary' : 'text.primary', fontWeight: showCustomer ? 400 : 700, display: 'block' }}
          noWrap
        >
          {a.service_name}
          {a.resource?.name ? ` · ${a.resource.name}` : ''}
        </Typography>
        <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
          <ApptStatusChip status={a.status} />
          {a.price_cents ? (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              {a.price_label || formatBRL(a.price_cents)}
            </Typography>
          ) : null}
          {showSession && a.session ? <WaNumberChip session={a.session} /> : null}
        </Stack>
      </Box>
    </ButtonBase>
  );
}
