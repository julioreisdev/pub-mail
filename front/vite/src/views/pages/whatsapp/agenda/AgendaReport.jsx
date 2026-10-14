import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Chart from 'react-apexcharts';

import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { IconCalendarEvent, IconCash, IconChartBar, IconClockHour4, IconUserX, IconX } from '@tabler/icons-react';

import { get } from 'api/api';
import { TgCard, TgEmptyState, TgListSkeleton } from 'views/pages/telegram/ui';
import { WA_DARK, WA_GREEN } from '../waShared';
import { CrmKpi, formatBRL } from '../crm/crmKit';
import { API, apptErr } from './agendaKit';

// ============================================================================
// Métricas → aba Agenda: ocupação por recurso, receita por serviço, taxas de falta e
// cancelamento, ticket médio e horários de pico (GET /whatsapp/scheduling/report).
// `from`/`to` = 'YYYY-MM-DD' (Brasília), vindos do filtro de período da página.
// ============================================================================

const pct = (v) => {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v) <= 1 ? Number(v) * 100 : Number(v);
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
};
const ratio = (v) => (v == null ? 0 : Number(v) <= 1 ? Number(v) : Number(v) / 100);

function Section({ title, icon: Icon, children }) {
  return (
    <TgCard hover={false} sx={{ p: 0, overflow: 'hidden', minWidth: 0 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
        {Icon ? <Icon size={18} color={WA_DARK} /> : null}
        <Typography variant="subtitle2" sx={{ fontWeight: 800, flex: 1 }}>
          {title}
        </Typography>
      </Stack>
      {children}
    </TgCard>
  );
}

export default function AgendaReport({ from, to, reloadKey = 0 }) {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  const axisColor = dark ? '#94A3B8' : '#64748B';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);

  useEffect(() => {
    const s = ++seq.current;
    setLoading(true);
    get(`${API}/report`, {
      params: { from: new Date(`${from}T00:00:00-03:00`).toISOString(), to: new Date(`${to}T23:59:59.999-03:00`).toISOString() }
    })
      .then((r) => s === seq.current && setData(r || {}))
      .catch((e) => {
        if (s !== seq.current) return;
        toast.error(apptErr(e, 'Falha ao carregar o relatório da agenda.'));
        setData((d) => d || {});
      })
      .finally(() => s === seq.current && setLoading(false));
  }, [from, to, reloadKey]);

  const byResource = useMemo(() => data?.by_resource || [], [data]);
  const byService = useMemo(() => data?.by_service || [], [data]);
  const peaks = useMemo(() => {
    const map = new Map((data?.peak_hours || []).map((p) => [Number(p.hour), p.count]));
    const hours = [...map.keys()];
    if (!hours.length) return [];
    const min = Math.min(...hours);
    const max = Math.max(...hours);
    return Array.from({ length: max - min + 1 }, (_, i) => ({ hour: min + i, count: map.get(min + i) || 0 }));
  }, [data]);

  const baseOpts = useMemo(
    () => ({
      chart: { toolbar: { show: false }, fontFamily: 'inherit', background: 'transparent' },
      theme: { mode: dark ? 'dark' : 'light' },
      grid: { borderColor: dark ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.15)', strokeDashArray: 3 },
      tooltip: { theme: dark ? 'dark' : 'light' },
      legend: { show: false }
    }),
    [dark]
  );
  const occOptions = useMemo(
    () => ({
      ...baseOpts,
      colors: byResource.map((r) => r.resource?.color || WA_GREEN),
      plotOptions: { bar: { horizontal: true, distributed: true, borderRadius: 4, barHeight: '60%' } },
      dataLabels: { enabled: true, formatter: (v) => `${Math.round(v)}%`, style: { colors: [dark ? '#fff' : '#0f172a'] } },
      xaxis: {
        categories: byResource.map((r) => r.resource?.name || 'Recurso'),
        max: 100,
        labels: { style: { colors: axisColor }, formatter: (v) => `${Math.round(v)}%` }
      },
      yaxis: { labels: { style: { colors: axisColor } } },
      tooltip: {
        ...baseOpts.tooltip,
        y: {
          formatter: (v, { dataPointIndex }) => {
            const r = byResource[dataPointIndex];
            return r
              ? `${Math.round(v)}% · ${Math.round((r.booked_minutes || 0) / 60)} h de ${Math.round((r.available_minutes || 0) / 60)} h`
              : `${v}%`;
          }
        }
      }
    }),
    [baseOpts, byResource, axisColor, dark]
  );
  const revOptions = useMemo(
    () => ({
      ...baseOpts,
      colors: [WA_DARK],
      plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '60%' } },
      dataLabels: { enabled: false },
      xaxis: {
        categories: byService.map((s) => s.service?.name || s.service_name || s.name || 'Serviço'),
        labels: { style: { colors: axisColor }, formatter: (v) => formatBRL(Number(v) * 100).replace(',00', '') }
      },
      yaxis: { labels: { style: { colors: axisColor } } },
      tooltip: {
        ...baseOpts.tooltip,
        y: {
          formatter: (v, { dataPointIndex }) => {
            const s = byService[dataPointIndex];
            return `${formatBRL(Number(v) * 100)}${s ? ` · ${s.count} agendamento${s.count === 1 ? '' : 's'}` : ''}`;
          }
        }
      }
    }),
    [baseOpts, byService, axisColor]
  );
  const peakOptions = useMemo(
    () => ({
      ...baseOpts,
      colors: ['#3B82F6'],
      plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
      dataLabels: { enabled: false },
      xaxis: { categories: peaks.map((p) => `${String(p.hour).padStart(2, '0')}h`), labels: { style: { colors: axisColor } } },
      yaxis: { labels: { style: { colors: axisColor } } }
    }),
    [baseOpts, peaks, axisColor]
  );

  if (loading && !data)
    return (
      <TgCard hover={false} sx={{ p: 2 }}>
        <TgListSkeleton rows={6} />
      </TgCard>
    );
  const t = data?.totals || {};
  const count = t.appointments ?? t.count ?? t.total;
  const empty = !count && !byResource.length && !byService.length;
  if (empty)
    return (
      <TgEmptyState
        icon={IconCalendarEvent}
        title="Sem agendamentos no período"
        description="Quando houver agendamentos (pelo bot, painel ou API), a ocupação, a receita e as faltas aparecem aqui."
      />
    );

  return (
    <Stack spacing={2}>
      {loading ? <LinearProgress color="success" sx={{ borderRadius: 1 }} /> : null}
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', md: 'repeat(4, minmax(0,1fr))' },
          '& .MuiTypography-caption': { whiteSpace: 'normal', overflowWrap: 'break-word', lineHeight: 1.3 }
        }}
      >
        <CrmKpi
          icon={IconCalendarEvent}
          label={`Agendamentos${t.done != null ? ` · ${Number(t.done).toLocaleString('pt-BR')} concluídos` : ''}`}
          value={count ?? null}
          accent
        />
        <CrmKpi
          icon={IconCash}
          label={`Ticket médio${t.revenue_cents != null ? ` · receita ${formatBRL(t.revenue_cents)}` : ''}`}
          value={data?.avg_ticket_cents != null ? formatBRL(data.avg_ticket_cents) : null}
        />
        <CrmKpi icon={IconUserX} label="Taxa de faltas" value={pct(data?.no_show_rate)} />
        <CrmKpi icon={IconX} label="Taxa de cancelamento" value={pct(data?.cancel_rate)} />
      </Box>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'repeat(2, minmax(0,1fr))' } }}>
        <Section title="Ocupação por recurso" icon={IconChartBar}>
          {byResource.length ? (
            <Box sx={{ p: 1 }}>
              <Chart
                type="bar"
                height={Math.max(180, byResource.length * 44 + 60)}
                options={occOptions}
                series={[{ name: 'Ocupação', data: byResource.map((r) => Math.round(ratio(r.occupancy) * 1000) / 10) }]}
              />
            </Box>
          ) : (
            <Typography variant="body2" sx={{ p: 2, color: 'text.secondary' }}>
              Sem recursos com horário no período.
            </Typography>
          )}
        </Section>
        <Section title="Receita por serviço" icon={IconCash}>
          {byService.length ? (
            <Box sx={{ p: 1 }}>
              <Chart
                type="bar"
                height={Math.max(180, byService.length * 44 + 60)}
                options={revOptions}
                series={[{ name: 'Receita', data: byService.map((s) => (s.revenue_cents || 0) / 100) }]}
              />
            </Box>
          ) : (
            <Typography variant="body2" sx={{ p: 2, color: 'text.secondary' }}>
              Sem receita de agendamentos no período.
            </Typography>
          )}
        </Section>
      </Box>
      <Section title="Horários de pico" icon={IconClockHour4}>
        {peaks.length ? (
          <Box sx={{ p: 1 }}>
            <Chart type="bar" height={240} options={peakOptions} series={[{ name: 'Agendamentos', data: peaks.map((p) => p.count) }]} />
          </Box>
        ) : (
          <Typography variant="body2" sx={{ p: 2, color: 'text.secondary' }}>
            Sem dados de horário no período.
          </Typography>
        )}
      </Section>
    </Stack>
  );
}
