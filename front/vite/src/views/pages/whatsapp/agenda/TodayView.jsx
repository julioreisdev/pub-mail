import { useMemo } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { IconCalendarCheck, IconCalendarEvent, IconCash, IconClockHour4, IconHourglassHigh, IconUserX } from '@tabler/icons-react';

import { TgCard, TgListSkeleton } from 'views/pages/telegram/ui';
import { useNow } from '../waKit';
import { WA_DARK } from '../waShared';
import { CrmKpi } from '../crm/crmKit';
import ApptRow from './ApptRow';
import { addDaysIso, brtParts, brtToday } from './agendaKit';

// ============================================================================
// Visão "Hoje": KPIs + próximos, aguardando pagamento, não confirmados (hoje e amanhã)
// e faltas. `appointments` = hoje + amanhã; `counts` (GET appointments/counts) completa os KPIs.
// ============================================================================

function Section({ icon: Icon, title, hint, items, empty, onOpen, showDay, accent = WA_DARK }) {
  return (
    <TgCard hover={false} sx={{ p: 0, overflow: 'hidden', minWidth: 0 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Icon size={18} color={accent} />
        <Typography variant="subtitle2" sx={{ fontWeight: 800, flex: 1 }}>
          {title}
          <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ml: 0.75, fontWeight: 700 }}>
            {items.length}
          </Typography>
        </Typography>
      </Stack>
      {hint ? (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', px: 2, pt: 1 }}>
          {hint}
        </Typography>
      ) : null}
      <Stack spacing={0.75} sx={{ p: 1.5 }}>
        {items.length ? (
          items.map((a) => <ApptRow key={a.id} a={a} onClick={() => onOpen(a)} showDay={showDay} dense />)
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary', px: 0.5, py: 1 }}>
            {empty}
          </Typography>
        )}
      </Stack>
    </TgCard>
  );
}

export default function TodayView({ appointments, counts, loading, onOpen }) {
  const now = useNow(60000);
  const today = brtToday();
  const tomorrow = addDaysIso(today, 1);
  const g = useMemo(() => {
    const list = (appointments || []).slice().sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)));
    const dayOf = (a) => brtParts(a.starts_at).day;
    const todays = list.filter((a) => dayOf(a) === today);
    return {
      todays,
      next: todays.filter(
        (a) => ['booked', 'confirmed', 'in_progress'].includes(a.status) && new Date(a.ends_at || a.starts_at).getTime() >= now
      ),
      pending: list.filter((a) => a.status === 'pending_payment'),
      unconfirmed: list.filter((a) => a.status === 'booked' && !a.confirmed_at && [today, tomorrow].includes(dayOf(a))),
      noShows: todays.filter((a) => a.status === 'no_show'),
      confirmed: todays.filter((a) => a.status === 'confirmed').length,
      done: todays.filter((a) => a.status === 'done').length
    };
  }, [appointments, today, tomorrow, now]);

  if (loading && !appointments)
    return (
      <TgCard hover={false} sx={{ p: 2 }}>
        <TgListSkeleton rows={6} />
      </TgCard>
    );

  const c = counts || {};
  const num = (k, local) => (typeof c[k] === 'number' ? c[k] : local);
  const total = typeof c.total === 'number' ? c.total : g.todays.filter((a) => !['canceled', 'expired'].includes(a.status)).length;

  return (
    <Stack spacing={2}>
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', md: 'repeat(4, minmax(0,1fr))' },
          '& .MuiTypography-caption': { whiteSpace: 'normal', overflowWrap: 'break-word', lineHeight: 1.3 }
        }}
      >
        <CrmKpi icon={IconCalendarEvent} label="Agendamentos hoje" value={total} accent />
        <CrmKpi icon={IconCalendarCheck} label={`Confirmados · ${g.done} concluídos`} value={num('confirmed', g.confirmed)} />
        <CrmKpi icon={IconCash} label="Aguardando pagamento" value={num('pending_payment', g.pending.length)} />
        <CrmKpi icon={IconUserX} label="Faltas hoje" value={num('no_show', g.noShows.length)} />
      </Box>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'repeat(2, minmax(0,1fr))' } }}>
        <Section icon={IconClockHour4} title="Próximos de hoje" items={g.next} empty="Nada mais para hoje." onOpen={onOpen} />
        <Section
          icon={IconCash}
          title="Aguardando pagamento"
          hint="O horário fica reservado até o prazo de pagamento; depois disso expira e é liberado."
          items={g.pending}
          empty="Nenhuma reserva esperando pagamento."
          onOpen={onOpen}
          showDay
          accent="#B45309"
        />
        <Section
          icon={IconHourglassHigh}
          title="Não confirmados (hoje e amanhã)"
          hint="O lembrete da véspera pede a confirmação; você também pode confirmar na gaveta."
          items={g.unconfirmed}
          empty="Todos confirmados."
          onOpen={onOpen}
          showDay
          accent="#2563EB"
        />
        <Section icon={IconUserX} title="Faltas de hoje" items={g.noShows} empty="Nenhuma falta hoje." onOpen={onOpen} accent="#DC2626" />
      </Box>
    </Stack>
  );
}
