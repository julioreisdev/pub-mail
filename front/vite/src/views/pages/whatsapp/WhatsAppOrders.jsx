import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  IconClockDollar,
  IconInbox,
  IconLayoutKanban,
  IconListDetails,
  IconRefresh,
  IconSettings,
  IconShoppingBag,
  IconShoppingCartPlus,
  IconToolsKitchen2,
  IconTruckDelivery
} from '@tabler/icons-react';

import { get } from 'api/api';
import { useAuth } from 'contexts/AuthContext';
import { useRealtimeEvent } from 'realtime/useRealtime';
import { TgCard } from 'views/pages/telegram/ui';
import { WaPageHeader, useWaSessions } from './waKit';
import { WaNumberFilter, todayIso, useSessionFilter, waPrimaryBtn } from './crm/crmKit';
import { HIDE_SCROLL } from './chat/chatKit';
import OrderBoard from './orders/OrderBoard';
import OrderList, { DEFAULT_FILTERS } from './orders/OrderList';
import OrderDrawer from './orders/OrderDrawer';
import NewOrderDialog from './orders/NewOrderDialog';
import OrderSettings from './orders/OrderSettings';
import { API, useOrderBase } from './orders/orderKit';

// ============================================================================
// WhatsApp → Pedidos (Fase 7, contrato §11.3): quadro por status, lista com
// filtros, gaveta do pedido (`?order=<id>` abre direto — link das notificações),
// novo pedido e Configurações (dono/admin). Abas em `?view=list|settings`.
// Tempo real `wa:order` (agrupado) + reserva por polling de 60 s.
// ============================================================================

const KPIS = [
  {
    key: 'open',
    label: 'Em aberto',
    icon: IconShoppingBag,
    color: '#2563EB',
    dark: '#60A5FA',
    filter: () => ({ status: 'open' })
  },
  {
    key: 'today',
    label: 'Recebidos hoje',
    icon: IconInbox,
    color: '#128C7E',
    dark: '#25D366',
    filter: () => ({ status: 'all', from: todayIso(), to: todayIso() })
  },
  {
    key: 'unpaid',
    label: 'Aguardando pagamento',
    icon: IconClockDollar,
    color: '#B45309',
    dark: '#FBBF24',
    filter: () => ({ status: 'open', payment_status: 'pending' })
  },
  {
    key: 'preparing',
    label: 'Em preparo',
    icon: IconToolsKitchen2,
    color: '#7C3AED',
    dark: '#A78BFA',
    filter: () => ({ status: 'preparing' })
  },
  {
    key: 'out_for_delivery',
    label: 'Saiu para entrega',
    icon: IconTruckDelivery,
    color: '#0E7490',
    dark: '#22D3EE',
    filter: () => ({ status: 'out_for_delivery' })
  }
];
const sameFilters = (a, b) => Object.keys(DEFAULT_FILTERS).every((k) => (a[k] || '') === (b[k] || ''));

function OrderKpi({ kpi, value, sub, active, onClick }) {
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
        {sub ? (
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.25, display: 'block' }}>
            {sub}
          </Typography>
        ) : null}
      </Box>
    </TgCard>
  );
}

export default function WhatsAppOrders() {
  const { user } = useAuth();
  const canEdit = ['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(user?.user?.role);
  const [params, setParams] = useSearchParams();
  const rawView = params.get('view');
  const view = rawView === 'settings' && canEdit ? 'settings' : rawView === 'list' ? 'list' : 'board';
  const orderId = params.get('order') || '';
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

  const { settings, setSettings, units, fields, reload: reloadBase } = useOrderBase();
  const { sessions } = useWaSessions(60000);
  const { value: sessionId, set: setSessionId, multi } = useSessionFilter(sessions);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [boardUnit, setBoardUnit] = useState('');
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
  useRealtimeEvent('wa:order', () => {
    window.clearTimeout(rtTimer.current);
    rtTimer.current = window.setTimeout(() => setReloadToken((k) => k + 1), 500);
  });
  useEffect(() => () => window.clearTimeout(rtTimer.current), []);

  const openOrder = (o) => {
    setDrawerRow(o);
    setUrl({ order: o.id });
  };
  const closeDrawer = useCallback(() => {
    setDrawerRow(null);
    setUrl({ order: '' });
  }, [setUrl]);

  const kpiFilters = (k) => ({ ...DEFAULT_FILTERS, ...k.filter() });
  const applyKpi = (k) => {
    const next = kpiFilters(k);
    setFilters((cur) => (view === 'list' && sameFilters(cur, next) ? DEFAULT_FILTERS : next));
    if (view !== 'list') setUrl({ view: 'list' });
  };

  const kpiSub = (k) => (k.key === 'today' && counts?.today_cents ? counts.today_label : '');

  return (
    <Box>
      <WaPageHeader
        icon={IconShoppingBag}
        title="Pedidos"
        subtitle="Pedidos feitos pelo bot, pelo painel ou pela API — do recebimento à entrega, com PIX ou pagamento na entrega."
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
              startIcon={<IconShoppingCartPlus size={18} />}
              onClick={() => setNewOpen(true)}
              disabled={settings?.enabled === false}
              sx={waPrimaryBtn}
            >
              Novo pedido
            </Button>
          </Stack>
        }
      />

      <Box
        sx={{
          display: 'grid',
          gap: 1.25,
          mb: 2,
          gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', sm: 'repeat(3, minmax(0,1fr))', lg: 'repeat(5, minmax(0,1fr))' }
        }}
      >
        {KPIS.map((k) => (
          <OrderKpi
            key={k.key}
            kpi={k}
            value={counts ? (counts[k.key] ?? 0) : null}
            sub={kpiSub(k)}
            active={view === 'list' && sameFilters(filters, kpiFilters(k))}
            onClick={() => applyKpi(k)}
          />
        ))}
      </Box>

      <Tabs
        value={view}
        onChange={(_, v) => setUrl({ view: v === 'board' ? '' : v })}
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
        <Tab value="board" icon={<IconLayoutKanban size={16} />} iconPosition="start" label="Quadro" />
        <Tab value="list" icon={<IconListDetails size={16} />} iconPosition="start" label="Lista" />
        {canEdit ? <Tab value="settings" icon={<IconSettings size={16} />} iconPosition="start" label="Configurações" /> : null}
      </Tabs>

      {view === 'settings' ? (
        <OrderSettings
          canEdit={canEdit}
          onSaved={(r) => {
            if (r && typeof r === 'object') setSettings(r);
            setReloadToken((k) => k + 1);
          }}
        />
      ) : view === 'list' ? (
        <OrderList
          filters={filters}
          setFilters={setFilters}
          sessions={sessions}
          sessionId={sessionId}
          setSessionId={setSessionId}
          multi={multi}
          units={units}
          onOpen={openOrder}
          reloadToken={reloadToken}
        />
      ) : (
        <>
          {multi || units.length ? (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mb: 1.5 }} alignItems={{ sm: 'center' }}>
              <WaNumberFilter sessions={sessions} value={sessionId} onChange={setSessionId} />
              {units.length ? (
                <TextField
                  select
                  size="small"
                  label="Unidade"
                  value={boardUnit}
                  onChange={(e) => setBoardUnit(e.target.value)}
                  sx={{ minWidth: { sm: 200 } }}
                >
                  <MenuItem value="">Todas as unidades</MenuItem>
                  {units.map((u) => (
                    <MenuItem key={u.id} value={u.id}>
                      {u.name}
                    </MenuItem>
                  ))}
                </TextField>
              ) : null}
            </Stack>
          ) : null}
          <OrderBoard
            sessionId={sessionId}
            unitId={boardUnit}
            reloadToken={reloadToken}
            onOpen={openOrder}
            onChanged={() => loadCounts()}
            multi={multi}
          />
        </>
      )}

      <OrderDrawer
        orderId={orderId}
        initial={drawerRow && drawerRow.id === orderId ? drawerRow : null}
        onClose={closeDrawer}
        onChanged={() => setReloadToken((k) => k + 1)}
        fields={fields}
        units={units}
      />
      <NewOrderDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(o) => {
          setReloadToken((k) => k + 1);
          if (o?.id) openOrder(o);
        }}
        settings={settings}
        units={units}
        fields={fields}
      />
    </Box>
  );
}
