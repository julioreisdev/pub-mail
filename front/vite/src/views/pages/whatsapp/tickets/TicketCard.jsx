import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { WaNumberChip } from '../waKit';
import { fmtAgo, fmtPhone } from '../waShared';
import {
  AssigneeBadge,
  PriorityChip,
  ProtocolText,
  SlaChip,
  TicketStatusChip,
  statusOf,
  ticketPersonName,
  ticketPersonPhone
} from './ticketKit';

// ============================================================================
// Cartão do chamado (fila no celular e aba "Chamados" da conversa): faixa da cor
// da situação, protocolo copiável + prazo, assunto, cliente, chips.
// ============================================================================

export default function TicketCard({ t, onClick, now, showCustomer = true, showSession = false, dense = false }) {
  const st = statusOf(t.status);
  const person = ticketPersonName(t);
  const phone = ticketPersonPhone(t);
  return (
    <ButtonBase
      component="div"
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
      <Box
        sx={(th) => ({ width: 4, borderRadius: 2, flexShrink: 0, bgcolor: st.color, ...th.applyStyles('dark', { bgcolor: st.dark }) })}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <ProtocolText protocol={t.protocol} />
          </Box>
          <SlaChip ticket={t} now={now} />
        </Stack>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 700,
            mt: 0.25,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            overflowWrap: 'anywhere'
          }}
        >
          {t.subject}
        </Typography>
        {showCustomer ? (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }} noWrap>
            {person || fmtPhone(phone) || 'Sem contato'}
            {person && phone ? ` · ${fmtPhone(phone)}` : ''}
          </Typography>
        ) : null}
        <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
          <TicketStatusChip status={t.status} />
          <PriorityChip priority={t.priority} />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }} noWrap>
            {t.category_label}
          </Typography>
          {showSession && t.session ? <WaNumberChip session={t.session} /> : null}
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75, minWidth: 0 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <AssigneeBadge assigned={t.assigned} size={20} />
          </Box>
          <Typography variant="caption" sx={{ color: 'text.disabled', flexShrink: 0 }}>
            {fmtAgo(t.last_event_at || t.updated_at || t.created_at)}
          </Typography>
        </Stack>
      </Box>
    </ButtonBase>
  );
}
