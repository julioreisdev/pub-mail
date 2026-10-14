import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { IconExternalLink, IconShoppingCartPlus } from '@tabler/icons-react';

import { get } from 'api/api';
import { useRealtimeEvent } from 'realtime/useRealtime';
import { TgListSkeleton } from 'views/pages/telegram/ui';
import { waPrimaryBtn } from '../crm/crmKit';
import { SectionLabel } from '../tickets/ticketKit';
import OrderCard from './OrderCard';
import OrderDrawer from './OrderDrawer';
import NewOrderDialog from './NewOrderDialog';
import { API, OPEN_STATUSES, useOrderBase } from './orderKit';

// ============================================================================
// Aba "Pedidos" do painel da conversa: pedidos do contato desta conversa (em
// todos os números) via GET /whatsapp/orders/by-chat/:chatUuid, separados em
// em aberto e anteriores, + "Novo pedido" com a conversa já preenchida. Clique
// abre a mesma gaveta da página de Pedidos.
// ============================================================================

export default function ChatOrdersTab({ chat, customer, open }) {
  const navigate = useNavigate();
  const { settings, units, fields } = useOrderBase();
  const [items, setItems] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const seq = useRef(0);
  const rtTimer = useRef(null);
  const chatId = chat?.chat_id || null; // uuid da conversa

  const load = useCallback(async () => {
    if (!chatId) {
      setItems([]);
      return;
    }
    const s = ++seq.current;
    try {
      const r = await get(`${API}/by-chat/${encodeURIComponent(chatId)}`);
      if (s === seq.current) setItems(r?.items || []);
    } catch {
      if (s === seq.current) setItems([]);
    }
  }, [chatId]);
  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useRealtimeEvent('wa:order', (p) => {
    const o = p?.order;
    if (!o || !open) return;
    const mine =
      (chatId && o.chat_id === chatId) || (customer?.id && o.customer?.id === customer.id) || (items || []).some((x) => x.id === o.id);
    if (!mine) return;
    window.clearTimeout(rtTimer.current);
    rtTimer.current = window.setTimeout(() => load(), 400);
  });
  useEffect(() => () => window.clearTimeout(rtTimer.current), []);

  const { active, past } = useMemo(() => {
    const list = items || [];
    return { active: list.filter((o) => OPEN_STATUSES.includes(o.status)), past: list.filter((o) => !OPEN_STATUSES.includes(o.status)) };
  }, [items]);

  const prefill = useMemo(
    () => ({
      chat: chatId ? { chat_id: chatId, name: chat?.name, phone: chat?.phone, session: chat?.session || null } : undefined,
      customer: customer
        ? { id: customer.id, name: customer.name, phone: customer.phone, addresses: customer.addresses, unit_id: customer.unit_id }
        : undefined
    }),
    [chatId, chat?.name, chat?.phone, chat?.session, customer]
  );

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <SectionLabel sx={{ flex: 1 }}>Em aberto</SectionLabel>
        <Button
          size="small"
          variant="contained"
          disableElevation
          startIcon={<IconShoppingCartPlus size={14} />}
          onClick={() => setNewOpen(true)}
          disabled={!chatId || settings?.enabled === false}
          sx={{ ...waPrimaryBtn, py: 0.25 }}
        >
          Novo pedido
        </Button>
      </Stack>
      {items === null ? (
        <TgListSkeleton rows={3} />
      ) : (
        <>
          {active.length ? (
            <Stack spacing={0.75}>
              {active.map((o) => (
                <OrderCard key={o.id} o={o} onClick={() => setDrawer(o)} showStatus dense />
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {settings?.enabled === false ? 'Pedidos estão desligados nas configurações.' : 'Nenhum pedido em aberto.'}
            </Typography>
          )}
          <SectionLabel sx={{ mt: 2.5, mb: 1 }}>Anteriores</SectionLabel>
          {past.length ? (
            <Stack spacing={0.75}>
              {past.slice(0, 20).map((o) => (
                <OrderCard key={o.id} o={o} onClick={() => setDrawer(o)} showStatus dense />
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Sem pedidos anteriores.
            </Typography>
          )}
          <Button
            size="small"
            endIcon={<IconExternalLink size={14} />}
            onClick={() => navigate('/whatsapp/orders')}
            sx={{ mt: 1.5, fontWeight: 700, textTransform: 'none' }}
          >
            Abrir pedidos
          </Button>
        </>
      )}

      <OrderDrawer
        orderId={drawer?.id || ''}
        initial={drawer}
        onClose={() => setDrawer(null)}
        onChanged={() => load()}
        fields={fields}
        units={units}
      />
      <NewOrderDialog
        open={newOpen}
        prefill={prefill}
        onClose={() => setNewOpen(false)}
        onCreated={(o) => {
          load();
          if (o?.id) setDrawer(o);
        }}
        settings={settings}
        units={units}
        fields={fields}
      />
    </Box>
  );
}
