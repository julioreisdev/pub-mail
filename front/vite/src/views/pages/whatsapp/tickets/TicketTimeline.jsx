import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  IconAlarm,
  IconArrowsExchange,
  IconCategory,
  IconClockExclamation,
  IconFlag,
  IconLock,
  IconMessageCircle,
  IconPencil,
  IconRefresh,
  IconTicket,
  IconUserCheck
} from '@tabler/icons-react';

import { fmtDateTime } from '../waShared';
import { MediaList } from './ticketMedia';
import { priorityOf, statusOf, SOURCE_LABEL } from './ticketKit';

// ============================================================================
// Linha do tempo do chamado (GET /whatsapp/tickets/:id/events): cada tipo de evento
// tem um desenho próprio — mudanças viram linhas discretas com ícone; nota interna
// = cartão amarelado; resposta ao cliente = balão verde à direita ("Enviado ao
// cliente"); mensagem do cliente = balão à esquerda; prazo = linha âmbar/vermelha.
// ============================================================================

const BY_LABEL = { staff: 'Equipe', customer: 'Cliente', system: 'Sistema', bot: 'Bot', api: 'API' };
const who = (e) => e?.user?.name || BY_LABEL[e?.by] || 'Sistema';

/** Linha discreta de mudança (ícone + frase + hora). */
function ChangeLine({ icon: Icon, children, time, tone }) {
  return (
    <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ px: 0.5 }}>
      <Box
        sx={(t) => ({
          width: 24,
          height: 24,
          borderRadius: '50%',
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          color: tone ? t.vars.palette[tone].main : t.vars.palette.text.secondary,
          bgcolor: tone ? `rgba(${t.vars.palette[tone].mainChannel} / 0.14)` : 'action.hover'
        })}
      >
        <Icon size={14} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, pt: 0.25 }}>
        <Typography variant="body2" sx={{ color: tone ? `${tone}.main` : 'text.secondary', overflowWrap: 'anywhere', lineHeight: 1.45 }}>
          {children}
        </Typography>
      </Box>
      <Typography variant="caption" sx={{ color: 'text.disabled', flexShrink: 0, pt: 0.4, whiteSpace: 'nowrap' }}>
        {fmtDateTime(time)}
      </Typography>
    </Stack>
  );
}

const B = ({ children }) => (
  <Box component="strong" sx={{ fontWeight: 700, color: 'text.primary' }}>
    {children}
  </Box>
);

/** Balão / cartão com corpo de texto e mídia. */
function Bubble({ align = 'left', variant, title, time, body, media }) {
  const styles = {
    internal: (t) => ({
      bgcolor: '#FEF9C3',
      borderColor: '#FDE68A',
      ...t.applyStyles('dark', { bgcolor: 'rgba(250, 204, 21, 0.10)', borderColor: 'rgba(250, 204, 21, 0.32)' })
    }),
    public: (t) => ({
      bgcolor: '#D9FDD3',
      borderColor: '#B7E8AE',
      ...t.applyStyles('dark', { bgcolor: '#005C4B', borderColor: '#00715C', color: '#E9EDEF' })
    }),
    customer: () => ({ bgcolor: 'background.paper', borderColor: 'divider' })
  };
  return (
    <Box sx={{ display: 'flex', justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
      <Box
        sx={[
          {
            maxWidth: variant === 'internal' ? '100%' : '88%',
            width: variant === 'internal' ? '100%' : 'auto',
            minWidth: 0,
            border: '1px solid',
            borderRadius: 2.5,
            px: 1.5,
            py: 1,
            ...(align === 'right' ? { borderTopRightRadius: 6 } : { borderTopLeftRadius: 6 })
          },
          styles[variant]
        ]}
      >
        <Stack direction="row" spacing={1} alignItems="baseline" sx={{ mb: body || media ? 0.5 : 0 }}>
          <Typography variant="caption" sx={{ fontWeight: 800, flex: 1, minWidth: 0, color: 'inherit', opacity: 0.85 }} noWrap>
            {title}
          </Typography>
          <Typography variant="caption" sx={{ color: 'inherit', opacity: 0.6, flexShrink: 0, whiteSpace: 'nowrap' }}>
            {fmtDateTime(time)}
          </Typography>
        </Stack>
        {body ? (
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: 'inherit' }}>
            {body}
          </Typography>
        ) : null}
        {media ? (
          <Box sx={{ mt: body ? 1 : 0 }}>
            <MediaList media={[media]} size={120} />
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}

export default function TicketTimeline({ events = [], categoryLabel = (k) => k, customerName }) {
  if (!events.length) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary', px: 0.5 }}>
        Nenhum evento ainda.
      </Typography>
    );
  }
  return (
    <Stack spacing={1.25}>
      {events.map((e) => {
        const k = e.kind;
        if (k === 'comment') {
          const pub = e.visibility === 'public';
          return (
            <Bubble
              key={e.id}
              align={pub ? 'right' : 'left'}
              variant={pub ? 'public' : 'internal'}
              title={pub ? `Enviado ao cliente · ${who(e)}` : `Nota interna · ${who(e)}`}
              time={e.created_at}
              body={e.body}
              media={e.media}
            />
          );
        }
        if (k === 'customer_message') {
          return (
            <Bubble
              key={e.id}
              align="left"
              variant="customer"
              title={`${customerName || 'Cliente'}${e.by === 'bot' ? ' · pelo bot' : ''}`}
              time={e.created_at}
              body={e.body}
              media={e.media}
            />
          );
        }
        if (k === 'created') {
          return (
            <ChangeLine key={e.id} icon={IconTicket} time={e.created_at} tone="primary">
              Chamado aberto
              {e.by === 'customer' || e.by === 'bot' ? ' pelo cliente (bot)' : e.by === 'api' ? ' pela API' : ` por ${who(e)}`}
            </ChangeLine>
          );
        }
        if (k === 'status') {
          const to = statusOf(e.to);
          return (
            <ChangeLine key={e.id} icon={k === 'status' && e.to === 'closed' ? IconLock : IconArrowsExchange} time={e.created_at}>
              <B>{who(e)}</B> mudou a situação: {statusOf(e.from).label} → <B>{to.label}</B>
            </ChangeLine>
          );
        }
        if (k === 'reopened') {
          return (
            <ChangeLine key={e.id} icon={IconRefresh} time={e.created_at} tone="info">
              {e.by === 'customer' || e.by === 'bot' ? (
                'Reaberto pela mensagem do cliente'
              ) : (
                <>
                  Reaberto por <B>{who(e)}</B>
                </>
              )}{' '}
              ({statusOf(e.from).label} → {statusOf(e.to).label})
            </ChangeLine>
          );
        }
        if (k === 'assigned') {
          return (
            <ChangeLine key={e.id} icon={IconUserCheck} time={e.created_at}>
              <B>{who(e)}</B> {e.to ? 'atribuiu a ' : 'tirou o responsável'}
              {e.to ? <B>{e.to_label || '—'}</B> : null}
              {e.from_label ? ` (antes: ${e.from_label})` : ''}
            </ChangeLine>
          );
        }
        if (k === 'priority') {
          return (
            <ChangeLine key={e.id} icon={IconFlag} time={e.created_at}>
              <B>{who(e)}</B> mudou a prioridade: {priorityOf(e.from).label} → <B>{priorityOf(e.to).label}</B>
            </ChangeLine>
          );
        }
        if (k === 'category') {
          return (
            <ChangeLine key={e.id} icon={IconCategory} time={e.created_at}>
              <B>{who(e)}</B> mudou a categoria: {categoryLabel(e.from)} → <B>{categoryLabel(e.to)}</B>
            </ChangeLine>
          );
        }
        if (k === 'subject') {
          return (
            <ChangeLine key={e.id} icon={IconPencil} time={e.created_at}>
              <B>{who(e)}</B> mudou o assunto para “{e.to || '—'}”
            </ChangeLine>
          );
        }
        if (k === 'sla_warning') {
          return (
            <ChangeLine key={e.id} icon={IconAlarm} time={e.created_at} tone="warning">
              O prazo de solução está perto de vencer
            </ChangeLine>
          );
        }
        if (k === 'sla_breached') {
          return (
            <ChangeLine key={e.id} icon={IconClockExclamation} time={e.created_at} tone="error">
              O prazo de solução venceu
            </ChangeLine>
          );
        }
        return (
          <ChangeLine key={e.id} icon={IconMessageCircle} time={e.created_at}>
            {e.body || k} {e.by ? `· ${SOURCE_LABEL[e.by] || who(e)}` : ''}
          </ChangeLine>
        );
      })}
    </Stack>
  );
}
