import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { IconExternalLink, IconTicket } from '@tabler/icons-react';

import { get } from 'api/api';
import { useRealtimeEvent } from 'realtime/useRealtime';
import { TgListSkeleton } from 'views/pages/telegram/ui';
import { useNow } from '../waKit';
import { waPrimaryBtn } from '../crm/crmKit';
import TicketCard from './TicketCard';
import TicketDrawer from './TicketDrawer';
import NewTicketDialog from './NewTicketDialog';
import { API, SectionLabel, useTicketBase } from './ticketKit';

// ============================================================================
// Aba "Chamados" do painel da conversa: chamados do contato desta conversa (em
// todos os números) via GET /whatsapp/tickets/by-chat/:chatUuid, separados em
// ativos e anteriores, + "Abrir chamado" com a conversa já preenchida. Clique abre
// a mesma gaveta da página de Chamados.
// ============================================================================

export default function ChatTicketsTab({ chat, customer, open }) {
  const navigate = useNavigate();
  const now = useNow(60000);
  const { categories, categoryLabel, assignees } = useTicketBase();
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

  useRealtimeEvent('wa:ticket', (p) => {
    const t = p?.ticket;
    if (!t || !open) return;
    const mine =
      (chatId && t.chat_id === chatId) || (customer?.id && t.customer?.id === customer.id) || (items || []).some((x) => x.id === t.id);
    if (!mine) return;
    window.clearTimeout(rtTimer.current);
    rtTimer.current = window.setTimeout(() => load(), 400);
  });
  useEffect(() => () => window.clearTimeout(rtTimer.current), []);

  const { active, past } = useMemo(() => {
    const list = items || [];
    return {
      active: list.filter((t) => t.status === 'open' || t.status === 'pending'),
      past: list.filter((t) => t.status !== 'open' && t.status !== 'pending')
    };
  }, [items]);

  const prefill = useMemo(
    () => ({
      chat: chatId ? { chat_id: chatId, name: chat?.name, phone: chat?.phone, session: chat?.session || null } : undefined,
      customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone } : undefined
    }),
    [chatId, chat?.name, chat?.phone, chat?.session, customer]
  );
  const isGroup = String(chat?.jid || '').endsWith('@g.us') || chat?.kind === 'group';

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <SectionLabel sx={{ flex: 1 }}>Em andamento</SectionLabel>
        <Button
          size="small"
          variant="contained"
          disableElevation
          startIcon={<IconTicket size={14} />}
          onClick={() => setNewOpen(true)}
          disabled={!chatId || isGroup || !categories.some((c) => c.active !== false)}
          sx={{ ...waPrimaryBtn, py: 0.25 }}
        >
          Abrir chamado
        </Button>
      </Stack>
      {isGroup ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Chamados são só para conversas individuais.
        </Typography>
      ) : items === null ? (
        <TgListSkeleton rows={3} />
      ) : (
        <>
          {active.length ? (
            <Stack spacing={0.75}>
              {active.map((t) => (
                <TicketCard key={t.id} t={t} now={now} onClick={() => setDrawer(t)} showCustomer={false} dense />
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Nenhum chamado em andamento.
            </Typography>
          )}
          <SectionLabel sx={{ mt: 2.5, mb: 1 }}>Anteriores</SectionLabel>
          {past.length ? (
            <Stack spacing={0.75}>
              {past.slice(0, 20).map((t) => (
                <TicketCard key={t.id} t={t} now={now} onClick={() => setDrawer(t)} showCustomer={false} dense />
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Sem chamados anteriores.
            </Typography>
          )}
          <Button
            size="small"
            endIcon={<IconExternalLink size={14} />}
            onClick={() => navigate('/whatsapp/tickets')}
            sx={{ mt: 1.5, fontWeight: 700, textTransform: 'none' }}
          >
            Abrir a fila de chamados
          </Button>
        </>
      )}

      <TicketDrawer
        ticketId={drawer?.id || ''}
        initial={drawer}
        onClose={() => setDrawer(null)}
        onChanged={() => load()}
        categories={categories}
        categoryLabel={categoryLabel}
        assignees={assignees}
      />
      <NewTicketDialog
        open={newOpen}
        prefill={prefill}
        onClose={() => setNewOpen(false)}
        onCreated={(t) => {
          load();
          if (t?.id) setDrawer(t);
        }}
        categories={categories}
        assignees={assignees}
      />
    </Box>
  );
}
