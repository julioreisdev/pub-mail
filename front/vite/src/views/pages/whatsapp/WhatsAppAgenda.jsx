import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  IconCalendarEvent,
  IconCalendarPlus,
  IconCalendarWeek,
  IconChevronLeft,
  IconChevronRight,
  IconHourglassHigh,
  IconLayoutColumns,
  IconList,
  IconRefresh,
  IconSettings,
  IconSun,
  IconUsersGroup
} from '@tabler/icons-react';

import { get, post } from 'api/api';
import { useAuth } from 'contexts/AuthContext';
import { useRealtimeEvent } from 'realtime/useRealtime';
import { TgConfirmDialog, TgEmptyState } from 'views/pages/telegram/ui';
import { WaPageHeader, asList, useWaSessions } from './waKit';
import { useXs, waPrimaryBtn } from './crm/crmKit';
import { HIDE_SCROLL } from './chat/chatKit';
import TimeGrid from './agenda/TimeGrid';
import TodayView from './agenda/TodayView';
import ListView from './agenda/ListView';
import AppointmentDrawer from './agenda/AppointmentDrawer';
import NewAppointmentDialog from './agenda/NewAppointmentDialog';
import SchedulingSettings from './agenda/SchedulingSettings';
import WaitlistTab from './agenda/WaitlistTab';
import {
  API,
  APPT_STATUS,
  StatusDot,
  addDaysIso,
  apptErr,
  brtIso,
  brtParts,
  brtToday,
  dayEndIso,
  dayLabel,
  dayLongLabel,
  dayStartIso,
  hm,
  intervalsOf,
  mondayOf,
  useSchedulingBase,
  weekdayOf,
  whenLabel
} from './agenda/agendaKit';

// ============================================================================
// WhatsApp → Agenda (Fase 6): visões Hoje / Dia (colunas por recurso) / Semana (1 recurso)
// / Lista + Lista de espera + Configurações (dono/admin). `?view=` `?date=` `?resource=`
// na URL (sempre numa única atualização). Clique = gaveta; arrastar = remarcar com
// confirmação; tempo real `wa:appointment`. Celular: Dia com 1 recurso por vez.
// ============================================================================

const VIEWS = ['today', 'day', 'week', 'list', 'waitlist', 'settings'];
const FALLBACK = { start: 7 * 60, end: 21 * 60 };
const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');

/** Faixa de horas da grade: menor início e maior fim da disponibilidade (+ agendamentos fora dela). */
function gridRange(resources, days, appts) {
  let start = Infinity;
  let end = -Infinity;
  resources.forEach((r) =>
    days.forEach((d) =>
      intervalsOf(r, weekdayOf(d)).forEach((i) => {
        start = Math.min(start, i.start);
        end = Math.max(end, i.end);
      })
    )
  );
  if (!Number.isFinite(start)) {
    start = FALLBACK.start;
    end = FALLBACK.end;
  }
  appts.forEach((a) => {
    const s = brtParts(a.starts_at);
    const e = brtParts(a.ends_at || a.starts_at);
    if (!days.includes(s.day)) return;
    start = Math.min(start, s.minutes);
    end = Math.max(end, e.day === s.day ? e.minutes : 1440);
  });
  return { start: Math.max(0, Math.floor(start / 60) * 60), end: Math.min(1440, Math.ceil(end / 60) * 60) };
}

export default function WhatsAppAgenda() {
  const navigate = useNavigate();
  const xs = useXs();
  const { user } = useAuth();
  const canEdit = ['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(user?.user?.role);
  const [params, setParams] = useSearchParams();
  const viewRaw = params.get('view');
  const view = VIEWS.includes(viewRaw) && !(viewRaw === 'settings' && !canEdit) ? viewRaw : 'today';
  const date = isDay(params.get('date')) ? params.get('date') : brtToday();
  const resourceParam = params.get('resource') || '';
  /** Uma única atualização da URL (nunca dois setSearchParams seguidos). */
  const setUrl = useCallback(
    (patch) =>
      setParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
          return n;
        },
        { replace: true }
      ),
    [setParams]
  );

  const base = useSchedulingBase();
  const { resources, services, serviceById } = base;
  const { sessions } = useWaSessions(60000);
  const [appts, setAppts] = useState(null);
  const [counts, setCounts] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [drawer, setDrawer] = useState(null);
  const [newDlg, setNewDlg] = useState(null); // null | prefill {}
  const [move, setMove] = useState(null); // {appt, target}
  const [moving, setMoving] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const seq = useRef(0);

  // recurso da Semana / do Dia no celular
  const oneResource = resources.find((r) => r.id === resourceParam) || resources[0] || null;

  const period = useMemo(() => {
    if (view === 'today') return { from: brtToday(), to: addDaysIso(brtToday(), 1) };
    if (view === 'week') {
      const mon = mondayOf(date);
      return { from: mon, to: addDaysIso(mon, 6) };
    }
    return { from: date, to: date };
  }, [view, date]);

  const loadGrid = useCallback(async () => {
    if (!['today', 'day', 'week'].includes(view)) return;
    const s = ++seq.current;
    setLoading(true);
    try {
      const params0 = {
        from: dayStartIso(period.from),
        to: dayEndIso(period.to),
        page_size: 500,
        resource_id: view === 'week' && oneResource ? oneResource.id : undefined
      };
      const [r, c, b] = await Promise.all([
        get(`${API}/appointments`, { params: params0 }),
        view === 'today' ? get(`${API}/appointments/counts`, { params: { date: brtToday() } }).catch(() => null) : Promise.resolve(null),
        view !== 'today'
          ? get(`${API}/blocks`, { params: { from: dayStartIso(period.from), to: dayEndIso(period.to) } }).catch(() => [])
          : Promise.resolve([])
      ]);
      if (s !== seq.current) return;
      setAppts(Array.isArray(r) ? r : r?.items || []);
      setCounts(c);
      setBlocks(asList(b));
    } catch (e) {
      if (s !== seq.current) return;
      toast.error(apptErr(e, 'Não foi possível carregar a agenda.'));
      setAppts((x) => x || []);
    } finally {
      if (s === seq.current) setLoading(false);
    }
  }, [view, period, oneResource]);
  useEffect(() => {
    loadGrid();
  }, [loadGrid, reloadToken]);

  // tempo real: agrupa rajadas e mantém a gaveta atualizada
  const rtTimer = useRef(null);
  useRealtimeEvent('wa:appointment', (p) => {
    const row = p?.appointment;
    if (row?.id) {
      setDrawer((d) => (d && d.id === row.id ? row : d));
      setAppts((list) => (list ? list.map((a) => (a.id === row.id ? row : a)) : list));
    }
    window.clearTimeout(rtTimer.current);
    rtTimer.current = window.setTimeout(() => setReloadToken((k) => k + 1), 500);
  });
  useEffect(() => () => window.clearTimeout(rtTimer.current), []);

  const onChanged = (row) => {
    if (row?.id) setAppts((list) => (list ? list.map((a) => (a.id === row.id ? row : a)) : list));
    setReloadToken((k) => k + 1);
  };

  const doMove = async () => {
    if (!move) return;
    setMoving(true);
    try {
      const r = await post(`${API}/appointments/${move.appt.id}/reschedule`, {
        starts_at: brtIso(move.target.day, move.target.minutes),
        resource_id: move.target.resource_id
      });
      toast.success('Agendamento remarcado. O cliente foi avisado.');
      setMove(null);
      onChanged(r?.appointment || r);
    } catch (e) {
      toast.error(apptErr(e, 'Não foi possível remarcar para esse horário.'));
    } finally {
      setMoving(false);
    }
  };

  // ---- colunas da grade
  const dayColumns = useMemo(() => {
    const list = xs ? (oneResource ? [oneResource] : []) : resources;
    return list.map((r) => ({ key: r.id, resource_id: r.id, resource: r, day: date, title: r.name, color: r.color || '#2563EB' }));
  }, [xs, oneResource, resources, date]);
  const weekColumns = useMemo(() => {
    if (!oneResource) return [];
    const mon = mondayOf(date);
    const today = brtToday();
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDaysIso(mon, i);
      return { key: d, resource_id: oneResource.id, resource: oneResource, day: d, title: dayLabel(d), highlight: d === today };
    });
  }, [oneResource, date]);
  const gridAppts = useMemo(() => appts || [], [appts]);
  const range = useMemo(() => {
    if (view === 'week')
      return gridRange(
        oneResource ? [oneResource] : [],
        weekColumns.map((c) => c.day),
        gridAppts
      );
    return gridRange(
      dayColumns.map((c) => c.resource),
      [date],
      gridAppts
    );
  }, [view, oneResource, weekColumns, dayColumns, date, gridAppts]);
  const slot = 15;

  const step = view === 'week' ? 7 : 1;
  const nav = (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
      <Stack direction="row" spacing={0.5} alignItems="center">
        <IconButton size="small" onClick={() => setUrl({ date: addDaysIso(date, -step) })} aria-label="Anterior">
          <IconChevronLeft size={18} />
        </IconButton>
        <Button
          size="small"
          variant="outlined"
          onClick={() => setUrl({ date: '' })}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
        >
          Hoje
        </Button>
        <IconButton size="small" onClick={() => setUrl({ date: addDaysIso(date, step) })} aria-label="Próximo">
          <IconChevronRight size={18} />
        </IconButton>
      </Stack>
      <TextField
        size="small"
        type="date"
        value={date}
        onChange={(e) => isDay(e.target.value) && setUrl({ date: e.target.value })}
        sx={{ width: 160 }}
      />
      <Typography sx={{ fontWeight: 800, '&::first-letter': { textTransform: 'uppercase' } }}>
        {view === 'week' ? `${dayLabel(mondayOf(date))} – ${dayLabel(addDaysIso(mondayOf(date), 6))}` : dayLongLabel(date)}
      </Typography>
      {(view === 'week' || xs) && resources.length ? (
        <TextField
          select
          size="small"
          label="Recurso"
          value={oneResource?.id || ''}
          onChange={(e) => setUrl({ resource: e.target.value })}
          sx={{ minWidth: 180, width: { xs: '100%', sm: 'auto' } }}
        >
          {resources.map((r) => (
            <MenuItem key={r.id} value={r.id}>
              {r.name}
            </MenuItem>
          ))}
        </TextField>
      ) : null}
      <Box sx={{ flex: 1 }} />
      <FormControlLabel
        control={<Switch size="small" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />}
        label={<Typography variant="body2">Cancelados e faltas</Typography>}
      />
    </Stack>
  );
  const legend = (
    <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
      {Object.entries(APPT_STATUS)
        .filter(([k]) => showClosed || !['no_show', 'canceled', 'expired'].includes(k))
        .map(([k, v]) => (
          <Stack key={k} direction="row" spacing={0.5} alignItems="center">
            <StatusDot status={k} />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {v.label}
            </Typography>
          </Stack>
        ))}
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        · Arraste um bloco para remarcar · clique num espaço vazio para agendar
      </Typography>
    </Stack>
  );

  const noResources = !base.loading && !resources.length;

  return (
    <Box>
      <WaPageHeader
        icon={IconCalendarEvent}
        title="Agenda"
        subtitle="Agendamentos dos serviços: pelo bot, pelo painel ou pela API — com cobrança, lembretes e confirmação."
        sx={{ mb: 2 }}
        action={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Tooltip title="Atualizar">
              <IconButton
                onClick={() => {
                  base.reload();
                  setReloadToken((k) => k + 1);
                }}
              >
                <IconRefresh size={18} />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={<IconUsersGroup size={18} />}
              onClick={() => navigate('/whatsapp/resources')}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
            >
              Recursos
            </Button>
            <Button
              variant="contained"
              disableElevation
              startIcon={<IconCalendarPlus size={18} />}
              onClick={() => setNewDlg({})}
              disabled={!services.length}
              sx={waPrimaryBtn}
            >
              Novo agendamento
            </Button>
          </Stack>
        }
      />

      <Tabs
        value={view}
        onChange={(_, v) => setUrl({ view: v === 'today' ? '' : v })}
        variant="scrollable"
        scrollButtons={false}
        sx={{
          mb: 2,
          minHeight: 40,
          borderBottom: '1px solid',
          borderColor: 'divider',
          '& .MuiTabs-scroller': HIDE_SCROLL,
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 40 }
        }}
      >
        <Tab value="today" icon={<IconSun size={16} />} iconPosition="start" label="Hoje" />
        <Tab value="day" icon={<IconLayoutColumns size={16} />} iconPosition="start" label="Dia" />
        <Tab value="week" icon={<IconCalendarWeek size={16} />} iconPosition="start" label="Semana" />
        <Tab value="list" icon={<IconList size={16} />} iconPosition="start" label="Lista" />
        <Tab value="waitlist" icon={<IconHourglassHigh size={16} />} iconPosition="start" label="Lista de espera" />
        {canEdit ? <Tab value="settings" icon={<IconSettings size={16} />} iconPosition="start" label="Configurações" /> : null}
      </Tabs>

      {!base.loading && !services.length && ['today', 'day', 'week'].includes(view) ? (
        <TgEmptyState
          icon={IconCalendarEvent}
          title="Nenhum serviço para agendar"
          description="Cadastre um produto do tipo Serviço (com duração) em Produtos e os profissionais/recursos que atendem, com os horários de cada um."
          action={
            <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" useFlexGap>
              <Button variant="contained" disableElevation onClick={() => navigate('/whatsapp/products')} sx={waPrimaryBtn}>
                Cadastrar serviço
              </Button>
              <Button
                variant="outlined"
                onClick={() => navigate('/whatsapp/resources')}
                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
              >
                Profissionais e recursos
              </Button>
            </Stack>
          }
          sx={{ mb: 2 }}
        />
      ) : null}

      {view === 'today' ? (
        <TodayView appointments={appts} counts={counts} loading={loading} onOpen={setDrawer} />
      ) : view === 'day' || view === 'week' ? (
        noResources ? (
          <TgEmptyState
            icon={IconUsersGroup}
            title="Nenhum profissional ou recurso"
            description="A agenda mostra uma coluna por profissional/sala/equipamento. Cadastre ao menos um, com os horários de atendimento."
            action={
              <Button variant="contained" disableElevation onClick={() => navigate('/whatsapp/resources')} sx={waPrimaryBtn}>
                Cadastrar recurso
              </Button>
            }
          />
        ) : (
          <Box>
            {nav}
            {loading ? <LinearProgress color="success" sx={{ mb: 1, borderRadius: 1 }} /> : null}
            <TimeGrid
              key={`${view}-${date}-${oneResource?.id || ''}`}
              columns={view === 'week' ? weekColumns : dayColumns}
              appointments={gridAppts}
              blocks={blocks}
              range={range}
              slot={slot}
              showClosed={showClosed}
              onOpen={setDrawer}
              onMove={(appt, target) => setMove({ appt, target })}
              onEmptyClick={(p) => setNewDlg({ resource_id: p.resource_id || undefined })}
              minColWidth={view === 'week' ? 120 : 170}
            />
            {legend}
          </Box>
        )
      ) : view === 'list' ? (
        <ListView resources={base.allResources} services={services} sessions={sessions} onOpen={setDrawer} reloadToken={reloadToken} />
      ) : view === 'waitlist' ? (
        <WaitlistTab services={services} reloadToken={reloadToken} />
      ) : (
        <SchedulingSettings canEdit={canEdit} />
      )}

      <AppointmentDrawer
        appointment={drawer}
        onClose={() => setDrawer(null)}
        onChanged={onChanged}
        serviceById={serviceById}
        resources={resources}
      />
      <NewAppointmentDialog
        open={Boolean(newDlg)}
        prefill={newDlg || undefined}
        onClose={() => setNewDlg(null)}
        onCreated={(row) => {
          onChanged(row);
          if (row?.id) setDrawer(row);
        }}
        services={services}
        resources={resources}
      />
      <TgConfirmDialog
        open={Boolean(move)}
        onClose={() => !moving && setMove(null)}
        onConfirm={doMove}
        loading={moving}
        title="Remarcar este agendamento?"
        message={
          move
            ? `${move.appt.customer?.name || 'Contato'} · ${move.appt.service_name} — de ${whenLabel(move.appt.starts_at)}${
                move.appt.resource?.name ? ` (${move.appt.resource.name})` : ''
              } para ${dayLabel(move.target.day)} · ${hm(move.target.minutes)}${
                move.target.resource_id !== move.appt.resource?.id
                  ? ` (${resources.find((r) => r.id === move.target.resource_id)?.name || 'outro recurso'})`
                  : ''
              }. O cliente recebe o aviso de remarcação; o pagamento é mantido.`
            : ''
        }
        confirmLabel="Remarcar"
        icon={IconCalendarEvent}
      />
    </Box>
  );
}
