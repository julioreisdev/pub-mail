import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  IconAlarm,
  IconCircleDot,
  IconClockExclamation,
  IconHourglass,
  IconListDetails,
  IconRefresh,
  IconSettings,
  IconTicket,
  IconUserCheck,
  IconUserQuestion
} from '@tabler/icons-react';

import { get } from 'api/api';
import { useAuth } from 'contexts/AuthContext';
import { useRealtimeEvent } from 'realtime/useRealtime';
import { TgCard } from 'views/pages/telegram/ui';
import { WaPageHeader, useWaSessions } from './waKit';
import { useSessionFilter, waPrimaryBtn } from './crm/crmKit';
import { HIDE_SCROLL } from './chat/chatKit';
import TicketQueue, { DEFAULT_FILTERS } from './tickets/TicketQueue';
import TicketDrawer from './tickets/TicketDrawer';
import NewTicketDialog from './tickets/NewTicketDialog';
import TicketSettings from './tickets/TicketSettings';
import { API, useTicketBase } from './tickets/ticketKit';

// ============================================================================
// WhatsApp → Chamados (Fase 6B): fila com prazo (SLA), KPIs clicáveis que aplicam
// filtros, gaveta do chamado (`?ticket=<id>` abre direto — link das notificações),
// novo chamado e Configurações (dono/admin, `?view=settings`).
// Tempo real `wa:ticket` (agrupado) + reserva por polling de 60 s.
// ============================================================================

const KPIS = [
  { key: 'open', label: 'Abertos', icon: IconCircleDot, color: '#2563EB', dark: '#60A5FA', filter: { status: 'open' } },
  { key: 'pending', label: 'Aguardando cliente', icon: IconHourglass, color: '#B45309', dark: '#FBBF24', filter: { status: 'pending' } },
  {
    key: 'overdue',
    label: 'Vencidos',
    icon: IconClockExclamation,
    color: '#DC2626',
    dark: '#F87171',
    filter: { status: 'active', sla: 'overdue' }
  },
  {
    key: 'due_soon',
    label: 'Vencem em breve',
    icon: IconAlarm,
    color: '#B45309',
    dark: '#FBBF24',
    filter: { status: 'active', sla: 'due_soon' }
  },
  {
    key: 'mine',
    label: 'Meus (ativos)',
    icon: IconUserCheck,
    color: '#128C7E',
    dark: '#25D366',
    filter: { status: 'active', assigned: 'me' }
  },
  {
    key: 'unassigned',
    label: 'Sem responsável',
    icon: IconUserQuestion,
    color: '#7C3AED',
    dark: '#A78BFA',
    filter: { status: 'active', assigned: 'none' }
  }
];
const kpiFilters = (k) => ({ ...DEFAULT_FILTERS, ...k.filter });
const sameFilters = (a, b) => Object.keys(DEFAULT_FILTERS).every((k) => (a[k] || '') === (b[k] || ''));

function TicketKpi({ kpi, value, active, onClick }) {
  const Icon = kpi.icon;
  return (
    <TgCard
      onClick={onClick}
      sx={{
        px: 1.75,
        py: 1.25,
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        minWidth: 0,
        ...(active ? { borderColor: kpi.color, boxShadow: `0 0 0 1px ${kpi.color}` } : {})
      }}
    >
      <Box
        sx={(t) => ({
          width: 36,
          height: 36,
          borderRadius: 2,
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          color: kpi.color,
          bgcolor: `${kpi.color}1F`,
          ...t.applyStyles('dark', { color: kpi.dark, bgcolor: `${kpi.dark}26` })
        })}
      >
        <Icon size={19} stroke={1.9} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 20, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
          {value == null ? '—' : Number(value).toLocaleString('pt-BR')}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.25, display: 'block', overflowWrap: 'break-word' }}>
          {kpi.label}
        </Typography>
      </Box>
    </TgCard>
  );
}

export default function WhatsAppTickets() {
  const { user } = useAuth();
  const canEdit = ['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(user?.user?.role);
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'settings' && canEdit ? 'settings' : 'queue';
  const ticketId = params.get('ticket') || '';
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

  const { categories, categoryLabel, assignees, setSettings, reload: reloadBase } = useTicketBase();
  const { sessions } = useWaSessions(60000);
  const { value: sessionId, set: setSessionId, multi } = useSessionFilter(sessions);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [counts, setCounts] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [drawerRow, setDrawerRow] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const seq = useRef(0);
  const rtTimer = useRef(null);

  const loadCounts = useCallback(async () => {
    const s = ++seq.current;
    try {
      const r = await get(`${API}/counts`);
      if (s === seq.current) setCounts(r || {});
    } catch {
      /* KPIs ficam com o último valor */
    }
  }, []);
  useEffect(() => {
    loadCounts();
  }, [loadCounts, reloadToken]);

  // reserva: polling de 60 s com a aba visível
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') setReloadToken((k) => k + 1);
    }, 60000);
    return () => window.clearInterval(id);
  }, []);

  // tempo real: agrupa rajadas
  useRealtimeEvent('wa:ticket', () => {
    window.clearTimeout(rtTimer.current);
    rtTimer.current = window.setTimeout(() => setReloadToken((k) => k + 1), 500);
  });
  useEffect(() => () => window.clearTimeout(rtTimer.current), []);

  const openTicket = (t) => {
    setDrawerRow(t);
    setUrl({ ticket: t.id });
  };
  const closeDrawer = useCallback(() => {
    setDrawerRow(null);
    setUrl({ ticket: '' });
  }, [setUrl]);

  const applyKpi = (k) => {
    const next = kpiFilters(k);
    setFilters((cur) => (sameFilters(cur, next) ? DEFAULT_FILTERS : next));
    if (view !== 'queue') setUrl({ view: '' });
  };

  return (
    <Box>
      <WaPageHeader
        icon={IconTicket}
        title="Chamados"
        subtitle="Protocolos abertos pelo bot, pelo painel ou pela API — com prazo (SLA), responsável e respostas pelo WhatsApp."
        sx={{ mb: 2 }}
        action={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Tooltip title="Atualizar">
              <IconButton
                onClick={() => {
                  reloadBase();
                  setReloadToken((k) => k + 1);
                }}
              >
                <IconRefresh size={18} />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              disableElevation
              startIcon={<IconTicket size={18} />}
              onClick={() => setNewOpen(true)}
              disabled={!categories.some((c) => c.active !== false)}
              sx={waPrimaryBtn}
            >
              Novo chamado
            </Button>
          </Stack>
        }
      />

      <Box
        sx={{
          display: 'grid',
          gap: 1.25,
          mb: 2,
          gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', sm: 'repeat(3, minmax(0,1fr))', lg: 'repeat(6, minmax(0,1fr))' }
        }}
      >
        {KPIS.map((k) => (
          <TicketKpi
            key={k.key}
            kpi={k}
            value={counts ? (counts[k.key] ?? 0) : null}
            active={view === 'queue' && sameFilters(filters, kpiFilters(k))}
            onClick={() => applyKpi(k)}
          />
        ))}
      </Box>

      <Tabs
        value={view}
        onChange={(_, v) => setUrl({ view: v === 'queue' ? '' : v })}
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
        <Tab value="queue" icon={<IconListDetails size={16} />} iconPosition="start" label="Fila" />
        {canEdit ? <Tab value="settings" icon={<IconSettings size={16} />} iconPosition="start" label="Configurações" /> : null}
      </Tabs>

      {view === 'settings' ? (
        <TicketSettings
          canEdit={canEdit}
          assignees={assignees}
          onSaved={(r) => {
            if (r && typeof r === 'object') setSettings(r);
            setReloadToken((k) => k + 1);
          }}
        />
      ) : (
        <TicketQueue
          filters={filters}
          setFilters={setFilters}
          sessions={sessions}
          sessionId={sessionId}
          setSessionId={setSessionId}
          multi={multi}
          categories={categories}
          assignees={assignees}
          onOpen={openTicket}
          reloadToken={reloadToken}
        />
      )}

      <TicketDrawer
        ticketId={ticketId}
        initial={drawerRow && drawerRow.id === ticketId ? drawerRow : null}
        onClose={closeDrawer}
        onChanged={() => setReloadToken((k) => k + 1)}
        categories={categories}
        categoryLabel={categoryLabel}
        assignees={assignees}
      />
      <NewTicketDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(t) => {
          setReloadToken((k) => k + 1);
          if (t?.id) openTicket(t);
        }}
        categories={categories}
        assignees={assignees}
      />
    </Box>
  );
}
