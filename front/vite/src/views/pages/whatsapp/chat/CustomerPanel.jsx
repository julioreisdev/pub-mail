import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  IconExternalLink,
  IconId,
  IconMail,
  IconMapPin,
  IconNotes,
  IconPencil,
  IconReceipt2,
  IconUserDollar,
  IconUserPlus,
  IconX
} from '@tabler/icons-react';

import { get } from 'api/api';
import useAccess from 'hooks/useAccess';
import { TgAvatar, TgListSkeleton } from 'views/pages/telegram/ui';
import { WaNumberChip, useWaSessions } from '../waKit';
import { WA_DARK, errMsg, fmtPhone, tint } from '../waShared';
import CustomerDialog from '../crm/CustomerDialog';
import ChargeDialog from '../crm/ChargeDialog';
import { NotesTab, StageTab, TasksTab } from './ChatCrmTabs';
import ChatAgendaTab from '../agenda/ChatAgendaTab';
import ChatTicketsTab from '../tickets/ChatTicketsTab';
import ChatOrdersTab from '../orders/ChatOrdersTab';
import { HIDE_SCROLL } from './chatKit';
import { BILLING_STATUS, StatusChip, SUB_STATUS, billingShort, dueText, fmtCep, fmtDoc, waPrimaryBtn } from '../crm/crmKit';

// ============================================================================
// Painel "Cliente" do chat (drawer à direita): mostra se o contato é cliente,
// o que ele usa/paga, situação e próximo vencimento; promove a cliente com 1 clique.
// Multi-número: `chat.chat_id` é o uuid da conversa ativa (usado em by-chat, funil, tarefas,
// notas e cobranças); `chat.session` = número (chip no cabeçalho). "Cobrar" passa `chatId`
// para a cobrança sair pelo número desta conversa.
// Sub-permissões (revisão 14/10/2026, P7-6): sem `whatsapp:finance` não busca nem mostra cobranças/valores e some o
// "Cobrar"; sem `whatsapp:crm` some o editar/cadastrar (a leitura do cliente pela conversa continua liberada).
// ============================================================================

const CHARGE_STATUS = {
  PENDING: { label: 'Em aberto', token: 'info', color: '#2563EB', dark: '#60A5FA' },
  OVERDUE: { label: 'Em atraso', token: 'warning', color: '#B45309', dark: '#FBBF24' },
  PAID: { label: 'Paga', token: 'success', color: '#128C7E', dark: '#25D366' },
  EXPIRED: { label: 'Expirada', token: 'info', color: '#64748B', dark: '#94A3B8' },
  CANCELED: { label: 'Cancelada', token: 'info', color: '#64748B', dark: '#94A3B8' },
  FAILED: { label: 'Falhou', token: 'error', color: '#B91C1C', dark: '#F87171' }
};

function Row({ icon: Icon, children }) {
  return (
    <Stack direction="row" spacing={1} alignItems="flex-start">
      <Box sx={{ color: 'text.secondary', pt: 0.2, flexShrink: 0 }}>
        <Icon size={16} />
      </Box>
      <Typography variant="body2" sx={{ minWidth: 0, wordBreak: 'break-word' }}>
        {children}
      </Typography>
    </Stack>
  );
}

export default function CustomerPanel({ open, onClose, chat, canDelete }) {
  const navigate = useNavigate();
  const { hasPermission } = useAccess();
  const canFinance = hasPermission('whatsapp:finance');
  const canCrm = hasPermission('whatsapp:crm');
  const [state, setState] = useState({ loading: true, customer: null, contact: null, customers: [] });
  const [chosen, setChosen] = useState(null); // vários clientes no mesmo número: qual está aberto
  const [products, setProducts] = useState([]);
  const [fields, setFields] = useState([]);
  const [dlg, setDlg] = useState(false);
  const [tab, setTab] = useState('customer'); // customer | stage | tasks | notes | agenda | tickets | orders
  const [chargeDlg, setChargeDlg] = useState(false);
  const [charges, setCharges] = useState(null); // últimas cobranças do cliente
  const chatId = chat?.chat_id; // uuid da conversa
  const customerId = state.customer?.id;
  const { sessions, byId: sessionsById } = useWaSessions(open ? 60000 : 0);
  const multi = sessions.length > 1;
  const chatSession = chat?.session || (chat?.session_id ? sessionsById.get(chat.session_id) : null) || null;
  // sequência das buscas: ao trocar de conversa rápido, a resposta antiga (que chega depois) é ignorada
  const loadSeq = useRef(0);
  const chargesSeq = useRef(0);

  // trocou de conversa → esquece o cliente escolhido da conversa anterior (vários clientes no mesmo número)
  useEffect(() => {
    setChosen(null);
  }, [chatId]);

  const loadCharges = useCallback(async () => {
    const seq = ++chargesSeq.current;
    if (!customerId || !canFinance) {
      setCharges(null);
      return;
    }
    try {
      const r = await get('/whatsapp/charges', { params: { customer_id: customerId, page_size: 5 } });
      if (seq !== chargesSeq.current) return;
      setCharges(r?.items || []);
    } catch {
      if (seq === chargesSeq.current) setCharges([]);
    }
  }, [customerId, canFinance]);
  useEffect(() => {
    if (open) loadCharges();
  }, [open, loadCharges]);

  const load = useCallback(async () => {
    if (!chatId) return;
    const seq = ++loadSeq.current;
    try {
      const r = await get(`/whatsapp/customers/by-chat/${encodeURIComponent(chatId)}`, {
        params: chosen ? { customer_id: chosen } : undefined
      });
      if (seq !== loadSeq.current) return;
      setState({ loading: false, customer: r?.customer || null, contact: r?.contact || null, customers: r?.customers || [] });
    } catch (e) {
      if (seq !== loadSeq.current) return;
      setState({ loading: false, customer: null, contact: null, customers: [] });
      toast.error(errMsg(e, 'Não foi possível carregar o cliente.'));
    }
  }, [chatId, chosen]);

  useEffect(() => {
    if (!open) return;
    setState((s) => ({ ...s, loading: true }));
    load();
    get('/whatsapp/products')
      .then((r) => setProducts(Array.isArray(r) ? r : []))
      .catch(() => undefined);
    get('/whatsapp/crm-settings')
      .then((r) => setFields(Array.isArray(r?.custom_fields) ? r.custom_fields : r?.custom_fields?.customer || r?.customer_fields || []))
      .catch(() => undefined);
  }, [open, load]);

  const c = state.customer;
  // identidade estável: o CustomerDialog só reinicia o formulário quando o id muda, não a cada render
  const hasChat = Boolean(chat);
  const chatName = chat?.name;
  const chatPhone = chat?.phone;
  const contactForCreate = useMemo(
    () => state.contact || (hasChat ? { name: chatName, phone: chatPhone } : null),
    [state.contact, hasChat, chatName, chatPhone]
  );
  const addr = c?.address;
  const addrText = addr
    ? [
        addr.street && `${addr.street}${addr.number ? `, ${addr.number}` : ''}`,
        addr.complement,
        addr.district,
        addr.city && `${addr.city}${addr.state ? `/${addr.state}` : ''}`,
        addr.zip && `CEP ${fmtCep(addr.zip)}`
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
  const subs = (c?.subscriptions || []).filter((s) => s.status !== 'canceled');
  const canceled = (c?.subscriptions || []).filter((s) => s.status === 'canceled');

  return (
    <>
      <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 400 } } }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <IconUserDollar size={20} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 17 }} noWrap>
              {chat?.name || fmtPhone(chat?.phone) || 'Conversa'}
            </Typography>
            {multi && chatSession ? <WaNumberChip session={chatSession} showPhone /> : null}
          </Box>
          {c && tab === 'customer' && canCrm ? (
            <Tooltip title="Editar cadastro">
              <IconButton size="small" onClick={() => setDlg(true)}>
                <IconPencil size={18} />
              </IconButton>
            </Tooltip>
          ) : null}
          <IconButton size="small" onClick={onClose} aria-label="Fechar">
            <IconX size={18} />
          </IconButton>
        </Stack>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons={false}
          sx={{
            borderBottom: '1px solid',
            borderColor: 'divider',
            minHeight: 40,
            flexShrink: 0,
            '& .MuiTabs-scroller': HIDE_SCROLL,
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 40, fontSize: 13, minWidth: 0, px: 1, flex: '1 0 auto' }
          }}
        >
          <Tab value="customer" label="Cliente" />
          <Tab value="stage" label="Funil" />
          <Tab value="tasks" label="Tarefas" />
          <Tab value="notes" label="Notas" />
          <Tab value="agenda" label="Agenda" />
          <Tab value="tickets" label="Chamados" />
          <Tab value="orders" label="Pedidos" />
        </Tabs>

        {tab === 'stage' ? (
          <Box sx={{ overflowY: 'auto', flex: 1 }}>
            <StageTab chat={chat} open={open} />
          </Box>
        ) : tab === 'tasks' ? (
          <Box sx={{ overflowY: 'auto', flex: 1 }}>
            <TasksTab chat={chat} open={open} customerId={c?.id || null} />
          </Box>
        ) : tab === 'notes' ? (
          <Box sx={{ overflowY: 'auto', flex: 1 }}>
            <NotesTab chat={chat} open={open} />
          </Box>
        ) : tab === 'agenda' ? (
          <Box sx={{ overflowY: 'auto', flex: 1 }}>
            <ChatAgendaTab chat={chat} customer={c} open={open} />
          </Box>
        ) : tab === 'tickets' ? (
          <Box sx={{ overflowY: 'auto', flex: 1 }}>
            <ChatTicketsTab chat={chat} customer={c} open={open} />
          </Box>
        ) : tab === 'orders' ? (
          <Box sx={{ overflowY: 'auto', flex: 1 }}>
            <ChatOrdersTab chat={chat} customer={c} open={open} />
          </Box>
        ) : state.loading ? (
          <Box sx={{ p: 2 }}>
            <TgListSkeleton rows={5} />
          </Box>
        ) : !c ? (
          <Stack alignItems="center" spacing={1.5} sx={{ p: 3, textAlign: 'center' }}>
            <TgAvatar
              name={chat?.name || chat?.phone}
              photoPath={
                chat?.chat_id
                  ? `/whatsapp/chats/${encodeURIComponent(chat.chat_id)}/photo${chat?.photo_v ? `?v=${chat.photo_v}` : ''}`
                  : undefined
              }
              size={72}
              kind="contact"
            />
            <Typography sx={{ fontWeight: 800, fontSize: 17 }}>{chat?.name || fmtPhone(chat?.phone)}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {canCrm
                ? 'Este contato ainda não é cliente. Cadastre para registrar o que ele usa ou paga, vencimentos e observações da equipe.'
                : 'Este contato ainda não é cliente. Cadastrar clientes exige a permissão "Clientes, produtos e assinaturas".'}
            </Typography>
            {canCrm ? (
              <Button
                variant="contained"
                disableElevation
                startIcon={<IconUserPlus size={18} />}
                onClick={() => setDlg(true)}
                sx={waPrimaryBtn}
              >
                Tornar cliente
              </Button>
            ) : null}
          </Stack>
        ) : (
          <Box sx={{ overflowY: 'auto', flex: 1 }}>
            {state.customers.length > 1 ? (
              <Box sx={{ px: 2, pt: 1.5 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                  Este número está em {state.customers.length} clientes
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                  {state.customers.map((x) => (
                    <Chip
                      key={x.id}
                      size="small"
                      label={`${x.name}${x.role_label ? ` · ${x.role_label}` : ''}`}
                      color={x.id === c.id ? 'primary' : 'default'}
                      variant={x.id === c.id ? 'filled' : 'outlined'}
                      onClick={() => setChosen(x.id)}
                      sx={{ fontWeight: 600, borderRadius: 1.5 }}
                    />
                  ))}
                </Stack>
              </Box>
            ) : null}
            <Stack alignItems="center" spacing={1} sx={{ p: 3, pb: 2, textAlign: 'center' }}>
              <TgAvatar
                name={c.name}
                photoPath={
                  chat?.chat_id
                    ? `/whatsapp/chats/${encodeURIComponent(chat.chat_id)}/photo${chat?.photo_v ? `?v=${chat.photo_v}` : ''}`
                    : undefined
                }
                size={80}
                kind="contact"
              />
              <Typography sx={{ fontWeight: 800, fontSize: 18 }}>{c.name}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {fmtPhone(c.phone)}
                {c.since ? ` · cliente desde ${c.since.split('-').reverse().join('/')}` : ''}
              </Typography>
              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap justifyContent="center">
                <StatusChip map={BILLING_STATUS} status={c.billing_status} size="md" />
                {c.next_due_label ? (
                  <Chip
                    size="small"
                    label={`${c.next_due_label} · ${dueText(c.days_to_due)}`}
                    variant="outlined"
                    sx={{ height: 24, fontWeight: 600, borderRadius: 1.5 }}
                  />
                ) : null}
              </Stack>
              {c.monthly_cents && canFinance ? (
                <Typography variant="body2" sx={{ fontWeight: 700, color: WA_DARK }}>
                  {c.monthly_label}/mês em assinaturas
                </Typography>
              ) : null}
            </Stack>
            <Divider />

            <Box sx={{ p: 2 }}>
              <Typography
                variant="caption"
                sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}
              >
                O que usa / paga
              </Typography>
              {subs.length ? (
                <Stack spacing={1} sx={{ mt: 1 }}>
                  {subs.map((s) => (
                    <Box
                      key={s.id}
                      sx={{
                        px: 1.25,
                        py: 1,
                        borderRadius: 2,
                        bgcolor: (t) => tint(t, 'success', 0.08),
                        border: '1px solid',
                        borderColor: 'divider'
                      }}
                    >
                      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 0, flex: 1 }} noWrap>
                          {s.product_name}
                        </Typography>
                        <StatusChip map={SUB_STATUS} status={s.status} />
                      </Stack>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }} display="block">
                        {canFinance ? s.price_label : ''}
                        {canFinance ? billingShort(s.billing) : ''}
                        {s.next_due_label ? ` · vence ${s.next_due_label}` : ''}
                        {s.due_day && !s.next_due_label ? ` · dia ${s.due_day}` : ''}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                  Nenhuma assinatura ou produto vinculado.
                </Typography>
              )}
              {canceled.length ? (
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
                  {canceled.length} cancelada{canceled.length === 1 ? '' : 's'}: {canceled.map((s) => s.product_name).join(', ')}
                </Typography>
              ) : null}
              {canCrm ? (
                <Button
                  size="small"
                  startIcon={<IconPencil size={14} />}
                  onClick={() => setDlg(true)}
                  sx={{ mt: 1, fontWeight: 700, textTransform: 'none' }}
                >
                  Gerenciar assinaturas
                </Button>
              ) : null}
            </Box>
            <Divider />

            <Stack spacing={1} sx={{ p: 2 }}>
              <Typography
                variant="caption"
                sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}
              >
                Dados
              </Typography>
              {c.doc ? <Row icon={IconId}>{fmtDoc(c.doc)}</Row> : null}
              {c.email ? <Row icon={IconMail}>{c.email}</Row> : null}
              {addrText ? <Row icon={IconMapPin}>{addrText}</Row> : null}
              {!c.doc && !c.email && !addrText ? (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Sem CPF/CNPJ, e-mail ou endereço (necessários só para boleto).
                </Typography>
              ) : null}
              {(c.custom_list || [])
                .filter((f) => f.value)
                .map((f) => (
                  <Stack key={f.key} direction="row" spacing={1} alignItems="baseline">
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, minWidth: 110 }} noWrap>
                      {f.label}
                    </Typography>
                    <Typography variant="body2" sx={{ minWidth: 0, wordBreak: 'break-word' }}>
                      {f.value}
                    </Typography>
                  </Stack>
                ))}
            </Stack>

            {c.notes ? (
              <>
                <Divider />
                <Box sx={{ p: 2 }}>
                  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.5 }}>
                    <IconNotes size={15} />
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}
                    >
                      Observações
                    </Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {c.notes}
                  </Typography>
                </Box>
              </>
            ) : null}
            {canFinance ? (
              <>
                <Divider />
                <Box sx={{ p: 2 }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4, flex: 1 }}
                    >
                      Últimas cobranças
                    </Typography>
                    <Button
                      size="small"
                      variant="contained"
                      disableElevation
                      startIcon={<IconReceipt2 size={14} />}
                      onClick={() => setChargeDlg(true)}
                      sx={{ ...waPrimaryBtn, py: 0.25 }}
                    >
                      Cobrar
                    </Button>
                  </Stack>
                  {charges === null ? (
                    <TgListSkeleton rows={2} />
                  ) : charges.length ? (
                    <Stack spacing={0.75}>
                      {charges.map((ch) => (
                        <Stack key={ch.id} direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                              {ch.description}
                            </Typography>
                            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
                              <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 0 }} noWrap>
                                {ch.amount_label} · vence {ch.due_label}
                                {ch.status === 'PAID' && ch.paid_at ? ` · pago ${new Date(ch.paid_at).toLocaleDateString('pt-BR')}` : ''}
                              </Typography>
                              {multi && ch.session && ch.session_id !== chat?.session_id ? <WaNumberChip session={ch.session} /> : null}
                            </Stack>
                          </Box>
                          <StatusChip map={CHARGE_STATUS} status={ch.overdue ? 'OVERDUE' : ch.status} />
                        </Stack>
                      ))}
                      <Button
                        size="small"
                        endIcon={<IconExternalLink size={14} />}
                        onClick={() => navigate('/whatsapp/charges')}
                        sx={{ alignSelf: 'flex-start', fontWeight: 700, textTransform: 'none' }}
                      >
                        Ver todas
                      </Button>
                    </Stack>
                  ) : (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Nenhuma cobrança ainda.
                    </Typography>
                  )}
                </Box>
              </>
            ) : null}
            <Divider />
            {canCrm ? (
              <Box sx={{ p: 2 }}>
                <Button
                  size="small"
                  endIcon={<IconExternalLink size={14} />}
                  onClick={() => navigate('/whatsapp/customers')}
                  sx={{ fontWeight: 700, textTransform: 'none' }}
                >
                  Ver todos os clientes
                </Button>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => setDlg('another')}
                  sx={{ fontWeight: 600, textTransform: 'none', display: 'block' }}
                >
                  Cadastrar outro cliente neste número
                </Button>
              </Box>
            ) : null}
          </Box>
        )}
      </Drawer>

      <ChargeDialog
        open={chargeDlg && canFinance}
        onClose={() => setChargeDlg(false)}
        customer={c}
        chatId={chatId}
        chat={chat}
        products={products}
        onCreated={loadCharges}
      />
      <CustomerDialog
        open={Boolean(dlg)}
        onClose={() => setDlg(false)}
        customer={dlg === 'another' ? null : c}
        contact={!c || dlg === 'another' ? contactForCreate : null}
        another={dlg === 'another'}
        products={products}
        fields={fields}
        canDelete={canDelete}
        onChargesChanged={loadCharges}
        onSaved={(saved) => {
          if (dlg === 'another') setChosen(saved?.id || null);
          setState((s) => ({ ...s, customer: saved }));
          load();
        }}
        onDeleted={() => {
          setChosen(null);
          setState((s) => ({ ...s, customer: null }));
          load();
        }}
      />
    </>
  );
}
