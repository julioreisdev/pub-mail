import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { IconCalendarPlus, IconExternalLink } from '@tabler/icons-react';

import { get } from 'api/api';
import { useRealtimeEvent } from 'realtime/useRealtime';
import { TgListSkeleton } from 'views/pages/telegram/ui';
import { onlyDigits } from '../waShared';
import { waPrimaryBtn } from '../crm/crmKit';
import ApptRow from './ApptRow';
import AppointmentDrawer from './AppointmentDrawer';
import NewAppointmentDialog from './NewAppointmentDialog';
import { ACTIVE_STATUSES, API, addDaysIso, brtToday, dayStartIso, useSchedulingBase } from './agendaKit';

// ============================================================================
// Aba "Agenda" do painel da conversa: próximos e histórico do cliente (ou do contato,
// quando ainda não é cliente) + "Agendar" com o cliente/conversa já preenchidos.
// ============================================================================

export default function ChatAgendaTab({ chat, customer, open }) {
  const navigate = useNavigate();
  const base = useSchedulingBase();
  const [items, setItems] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const seq = useRef(0);
  const customerId = customer?.id || null;
  const phone = onlyDigits(chat?.phone);
  const sessionId = chat?.session_id || null;

  const load = useCallback(async () => {
    if (!customerId && !phone) {
      setItems([]);
      return;
    }
    const s = ++seq.current;
    try {
      const r = await get(`${API}/appointments`, {
        params: {
          from: dayStartIso(addDaysIso(brtToday(), -365)),
          page_size: 50,
          ...(customerId ? { customer_id: customerId } : { session_id: sessionId || undefined, q: phone })
        }
      });
      if (s === seq.current) setItems(Array.isArray(r) ? r : r?.items || []);
    } catch {
      if (s === seq.current) setItems([]);
    }
  }, [customerId, phone, sessionId]);
  useEffect(() => {
    if (open) load();
  }, [open, load]);
  useRealtimeEvent('wa:appointment', (p) => {
    const a = p?.appointment;
    if (!a) return;
    if ((customerId && a.customer?.id === customerId) || (chat?.chat_id && a.chat_id === chat.chat_id)) load();
  });

  const { upcoming, history } = useMemo(() => {
    const now = Date.now();
    const list = items || [];
    const up = list
      .filter((a) => ACTIVE_STATUSES.includes(a.status) && new Date(a.ends_at || a.starts_at).getTime() >= now)
      .sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)));
    const upIds = new Set(up.map((a) => a.id));
    const hist = list.filter((a) => !upIds.has(a.id)).sort((a, b) => String(b.starts_at).localeCompare(String(a.starts_at)));
    return { upcoming: up, history: hist };
  }, [items]);

  const prefill = useMemo(
    () => ({
      customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone } : undefined,
      chat: chat
        ? { jid: chat.jid, session_id: chat.session_id, name: chat.name, phone: chat.phone, contact_id: chat.contact_id }
        : undefined
    }),
    [customer, chat]
  );

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <Typography
          variant="caption"
          sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4, flex: 1 }}
        >
          Próximos
        </Typography>
        <Button
          size="small"
          variant="contained"
          disableElevation
          startIcon={<IconCalendarPlus size={14} />}
          onClick={() => setNewOpen(true)}
          disabled={!base.services.length}
          sx={{ ...waPrimaryBtn, py: 0.25 }}
        >
          Agendar
        </Button>
      </Stack>
      {items === null ? (
        <TgListSkeleton rows={3} />
      ) : (
        <>
          {upcoming.length ? (
            <Stack spacing={0.75}>
              {upcoming.map((a) => (
                <ApptRow key={a.id} a={a} onClick={() => setDrawer(a)} showDay showCustomer={false} dense />
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {base.services.length ? 'Nenhum agendamento futuro.' : 'Nenhum serviço agendável cadastrado (Produtos → tipo Serviço).'}
            </Typography>
          )}
          <Typography
            variant="caption"
            sx={{
              fontWeight: 800,
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              display: 'block',
              mt: 2.5,
              mb: 1
            }}
          >
            Histórico
          </Typography>
          {history.length ? (
            <Stack spacing={0.75}>
              {history.slice(0, 20).map((a) => (
                <ApptRow key={a.id} a={a} onClick={() => setDrawer(a)} showDay showCustomer={false} dense />
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Sem agendamentos anteriores.
            </Typography>
          )}
          <Button
            size="small"
            endIcon={<IconExternalLink size={14} />}
            onClick={() => navigate('/whatsapp/agenda')}
            sx={{ mt: 1.5, fontWeight: 700, textTransform: 'none' }}
          >
            Abrir a agenda
          </Button>
        </>
      )}

      <AppointmentDrawer
        appointment={drawer}
        onClose={() => setDrawer(null)}
        onChanged={() => load()}
        serviceById={base.serviceById}
        resources={base.resources}
      />
      <NewAppointmentDialog
        open={newOpen}
        prefill={prefill}
        onClose={() => setNewOpen(false)}
        onCreated={() => load()}
        services={base.services}
        resources={base.resources}
      />
    </Box>
  );
}
