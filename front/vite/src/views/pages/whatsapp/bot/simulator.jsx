// =============================================================================
// WhatsApp — Fluxo do Bot: simulador (celular de mentira). Testa o rascunho
// ATUAL via POST /whatsapp/bot/simulate { flow_id | definition, settings } — nada vai ao WhatsApp.
// =============================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, CircularProgress, IconButton, InputBase, Stack, Tooltip, Typography } from '@mui/material';
import {
  IconBolt,
  IconCheck,
  IconCircleCheck,
  IconCopy,
  IconFile,
  IconFileText,
  IconHeadset,
  IconHourglass,
  IconInfoCircle,
  IconPhoto,
  IconPlayerSkipForward,
  IconQrcode,
  IconRefresh,
  IconRobot,
  IconShoppingCart,
  IconSend2,
  IconTags,
  IconUserCircle,
  IconVariable,
  IconX
} from '@tabler/icons-react';

import { post } from 'api/api';
import { fmtBRL, simNodeOf } from './botModel';
import {
  TagChip,
  TypingDots,
  WA_ACCENT,
  WA_DARK,
  WA_GREEN,
  WA_TEAL,
  WaText,
  hexA,
  useBookCatalog,
  useBot,
  useTicketCatalog,
  waBg,
  waFg
} from './botUi';

// ---------------------------------------------------------------------------
// Cliente fictício (crm_fixture do POST /whatsapp/bot/simulate — contrato §1.7).
// Os blocos de Cliente são resolvidos em memória no servidor com estes dados.
// ---------------------------------------------------------------------------
export const SIM_DOC = '52998224725'; // CPF válido de teste
export const SIM_CODE = 'CLI-001';
const FAKE_PRODUCTS = [
  {
    id: 'sim-prod-1',
    name: 'Plano Essencial',
    description: 'Produto de exemplo',
    price_cents: 9990,
    price_label: 'R$ 99,90',
    billing: 'monthly',
    billing_label: 'Mensal',
    trial_days: 0,
    cancel_policy: 'end_of_cycle',
    active: true
  },
  {
    id: 'sim-prod-2',
    name: 'Plano Completo',
    description: 'Produto de exemplo',
    price_cents: 14990,
    price_label: 'R$ 149,90',
    billing: 'monthly',
    billing_label: 'Mensal',
    trial_days: 0,
    cancel_policy: 'end_of_cycle',
    active: true
  }
];
const ymd = (daysFromNow) => {
  const d = new Date(Date.now() + daysFromNow * 86400000);
  return d.toISOString().slice(0, 10);
};
const dmy = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
const PERIOD_LABEL = { monthly: 'Mensal', quarterly: 'Trimestral', yearly: 'Anual', once: 'Avulso' };
const simProduct = (p) => ({
  id: p.id,
  name: p.name,
  description: p.description ?? null,
  price_cents: Number(p.price_cents) || 0,
  price_label: p.price_label || fmtBRL(p.price_cents),
  billing: p.billing || 'monthly',
  billing_label: p.billing_label || PERIOD_LABEL[p.billing] || 'Mensal',
  trial_days: Number(p.trial_days) || 0,
  cancel_policy: p.cancel_policy === 'immediate' ? 'immediate' : 'end_of_cycle',
  active: p.active !== false
});
const sub = (id, p, patch = {}) => ({
  id,
  product_id: p.id,
  product_name: p.name,
  price_cents: p.price_cents,
  price_label: p.price_label,
  billing: p.billing,
  status: 'active',
  next_due_at: ymd(12),
  next_due_label: dmy(ymd(12)),
  days_overdue: 0,
  due_day: 10,
  cancel_at: null,
  paused_until: null,
  ...patch
});
const charge = (id, p, patch = {}) => ({
  id,
  amount_cents: p.price_cents,
  amount_label: p.price_label,
  description: `${p.name} — mensalidade`,
  due_at: ymd(5),
  due_label: dmy(ymd(5)),
  days_overdue: 0,
  kind: 'pix',
  pix_code: `000201PIX-SIMULADO-${id}`,
  boleto_url: null,
  status: 'pending',
  ...patch
});

// ---------------------------------------------------------------------------
// Agenda fictícia (book_fixture do simulate — contrato §9.4): serviços reais (ou 2 de exemplo no servidor),
// horários gerados em memória (seg–sáb 9–12 e 14–18), pagamento sobrescrito, agenda lotada, conflito e
// agendamentos de exemplo para "Meus agendamentos". Nada é reservado.
// ---------------------------------------------------------------------------
export const BOOK_PAYMENTS = [
  { id: null, label: 'Pagamento: como no serviço' },
  { id: 'on_site', label: 'Pagamento: no local' },
  { id: 'on_booking', label: 'Pagamento: PIX na reserva' },
  { id: 'deposit', label: 'Pagamento: sinal' }
];
const brtIso = (daysFromNow, hm) => new Date(Date.parse(`${ymd(daysFromNow)}T${hm}:00-03:00`)).toISOString();
function sampleAppointments(services) {
  const s = (services || [])[0] || {
    id: 'sim-svc-1',
    name: 'Consulta',
    price_cents: 15000,
    resources: [{ id: 'sim-res-1', name: 'Dra. Ana' }]
  };
  const r = (s.resources || [])[0] || { id: 'sim-res-1', name: 'Profissional' };
  const mk = (id, days, hm, status, free) => ({
    id,
    status,
    payment: 'on_site',
    starts_at: brtIso(days, hm),
    resource: { id: r.id, name: r.name },
    product_id: s.id,
    service_name: s.name,
    price_cents: Number(s.price_cents) || 0,
    price_label: fmtBRL(s.price_cents),
    cancel_deadline: new Date(Date.parse(brtIso(days, hm)) - 86400000).toISOString(),
    can_cancel_free: free,
    can_reschedule: true
  });
  return [mk('sim-ap-a', 1, '10:00', 'booked', false), mk('sim-ap-b', 3, '15:00', 'confirmed', true)];
}
export function buildBookFixture(book, services) {
  const list = (services || []).slice(0, 30);
  return {
    ...(list.length ? { services: list } : {}),
    payment: book.payment || null,
    no_slots: Boolean(book.no_slots),
    conflict: Boolean(book.conflict),
    appointments: book.appts ? sampleAppointments(list) : []
  };
}

// ---------------------------------------------------------------------------
// Chamados fictícios (crm_fixture.tickets do simulate — contrato §10.5): categorias reais (ou 3 de exemplo no
// servidor), 3 chamados de exemplo para "Meus chamados" (um aguardando o cliente, um aberto, um encerrado) e
// "falha ao abrir". Nada é gravado.
// ---------------------------------------------------------------------------
const year = () => new Date(Date.now() - 3 * 3600000).getUTCFullYear();
function sampleTickets() {
  const y = year();
  return [
    {
      id: 'sim-tk-a',
      protocol: `${y}000041`,
      status: 'pending',
      category: 'problema',
      category_label: 'Problema / reclamação',
      subject: 'Internet caindo à noite',
      sla_label: `${dmy(ymd(1)).slice(0, 5)} às 18:00`,
      last_update: 'Pode mandar uma foto das luzes do roteador?'
    },
    {
      id: 'sim-tk-b',
      protocol: `${y}000039`,
      status: 'open',
      category: 'duvida',
      category_label: 'Dúvida',
      subject: 'Fatura de outubro',
      sla_label: `${dmy(ymd(2)).slice(0, 5)} às 09:00`
    },
    { id: 'sim-tk-c', protocol: `${y - 1}000007`, status: 'closed', category: 'duvida', category_label: 'Dúvida', subject: 'Antigo' }
  ];
}
export function buildTicketFixture(tk, categories) {
  return {
    ...(Array.isArray(categories) && categories.length ? { categories: categories.slice(0, 40) } : {}),
    tickets: tk.tickets ? sampleTickets() : [],
    fail_create: Boolean(tk.fail)
  };
}
// ---------------------------------------------------------------------------
// Pedidos fictícios (crm_fixture.catalog/order_settings/orders/addresses do simulate — contrato §11.3):
// catálogo real (ou um de exemplo), configurações reais (ou de exemplo), 2 pedidos anteriores e 1 endereço salvo.
// Nada é gravado; o PIX do pedido é fictício (botões Pagou/Expirou).
// ---------------------------------------------------------------------------
const SAMPLE_CATALOG = {
  categories: [
    {
      name: 'Lanches',
      products: [
        { id: 'sim-p1', name: 'X-Burguer', price_cents: 2500 },
        { id: 'sim-p2', name: 'X-Salada', price_cents: 2800 }
      ]
    },
    { name: 'Bebidas', products: [{ id: 'sim-p3', name: 'Refrigerante lata', price_cents: 600 }] }
  ]
};
const SAMPLE_ORDER_SETTINGS = {
  enabled: true,
  delivery: { enabled: true, fee_cents: 500, free_from_cents: 0 },
  pickup: { enabled: true, address: 'Rua Exemplo, 100' },
  min_order_cents: 0,
  payment_methods: ['pix', 'on_delivery'],
  max_items: 30
};
const SIM_ADDRESS = {
  id: 'sim-a1',
  kind: 'delivery',
  label: 'Casa',
  street: 'Rua das Flores',
  number: '10',
  district: 'Centro',
  city: 'São Paulo',
  state: 'SP'
};
function sampleOrders() {
  const at = (days) => new Date(Date.now() - days * 86400000).toISOString();
  return [
    {
      id: 'sim-ord-a',
      number: 1042,
      status: 'preparing',
      payment_method: 'pix',
      payment_status: 'paid',
      items_text: '2× X-Burguer — R$ 50,00\n1× Refrigerante lata — R$ 6,00',
      total_cents: 6100,
      total_label: 'R$ 61,00',
      delivery_text: '🛵 Entrega: Rua das Flores, 10 · Centro · São Paulo/SP',
      created_at: at(0)
    },
    {
      id: 'sim-ord-b',
      number: 1031,
      status: 'delivered',
      payment_method: 'on_delivery',
      payment_status: 'not_required',
      items_text: '1× X-Salada — R$ 28,00',
      total_cents: 2800,
      total_label: 'R$ 28,00',
      delivery_text: '🏪 Retirada no local: Rua Exemplo, 100',
      created_at: at(6)
    }
  ];
}
export function buildOrderFixture(o, orderCatalog, customFieldMap) {
  const real = orderCatalog?.catalog?.categories || [];
  const hasProducts = real.some((c) => (c.products || []).length);
  return {
    ...(customFieldMap ? { custom_fields: customFieldMap } : {}),
    catalog: hasProducts ? { categories: real.slice(0, 40) } : SAMPLE_CATALOG,
    order_settings: orderCatalog?.settings || SAMPLE_ORDER_SETTINGS,
    orders: o.orders ? sampleOrders() : [],
    addresses: o.address ? [SIM_ADDRESS] : []
  };
}
const PAY_SHORT = { pix: 'PIX', on_delivery: 'na entrega', none: 'sem pagamento' };

// etapas em que o "cliente" pode mandar um arquivo (blocos de chamado)
const MEDIA_WAITS = new Set(['ticket:photo', 'ticket:description', 'ticket:info']);

export const FIXTURE_PRESETS = [
  {
    id: 'none',
    label: 'Não é cliente',
    hint: 'Número sem cadastro: identificar cai em “Não encontrado”; os demais blocos em “Sem cadastro”.'
  },
  { id: 'ok', label: 'Cliente em dia', hint: '2 assinaturas ativas e 1 cobrança em aberto (a vencer).' },
  { id: 'overdue', label: 'Cliente em atraso', hint: '1 assinatura vencida há 12 dias, com cobrança em atraso.' },
  { id: 'two', label: '2 clientes no número', hint: 'O número tem 2 cadastros: o bot pede para escolher.' }
];

export function buildFixture(preset, products, { requireDoc, crmSettings } = {}) {
  const real = (products || []).filter((p) => p && p.active !== false && p.kind !== 'service').map(simProduct);
  const list = real.length >= 2 ? real : [...real, ...FAKE_PRODUCTS.slice(real.length)].slice(0, Math.max(2, real.length));
  const [p1, p2] = list;
  const customFields = crmSettings?.custom_fields || [];
  const custom = Object.fromEntries(
    customFields
      .slice(0, 4)
      .map((f) => [f.key, f.type === 'number' ? '10' : f.type === 'date' ? '01/01/2026' : f.options?.[0] || 'Exemplo'])
  );
  const ok = {
    id: 'sim-cust-ok',
    name: 'Maria da Silva',
    first_name: 'Maria',
    doc_masked: '***.982.247-**',
    code: SIM_CODE,
    email: 'maria@exemplo.com',
    status: 'ok',
    verified: true,
    custom,
    subscriptions: [sub('sim-sub-1', p1), sub('sim-sub-2', p2, { next_due_at: ymd(20), next_due_label: dmy(ymd(20)), due_day: 20 })],
    open_charges: [charge('sim-chg-1', p1)]
  };
  const overdue = {
    id: 'sim-cust-late',
    name: 'João Pereira',
    first_name: 'João',
    doc_masked: '***.111.222-**',
    code: 'CLI-002',
    email: 'joao@exemplo.com',
    status: 'overdue',
    verified: false,
    custom,
    subscriptions: [sub('sim-sub-9', p1, { status: 'overdue', days_overdue: 12, next_due_at: ymd(-12), next_due_label: dmy(ymd(-12)) })],
    open_charges: [charge('sim-chg-9', p1, { days_overdue: 12, due_at: ymd(-12), due_label: dmy(ymd(-12)) })]
  };
  const identity = { ...(crmSettings?.identity || {}), require_doc: Boolean(requireDoc) };
  const base = {
    products: list,
    identity,
    cancel_reasons: ['Está caro', 'Não uso mais', 'Mudei de serviço', 'Problemas no atendimento', 'Outro']
  };
  if (preset === 'ok') return { ...base, customer: ok, customers: [ok], lookup: { [SIM_DOC]: ok, [SIM_CODE]: ok } };
  if (preset === 'overdue') return { ...base, customer: overdue, customers: [overdue], lookup: { [SIM_DOC]: overdue, 'CLI-002': overdue } };
  if (preset === 'two')
    return { ...base, customer: ok, customers: [ok, overdue], lookup: { [SIM_DOC]: ok, [SIM_CODE]: ok, 'CLI-002': overdue } };
  return { ...base, customer: null, customers: [], lookup: {} };
}

const CRM_ACTION_NOTE = {
  crm_lookup: (a) => `Procurando o cliente pelo ${a.by === 'code' ? 'código' : 'documento'}…`,
  crm_create_customer: (a) => `Cadastrando o cliente (${Object.keys(a.fields || {}).length} campos)…`,
  crm_subscribe: (a) =>
    `Criando a assinatura${a.charge_now !== false ? ' e a 1ª cobrança' : ''} (${a.method === 'boleto' ? 'boleto' : 'PIX'})…`,
  crm_send_charge: () => 'Reenviando a cobrança (2ª via)…',
  charge_check: () => 'Conferindo o pagamento no gateway…',
  crm_cancel_subscription: (a) =>
    `Cancelando a assinatura (${a.policy === 'immediate' ? 'imediato' : a.policy === 'end_of_cycle' ? 'fim do ciclo' : 'política do produto'})…`,
  crm_pause_subscription: (a) => `Pausando por ${a.days} ${a.days === 1 ? 'dia' : 'dias'}…`,
  crm_change_plan: () => 'Trocando o plano…',
  crm_update_customer: (a) =>
    `Atualizando ${Object.keys(a.fields || {}).length} ${Object.keys(a.fields || {}).length === 1 ? 'campo' : 'campos'} do cliente…`,
  order_catalog: () => 'Buscando o catálogo de produtos…',
  order_create: (a) => {
    const n = (a.items || []).reduce((acc, i) => acc + (Number(i.qty) || 0), 0);
    return `Criando o pedido (${n} ${n === 1 ? 'item' : 'itens'}, ${a.delivery?.mode === 'pickup' ? 'retirada' : 'entrega'}, ${PAY_SHORT[a.payment_method] || a.payment_method || '—'})…`;
  },
  order_list: () => 'Consultando os pedidos do cliente…'
};

const MAX_WAIT = 8000;
const FAST_WAIT = 350;
const now = () => new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date());
const secsLabel = (s) => {
  const n = Number(s) || 0;
  if (n < 60) return `${n} s`;
  if (n < 3600) return `${Math.round(n / 60)} min`;
  if (n < 86400) return `${Math.round(n / 360) / 10} h`.replace('.', ',');
  return `${Math.round(n / 8640) / 10} dias`.replace('.', ',');
};
const errText = (e) => {
  const status = e?.response?.status;
  if (status === 404) return 'O simulador ainda não está disponível no servidor. Tente de novo depois da atualização.';
  const m = e?.response?.data?.message ?? e?.message;
  return Array.isArray(m) ? m.join(' | ') : String(m || 'Não foi possível simular.');
};

// números das opções na última mensagem do bot (atalhos de resposta)
// montado via fromCharCode (sem escapes \u nus no fonte): VS16 (FE0F), keycap (20E3) e 🔟 (D83D DD1F)
const VS16 = String.fromCharCode(0xfe0f);
const KEYCAP = String.fromCharCode(0x20e3);
const TEN = String.fromCharCode(0xd83d, 0xdd1f);
const KEYCAP_RE = new RegExp(`^\\s*((?:\\d(?:${VS16})?${KEYCAP})+|${TEN}|\\d{1,2}[.)-])`, 'u');
const quickNumbers = (text) => {
  const out = [];
  String(text || '')
    .split('\n')
    .forEach((line) => {
      const m = KEYCAP_RE.exec(line);
      if (!m) return;
      const tok = m[1];
      const n = tok.includes(TEN) ? 10 : parseInt(tok.replace(/\D/g, ''), 10);
      if (Number.isFinite(n) && !out.includes(n)) out.push(n);
    });
  return out.slice(0, 10);
};

// ---------------------------------------------------------------------------
// Balões
// ---------------------------------------------------------------------------
function Bubble({ mine, children, time }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', px: 1.25 }}>
      <Box
        sx={[
          {
            position: 'relative',
            maxWidth: '84%',
            minWidth: 64,
            px: 1,
            pt: 0.7,
            pb: 0.45,
            borderRadius: '9px',
            fontSize: 13.5,
            lineHeight: 1.4,
            boxShadow: '0 1px 1px rgba(0,0,0,0.13)'
          },
          mine ? { borderTopRightRadius: '3px' } : { borderTopLeftRadius: '3px' },
          waBg(mine ? 'out' : 'in'),
          waFg('text')
        ]}
      >
        {children}
        <Typography component="div" sx={[{ fontSize: 10, textAlign: 'right', mt: 0.2, lineHeight: 1 }, waFg('meta')]}>
          {time}
        </Typography>
      </Box>
    </Box>
  );
}

function BotMessage({ message }) {
  const kind = message?.kind || 'text';
  const media = message?.media;
  const text = message?.text;
  return (
    <>
      {kind === 'image' && media?.url ? (
        <Box
          component="img"
          src={media.url}
          alt=""
          sx={{ display: 'block', width: '100%', maxWidth: 240, borderRadius: 1.5, mb: text ? 0.6 : 0.2 }}
        />
      ) : null}
      {kind === 'video' && media?.url ? (
        <Box
          component="video"
          src={media.url}
          controls
          sx={{ display: 'block', width: '100%', maxWidth: 240, borderRadius: 1.5, mb: text ? 0.6 : 0.2, bgcolor: '#000' }}
        />
      ) : null}
      {kind === 'audio' && media?.url ? (
        <Box component="audio" src={media.url} controls sx={{ display: 'block', width: 230, height: 38, mb: 0.3 }} />
      ) : null}
      {kind === 'document' ? (
        <Stack
          component={media?.url ? 'a' : 'div'}
          href={media?.url || undefined}
          target="_blank"
          rel="noreferrer"
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{
            p: 0.9,
            mb: text ? 0.6 : 0.2,
            borderRadius: 1.5,
            bgcolor: 'rgba(0,0,0,0.07)',
            color: 'inherit',
            textDecoration: 'none',
            minWidth: 180
          }}
        >
          <IconFile size={22} />
          <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 600, maxWidth: 190 }}>
            {media?.filename || 'Documento'}
          </Typography>
        </Stack>
      ) : null}
      {kind !== 'text' && !media?.url ? (
        <Typography sx={{ fontSize: 12, opacity: 0.7, fontStyle: 'italic', mb: text ? 0.4 : 0 }}>[{kind} sem arquivo]</Typography>
      ) : null}
      {text ? <WaText text={text} /> : null}
    </>
  );
}

function Note({ icon: Icon = IconInfoCircle, children, tone = 'info' }) {
  const color = { info: '#64748B', ok: '#16A34A', warn: '#D97706', error: '#DC2626', brand: WA_DARK, blue: '#2563EB' }[tone] || '#64748B';
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', px: 2 }}>
      <Stack
        direction="row"
        spacing={0.75}
        alignItems="center"
        sx={[
          {
            maxWidth: '92%',
            px: 1.1,
            py: 0.5,
            borderRadius: 2,
            fontSize: 11.5,
            fontWeight: 600,
            lineHeight: 1.4,
            boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
            border: `1px solid ${hexA(color, 0.3)}`
          },
          (t) => ({ bgcolor: '#fff8e1', color: '#54656f', ...t.applyStyles('dark', { bgcolor: '#182229', color: '#aebac1' }) })
        ]}
      >
        <Box sx={{ color, display: 'flex', flexShrink: 0 }}>
          <Icon size={14} />
        </Box>
        <Box sx={{ minWidth: 0 }}>{children}</Box>
      </Stack>
    </Box>
  );
}

function PixCard({ item }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!item.code) return;
    navigator.clipboard
      ?.writeText(item.code)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-start', px: 1.25 }}>
      <Box
        sx={[
          { width: '84%', borderRadius: '9px', borderTopLeftRadius: '3px', overflow: 'hidden', boxShadow: '0 1px 1px rgba(0,0,0,0.13)' },
          waBg('in'),
          waFg('text')
        ]}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1.25, py: 1, bgcolor: hexA('#0D9488', 0.12) }}>
          <Box sx={{ width: 34, height: 34, borderRadius: 1.5, bgcolor: '#0D9488', color: '#fff', display: 'grid', placeItems: 'center' }}>
            <IconQrcode size={19} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 15, lineHeight: 1.15 }}>{fmtBRL(item.amount_cents)}</Typography>
            <Typography noWrap sx={{ fontSize: 11.5, opacity: 0.75 }}>
              {item.description || 'Cobrança PIX'}
            </Typography>
          </Box>
        </Stack>
        <Box sx={{ px: 1.25, py: 1 }}>
          {item.due_label ? (
            <Typography sx={{ fontSize: 11, opacity: 0.75, mb: 0.5 }}>
              Vence em <b>{item.due_label}</b>
              {item.boleto_url ? ' · boleto disponível' : ''}
            </Typography>
          ) : null}
          <Typography sx={{ fontSize: 10.5, fontWeight: 700, opacity: 0.6, mb: 0.4 }}>PIX COPIA E COLA (simulado)</Typography>
          <Box
            sx={{
              fontFamily: 'monospace',
              fontSize: 11,
              wordBreak: 'break-all',
              p: 0.75,
              borderRadius: 1,
              bgcolor: 'rgba(0,0,0,0.06)',
              maxHeight: 54,
              overflow: 'hidden'
            }}
          >
            {item.code || '—'}
          </Box>
          <Button
            size="small"
            fullWidth
            onClick={copy}
            startIcon={copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
            sx={{ mt: 0.75, textTransform: 'none', fontWeight: 700, color: WA_ACCENT }}
          >
            {copied ? 'Copiado!' : 'Copiar código'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Simulador
// ---------------------------------------------------------------------------
export default function BotSimulator({ getPayload, flowSig, onClose, onCurrentNode }) {
  const { attendants, products, crmSettings, customFieldMap, orderCatalog } = useBot();
  const [items, setItems] = useState([]);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState({ pix: false, wait: false, charge: null });
  const [fast, setFast] = useState(false);
  const [startSig, setStartSig] = useState(null);
  const [preset, setPreset] = useState('ok');
  const [requireDoc, setRequireDoc] = useState(null); // null = como está na org
  const [fixtureOpen, setFixtureOpen] = useState(false);
  const effRequireDoc = requireDoc == null ? Boolean(crmSettings?.identity?.require_doc) : requireDoc;
  const fixtureRef = useRef(null);
  fixtureRef.current = buildFixture(preset, products, { requireDoc: effRequireDoc, crmSettings });
  const { services: bookServices } = useBookCatalog();
  const [book, setBook] = useState({ payment: null, no_slots: false, conflict: false, appts: true });
  const bookRef = useRef(null);
  bookRef.current = buildBookFixture(book, bookServices);
  const { categories: ticketCategories } = useTicketCatalog();
  const [tk, setTk] = useState({ tickets: true, fail: false });
  const ticketRef = useRef(null);
  ticketRef.current = buildTicketFixture(tk, ticketCategories);
  const [ordFx, setOrdFx] = useState({ orders: true, address: true });
  const orderRef = useRef(null);
  orderRef.current = buildOrderFixture(ordFx, orderCatalog, customFieldMap);
  const [waitingFor, setWaitingFor] = useState(null); // etapa atual (mostra "Enviar foto" nos blocos de chamado)

  const stateRef = useRef(null);
  const endedRef = useRef(false);
  const runRef = useRef(0);
  const skipRef = useRef(null);
  const fastRef = useRef(false);
  fastRef.current = fast;
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const seq = useRef(0);

  const push = useCallback((item) => setItems((p) => [...p, { id: ++seq.current, at: now(), ...item }]), []);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [items.length, typing]);

  useEffect(
    () => () => {
      runRef.current += 1;
      skipRef.current?.();
      onCurrentNode?.(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const sleep = (ms) =>
    new Promise((resolve) => {
      const wait = fastRef.current ? Math.min(ms, FAST_WAIT) : Math.min(ms, MAX_WAIT);
      let t = null;
      const done = () => {
        if (t) clearTimeout(t);
        skipRef.current = null;
        resolve();
      };
      t = setTimeout(done, Math.max(0, wait));
      skipRef.current = done;
    });

  const play = async (actions, runId) => {
    let typedMs = 0;
    for (const a of actions || []) {
      if (runId !== runRef.current) return;
      switch (a?.type) {
        case 'typing': {
          const ms = Number(a.ms) || 0;
          if (ms > 0) {
            setTyping(true);
            await sleep(ms);
            setTyping(false);
            typedMs += ms;
          }
          break;
        }
        case 'send': {
          const wait = Math.max(0, (Number(a.delay_ms) || 0) - typedMs);
          typedMs = 0;
          if (wait > 0) {
            setTyping(true);
            await sleep(wait);
            setTyping(false);
          }
          if (runId !== runRef.current) return;
          push({ kind: 'bot', message: a.message || {} });
          await sleep(fastRef.current ? 60 : 280);
          break;
        }
        case 'info':
          push({ kind: 'note', tone: 'info', text: a.text });
          break;
        case 'tags':
          push({ kind: 'tags', add: a.add || [], remove: a.remove || [] });
          break;
        case 'set_var':
          push({ kind: 'note', tone: 'brand', icon: IconVariable, text: `{{${a.name}}} = ${a.value ?? ''}` });
          break;
        case 'handoff': {
          const who = a.assign_user_id ? (attendants || []).find((x) => x.id === a.assign_user_id) : null;
          push({
            kind: 'note',
            tone: 'blue',
            icon: IconHeadset,
            text: a.assign_user_id
              ? `Conversa transferida para ${who?.name || 'o atendente escolhido'}.`
              : 'Conversa transferida para a fila de atendimento.'
          });
          break;
        }
        case 'close':
          push({ kind: 'note', tone: 'ok', icon: IconCircleCheck, text: 'Atendimento encerrado.' });
          break;
        case 'pix':
          push({ kind: 'pix', amount_cents: a.amount_cents, description: a.description, code: a.code });
          setPending((p) => ({ ...p, pix: true }));
          break;
        case 'charge': {
          const c = a.charge || {};
          push({
            kind: 'pix',
            amount_cents: c.amount_cents,
            description: c.description || 'Cobrança da assinatura',
            code: c.pix_code || a.code,
            due_label: c.due_at ? dmy(String(c.due_at).slice(0, 10)) : null,
            boleto_url: c.boleto_url || null
          });
          if (c.id) setPending((p) => ({ ...p, charge: c.id }));
          break;
        }
        case 'crm_lookup':
        case 'crm_create_customer':
        case 'crm_subscribe':
        case 'crm_send_charge':
        case 'charge_check':
        case 'crm_cancel_subscription':
        case 'crm_pause_subscription':
        case 'crm_change_plan':
        case 'crm_update_customer':
          push({ kind: 'note', tone: 'brand', icon: IconUserCircle, text: CRM_ACTION_NOTE[a.type]?.(a) || a.type });
          break;
        case 'order_catalog':
        case 'order_create':
        case 'order_list':
          push({ kind: 'note', tone: 'brand', icon: IconShoppingCart, text: CRM_ACTION_NOTE[a.type]?.(a) || a.type });
          break;
        case 'wait':
          push({ kind: 'note', tone: 'warn', icon: IconHourglass, text: `O bot vai esperar ${secsLabel(a.seconds)} antes de continuar.` });
          setPending((p) => ({ ...p, wait: true }));
          break;
        default:
          break;
      }
    }
  };

  const run = async ({ text, event, event_payload, media }) => {
    if (busy) return;
    const t = String(text || '').trim();
    if (!event && !t && !media) return;
    const runId = runRef.current;
    let state = stateRef.current;
    if (endedRef.current && !event) {
      push({ kind: 'divider', text: 'Nova conversa' });
      state = null;
      stateRef.current = null;
      endedRef.current = false;
    }
    if (!state && !event) setStartSig(flowSig);
    if (media) push({ kind: 'user', text: t, media });
    else if (t) push({ kind: 'user', text: t });
    if (event === 'pix_paid' || event === 'pix_expired') setPending((p) => ({ ...p, pix: false }));
    if (event === 'charge_paid' || event === 'charge_expired') setPending((p) => ({ ...p, charge: null }));
    if (event === 'wait_done') setPending((p) => ({ ...p, wait: false }));
    setInput('');
    setBusy(true);
    try {
      // fluxo salvo → só flow_id; rascunho alterado → definition/settings atuais (nada vai ao WhatsApp)
      const body = {
        ...(getPayload() || {}),
        crm_fixture: { ...(fixtureRef.current || {}), ...(orderRef.current || {}), tickets: ticketRef.current },
        book_fixture: bookRef.current
      };
      if (state) body.state = media ? { ...state, __sim_media: media } : state;
      if (t || media) body.input = t;
      if (event) body.event = event;
      if (event_payload) body.event_payload = event_payload;
      const r = await post('/whatsapp/bot/simulate', body);
      if (runId !== runRef.current) return;
      stateRef.current = r?.state ?? null;
      endedRef.current = Boolean(r?.ended);
      setWaitingFor(r?.ended ? null : r?.state?.waiting_for || null);
      onCurrentNode?.(r?.ended ? null : simNodeOf(r?.state));
      await play(r?.actions || [], runId);
      if (runId !== runRef.current) return;
      // cobrança do bloco "Assinar plano" aguardando pagamento → botões Pagou / Expirou
      const st = r?.state;
      setPending((p) => ({ ...p, charge: st?.waiting_for === 'charge' && st?.charge?.id ? st.charge.id : null }));
      if (r?.ended) {
        setPending({ pix: false, wait: false, charge: null });
        push({ kind: 'end' });
      }
    } catch (e) {
      if (runId !== runRef.current) return;
      push({ kind: 'note', tone: 'error', text: errText(e) });
    } finally {
      if (runId === runRef.current) {
        setBusy(false);
        setTyping(false);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    }
  };

  const restart = () => {
    runRef.current += 1;
    skipRef.current?.();
    stateRef.current = null;
    endedRef.current = false;
    setItems([]);
    setTyping(false);
    setBusy(false);
    setPending({ pix: false, wait: false, charge: null });
    setWaitingFor(null);
    setStartSig(null);
    onCurrentNode?.(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  // atalhos numéricos: última mensagem do bot depois da última fala do cliente
  const lastUserIdx = items.map((i) => i.kind).lastIndexOf('user');
  const lastBot = [...items.slice(lastUserIdx + 1)].reverse().find((i) => i.kind === 'bot');
  const quick = !busy && lastBot && !endedRef.current ? quickNumbers(lastBot.message?.text) : [];
  const changed = startSig && flowSig !== startSig && items.length > 0;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {/* barra do "celular" */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={[
          { px: 1.25, py: 1, color: '#fff', flexShrink: 0 },
          (t) => ({ bgcolor: WA_TEAL, ...t.applyStyles('dark', { bgcolor: '#202c33' }) })
        ]}
      >
        <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: WA_GREEN, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <IconRobot size={20} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }} noWrap>
            Simulador do bot
          </Typography>
          <Typography sx={{ fontSize: 11, opacity: 0.8 }} noWrap>
            {typing ? 'digitando…' : 'rascunho atual · nada é enviado'}
          </Typography>
        </Box>
        <Tooltip title={fast ? 'Rápido: pula as esperas' : 'Tempo real: respeita o "digitando…" (até 8 s)'}>
          <IconButton size="small" onClick={() => setFast((v) => !v)} sx={{ color: fast ? '#FDE68A' : 'rgba(255,255,255,0.85)' }}>
            <IconBolt size={18} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Reiniciar conversa">
          <IconButton size="small" onClick={restart} sx={{ color: 'rgba(255,255,255,0.9)' }}>
            <IconRefresh size={18} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Fechar simulador">
          <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.9)' }}>
            <IconX size={18} />
          </IconButton>
        </Tooltip>
      </Stack>

      {changed ? (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{
            px: 1.25,
            py: 0.6,
            bgcolor: hexA('#F59E0B', 0.14),
            borderBottom: '1px solid',
            borderColor: hexA('#F59E0B', 0.3),
            flexShrink: 0
          }}
        >
          <Typography sx={{ fontSize: 11.5, flex: 1, fontWeight: 600 }}>Você alterou o fluxo durante o teste.</Typography>
          <Button size="small" onClick={restart} sx={{ textTransform: 'none', fontWeight: 700, py: 0, color: '#B45309' }}>
            Reiniciar
          </Button>
        </Stack>
      ) : null}

      {/* cliente fictício (blocos de Cliente) */}
      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0 }}>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ px: 1.25, py: 0.6 }}>
          <Box sx={{ color: '#6D28D9', display: 'flex' }}>
            <IconUserCircle size={16} />
          </Box>
          <Typography sx={{ fontSize: 11.5, fontWeight: 700, flex: 1, minWidth: 0 }} noWrap>
            Cliente fictício:{' '}
            <Box component="span" sx={{ color: '#6D28D9' }}>
              {FIXTURE_PRESETS.find((p) => p.id === preset)?.label}
            </Box>
            {effRequireDoc ? ' · org exige CPF' : ''}
          </Typography>
          <Button
            size="small"
            onClick={() => setFixtureOpen((v) => !v)}
            sx={{ textTransform: 'none', fontWeight: 700, py: 0, minWidth: 0, color: WA_ACCENT }}
          >
            {fixtureOpen ? 'Ocultar' : 'Trocar'}
          </Button>
        </Stack>
        {fixtureOpen ? (
          <Box sx={{ px: 1.25, pb: 1 }}>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {FIXTURE_PRESETS.map((p) => {
                const on = p.id === preset;
                return (
                  <Tooltip key={p.id} title={p.hint} enterDelay={500}>
                    <Box
                      component="button"
                      type="button"
                      onClick={() => {
                        if (p.id === preset) return;
                        setPreset(p.id);
                        restart();
                      }}
                      sx={{
                        border: `1px solid ${on ? '#6D28D9' : hexA('#6D28D9', 0.35)}`,
                        bgcolor: on ? '#6D28D9' : 'transparent',
                        color: on ? '#fff' : '#6D28D9',
                        cursor: 'pointer',
                        borderRadius: 5,
                        px: 1,
                        py: 0.35,
                        fontWeight: 700,
                        fontSize: 11.5,
                        fontFamily: 'inherit'
                      }}
                    >
                      {p.label}
                    </Box>
                  </Tooltip>
                );
              })}
              <Tooltip
                title="Simula a organização exigindo CPF/CNPJ (o bloco “Identificar cliente” no modo Org passa a perguntar o documento)"
                enterDelay={500}
              >
                <Box
                  component="button"
                  type="button"
                  onClick={() => {
                    setRequireDoc(!effRequireDoc);
                    restart();
                  }}
                  sx={{
                    border: `1px dashed ${hexA('#6D28D9', 0.5)}`,
                    bgcolor: effRequireDoc ? hexA('#6D28D9', 0.12) : 'transparent',
                    color: '#6D28D9',
                    cursor: 'pointer',
                    borderRadius: 5,
                    px: 1,
                    py: 0.35,
                    fontWeight: 700,
                    fontSize: 11.5,
                    fontFamily: 'inherit'
                  }}
                >
                  {effRequireDoc ? '☑' : '☐'} Org exige CPF
                </Box>
              </Tooltip>
            </Stack>
            <Typography sx={{ fontSize: 10.5, color: 'text.secondary', mt: 0.6, lineHeight: 1.4 }}>
              {FIXTURE_PRESETS.find((p) => p.id === preset)?.hint}
              {preset !== 'none'
                ? ` Para identificar por documento responda ${SIM_DOC.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')} (código ${SIM_CODE}).`
                : ' Qualquer CPF válido dá “não encontrado”.'}
              {products?.length ? ' Usa os seus produtos ativos.' : ' Sem produtos cadastrados: usa 2 planos de exemplo.'} Nada é gravado.
            </Typography>
            <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: '#EA580C', mt: 1, mb: 0.5 }}>AGENDA FICTÍCIA</Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {[
                {
                  key: 'payment',
                  label: (BOOK_PAYMENTS.find((x) => x.id === book.payment) || BOOK_PAYMENTS[0]).label,
                  on: Boolean(book.payment),
                  hint: 'Troca a forma de pagamento de todos os serviços nesta simulação',
                  next: () => {
                    const i = BOOK_PAYMENTS.findIndex((x) => x.id === book.payment);
                    return { payment: BOOK_PAYMENTS[(i + 1) % BOOK_PAYMENTS.length].id };
                  }
                },
                {
                  key: 'no_slots',
                  label: 'Agenda lotada',
                  on: book.no_slots,
                  hint: 'Nenhum horário livre (testa a saída “Sem horário livre”)',
                  next: () => ({ no_slots: !book.no_slots })
                },
                {
                  key: 'conflict',
                  label: 'Conflito na reserva',
                  on: book.conflict,
                  hint: 'A 1ª reserva volta “horário acabou de ser reservado”',
                  next: () => ({ conflict: !book.conflict })
                },
                {
                  key: 'appts',
                  label: 'Com 2 agendamentos',
                  on: book.appts,
                  hint: 'O contato já tem 2 agendamentos (para “Meus agendamentos”)',
                  next: () => ({ appts: !book.appts })
                }
              ].map((o) => (
                <Tooltip key={o.key} title={o.hint} enterDelay={500}>
                  <Box
                    component="button"
                    type="button"
                    onClick={() => {
                      setBook((b) => ({ ...b, ...o.next() }));
                      restart();
                    }}
                    sx={{
                      border: `1px ${o.key === 'payment' ? 'solid' : 'dashed'} ${hexA('#EA580C', 0.5)}`,
                      bgcolor: o.on ? hexA('#EA580C', 0.12) : 'transparent',
                      color: '#C2410C',
                      cursor: 'pointer',
                      borderRadius: 5,
                      px: 1,
                      py: 0.35,
                      fontWeight: 700,
                      fontSize: 11.5,
                      fontFamily: 'inherit'
                    }}
                  >
                    {o.key === 'payment' ? o.label : `${o.on ? '☑' : '☐'} ${o.label}`}
                  </Box>
                </Tooltip>
              ))}
            </Stack>
            <Typography sx={{ fontSize: 10.5, color: 'text.secondary', mt: 0.6, lineHeight: 1.4 }}>
              {bookServices?.length ? 'Usa os seus serviços' : 'Sem serviços cadastrados: usa 2 serviços de exemplo'}; horários de seg a
              sáb, 9–12 h e 14–18 h. Nada é reservado.
            </Typography>
            <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: '#0369A1', mt: 1, mb: 0.5 }}>CHAMADOS FICTÍCIOS</Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {[
                {
                  key: 'tickets',
                  label: 'Com 3 chamados',
                  on: tk.tickets,
                  hint: 'O contato já tem 3 chamados (aguardando você, aberto e encerrado) para “Meus chamados”'
                },
                { key: 'fail', label: 'Falha ao abrir', on: tk.fail, hint: 'Abrir chamado volta erro (testa a saída “Deu erro”)' }
              ].map((o) => (
                <Tooltip key={o.key} title={o.hint} enterDelay={500}>
                  <Box
                    component="button"
                    type="button"
                    onClick={() => {
                      setTk((x) => ({ ...x, [o.key]: !x[o.key] }));
                      restart();
                    }}
                    sx={{
                      border: `1px dashed ${hexA('#0369A1', 0.5)}`,
                      bgcolor: o.on ? hexA('#0369A1', 0.12) : 'transparent',
                      color: '#0369A1',
                      cursor: 'pointer',
                      borderRadius: 5,
                      px: 1,
                      py: 0.35,
                      fontWeight: 700,
                      fontSize: 11.5,
                      fontFamily: 'inherit'
                    }}
                  >
                    {`${o.on ? '☑' : '☐'} ${o.label}`}
                  </Box>
                </Tooltip>
              ))}
            </Stack>
            <Typography sx={{ fontSize: 10.5, color: 'text.secondary', mt: 0.6, lineHeight: 1.4 }}>
              {ticketCategories?.length ? 'Usa as suas categorias' : 'Sem categorias carregadas: usa 3 de exemplo'}; o protocolo é fictício.
              Para mandar foto, use os botões que aparecem quando o bot pede um arquivo. Nada é gravado.
            </Typography>
            <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: '#4D7C0F', mt: 1, mb: 0.5 }}>PEDIDOS FICTÍCIOS</Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {[
                {
                  key: 'orders',
                  label: 'Tem pedidos',
                  on: ordFx.orders,
                  hint: 'O contato já tem 2 pedidos (um em preparo pago por PIX, um entregue) para “Meus pedidos” e a condição “Pedido”'
                },
                {
                  key: 'address',
                  label: 'Endereço salvo',
                  on: ordFx.address,
                  hint: 'O cliente tem 1 endereço de entrega salvo (o bot oferece antes de pedir para digitar)'
                }
              ].map((o) => (
                <Tooltip key={o.key} title={o.hint} enterDelay={500}>
                  <Box
                    component="button"
                    type="button"
                    onClick={() => {
                      setOrdFx((x) => ({ ...x, [o.key]: !x[o.key] }));
                      restart();
                    }}
                    sx={{
                      border: `1px dashed ${hexA('#4D7C0F', 0.5)}`,
                      bgcolor: o.on ? hexA('#65A30D', 0.14) : 'transparent',
                      color: '#4D7C0F',
                      cursor: 'pointer',
                      borderRadius: 5,
                      px: 1,
                      py: 0.35,
                      fontWeight: 700,
                      fontSize: 11.5,
                      fontFamily: 'inherit'
                    }}
                  >
                    {`${o.on ? '☑' : '☐'} ${o.label}`}
                  </Box>
                </Tooltip>
              ))}
            </Stack>
            <Typography sx={{ fontSize: 10.5, color: 'text.secondary', mt: 0.6, lineHeight: 1.4 }}>
              {(orderCatalog?.catalog?.categories || []).some((c) => (c.products || []).length)
                ? 'Usa o seu catálogo'
                : 'Sem produtos avulsos ativos: usa um catálogo de exemplo (Lanches e Bebidas)'}
              {orderCatalog?.settings ? ' e as suas configurações de pedidos' : ' com entrega (R$ 5,00) e retirada'}. O PIX do pedido é
              fictício: use os botões Pagou / Expirou. Nada é gravado.
            </Typography>
          </Box>
        ) : null}
      </Box>

      {/* conversa */}
      <Box
        ref={listRef}
        sx={[
          {
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            py: 1.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.75,
            backgroundImage: 'radial-gradient(rgba(0,0,0,0.05) 1px, transparent 1px)',
            backgroundSize: '14px 14px'
          },
          waBg('wallpaper')
        ]}
      >
        {items.length === 0 && !busy ? (
          <Box sx={{ m: 'auto', px: 3, textAlign: 'center' }}>
            <Box
              sx={{
                width: 60,
                height: 60,
                mx: 'auto',
                mb: 1.25,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
                background: `linear-gradient(135deg, ${WA_GREEN}, ${WA_DARK})`,
                boxShadow: `0 8px 20px ${hexA(WA_DARK, 0.35)}`
              }}
            >
              <IconRobot size={30} />
            </Box>
            <Typography sx={[{ fontWeight: 800, fontSize: 15 }, waFg('text')]}>Teste seu fluxo</Typography>
            <Typography sx={[{ fontSize: 12.5, mt: 0.5, lineHeight: 1.5 }, waFg('meta')]}>
              Escreva como se fosse o cliente. O teste usa o que está na tela agora, mesmo sem salvar — e nada é enviado ao WhatsApp.
            </Typography>
            <Stack direction="row" spacing={0.75} justifyContent="center" flexWrap="wrap" useFlexGap sx={{ mt: 1.75 }}>
              {['Oi', 'Olá, bom dia!', 'Quero saber o preço'].map((q) => (
                <Box
                  key={q}
                  component="button"
                  type="button"
                  onClick={() => run({ text: q })}
                  sx={[
                    {
                      border: 'none',
                      cursor: 'pointer',
                      px: 1.25,
                      py: 0.6,
                      borderRadius: 5,
                      fontFamily: 'inherit',
                      fontSize: 12.5,
                      fontWeight: 600,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.12)'
                    },
                    waBg('out'),
                    waFg('text')
                  ]}
                >
                  {q}
                </Box>
              ))}
            </Stack>
          </Box>
        ) : null}

        {items.map((it) => {
          if (it.kind === 'user')
            return (
              <Bubble key={it.id} mine time={it.at}>
                {it.media ? (
                  <Stack
                    direction="row"
                    spacing={0.75}
                    alignItems="center"
                    sx={{ p: 0.75, mb: it.text ? 0.5 : 0.2, borderRadius: 1.5, bgcolor: 'rgba(0,0,0,0.07)' }}
                  >
                    {it.media.kind === 'document' ? <IconFileText size={20} /> : <IconPhoto size={20} />}
                    <Typography sx={{ fontSize: 12, fontWeight: 600 }}>
                      {it.media.failed
                        ? 'Arquivo que não chegou (simulado)'
                        : it.media.kind === 'document'
                          ? 'documento.pdf (simulado)'
                          : 'Foto (simulada)'}
                    </Typography>
                  </Stack>
                ) : null}
                {it.text ? <WaText text={it.text} /> : null}
              </Bubble>
            );
          if (it.kind === 'bot')
            return (
              <Bubble key={it.id} time={it.at}>
                <BotMessage message={it.message} />
              </Bubble>
            );
          if (it.kind === 'pix') return <PixCard key={it.id} item={it} />;
          if (it.kind === 'tags')
            return (
              <Note key={it.id} icon={IconTags} tone="brand">
                <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
                  <span>Etiquetas:</span>
                  {(it.add || []).map((t) => (
                    <TagChip key={`a-${t.id || t.name}`} tag={t} prefix="+" />
                  ))}
                  {(it.remove || []).map((t) => (
                    <TagChip key={`r-${t.id || t.name}`} tag={t} prefix="−" />
                  ))}
                </Stack>
              </Note>
            );
          if (it.kind === 'end')
            return (
              <Note key={it.id} icon={IconCircleCheck} tone="ok">
                O fluxo terminou. Mande outra mensagem para começar de novo.
              </Note>
            );
          if (it.kind === 'divider')
            return (
              <Stack key={it.id} direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 0.5 }}>
                <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
                <Typography sx={[{ fontSize: 11, fontWeight: 700 }, waFg('meta')]}>{it.text}</Typography>
                <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
              </Stack>
            );
          return (
            <Note key={it.id} icon={it.icon} tone={it.tone}>
              {it.text}
            </Note>
          );
        })}

        {typing ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25 }}>
            <Box
              sx={[
                {
                  px: 1.4,
                  py: 1.1,
                  borderRadius: '9px',
                  borderTopLeftRadius: '3px',
                  boxShadow: '0 1px 1px rgba(0,0,0,0.13)',
                  display: 'flex'
                },
                waBg('in'),
                waFg('meta')
              ]}
            >
              <TypingDots size={6} />
            </Box>
            {!fast ? (
              <Tooltip title="Pular a espera">
                <IconButton size="small" onClick={() => skipRef.current?.()} sx={[{ p: 0.5 }, waFg('meta')]}>
                  <IconPlayerSkipForward size={15} />
                </IconButton>
              </Tooltip>
            ) : null}
          </Box>
        ) : null}
        {busy && !typing ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.5 }}>
            <CircularProgress size={16} sx={{ color: WA_ACCENT }} />
          </Box>
        ) : null}
      </Box>

      {/* ações de evento */}
      {(pending.pix || pending.wait || pending.charge) && !busy ? (
        <Stack
          direction="row"
          spacing={0.75}
          flexWrap="wrap"
          useFlexGap
          sx={{ px: 1.25, py: 0.9, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0 }}
        >
          {pending.pix ? (
            <>
              <Button
                size="small"
                variant="contained"
                disableElevation
                startIcon={<IconCircleCheck size={16} />}
                onClick={() => run({ event: 'pix_paid' })}
                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, bgcolor: '#16A34A', '&:hover': { bgcolor: '#15803D' } }}
              >
                Simular pagamento
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<IconHourglass size={16} />}
                onClick={() => run({ event: 'pix_expired' })}
                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, color: '#C2410C', borderColor: hexA('#EA580C', 0.5) }}
              >
                Simular expiração
              </Button>
            </>
          ) : null}
          {pending.charge ? (
            <>
              <Button
                size="small"
                variant="contained"
                disableElevation
                startIcon={<IconCircleCheck size={16} />}
                onClick={() => run({ event: 'charge_paid', event_payload: { charge_id: pending.charge } })}
                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, bgcolor: '#16A34A', '&:hover': { bgcolor: '#15803D' } }}
              >
                Pagou
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<IconHourglass size={16} />}
                onClick={() => run({ event: 'charge_expired', event_payload: { charge_id: pending.charge } })}
                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, color: '#C2410C', borderColor: hexA('#EA580C', 0.5) }}
              >
                Expirou
              </Button>
            </>
          ) : null}
          {pending.wait ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={<IconPlayerSkipForward size={16} />}
              onClick={() => run({ event: 'wait_done' })}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, color: WA_ACCENT, borderColor: hexA(WA_DARK, 0.5) }}
            >
              Pular espera
            </Button>
          ) : null}
        </Stack>
      ) : null}

      {/* arquivo fictício do cliente (blocos de chamado) */}
      {MEDIA_WAITS.has(waitingFor) && !busy && !endedRef.current ? (
        <Stack
          direction="row"
          spacing={0.75}
          flexWrap="wrap"
          useFlexGap
          sx={{ px: 1.25, py: 0.9, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0 }}
        >
          <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600, alignSelf: 'center', whiteSpace: 'nowrap' }}>
            Mandar arquivo:
          </Typography>
          {[
            { kind: 'image', label: 'Foto', icon: IconPhoto },
            { kind: 'document', label: 'Documento', icon: IconFileText },
            { kind: 'image', failed: true, label: 'Arquivo que falhou', icon: IconX }
          ].map((m) => (
            <Button
              key={m.label}
              size="small"
              variant="outlined"
              startIcon={<m.icon size={15} />}
              onClick={() => run({ text: input, media: { kind: m.kind, ...(m.failed ? { failed: true } : {}) } })}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, py: 0.2, color: WA_ACCENT, borderColor: hexA(WA_DARK, 0.4) }}
            >
              {m.label}
            </Button>
          ))}
        </Stack>
      ) : null}

      {/* atalhos numéricos */}
      {quick.length ? (
        <Stack
          direction="row"
          spacing={0.5}
          sx={{
            px: 1.25,
            pt: 0.9,
            bgcolor: 'background.paper',
            borderTop: '1px solid',
            borderColor: 'divider',
            flexShrink: 0,
            overflowX: 'auto'
          }}
        >
          <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600, alignSelf: 'center', mr: 0.25, whiteSpace: 'nowrap' }}>
            Responder:
          </Typography>
          {quick.map((n) => (
            <Box
              key={n}
              component="button"
              type="button"
              onClick={() => run({ text: String(n) })}
              sx={{
                border: `1px solid ${hexA(WA_DARK, 0.4)}`,
                bgcolor: hexA(WA_GREEN, 0.08),
                color: WA_ACCENT,
                cursor: 'pointer',
                borderRadius: 5,
                minWidth: 30,
                px: 1,
                py: 0.3,
                fontWeight: 800,
                fontSize: 12.5,
                fontFamily: 'inherit',
                '&:hover': { bgcolor: hexA(WA_GREEN, 0.18) }
              }}
            >
              {n}
            </Box>
          ))}
        </Stack>
      ) : null}

      {/* campo de mensagem */}
      <Stack
        direction="row"
        spacing={1}
        alignItems="flex-end"
        sx={[{ px: 1, py: 1, flexShrink: 0 }, (t) => ({ bgcolor: '#f0f2f5', ...t.applyStyles('dark', { bgcolor: '#202c33' }) })]}
      >
        <Box
          sx={[
            { flex: 1, px: 1.5, py: 0.9, borderRadius: 5, minWidth: 0 },
            (t) => ({ bgcolor: '#fff', ...t.applyStyles('dark', { bgcolor: '#2a3942' }) })
          ]}
        >
          <InputBase
            inputRef={inputRef}
            fullWidth
            multiline
            maxRows={4}
            placeholder={endedRef.current ? 'Mande algo para recomeçar…' : 'Mensagem do cliente'}
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 1000))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                run({ text: input });
              }
            }}
            sx={[{ fontSize: 14, p: 0 }, waFg('text')]}
          />
        </Box>
        <IconButton
          onClick={() => run({ text: input })}
          disabled={busy || !input.trim()}
          sx={{
            width: 42,
            height: 42,
            flexShrink: 0,
            color: '#fff',
            bgcolor: WA_GREEN,
            '&:hover': { bgcolor: WA_DARK },
            '&.Mui-disabled': { color: '#fff', bgcolor: hexA(WA_GREEN, 0.45) }
          }}
        >
          {busy ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <IconSend2 size={19} />}
        </IconButton>
      </Stack>
    </Box>
  );
}
