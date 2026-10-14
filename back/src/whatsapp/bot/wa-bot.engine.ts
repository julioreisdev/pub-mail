// Interpretador PURO do Fluxo do Bot do WhatsApp (sem banco, sem rede).
// Recebe a definição (grafo do construtor), o estado da conversa e a entrada do
// cliente e devolve { state, actions }. O runtime executa as ações de verdade
// (envia pelo WhatsApp, etiqueta, transfere, cobra PIX, consulta/cria cliente,
// assina, cancela…) e o simulador só as mostra.
//
// Definição: { nodes: [{id,type,position,data}], edges: [{id,source,sourceHandle,target}] }
// Tipos: start · message · menu · question · condition · tags · wait · pix · handoff · end
//        + blocos de CRM (Fase 2 das assinaturas, contrato em docs/whatsapp-assinaturas-contrato.md §1):
//        crm_identify · crm_register · crm_subscribe · crm_info · crm_invoice · crm_cancel ·
//        crm_pause · crm_change_plan · crm_update
//        + blocos de agenda (Fase 6, contrato §9.4): book_service · my_appointments · waitlist_join
//        + blocos de chamados (Fase 6B, contrato §10.5): open_ticket · my_tickets
//        + blocos de pedidos (Fase 7, contrato §11.3): order_cart · my_orders
//        + campos personalizados perguntados pelo bot (Fase 7, contrato §11.1) em crm_register / open_ticket / order_cart
import { cnpjOk, cpfOk, maskDoc } from '../wa-doc.util';
import { coerceCustomValue } from '../wa-custom-fields.util';

export type BotNode = { id: string; type: string; data?: any; position?: any };
export type BotEdge = { id?: string; source: string; sourceHandle?: string | null; target: string };
export type BotDefinition = { nodes: BotNode[]; edges: BotEdge[] };

export type BotStatus = 'active' | 'waiting' | 'done' | 'handoff' | 'stopped';
export type BotWaitingFor =
  | 'menu'
  | 'question'
  | 'pix'
  | 'wait'
  | 'crm_identify'
  | 'crm_choose'
  | 'crm_register'
  | 'crm_confirm'
  | 'crm_subscribe'
  | 'crm_cancel'
  | 'crm_pause'
  | 'crm_change_plan'
  | 'crm_update'
  | 'crm_wait' // ação de CRM enviada ao runtime; espera `crm_result`
  | 'charge' // cobrança criada; espera `charge_paid|charge_expired`
  // --- agenda (Fase 6): sub-etapas dos blocos book_service / my_appointments / waitlist_join
  | 'book:service'
  | 'book:resource'
  | 'book:day'
  | 'book:time'
  | 'book:confirm'
  | 'book:period'
  | 'book:wait' // ação de agenda enviada ao runtime; espera `book_result`
  | 'appt:choose'
  | 'appt:action'
  | 'appt:cancel'
  // --- chamados (Fase 6B): sub-etapas dos blocos open_ticket / my_tickets
  | 'ticket:category'
  | 'ticket:subject'
  | 'ticket:description'
  | 'ticket:photo'
  | 'ticket:choose' // Meus chamados: escolher um da lista (ou digitar o protocolo)
  | 'ticket:action' // detalhes mostrados: "1 Enviar mais informações · 0 Voltar"
  | 'ticket:info' // esperando o texto/foto a juntar ao chamado
  | 'ticket:wait' // ação de chamado enviada ao runtime; espera `crm_result`
  | 'ticket:custom' // campo personalizado do chamado (ask_in_bot)
  // --- pedidos (Fase 7): sub-etapas dos blocos order_cart / my_orders
  | 'order:category'
  | 'order:product'
  | 'order:qty'
  | 'order:cart'
  | 'order:delivery'
  | 'order:address' // escolher um endereço salvo (ou "digitar outro")
  | 'order:address_text' // digitando o endereço
  | 'order:address_confirm'
  | 'order:custom' // campo personalizado do pedido (ask_in_bot)
  | 'order:notes'
  | 'order:payment'
  | 'order:confirm'
  | 'order:choose' // Meus pedidos: escolher um da lista
  | 'order:wait' // ação de pedido enviada ao runtime; espera `crm_result`
  | null;

export type BotCrmStep = {
  step?: number | string;
  fields?: Record<string, string>;
  options?: { id: string; label: string }[];
  purpose?: string;
  subscription_id?: string | null;
  product_id?: string | null;
  method?: string | null;
  reason?: string | null;
  cf?: BotCustomField[]; // campos personalizados de CLIENTE perguntados no cadastro (snapshot ao entrar no bloco)
};
export type BotCharge = {
  id: string;
  amount_cents: number;
  description: string;
  due_at: string | null;
  pix_code?: string | null;
  boleto_url?: string | null;
  pay_link?: string | null;
  sent?: boolean; // pedidos: o runtime já mandou a mensagem da cobrança (QR/código) — o motor não repete o código
};

/**
 * Campo personalizado (Fase 7, contrato §11.1) — mesmo formato de `CfDef` (wa-custom-fields.util). O runtime entrega
 * as definições em `ctx.custom_fields`; o motor pergunta os com `ask_in_bot` (e os obrigatórios — sem eles a criação
 * falharia) e mostra os com `visible_to_customer` nas consultas.
 */
export type BotCustomField = {
  key: string;
  label: string;
  type: string; // text|number|date|select|bool|phone|email|cpf
  required?: boolean;
  options?: string[];
  visible_to_customer?: boolean;
  ask_in_bot?: boolean;
  help?: string;
};
export type BotCustomFieldMap = { customer?: BotCustomField[]; ticket?: BotCustomField[]; order?: BotCustomField[] };

// --- pedidos (Fase 7, contrato §11.3) — formatos que o runtime entrega ao motor
export type BotCatalogProduct = { id: string; name: string; description?: string | null; price_cents: number; price_label?: string };
export type BotCatalogCategory = { name: string; products: BotCatalogProduct[] };
export type BotOrderSettings = {
  enabled?: boolean;
  delivery?: { enabled?: boolean; fee_cents?: number; free_from_cents?: number };
  pickup?: { enabled?: boolean; address?: string };
  min_order_cents?: number;
  payment_methods?: string[];
  max_items?: number;
};
export type BotAddress = {
  id: string;
  kind?: string; // service | delivery | billing | other (cobrança nunca é oferecida)
  label?: string | null;
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  zip?: string;
  is_default?: boolean;
};
export type BotOrder = {
  id: string;
  number: number | string;
  status: string; // new|confirmed|preparing|out_for_delivery|delivered|canceled
  status_label?: string;
  payment_method?: string;
  payment_method_label?: string;
  payment_status?: string; // pending|paid|not_required
  payment_status_label?: string;
  items_text?: string;
  subtotal_cents?: number;
  delivery_fee_cents?: number;
  total_cents?: number;
  total_label?: string;
  delivery_text?: string;
  created_at?: string | null;
  charge?: { id: string; status?: string; pix_code?: string | null } | null;
  custom?: Record<string, unknown>;
  fields?: { key?: string; label: string; display: string }[]; // campos visíveis ao cliente (já formatados)
};
export type BotCartItem = { product_id: string; name: string; qty: number; unit_cents: number };
export type BotOrderFlow = {
  mode: 'cart' | 'mine';
  step: string; // catalog | category | product | qty | cart | delivery | address | custom | notes | payment | confirm | create | list | done
  options?: BotBookOption[];
  categories?: BotCatalogCategory[];
  settings?: BotOrderSettings | null;
  modes?: ('delivery' | 'pickup')[]; // formas de receber oferecidas (configuração ∩ bloco)
  pms?: string[]; // formas de pagamento oferecidas (configuração ∩ bloco)
  addresses?: BotAddress[]; // endereços salvos do cliente (entrega/serviço/outro)
  category?: string | null;
  page?: number;
  product?: BotCatalogProduct | null;
  qty?: number | null; // última quantidade adicionada (texto "Adicionei")
  cart?: BotCartItem[];
  delivery?: 'delivery' | 'pickup' | null;
  address?: BotAddress | null;
  address_id?: string | null;
  cf?: BotCustomField[]; // campos personalizados do PEDIDO perguntados (snapshot)
  cf_i?: number;
  custom?: Record<string, unknown>;
  notes?: string | null;
  payment?: string | null; // pix | on_delivery | none
  orders?: BotOrder[];
  order?: BotOrder | null; // criado / escolhido em "Meus pedidos"
};

// --- agenda (Fase 6, contrato §9.3/§9.4) — formatos que o runtime entrega ao motor
export type BotService = {
  id: string;
  name: string;
  description?: string | null;
  price_cents: number;
  price_label?: string;
  duration_minutes?: number;
  duration_label?: string;
  booking?: { payment?: string; deposit_cents?: number; address?: string | null } | null;
  resources?: { id: string; name: string }[]; // ausente = o motor pede `book_resources`
};
export type BotSlot = {
  starts_at: string; // ISO (UTC)
  ends_at?: string;
  time_label?: string; // "14:30"
  resource_id: string | null;
  resource_name?: string;
  left?: number;
};
export type BotDay = { date: string; label?: string; slots: BotSlot[] };
export type BotAppointment = {
  id: string;
  status: string; // pending_payment|booked|confirmed|in_progress|done|canceled|no_show|expired
  payment?: string;
  starts_at: string;
  ends_at?: string;
  date_label?: string;
  time_label?: string;
  resource?: { id: string; name: string } | null;
  product_id?: string | null;
  service_name?: string;
  price_cents?: number;
  price_label?: string;
  paid_cents?: number;
  charge?: { id: string; status?: string; pix_code?: string | null; pay_link?: string | null; amount_cents?: number } | null;
  cancel_deadline?: string | null;
  can_cancel_free?: boolean;
  can_reschedule?: boolean;
  address?: string | null;
};
export type BotBookOption = { id: string; label: string; keywords?: string[] };
export type BotBooking = {
  mode: 'book' | 'manage' | 'waitlist';
  step: string; // services|resources|availability|create|list|confirm_appt|cancel_appt|reschedule|waitlist|done
  options?: BotBookOption[];
  services?: BotService[]; // serviços oferecidos na lista atual
  service?: BotService | null; // escolhido
  resource_id?: string | null; // null = qualquer recurso livre
  resource_name?: string | null;
  days?: { date: string; label: string; count: number }[]; // resumo da disponibilidade
  day_page?: number;
  date?: string | null; // dia escolhido (YYYY-MM-DD, BRT)
  day_label?: string | null;
  slots?: BotSlot[]; // horários do dia escolhido
  page?: number;
  slot?: BotSlot | null; // horário escolhido
  conflicts?: number;
  appointments?: BotAppointment[];
  appointment?: BotAppointment | null; // em foco (criado, escolhido em "Meus agendamentos")
  period?: string | null;
};

// --- chamados (Fase 6B, contrato §10.5) — formatos que o runtime entrega ao motor
export type BotTicketCategory = { key: string; label: string; description?: string | null; active?: boolean };
export type BotTicket = {
  id: string;
  protocol: string;
  status: string; // open | pending | resolved | closed
  status_label?: string; // rótulo para o CLIENTE ("Aguardando você")
  category?: string;
  category_label?: string;
  subject?: string;
  priority?: string;
  priority_label?: string;
  sla_label?: string; // "15/10 às 14:30"
  sla_relative?: string; // "em 2 h"
  last_update?: string | null; // última atualização pública da equipe (texto)
  created_at?: string | null;
  media_count?: number;
  can_add_info?: boolean; // false = só leitura nesta conversa (cliente visto só pelo código)
  fields?: { key?: string; label: string; display: string }[]; // campos personalizados visíveis ao cliente (Fase 7)
};
export type BotTicketFlow = {
  mode: 'open' | 'mine';
  step: string; // categories | create | list | lookup | add_info | done
  options?: BotBookOption[];
  categories?: BotTicketCategory[];
  category?: BotTicketCategory | null;
  subject?: string | null;
  description?: string | null;
  media_ids?: string[];
  tickets?: BotTicket[];
  ticket?: BotTicket | null; // em foco (criado / escolhido em "Meus chamados")
  misses?: number; // protocolos não encontrados (sobrevive à ida ao runtime)
  cf?: BotCustomField[]; // campos personalizados do CHAMADO perguntados antes de abrir (snapshot)
  cf_i?: number;
  custom?: Record<string, unknown>;
};
/** Arquivo que o cliente mandou junto com a mensagem (o runtime passa ao `handleInput`). */
export type BotInputMedia = { id: string | null; kind: string; mime?: string | null; filename?: string | null };

export type BotState = {
  node_id: string | null;
  status: BotStatus;
  waiting_for: BotWaitingFor;
  vars: Record<string, string>;
  retries: number;
  wait_until: string | null;
  last_input: string | null;
  pix: { amount_cents: number; description: string; code?: string | null; payment_id?: string | null } | null;
  customer_id: string | null;
  crm: BotCrmStep | null;
  charge: BotCharge | null;
  book: BotBooking | null;
  ticket?: BotTicketFlow | null; // chamados (Fase 6B); o runtime persiste em `vars.__ticket`
  order?: BotOrderFlow | null; // pedidos (Fase 7); o runtime persiste em `vars.__order`
};

export type BotSubscription = {
  id: string;
  product_id: string | null;
  product_name: string;
  price_cents: number;
  price_label: string;
  billing: string;
  status: string;
  next_due_at: string | null; // YYYY-MM-DD
  next_due_label?: string;
  days_overdue: number;
  due_day: number | null;
  cancel_at: string | null;
  paused_until: string | null;
};
export type BotOpenCharge = {
  id: string;
  amount_cents: number;
  amount_label: string;
  description: string;
  due_at: string; // YYYY-MM-DD
  due_label?: string;
  days_overdue: number;
  kind: string;
  pix_code: string | null;
  boleto_url: string | null;
  status: string;
};
export type BotCustomer = {
  id: string;
  name: string;
  first_name: string;
  doc_masked: string;
  code: string;
  email: string;
  status: 'ok' | 'overdue' | 'none' | 'inactive' | 'paused';
  verified: boolean;
  custom: Record<string, string>;
  subscriptions: BotSubscription[];
  open_charges: BotOpenCharge[];
};
export type BotProduct = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  price_label: string;
  billing: string;
  billing_label: string;
  trial_days: number;
  cancel_policy: 'end_of_cycle' | 'immediate';
  active: boolean;
  kind?: string; // product | plan | service (serviço = agenda; nunca entra em menu/assinatura)
};
export type BotIdentity = {
  require_doc: boolean;
  use_code: boolean;
  code_label: string;
  ask_doc_text: string;
  doc_not_found_text: string;
  doc_invalid_text: string;
};

export type BotMedia = { id?: string; url?: string; kind?: string; mime?: string; filename?: string } | null;
export type BotAction =
  | { type: 'typing'; ms: number }
  | { type: 'send'; delay_ms: number; message: { kind: 'text' | 'image' | 'video' | 'audio' | 'document'; text?: string; media?: BotMedia } }
  | { type: 'tags'; add: string[]; remove: string[] }
  | { type: 'set_var'; name: string; value: string }
  | { type: 'save_contact'; field: 'name' | 'email'; value: string }
  | { type: 'handoff'; assign_user_id: string | null }
  | { type: 'close' }
  | { type: 'finish' }
  | { type: 'pix'; node_id: string; amount_cents: number; description: string; text: string; send_qr: boolean; expires_minutes: number }
  | { type: 'pix_check' }
  | { type: 'wait'; seconds: number }
  | { type: 'info'; text: string }
  // --- CRM (o runtime executa e devolve `crm_result`; o simulador resolve em memória)
  | { type: 'crm_lookup'; by: 'doc' | 'code'; value: string }
  | { type: 'crm_create_customer'; fields: Record<string, string>; link_role: string }
  | { type: 'crm_subscribe'; product_id: string; method: 'pix' | 'boleto'; charge_now: boolean; node_id: string }
  | { type: 'crm_send_charge'; charge_id: string; method: 'same' | 'pix' | 'boleto' | 'both' }
  | { type: 'charge_check'; charge_id: string }
  | { type: 'crm_cancel_subscription'; subscription_id: string; reason: string | null; policy: 'product' | 'immediate' | 'end_of_cycle' }
  | { type: 'crm_pause_subscription'; subscription_id: string; days: number }
  | { type: 'crm_change_plan'; subscription_id: string; product_id: string }
  | { type: 'crm_update_customer'; fields: Record<string, string> }
  // --- agenda (o runtime chama o WhatsAppSchedulingService e devolve `book_result`; o simulador resolve em memória)
  | { type: 'book_services'; node_id: string }
  | { type: 'book_resources'; product_id: string }
  | { type: 'book_availability'; product_id: string; resource_id: string | null; from: string; days: number }
  | { type: 'book_create'; product_id: string; resource_id: string | null; starts_at: string; node_id: string }
  | { type: 'book_reschedule'; appointment_id: string; starts_at: string; resource_id: string | null }
  | { type: 'appt_list' }
  | { type: 'appt_confirm'; id: string }
  | { type: 'appt_cancel'; id: string; reason: string | null }
  | { type: 'waitlist_join'; product_id: string; resource_id: string | null; period: string; date_from: string; date_to: string }
  // --- chamados (o runtime chama o WhatsAppTicketsService e devolve `crm_result`; o simulador resolve em memória)
  | { type: 'ticket_categories'; node_id: string }
  | { type: 'ticket_create'; node_id: string; category: string; subject: string | null; description: string; priority: string | null; media_ids: string[]; custom?: Record<string, unknown> }
  | { type: 'ticket_list'; show: 'active' | 'all'; limit: number }
  | { type: 'ticket_lookup'; protocol: string }
  | { type: 'ticket_add_info'; id: string; body: string; media_id: string | null }
  // --- pedidos (o runtime chama o WhatsAppOrdersService e devolve `crm_result`; o simulador resolve em memória)
  | { type: 'order_catalog'; node_id: string }
  | {
      type: 'order_create';
      node_id: string;
      items: { product_id: string; qty: number }[];
      delivery: { mode: 'delivery' | 'pickup'; address_id?: string | null; address?: BotAddress | null };
      payment_method: string; // pix | on_delivery | none
      notes: string | null;
      custom: Record<string, unknown>;
    }
  | { type: 'order_list'; show: 'open' | 'all'; limit: number };

export type BotEvent = 'wait_done' | 'pix_paid' | 'pix_expired' | 'crm_result' | 'charge_paid' | 'charge_expired' | 'book_result';
export type BotEventPayload = {
  ok?: boolean;
  error?: string; // técnico (log/simulador)
  user_text?: string; // recusa amigável, no lugar do `failed_text` (ex.: "confirme o CPF para alterar")
  customer?: BotCustomer | null;
  customers?: BotCustomer[];
  subscription?: BotSubscription;
  charge?: BotCharge | null;
  product?: BotProduct;
  charge_id?: string;
  // --- agenda (`book_result`)
  code?: string; // SLOT_TAKEN | CONTACT_BUSY | CUSTOMER_REQUIRED | …
  services?: BotService[];
  resources?: { id: string; name: string }[];
  days?: BotDay[];
  appointment?: BotAppointment | null;
  appointments?: BotAppointment[];
  // --- chamados (`crm_result` de uma ação `ticket_*`)
  categories?: BotTicketCategory[];
  ticket?: BotTicket | null;
  tickets?: BotTicket[];
  // --- pedidos (`crm_result` de uma ação `order_*`; `charge_paid|charge_expired` também podem trazer o pedido)
  catalog?: { categories: BotCatalogCategory[] } | null;
  order_settings?: BotOrderSettings | null;
  addresses?: BotAddress[];
  order?: BotOrder | null;
  orders?: BotOrder[];
};

export type BusinessHours = {
  enabled?: boolean;
  days?: Record<string, { start: string; end: string }[]>;
  outside_text?: string;
  outside_action?: 'message_and_continue' | 'message_and_handoff' | 'message_only';
};

export type BotSettings = {
  audience?: { mode?: 'all' | 'test' | 'tags'; test_chat_ids?: string[]; tag_ids?: string[] };
  trigger?: { mode?: 'any' | 'keywords'; keywords?: string[] };
  restart_keywords?: string[];
  exclude_tag_ids?: string[];
  input_timeout_hours?: number;
  invalid_option_text?: string;
  max_retries?: number;
  typing?: boolean;
  numbering?: 'emoji' | 'number';
  business_hours?: BusinessHours;
};

export type BotContext = {
  contact: { name?: string | null; phone?: string | null; saved?: boolean };
  vars?: Record<string, string>; // {{cliente.*}} do CRM (vazio quando não é cliente)
  chatTagIds: string[];
  now: Date;
  settings: BotSettings;
  // --- CRM (opcionais no tipo para o runtime antigo compilar; o motor trata ausência como "sem cliente / sem produto")
  customer?: BotCustomer | null; // cliente do número (1º) — o motor troca ao identificar
  customers?: BotCustomer[]; // todos os clientes vinculados ao número
  products?: BotProduct[]; // produtos ATIVOS da org
  identity?: BotIdentity;
  cancel_reasons?: string[];
  // --- agenda (opcional): próximos agendamentos do contato/cliente (condições e {{agendamento.*}} fora dos blocos de agenda)
  appointments?: BotAppointment[];
  no_shows?: number; // faltas do cliente (senão lê `cliente.custom.no_shows`)
  // --- chamados (opcional): chamados EM ANDAMENTO (aberto/aguardando) do contato/cliente — condições e {{chamado.*}}
  tickets?: BotTicket[];
  // --- pedidos (opcional): pedidos EM ANDAMENTO do contato/cliente — condição `source:'order'` e {{pedido.*}} fora dos blocos
  orders?: BotOrder[];
  // --- campos personalizados por entidade (Fase 7): perguntados (ask_in_bot) e mostrados (visible_to_customer)
  custom_fields?: BotCustomFieldMap;
};

const MAX_STEPS = 60;
// construídos por código (escapes \u escritos direto no arquivo viram caractere literal)
const COMBINING_MARKS = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, 'g');
const KEYCAP_RE = new RegExp(`^(\\d)${String.fromCharCode(0xfe0f)}?${String.fromCharCode(0x20e3)}$`);
export const DEFAULT_INVALID = 'Não entendi 🤔 Responda com o número de uma das opções.';
export const DEFAULT_UNAVAILABLE = 'Essa opção não está disponível no momento 😕 Escolha outra:';

// ---------------------------------------------------------------- utilitários
export function norm(v: unknown) {
  return String(v ?? '')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s#]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const KEYCAPS = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
function keycapToNumber(s: string) {
  const t = String(s || '').trim();
  const i = KEYCAPS.indexOf(t);
  if (i >= 0) return String(i);
  // "1️⃣" pode chegar como "1️⃣"
  const m = KEYCAP_RE.exec(t);
  return m ? m[1] : null;
}

export function formatBRL(cents: number) {
  return (Math.max(0, Number(cents) || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** 'YYYY-MM-DD' (ou ISO) → 'DD/MM/AAAA'; vazio quando não dá para ler. */
export function fmtDateBR(v: string | null | undefined) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v || '');
}

const STATUS_LABEL: Record<string, string> = { ok: 'em dia', overdue: 'em atraso', none: 'sem assinatura', inactive: 'inativo', paused: 'pausada' };
const SUB_STATUS_LABEL: Record<string, string> = { active: 'em dia', overdue: 'em atraso', paused: 'pausada', canceled: 'cancelada' };
// `once` (avulso) fica sem período de propósito (contrato §1.5: produto.periodo = "")
const PERIOD_LONG: Record<string, string> = { monthly: ' por mês', quarterly: ' por trimestre', semiannual: ' por semestre', yearly: ' por ano', once: '' };
const PERIOD_SHORT: Record<string, string> = { monthly: '/mês', quarterly: '/trimestre', semiannual: '/semestre', yearly: '/ano', once: '' };
export const periodOf = (billing: string | null | undefined) => PERIOD_LONG[String(billing || '')] || '';
export const productLabel = (p: Pick<BotProduct, 'name' | 'price_cents' | 'price_label' | 'billing'>) =>
  `${p.name} · ${p.price_label || formatBRL(p.price_cents)}${PERIOD_SHORT[String(p.billing || '')] || ''}`;

const LIVE_SUB = new Set(['active', 'overdue', 'paused']);
const liveSubs = (c: BotCustomer | null | undefined) => (c?.subscriptions || []).filter((s) => LIVE_SUB.has(String(s.status)));
/** Assinaturas que podem trocar de plano: active|overdue, sem cancelamento agendado, recorrentes (não avulsas). */
const changeableSubs = (c: BotCustomer | null | undefined) =>
  (c?.subscriptions || []).filter((s) => (s.status === 'active' || s.status === 'overdue') && !s.cancel_at && String(s.billing || '') !== 'once');

/**
 * Cliente "atual" da conversa: o identificado (state.customer_id) ou, sem identificação, o do número.
 * Identificado que NÃO está mais no contexto (vínculo desfeito, cliente apagado) → null — nunca cai
 * no cliente do número por engano.
 */
export function currentCustomer(state: BotState, ctx: BotContext): BotCustomer | null {
  if (state.customer_id) {
    return (ctx.customers || []).find((c) => c.id === state.customer_id) || (ctx.customer?.id === state.customer_id ? ctx.customer : null) || null;
  }
  return ctx.customer || null;
}

/** Data de `d` em Brasília como 'YYYY-MM-DD' (en-CA formata nessa ordem). */
function brtDate(d: Date) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** Variáveis do CRM (§1.5 do contrato) a partir do cliente/assinatura/cobrança/produto em foco. */
export function customerVars(state: BotState, ctx: BotContext, extra?: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  const c = currentCustomer(state, ctx);
  const subs = liveSubs(c);
  const sub = (state.crm?.subscription_id ? (c?.subscriptions || []).find((s) => s.id === state.crm?.subscription_id) : null) || subs[0] || null;
  const opens = c?.open_charges || [];
  const stateCharge = state.charge;
  const openOfState = stateCharge ? opens.find((o) => o.id === stateCharge.id) : null;
  const charge = stateCharge || opens[0] || null;
  const product =
    (state.crm?.product_id ? (ctx.products || []).find((p) => p.id === state.crm?.product_id) : null) ||
    (sub ? (ctx.products || []).find((p) => p.id === sub.product_id) : null) ||
    null;

  // campos personalizados PRIMEIRO: um campo chamado "nome"/"status" não pode sobrescrever os fixos
  const cfDefs = ctx.custom_fields?.customer || [];
  for (const [k, v] of Object.entries(c?.custom || {})) {
    const key = String(k).toLowerCase();
    const def = cfDefs.find((f) => f.key === key);
    const shown = def ? cfDisplay(def, v) : String(v ?? '');
    out[`cliente.${key}`] = shown;
    out[`cliente.custom.${key}`] = shown;
  }
  for (const f of cfDefs) if (!(`cliente.custom.${f.key}` in out)) out[`cliente.custom.${f.key}`] = '';
  // campos que o cliente pode ver (consulta "Meus dados"): "\n*Rótulo:* valor" — vazio quando não há nenhum
  out['cliente.campos'] = cfLines(cfDefs, c?.custom || {}, '*', ':*');

  const name = String(c?.name || '').trim();
  out['cliente.nome'] = name;
  out['cliente.primeiro_nome'] = String(c?.first_name || name.split(/\s+/)[0] || '');
  out['cliente.documento'] = String(c?.doc_masked || '');
  out['cliente.codigo'] = String(c?.code || '');
  out['cliente.email'] = String(c?.email || '');
  out['cliente.status'] = STATUS_LABEL[String(c?.status || 'none')] || String(c?.status || '');
  out['cliente.produto'] = String(subs[0]?.product_name || '');
  out['cliente.produtos'] = subs.map((s) => s.product_name).join(', ');
  out['cliente.valor'] = subs[0] ? subs[0].price_label || formatBRL(subs[0].price_cents) : '';
  out['cliente.vencimento'] = subs[0] ? subs[0].next_due_label || fmtDateBR(subs[0].next_due_at) : '';
  out['cliente.dia_vencimento'] = subs[0]?.due_day != null ? String(subs[0].due_day) : '';

  out['assinatura.produto'] = String(sub?.product_name || '');
  out['assinatura.valor'] = sub ? sub.price_label || formatBRL(sub.price_cents) : '';
  out['assinatura.vencimento'] = sub ? sub.next_due_label || fmtDateBR(sub.next_due_at) : '';
  out['assinatura.status'] = sub ? SUB_STATUS_LABEL[String(sub.status)] || String(sub.status) : '';
  out['assinatura.fim'] = sub?.cancel_at ? fmtDateBR(sub.cancel_at) : '';
  // cancelamento imediato grava cancel_at = hoje e status canceled → "vale a partir de agora" (não "continua até hoje")
  const today = brtDate(ctx.now || new Date());
  const stillHasAccess = Boolean(sub?.cancel_at) && sub!.status !== 'canceled' && String(sub!.cancel_at).slice(0, 10) > today;
  out['assinatura.fim_texto'] = stillHasAccess ? `Seu acesso continua até ${fmtDateBR(sub!.cancel_at).slice(0, 5)}.` : 'O cancelamento vale a partir de agora.';
  out['assinatura.pausa_ate'] = sub?.paused_until ? fmtDateBR(sub.paused_until) : '';

  out['cobranca.valor'] = charge ? ('amount_label' in charge && (charge as any).amount_label) || formatBRL(charge.amount_cents) : '';
  out['cobranca.vencimento'] = charge ? ('due_label' in charge && (charge as any).due_label) || fmtDateBR(charge.due_at) : '';
  out['cobranca.descricao'] = String(charge?.description || '');
  out['cobranca.dias_atraso'] = String(openOfState?.days_overdue ?? (charge && 'days_overdue' in charge ? (charge as any).days_overdue : 0) ?? 0);
  out['cobranca.pix'] = String(charge?.pix_code || '');
  out['cobranca.boleto_link'] = String(charge?.boleto_url || '');

  out['assinaturas.lista'] = subs.length
    ? subs
        .map((s) => `• ${s.product_name} — ${s.price_label || formatBRL(s.price_cents)} — vence ${(s.next_due_label || fmtDateBR(s.next_due_at)).slice(0, 5) || '—'} — ${SUB_STATUS_LABEL[String(s.status)] || s.status}`)
        .join('\n')
    : 'Você ainda não tem assinatura.';
  out['cobrancas.lista'] = opens.length
    ? opens
        .map((o) => `• ${o.amount_label || formatBRL(o.amount_cents)} — vence ${(o.due_label || fmtDateBR(o.due_at)).slice(0, 5)}${o.days_overdue > 0 ? ` (${o.days_overdue} dia${o.days_overdue === 1 ? '' : 's'} em atraso)` : ''} — ${o.description || 'cobrança'}`)
        .join('\n')
    : 'Nenhuma cobrança em aberto 🙂';

  out['produto.nome'] = String(product?.name || '');
  out['produto.valor'] = product ? product.price_label || formatBRL(product.price_cents) : '';
  out['produto.periodo'] = periodOf(product?.billing);
  out['produto.descricao'] = String(product?.description || '');
  if (extra) for (const [k, v] of Object.entries(extra)) out[k] = String(v ?? '');
  return out;
}

export function fillVars(text: string, state: BotState, ctx: BotContext, extra?: Record<string, string>) {
  const name = String(ctx.contact?.name || '').trim();
  const first = name.split(/\s+/)[0] || '';
  const base: Record<string, string> = {
    nome: name,
    primeiro_nome: first,
    telefone: String(ctx.contact?.phone || ''),
    pix_valor: state.pix ? formatBRL(state.pix.amount_cents) : '',
    pix_codigo: state.pix?.code || '',
    ...(ctx.vars || {}),
    ...bookingVars(state, ctx),
    ...ticketVars(state, ctx),
    ...orderVars(state, ctx),
    ...customerVars(state, ctx, extra),
  };
  return String(text || '').replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_m, k: string) => {
    const key = String(k).toLowerCase();
    if (key in base) return base[key];
    return state.vars?.[key] ?? state.vars?.[k] ?? '';
  });
}

function typingMs(text: string, delaySeconds?: number) {
  if (delaySeconds && delaySeconds > 0) return Math.min(30, delaySeconds) * 1000;
  const len = String(text || '').length;
  return Math.min(4000, Math.max(700, len * 35));
}

// ---------------------------------------------------------------- horário de atendimento (BRT)
function brtParts(d: Date) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  const parts = Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]));
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(String(parts.weekday));
  const hh = Number(parts.hour) % 24;
  return { dow, minutes: hh * 60 + Number(parts.minute) };
}
const toMin = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
export function isBusinessOpen(bh: BusinessHours | undefined, now: Date) {
  if (!bh?.enabled) return true;
  const { dow, minutes } = brtParts(now);
  const ranges = bh.days?.[String(dow)] || [];
  return ranges.some((r) => {
    const a = toMin(r.start);
    const b = toMin(r.end);
    if (a == null || b == null) return false;
    return b > a ? minutes >= a && minutes < b : minutes >= a || minutes < b; // intervalo que vira a noite
  });
}

// ---------------------------------------------------------------- grafo
function nodeById(def: BotDefinition, id: string | null | undefined) {
  return id ? def.nodes.find((n) => n.id === id) || null : null;
}
function nextOf(def: BotDefinition, nodeId: string, handle: string) {
  const e = def.edges.find((x) => x.source === nodeId && (x.sourceHandle || 'out') === handle);
  return e?.target || null;
}
export function startNode(def: BotDefinition) {
  return def.nodes.find((n) => n.type === 'start') || null;
}

export function emptyState(): BotState {
  return {
    node_id: null,
    status: 'active',
    waiting_for: null,
    vars: {},
    retries: 0,
    wait_until: null,
    last_input: null,
    pix: null,
    customer_id: null,
    crm: null,
    charge: null,
    book: null,
    ticket: null,
    order: null,
  };
}

function cloneState(prev: BotState): BotState {
  return {
    ...emptyState(),
    ...prev,
    vars: { ...(prev.vars || {}) },
    crm: prev.crm ? { ...prev.crm, fields: prev.crm.fields ? { ...prev.crm.fields } : prev.crm.fields, options: prev.crm.options ? [...prev.crm.options] : prev.crm.options } : null,
    charge: prev.charge ? { ...prev.charge } : null,
    book: prev.book ? { ...prev.book } : null,
    ticket: prev.ticket
      ? {
          ...prev.ticket,
          media_ids: Array.isArray(prev.ticket.media_ids) ? [...prev.ticket.media_ids] : prev.ticket.media_ids,
          custom: prev.ticket.custom ? { ...prev.ticket.custom } : prev.ticket.custom,
        }
      : null,
    order: prev.order
      ? {
          ...prev.order,
          cart: Array.isArray(prev.order.cart) ? prev.order.cart.map((i) => ({ ...i })) : prev.order.cart,
          custom: prev.order.custom ? { ...prev.order.custom } : prev.order.custom,
        }
      : null,
  };
}

// ---------------------------------------------------------------- listas numeradas / escolhas
function markOf(i: number, numbering: string) {
  const n = i + 1;
  return numbering === 'emoji' && n <= 10 ? KEYCAPS[n] : `*${n}.*`;
}
function numberingOf(node: BotNode | null | undefined, settings: BotSettings) {
  return node?.data?.numbering || settings.numbering || 'emoji';
}
/** "texto\n\n1️⃣ a\n2️⃣ b" */
function numberedList(head: string, labels: string[], numbering: string) {
  const lines = labels.map((l, i) => `${markOf(i, numbering)} ${l}`);
  return [String(head || '').trim(), lines.join('\n')].filter(Boolean).join('\n\n');
}

/** Opções efetivas do menu (fixas ou produtos do catálogo). */
function menuOptions(node: BotNode, ctx: BotContext): { id: string; label: string; keywords?: string[]; product?: BotProduct }[] {
  const d = node.data || {};
  if (d.source === 'products') {
    const wanted: string[] = Array.isArray(d.product_ids) ? d.product_ids.map(String) : [];
    const list = (ctx.products || []).filter((p) => p && p.active !== false && p.kind !== 'service' && (!wanted.length || wanted.includes(p.id)));
    return list.map((p) => ({ id: p.id, label: productLabel(p), keywords: [p.name], product: p }));
  }
  return Array.isArray(d.options) ? d.options : [];
}

function menuText(node: BotNode, settings: BotSettings, state: BotState, ctx: BotContext) {
  const d = node.data || {};
  const numbering = numberingOf(node, settings);
  const opts = menuOptions(node, ctx);
  const labels = opts.map((o) => fillVars(String(o.label || ''), state, ctx));
  return numberedList(fillVars(String(d.text || ''), state, ctx), labels, numbering);
}

/** Número digitado (1..n) → índice; aceita "2", "2️⃣", "opção 2", "n 2". */
function pickIndex(input: string): number | null {
  const raw = String(input || '').trim();
  const kc = keycapToNumber(raw);
  const n = norm(raw);
  const num = kc || (/^\d{1,2}$/.test(n) ? n : null) || (/^(opcao|opção|numero|número|n)\s*(\d{1,2})$/.exec(n)?.[2] ?? null);
  return num ? Number(num) - 1 : null;
}

function matchOptionIn<T extends { id: string; label: string; keywords?: string[] }>(opts: T[], input: string): T | null {
  const i = pickIndex(input);
  if (i != null) return i >= 0 && i < opts.length ? opts[i] : null;
  const n = norm(input);
  if (!n) return null;
  const exact = opts.find((o) => norm(o.label) === n);
  if (exact) return exact;
  return (
    opts.find((o) =>
      (Array.isArray(o.keywords) ? o.keywords : []).some((k: string) => {
        const kk = norm(k);
        return kk && (n === kk || ` ${n} `.includes(` ${kk} `));
      }),
    ) || null
  );
}

function matchOption(node: BotNode, input: string, ctx: BotContext) {
  return matchOptionIn(menuOptions(node, ctx), input);
}

/**
 * Sim/Não nas confirmações: "1"/sim/confirmar… → yes; "2"/não/manter/corrigir… → no. Pontuação é
 * ignorada e vale a frase inteira OU a primeira palavra ("sim, cancelar" → sim; "não, manter" → não).
 * "cancelar" depende do contexto: na confirmação de CANCELAMENTO ("1 Sim, cancelar / 2 Não, manter")
 * é sim; nas outras (cadastro, assinatura, troca) é não.
 */
const YES_RE = /^(1|sim|s|confirmar|confirmo|confirma|ok|isso|pode|quero|certo|correto|claro|yes)$/;
const NO_RE = /^(2|nao|n|agora nao|manter|mantenho|mantem|deixa|desisto|nope|corrigir|errado)$/;
const CANCEL_RE = /^(cancelar|cancela|cancelo)$/;
function yesNo(input: string, context: 'default' | 'cancel' = 'default'): 'yes' | 'no' | null {
  const raw = String(input || '').trim();
  const kc = keycapToNumber(raw);
  const n = kc || norm(raw);
  if (!n) return null;
  const cancelMeans: 'yes' | 'no' = context === 'cancel' ? 'yes' : 'no';
  for (const cand of [n, n.split(' ')[0]]) {
    if (YES_RE.test(cand)) return 'yes';
    if (NO_RE.test(cand)) return 'no';
    if (CANCEL_RE.test(cand)) return cancelMeans;
  }
  return null;
}

/** O cliente pediu para recomeçar? (`restart_keywords` das Configurações — o runtime trata antes; o simulador cai aqui) */
function isRestartWord(input: string, settings: BotSettings) {
  const n = norm(input);
  return Boolean(n) && (settings.restart_keywords || []).some((k) => norm(k) && norm(k) === n);
}
const restartWordOf = (settings: BotSettings) => String((settings.restart_keywords || []).find((k) => String(k || '').trim()) || 'menu').trim();

// ---------------------------------------------------------------- validação de respostas
export function validateAnswer(kind: string, input: string): { ok: boolean; value: string } {
  const v = String(input || '').trim();
  const digits = v.replace(/\D/g, '');
  switch (kind) {
    case 'name':
      return { ok: /\p{L}{2,}/u.test(v) && v.length <= 80, value: v.replace(/\s+/g, ' ') };
    case 'email':
      return { ok: /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(v.toLowerCase()), value: v.toLowerCase() };
    case 'phone':
      return { ok: digits.length >= 10 && digits.length <= 13, value: digits };
    case 'number':
      return { ok: /^-?\d+([.,]\d+)?$/.test(v), value: v.replace(',', '.') };
    case 'cpf':
      return { ok: cpfOk(digits), value: digits };
    case 'cnpj':
      return { ok: cnpjOk(digits), value: digits };
    case 'doc':
      return { ok: digits.length === 11 ? cpfOk(digits) : digits.length === 14 ? cnpjOk(digits) : false, value: digits };
    case 'cep':
      return { ok: /^\d{8}$/.test(digits), value: digits };
    case 'uf': {
      const uf = v.replace(/[^A-Za-z]/g, '').toUpperCase();
      return { ok: /^[A-Z]{2}$/.test(uf), value: uf };
    }
    case 'code': {
      const code = v.replace(/\s+/g, ' ');
      return { ok: code.length >= 1 && code.length <= 32, value: code };
    }
    case 'date': {
      const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(v);
      if (!m) return { ok: false, value: v };
      const y = m[3].length === 2 ? `20${m[3]}` : m[3];
      const dt = new Date(Number(y), Number(m[2]) - 1, Number(m[1]));
      const ok = dt.getDate() === Number(m[1]) && dt.getMonth() === Number(m[2]) - 1;
      return { ok, value: `${String(m[1]).padStart(2, '0')}/${String(m[2]).padStart(2, '0')}/${y}` };
    }
    default:
      return { ok: v.length > 0, value: v };
  }
}

const INVALID_FALLBACK: Record<string, string> = {
  email: 'Esse e-mail não parece válido. Pode conferir e mandar de novo?',
  phone: 'Não reconheci esse telefone. Mande com DDD, só números.',
  cpf: 'Esse CPF não é válido. Pode conferir?',
  cnpj: 'Esse CNPJ não é válido. Pode conferir?',
  doc: 'Esse CPF/CNPJ não parece válido. Pode conferir e mandar de novo, só números?',
  cep: 'Mande o CEP com 8 números, por favor (ex.: 01310100).',
  uf: 'Mande a sigla do estado com 2 letras (ex.: SP).',
  code: 'Não reconheci esse código. Pode conferir?',
  date: 'Mande a data no formato DD/MM/AAAA.',
  number: 'Mande só números, por favor.',
  name: 'Pode me dizer seu nome?',
};

// ---------------------------------------------------------------- campos personalizados (Fase 7, contrato §11.1)
// O motor PERGUNTA os campos com `ask_in_bot` (e os obrigatórios: sem eles a criação no serviço falharia com
// CUSTOM_REQUIRED) e MOSTRA os com `visible_to_customer` nas consultas. A conversão final é a MESMA do serviço
// (`coerceCustomValue` de wa-custom-fields.util); antes, o motor aceita o jeito de responder no WhatsApp: número da
// opção (lista), sim/não (1/2), data DD/MM/AA(AA).
const CF_MAX_ASK = 15;
// "pular" num campo opcional — NÃO inclui "não" (num campo sim/não, "não" é resposta)
const CF_SKIP = /^(pular|pula|-|skip|proximo)$/;
const CF_HINT: Record<string, string> = {
  number: '(só números)',
  date: '(DD/MM/AAAA)',
  phone: '(com DDD, só números)',
  email: '',
  cpf: '(CPF ou CNPJ, só números)',
};
const CF_INVALID: Record<string, string> = {
  number: 'Mande só números, por favor.',
  date: 'Mande a data no formato DD/MM/AAAA.',
  phone: 'Não reconheci esse telefone. Mande com DDD, só números.',
  email: 'Esse e-mail não parece válido. Pode conferir?',
  cpf: 'Esse CPF/CNPJ não parece válido. Pode conferir?',
  select: 'Responda com o número de uma das opções.',
  bool: 'Responda *1* para sim ou *2* para não.',
  text: 'Pode responder em texto?',
};

/** Campos que o bot pergunta para a entidade (ask_in_bot OU obrigatório), na ordem do cadastro. */
export function askFieldsOf(ctx: BotContext, entity: keyof BotCustomFieldMap, exclude: string[] = []): BotCustomField[] {
  const list = Array.isArray(ctx.custom_fields?.[entity]) ? (ctx.custom_fields![entity] as BotCustomField[]) : [];
  return list
    .filter((f) => f && f.key && f.label && (f.ask_in_bot === true || f.required === true) && !exclude.includes(String(f.key).toLowerCase()))
    .slice(0, CF_MAX_ASK)
    .map((f) => ({ ...f, key: String(f.key).toLowerCase(), options: Array.isArray(f.options) ? f.options.map(String) : undefined }));
}

/** Valor legível: Sim/Não, data DD/MM/AAAA (igual ao `displayCustomValue` do serviço). */
export function cfDisplay(f: BotCustomField | undefined, v: unknown): string {
  if (v === undefined || v === null || v === '') return '';
  const t = String(f?.type || 'text');
  if (t === 'bool') return v === true || v === 'true' ? 'Sim' : v === false || v === 'false' ? 'Não' : String(v);
  if (t === 'date') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v);
  }
  if (t === 'number' && Number.isFinite(Number(v))) return Number(v).toLocaleString('pt-BR');
  if (t === 'cpf' && /^\d{11}$|^\d{14}$/.test(String(v))) return maskDoc(String(v));
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

/** Campos VISÍVEIS ao cliente e preenchidos, um por linha, cada um começando com "\n" (vazio = nenhum). */
function cfLines(defs: BotCustomField[], custom: Record<string, unknown>, pre = '*', post = ':*') {
  const c: any = custom && typeof custom === 'object' ? custom : {};
  return (defs || [])
    .filter((f) => f && f.visible_to_customer === true)
    .map((f) => ({ f, v: cfDisplay(f, c[f.key] ?? c[String(f.key).toLowerCase()]) }))
    .filter((x) => x.v)
    .map((x) => `\n${pre}${x.f.label}${post} ${x.v}`)
    .join('');
}
/** Mesma coisa a partir de uma lista já formatada pelo runtime (`fields: [{label, display}]`). */
const fieldLines = (fields: { label: string; display: string }[] | null | undefined) =>
  (Array.isArray(fields) ? fields : [])
    .filter((x) => x && x.label && String(x.display ?? '').trim())
    .map((x) => `\n*${x.label}:* ${x.display}`)
    .join('');

/** Pergunta de um campo personalizado (com a lista numerada de opções / sim-não e a dica do tipo). */
function cfQuestion(f: BotCustomField, node: BotNode, ctx: BotContext) {
  const numbering = numberingOf(node, ctx.settings);
  const hint = CF_HINT[f.type] || '';
  let head = `📝 *${f.label}*${hint ? ` ${hint}` : ''}`;
  if (f.help) head += `\n_${f.help}_`;
  let body = head;
  if (f.type === 'select' && f.options?.length) body = numberedList(head, f.options, numbering);
  else if (f.type === 'bool') body = numberedList(head, ['Sim', 'Não'], numbering);
  if (!f.required) body += `\n\n_(ou responda *pular*)_`;
  return body;
}

/** Resposta do cliente → valor do campo (conversão do serviço). */
export function cfAnswer(f: BotCustomField, input: string): { ok: true; value: unknown; display: string } | { ok: false; error: string } {
  const raw = String(input || '').trim();
  if (!raw) return { ok: false, error: CF_INVALID[f.type] || CF_INVALID.text };
  let pre: unknown = raw;
  if (f.type === 'select') {
    const opts = (f.options || []).map((o) => ({ id: o, label: o }));
    const hit = matchOptionIn(opts, raw);
    if (!hit) return { ok: false, error: CF_INVALID.select };
    pre = hit.id;
  } else if (f.type === 'bool') {
    const yn = yesNo(raw);
    if (!yn) return { ok: false, error: CF_INVALID.bool };
    pre = yn === 'yes';
  } else if (f.type === 'date') {
    const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(raw);
    // ano com 2 dígitos: até 50 = 20xx, depois = 19xx ("5/3/90" = 1990; "10/12/27" = 2027)
    if (m) pre = `${m[3].length === 2 ? `${Number(m[3]) <= 50 ? '20' : '19'}${m[3]}` : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  } else if (f.type === 'number') {
    pre = raw.replace(/\s+/g, '');
  }
  const c = coerceCustomValue({ key: f.key, label: f.label, type: f.type as any, required: Boolean(f.required), options: f.options, visible_to_customer: false, ask_in_bot: true }, pre);
  if (!c.ok || c.value === null) return { ok: false, error: CF_INVALID[f.type] || CF_INVALID.text };
  return { ok: true, value: c.value, display: cfDisplay(f, c.value) };
}

/**
 * Um passo de pergunta de campo personalizado (genérico para chamado e pedido). Devolve:
 * `next` (gravou ou pulou → pergunte o próximo), `retry` (inválido, já avisou), `fail` (obrigatório inválido demais).
 */
function cfStep(f: BotCustomField, input: string, out: Record<string, unknown>, state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[], maxRetries: number): 'next' | 'retry' | 'fail' {
  const n = norm(input);
  if (!f.required && CF_SKIP.test(n)) {
    delete out[f.key];
    actions.push({ type: 'info', text: `Campo “${f.label}” pulado` });
    state.retries = 0;
    return 'next';
  }
  const r = cfAnswer(f, input);
  if (r.ok) {
    out[f.key] = r.value;
    actions.push({ type: 'info', text: `${f.label}: ${r.display}` });
    state.retries = 0;
    return 'next';
  }
  state.retries += 1;
  actions.push({ type: 'info', text: `Resposta inválida para “${f.label}” (${state.retries}/${maxRetries})` });
  if (state.retries >= maxRetries) {
    state.retries = 0;
    if (f.required) return 'fail';
    delete out[f.key];
    actions.push({ type: 'info', text: `Campo opcional “${f.label}” pulado depois de ${maxRetries} respostas inválidas` });
    return 'next';
  }
  sendText(actions, `${(r as any).error}\n\n${cfQuestion(f, node, ctx)}`, ctx);
  return 'retry';
}

// ---------------------------------------------------------------- condições
function evalCustomerRule(rule: any, state: BotState, ctx: BotContext) {
  const c = currentCustomer(state, ctx);
  const key = String(rule?.key || 'status');
  const op = String(rule?.op || 'is');
  const val = String(rule?.value ?? '');
  const subs = liveSubs(c);
  if (key === 'status') {
    const cur = String(c?.status || 'none');
    return op === 'is_not' ? cur !== val : cur === val;
  }
  if (key === 'product') {
    const has = subs.some((s) => String(s.product_id || '') === val);
    return op === 'is_not' ? !has : has;
  }
  if (key === 'days_overdue') {
    const days = Math.max(0, ...subs.map((s) => Number(s.days_overdue) || 0), ...(c?.open_charges || []).map((o) => Number(o.days_overdue) || 0));
    const n = Number(val.replace(',', '.'));
    return op === 'lt' ? days < n : days > n;
  }
  if (key === 'no_shows') {
    // faltas do cliente (Fase 6): contexto do runtime, senão o campo `no_shows` do cadastro
    const ns = Number.isFinite(Number(ctx.no_shows)) && ctx.no_shows != null ? Number(ctx.no_shows) : Number(c?.custom?.no_shows) || 0;
    const n = Number(val.replace(',', '.'));
    return op === 'lt' ? ns < n : ns > n;
  }
  if (key === 'verified' || key === 'has_open_charge' || key === 'has_subscription') {
    const cur = key === 'verified' ? Boolean(c?.verified) : key === 'has_open_charge' ? (c?.open_charges || []).length > 0 : subs.length > 0;
    return String(cur) === (val || 'true');
  }
  if (key.startsWith('custom.')) {
    const ck = key.slice(7).toLowerCase();
    const cur = norm(c?.custom?.[ck] ?? c?.custom?.[key.slice(7)] ?? '');
    const b = norm(val);
    switch (op) {
      case 'eq': return cur === b;
      case 'neq': return cur !== b;
      case 'contains': return b ? cur.includes(b) : false;
      case 'not_contains': return b ? !cur.includes(b) : true;
      case 'empty': return !cur;
      case 'not_empty': return Boolean(cur);
      default: return false;
    }
  }
  return false;
}

function evalRule(rule: any, state: BotState, ctx: BotContext) {
  const src = String(rule?.source || 'var');
  const op = String(rule?.op || 'eq');
  const val = String(rule?.value ?? '');
  if (src === 'tag') {
    const has = ctx.chatTagIds.includes(String(rule?.key || ''));
    return op === 'not_has' ? !has : has;
  }
  if (src === 'business_hours') {
    const open = isBusinessOpen(ctx.settings.business_hours, ctx.now);
    return op === 'closed' ? !open : open;
  }
  if (src === 'contact_saved') return String(Boolean(ctx.contact?.saved)) === (val || 'true');
  if (src === 'customer') return evalCustomerRule(rule, state, ctx);
  if (src === 'appointment') return evalAppointmentRule(rule, state, ctx);
  if (src === 'ticket') return evalTicketRule(rule, state, ctx);
  if (src === 'order') return evalOrderRule(rule, state, ctx);
  const cur = src === 'last_input' ? String(state.last_input || '') : String(state.vars?.[String(rule?.key || '').toLowerCase()] ?? state.vars?.[String(rule?.key || '')] ?? '');
  const a = norm(cur);
  const b = norm(val);
  switch (op) {
    case 'eq': return a === b;
    case 'neq': return a !== b;
    case 'contains': return b ? a.includes(b) : false;
    case 'not_contains': return b ? !a.includes(b) : true;
    case 'empty': return !a;
    case 'not_empty': return Boolean(a);
    case 'gt': return Number(cur.replace(',', '.')) > Number(val.replace(',', '.'));
    case 'lt': return Number(cur.replace(',', '.')) < Number(val.replace(',', '.'));
    default: return false;
  }
}

// ---------------------------------------------------------------- execução
function sendText(actions: BotAction[], text: string, ctx: BotContext, delaySeconds?: number) {
  const t = String(text || '').trim();
  if (!t) return;
  const ms = typingMs(t, delaySeconds);
  if (ctx.settings.typing !== false) actions.push({ type: 'typing', ms });
  actions.push({ type: 'send', delay_ms: ctx.settings.typing !== false ? ms : 0, message: { kind: 'text', text: t } });
}

// =================================================================== CRM — textos padrão (o que o cliente final lê)
export const CRM_TEXTS = {
  no_customer: 'Não encontrei o seu cadastro por aqui 🤔 Fale com um atendente para continuar.',
  no_subscription: 'Você não tem uma assinatura ativa no momento.',
  failed: 'Ops, não consegui concluir agora 😕 Tente de novo mais tarde ou fale com um atendente.',
  identify: {
    choose_text: 'Encontrei mais de um cadastro neste número. Qual deles?',
  },
  register: {
    confirm_text: 'Confira seus dados:\n{{resumo}}\n\n1️⃣ Confirmar\n2️⃣ Corrigir / cancelar',
    done_text: 'Cadastro concluído ✅',
    canceled_text: 'Tudo bem, cadastro cancelado. Quando quiser, é só me chamar 🙂',
  },
  update: {
    confirm_text: 'Confira os novos dados:\n{{resumo}}\n\n1️⃣ Confirmar\n2️⃣ Cancelar',
    done_text: 'Dados atualizados ✅',
    canceled_text: 'Tudo bem, seus dados continuam como estavam 🙂',
  },
  subscribe: {
    choose_text: 'Qual plano você quer?',
    ask_method_text: 'Como prefere pagar?\n1️⃣ PIX\n2️⃣ Boleto',
    confirm_text: 'Você escolheu *{{produto.nome}}* por *{{produto.valor}}*{{produto.periodo}}.\n\n1️⃣ Confirmar\n2️⃣ Agora não',
    declined_text: 'Tudo bem! Se mudar de ideia, é só me chamar 🙂',
    subscribed_text: 'Assinatura ativada ✅ Bem-vindo(a) ao *{{produto.nome}}*!',
    paid_text: 'Pagamento confirmado ✅ Sua assinatura do *{{produto.nome}}* está ativa. Obrigado!',
    expired_text: 'A cobrança venceu sem pagamento ⌛ Se ainda quiser assinar, é só me chamar que eu gero outra.',
    no_products_text: 'No momento não há planos disponíveis para assinar 😕',
    already_text: 'Você já tem uma assinatura de *{{produto.nome}}* 🙂 Para mudar algo nela, é só me chamar.',
    waiting_text: 'Ainda estou aguardando o pagamento ⏳ Assim que ele cair eu te aviso. Para voltar ao início, digite *{{comando_reiniciar}}*.',
  },
  info: {
    status: 'Olá, {{cliente.primeiro_nome}}! 👋\n\n*Situação:* {{cliente.status}}\n*Plano:* {{cliente.produto}}\n*Valor:* {{cliente.valor}}\n*Próximo vencimento:* {{cliente.vencimento}}',
    next_charge: '📅 *Próxima cobrança*\n\n*Plano:* {{assinatura.produto}}\n*Valor:* {{assinatura.valor}}\n*Vencimento:* {{assinatura.vencimento}}\n\n*Em aberto:*\n{{cobrancas.lista}}',
    subscriptions: '📋 *Suas assinaturas*\n\n{{assinaturas.lista}}',
    data: '👤 *Seus dados*\n\n*Nome:* {{cliente.nome}}\n*Documento:* {{cliente.documento}}\n*E-mail:* {{cliente.email}}\n*Código:* {{cliente.codigo}}{{cliente.campos}}',
  },
  invoice: {
    choose_text: 'Qual cobrança você quer receber?',
    sent_text: 'Enviei a 2ª via acima 👆',
    nothing_open_text: 'Você não tem cobrança em aberto 🙂',
  },
  cancel: {
    choose_text: 'Qual assinatura você quer cancelar?',
    reason_text: 'Pode me dizer o motivo?',
    confirm_text: 'Confirma o cancelamento de *{{assinatura.produto}}*?\n\n1️⃣ Sim, cancelar\n2️⃣ Não, manter',
    canceled_text: 'Cancelado. {{assinatura.fim_texto}}',
    kept_text: 'Que bom que você fica! 💚 Sua assinatura continua como está.',
  },
  pause: {
    choose_text: 'Qual assinatura você quer pausar?',
    ask_text: 'Por quantos dias quer pausar? (até {{max_dias}})',
    invalid_text: 'Responda só com o número de dias, de 1 a {{max_dias}}.',
    paused_text: 'Pausado até {{assinatura.pausa_ate}} ⏸️',
    canceled_text: 'Tudo bem, sua assinatura continua como está 🙂',
  },
  change_plan: {
    choose_sub_text: 'Qual assinatura você quer trocar?',
    choose_text: 'Para qual plano você quer mudar?',
    confirm_text: 'Trocar para *{{produto.nome}}* por *{{produto.valor}}*{{produto.periodo}}?\n\n1️⃣ Confirmar\n2️⃣ Manter o atual',
    changed_text: 'Plano trocado para *{{produto.nome}}* ✅',
    kept_text: 'Tudo bem, seu plano continua o mesmo 🙂',
    no_products_text: 'No momento não há outro plano disponível para trocar 😕',
  },
};

export const REGISTER_FIELD_DEFAULTS: Record<string, { label: string; question: string; validate: string }> = {
  name: { label: 'Nome', question: 'Qual é o seu nome completo?', validate: 'name' },
  doc: { label: 'CPF/CNPJ', question: 'Qual é o seu CPF ou CNPJ? (só números)', validate: 'doc' },
  email: { label: 'E-mail', question: 'Qual é o seu e-mail?', validate: 'email' },
  code: { label: 'Código', question: 'Qual é o seu código de cliente?', validate: 'code' },
  'address.zip': { label: 'CEP', question: 'Qual é o seu CEP? (só números)', validate: 'cep' },
  'address.street': { label: 'Rua', question: 'Qual é a rua ou avenida?', validate: 'any' },
  'address.number': { label: 'Número', question: 'Qual é o número? (e complemento, se tiver)', validate: 'any' },
  'address.district': { label: 'Bairro', question: 'Qual é o bairro?', validate: 'any' },
  'address.city': { label: 'Cidade', question: 'Qual é a cidade?', validate: 'any' },
  'address.state': { label: 'Estado', question: 'Qual é o estado? (sigla, ex.: SP)', validate: 'uf' },
  notes: { label: 'Observações', question: 'Quer deixar alguma observação?', validate: 'any' },
};
const SKIP_WORDS = /^(pular|pula|-|nao|não|n|nenhum|nenhuma|sem|skip|proximo|próximo)$/;
const CANCEL_WORDS = /^(cancelar|cancela|desistir|desisto|sair|parar)$/;

type CrmField = { key: string; label: string; question: string; required: boolean; validate: string; cf?: BotCustomField };
function normFields(raw: unknown, ctx: BotContext): CrmField[] {
  const list: any[] = Array.isArray(raw) ? raw : [];
  const out: CrmField[] = [];
  for (const f of list) {
    const key = String(f?.key || '').trim();
    if (!key) continue;
    const def = REGISTER_FIELD_DEFAULTS[key];
    const label = String(f?.label || def?.label || (key.startsWith('custom.') ? key.slice(7) : key)).trim();
    const question = String(f?.question || '').trim() || (key === 'code' ? `Qual é o seu ${ctx.identity?.code_label || 'código de cliente'}?` : def?.question || `Qual é o seu ${label.toLowerCase()}?`);
    const validate = String(f?.validate || '').trim() || def?.validate || 'any';
    out.push({ key, label, question, required: f?.required !== false, validate });
  }
  return out;
}

function resumoOf(fields: CrmField[], values: Record<string, string>) {
  return fields
    .filter((f) => String(values[f.key] ?? '').trim())
    .map((f) => `${f.label}: ${f.key === 'doc' ? maskDoc(values[f.key]) : f.cf ? cfDisplay(f.cf, values[f.key]) : values[f.key]}`)
    .join('\n');
}

/**
 * Perguntas do cadastro/atualização: os campos do bloco + (só no CADASTRO) os campos personalizados de cliente com
 * `ask_in_bot`/obrigatórios que o bloco ainda não pergunta (snapshot em `state.crm.cf`, tirado ao entrar no bloco).
 * Campo `custom.<chave>` do bloco que existe nas definições e não tem validação própria usa a regra do tipo do campo.
 */
function registerFields(d: any, ctx: BotContext, crm: BotCrmStep | null | undefined, isUpdate: boolean): CrmField[] {
  const base = normFields(d?.fields, ctx);
  const defs = ctx.custom_fields?.customer || [];
  const raw: any[] = Array.isArray(d?.fields) ? d.fields : [];
  for (const f of base) {
    if (!f.key.startsWith('custom.')) continue;
    const def = defs.find((x) => x.key === f.key.slice(7).toLowerCase());
    const own = raw.find((x) => String(x?.key || '').trim() === f.key);
    if (def && !String(own?.validate || '').trim()) {
      f.cf = def;
      f.validate = 'cf';
      if (!String(own?.question || '').trim()) f.question = cfQuestion(def, { id: '', type: 'crm_register', data: d }, ctx);
    }
  }
  if (isUpdate) return base;
  const extra = (Array.isArray(crm?.cf) ? crm!.cf : []).map(
    (f): CrmField => ({ key: `custom.${f.key}`, label: f.label, question: cfQuestion(f, { id: '', type: 'crm_register', data: d }, ctx), required: f.required === true, validate: 'cf', cf: f }),
  );
  return [...base, ...extra];
}

const maxRetriesOf = (d: any, ctx: BotContext) => Math.max(1, Number(d?.max_retries) || Number(ctx.settings.max_retries) || 3);

/** Sai pela porta `handle`; porta não ligada → manda `fallbackText` (quando houver) e o fluxo termina. */
function exitPort(def: BotDefinition, node: BotNode, handle: string, fallbackText: string | null, state: BotState, ctx: BotContext, actions: BotAction[], extra?: Record<string, string>) {
  const next = nextOf(def, node.id, handle);
  if (!next && fallbackText) sendText(actions, fillVars(fallbackText, state, ctx, extra), ctx);
  return next;
}

/** Manda o texto (sempre) e sai pela porta `handle` — para declined/kept, que o cliente final precisa ouvir. */
function sayAndGo(def: BotDefinition, node: BotNode, handle: string, text: string, state: BotState, ctx: BotContext, actions: BotAction[]) {
  sendText(actions, fillVars(text, state, ctx), ctx);
  return nextOf(def, node.id, handle);
}

/** Vira "esperando ação do runtime". */
function waitRuntime(state: BotState, action: BotAction, actions: BotAction[]) {
  actions.push(action);
  state.status = 'waiting';
  state.waiting_for = 'crm_wait';
  state.retries = 0;
}

function waitInput(state: BotState, wf: BotWaitingFor, actions: BotAction[], info: string) {
  state.status = 'waiting';
  state.waiting_for = wf;
  state.retries = 0;
  actions.push({ type: 'info', text: info });
}

function setCustomer(state: BotState, ctx: BotContext, c: BotCustomer | null) {
  if (!c) return;
  state.customer_id = c.id;
  ctx.customer = c;
  if (Array.isArray(ctx.customers) && !ctx.customers.some((x) => x.id === c.id)) ctx.customers.push(c);
}

/** Lista numerada de escolha + espera. */
function askChoice(state: BotState, ctx: BotContext, actions: BotAction[], node: BotNode, head: string, options: { id: string; label: string }[], purpose: string, step: string, wf: BotWaitingFor, info: string) {
  state.crm = { ...(state.crm || {}), purpose, step, options };
  sendText(actions, numberedList(fillVars(head, state, ctx), options.map((o) => o.label), numberingOf(node, ctx.settings)), ctx);
  waitInput(state, wf, actions, info);
}

const subLabel = (s: BotSubscription) => `${s.product_name} — ${s.price_label || formatBRL(s.price_cents)} — ${SUB_STATUS_LABEL[String(s.status)] || s.status}`;
const chargeLabel = (o: BotOpenCharge) => `${o.amount_label || formatBRL(o.amount_cents)} — vence ${(o.due_label || fmtDateBR(o.due_at)).slice(0, 5)} — ${o.description || 'cobrança'}`;

function productsFor(ctx: BotContext, ids: unknown, excludeId?: string | null) {
  const wanted: string[] = Array.isArray(ids) ? ids.map(String).filter(Boolean) : [];
  return (ctx.products || []).filter((p) => p && p.active !== false && p.kind !== 'service' && (!wanted.length || wanted.includes(p.id)) && (!excludeId || p.id !== excludeId));
}

// ------------------------------------------------------------------ entrada nos blocos de CRM (chamada pelo walk)
/** Devolve o próximo id (continua), null (termina) ou 'stop' (ficou esperando). */
function crmEnter(def: BotDefinition, state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[]): string | null | 'stop' {
  const d = node.data || {};
  const customer = currentCustomer(state, ctx);
  const needCustomer = () => {
    if (customer) {
      state.customer_id = customer.id;
      return true;
    }
    return false;
  };

  switch (node.type) {
    case 'crm_identify': {
      let mode = String(d.mode || 'org');
      if (mode === 'org') mode = ctx.identity?.require_doc ? 'ask_doc' : 'phone';
      state.crm = { purpose: 'identify', step: 'ask', fields: {} };
      if (mode === 'phone') {
        const list = Array.isArray(ctx.customers) && ctx.customers.length ? ctx.customers : ctx.customer ? [ctx.customer] : [];
        return identifyResolve(def, state, node, ctx, actions, list);
      }
      const byCode = mode === 'ask_code';
      const ask = String(d.ask_text || '').trim() || (byCode ? `Qual é o seu ${ctx.identity?.code_label || 'código de cliente'}?` : ctx.identity?.ask_doc_text || 'Para continuar, me informe o seu CPF ou CNPJ (só números).');
      sendText(actions, fillVars(ask, state, ctx), ctx);
      state.crm.step = byCode ? 'ask_code' : 'ask_doc';
      waitInput(state, 'crm_identify', actions, byCode ? 'Aguardando o código do cliente' : 'Aguardando o CPF/CNPJ do cliente');
      return 'stop';
    }

    case 'crm_register':
    case 'crm_update': {
      const isUpdate = node.type === 'crm_update';
      if (isUpdate && !needCustomer()) return exitPort(def, node, 'no_customer', d.no_customer_text || CRM_TEXTS.no_customer, state, ctx, actions);
      // cadastro: campos personalizados de cliente que o bot pergunta (os que o bloco já pergunta ficam de fora)
      const inBlock = (Array.isArray(d.fields) ? d.fields : []).map((f: any) => String(f?.key || '')).filter((k: string) => k.startsWith('custom.')).map((k: string) => k.slice(7).toLowerCase());
      const cf = isUpdate ? [] : askFieldsOf(ctx, 'customer', inBlock);
      state.crm = { purpose: isUpdate ? 'update' : 'register', step: 0, fields: {}, ...(cf.length ? { cf } : {}) };
      const fields = registerFields(d, ctx, state.crm, isUpdate);
      if (!fields.length) {
        state.crm = null;
        return exitPort(def, node, 'failed', d.failed_text || CRM_TEXTS.failed, state, ctx, actions);
      }
      if (!isUpdate && String(d.intro_text || '').trim()) sendText(actions, fillVars(String(d.intro_text), state, ctx), ctx);
      askField(state, ctx, actions, fields[0], isUpdate);
      return 'stop';
    }

    case 'crm_subscribe': {
      if (!needCustomer()) return exitPort(def, node, 'no_customer', d.no_customer_text || CRM_TEXTS.no_customer, state, ctx, actions);
      state.crm = { purpose: 'subscribe', step: 'product', fields: {}, method: null, product_id: null };
      // plano que o cliente JÁ assina (ativa/em atraso/pausada) não entra de novo — nada de assinatura em dobro
      const alreadyHas = new Set(liveSubs(customer).map((s) => String(s.product_id || '')));
      const already = (p: BotProduct) => {
        state.crm = { ...(state.crm || {}), purpose: 'subscribe', product_id: p.id };
        actions.push({ type: 'info', text: `O cliente já assina “${p.name}” — não assina de novo` });
        const next = sayAndGo(def, node, 'failed', String(d.already_text || '').trim() || CRM_TEXTS.subscribe.already_text, state, ctx, actions);
        state.crm = null;
        return next;
      };
      const pid = String(d.product_id || 'choose');
      if (pid === 'choose') {
        const all = productsFor(ctx, d.product_ids);
        const list = all.filter((p) => !alreadyHas.has(p.id));
        if (!list.length && all.length === 1) return already(all[0]);
        if (!list.length) return exitPort(def, node, 'failed', d.failed_text || CRM_TEXTS.subscribe.no_products_text, state, ctx, actions);
        if (list.length === 1) return subscribeWithProduct(def, state, node, ctx, actions, list[0]);
        askChoice(state, ctx, actions, node, String(d.choose_text || '').trim() || CRM_TEXTS.subscribe.choose_text, list.map((p) => ({ id: p.id, label: productLabel(p) })), 'subscribe', 'product', 'crm_subscribe', 'Aguardando o cliente escolher o plano');
        return 'stop';
      }
      const wanted = pid === 'from_var' ? String(state.vars.produto_id || '') : pid;
      const product = (ctx.products || []).find((p) => p.id === wanted && p.active !== false && p.kind !== 'service') || null;
      if (!product) {
        actions.push({ type: 'info', text: pid === 'from_var' ? 'Nenhum produto em {{produto_id}} (o menu de produtos não foi usado antes?)' : 'O produto escolhido no bloco não existe mais ou está inativo' });
        return exitPort(def, node, 'failed', d.failed_text || CRM_TEXTS.failed, state, ctx, actions);
      }
      if (alreadyHas.has(product.id)) return already(product);
      return subscribeWithProduct(def, state, node, ctx, actions, product);
    }

    case 'crm_info': {
      if (!needCustomer()) return exitPort(def, node, 'no_customer', d.no_customer_text || CRM_TEXTS.no_customer, state, ctx, actions);
      const what = String(d.what || 'status');
      const tpl = String(d.template || '').trim() || (CRM_TEXTS.info as any)[what] || CRM_TEXTS.info.status;
      sendText(actions, fillVars(tpl, state, ctx), ctx);
      return nextOf(def, node.id, 'out');
    }

    case 'crm_invoice': {
      if (!needCustomer()) return exitPort(def, node, 'no_customer', d.no_customer_text || CRM_TEXTS.no_customer, state, ctx, actions);
      const opens = [...(customer!.open_charges || [])].sort((a, b) => String(a.due_at).localeCompare(String(b.due_at)));
      if (!opens.length) return exitPort(def, node, 'nothing_open', d.nothing_open_text || CRM_TEXTS.invoice.nothing_open_text, state, ctx, actions);
      const which = String(d.which || 'open');
      state.crm = { purpose: 'invoice', step: 'choose', method: String(d.method || 'same') };
      if (which === 'choose' && opens.length > 1) {
        askChoice(state, ctx, actions, node, String(d.choose_text || '').trim() || CRM_TEXTS.invoice.choose_text, opens.map((o) => ({ id: o.id, label: chargeLabel(o) })), 'invoice', 'choose', 'crm_choose', 'Aguardando o cliente escolher a cobrança');
        return 'stop';
      }
      const chosen = which === 'last' ? opens[opens.length - 1] : opens[0];
      return invoiceSend(state, ctx, actions, chosen);
    }

    case 'crm_cancel': {
      if (!needCustomer()) return exitPort(def, node, 'no_customer', d.no_customer_text || CRM_TEXTS.no_customer, state, ctx, actions);
      const subs = liveSubs(customer).filter((s) => !s.cancel_at);
      if (!subs.length) return exitPort(def, node, 'no_subscription', d.no_subscription_text || CRM_TEXTS.no_subscription, state, ctx, actions);
      state.crm = { purpose: 'cancel', step: 'sub', reason: null, subscription_id: null };
      // `subscription:'choose'` = sempre pergunta qual (mesmo com uma só — o cliente confirma o que vai cancelar)
      if (subs.length > 1 || String(d.subscription || 'single') === 'choose') {
        askChoice(state, ctx, actions, node, String(d.choose_text || '').trim() || CRM_TEXTS.cancel.choose_text, subs.map((s) => ({ id: s.id, label: subLabel(s) })), 'cancel', 'sub', 'crm_cancel', 'Aguardando o cliente escolher a assinatura');
        return 'stop';
      }
      state.crm.subscription_id = subs[0].id;
      cancelAfterPick(state, node, ctx, actions);
      return 'stop';
    }

    case 'crm_pause': {
      if (!needCustomer()) return exitPort(def, node, 'no_customer', d.no_customer_text || CRM_TEXTS.no_customer, state, ctx, actions);
      const subs = liveSubs(customer).filter((s) => s.status !== 'paused');
      if (!subs.length) return exitPort(def, node, 'no_subscription', d.no_subscription_text || CRM_TEXTS.no_subscription, state, ctx, actions);
      state.crm = { purpose: 'pause', step: 'sub', subscription_id: null };
      if (subs.length > 1) {
        askChoice(state, ctx, actions, node, String(d.choose_text || '').trim() || CRM_TEXTS.pause.choose_text, subs.map((s) => ({ id: s.id, label: subLabel(s) })), 'pause', 'sub', 'crm_pause', 'Aguardando o cliente escolher a assinatura');
        return 'stop';
      }
      state.crm.subscription_id = subs[0].id;
      return pauseAfterPick(state, node, ctx, actions);
    }

    case 'crm_change_plan': {
      if (!needCustomer()) return exitPort(def, node, 'no_customer', d.no_customer_text || CRM_TEXTS.no_customer, state, ctx, actions);
      // só assinatura recorrente ativa/em atraso e sem cancelamento agendado troca de plano (regra do serviço, §2.3)
      const subs = changeableSubs(customer);
      if (!subs.length) return exitPort(def, node, 'no_subscription', d.no_subscription_text || CRM_TEXTS.no_subscription, state, ctx, actions);
      state.crm = { purpose: 'change_plan', step: 'sub', subscription_id: null, product_id: null };
      if (subs.length > 1) {
        askChoice(state, ctx, actions, node, String(d.choose_sub_text || '').trim() || CRM_TEXTS.change_plan.choose_sub_text, subs.map((s) => ({ id: s.id, label: subLabel(s) })), 'change_plan', 'sub', 'crm_change_plan', 'Aguardando o cliente escolher a assinatura');
        return 'stop';
      }
      state.crm.subscription_id = subs[0].id;
      return changePlanAfterSub(def, state, node, ctx, actions, subs[0]);
    }
    default:
      return nextOf(def, node.id, 'out');
  }
}

// --- identify
function identifyResolve(def: BotDefinition, state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[], list: BotCustomer[]): string | null | 'stop' {
  const d = node.data || {};
  if (!list.length) {
    const mode = String(state.crm?.step || '');
    // em modo "pelo número" o builder decide o que dizer (a porta costuma levar ao cadastro); nos modos com pergunta avisa
    const text = mode === 'ask_doc' || mode === 'ask_code' || mode === 'lookup' ? String(d.not_found_text || '').trim() || ctx.identity?.doc_not_found_text || 'Não encontrei um cadastro com esses dados. Confira e tente de novo ou fale com um atendente.' : String(d.not_found_text || '').trim() || null;
    if (text) sendText(actions, fillVars(text, state, ctx), ctx);
    state.crm = null;
    actions.push({ type: 'info', text: 'Cliente não encontrado' });
    return nextOf(def, node.id, 'not_found');
  }
  if (list.length > 1) {
    askChoice(state, ctx, actions, node, String(d.choose_text || '').trim() || CRM_TEXTS.identify.choose_text, list.map((c) => ({ id: c.id, label: [c.name, c.doc_masked || c.code].filter(Boolean).join(' — ') })), 'identify', 'choose', 'crm_choose', 'Mais de um cadastro no número: aguardando a escolha');
    return 'stop';
  }
  return identifyFound(def, state, node, ctx, actions, list[0]);
}
function identifyFound(def: BotDefinition, state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[], c: BotCustomer) {
  setCustomer(state, ctx, c);
  state.crm = null;
  actions.push({ type: 'info', text: `Cliente identificado: ${c.name}` });
  const t = String(node.data?.found_text || '').trim();
  if (t) sendText(actions, fillVars(t, state, ctx), ctx);
  return nextOf(def, node.id, 'found');
}

// --- register / update
function askField(state: BotState, ctx: BotContext, actions: BotAction[], f: CrmField, isUpdate: boolean) {
  // campo personalizado: a pergunta já traz as opções e o "(ou responda pular)"
  const q = f.required || f.cf ? f.question : `${f.question} _(ou responda *pular*)_`;
  sendText(actions, fillVars(q, state, ctx), ctx);
  waitInput(state, isUpdate ? 'crm_update' : 'crm_register', actions, `Aguardando: ${f.label}`);
}

// --- subscribe
function subscribeWithProduct(def: BotDefinition, state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[], p: BotProduct): string | null | 'stop' {
  const d = node.data || {};
  state.crm = { ...(state.crm || {}), purpose: 'subscribe', product_id: p.id, options: undefined };
  const method = String(d.method || 'pix');
  if (method === 'ask') {
    state.crm.step = 'method';
    sendText(actions, fillVars(String(d.ask_method_text || '').trim() || CRM_TEXTS.subscribe.ask_method_text, state, ctx), ctx);
    waitInput(state, 'crm_subscribe', actions, 'Aguardando a forma de pagamento');
    return 'stop';
  }
  state.crm.method = method === 'boleto' ? 'boleto' : 'pix';
  return subscribeConfirm(def, state, node, ctx, actions);
}
function subscribeConfirm(def: BotDefinition, state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[]): string | null | 'stop' {
  const d = node.data || {};
  if (d.confirm !== false) {
    state.crm!.step = 'confirm';
    sendText(actions, fillVars(String(d.confirm_text || '').trim() || CRM_TEXTS.subscribe.confirm_text, state, ctx), ctx);
    waitInput(state, 'crm_subscribe', actions, 'Aguardando a confirmação da assinatura');
    return 'stop';
  }
  return subscribeGo(state, node, actions);
}
function subscribeGo(state: BotState, node: BotNode, actions: BotAction[]): 'stop' {
  const d = node.data || {};
  state.crm!.step = 'action';
  waitRuntime(state, { type: 'crm_subscribe', product_id: String(state.crm!.product_id), method: state.crm!.method === 'boleto' ? 'boleto' : 'pix', charge_now: d.charge_now !== false, node_id: node.id }, actions);
  return 'stop';
}

// --- invoice
function invoiceSend(state: BotState, ctx: BotContext, actions: BotAction[], o: BotOpenCharge): 'stop' {
  state.charge = { id: o.id, amount_cents: o.amount_cents, description: o.description, due_at: o.due_at, pix_code: o.pix_code, boleto_url: o.boleto_url };
  const m = String(state.crm?.method || 'same');
  state.crm = { ...(state.crm || {}), purpose: 'invoice', step: 'action', options: undefined };
  waitRuntime(state, { type: 'crm_send_charge', charge_id: o.id, method: m === 'pix' || m === 'boleto' || m === 'both' ? m : 'same' }, actions);
  return 'stop';
}

// --- cancel
function cancelAfterPick(state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[]) {
  const d = node.data || {};
  state.crm = { ...(state.crm || {}), purpose: 'cancel', options: undefined };
  if (d.ask_reason !== false) {
    const reasons: string[] = (Array.isArray(d.reasons) && d.reasons.length ? d.reasons : ctx.cancel_reasons || []).map(String).filter(Boolean);
    state.crm.step = 'reason';
    state.crm.options = reasons.map((r, i) => ({ id: String(i), label: r }));
    const head = String(d.reason_text || '').trim() || CRM_TEXTS.cancel.reason_text;
    sendText(actions, reasons.length ? numberedList(fillVars(head, state, ctx), reasons, numberingOf(node, ctx.settings)) : fillVars(head, state, ctx), ctx);
    waitInput(state, 'crm_cancel', actions, 'Aguardando o motivo do cancelamento');
    return;
  }
  cancelConfirm(state, node, ctx, actions);
}
function cancelConfirm(state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[]) {
  const d = node.data || {};
  state.crm!.step = 'confirm';
  state.crm!.options = undefined;
  const ret = String(d.retention_text || '').trim();
  if (ret) sendText(actions, fillVars(ret, state, ctx), ctx);
  sendText(actions, fillVars(String(d.confirm_text || '').trim() || CRM_TEXTS.cancel.confirm_text, state, ctx), ctx);
  waitInput(state, 'crm_cancel', actions, 'Aguardando a confirmação do cancelamento');
}

// --- pause
function pauseAfterPick(state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[]): 'stop' {
  const d = node.data || {};
  const max = Math.max(1, Math.min(365, Number(d.max_days) || 30));
  state.crm = { ...(state.crm || {}), purpose: 'pause', options: undefined };
  if (d.ask_until !== false) {
    state.crm.step = 'days';
    sendText(actions, fillVars(String(d.ask_text || '').trim() || CRM_TEXTS.pause.ask_text, state, ctx, { max_dias: String(max) }), ctx);
    waitInput(state, 'crm_pause', actions, 'Aguardando o número de dias');
    return 'stop';
  }
  const days = Math.max(1, Math.min(max, Number(d.days) || max));
  state.crm.step = 'action';
  waitRuntime(state, { type: 'crm_pause_subscription', subscription_id: String(state.crm.subscription_id), days }, actions);
  return 'stop';
}

// --- change plan
function changePlanAfterSub(def: BotDefinition, state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[], sub: BotSubscription): string | null | 'stop' {
  const d = node.data || {};
  // destino só recorrente (o serviço recusa troca para produto avulso)
  const list = productsFor(ctx, d.product_ids, sub.product_id).filter((p) => String(p.billing || '') !== 'once');
  if (!list.length) return exitPort(def, node, 'failed', d.failed_text || CRM_TEXTS.change_plan.no_products_text, state, ctx, actions);
  state.crm = { ...(state.crm || {}), purpose: 'change_plan', step: 'product', subscription_id: sub.id, options: undefined };
  askChoice(state, ctx, actions, node, String(d.choose_text || '').trim() || CRM_TEXTS.change_plan.choose_text, list.map((p) => ({ id: p.id, label: productLabel(p) })), 'change_plan', 'product', 'crm_change_plan', 'Aguardando o cliente escolher o novo plano');
  return 'stop';
}
function changePlanConfirm(state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[]) {
  const d = node.data || {};
  state.crm!.options = undefined;
  if (d.confirm !== false) {
    state.crm!.step = 'confirm';
    sendText(actions, fillVars(String(d.confirm_text || '').trim() || CRM_TEXTS.change_plan.confirm_text, state, ctx), ctx);
    waitInput(state, 'crm_change_plan', actions, 'Aguardando a confirmação da troca');
    return;
  }
  state.crm!.step = 'action';
  waitRuntime(state, { type: 'crm_change_plan', subscription_id: String(state.crm!.subscription_id), product_id: String(state.crm!.product_id) }, actions);
}

// ------------------------------------------------------------------ entrada do cliente num bloco de CRM
const CRM_WAITING = new Set<string>(['crm_identify', 'crm_choose', 'crm_register', 'crm_confirm', 'crm_subscribe', 'crm_cancel', 'crm_pause', 'crm_change_plan', 'crm_update', 'crm_wait', 'charge']);

function crmInput(def: BotDefinition, state: BotState, node: BotNode, input: string, ctx: BotContext, actions: BotAction[]) {
  const d = node.data || {};
  const crm = state.crm || (state.crm = {});
  const maxRetries = maxRetriesOf(d, ctx);
  const go = (next: string | null | 'stop') => {
    if (next === 'stop') return;
    state.status = 'active';
    state.waiting_for = null;
    state.retries = 0;
    walk(def, state, next, ctx, actions);
  };
  const invalidChoice = (relist: () => void) => {
    state.retries += 1;
    sendText(actions, fillVars(String(d.invalid_text || ctx.settings.invalid_option_text || DEFAULT_INVALID), state, ctx), ctx);
    actions.push({ type: 'info', text: `Opção inválida (${state.retries}/${maxRetries})` });
    if (state.retries >= maxRetries) {
      state.retries = 0;
      relist();
    }
  };

  // --- esperando o runtime: a mensagem não muda o estado (a fila da conversa só processa a próxima
  //     mensagem depois da ação concluir; ação presa > 2 min é recomeçada pelo runtime)
  if (state.waiting_for === 'crm_wait') {
    actions.push({ type: 'info', text: 'Aguardando o sistema concluir a ação do CRM' });
    return;
  }
  if (state.waiting_for === 'charge') {
    const n = norm(input);
    if (/\b(paguei|pago|ja paguei|pix feito|feito|comprovante|transferi)\b/.test(n) && state.charge) actions.push({ type: 'charge_check', charge_id: state.charge.id });
    else {
      // qualquer outra mensagem: o cliente precisa de resposta (e de saber como sair daqui)
      sendText(actions, fillVars(String(d.waiting_text || '').trim() || CRM_TEXTS.subscribe.waiting_text, state, ctx, { comando_reiniciar: restartWordOf(ctx.settings) }), ctx);
      actions.push({ type: 'info', text: 'Aguardando a confirmação do pagamento (cliente avisado)' });
    }
    return;
  }

  // --- identificação por documento/código
  if (state.waiting_for === 'crm_identify') {
    const byCode = crm.step === 'ask_code';
    const r = validateAnswer(byCode ? 'code' : 'doc', input);
    if (r.ok) {
      crm.step = 'lookup';
      waitRuntime(state, { type: 'crm_lookup', by: byCode ? 'code' : 'doc', value: r.value }, actions);
      return;
    }
    state.retries += 1;
    const retries = Math.max(1, Number(d.retries) || 3);
    sendText(actions, fillVars(String(d.invalid_text || '').trim() || (byCode ? INVALID_FALLBACK.code : ctx.identity?.doc_invalid_text || INVALID_FALLBACK.doc), state, ctx), ctx);
    actions.push({ type: 'info', text: `${byCode ? 'Código' : 'Documento'} inválido (${state.retries}/${retries})` });
    if (state.retries >= retries) {
      state.crm = null;
      const inv = nextOf(def, node.id, 'invalid');
      go(inv || nextOf(def, node.id, 'not_found'));
    }
    return;
  }

  // --- cadastro / atualização: perguntas em sequência
  if (state.waiting_for === 'crm_register' || state.waiting_for === 'crm_update') {
    const isUpdate = state.waiting_for === 'crm_update';
    const fields = registerFields(d, ctx, crm, isUpdate);
    const idx = Number(crm.step) || 0;
    const f = fields[idx];
    const n = norm(input);
    if (CANCEL_WORDS.test(n)) {
      state.crm = null;
      actions.push({ type: 'info', text: 'Cliente cancelou o preenchimento' });
      go(exitPort(def, node, 'cancel', (isUpdate ? CRM_TEXTS.update : CRM_TEXTS.register).canceled_text, state, ctx, actions));
      return;
    }
    if (!f) {
      go(registerFinish(def, state, node, ctx, actions, fields, isUpdate));
      return;
    }
    crm.fields = crm.fields || {};
    if (!f.required && (f.cf ? CF_SKIP : SKIP_WORDS).test(n)) crm.fields[f.key] = '';
    else {
      const ca = f.cf ? cfAnswer(f.cf, input) : null;
      const r = ca ? { ok: ca.ok, value: ca.ok ? String((ca as any).value) : '' } : validateAnswer(f.validate, input);
      if (!r.ok) {
        state.retries += 1;
        // resposta inválida repetida `max_retries` vezes → porta `failed` (não fica preso na mesma pergunta)
        if (state.retries >= maxRetries) {
          state.crm = null;
          actions.push({ type: 'info', text: `Resposta inválida ${state.retries}× em “${f.label}” — seguindo por “deu erro”` });
          go(exitPort(def, node, 'failed', d.failed_text || CRM_TEXTS.failed, state, ctx, actions));
          return;
        }
        sendText(actions, ca && !ca.ok ? `${ca.error}\n\n${f.question}` : fillVars(INVALID_FALLBACK[f.validate] || 'Não entendi. Pode responder de novo?', state, ctx), ctx);
        actions.push({ type: 'info', text: `Resposta inválida (${state.retries}/${maxRetries})` });
        return;
      }
      crm.fields[f.key] = r.value;
    }
    state.retries = 0;
    const next = fields[idx + 1];
    crm.step = idx + 1;
    if (next) {
      askField(state, ctx, actions, next, isUpdate);
      return;
    }
    go(registerFinish(def, state, node, ctx, actions, fields, isUpdate));
    return;
  }
  if (state.waiting_for === 'crm_confirm') {
    const isUpdate = node.type === 'crm_update';
    const yn = yesNo(input);
    if (yn === 'yes') {
      const fields = crm.fields || {};
      crm.step = 'action';
      waitRuntime(state, isUpdate ? { type: 'crm_update_customer', fields } : { type: 'crm_create_customer', fields, link_role: String(d.link_role || 'owner') }, actions);
      return;
    }
    if (yn === 'no') {
      state.crm = null;
      go(exitPort(def, node, 'cancel', (isUpdate ? CRM_TEXTS.update : CRM_TEXTS.register).canceled_text, state, ctx, actions));
      return;
    }
    invalidChoice(() => sendText(actions, fillVars(String(d.confirm_text || '').trim() || (isUpdate ? CRM_TEXTS.update : CRM_TEXTS.register).confirm_text, state, ctx, { resumo: resumoOf(registerFields(d, ctx, crm, isUpdate), crm.fields || {}) }), ctx));
    return;
  }

  // --- escolhas numeradas (cliente / cobrança)
  if (state.waiting_for === 'crm_choose') {
    const opts = crm.options || [];
    const picked = matchOptionIn(opts, input);
    if (!picked) {
      invalidChoice(() => sendText(actions, numberedList(fillVars(String(d.choose_text || '').trim() || (crm.purpose === 'invoice' ? CRM_TEXTS.invoice.choose_text : CRM_TEXTS.identify.choose_text), state, ctx), opts.map((o) => o.label), numberingOf(node, ctx.settings)), ctx));
      return;
    }
    if (crm.purpose === 'identify') {
      const c = (ctx.customers || []).find((x) => x.id === picked.id) || (ctx.customer?.id === picked.id ? ctx.customer : null);
      if (!c) {
        go(exitPort(def, node, 'not_found', null, state, ctx, actions));
        return;
      }
      go(identifyFound(def, state, node, ctx, actions, c));
      return;
    }
    if (crm.purpose === 'invoice') {
      const o = (currentCustomer(state, ctx)?.open_charges || []).find((x) => x.id === picked.id);
      if (!o) {
        go(exitPort(def, node, 'failed', d.failed_text || CRM_TEXTS.failed, state, ctx, actions));
        return;
      }
      invoiceSend(state, ctx, actions, o);
      return;
    }
    return;
  }

  // --- assinar: plano → forma de pagamento → confirmação
  if (state.waiting_for === 'crm_subscribe') {
    if (crm.step === 'product') {
      const opts = crm.options || [];
      const picked = matchOptionIn(opts, input);
      if (!picked) {
        invalidChoice(() => sendText(actions, numberedList(fillVars(String(d.choose_text || '').trim() || CRM_TEXTS.subscribe.choose_text, state, ctx), opts.map((o) => o.label), numberingOf(node, ctx.settings)), ctx));
        return;
      }
      const p = (ctx.products || []).find((x) => x.id === picked.id);
      if (!p) {
        go(exitPort(def, node, 'failed', d.failed_text || CRM_TEXTS.failed, state, ctx, actions));
        return;
      }
      state.vars.produto_id = p.id;
      state.vars.produto = p.name;
      go(subscribeWithProduct(def, state, node, ctx, actions, p));
      return;
    }
    if (crm.step === 'method') {
      const n = norm(input);
      const kc = keycapToNumber(String(input || '').trim());
      const m = kc === '1' || /^(1|pix)$/.test(n) ? 'pix' : kc === '2' || /^(2|boleto)$/.test(n) ? 'boleto' : null;
      if (!m) {
        invalidChoice(() => sendText(actions, fillVars(String(d.ask_method_text || '').trim() || CRM_TEXTS.subscribe.ask_method_text, state, ctx), ctx));
        return;
      }
      crm.method = m;
      actions.push({ type: 'info', text: `Forma de pagamento: ${m === 'pix' ? 'PIX' : 'boleto'}` });
      go(subscribeConfirm(def, state, node, ctx, actions));
      return;
    }
    if (crm.step === 'confirm') {
      const yn = yesNo(input);
      if (yn === 'yes') {
        subscribeGo(state, node, actions);
        return;
      }
      if (yn === 'no') {
        state.crm = null;
        go(sayAndGo(def, node, 'declined', d.declined_text || CRM_TEXTS.subscribe.declined_text, state, ctx, actions));
        return;
      }
      invalidChoice(() => sendText(actions, fillVars(String(d.confirm_text || '').trim() || CRM_TEXTS.subscribe.confirm_text, state, ctx), ctx));
      return;
    }
    return;
  }

  // --- cancelar: assinatura → motivo → confirmação
  if (state.waiting_for === 'crm_cancel') {
    if (crm.step === 'sub') {
      const opts = crm.options || [];
      const picked = matchOptionIn(opts, input);
      if (!picked) {
        invalidChoice(() => sendText(actions, numberedList(fillVars(String(d.choose_text || '').trim() || CRM_TEXTS.cancel.choose_text, state, ctx), opts.map((o) => o.label), numberingOf(node, ctx.settings)), ctx));
        return;
      }
      crm.subscription_id = picked.id;
      cancelAfterPick(state, node, ctx, actions);
      return;
    }
    if (crm.step === 'reason') {
      const opts = crm.options || [];
      const picked = opts.length ? matchOptionIn(opts, input) : null;
      crm.reason = picked ? picked.label : String(input || '').trim().slice(0, 255);
      actions.push({ type: 'info', text: `Motivo: ${crm.reason}` });
      cancelConfirm(state, node, ctx, actions);
      return;
    }
    if (crm.step === 'confirm') {
      const yn = yesNo(input, 'cancel'); // aqui "cancelar" = SIM (confirma o cancelamento); "manter" = não
      if (yn === 'yes') {
        crm.step = 'action';
        const pol = String(d.policy || 'product');
        waitRuntime(state, { type: 'crm_cancel_subscription', subscription_id: String(crm.subscription_id), reason: crm.reason || null, policy: pol === 'immediate' || pol === 'end_of_cycle' ? pol : 'product' }, actions);
        return;
      }
      if (yn === 'no') {
        go(sayAndGo(def, node, 'kept', d.kept_text || CRM_TEXTS.cancel.kept_text, state, ctx, actions));
        return;
      }
      invalidChoice(() => sendText(actions, fillVars(String(d.confirm_text || '').trim() || CRM_TEXTS.cancel.confirm_text, state, ctx), ctx));
      return;
    }
    return;
  }

  // --- pausar: assinatura → dias
  if (state.waiting_for === 'crm_pause') {
    if (crm.step === 'sub') {
      const opts = crm.options || [];
      const picked = matchOptionIn(opts, input);
      if (!picked) {
        invalidChoice(() => sendText(actions, numberedList(fillVars(String(d.choose_text || '').trim() || CRM_TEXTS.pause.choose_text, state, ctx), opts.map((o) => o.label), numberingOf(node, ctx.settings)), ctx));
        return;
      }
      crm.subscription_id = picked.id;
      pauseAfterPick(state, node, ctx, actions);
      return;
    }
    if (crm.step === 'days') {
      const max = Math.max(1, Math.min(365, Number(d.max_days) || 30));
      if (CANCEL_WORDS.test(norm(input))) {
        // desistiu de pausar: a assinatura segue como está; sai por `failed` (o bloco não tem porta "desistiu")
        state.crm = null;
        actions.push({ type: 'info', text: 'Cliente desistiu de pausar' });
        go(sayAndGo(def, node, 'failed', String(d.canceled_text || '').trim() || CRM_TEXTS.pause.canceled_text, state, ctx, actions));
        return;
      }
      // só o número NO COMEÇO da resposta ("7", "7 dias", "7️⃣"); "dia 7" ou "até 10/11" não valem
      const kc = keycapToNumber(String(input || '').trim());
      const lead = kc || /^(\d{1,3})(?!\d)/.exec(String(input || '').trim())?.[1] || '';
      const days = lead ? Number(lead) : NaN;
      if (!Number.isFinite(days) || days < 1 || days > max) {
        state.retries += 1;
        if (state.retries >= maxRetries) {
          state.crm = null;
          actions.push({ type: 'info', text: `Dias inválidos ${state.retries}× — seguindo por “deu erro”` });
          go(exitPort(def, node, 'failed', d.failed_text || CRM_TEXTS.failed, state, ctx, actions));
          return;
        }
        sendText(actions, fillVars(String(d.invalid_text || '').trim() || CRM_TEXTS.pause.invalid_text, state, ctx, { max_dias: String(max) }), ctx);
        actions.push({ type: 'info', text: `Dias inválidos (${state.retries}/${maxRetries})` });
        return;
      }
      crm.step = 'action';
      waitRuntime(state, { type: 'crm_pause_subscription', subscription_id: String(crm.subscription_id), days }, actions);
      return;
    }
    return;
  }

  // --- trocar de plano: assinatura → plano → confirmação
  if (state.waiting_for === 'crm_change_plan') {
    if (crm.step === 'sub') {
      const opts = crm.options || [];
      const picked = matchOptionIn(opts, input);
      if (!picked) {
        invalidChoice(() => sendText(actions, numberedList(fillVars(String(d.choose_sub_text || '').trim() || CRM_TEXTS.change_plan.choose_sub_text, state, ctx), opts.map((o) => o.label), numberingOf(node, ctx.settings)), ctx));
        return;
      }
      const sub = (currentCustomer(state, ctx)?.subscriptions || []).find((s) => s.id === picked.id);
      if (!sub) {
        go(exitPort(def, node, 'failed', d.failed_text || CRM_TEXTS.failed, state, ctx, actions));
        return;
      }
      go(changePlanAfterSub(def, state, node, ctx, actions, sub));
      return;
    }
    if (crm.step === 'product') {
      const opts = crm.options || [];
      const picked = matchOptionIn(opts, input);
      if (!picked) {
        invalidChoice(() => sendText(actions, numberedList(fillVars(String(d.choose_text || '').trim() || CRM_TEXTS.change_plan.choose_text, state, ctx), opts.map((o) => o.label), numberingOf(node, ctx.settings)), ctx));
        return;
      }
      crm.product_id = picked.id;
      changePlanConfirm(state, node, ctx, actions);
      return;
    }
    if (crm.step === 'confirm') {
      const yn = yesNo(input);
      if (yn === 'yes') {
        crm.step = 'action';
        waitRuntime(state, { type: 'crm_change_plan', subscription_id: String(crm.subscription_id), product_id: String(crm.product_id) }, actions);
        return;
      }
      if (yn === 'no') {
        go(sayAndGo(def, node, 'kept', d.kept_text || CRM_TEXTS.change_plan.kept_text, state, ctx, actions));
        return;
      }
      invalidChoice(() => sendText(actions, fillVars(String(d.confirm_text || '').trim() || CRM_TEXTS.change_plan.confirm_text, state, ctx), ctx));
      return;
    }
  }
}

function registerFinish(def: BotDefinition, state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[], fields: CrmField[], isUpdate: boolean): string | null | 'stop' {
  const d = node.data || {};
  const values = state.crm?.fields || {};
  if (d.confirm !== false) {
    state.crm!.step = 'confirm';
    const resumo = resumoOf(fields, values);
    sendText(actions, fillVars(String(d.confirm_text || '').trim() || (isUpdate ? CRM_TEXTS.update : CRM_TEXTS.register).confirm_text, state, ctx, { resumo }), ctx);
    waitInput(state, 'crm_confirm', actions, 'Aguardando a confirmação dos dados');
    return 'stop';
  }
  state.crm!.step = 'action';
  waitRuntime(state, isUpdate ? { type: 'crm_update_customer', fields: values } : { type: 'crm_create_customer', fields: values, link_role: String(d.link_role || 'owner') }, actions);
  return 'stop';
}

// ------------------------------------------------------------------ resultado do runtime (`crm_result`)
function crmResult(def: BotDefinition, state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[], payload: BotEventPayload) {
  const d = node.data || {};
  const ok = Boolean(payload?.ok);
  const go = (next: string | null | 'stop') => {
    if (next === 'stop') return;
    state.status = 'active';
    state.waiting_for = null;
    state.retries = 0;
    walk(def, state, next, ctx, actions);
  };
  const failed = (fallback: string) => {
    if (payload?.error) actions.push({ type: 'info', text: `Erro do CRM: ${payload.error}` });
    state.crm = null;
    // recusa amigável do runtime (ex.: "confirme o CPF para alterar") é SEMPRE dita; depois segue por `failed`
    if (String(payload?.user_text || '').trim()) {
      go(sayAndGo(def, node, 'failed', String(payload!.user_text), state, ctx, actions));
      return;
    }
    go(exitPort(def, node, 'failed', d.failed_text || fallback, state, ctx, actions));
  };
  // o runtime devolve o cliente atualizado (cadastro, assinatura nova, cancelamento…)
  if (payload?.customer) setCustomer(state, ctx, payload.customer);
  if (Array.isArray(payload?.customers)) ctx.customers = payload.customers;
  if (payload?.subscription) {
    const c = currentCustomer(state, ctx);
    if (c) {
      const i = (c.subscriptions || []).findIndex((s) => s.id === payload.subscription!.id);
      c.subscriptions = c.subscriptions || [];
      if (i >= 0) c.subscriptions[i] = payload.subscription;
      else c.subscriptions.push(payload.subscription);
      if (state.crm) state.crm.subscription_id = payload.subscription.id;
    }
  }

  switch (node.type) {
    case 'crm_identify': {
      const list = Array.isArray(payload?.customers) && payload.customers.length ? payload.customers : payload?.customer ? [payload.customer] : [];
      if (!ok) {
        // a consulta FALHOU (limite de tentativas, erro do banco…) ≠ "não achei": avisa e sai por `invalid`
        // (ou `not_found` quando `invalid` não está ligada), sem o texto de "não encontrei"
        if (payload?.error) actions.push({ type: 'info', text: `Erro do CRM: ${payload.error}` });
        state.crm = null;
        sendText(actions, fillVars(String(payload?.user_text || '').trim() || String(d.failed_text || '').trim() || CRM_TEXTS.failed, state, ctx), ctx);
        go(nextOf(def, node.id, 'invalid') || nextOf(def, node.id, 'not_found'));
        return;
      }
      if (!list.length) {
        if (state.crm) state.crm.step = 'lookup';
        go(identifyResolve(def, state, node, ctx, actions, []));
        return;
      }
      go(identifyResolve(def, state, node, ctx, actions, list));
      return;
    }
    case 'crm_register':
    case 'crm_update': {
      if (!ok) return failed(CRM_TEXTS.failed);
      const isUpdate = node.type === 'crm_update';
      state.crm = null;
      sendText(actions, fillVars(String(d.done_text || '').trim() || (isUpdate ? CRM_TEXTS.update : CRM_TEXTS.register).done_text, state, ctx), ctx);
      go(nextOf(def, node.id, isUpdate ? 'out' : 'done'));
      return;
    }
    case 'crm_subscribe': {
      if (!ok) return failed(CRM_TEXTS.failed);
      if (payload?.charge && payload.charge.id) {
        state.charge = { ...payload.charge };
        state.status = 'waiting';
        state.waiting_for = 'charge';
        state.retries = 0;
        actions.push({ type: 'info', text: `Cobrança de ${formatBRL(payload.charge.amount_cents)} enviada — aguardando o pagamento` });
        return;
      }
      state.charge = null;
      sendText(actions, fillVars(String(d.subscribed_text || '').trim() || CRM_TEXTS.subscribe.subscribed_text, state, ctx), ctx);
      go(nextOf(def, node.id, 'subscribed'));
      return;
    }
    case 'crm_invoice': {
      if (!ok) return failed(CRM_TEXTS.failed);
      if (payload?.charge) state.charge = { ...state.charge, ...payload.charge } as BotCharge;
      sendText(actions, fillVars(String(d.sent_text || '').trim() || CRM_TEXTS.invoice.sent_text, state, ctx), ctx);
      go(nextOf(def, node.id, 'sent'));
      return;
    }
    case 'crm_cancel': {
      if (!ok) return failed(CRM_TEXTS.failed);
      sendText(actions, fillVars(String(d.canceled_text || '').trim() || CRM_TEXTS.cancel.canceled_text, state, ctx), ctx);
      go(nextOf(def, node.id, 'canceled'));
      return;
    }
    case 'crm_pause': {
      if (!ok) return failed(CRM_TEXTS.failed);
      sendText(actions, fillVars(String(d.paused_text || '').trim() || CRM_TEXTS.pause.paused_text, state, ctx), ctx);
      go(nextOf(def, node.id, 'paused'));
      return;
    }
    case 'crm_change_plan': {
      if (!ok) return failed(CRM_TEXTS.failed);
      if (payload?.product && state.crm) state.crm.product_id = payload.product.id;
      sendText(actions, fillVars(String(d.changed_text || '').trim() || CRM_TEXTS.change_plan.changed_text, state, ctx), ctx);
      go(nextOf(def, node.id, 'changed'));
      return;
    }
    default:
      actions.push({ type: 'info', text: 'Resultado do CRM recebido fora de um bloco de CRM' });
  }
}

// =================================================================== AGENDA (Fase 6, contrato §9.4)
// Blocos: book_service (agendar) · my_appointments (meus agendamentos: confirmar/remarcar/cancelar) · waitlist_join.
// Sub-estado em `state.book` (o runtime persiste em `vars.__book`); o runtime executa as ações `book_*`/`appt_*`/
// `waitlist_join` no WhatsAppSchedulingService e devolve o evento `book_result`.
export const BOOK_TYPES = ['book_service', 'my_appointments', 'waitlist_join'];
const BOOK_TYPE_SET = new Set(BOOK_TYPES);
export const isBookType = (t: string | null | undefined) => BOOK_TYPE_SET.has(String(t || ''));

export const BOOK_TEXTS: Record<string, Record<string, string>> = {
  book_service: {
    choose_service: 'Qual serviço você quer agendar?',
    choose_resource: 'Com quem você prefere?',
    any_resource: 'Tanto faz (primeiro horário livre)',
    choose_day: 'Para qual dia? 📅 Responda com o número:',
    more_days: 'Ver mais dias ➡️',
    first_days: 'Voltar aos primeiros dias ⬅️',
    choose_time: 'Horários livres em *{{agendamento.data}}* 🕒 Responda com o número:',
    more_times: 'Mais horários ⏩',
    first_times: 'Primeiros horários ⏪',
    other_day: 'Outro dia 📅',
    confirm:
      'Confira o agendamento:\n\n*{{agendamento.servico}}*\n👤 {{agendamento.profissional}}\n📅 {{agendamento.data}} às {{agendamento.hora}}\n💰 {{agendamento.valor}} — {{agendamento.pagamento}}\n\n1️⃣ Confirmar\n2️⃣ Escolher outro horário\n3️⃣ Desistir',
    booked: 'Agendado ✅ *{{agendamento.servico}}* em {{agendamento.data}} às {{agendamento.hora}} com {{agendamento.profissional}}. Até lá!',
    pending_payment: 'Reservei o seu horário ⏳ Para confirmar, pague *{{cobranca.valor}}* pelo PIX abaixo — o horário fica guardado por pouco tempo.',
    paid: 'Pagamento confirmado ✅ Seu horário está garantido: *{{agendamento.servico}}* em {{agendamento.data}} às {{agendamento.hora}}.',
    expired: 'O prazo para pagar terminou e o horário foi liberado ⌛ Se ainda quiser, é só me chamar para agendar de novo.',
    waiting: 'Ainda estou aguardando o pagamento ⏳ Assim que ele cair eu confirmo o seu horário. Para voltar ao início, digite *{{comando_reiniciar}}*.',
    no_slots: 'Não encontrei horários livres para *{{agendamento.servico}}* nos próximos dias 😕',
    no_services: 'No momento não há serviços disponíveis para agendar 😕',
    day_full: 'Os horários desse dia acabaram de esgotar 😕 Veja os dias que ainda têm vaga:',
    conflict: 'Ops, esse horário acabou de ser reservado por outra pessoa 😕 Veja os que ainda estão livres:',
    busy: 'Você já tem um agendamento nesse horário 🙂 Escolha outro:',
    cancel: 'Tudo bem, não agendei nada. Quando quiser, é só me chamar 🙂',
    failed: 'Ops, não consegui concluir agora 😕 Tente de novo mais tarde ou fale com um atendente.',
  },
  my_appointments: {
    list: 'Seus próximos agendamentos 📅 Qual deles?',
    none: 'Você não tem agendamentos marcados 🙂',
    details: '*{{agendamento.servico}}*\n📅 {{agendamento.data}} às {{agendamento.hora}}\n👤 {{agendamento.profissional}}\n📌 {{agendamento.situacao}}',
    choose_action: '*{{agendamento.servico}}*\n📅 {{agendamento.data}} às {{agendamento.hora}}\n👤 {{agendamento.profissional}}\n📌 {{agendamento.situacao}}\n\nO que você quer fazer?',
    opt_confirm: 'Confirmar presença ✅',
    opt_pay: 'Ver o PIX para pagar 💳',
    opt_reschedule: 'Remarcar 🔁',
    opt_cancel: 'Cancelar ❌',
    opt_back: 'Nada, obrigado',
    pay_text: 'Para confirmar o horário, pague pelo PIX abaixo 👇',
    confirmed: 'Presença confirmada ✅ Até {{agendamento.data}} às {{agendamento.hora}}!',
    cancel_free:
      'Você pode cancelar sem custo 🙂\n\nConfirma o cancelamento de *{{agendamento.servico}}* em {{agendamento.data}} às {{agendamento.hora}}?\n\n1️⃣ Sim, cancelar\n2️⃣ Não, manter',
    cancel_late:
      'Atenção: o prazo para cancelar sem custo terminou ({{agendamento.prazo_cancelamento}}) e o valor pago pode não ser devolvido.\n\nConfirma o cancelamento de *{{agendamento.servico}}* em {{agendamento.data}} às {{agendamento.hora}}?\n\n1️⃣ Sim, cancelar\n2️⃣ Não, manter',
    canceled: 'Agendamento cancelado ✅',
    kept: 'Combinado, seu agendamento continua como está 🙂',
    confirm:
      'Remarcar *{{agendamento.servico}}* de {{agendamento.data_anterior}} às {{agendamento.hora_anterior}} para *{{agendamento.data}} às {{agendamento.hora}}*?\n\n1️⃣ Confirmar\n2️⃣ Escolher outro horário\n3️⃣ Desistir',
    rescheduled: 'Remarcado ✅ Agora é *{{agendamento.data}} às {{agendamento.hora}}* com {{agendamento.profissional}}.',
    no_slots: 'Não encontrei outro horário livre nos próximos dias 😕 Seu agendamento continua como está.',
  },
  waitlist_join: {
    choose_service: 'Para qual serviço você quer entrar na lista de espera?',
    choose_period: 'Qual período fica melhor para você?',
    done: 'Pronto! Coloquei você na lista de espera de *{{agendamento.servico}}* 📝 Se abrir um horário, eu te aviso por aqui.',
    cancel: 'Tudo bem 🙂 Quando quiser, é só me chamar.',
  },
};
/** Texto do bloco de agenda: `data.texts[key]` (vazio = padrão do tipo; chaves comuns caem no padrão do "Agendar"). */
function bt(node: BotNode, key: string) {
  const own = String(node.data?.texts?.[key] ?? '').trim();
  return own || BOOK_TEXTS[node.type]?.[key] || BOOK_TEXTS.book_service[key] || '';
}

export const WAITLIST_PERIODS: BotBookOption[] = [
  { id: 'morning', label: 'Manhã', keywords: ['manha', 'cedo'] },
  { id: 'afternoon', label: 'Tarde', keywords: ['tarde'] },
  { id: 'evening', label: 'Noite', keywords: ['noite'] },
  { id: 'any', label: 'Qualquer horário', keywords: ['qualquer', 'tanto faz', 'qualquer um', 'qualquer horario'] },
];
const DAYS_PER_PAGE = 8;
const TIMES_PER_PAGE = 12;
const MAX_CONFLICTS = 3;
const UPCOMING = new Set(['pending_payment', 'booked', 'confirmed', 'in_progress']);
const MANAGEABLE = new Set(['pending_payment', 'booked', 'confirmed']);
const APPT_STATUS_LABEL: Record<string, string> = {
  pending_payment: 'aguardando pagamento',
  booked: 'agendado',
  confirmed: 'confirmado',
  in_progress: 'em atendimento',
  done: 'concluído',
  canceled: 'cancelado',
  no_show: 'falta',
  expired: 'expirado',
};

// --- datas (Brasil sem horário de verão: BRT fixo -03:00, igual ao serviço de agenda)
const BRT_OFFSET_MS = 3 * 3_600_000;
const WD_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const WD_WORDS = [['domingo'], ['segunda', 'segunda feira'], ['terca', 'terca feira'], ['quarta', 'quarta feira'], ['quinta', 'quinta feira'], ['sexta', 'sexta feira'], ['sabado']];
function brtOf(iso: string | null | undefined): { ymd: string; hm: string } | null {
  const t = Date.parse(String(iso || ''));
  if (!Number.isFinite(t)) return null;
  const s = new Date(t - BRT_OFFSET_MS).toISOString();
  return { ymd: s.slice(0, 10), hm: s.slice(11, 16) };
}
const dowOf = (ymd: string) => {
  const t = Date.parse(`${String(ymd).slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(t) ? new Date(t).getUTCDay() : -1;
};
/** 'YYYY-MM-DD' → "qua 15/10". */
export function fmtDayLabel(ymd: string | null | undefined) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ''));
  if (!m) return '';
  return `${WD_SHORT[dowOf(m[0])] || ''} ${m[3]}/${m[2]}`.trim();
}
export function addDaysYmd(ymd: string, n: number) {
  return new Date(Date.parse(`${ymd}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}
const slotTime = (s: BotSlot | null | undefined) => String(s?.time_label || brtOf(s?.starts_at)?.hm || '');
const apptDay = (a: BotAppointment | null | undefined) => (a ? a.date_label || fmtDayLabel(brtOf(a.starts_at)?.ymd) : '');
const apptTime = (a: BotAppointment | null | undefined) => (a ? a.time_label || brtOf(a.starts_at)?.hm || '' : '');
function fmtDeadline(iso: string | null | undefined) {
  const p = brtOf(iso);
  return p ? `${p.ymd.slice(8, 10)}/${p.ymd.slice(5, 7)} às ${p.hm}` : '';
}
const clampDays = (v: any) => Math.max(1, Math.min(60, Math.round(Number(v) || 14)));

function paymentLabel(svc: BotService | null | undefined, appt: BotAppointment | null | undefined) {
  const p = String(svc?.booking?.payment || appt?.payment || '');
  if (p === 'on_site') return 'pagamento no local';
  if (p === 'on_booking') return 'pagamento por PIX para confirmar';
  if (p === 'deposit') {
    const dep = Number(svc?.booking?.deposit_cents) || 0;
    return dep > 0 ? `sinal de ${formatBRL(dep)} por PIX para confirmar` : 'sinal por PIX para confirmar';
  }
  if (p === 'included') return 'incluso no seu plano';
  return '';
}
const serviceLabel = (s: BotService) =>
  [s.name, s.price_cents > 0 ? s.price_label || formatBRL(s.price_cents) : '', s.duration_label || (s.duration_minutes ? `${s.duration_minutes} min` : '')].filter(Boolean).join(' · ');
const apptLabel = (a: BotAppointment) => [`${apptDay(a)} às ${apptTime(a)}`, a.service_name || '', a.resource?.name || ''].filter(Boolean).join(' · ');

function compactService(s: BotService): BotService {
  return {
    id: String(s.id),
    name: String(s.name || ''),
    description: s.description ?? null,
    price_cents: Number(s.price_cents) || 0,
    price_label: s.price_label || formatBRL(Number(s.price_cents) || 0),
    duration_minutes: Number(s.duration_minutes) || 0,
    duration_label: s.duration_label || '',
    booking: s.booking ? { payment: s.booking.payment, deposit_cents: s.booking.deposit_cents, address: s.booking.address ?? null } : null,
    ...(Array.isArray(s.resources) ? { resources: s.resources.filter((r) => r && r.id).slice(0, 30).map((r) => ({ id: String(r.id), name: String(r.name || '') })) } : {}),
  };
}

/** Próximos agendamentos conhecidos (contexto do runtime + o que o bloco acabou de criar), em ordem. */
function upcomingAppointments(state: BotState, ctx: BotContext): BotAppointment[] {
  const list = [...(ctx.appointments || [])];
  const mine = state.book?.appointment;
  if (mine && !list.some((a) => a.id === mine.id)) list.push(mine);
  return list
    .map((a) => (mine && a.id === mine.id ? mine : a))
    .filter((a) => a && UPCOMING.has(String(a.status)))
    .sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)));
}

/** Variáveis {{agendamento.*}}: horário escolhido (durante o agendamento) › agendamento em foco › próximo do contato. */
export function bookingVars(state: BotState, ctx: BotContext): Record<string, string> {
  const b = state.book;
  const slot = b?.slot || null;
  const upcoming = upcomingAppointments(state, ctx);
  const appt = b?.appointment || (!b?.service ? upcoming[0] || null : null);
  const svc = b?.service || null;
  const out: Record<string, string> = {};
  out['agendamento.servico'] = String(appt?.service_name || svc?.name || state.vars?.servico || '');
  out['agendamento.profissional'] = String((slot ? slot.resource_name || b?.resource_name : appt?.resource?.name || b?.resource_name) || '');
  out['agendamento.data'] = slot ? fmtDayLabel(brtOf(slot.starts_at)?.ymd) || String(b?.day_label || '') : appt ? apptDay(appt) : String(b?.day_label || '');
  out['agendamento.hora'] = slot ? slotTime(slot) : apptTime(appt);
  out['agendamento.data_anterior'] = slot && appt ? apptDay(appt) : '';
  out['agendamento.hora_anterior'] = slot && appt ? apptTime(appt) : '';
  out['agendamento.valor'] = appt?.price_label || (appt?.price_cents != null ? formatBRL(appt.price_cents) : '') || (svc ? svc.price_label || formatBRL(svc.price_cents) : '');
  out['agendamento.duracao'] = svc ? svc.duration_label || (svc.duration_minutes ? `${svc.duration_minutes} min` : '') : '';
  out['agendamento.endereco'] = String(svc?.booking?.address || appt?.address || '');
  out['agendamento.pagamento'] = paymentLabel(svc, appt);
  out['agendamento.link_pagamento'] = String(state.charge?.pay_link || appt?.charge?.pay_link || '');
  out['agendamento.situacao'] = appt ? APPT_STATUS_LABEL[String(appt.status)] || String(appt.status) : '';
  out['agendamento.prazo_cancelamento'] = fmtDeadline(appt?.cancel_deadline);
  out['agendamentos.lista'] = upcoming.length
    ? upcoming.map((a) => `• ${apptLabel(a)} — ${APPT_STATUS_LABEL[String(a.status)] || a.status}`).join('\n')
    : 'Você não tem agendamentos marcados.';
  return out;
}

function evalAppointmentRule(rule: any, state: BotState, ctx: BotContext) {
  const key = String(rule?.key || 'has_upcoming');
  const op = String(rule?.op || 'is');
  const val = String(rule?.value ?? '');
  const list = upcomingAppointments(state, ctx);
  if (key === 'next_in_hours') {
    const now = (ctx.now || new Date()).getTime();
    const next = list.find((a) => a.status === 'in_progress' || Date.parse(a.starts_at) >= now);
    if (!next) return false; // sem agendamento: nenhuma comparação é verdadeira
    const hours = (Date.parse(next.starts_at) - now) / 3_600_000;
    const n = Number(val.replace(',', '.'));
    if (!Number.isFinite(n)) return false;
    if (op === 'lt') return hours < n;
    if (op === 'gt') return hours > n;
    if (op === 'gte') return hours >= n;
    return hours <= n; // 'lte' (padrão: "daqui a até N horas")
  }
  if (key === 'has_pending') return String(list.some((a) => a.status === 'pending_payment')) === (val || 'true');
  return String(list.length > 0) === (val || 'true'); // has_upcoming
}

// --- mecânica
function bookRequest(state: BotState, action: BotAction, step: string, actions: BotAction[]): 'stop' {
  const b = state.book!;
  b.step = step;
  b.options = undefined;
  actions.push(action);
  state.status = 'waiting';
  state.waiting_for = 'book:wait';
  state.retries = 0;
  return 'stop';
}

function askBook(state: BotState, ctx: BotContext, actions: BotAction[], node: BotNode, head: string, options: BotBookOption[], wf: BotWaitingFor, info: string): 'stop' {
  state.book!.options = options;
  sendText(actions, numberedList(fillVars(head, state, ctx), options.map((o) => o.label), numberingOf(node, ctx.settings)), ctx);
  waitInput(state, wf, actions, info);
  return 'stop';
}

/** Saiu do bloco: guarda só o que os blocos seguintes leem ({{agendamento.*}}). */
function bookFocus(state: BotState) {
  const b = state.book;
  state.book = b
    ? {
        mode: b.mode,
        step: 'done',
        service: b.service || null,
        appointment: b.appointment || null,
        slot: b.appointment ? null : b.slot || null,
        resource_id: b.resource_id ?? null,
        resource_name: b.resource_name || null,
        day_label: b.day_label || null,
      }
    : null;
}

function bookGo(def: BotDefinition, state: BotState, ctx: BotContext, actions: BotAction[], next: string | null | 'stop') {
  if (next === 'stop') return;
  state.status = 'active';
  state.waiting_for = null;
  state.retries = 0;
  walk(def, state, next, ctx, actions);
}

/** Falha: recusa amigável do runtime (`user_text`) é SEMPRE dita; senão `failed` (texto só se a porta não estiver ligada). */
function bookFailed(def: BotDefinition, state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[], payload?: BotEventPayload | null): string | null {
  if (payload?.error) actions.push({ type: 'info', text: `Erro da agenda: ${payload.error}` });
  bookFocus(state);
  const ut = String(payload?.user_text || '').trim();
  if (ut) return sayAndGo(def, node, 'failed', ut, state, ctx, actions);
  return exitPort(def, node, 'failed', bt(node, 'failed') || CRM_TEXTS.failed, state, ctx, actions);
}

/** Sem horário/serviço: avisa SEMPRE (o cliente precisa saber) e segue por `no_slots` (Meus agendamentos: `out`). */
function bookNoSlots(def: BotDefinition, state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[], key = 'no_slots') {
  bookFocus(state);
  actions.push({ type: 'info', text: key === 'no_services' ? 'Nenhum serviço disponível' : 'Nenhum horário livre na janela' });
  return sayAndGo(def, node, node.type === 'book_service' ? 'no_slots' : 'out', bt(node, key), state, ctx, actions);
}

/** Cliente desistiu no meio: Agendar → `cancel` (texto sempre); Meus agendamentos / Lista de espera → `out`. */
function bookGiveUp(def: BotDefinition, state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[]) {
  bookFocus(state);
  actions.push({ type: 'info', text: 'Cliente desistiu' });
  const port = node.type === 'book_service' ? 'cancel' : 'out';
  return sayAndGo(def, node, port, bt(node, node.type === 'my_appointments' ? 'kept' : 'cancel'), state, ctx, actions);
}

function requestAvailability(state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[], date: string | null): 'stop' {
  const b = state.book!;
  const daysAhead = clampDays(node.data?.days_ahead);
  b.date = date || null;
  if (!date) b.day_label = null;
  b.slot = null;
  return bookRequest(
    state,
    { type: 'book_availability', product_id: String(b.service?.id || ''), resource_id: b.resource_id ?? null, from: date || brtDate(ctx.now || new Date()), days: date ? 1 : daysAhead },
    'availability',
    actions,
  );
}

function dayKeywords(ymd: string, today: string) {
  const kw = [`${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`, `${Number(ymd.slice(8, 10))}/${Number(ymd.slice(5, 7))}`, ...(WD_WORDS[dowOf(ymd)] || [])];
  if (ymd === today) kw.push('hoje');
  if (ymd === addDaysYmd(today, 1)) kw.push('amanha');
  return kw;
}
function timeKeywords(t: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return [t];
  const h = String(Number(m[1]));
  return m[2] === '00' ? [t, `${h}h`, `${m[1]}h`, `${h}h00`, `${h} horas`] : [t, `${h}h${m[2]}`, `${m[1]}h${m[2]}`];
}

function showDays(state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[]): 'stop' {
  const b = state.book!;
  const all = b.days || [];
  const page = Math.max(0, Number(b.day_page) || 0);
  const today = brtDate(ctx.now || new Date());
  const opts: BotBookOption[] = all
    .slice(page * DAYS_PER_PAGE, (page + 1) * DAYS_PER_PAGE)
    .map((x) => ({ id: x.date, label: `${x.label} · ${x.count} ${x.count === 1 ? 'horário' : 'horários'}`, keywords: dayKeywords(x.date, today) }));
  if (all.length > (page + 1) * DAYS_PER_PAGE) opts.push({ id: '__more_days', label: bt(node, 'more_days'), keywords: ['mais dias', 'mais'] });
  else if (page > 0) opts.push({ id: '__first_days', label: bt(node, 'first_days'), keywords: ['voltar', 'primeiros dias'] });
  return askBook(state, ctx, actions, node, bt(node, 'choose_day'), opts, 'book:day', 'Aguardando o cliente escolher o dia');
}

function showTimes(state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[]): 'stop' {
  const b = state.book!;
  const slots = b.slots || [];
  const page = Math.max(0, Number(b.page) || 0);
  const names = new Set(slots.map((s) => s.resource_name || s.resource_id || ''));
  const withName = !b.resource_id && names.size > 1;
  const opts: BotBookOption[] = slots.slice(page * TIMES_PER_PAGE, (page + 1) * TIMES_PER_PAGE).map((s, i) => {
    const t = slotTime(s);
    return { id: String(page * TIMES_PER_PAGE + i), label: withName && s.resource_name ? `${t} · ${s.resource_name}` : t, keywords: timeKeywords(t) };
  });
  if (slots.length > (page + 1) * TIMES_PER_PAGE) opts.push({ id: '__more_times', label: bt(node, 'more_times'), keywords: ['mais horarios', 'mais'] });
  else if (page > 0) opts.push({ id: '__first_times', label: bt(node, 'first_times'), keywords: ['primeiros horarios', 'voltar'] });
  opts.push({ id: '__other_day', label: bt(node, 'other_day'), keywords: ['outro dia', 'outra data', 'outro'] });
  return askBook(state, ctx, actions, node, bt(node, 'choose_time'), opts, 'book:time', 'Aguardando o cliente escolher o horário');
}

function pickService(def: BotDefinition, state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[], s: BotService): string | null | 'stop' {
  const b = state.book!;
  b.service = compactService(s);
  b.services = undefined;
  b.options = undefined;
  state.vars.servico_id = b.service.id;
  state.vars.servico = b.service.name;
  actions.push({ type: 'set_var', name: 'servico_id', value: b.service.id });
  if (node.type === 'waitlist_join') {
    b.resource_id = null;
    return waitlistPeriod(state, node, ctx, actions);
  }
  return chooseResource(def, state, node, ctx, actions);
}

function chooseResource(def: BotDefinition, state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[]): string | null | 'stop' {
  const b = state.book!;
  const mode = String(node.data?.resource || 'auto');
  if (mode === 'auto') {
    b.resource_id = null;
    b.resource_name = null;
    return requestAvailability(state, node, ctx, actions, null);
  }
  const res = Array.isArray(b.service?.resources) ? b.service!.resources! : null;
  if (!res) return bookRequest(state, { type: 'book_resources', product_id: String(b.service?.id || '') }, 'resources', actions);
  if (!res.length) return bookNoSlots(def, state, node, ctx, actions);
  const set = (r: { id: string; name: string } | null) => {
    b.resource_id = r ? r.id : null;
    b.resource_name = r ? r.name : null;
    if (r) state.vars.profissional_id = r.id;
    else delete state.vars.profissional_id;
  };
  if (mode !== 'ask') {
    const r = res.find((x) => x.id === mode);
    if (!r) {
      actions.push({ type: 'info', text: 'O profissional/recurso escolhido no bloco não atende este serviço (ou foi removido)' });
      return bookFailed(def, state, node, ctx, actions);
    }
    set(r);
    return requestAvailability(state, node, ctx, actions, null);
  }
  if (res.length === 1) {
    set(res[0]);
    return requestAvailability(state, node, ctx, actions, null);
  }
  const opts: BotBookOption[] = [
    ...res.map((r) => ({ id: r.id, label: r.name, keywords: [r.name] })),
    { id: '__any', label: bt(node, 'any_resource'), keywords: ['tanto faz', 'qualquer', 'qualquer um'] },
  ];
  return askBook(state, ctx, actions, node, bt(node, 'choose_resource'), opts, 'book:resource', 'Aguardando o cliente escolher com quem');
}

function askBookConfirm(state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[]): 'stop' {
  state.book!.options = undefined;
  sendText(actions, fillVars(bt(node, 'confirm'), state, ctx), ctx);
  waitInput(state, 'book:confirm', actions, state.book!.mode === 'manage' ? 'Aguardando a confirmação da remarcação' : 'Aguardando a confirmação do agendamento');
  return 'stop';
}

function doBook(state: BotState, node: BotNode, actions: BotAction[]): 'stop' {
  const b = state.book!;
  const slot = b.slot!;
  const resource_id = slot.resource_id ?? b.resource_id ?? null;
  if (b.mode === 'manage')
    return bookRequest(state, { type: 'book_reschedule', appointment_id: String(b.appointment?.id || ''), starts_at: slot.starts_at, resource_id }, 'reschedule', actions);
  return bookRequest(state, { type: 'book_create', product_id: String(b.service?.id || ''), resource_id, starts_at: slot.starts_at, node_id: node.id }, 'create', actions);
}

function waitlistPeriod(state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[]): 'stop' {
  const per = String(node.data?.period || 'ask');
  if (per !== 'ask') return waitlistJoin(state, node, ctx, actions, WAITLIST_PERIODS.some((p) => p.id === per) ? per : 'any');
  return askBook(state, ctx, actions, node, bt(node, 'choose_period'), WAITLIST_PERIODS, 'book:period', 'Aguardando o período preferido');
}

function waitlistJoin(state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[], period: string): 'stop' {
  const b = state.book!;
  b.period = period;
  const today = brtDate(ctx.now || new Date());
  return bookRequest(
    state,
    { type: 'waitlist_join', product_id: String(b.service?.id || ''), resource_id: b.resource_id ?? null, period, date_from: today, date_to: addDaysYmd(today, clampDays(node.data?.days_ahead) - 1) },
    'waitlist',
    actions,
  );
}

function showApptActions(def: BotDefinition, state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[]): string | null | 'stop' {
  const d = node.data || {};
  const b = state.book!;
  const a = b.appointment!;
  const st = String(a.status);
  const opts: BotBookOption[] = [];
  if (d.allow_confirm !== false && st === 'booked') opts.push({ id: 'confirm', label: bt(node, 'opt_confirm'), keywords: ['confirmar', 'confirmo', 'vou'] });
  if (st === 'pending_payment' && (a.charge?.pix_code || a.charge?.pay_link)) opts.push({ id: 'pay', label: bt(node, 'opt_pay'), keywords: ['pagar', 'pix'] });
  if (d.allow_reschedule !== false && a.can_reschedule !== false && MANAGEABLE.has(st)) opts.push({ id: 'reschedule', label: bt(node, 'opt_reschedule'), keywords: ['remarcar', 'mudar', 'trocar'] });
  if (d.allow_cancel !== false && MANAGEABLE.has(st)) opts.push({ id: 'cancel', label: bt(node, 'opt_cancel'), keywords: ['cancelar', 'desmarcar'] });
  if (!opts.length) {
    sendText(actions, fillVars(bt(node, 'details'), state, ctx), ctx);
    bookFocus(state);
    return nextOf(def, node.id, 'out');
  }
  opts.push({ id: '__back', label: bt(node, 'opt_back'), keywords: ['nada', 'voltar', 'sair', 'obrigado', 'obrigada'] });
  return askBook(state, ctx, actions, node, bt(node, 'choose_action'), opts, 'appt:action', 'Aguardando o que fazer com o agendamento');
}

// ------------------------------------------------------------------ entrada nos blocos de agenda (chamada pelo walk)
function bookEnter(def: BotDefinition, state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[]): string | null | 'stop' {
  const d = node.data || {};
  if (node.type === 'book_service') {
    state.book = { mode: 'book', step: 'services', conflicts: 0 };
    return bookRequest(state, { type: 'book_services', node_id: node.id }, 'services', actions);
  }
  if (node.type === 'my_appointments') {
    state.book = { mode: 'manage', step: 'list', conflicts: 0 };
    return bookRequest(state, { type: 'appt_list' }, 'list', actions);
  }
  // waitlist_join: 'current' = serviço escolhido no "Agendar" anterior (ex.: porta "sem horário"); sem ele, pergunta
  const pid = String(d.product_id || 'current');
  state.book = { mode: 'waitlist', step: 'services', service: null, resource_id: null };
  if (pid === 'current' && state.vars?.servico_id) {
    state.book.service = { id: String(state.vars.servico_id), name: String(state.vars.servico || ''), price_cents: 0 };
    state.book.resource_id = state.vars.profissional_id ? String(state.vars.profissional_id) : null;
    return waitlistPeriod(state, node, ctx, actions);
  }
  return bookRequest(state, { type: 'book_services', node_id: node.id }, 'services', actions);
}

// ------------------------------------------------------------------ resultado do runtime (`book_result`)
function bookResult(def: BotDefinition, state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[], payload: BotEventPayload) {
  const d = node.data || {};
  const b = state.book || (state.book = { mode: node.type === 'my_appointments' ? 'manage' : node.type === 'waitlist_join' ? 'waitlist' : 'book', step: '' });
  const ok = Boolean(payload?.ok);
  const go = (next: string | null | 'stop') => bookGo(def, state, ctx, actions, next);
  const fail = () => go(bookFailed(def, state, node, ctx, actions, payload));
  if (payload?.customer) setCustomer(state, ctx, payload.customer);

  switch (b.step) {
    case 'services': {
      if (!ok) return fail();
      let list = (payload.services || []).filter((s) => s && s.id);
      if (node.type === 'book_service' && Array.isArray(d.services)) {
        const wanted = d.services.map(String).filter(Boolean);
        if (wanted.length) list = list.filter((s) => wanted.includes(String(s.id)));
      }
      if (node.type === 'waitlist_join') {
        const pid = String(d.product_id || 'current');
        if (pid !== 'current' && pid !== 'ask') list = list.filter((s) => String(s.id) === pid);
      }
      if (!list.length) return go(node.type === 'waitlist_join' ? bookFailed(def, state, node, ctx, actions, { error: 'serviço indisponível' }) : bookNoSlots(def, state, node, ctx, actions, 'no_services'));
      if (list.length === 1) return go(pickService(def, state, node, ctx, actions, list[0]));
      b.services = list.slice(0, 20).map(compactService);
      askBook(state, ctx, actions, node, bt(node, 'choose_service'), b.services.map((s) => ({ id: s.id, label: serviceLabel(s), keywords: [s.name] })), 'book:service', 'Aguardando o cliente escolher o serviço');
      return;
    }
    case 'resources': {
      if (!ok) return fail();
      b.service = { ...(b.service as BotService), resources: (payload.resources || []).filter((r) => r && r.id).map((r) => ({ id: String(r.id), name: String(r.name || '') })) };
      return go(chooseResource(def, state, node, ctx, actions));
    }
    case 'availability': {
      if (!ok) return fail();
      const today = brtDate(ctx.now || new Date());
      const last = addDaysYmd(today, clampDays(d.days_ahead) - 1);
      const days = (payload.days || []).filter((x) => x && x.date && String(x.date) >= today && String(x.date) <= last && Array.isArray(x.slots) && x.slots.length);
      if (b.date) {
        const day = days.find((x) => x.date === b.date);
        if (day) {
          b.slots = day.slots.slice(0, 200);
          b.page = 0;
          b.day_label = day.label || fmtDayLabel(day.date);
          showTimes(state, node, ctx, actions);
          return;
        }
        // o dia escolhido esgotou: avisa e busca a janela inteira de novo
        sendText(actions, fillVars(bt(node, 'day_full'), state, ctx), ctx);
        requestAvailability(state, node, ctx, actions, null);
        return;
      }
      if (!days.length) return go(bookNoSlots(def, state, node, ctx, actions));
      b.days = days.slice(0, 60).map((x) => ({ date: String(x.date), label: x.label || fmtDayLabel(x.date), count: x.slots.length }));
      b.day_page = 0;
      showDays(state, node, ctx, actions);
      return;
    }
    case 'create':
    case 'reschedule': {
      if (!ok) {
        const code = String(payload?.code || '');
        if (code === 'SLOT_TAKEN' || code === 'CONTACT_BUSY') {
          b.conflicts = (Number(b.conflicts) || 0) + 1;
          actions.push({ type: 'info', text: `Horário indisponível (${code}) — tentativa ${b.conflicts}/${MAX_CONFLICTS}` });
          if (b.conflicts >= MAX_CONFLICTS) return fail();
          sendText(actions, fillVars(bt(node, code === 'SLOT_TAKEN' ? 'conflict' : 'busy'), state, ctx), ctx);
          requestAvailability(state, node, ctx, actions, b.date || null); // oferece os próximos livres do mesmo dia
          return;
        }
        return fail();
      }
      if (payload.appointment) b.appointment = payload.appointment;
      if (b.step === 'reschedule') {
        b.slot = null;
        bookFocus(state);
        return go(sayAndGo(def, node, 'out', bt(node, 'rescheduled'), state, ctx, actions));
      }
      const charge = payload.charge && payload.charge.id ? payload.charge : null;
      if (charge) {
        state.charge = { ...charge };
        sendText(actions, fillVars(bt(node, 'pending_payment'), state, ctx), ctx);
        if (charge.pix_code) sendText(actions, String(charge.pix_code), ctx);
        else if (charge.pay_link) sendText(actions, String(charge.pay_link), ctx);
        // porta "pendente" ligada = o fluxo segue sem esperar (o pagamento continua valendo: pago depois → entrega tardia)
        const pp = nextOf(def, node.id, 'pending_payment');
        if (pp) {
          bookFocus(state);
          return go(pp);
        }
        state.status = 'waiting';
        state.waiting_for = 'charge';
        state.retries = 0;
        actions.push({ type: 'info', text: `Agendamento reservado — aguardando o pagamento de ${formatBRL(charge.amount_cents)}` });
        return;
      }
      bookFocus(state);
      return go(sayAndGo(def, node, 'booked', bt(node, 'booked'), state, ctx, actions));
    }
    case 'list': {
      if (!ok) return fail();
      const list = (payload.appointments || [])
        .filter((a) => a && a.id && UPCOMING.has(String(a.status)))
        .sort((x, y) => String(x.starts_at).localeCompare(String(y.starts_at)))
        .slice(0, 5);
      b.appointments = list;
      if (!list.length) {
        bookFocus(state);
        return go(sayAndGo(def, node, 'none', bt(node, 'none'), state, ctx, actions));
      }
      if (list.length === 1) {
        b.appointment = list[0];
        return go(showApptActions(def, state, node, ctx, actions));
      }
      askBook(state, ctx, actions, node, bt(node, 'list'), list.map((a) => ({ id: a.id, label: apptLabel(a) })), 'appt:choose', 'Aguardando o cliente escolher o agendamento');
      return;
    }
    case 'confirm_appt':
    case 'cancel_appt': {
      if (!ok) return fail();
      const confirmed = b.step === 'confirm_appt';
      b.appointment = payload.appointment || (b.appointment ? { ...b.appointment, status: confirmed ? 'confirmed' : 'canceled' } : null);
      bookFocus(state);
      return go(sayAndGo(def, node, 'out', bt(node, confirmed ? 'confirmed' : 'canceled'), state, ctx, actions));
    }
    case 'waitlist': {
      if (!ok) return fail();
      bookFocus(state);
      return go(sayAndGo(def, node, 'out', bt(node, 'done'), state, ctx, actions));
    }
    default:
      actions.push({ type: 'info', text: 'Resultado da agenda recebido fora de hora — ignorado.' });
  }
}

/** Cobrança do agendamento paga/expirada (bloco Agendar esperando `charge`). */
function bookChargeEvent(def: BotDefinition, state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[], paid: boolean, payload?: BotEventPayload | null) {
  if (!state.book) state.book = { mode: 'book', step: 'create' };
  if (payload?.appointment) state.book.appointment = payload.appointment;
  if (payload?.customer) setCustomer(state, ctx, payload.customer);
  sendText(actions, fillVars(bt(node, paid ? 'paid' : 'expired'), state, ctx), ctx);
  state.charge = null;
  bookFocus(state);
  state.status = 'active';
  state.waiting_for = null;
  state.retries = 0;
  walk(def, state, nextOf(def, node.id, paid ? 'booked' : 'expired'), ctx, actions);
}

// ------------------------------------------------------------------ entrada do cliente num bloco de agenda
const PAID_RE = /\b(paguei|pago|ja paguei|pix feito|feito|comprovante|transferi)\b/;
function bookInput(def: BotDefinition, state: BotState, node: BotNode, input: string, ctx: BotContext, actions: BotAction[]) {
  const d = node.data || {};
  const b = state.book || (state.book = { mode: node.type === 'my_appointments' ? 'manage' : node.type === 'waitlist_join' ? 'waitlist' : 'book', step: '' });
  const wf = state.waiting_for;
  const maxRetries = maxRetriesOf(d, ctx);
  const n = norm(input);
  const go = (next: string | null | 'stop') => bookGo(def, state, ctx, actions, next);
  const invalid = (relist: () => void) => {
    state.retries += 1;
    sendText(actions, fillVars(String(d.invalid_text || ctx.settings.invalid_option_text || DEFAULT_INVALID), state, ctx), ctx);
    actions.push({ type: 'info', text: `Opção inválida (${state.retries}/${maxRetries})` });
    if (state.retries >= maxRetries) {
      state.retries = 0;
      relist();
    }
  };
  const relist = (headKey: string) => () =>
    sendText(actions, numberedList(fillVars(bt(node, headKey), state, ctx), (b.options || []).map((o) => o.label), numberingOf(node, ctx.settings)), ctx);

  if (wf === 'book:wait') {
    actions.push({ type: 'info', text: 'Aguardando o sistema concluir a ação da agenda' });
    return;
  }
  if (wf === 'charge') {
    if (PAID_RE.test(n) && state.charge) actions.push({ type: 'charge_check', charge_id: state.charge.id });
    else {
      sendText(actions, fillVars(bt(node, 'waiting'), state, ctx, { comando_reiniciar: restartWordOf(ctx.settings) }), ctx);
      actions.push({ type: 'info', text: 'Aguardando a confirmação do pagamento (cliente avisado)' });
    }
    return;
  }
  // "cancelar/desistir" sai de qualquer pergunta — menos do menu de ações e das confirmações (lá "cancelar" é resposta)
  if (wf !== 'appt:action' && wf !== 'appt:cancel' && wf !== 'book:confirm' && CANCEL_WORDS.test(n)) {
    go(bookGiveUp(def, state, node, ctx, actions));
    return;
  }

  switch (wf) {
    case 'book:service': {
      const picked = matchOptionIn(b.options || [], input);
      const s = picked ? (b.services || []).find((x) => x.id === picked.id) : null;
      if (!s) return invalid(relist('choose_service'));
      actions.push({ type: 'info', text: `Serviço: ${s.name}` });
      return go(pickService(def, state, node, ctx, actions, s));
    }
    case 'book:resource': {
      const picked = matchOptionIn(b.options || [], input);
      if (!picked) return invalid(relist('choose_resource'));
      if (picked.id === '__any') {
        b.resource_id = null;
        b.resource_name = null;
        delete state.vars.profissional_id;
      } else {
        b.resource_id = picked.id;
        b.resource_name = picked.label;
        state.vars.profissional_id = picked.id;
      }
      actions.push({ type: 'info', text: `Com: ${picked.label}` });
      return go(requestAvailability(state, node, ctx, actions, null));
    }
    case 'book:day': {
      const picked = matchOptionIn(b.options || [], input);
      if (!picked) return invalid(relist('choose_day'));
      if (picked.id === '__more_days' || picked.id === '__first_days') {
        b.day_page = picked.id === '__more_days' ? (Number(b.day_page) || 0) + 1 : 0;
        showDays(state, node, ctx, actions);
        return;
      }
      b.day_label = (b.days || []).find((x) => x.date === picked.id)?.label || fmtDayLabel(picked.id);
      actions.push({ type: 'info', text: `Dia: ${b.day_label}` });
      return go(requestAvailability(state, node, ctx, actions, picked.id));
    }
    case 'book:time': {
      const picked = matchOptionIn(b.options || [], input);
      if (!picked) return invalid(relist('choose_time'));
      if (picked.id === '__more_times' || picked.id === '__first_times') {
        b.page = picked.id === '__more_times' ? (Number(b.page) || 0) + 1 : 0;
        showTimes(state, node, ctx, actions);
        return;
      }
      if (picked.id === '__other_day') {
        b.slot = null;
        if (!(b.days || []).length) return go(requestAvailability(state, node, ctx, actions, null));
        showDays(state, node, ctx, actions);
        return;
      }
      const slot = (b.slots || [])[Number(picked.id)];
      if (!slot) return invalid(relist('choose_time'));
      b.slot = slot;
      if (slot.resource_name) b.resource_name = slot.resource_name;
      actions.push({ type: 'info', text: `Horário: ${b.day_label || ''} ${slotTime(slot)}` });
      if (d.confirm === false) return go(doBook(state, node, actions));
      return go(askBookConfirm(state, node, ctx, actions));
    }
    case 'book:confirm': {
      const num = keycapToNumber(String(input || '').trim()) || (/^\d$/.test(n) ? n : null);
      if (num === '2' || /\b(outro|outra|trocar|mudar)\b/.test(n)) {
        b.slot = null;
        showTimes(state, node, ctx, actions);
        return;
      }
      const yn = num === '1' ? 'yes' : num === '3' ? 'no' : yesNo(input);
      if (yn === 'yes') return go(doBook(state, node, actions));
      if (yn === 'no' || CANCEL_WORDS.test(n)) return go(bookGiveUp(def, state, node, ctx, actions));
      return invalid(() => sendText(actions, fillVars(bt(node, 'confirm'), state, ctx), ctx));
    }
    case 'book:period': {
      const picked = matchOptionIn(b.options || [], input);
      if (!picked) return invalid(relist('choose_period'));
      actions.push({ type: 'info', text: `Período: ${picked.label}` });
      return go(waitlistJoin(state, node, ctx, actions, picked.id));
    }
    case 'appt:choose': {
      const picked = matchOptionIn(b.options || [], input);
      const a = picked ? (b.appointments || []).find((x) => x.id === picked.id) : null;
      if (!a) return invalid(relist('list'));
      b.appointment = a;
      return go(showApptActions(def, state, node, ctx, actions));
    }
    case 'appt:action': {
      const picked = matchOptionIn(b.options || [], input);
      const a = b.appointment;
      if (!picked || !a) return invalid(relist('choose_action'));
      if (picked.id === '__back') {
        bookFocus(state);
        return go(nextOf(def, node.id, 'out'));
      }
      if (picked.id === 'confirm') return go(bookRequest(state, { type: 'appt_confirm', id: a.id }, 'confirm_appt', actions));
      if (picked.id === 'pay') {
        sendText(actions, fillVars(bt(node, 'pay_text'), state, ctx), ctx);
        sendText(actions, String(a.charge?.pix_code || a.charge?.pay_link || ''), ctx);
        bookFocus(state);
        return go(nextOf(def, node.id, 'out'));
      }
      if (picked.id === 'reschedule') {
        if (!a.product_id) return go(bookFailed(def, state, node, ctx, actions, { error: 'agendamento sem serviço' }));
        b.service = { id: String(a.product_id), name: String(a.service_name || ''), price_cents: Number(a.price_cents) || 0, price_label: a.price_label };
        b.resource_id = a.resource?.id ?? null;
        b.resource_name = a.resource?.name ?? null;
        b.conflicts = 0;
        b.days = undefined;
        return go(requestAvailability(state, node, ctx, actions, null));
      }
      // cancelar: avisa a política (sem custo × fora do prazo) e pede confirmação
      b.options = undefined;
      sendText(actions, fillVars(bt(node, a.can_cancel_free === false ? 'cancel_late' : 'cancel_free'), state, ctx), ctx);
      waitInput(state, 'appt:cancel', actions, 'Aguardando a confirmação do cancelamento');
      return;
    }
    case 'appt:cancel': {
      const yn = yesNo(input, 'cancel');
      const a = b.appointment;
      if (yn === 'yes' && a) return go(bookRequest(state, { type: 'appt_cancel', id: a.id, reason: null }, 'cancel_appt', actions));
      if (yn === 'no') {
        bookFocus(state);
        return go(sayAndGo(def, node, 'out', bt(node, 'kept'), state, ctx, actions));
      }
      return invalid(() => sendText(actions, fillVars(bt(node, a?.can_cancel_free === false ? 'cancel_late' : 'cancel_free'), state, ctx), ctx));
    }
    default:
      actions.push({ type: 'info', text: 'O bloco de agenda não esperava esta resposta.' });
  }
}

// =================================================================== CHAMADOS (Fase 6B, contrato §10.5)
// Blocos: open_ticket (abrir chamado: categoria → assunto? → descrição → fotos? → protocolo) ·
//         my_tickets (meus chamados: lista / protocolo digitado → detalhes → "enviar mais informações").
// Sub-estado em `state.ticket` (o runtime persiste em `vars.__ticket`); o runtime executa as ações `ticket_*` no
// WhatsAppTicketsService e devolve `crm_result {ok, categories|ticket|tickets, error?, user_text?, code?}`.
export const TICKET_TYPES = ['open_ticket', 'my_tickets'];
const TICKET_TYPE_SET = new Set(TICKET_TYPES);
export const isTicketType = (t: string | null | undefined) => TICKET_TYPE_SET.has(String(t || ''));

export const TICKET_TEXTS: Record<string, Record<string, string>> = {
  open_ticket: {
    choose_category: 'Sobre o que é o seu chamado? Responda com o número (ou *0* para cancelar):',
    ask_subject: 'Em poucas palavras, qual é o assunto? (ou digite *pular*)',
    ask_description: 'Descreva o que aconteceu, com o máximo de detalhes que puder 📝',
    short_description: 'Preciso de um pouco mais de detalhe 🙂 Escreva a descrição em texto (pelo menos 5 caracteres).',
    ask_photo: 'Se quiser, mande até 3 fotos ou documentos que ajudem a entender 📎\nQuando terminar, digite *pronto*. Para pular, digite *0*.',
    photo_received: 'Recebi ✅ ({{chamado.anexos}} de 3). Pode mandar mais ou digitar *pronto*.',
    photo_invalid: 'Por aqui eu aceito foto ou documento 📎 Mande o arquivo, digite *pronto* para enviar ou *0* para pular.',
    media_failed: 'Não consegui receber esse arquivo 😕 Tente mandar de novo ou digite *0* para pular.',
    created:
      'Chamado aberto ✅\n\n📄 Protocolo: *{{chamado.protocolo}}*\n📂 {{chamado.categoria}}\n⏱️ Prazo para retorno: {{chamado.prazo}}\n\nGuarde este número para acompanhar.',
    failed: 'Ops, não consegui abrir o chamado agora 😕 Tente de novo mais tarde ou fale com um atendente.',
    cancel: 'Tudo bem, não abri nenhum chamado. Quando precisar, é só me chamar 🙂',
  },
  my_tickets: {
    list: 'Seus chamados 📄 Qual deles você quer ver?',
    none: 'Você não tem chamados em andamento 🙂',
    details:
      '📄 Protocolo *{{chamado.protocolo}}*\n📂 {{chamado.categoria}}\n📌 Situação: *{{chamado.status}}*\n⏱️ Prazo: {{chamado.prazo}}\n💬 Última atualização: {{chamado.ultima_atualizacao}}{{chamado.campos}}',
    ask_protocol: 'Ou digite o número do protocolo.',
    not_found: 'Não encontrei esse protocolo entre os seus chamados 🤔 Confira o número e tente de novo.',
    opt_add_info: 'Enviar mais informações',
    opt_back: 'Voltar',
    ask_info: 'Pode mandar a informação (texto, foto ou documento) que eu junto ao protocolo *{{chamado.protocolo}}* 📝',
    info_added: 'Pronto ✅ Juntei sua mensagem ao protocolo *{{chamado.protocolo}}*. A equipe vai ver por lá.',
    closed: 'Este chamado já foi encerrado 🔒 Se precisar de algo novo, é só abrir outro chamado.',
    media_failed: 'Não consegui receber esse arquivo 😕 Tente mandar de novo.',
    failed: 'Ops, não consegui consultar seus chamados agora 😕 Tente de novo mais tarde ou fale com um atendente.',
  },
};
/** Texto do bloco de chamado: `data.texts[key]` (vazio = padrão do tipo). */
function tt(node: BotNode, key: string) {
  const own = String(node.data?.texts?.[key] ?? '').trim();
  return own || TICKET_TEXTS[node.type]?.[key] || '';
}

export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const TICKET_STATUS_LABEL: Record<string, string> = { open: 'Aberto', pending: 'Aguardando você', resolved: 'Resolvido', closed: 'Encerrado' };
const ACTIVE_TICKET = new Set(['open', 'pending']);
const MAX_TICKET_MEDIA = 3;
const MIN_DESC = 5;
const MAX_DESC = 2000;
const TICKET_MEDIA_KINDS = new Set(['image', 'document']);
const TICKET_SKIP = /^(0|pular|pula|nao|n|nenhum|nenhuma|sem|sem foto|skip|nao tenho)$/;
const TICKET_DONE = /^(pronto|enviar|envia|envie|finalizar|concluir|concluido|so isso|terminei|feito|ok|pode enviar|pode abrir)$/;
const ADD_INFO_RE = /\b(mais|informacao|informacoes|info|enviar|adicionar|complementar)\b/;
const BACK_RE = /^(0|voltar|volta|nada|sair|nao|obrigado|obrigada)$/;
/**
 * Protocolo digitado: tira "protocolo", "nº"… do começo e deixa só letras/dígitos, maiúsculo (igual ao
 * `normalizeProtocolInput` do serviço): "Protocolo nº 2026-000042" → "2026000042".
 */
// palavra só sai com separador depois ("N2026…" pode ser o prefixo da org); "nº"/"n°" saem sempre
const PROTOCOL_WORDS = /^\s*(o\s+)?((protocolo|protocol|prot|numero|número|no|n)[\s:#.-]+|n[º°]\.?\s*)/i;
export const normalizeProtocol = (raw: unknown) => {
  let s = String(raw ?? '');
  for (let i = 0; i < 2; i++) s = s.replace(PROTOCOL_WORDS, '');
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24);
};
const looksLikeProtocol = (raw: string) => {
  const p = normalizeProtocol(raw);
  return p.length >= 4 && (p.match(/\d/g) || []).length >= 4;
};
const ticketStatusLabel = (t: BotTicket | null | undefined) => (t ? t.status_label || TICKET_STATUS_LABEL[String(t.status)] || String(t.status || '') : '');
const ticketLabel = (t: BotTicket) => [t.protocol, t.category_label || t.subject || '', ticketStatusLabel(t)].filter(Boolean).join(' · ');

/** Chamados em andamento do contexto + o em foco nesta conversa (o criado agora conta). */
function activeTickets(state: BotState, ctx: BotContext): BotTicket[] {
  const out: BotTicket[] = [];
  const mine = state.ticket?.ticket || null;
  const seen = new Set<string>();
  for (const t of [mine, ...(Array.isArray(ctx.tickets) ? ctx.tickets : [])]) {
    if (!t?.id || seen.has(t.id)) continue;
    seen.add(t.id);
    if (ACTIVE_TICKET.has(String(t.status))) out.push(t);
  }
  return out;
}

/** {{chamado.*}} / {{chamados.lista}} — chamado em foco (criado/escolhido) › o mais recente em andamento. */
export function ticketVars(state: BotState, ctx: BotContext): Record<string, string> {
  const flowT = state.ticket;
  const active = activeTickets(state, ctx);
  const t = flowT?.ticket || active[0] || null;
  const out: Record<string, string> = {};
  out['chamado.protocolo'] = String(t?.protocol || '');
  out['chamado.categoria'] = String(t?.category_label || flowT?.category?.label || '');
  out['chamado.status'] = ticketStatusLabel(t);
  out['chamado.prazo'] = String(t?.sla_label || '');
  out['chamado.prazo_relativo'] = String(t?.sla_relative || '');
  out['chamado.assunto'] = String(t?.subject || flowT?.subject || '');
  out['chamado.prioridade'] = String(t?.priority_label || '');
  out['chamado.ultima_atualizacao'] = t ? String(t.last_update || '').trim() || 'ainda sem resposta da equipe' : '';
  out['chamado.anexos'] = String((flowT?.media_ids || []).length);
  out['chamados.lista'] = active.length ? active.map((x) => `• ${ticketLabel(x)}`).join('\n') : 'Nenhum chamado em andamento.';
  // campos personalizados visíveis ao cliente (já formatados pelo runtime) e os respondidos agora no bloco
  out['chamado.campos'] = fieldLines(t?.fields);
  for (const f of Array.isArray(t?.fields) ? t!.fields : []) if (f?.key) out[`chamado.custom.${String(f.key).toLowerCase()}`] = String(f.display ?? '');
  for (const f of Array.isArray(flowT?.cf) ? flowT!.cf : []) {
    const k = `chamado.custom.${f.key}`;
    if (!out[k]) out[k] = cfDisplay(f, flowT?.custom?.[f.key]);
  }
  return out;
}

function evalTicketRule(rule: any, state: BotState, ctx: BotContext) {
  const key = String(rule?.key || 'has_open');
  const val = String(rule?.value ?? '');
  const list = activeTickets(state, ctx);
  const cur = key === 'pending_customer' ? list.some((t) => t.status === 'pending') : list.length > 0; // has_open
  return String(cur) === (val || 'true');
}

// --- mecânica
function ticketRequest(state: BotState, action: BotAction, step: string, actions: BotAction[], keepOptions = false): 'stop' {
  const t = state.ticket!;
  t.step = step;
  if (!keepOptions) t.options = undefined;
  actions.push(action);
  state.status = 'waiting';
  state.waiting_for = 'ticket:wait';
  state.retries = 0;
  return 'stop';
}

function askTicketText(state: BotState, ctx: BotContext, actions: BotAction[], text: string, wf: BotWaitingFor, info: string): 'stop' {
  sendText(actions, fillVars(text, state, ctx), ctx);
  waitInput(state, wf, actions, info);
  return 'stop';
}

/** Saiu do bloco: guarda só o que os blocos seguintes leem ({{chamado.*}}). */
function ticketFocus(state: BotState) {
  const t = state.ticket;
  state.ticket = t ? { mode: t.mode, step: 'done', ticket: t.ticket || null, category: t.category || null, subject: t.subject || null, media_ids: t.media_ids || [] } : null;
}

function ticketGo(def: BotDefinition, state: BotState, ctx: BotContext, actions: BotAction[], next: string | null | 'stop') {
  if (next === 'stop') return;
  state.status = 'active';
  state.waiting_for = null;
  state.retries = 0;
  walk(def, state, next, ctx, actions);
}

/** Falha: recusa amigável do runtime (`user_text`) é SEMPRE dita; senão `failed` (texto só se a porta não estiver ligada). */
function ticketFailed(def: BotDefinition, state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[], payload?: BotEventPayload | null): string | null {
  if (payload?.error) actions.push({ type: 'info', text: `Erro do chamado: ${payload.error}` });
  ticketFocus(state);
  const ut = String(payload?.user_text || '').trim();
  if (ut) return sayAndGo(def, node, 'failed', ut, state, ctx, actions);
  return exitPort(def, node, 'failed', tt(node, 'failed') || CRM_TEXTS.failed, state, ctx, actions);
}

function ticketAfterCategory(state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[]): 'stop' {
  if (node.data?.ask_subject === true) return askTicketText(state, ctx, actions, tt(node, 'ask_subject'), 'ticket:subject', 'Aguardando o assunto do chamado');
  return askTicketText(state, ctx, actions, tt(node, 'ask_description'), 'ticket:description', 'Aguardando a descrição do chamado');
}

function ticketAfterDescription(state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[]): 'stop' {
  if (node.data?.ask_photo !== false && (state.ticket!.media_ids || []).length < MAX_TICKET_MEDIA)
    return askTicketText(state, ctx, actions, tt(node, 'ask_photo'), 'ticket:photo', 'Aguardando fotos/documentos (ou "pronto" / "0")');
  return ticketCreate(state, node, actions, ctx);
}

/** Antes de abrir: pergunta os campos personalizados do chamado (ask_in_bot/obrigatórios) que faltam; depois abre. */
function ticketCreate(state: BotState, node: BotNode, actions: BotAction[], ctx: BotContext): 'stop' {
  const t = state.ticket!;
  const cf = Array.isArray(t.cf) ? t.cf : [];
  const i = Number(t.cf_i) || 0;
  if (i < cf.length) {
    t.step = 'custom';
    sendText(actions, cfQuestion(cf[i], node, ctx), ctx);
    waitInput(state, 'ticket:custom', actions, `Aguardando: ${cf[i].label}`);
    return 'stop';
  }
  const p = String(node.data?.priority || 'default');
  return ticketRequest(
    state,
    {
      type: 'ticket_create',
      node_id: node.id,
      category: String(t.category?.key || ''),
      subject: t.subject || null,
      description: String(t.description || '').slice(0, MAX_DESC),
      priority: TICKET_PRIORITIES.includes(p) ? p : null,
      media_ids: (t.media_ids || []).slice(0, MAX_TICKET_MEDIA),
      custom: { ...(t.custom || {}) },
    },
    'create',
    actions,
  );
}

function zeroMark(node: BotNode, settings: BotSettings) {
  return numberingOf(node, settings) === 'emoji' ? KEYCAPS[0] : '*0.*';
}

/** Lista de chamados numerada + "ou digite o protocolo". */
function showTicketList(state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[]): 'stop' {
  const t = state.ticket!;
  const list = t.tickets || [];
  t.options = list.map((x) => ({ id: x.id, label: ticketLabel(x), keywords: [x.protocol] }));
  const body = numberedList(fillVars(tt(node, 'list'), state, ctx), t.options.map((o) => o.label), numberingOf(node, ctx.settings));
  const tail = fillVars(tt(node, 'ask_protocol'), state, ctx).trim();
  sendText(actions, [body, tail].filter(Boolean).join('\n\n'), ctx);
  waitInput(state, 'ticket:choose', actions, 'Aguardando o cliente escolher o chamado (ou digitar o protocolo)');
  return 'stop';
}

function ticketActionText(state: BotState, node: BotNode, ctx: BotContext) {
  const details = fillVars(tt(node, 'details'), state, ctx);
  const opts = [`${markOf(0, numberingOf(node, ctx.settings))} ${tt(node, 'opt_add_info')}`, `${zeroMark(node, ctx.settings)} ${tt(node, 'opt_back')}`].join('\n');
  return `${details}\n\n${opts}`;
}

/** Detalhes do chamado em foco; com "Enviar mais informações" quando permitido (e o chamado não está encerrado). */
function showTicketDetails(def: BotDefinition, state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[]): string | null | 'stop' {
  const t = state.ticket!;
  const tk = t.ticket!;
  const allow = node.data?.allow_add_info !== false;
  if (allow && tk.status !== 'closed' && tk.can_add_info !== false) {
    t.options = undefined;
    sendText(actions, ticketActionText(state, node, ctx), ctx);
    waitInput(state, 'ticket:action', actions, 'Aguardando: enviar mais informações (1) ou voltar (0)');
    return 'stop';
  }
  const details = fillVars(tt(node, 'details'), state, ctx);
  const extra = allow && tk.status === 'closed' ? fillVars(tt(node, 'closed'), state, ctx) : '';
  sendText(actions, [details, extra].filter((x) => String(x).trim()).join('\n\n'), ctx);
  if (allow && tk.can_add_info === false && tk.status !== 'closed') actions.push({ type: 'info', text: 'Chamado só para consulta nesta conversa (cliente identificado pelo código)' });
  ticketFocus(state);
  return nextOf(def, node.id, 'out');
}

function pickTicket(def: BotDefinition, state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[], tk: BotTicket): string | null | 'stop' {
  const t = state.ticket!;
  t.ticket = tk;
  t.misses = 0;
  actions.push({ type: 'info', text: `Chamado: ${tk.protocol}` });
  return showTicketDetails(def, state, node, ctx, actions);
}

// ------------------------------------------------------------------ entrada nos blocos de chamado (chamada pelo walk)
function ticketEnter(def: BotDefinition, state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[]): string | null | 'stop' {
  const d = node.data || {};
  if (node.type === 'open_ticket') {
    const cf = askFieldsOf(ctx, 'ticket');
    state.ticket = { mode: 'open', step: 'categories', media_ids: [], category: null, subject: null, description: null, ticket: null, ...(cf.length ? { cf, cf_i: 0, custom: {} } : {}) };
    const cat = String(d.category || 'ask').trim();
    if (cat === 'ask') return ticketRequest(state, { type: 'ticket_categories', node_id: node.id }, 'categories', actions);
    state.ticket.category = { key: cat, label: '' };
    return ticketAfterCategory(state, node, ctx, actions);
  }
  state.ticket = { mode: 'mine', step: 'list', ticket: null, misses: 0 };
  return ticketRequest(state, { type: 'ticket_list', show: d.show === 'all' ? 'all' : 'active', limit: 5 }, 'list', actions);
}

// ------------------------------------------------------------------ resultado do runtime (`crm_result` de uma ação ticket_*)
function ticketResult(def: BotDefinition, state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[], payload: BotEventPayload) {
  const d = node.data || {};
  const t = state.ticket || (state.ticket = { mode: node.type === 'my_tickets' ? 'mine' : 'open', step: '' });
  const ok = Boolean(payload?.ok);
  const go = (next: string | null | 'stop') => ticketGo(def, state, ctx, actions, next);
  const fail = () => go(ticketFailed(def, state, node, ctx, actions, payload));
  if (payload?.customer) setCustomer(state, ctx, payload.customer);

  switch (t.step) {
    case 'categories': {
      if (!ok) return fail();
      const list = (payload.categories || []).filter((c) => c && c.key && c.active !== false).slice(0, 20);
      if (!list.length) return go(ticketFailed(def, state, node, ctx, actions, { error: 'nenhuma categoria de chamado ativa' }));
      t.categories = list.map((c) => ({ key: String(c.key), label: String(c.label || c.key) }));
      if (list.length === 1) {
        t.category = t.categories[0];
        actions.push({ type: 'info', text: `Categoria: ${t.category.label}` });
        ticketAfterCategory(state, node, ctx, actions);
        return;
      }
      t.options = t.categories.map((c) => ({ id: c.key, label: c.label, keywords: [c.label] }));
      sendText(actions, numberedList(fillVars(tt(node, 'choose_category'), state, ctx), t.options.map((o) => o.label), numberingOf(node, ctx.settings)), ctx);
      waitInput(state, 'ticket:category', actions, 'Aguardando o cliente escolher a categoria');
      return;
    }
    case 'create': {
      if (!ok || !payload.ticket?.id) return fail();
      t.ticket = payload.ticket;
      if (!t.category?.label && payload.ticket.category_label) t.category = { key: String(payload.ticket.category || t.category?.key || ''), label: payload.ticket.category_label };
      state.vars.protocolo = String(payload.ticket.protocol || '');
      actions.push({ type: 'set_var', name: 'protocolo', value: state.vars.protocolo });
      ticketFocus(state);
      return go(sayAndGo(def, node, 'out', tt(node, 'created'), state, ctx, actions));
    }
    case 'list': {
      if (!ok) return fail();
      const show = d.show === 'all' ? 'all' : 'active';
      const list = (payload.tickets || []).filter((x) => x && x.id && x.protocol && (show === 'all' || ACTIVE_TICKET.has(String(x.status)))).slice(0, 5);
      t.tickets = list;
      if (!list.length) {
        ticketFocus(state);
        return go(sayAndGo(def, node, 'none', tt(node, 'none'), state, ctx, actions));
      }
      if (list.length === 1) return go(pickTicket(def, state, node, ctx, actions, list[0]));
      showTicketList(state, node, ctx, actions);
      return;
    }
    case 'lookup': {
      if (!ok) return fail();
      if (payload.ticket?.id) {
        const tk = payload.ticket;
        if (!(t.tickets || []).some((x) => x.id === tk.id)) t.tickets = [...(t.tickets || []), tk].slice(-6);
        return go(pickTicket(def, state, node, ctx, actions, tk));
      }
      // protocolo de outra pessoa ou inexistente: a mesma resposta (nunca revela que existe)
      t.misses = (Number(t.misses) || 0) + 1;
      const max = maxRetriesOf(d, ctx);
      sendText(actions, fillVars(tt(node, 'not_found'), state, ctx), ctx);
      actions.push({ type: 'info', text: `Protocolo não encontrado (${t.misses}/${max})` });
      if (t.misses >= max) {
        ticketFocus(state);
        return go(nextOf(def, node.id, 'out'));
      }
      waitInput(state, 'ticket:choose', actions, 'Aguardando o cliente escolher o chamado (ou digitar o protocolo)');
      return;
    }
    case 'add_info': {
      if (!ok) {
        if (String(payload?.code || '') === 'CLOSED') {
          if (payload.ticket) t.ticket = payload.ticket;
          ticketFocus(state);
          return go(sayAndGo(def, node, 'out', tt(node, 'closed'), state, ctx, actions));
        }
        return fail();
      }
      if (payload.ticket?.id) t.ticket = payload.ticket;
      ticketFocus(state);
      return go(sayAndGo(def, node, 'out', tt(node, 'info_added'), state, ctx, actions));
    }
    default:
      actions.push({ type: 'info', text: 'Resultado do chamado recebido fora de hora — ignorado.' });
  }
}

// ------------------------------------------------------------------ entrada do cliente num bloco de chamado
function ticketInput(def: BotDefinition, state: BotState, node: BotNode, input: string, ctx: BotContext, actions: BotAction[], media: BotInputMedia | null) {
  const d = node.data || {};
  const t = state.ticket || (state.ticket = { mode: node.type === 'my_tickets' ? 'mine' : 'open', step: '', media_ids: [] });
  const wf = state.waiting_for;
  const maxRetries = maxRetriesOf(d, ctx);
  const text = String(input || '').trim();
  const n = norm(text);
  const go = (next: string | null | 'stop') => ticketGo(def, state, ctx, actions, next);
  const hasFile = Boolean(media && media.kind && media.kind !== 'text');

  if (wf === 'ticket:wait') {
    actions.push({ type: 'info', text: 'Aguardando o sistema concluir a ação do chamado' });
    return;
  }

  // ---------------- Abrir chamado
  if (node.type === 'open_ticket') {
    // "cancelar/desistir" sai de qualquer pergunta; "0" só no menu de categorias (na etapa das fotos "0" = pular)
    if (!hasFile && (CANCEL_WORDS.test(n) || (wf === 'ticket:category' && n === '0'))) {
      ticketFocus(state);
      actions.push({ type: 'info', text: 'Cliente desistiu de abrir o chamado' });
      return go(sayAndGo(def, node, 'cancel', tt(node, 'cancel'), state, ctx, actions));
    }
    switch (wf) {
      case 'ticket:category': {
        const picked = matchOptionIn(t.options || [], text);
        const c = picked ? (t.categories || []).find((x) => x.key === picked.id) : null;
        if (!c) {
          state.retries += 1;
          sendText(actions, fillVars(String(d.invalid_text || ctx.settings.invalid_option_text || DEFAULT_INVALID), state, ctx), ctx);
          actions.push({ type: 'info', text: `Opção inválida (${state.retries}/${maxRetries})` });
          if (state.retries >= maxRetries) {
            state.retries = 0;
            sendText(actions, numberedList(fillVars(tt(node, 'choose_category'), state, ctx), (t.options || []).map((o) => o.label), numberingOf(node, ctx.settings)), ctx);
          }
          return;
        }
        t.category = c;
        t.options = undefined;
        actions.push({ type: 'info', text: `Categoria: ${c.label}` });
        return go(ticketAfterCategory(state, node, ctx, actions));
      }
      case 'ticket:subject': {
        if (!text || hasFile) return void askTicketText(state, ctx, actions, tt(node, 'ask_subject'), 'ticket:subject', 'Aguardando o assunto do chamado');
        t.subject = SKIP_WORDS.test(n) || n === '0' ? null : text.replace(/\s+/g, ' ').slice(0, 160);
        actions.push({ type: 'info', text: t.subject ? `Assunto: ${t.subject}` : 'Sem assunto (o sistema usa a 1ª linha da descrição)' });
        return go(askTicketText(state, ctx, actions, tt(node, 'ask_description'), 'ticket:description', 'Aguardando a descrição do chamado'));
      }
      case 'ticket:description': {
        if (hasFile && media?.id && TICKET_MEDIA_KINDS.has(String(media.kind)) && d.ask_photo !== false) {
          const ids = t.media_ids || (t.media_ids = []);
          if (!ids.includes(media.id) && ids.length < MAX_TICKET_MEDIA) ids.push(media.id);
          actions.push({ type: 'info', text: `Arquivo recebido junto com a descrição (${ids.length}/${MAX_TICKET_MEDIA})` });
        }
        if (text.length >= MIN_DESC) {
          if (text.length > MAX_DESC) actions.push({ type: 'info', text: `Descrição cortada em ${MAX_DESC} caracteres` });
          t.description = text.slice(0, MAX_DESC);
          return go(ticketAfterDescription(state, node, ctx, actions));
        }
        state.retries += 1;
        actions.push({ type: 'info', text: `Descrição curta demais (${state.retries}/${maxRetries})` });
        if (state.retries >= maxRetries) return go(ticketFailed(def, state, node, ctx, actions, { error: 'descrição não informada' }));
        sendText(actions, fillVars(tt(node, 'short_description'), state, ctx), ctx);
        return;
      }
      case 'ticket:photo': {
        const ids = t.media_ids || (t.media_ids = []);
        if (hasFile) {
          if (!media?.id) {
            sendText(actions, fillVars(tt(node, 'media_failed'), state, ctx), ctx);
            actions.push({ type: 'info', text: 'Arquivo sem download (gateway não entregou)' });
            return;
          }
          if (!TICKET_MEDIA_KINDS.has(String(media.kind))) {
            state.retries += 1;
            actions.push({ type: 'info', text: `Tipo de arquivo não aceito: ${media.kind} (${state.retries}/${maxRetries})` });
            if (state.retries >= maxRetries) return go(ticketCreate(state, node, actions, ctx));
            sendText(actions, fillVars(tt(node, 'photo_invalid'), state, ctx), ctx);
            return;
          }
          if (!ids.includes(media.id)) ids.push(media.id);
          // legenda junto da foto complementa a descrição
          if (text && !TICKET_DONE.test(n)) t.description = `${String(t.description || '').trim()}\n\n${text}`.trim().slice(0, MAX_DESC);
          actions.push({ type: 'info', text: `Anexo ${ids.length}/${MAX_TICKET_MEDIA} recebido` });
          if (ids.length >= MAX_TICKET_MEDIA) return go(ticketCreate(state, node, actions, ctx));
          sendText(actions, fillVars(tt(node, 'photo_received'), state, ctx), ctx);
          state.retries = 0;
          return;
        }
        if (TICKET_SKIP.test(n) || TICKET_DONE.test(n) || SKIP_WORDS.test(n)) return go(ticketCreate(state, node, actions, ctx));
        state.retries += 1;
        actions.push({ type: 'info', text: `Esperava foto/documento ou "pronto" (${state.retries}/${maxRetries})` });
        if (state.retries >= maxRetries) return go(ticketCreate(state, node, actions, ctx)); // não perde o chamado por causa do anexo
        sendText(actions, fillVars(tt(node, 'photo_invalid'), state, ctx), ctx);
        return;
      }
      case 'ticket:custom': {
        const cf = Array.isArray(t.cf) ? t.cf : [];
        const i = Number(t.cf_i) || 0;
        const f = cf[i];
        if (!f) return go(ticketCreate(state, node, actions, ctx));
        t.custom = t.custom || {};
        const r = cfStep(f, text, t.custom, state, node, ctx, actions, maxRetries);
        if (r === 'retry') return;
        if (r === 'fail') return go(ticketFailed(def, state, node, ctx, actions, { error: `campo obrigatório “${f.label}” sem resposta válida` }));
        t.cf_i = i + 1;
        return go(ticketCreate(state, node, actions, ctx));
      }
      default:
        actions.push({ type: 'info', text: 'O bloco de chamado não esperava esta resposta.' });
        return;
    }
  }

  // ---------------- Meus chamados
  switch (wf) {
    case 'ticket:choose': {
      if (!hasFile && (BACK_RE.test(n) || CANCEL_WORDS.test(n))) {
        ticketFocus(state);
        actions.push({ type: 'info', text: 'Cliente saiu da lista de chamados' });
        return go(nextOf(def, node.id, 'out'));
      }
      const picked = matchOptionIn(t.options || [], text);
      const tk = picked ? (t.tickets || []).find((x) => x.id === picked.id) : null;
      if (tk) return go(pickTicket(def, state, node, ctx, actions, tk));
      if (looksLikeProtocol(text)) {
        const p = normalizeProtocol(text);
        const local = (t.tickets || []).find((x) => normalizeProtocol(x.protocol) === p);
        if (local) return go(pickTicket(def, state, node, ctx, actions, local));
        actions.push({ type: 'info', text: `Procurando o protocolo ${p}…` });
        return go(ticketRequest(state, { type: 'ticket_lookup', protocol: p }, 'lookup', actions, true));
      }
      state.retries += 1;
      sendText(actions, fillVars(String(d.invalid_text || ctx.settings.invalid_option_text || DEFAULT_INVALID), state, ctx), ctx);
      actions.push({ type: 'info', text: `Opção inválida (${state.retries}/${maxRetries})` });
      if (state.retries >= maxRetries) {
        if (t.options?.length) {
          state.retries = 0;
          showTicketList(state, node, ctx, actions);
          return;
        }
        ticketFocus(state);
        return go(nextOf(def, node.id, 'out'));
      }
      return;
    }
    case 'ticket:action': {
      const kc = keycapToNumber(text);
      const num = kc || (/^\d$/.test(n) ? n : null);
      if (num === '1' || (!num && ADD_INFO_RE.test(n))) {
        actions.push({ type: 'info', text: 'Cliente vai enviar mais informações' });
        return go(askTicketText(state, ctx, actions, tt(node, 'ask_info'), 'ticket:info', 'Aguardando a informação a juntar ao chamado'));
      }
      if (num === '0' || BACK_RE.test(n) || CANCEL_WORDS.test(n)) {
        if ((t.tickets || []).length > 1) {
          t.ticket = null;
          showTicketList(state, node, ctx, actions);
          return;
        }
        ticketFocus(state);
        return go(nextOf(def, node.id, 'out'));
      }
      state.retries += 1;
      sendText(actions, fillVars(String(d.invalid_text || ctx.settings.invalid_option_text || DEFAULT_INVALID), state, ctx), ctx);
      actions.push({ type: 'info', text: `Opção inválida (${state.retries}/${maxRetries})` });
      if (state.retries >= maxRetries) {
        state.retries = 0;
        sendText(actions, ticketActionText(state, node, ctx), ctx);
      }
      return;
    }
    case 'ticket:info': {
      if (!hasFile && CANCEL_WORDS.test(n)) {
        ticketFocus(state);
        return go(nextOf(def, node.id, 'out'));
      }
      if (hasFile && !media?.id) {
        sendText(actions, fillVars(tt(node, 'media_failed'), state, ctx), ctx);
        return;
      }
      const body = text.slice(0, MAX_DESC);
      if (!body && !media?.id) {
        sendText(actions, fillVars(tt(node, 'ask_info'), state, ctx), ctx);
        return;
      }
      const tk = t.ticket;
      if (!tk?.id) return go(ticketFailed(def, state, node, ctx, actions, { error: 'chamado em foco perdido' }));
      return go(ticketRequest(state, { type: 'ticket_add_info', id: tk.id, body, media_id: media?.id || null }, 'add_info', actions));
    }
    default:
      actions.push({ type: 'info', text: 'O bloco de chamados não esperava esta resposta.' });
  }
}

// =================================================================== PEDIDOS (Fase 7, contrato §11.3)
// Blocos: order_cart (fazer pedido: categoria → produtos paginados → quantidade → carrinho → entrega/retirada →
//         endereço → campos do pedido → observação? → pagamento → resumo → cria; PIX → espera a cobrança) ·
//         my_orders (meus pedidos: lista dos últimos → detalhes).
// Sub-estado em `state.order` (o runtime persiste em `vars.__order`); o runtime executa as ações `order_*` no
// WhatsAppOrdersService e devolve `crm_result {ok, catalog+order_settings+addresses | order+charge | orders, error?, user_text?}`.
//
// Lista de produtos (decisão do contrato): NUMERAÇÃO CONTÍNUA em cada página — até 9 produtos (1–9), depois
// "➡️ Mais produtos" (se houver próxima página), "⬅️ Página anterior" / "⬅️ Voltar às categorias" e "🛒 Ver carrinho"
// (se o carrinho não estiver vazio), cada um com o seu número logo abaixo dos produtos. Também valem as palavras
// "mais"/"próxima", "voltar"/"anterior", "carrinho"/"finalizar", e *0* = ver o carrinho (ou voltar, se vazio).
export const ORDER_TYPES = ['order_cart', 'my_orders'];
const ORDER_TYPE_SET = new Set(ORDER_TYPES);
export const isOrderType = (t: string | null | undefined) => ORDER_TYPE_SET.has(String(t || ''));

export const ORDER_TEXTS: Record<string, Record<string, string>> = {
  order_cart: {
    choose_category: 'O que você quer pedir? 🛍️ Escolha uma categoria:',
    choose_product: '*{{pedido.categoria}}* — escolha um produto:',
    ask_qty: 'Quantas unidades de *{{item.nome}}* ({{item.valor}} cada)? Responda de 1 a 99.',
    invalid_qty: 'Responda só com a quantidade, de 1 a 99 (ou *0* para voltar).',
    added: 'Adicionei {{item.qtd}}× *{{item.nome}}* ao carrinho ✅',
    cart: '🛒 *Seu carrinho*\n\n{{carrinho.itens}}\n\n*Subtotal:* {{carrinho.subtotal}}',
    cart_empty: 'Seu carrinho está vazio 🙂 Escolha um produto:',
    cart_cleared: 'Pronto, esvaziei o carrinho 🗑️',
    max_items: 'Seu carrinho já tem {{pedido.max_itens}} produtos diferentes (o máximo por pedido). Finalize ou esvazie o carrinho.',
    pix_min: 'O pagamento por PIX é a partir de R$ 1,00 — adicione mais alguma coisa ao carrinho 🙂',
    min_order: 'O pedido mínimo é *{{pedido.minimo}}* e o seu carrinho está em {{carrinho.subtotal}}. Adicione mais alguma coisa 🙂',
    ask_delivery: 'Como você quer receber o pedido?',
    choose_address: 'Para onde entregamos? 📍',
    ask_address: 'Digite o endereço completo da entrega (rua, número, bairro e complemento) 📍',
    invalid_address: 'Preciso do endereço completo (rua, número e bairro) para entregar 🙂',
    confirm_address: 'Entregar em: *{{pedido.endereco}}*\n\n1️⃣ Confirmar\n2️⃣ Digitar de novo',
    ask_notes: 'Quer deixar alguma observação no pedido? (ex.: sem cebola, troco para R$ 50) — ou responda *pular*.',
    ask_payment: 'Como você prefere pagar?',
    summary:
      '📋 *Resumo do pedido*\n\n{{pedido.itens}}\n\nSubtotal: {{pedido.subtotal}}\nEntrega: {{pedido.taxa}}\n*Total: {{pedido.total}}*\n\n{{pedido.entrega}}\n💳 {{pedido.pagamento}}{{pedido.campos}}',
    created_pix: 'Pedido *#{{pedido.numero}}* recebido ✅ Total: *{{pedido.total}}*.\nPara confirmar, pague pelo PIX 👇 Assim que o pagamento cair eu te aviso.',
    created_on_delivery:
      'Pedido *#{{pedido.numero}}* recebido ✅\n\n{{pedido.itens}}\n\n*Total: {{pedido.total}}*\n{{pedido.entrega}}\n💳 {{pedido.pagamento}}\n\nVou te avisando por aqui 😉',
    paid: 'Pagamento do pedido *#{{pedido.numero}}* confirmado ✅ Já vamos preparar!',
    expired: 'O PIX do pedido *#{{pedido.numero}}* não foi pago a tempo ⌛ Se ainda quiser, é só fazer o pedido de novo.',
    waiting: 'Ainda estou aguardando o pagamento do pedido *#{{pedido.numero}}* ⏳ Assim que ele cair eu te aviso. Para voltar ao início, digite *{{comando_reiniciar}}*.',
    empty_catalog: 'No momento não há produtos disponíveis para pedido 😕',
    disabled: 'No momento não estamos recebendo pedidos por aqui 😕',
    failed: 'Ops, não consegui concluir o pedido agora 😕 Tente de novo mais tarde ou fale com um atendente.',
    cancel: 'Tudo bem, cancelei o pedido. Quando quiser, é só me chamar 🙂',
    opt_more: 'Adicionar mais itens',
    opt_finish: 'Finalizar pedido',
    opt_clear: 'Esvaziar carrinho',
    opt_next_page: '➡️ Mais produtos',
    opt_prev_page: '⬅️ Página anterior',
    opt_categories: '⬅️ Voltar às categorias',
    opt_cart: '🛒 Ver carrinho',
    opt_delivery: '🛵 Entrega',
    opt_pickup: '🏪 Retirar no local',
    opt_other_address: '✏️ Digitar outro endereço',
    opt_pix: 'PIX',
    opt_on_delivery: 'Pagar na entrega',
    opt_on_pickup: 'Pagar na retirada',
    opt_confirm: 'Confirmar pedido',
    opt_edit: 'Alterar itens',
    opt_cancel: 'Cancelar',
  },
  my_orders: {
    list: 'Seus pedidos 🧾 Qual deles você quer ver?',
    none: 'Você ainda não tem pedidos por aqui 🙂',
    details:
      '🧾 Pedido *#{{pedido.numero}}* — {{pedido.data}}\n\n{{pedido.itens}}\n\n*Total: {{pedido.total}}*\n📌 Situação: *{{pedido.status}}*\n💳 {{pedido.pagamento}} — {{pedido.pagamento_status}}\n{{pedido.entrega}}{{pedido.campos}}',
    failed: 'Ops, não consegui consultar seus pedidos agora 😕 Tente de novo mais tarde ou fale com um atendente.',
  },
};
/** Texto do bloco de pedido: `data.texts[key]` (vazio = padrão do tipo). */
function ot(node: BotNode, key: string) {
  const own = String(node.data?.texts?.[key] ?? '').trim();
  return own || ORDER_TEXTS[node.type]?.[key] || '';
}

const ORDER_PAGE = 9;
const ORDER_MAX_PRODUCTS = 300; // teto do catálogo guardado no estado da conversa
const ORDER_MAX_QTY = 99;
const OPEN_ORDER_STATUS = new Set(['new', 'confirmed', 'preparing', 'out_for_delivery']);
const ORDER_STATUS_LABEL: Record<string, string> = { new: 'Recebido', confirmed: 'Confirmado', preparing: 'Em preparo', out_for_delivery: 'Saiu para entrega', delivered: 'Entregue', canceled: 'Cancelado' };
const PAYMENT_LABEL: Record<string, string> = { pix: 'PIX', on_delivery: 'Na entrega', link: 'Link de pagamento', none: 'Sem pagamento' };
const PAYMENT_STATUS_LABEL: Record<string, string> = { pending: 'Aguardando pagamento', paid: 'Pago', not_required: 'Paga na entrega' };
const ORDER_PAY_METHODS = ['pix', 'on_delivery'];

/** "Rua X, 10 · apto 2 · Centro · Cidade/UF · CEP 00000000" (igual ao `addressLine` do serviço). */
export function addressLineOf(a: any): string {
  if (!a || typeof a !== 'object') return typeof a === 'string' ? a : '';
  return [[a.street, a.number].filter(Boolean).join(', '), a.complement, a.district, [a.city, a.state].filter(Boolean).join('/'), a.zip ? `CEP ${a.zip}` : '']
    .filter(Boolean)
    .join(' · ');
}
const addressOption = (a: BotAddress) => `${addressLineOf(a)}${a.label ? ` (${a.label})` : ''}`;

function cartTotals(o: BotOrderFlow | null | undefined) {
  const cart = o?.cart || [];
  const subtotal = cart.reduce((acc, i) => acc + Math.max(0, Number(i.qty) || 0) * Math.max(0, Number(i.unit_cents) || 0), 0);
  const s = o?.settings || {};
  const dEnabled = s.delivery?.enabled !== false;
  const free = Number(s.delivery?.free_from_cents) || 0;
  const fee = o?.delivery === 'delivery' && dEnabled ? (free > 0 && subtotal >= free ? 0 : Math.max(0, Number(s.delivery?.fee_cents) || 0)) : 0;
  return { subtotal, fee, total: subtotal + fee };
}
const cartLines = (cart: BotCartItem[] | undefined) =>
  (cart || []).map((i) => `${i.qty}× ${i.name} — ${formatBRL(i.qty * i.unit_cents)}`).join('\n');
const deliveryTextOf = (mode: string | null | undefined, address: any, s: BotOrderSettings | null | undefined) =>
  mode === 'delivery'
    ? `🛵 Entrega${addressLineOf(address) ? `: ${addressLineOf(address)}` : ''}`
    : `🏪 Retirada no local${s?.pickup?.address ? `: ${s.pickup.address}` : ''}`;
const orderStatusLabel = (o: BotOrder | null | undefined) => (o ? o.status_label || ORDER_STATUS_LABEL[String(o.status)] || String(o.status || '') : '');
const orderNumber = (o: BotOrder) => String(o.number ?? '').replace(/^#/, '');
const orderLabel = (o: BotOrder) =>
  [`#${orderNumber(o)}`, orderStatusLabel(o), o.total_label || (o.total_cents != null ? formatBRL(Number(o.total_cents)) : ''), o.created_at ? fmtDateBR(o.created_at).slice(0, 5) : '']
    .filter(Boolean)
    .join(' · ');

/** Pedidos em andamento do contexto + o em foco nesta conversa (o criado agora conta). */
function activeOrders(state: BotState, ctx: BotContext): BotOrder[] {
  const out: BotOrder[] = [];
  const seen = new Set<string>();
  for (const o of [state.order?.order || null, ...(Array.isArray(ctx.orders) ? ctx.orders : [])]) {
    if (!o?.id || seen.has(o.id)) continue;
    seen.add(o.id);
    if (OPEN_ORDER_STATUS.has(String(o.status))) out.push(o);
  }
  return out;
}

/**
 * {{pedido.*}} / {{carrinho.*}} / {{item.*}} / {{pedidos.lista}}. Pedido criado/escolhido (ou o mais recente em
 * andamento) › carrinho em montagem (estimativa com os preços do catálogo — o servidor recalcula ao criar).
 */
export function orderVars(state: BotState, ctx: BotContext): Record<string, string> {
  const o = state.order;
  const active = activeOrders(state, ctx);
  const made = o?.order || (o?.mode === 'cart' && (o.cart || []).length ? null : active[0] || null);
  const t = cartTotals(o);
  const out: Record<string, string> = {};
  const defs = ctx.custom_fields?.order || [];
  out['carrinho.itens'] = cartLines(o?.cart);
  out['carrinho.subtotal'] = formatBRL(t.subtotal);
  out['carrinho.qtd'] = String((o?.cart || []).reduce((a, i) => a + (Number(i.qty) || 0), 0));
  out['item.nome'] = String(o?.product?.name || '');
  out['item.valor'] = o?.product ? o.product.price_label || formatBRL(o.product.price_cents) : '';
  out['item.descricao'] = String(o?.product?.description || '');
  out['item.qtd'] = o?.qty ? String(o.qty) : '';
  out['pedido.categoria'] = String(o?.category || '');
  out['pedido.minimo'] = formatBRL(Number(o?.settings?.min_order_cents) || 0);
  out['pedido.max_itens'] = String(Number(o?.settings?.max_items) || 30);
  out['pedido.endereco'] = addressLineOf(o?.address);
  if (made) {
    out['pedido.numero'] = orderNumber(made);
    out['pedido.itens'] = String(made.items_text || '');
    out['pedido.subtotal'] = made.subtotal_cents != null ? formatBRL(Number(made.subtotal_cents)) : '';
    out['pedido.taxa'] = made.delivery_fee_cents ? formatBRL(Number(made.delivery_fee_cents)) : 'grátis';
    out['pedido.total'] = made.total_label || formatBRL(Number(made.total_cents) || 0);
    out['pedido.status'] = orderStatusLabel(made);
    out['pedido.entrega'] = String(made.delivery_text || '');
    out['pedido.pagamento'] = `${made.payment_method_label || (String(made.payment_method) === 'on_delivery' && ((made as any).delivery === 'pickup' || (made as any).delivery?.mode === 'pickup') ? 'Na retirada' : PAYMENT_LABEL[String(made.payment_method)]) || String(made.payment_method || '')}${made.payment_status === 'paid' ? ' (pago)' : ''}`;
    out['pedido.pagamento_status'] = made.payment_status_label || PAYMENT_STATUS_LABEL[String(made.payment_status)] || String(made.payment_status || '');
    out['pedido.data'] = made.created_at ? fmtDateBR(made.created_at) : '';
    out['pedido.campos'] = fieldLines(made.fields) || cfLines(defs, (made.custom as any) || {});
    for (const f of defs) out[`pedido.custom.${f.key}`] = cfDisplay(f, (made.custom as any)?.[f.key]);
    for (const f of Array.isArray(made.fields) ? made.fields : []) if (f?.key) out[`pedido.custom.${String(f.key).toLowerCase()}`] = String(f.display ?? '');
  } else {
    out['pedido.numero'] = '';
    out['pedido.itens'] = cartLines(o?.cart);
    out['pedido.subtotal'] = formatBRL(t.subtotal);
    out['pedido.taxa'] = t.fee ? formatBRL(t.fee) : 'grátis';
    out['pedido.total'] = formatBRL(t.total);
    out['pedido.status'] = '';
    out['pedido.entrega'] = o?.delivery ? deliveryTextOf(o.delivery, o.address, o.settings) : '';
    const pm = String(o?.payment || '');
    out['pedido.pagamento'] = pm === 'on_delivery' && o?.delivery === 'pickup' ? 'Na retirada' : PAYMENT_LABEL[pm] || '';
    out['pedido.pagamento_status'] = '';
    out['pedido.data'] = '';
    // no resumo: os campos respondidos agora (todos os perguntados — o cliente está conferindo o que digitou)
    const cfs = Array.isArray(o?.cf) ? o!.cf : [];
    out['pedido.campos'] = cfs
      .map((f) => ({ f, v: cfDisplay(f, o?.custom?.[f.key]) }))
      .filter((x) => x.v)
      .map((x) => `\n*${x.f.label}:* ${x.v}`)
      .join('');
    for (const f of defs) out[`pedido.custom.${f.key}`] = cfDisplay(f, o?.custom?.[f.key]);
  }
  out['pedidos.lista'] = active.length ? active.map((x) => `• ${orderLabel(x)}`).join('\n') : 'Nenhum pedido em andamento.';
  return out;
}

/** Condição `source:'order'`: `has_open_order` (tem pedido em andamento) · `awaiting_payment` (algum aguardando o PIX). */
function evalOrderRule(rule: any, state: BotState, ctx: BotContext) {
  const key = String(rule?.key || 'has_open_order');
  const val = String(rule?.value ?? '');
  const list = activeOrders(state, ctx);
  const cur = key === 'awaiting_payment' ? list.some((o) => o.payment_status === 'pending' && o.payment_method === 'pix') : list.length > 0;
  return String(cur) === (val || 'true');
}

// --- mecânica
function orderRequest(state: BotState, action: BotAction, step: string, actions: BotAction[]): 'stop' {
  const o = state.order!;
  o.step = step;
  o.options = undefined;
  actions.push(action);
  state.status = 'waiting';
  state.waiting_for = 'order:wait';
  state.retries = 0;
  return 'stop';
}

/** Saiu do bloco: guarda só o pedido (os blocos seguintes leem {{pedido.*}}). */
function orderFocus(state: BotState) {
  const o = state.order;
  state.order = o ? { mode: o.mode, step: 'done', order: o.order || null } : null;
}

function orderGo(def: BotDefinition, state: BotState, ctx: BotContext, actions: BotAction[], next: string | null | 'stop') {
  if (next === 'stop') return;
  state.status = 'active';
  state.waiting_for = null;
  state.retries = 0;
  walk(def, state, next, ctx, actions);
}

/** Falha: recusa amigável do runtime (`user_text`) é SEMPRE dita; senão `failed` (texto só se a porta não estiver ligada). */
function orderFailed(def: BotDefinition, state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[], payload?: BotEventPayload | null): string | null {
  if (payload?.error) actions.push({ type: 'info', text: `Erro do pedido: ${payload.error}` });
  orderFocus(state);
  const ut = String(payload?.user_text || '').trim();
  if (ut) return sayAndGo(def, node, 'failed', ut, state, ctx, actions);
  return exitPort(def, node, 'failed', ot(node, 'failed') || CRM_TEXTS.failed, state, ctx, actions);
}

/** Lista numerada + espera (opções guardadas em `state.order.options`). */
function askOrder(state: BotState, ctx: BotContext, actions: BotAction[], node: BotNode, head: string, options: BotBookOption[], wf: BotWaitingFor, info: string, tail = '') {
  const o = state.order!;
  o.options = options;
  const body = numberedList(fillVars(head, state, ctx), options.map((x) => x.label), numberingOf(node, ctx.settings));
  sendText(actions, [body, tail].filter((x) => String(x).trim()).join('\n\n'), ctx);
  waitInput(state, wf, actions, info);
}

const catOf = (o: BotOrderFlow) => (o.categories || []).find((c) => c.name === o.category) || (o.categories || [])[0] || null;

/** Catálogo: 1 categoria → direto nos produtos; mais → menu de categorias (+ "Ver carrinho" se houver itens). */
function showCatalog(state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[]): 'stop' {
  const o = state.order!;
  const cats = o.categories || [];
  if (cats.length === 1) {
    o.category = cats[0].name;
    return showProducts(state, node, ctx, actions, Number(o.page) || 0);
  }
  o.step = 'category';
  const opts: BotBookOption[] = cats.map((c) => ({ id: `cat:${c.name}`, label: `${c.name} (${c.products.length})`, keywords: [c.name] }));
  if ((o.cart || []).length) opts.push({ id: '__cart', label: ot(node, 'opt_cart'), keywords: ['carrinho', 'finalizar'] });
  askOrder(state, ctx, actions, node, ot(node, 'choose_category'), opts, 'order:category', 'Aguardando o cliente escolher a categoria');
  return 'stop';
}

/** Produtos da categoria, 9 por página, numeração contínua com a navegação logo abaixo. */
function showProducts(state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[], page: number): 'stop' {
  const o = state.order!;
  const cat = catOf(o);
  if (!cat) return showCatalog(state, node, ctx, actions);
  o.category = cat.name;
  o.step = 'product';
  const pages = Math.max(1, Math.ceil(cat.products.length / ORDER_PAGE));
  const p = Math.max(0, Math.min(pages - 1, Number(page) || 0));
  o.page = p;
  const slice = cat.products.slice(p * ORDER_PAGE, (p + 1) * ORDER_PAGE);
  const opts: BotBookOption[] = slice.map((x) => ({ id: `p:${x.id}`, label: `${x.name} · ${x.price_label || formatBRL(x.price_cents)}`, keywords: [x.name] }));
  if (p < pages - 1) opts.push({ id: '__next', label: ot(node, 'opt_next_page'), keywords: ['mais', 'proxima', 'mais produtos', 'seguinte'] });
  if (p > 0) opts.push({ id: '__prev', label: ot(node, 'opt_prev_page'), keywords: ['voltar', 'anterior'] });
  else if ((o.categories || []).length > 1) opts.push({ id: '__cats', label: ot(node, 'opt_categories'), keywords: ['voltar', 'categorias'] });
  if ((o.cart || []).length) opts.push({ id: '__cart', label: ot(node, 'opt_cart'), keywords: ['carrinho', 'finalizar'] });
  const head = `${ot(node, 'choose_product')}${pages > 1 ? ` _(página ${p + 1} de ${pages})_` : ''}`;
  askOrder(state, ctx, actions, node, head, opts, 'order:product', `Aguardando o cliente escolher o produto (${cat.name}, página ${p + 1}/${pages})`);
  return 'stop';
}

function askQty(state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[]): 'stop' {
  const o = state.order!;
  o.step = 'qty';
  o.options = undefined;
  sendText(actions, fillVars(ot(node, 'ask_qty'), state, ctx), ctx);
  waitInput(state, 'order:qty', actions, `Aguardando a quantidade de “${o.product?.name || ''}”`);
  return 'stop';
}

/** Carrinho: itens + subtotal + "1 Adicionar mais · 2 Finalizar · 3 Esvaziar". Vazio → volta ao catálogo. */
function showCart(state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[]): 'stop' {
  const o = state.order!;
  if (!(o.cart || []).length) {
    sendText(actions, fillVars(ot(node, 'cart_empty'), state, ctx), ctx);
    return showCatalog(state, node, ctx, actions);
  }
  o.step = 'cart';
  const opts: BotBookOption[] = [
    { id: 'more', label: ot(node, 'opt_more'), keywords: ['adicionar', 'mais', 'continuar'] },
    { id: 'finish', label: ot(node, 'opt_finish'), keywords: ['finalizar', 'fechar', 'concluir', 'pronto'] },
    { id: 'clear', label: ot(node, 'opt_clear'), keywords: ['esvaziar', 'limpar', 'zerar'] },
  ];
  askOrder(state, ctx, actions, node, ot(node, 'cart'), opts, 'order:cart', 'Aguardando: adicionar mais, finalizar ou esvaziar');
  return 'stop';
}

function addToCart(state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[], qty: number): 'stop' {
  const o = state.order!;
  const p = o.product!;
  const cart = o.cart || (o.cart = []);
  const cur = cart.find((i) => i.product_id === p.id);
  const maxLines = Math.max(1, Number(o.settings?.max_items) || 30);
  if (!cur && cart.length >= maxLines) {
    actions.push({ type: 'info', text: `Carrinho no limite de ${maxLines} produtos diferentes` });
    sendText(actions, fillVars(ot(node, 'max_items'), state, ctx), ctx);
    o.product = null;
    return showCart(state, node, ctx, actions);
  }
  if (cur) cur.qty = Math.min(ORDER_MAX_QTY, cur.qty + qty);
  else cart.push({ product_id: p.id, name: p.name, qty, unit_cents: Math.max(0, Number(p.price_cents) || 0) });
  o.qty = qty;
  actions.push({ type: 'info', text: `Carrinho: +${qty}× ${p.name}` });
  sendText(actions, fillVars(ot(node, 'added'), state, ctx), ctx);
  o.product = null;
  return showCart(state, node, ctx, actions);
}

/** Finalizar: confere o pedido mínimo e o limite de itens → forma de receber. */
function finishCart(state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[]): 'stop' {
  const o = state.order!;
  const t = cartTotals(o);
  const min = Math.max(0, Number(o.settings?.min_order_cents) || 0);
  if (min && t.subtotal < min) {
    actions.push({ type: 'info', text: `Abaixo do pedido mínimo (${formatBRL(t.subtotal)} < ${formatBRL(min)})` });
    sendText(actions, fillVars(ot(node, 'min_order'), state, ctx), ctx);
    return showCart(state, node, ctx, actions);
  }
  const maxLines = Math.max(1, Number(o.settings?.max_items) || 30);
  if ((o.cart || []).length > maxLines) {
    sendText(actions, fillVars(ot(node, 'max_items'), state, ctx), ctx);
    return showCart(state, node, ctx, actions);
  }
  // só PIX aceito e o carrinho abaixo de R$ 1,00 (o gateway não cobra menos) → pede para completar
  const pms = o.pms || [];
  if (pms.length && pms.every((m) => m === 'pix') && t.subtotal > 0 && t.subtotal < 100) {
    actions.push({ type: 'info', text: 'PIX só a partir de R$ 1,00' });
    sendText(actions, fillVars(ot(node, 'pix_min'), state, ctx), ctx);
    return showCart(state, node, ctx, actions);
  }
  return chooseDelivery(state, node, ctx, actions);
}

function chooseDelivery(state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[]): 'stop' {
  const o = state.order!;
  const modes = o.modes || [];
  if (modes.length === 1) {
    o.delivery = modes[0];
    actions.push({ type: 'info', text: modes[0] === 'delivery' ? 'Só entrega disponível' : 'Só retirada disponível' });
    return afterDelivery(state, node, ctx, actions);
  }
  o.step = 'delivery';
  const s = o.settings || {};
  const fee = Math.max(0, Number(s.delivery?.fee_cents) || 0);
  const free = Math.max(0, Number(s.delivery?.free_from_cents) || 0);
  const t = cartTotals({ ...o, delivery: 'delivery' });
  const feeTxt = t.fee > 0 ? ` (taxa ${formatBRL(fee)}${free ? `, grátis acima de ${formatBRL(free)}` : ''})` : ' (grátis)';
  const opts: BotBookOption[] = [
    { id: 'delivery', label: `${ot(node, 'opt_delivery')}${feeTxt}`, keywords: ['entrega', 'entregar', 'delivery'] },
    { id: 'pickup', label: `${ot(node, 'opt_pickup')}${s.pickup?.address ? `: ${s.pickup.address}` : ''}`, keywords: ['retirar', 'retirada', 'buscar', 'pegar'] },
  ];
  askOrder(state, ctx, actions, node, ot(node, 'ask_delivery'), opts, 'order:delivery', 'Aguardando: entrega ou retirada');
  return 'stop';
}

function afterDelivery(state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[]): 'stop' {
  const o = state.order!;
  if (o.delivery !== 'delivery') {
    o.address = null;
    o.address_id = null;
    return askNextCustom(state, node, ctx, actions);
  }
  return askAddress(state, node, ctx, actions);
}

/** Endereço: os salvos do cliente (entrega/serviço/outro) numerados + "Digitar outro"; sem salvos → pede para digitar. */
function askAddress(state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[], forceType = false): 'stop' {
  const o = state.order!;
  o.step = 'address';
  const saved = (o.addresses || []).filter((a) => a && a.id && addressLineOf(a));
  if (saved.length && !forceType) {
    const opts: BotBookOption[] = saved.map((a) => ({ id: `a:${a.id}`, label: addressOption(a) }));
    opts.push({ id: '__type', label: ot(node, 'opt_other_address'), keywords: ['outro', 'digitar', 'novo'] });
    askOrder(state, ctx, actions, node, ot(node, 'choose_address'), opts, 'order:address', 'Aguardando a escolha do endereço');
    return 'stop';
  }
  o.options = undefined;
  sendText(actions, fillVars(ot(node, 'ask_address'), state, ctx), ctx);
  waitInput(state, 'order:address_text', actions, 'Aguardando o endereço de entrega');
  return 'stop';
}

/** Campos personalizados do pedido (ask_in_bot/obrigatórios), um por vez. */
function askNextCustom(state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[]): 'stop' {
  const o = state.order!;
  const cf = Array.isArray(o.cf) ? o.cf : [];
  const i = Number(o.cf_i) || 0;
  if (i < cf.length) {
    o.step = 'custom';
    o.options = undefined;
    sendText(actions, cfQuestion(cf[i], node, ctx), ctx);
    waitInput(state, 'order:custom', actions, `Aguardando: ${cf[i].label}`);
    return 'stop';
  }
  if (node.data?.ask_notes === true && o.notes == null) {
    o.step = 'notes';
    o.options = undefined;
    sendText(actions, fillVars(ot(node, 'ask_notes'), state, ctx), ctx);
    waitInput(state, 'order:notes', actions, 'Aguardando a observação do pedido (ou "pular")');
    return 'stop';
  }
  return choosePayment(state, node, ctx, actions);
}

/** Pagamento: só os aceitos (configuração ∩ bloco); PIX só a partir de R$ 1,00; total zero = sem pagamento. */
function choosePayment(state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[]): 'stop' {
  const o = state.order!;
  const t = cartTotals(o);
  if (t.total <= 0) {
    o.payment = 'none';
    return showSummary(state, node, ctx, actions);
  }
  const pms = (o.pms || []).filter((m) => m !== 'pix' || t.total >= 100);
  if (!pms.length) {
    actions.push({ type: 'info', text: 'Nenhuma forma de pagamento disponível para este pedido (PIX só a partir de R$ 1,00)' });
    sendText(actions, fillVars(ot(node, 'failed'), state, ctx), ctx);
    orderFocus(state);
    state.status = 'done';
    state.waiting_for = null;
    actions.push({ type: 'finish' });
    return 'stop';
  }
  if (pms.length === 1) {
    o.payment = pms[0];
    return showSummary(state, node, ctx, actions);
  }
  o.step = 'payment';
  const opts: BotBookOption[] = pms.map((m) =>
    m === 'pix'
      ? { id: 'pix', label: ot(node, 'opt_pix'), keywords: ['pix'] }
      : { id: 'on_delivery', label: ot(node, o.delivery === 'pickup' ? 'opt_on_pickup' : 'opt_on_delivery'), keywords: ['entrega', 'retirada', 'dinheiro', 'cartao', 'maquininha', 'na hora'] },
  );
  askOrder(state, ctx, actions, node, ot(node, 'ask_payment'), opts, 'order:payment', 'Aguardando a forma de pagamento');
  return 'stop';
}

function showSummary(state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[]): 'stop' {
  const o = state.order!;
  o.step = 'confirm';
  const opts: BotBookOption[] = [
    { id: 'confirm', label: ot(node, 'opt_confirm'), keywords: ['sim', 'confirmar', 'confirmo', 'ok', 'pode', 'fechar'] },
    { id: 'edit', label: ot(node, 'opt_edit'), keywords: ['alterar', 'mudar', 'editar', 'trocar', 'carrinho'] },
    { id: 'cancel', label: ot(node, 'opt_cancel'), keywords: ['cancelar', 'desistir'] },
  ];
  askOrder(state, ctx, actions, node, ot(node, 'summary'), opts, 'order:confirm', 'Aguardando a confirmação do pedido');
  return 'stop';
}

function orderCreate(state: BotState, node: BotNode, actions: BotAction[]): 'stop' {
  const o = state.order!;
  const mode = o.delivery === 'delivery' ? 'delivery' : 'pickup';
  return orderRequest(
    state,
    {
      type: 'order_create',
      node_id: node.id,
      items: (o.cart || []).map((i) => ({ product_id: i.product_id, qty: i.qty })),
      delivery: { mode, ...(mode === 'delivery' ? { address_id: o.address_id || null, address: o.address || null } : {}) },
      payment_method: String(o.payment || 'none'),
      notes: o.notes ? String(o.notes).slice(0, 500) : null,
      custom: { ...(o.custom || {}) },
    },
    'create',
    actions,
  );
}

/** Configuração da loja ∩ bloco → formas de receber / pagar oferecidas. */
function orderOffer(d: any, s: BotOrderSettings) {
  const modes: ('delivery' | 'pickup')[] = [];
  if (s.delivery?.enabled !== false && d.allow_delivery !== false) modes.push('delivery');
  if (s.pickup?.enabled !== false && d.allow_pickup !== false) modes.push('pickup');
  const accepted = (Array.isArray(s.payment_methods) ? s.payment_methods : ['pix', 'on_delivery']).map(String).filter((m) => ORDER_PAY_METHODS.includes(m));
  const want = String(d.payment || 'ask');
  const pms = want === 'pix' || want === 'on_delivery' ? accepted.filter((m) => m === want) : accepted;
  return { modes, pms };
}

/** Catálogo do runtime → categorias do bloco (todas ou as escolhidas), produtos limpos e limitados. */
function orderCategories(d: any, raw: any): BotCatalogCategory[] {
  const wanted = Array.isArray(d.categories) ? d.categories.map((x: any) => norm(x)).filter(Boolean) : null;
  let budget = ORDER_MAX_PRODUCTS;
  const out: BotCatalogCategory[] = [];
  for (const c of Array.isArray(raw?.categories) ? raw.categories : []) {
    const name = String(c?.name || '').trim();
    if (!name || (wanted && wanted.length && !wanted.includes(norm(name)))) continue;
    const products: BotCatalogProduct[] = [];
    for (const p of Array.isArray(c.products) ? c.products : []) {
      if (!p?.id || !p.name || budget <= 0) continue;
      budget -= 1;
      products.push({
        id: String(p.id),
        name: String(p.name).slice(0, 80),
        description: p.description ? String(p.description).slice(0, 160) : null,
        price_cents: Math.max(0, Math.round(Number(p.price_cents) || 0)),
        price_label: String(p.price_label || formatBRL(Number(p.price_cents) || 0)),
      });
    }
    if (products.length) out.push({ name, products });
  }
  return out;
}

// ------------------------------------------------------------------ entrada nos blocos de pedido (chamada pelo walk)
function orderEnter(def: BotDefinition, state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[]): string | null | 'stop' {
  const d = node.data || {};
  if (node.type === 'order_cart') {
    const cf = askFieldsOf(ctx, 'order');
    state.order = { mode: 'cart', step: 'catalog', cart: [], order: null, ...(cf.length ? { cf, cf_i: 0, custom: {} } : { custom: {} }) };
    return orderRequest(state, { type: 'order_catalog', node_id: node.id }, 'catalog', actions);
  }
  state.order = { mode: 'mine', step: 'list', order: null };
  return orderRequest(state, { type: 'order_list', show: d.show === 'all' ? 'all' : 'open', limit: 5 }, 'list', actions);
}

/** Detalhes do pedido em foco (Meus pedidos) → sai por `out`. */
function showOrderDetails(def: BotDefinition, state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[], ord: BotOrder): string | null {
  const o = state.order!;
  o.order = ord;
  actions.push({ type: 'info', text: `Pedido: #${orderNumber(ord)}` });
  sendText(actions, fillVars(ot(node, 'details'), state, ctx), ctx);
  orderFocus(state);
  return nextOf(def, node.id, 'out');
}

// ------------------------------------------------------------------ resultado do runtime (`crm_result` de uma ação order_*)
function orderResult(def: BotDefinition, state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[], payload: BotEventPayload) {
  const d = node.data || {};
  const o = state.order || (state.order = { mode: node.type === 'my_orders' ? 'mine' : 'cart', step: '' });
  const ok = Boolean(payload?.ok);
  const go = (next: string | null | 'stop') => orderGo(def, state, ctx, actions, next);
  const fail = () => go(orderFailed(def, state, node, ctx, actions, payload));
  if (payload?.customer) setCustomer(state, ctx, payload.customer);

  switch (o.step) {
    case 'catalog': {
      if (!ok) return fail();
      const s: BotOrderSettings = payload.order_settings && typeof payload.order_settings === 'object' ? payload.order_settings : {};
      if (s.enabled === false) {
        actions.push({ type: 'info', text: 'Pedidos desligados nas configurações' });
        orderFocus(state);
        return go(sayAndGo(def, node, 'failed', ot(node, 'disabled'), state, ctx, actions));
      }
      const cats = orderCategories(d, payload.catalog);
      if (!cats.length) {
        actions.push({ type: 'info', text: 'Catálogo vazio (nenhum produto avulso ativo nas categorias do bloco)' });
        orderFocus(state);
        return go(sayAndGo(def, node, 'failed', ot(node, 'empty_catalog'), state, ctx, actions));
      }
      const offer = orderOffer(d, s);
      if (!offer.modes.length) return go(orderFailed(def, state, node, ctx, actions, { error: 'nenhuma forma de receber (entrega/retirada) disponível para este bloco' }));
      if (!offer.pms.length) return go(orderFailed(def, state, node, ctx, actions, { error: 'nenhuma forma de pagamento aceita para este bloco' }));
      o.settings = s;
      o.categories = cats;
      o.modes = offer.modes;
      o.pms = offer.pms;
      o.addresses = (Array.isArray(payload.addresses) ? payload.addresses : [])
        .filter((a) => a && a.id && String(a.kind || 'other') !== 'billing' && addressLineOf(a))
        .slice(0, 8);
      o.page = 0;
      showCatalog(state, node, ctx, actions);
      return;
    }
    case 'create': {
      if (!ok || !payload.order?.id) return fail();
      o.order = payload.order;
      state.vars.pedido_numero = orderNumber(payload.order);
      actions.push({ type: 'set_var', name: 'pedido_numero', value: state.vars.pedido_numero });
      const charge = payload.charge && payload.charge.id ? payload.charge : null;
      if (charge) {
        state.charge = { ...charge };
        sendText(actions, fillVars(ot(node, 'created_pix'), state, ctx), ctx);
        // o runtime normalmente já mandou a cobrança (QR + código); se não conseguiu, o motor manda o código
        if (charge.sent !== true) {
          if (charge.pix_code) sendText(actions, String(charge.pix_code), ctx);
          else if (charge.pay_link) sendText(actions, String(charge.pay_link), ctx);
        }
        o.step = 'charge';
        o.options = undefined;
        state.status = 'waiting';
        state.waiting_for = 'charge';
        state.retries = 0;
        actions.push({ type: 'info', text: `Pedido #${orderNumber(payload.order)} criado — aguardando o PIX de ${formatBRL(charge.amount_cents)}` });
        return;
      }
      actions.push({ type: 'info', text: `Pedido #${orderNumber(payload.order)} criado (${payload.order.payment_method || 'sem pagamento'})` });
      orderFocus(state);
      return go(sayAndGo(def, node, 'out', ot(node, 'created_on_delivery'), state, ctx, actions));
    }
    case 'list': {
      if (!ok) return fail();
      const show = d.show === 'all' ? 'all' : 'open';
      const list = (payload.orders || []).filter((x) => x && x.id && (show === 'all' || OPEN_ORDER_STATUS.has(String(x.status)))).slice(0, 5);
      o.orders = list;
      if (!list.length) {
        orderFocus(state);
        return go(sayAndGo(def, node, 'none', ot(node, 'none'), state, ctx, actions));
      }
      if (list.length === 1) return go(showOrderDetails(def, state, node, ctx, actions, list[0]));
      askOrder(state, ctx, actions, node, ot(node, 'list'), list.map((x) => ({ id: x.id, label: orderLabel(x), keywords: [`#${orderNumber(x)}`, orderNumber(x)] })), 'order:choose', 'Aguardando o cliente escolher o pedido');
      return;
    }
    default:
      actions.push({ type: 'info', text: 'Resultado do pedido recebido fora de hora — ignorado.' });
  }
}

/** Cobrança do pedido paga/expirada (bloco Fazer pedido esperando `charge`). */
function orderChargeEvent(def: BotDefinition, state: BotState, node: BotNode, ctx: BotContext, actions: BotAction[], paid: boolean, payload?: BotEventPayload | null) {
  if (!state.order) state.order = { mode: 'cart', step: 'charge' };
  if (payload?.order) state.order.order = payload.order;
  if (payload?.customer) setCustomer(state, ctx, payload.customer);
  const cur = state.order.order;
  if (paid && cur) state.order.order = { ...cur, payment_status: 'paid', payment_status_label: PAYMENT_STATUS_LABEL.paid };
  if (!paid && cur?.status === 'canceled') {
    // a loja cancelou o pedido (o aviso de cancelamento sai pelo serviço de pedidos) — o bot não repete nada
    actions.push({ type: 'info', text: `Pedido #${orderNumber(cur)} cancelado pela loja — seguindo por “expirou” sem mensagem` });
  } else sendText(actions, fillVars(ot(node, paid ? 'paid' : 'expired'), state, ctx), ctx);
  state.charge = null;
  orderFocus(state);
  state.status = 'active';
  state.waiting_for = null;
  state.retries = 0;
  walk(def, state, nextOf(def, node.id, paid ? 'paid' : 'expired'), ctx, actions);
}

// ------------------------------------------------------------------ entrada do cliente num bloco de pedido
function orderInput(def: BotDefinition, state: BotState, node: BotNode, input: string, ctx: BotContext, actions: BotAction[]) {
  const d = node.data || {};
  const o = state.order || (state.order = { mode: node.type === 'my_orders' ? 'mine' : 'cart', step: '', cart: [] });
  const wf = state.waiting_for;
  const maxRetries = maxRetriesOf(d, ctx);
  const text = String(input || '').trim();
  const n = norm(text);
  const go = (next: string | null | 'stop') => orderGo(def, state, ctx, actions, next);
  const invalid = (relist: () => void) => {
    state.retries += 1;
    sendText(actions, fillVars(String(d.invalid_text || ctx.settings.invalid_option_text || DEFAULT_INVALID), state, ctx), ctx);
    actions.push({ type: 'info', text: `Opção inválida (${state.retries}/${maxRetries})` });
    if (state.retries >= maxRetries) {
      state.retries = 0;
      relist();
    }
  };

  if (wf === 'order:wait') {
    actions.push({ type: 'info', text: 'Aguardando o sistema concluir a ação do pedido' });
    return;
  }

  // ---------------- Meus pedidos (só leitura)
  if (node.type === 'my_orders') {
    if (wf !== 'order:choose') {
      actions.push({ type: 'info', text: 'O bloco de pedidos não esperava esta resposta.' });
      return;
    }
    if (/^(0|voltar|volta|sair|nada|obrigado|obrigada)$/.test(n) || CANCEL_WORDS.test(n)) {
      orderFocus(state);
      actions.push({ type: 'info', text: 'Cliente saiu da lista de pedidos' });
      return go(nextOf(def, node.id, 'out'));
    }
    const picked = matchOptionIn(o.options || [], text.replace(/^#/, ''));
    const ord = picked ? (o.orders || []).find((x) => x.id === picked.id) : null;
    if (ord) return go(showOrderDetails(def, state, node, ctx, actions, ord));
    invalid(() => askOrder(state, ctx, actions, node, ot(node, 'list'), o.options || [], 'order:choose', 'Aguardando o cliente escolher o pedido'));
    return;
  }

  // ---------------- Fazer pedido: esperando o PIX
  if (wf === 'charge') {
    if (/\b(paguei|pago|ja paguei|pix feito|feito|comprovante|transferi)\b/.test(n) && state.charge) actions.push({ type: 'charge_check', charge_id: state.charge.id });
    else {
      sendText(actions, fillVars(ot(node, 'waiting'), state, ctx, { comando_reiniciar: restartWordOf(ctx.settings) }), ctx);
      actions.push({ type: 'info', text: 'Aguardando a confirmação do pagamento do pedido (cliente avisado)' });
    }
    return;
  }

  // "cancelar/desistir" em qualquer pergunta do pedido → porta `canceled` (texto só se a porta não estiver ligada)
  if (CANCEL_WORDS.test(n)) {
    orderFocus(state);
    actions.push({ type: 'info', text: 'Cliente desistiu do pedido' });
    return go(exitPort(def, node, 'canceled', ot(node, 'cancel'), state, ctx, actions));
  }

  switch (wf) {
    case 'order:category': {
      if (n === '0' && (o.cart || []).length) return void showCart(state, node, ctx, actions);
      const picked = matchOptionIn(o.options || [], text);
      if (!picked) return invalid(() => showCatalog(state, node, ctx, actions));
      if (picked.id === '__cart') return void showCart(state, node, ctx, actions);
      o.category = picked.id.slice(4);
      o.page = 0;
      actions.push({ type: 'info', text: `Categoria: ${o.category}` });
      return void showProducts(state, node, ctx, actions, 0);
    }
    case 'order:product': {
      const page = Number(o.page) || 0;
      if (n === '0') {
        if ((o.cart || []).length) return void showCart(state, node, ctx, actions);
        if ((o.categories || []).length > 1) return void showCatalog(state, node, ctx, actions);
        return invalid(() => showProducts(state, node, ctx, actions, page));
      }
      const picked = matchOptionIn(o.options || [], text);
      if (!picked) return invalid(() => showProducts(state, node, ctx, actions, page));
      if (picked.id === '__next') return void showProducts(state, node, ctx, actions, page + 1);
      if (picked.id === '__prev') return void showProducts(state, node, ctx, actions, page - 1);
      if (picked.id === '__cats') {
        o.page = 0;
        return void showCatalog(state, node, ctx, actions);
      }
      if (picked.id === '__cart') return void showCart(state, node, ctx, actions);
      const p = (catOf(o)?.products || []).find((x) => `p:${x.id}` === picked.id) || null;
      if (!p) return invalid(() => showProducts(state, node, ctx, actions, page));
      o.product = p;
      actions.push({ type: 'info', text: `Produto: ${p.name}` });
      return void askQty(state, node, ctx, actions);
    }
    case 'order:qty': {
      if (/^(0|voltar|volta)$/.test(n)) {
        o.product = null;
        return void showProducts(state, node, ctx, actions, Number(o.page) || 0);
      }
      const kc = keycapToNumber(text);
      const lead = kc || /^(\d{1,3})(?!\d)/.exec(text)?.[1] || '';
      const qty = lead ? Number(lead) : NaN;
      if (!Number.isFinite(qty) || qty < 1 || qty > ORDER_MAX_QTY) {
        state.retries += 1;
        actions.push({ type: 'info', text: `Quantidade inválida (${state.retries}/${maxRetries})` });
        if (state.retries >= maxRetries) {
          o.product = null;
          return void showProducts(state, node, ctx, actions, Number(o.page) || 0);
        }
        sendText(actions, fillVars(ot(node, 'invalid_qty'), state, ctx), ctx);
        return;
      }
      return void addToCart(state, node, ctx, actions, qty);
    }
    case 'order:cart': {
      const picked = matchOptionIn(o.options || [], text);
      if (!picked) return invalid(() => showCart(state, node, ctx, actions));
      if (picked.id === 'more') return void showCatalog(state, node, ctx, actions);
      if (picked.id === 'clear') {
        o.cart = [];
        o.page = 0;
        actions.push({ type: 'info', text: 'Carrinho esvaziado' });
        sendText(actions, fillVars(ot(node, 'cart_cleared'), state, ctx), ctx);
        return void showCatalog(state, node, ctx, actions);
      }
      return void finishCart(state, node, ctx, actions);
    }
    case 'order:delivery': {
      const picked = matchOptionIn(o.options || [], text);
      if (!picked || !(o.modes || []).includes(picked.id as any)) return invalid(() => chooseDelivery(state, node, ctx, actions));
      o.delivery = picked.id as 'delivery' | 'pickup';
      actions.push({ type: 'info', text: o.delivery === 'delivery' ? 'Entrega' : 'Retirada no local' });
      return void afterDelivery(state, node, ctx, actions);
    }
    case 'order:address': {
      const picked = matchOptionIn(o.options || [], text);
      if (!picked) return invalid(() => askAddress(state, node, ctx, actions));
      if (picked.id === '__type') return void askAddress(state, node, ctx, actions, true);
      const a = (o.addresses || []).find((x) => `a:${x.id}` === picked.id) || null;
      if (!a) return invalid(() => askAddress(state, node, ctx, actions));
      o.address = a;
      o.address_id = a.id;
      actions.push({ type: 'info', text: `Endereço salvo: ${addressLineOf(a)}` });
      return void askNextCustom(state, node, ctx, actions);
    }
    case 'order:address_text': {
      const v = text.replace(/\s+/g, ' ');
      if (v.length < 8 || !/\p{L}{2,}/u.test(v)) {
        state.retries += 1;
        actions.push({ type: 'info', text: `Endereço incompleto (${state.retries}/${maxRetries})` });
        if (state.retries >= maxRetries) return go(orderFailed(def, state, node, ctx, actions, { error: 'endereço de entrega não informado' }));
        sendText(actions, fillVars(ot(node, 'invalid_address'), state, ctx), ctx);
        return;
      }
      o.address = { id: '', kind: 'delivery', street: v.slice(0, 255) };
      o.address_id = null;
      o.step = 'address_confirm';
      sendText(actions, fillVars(ot(node, 'confirm_address'), state, ctx), ctx);
      waitInput(state, 'order:address_confirm', actions, 'Aguardando a confirmação do endereço');
      return;
    }
    case 'order:address_confirm': {
      const yn = yesNo(text);
      if (yn === 'yes') return void askNextCustom(state, node, ctx, actions);
      if (yn === 'no') return void askAddress(state, node, ctx, actions, true);
      return invalid(() => sendText(actions, fillVars(ot(node, 'confirm_address'), state, ctx), ctx));
    }
    case 'order:custom': {
      const cf = Array.isArray(o.cf) ? o.cf : [];
      const i = Number(o.cf_i) || 0;
      const f = cf[i];
      if (!f) return void askNextCustom(state, node, ctx, actions);
      o.custom = o.custom || {};
      const r = cfStep(f, text, o.custom, state, node, ctx, actions, maxRetries);
      if (r === 'retry') return;
      if (r === 'fail') return go(orderFailed(def, state, node, ctx, actions, { error: `campo obrigatório “${f.label}” sem resposta válida` }));
      o.cf_i = i + 1;
      return void askNextCustom(state, node, ctx, actions);
    }
    case 'order:notes': {
      o.notes = SKIP_WORDS.test(n) || CF_SKIP.test(n) || !text ? '' : text.slice(0, 500);
      actions.push({ type: 'info', text: o.notes ? `Observação: ${o.notes}` : 'Sem observação' });
      return void choosePayment(state, node, ctx, actions);
    }
    case 'order:payment': {
      const picked = matchOptionIn(o.options || [], text);
      if (!picked) return invalid(() => choosePayment(state, node, ctx, actions));
      o.payment = picked.id;
      actions.push({ type: 'info', text: `Pagamento: ${picked.id === 'on_delivery' && o.delivery === 'pickup' ? 'Na retirada' : PAYMENT_LABEL[picked.id] || picked.id}` });
      return void showSummary(state, node, ctx, actions);
    }
    case 'order:confirm': {
      const picked = matchOptionIn(o.options || [], text);
      const yn = picked ? null : yesNo(text);
      const choice = picked?.id || (yn === 'yes' ? 'confirm' : null);
      if (choice === 'confirm') return void orderCreate(state, node, actions);
      if (choice === 'edit') {
        o.delivery = null;
        o.address = null;
        o.address_id = null;
        o.payment = null;
        o.notes = null;
        o.cf_i = 0;
        o.custom = {};
        return void showCart(state, node, ctx, actions);
      }
      if (choice === 'cancel') {
        orderFocus(state);
        actions.push({ type: 'info', text: 'Cliente cancelou no resumo' });
        return go(exitPort(def, node, 'canceled', ot(node, 'cancel'), state, ctx, actions));
      }
      return invalid(() => showSummary(state, node, ctx, actions));
    }
    default:
      actions.push({ type: 'info', text: 'O bloco de pedido não esperava esta resposta.' });
  }
}

/** Anda pelo grafo a partir de `fromId` até precisar de entrada, acabar ou esperar. */
function walk(def: BotDefinition, state: BotState, fromId: string | null, ctx: BotContext, actions: BotAction[]) {
  let id: string | null = fromId;
  let steps = 0;
  while (id && steps++ < MAX_STEPS) {
    const node = nodeById(def, id);
    if (!node) break;
    const d = node.data || {};
    state.node_id = node.id;
    if (isBookType(node.type)) {
      const r = bookEnter(def, state, node, ctx, actions);
      if (r === 'stop') return;
      id = r;
      continue;
    }
    if (isTicketType(node.type)) {
      const r = ticketEnter(def, state, node, ctx, actions);
      if (r === 'stop') return;
      id = r;
      continue;
    }
    if (isOrderType(node.type)) {
      const r = orderEnter(def, state, node, ctx, actions);
      if (r === 'stop') return;
      id = r;
      continue;
    }
    if (node.type.startsWith('crm_')) {
      const r = crmEnter(def, state, node, ctx, actions);
      if (r === 'stop') return;
      id = r;
      continue;
    }
    switch (node.type) {
      case 'start':
        id = nextOf(def, node.id, 'out');
        continue;
      case 'message': {
        const items: any[] = Array.isArray(d.messages) ? d.messages : [];
        for (const m of items) {
          const text = fillVars(String(m.text || ''), state, ctx);
          const kind = ['image', 'video', 'audio', 'document'].includes(m.kind) && m.media ? m.kind : 'text';
          if (kind === 'text') sendText(actions, text, ctx, m.delay_seconds);
          else {
            const ms = typingMs(text, m.delay_seconds);
            if (ctx.settings.typing !== false) actions.push({ type: 'typing', ms });
            actions.push({ type: 'send', delay_ms: ctx.settings.typing !== false ? ms : 0, message: { kind, text: text || undefined, media: m.media } });
          }
        }
        id = nextOf(def, node.id, 'out');
        continue;
      }
      case 'menu': {
        if (d.source === 'products' && !menuOptions(node, ctx).length) {
          actions.push({ type: 'info', text: 'Menu de produtos sem produto ativo — seguindo pelo caminho “inválida”' });
          id = nextOf(def, node.id, 'invalid');
          continue;
        }
        sendText(actions, menuText(node, ctx.settings, state, ctx), ctx);
        state.status = 'waiting';
        state.waiting_for = 'menu';
        state.retries = 0;
        actions.push({ type: 'info', text: 'Aguardando o cliente escolher uma opção' });
        return;
      }
      case 'question':
        sendText(actions, fillVars(String(d.text || ''), state, ctx), ctx);
        state.status = 'waiting';
        state.waiting_for = 'question';
        state.retries = 0;
        actions.push({ type: 'info', text: `Aguardando a resposta do cliente${d.var ? ` (vai para {{${d.var}}})` : ''}` });
        return;
      case 'condition': {
        const rules: any[] = Array.isArray(d.rules) ? d.rules : [];
        const results = rules.map((r) => evalRule(r, state, ctx));
        const ok = rules.length ? (d.match === 'any' ? results.some(Boolean) : results.every(Boolean)) : true;
        actions.push({ type: 'info', text: `Condição “${d.title || 'Condição'}”: ${ok ? 'sim' : 'não'}` });
        id = nextOf(def, node.id, ok ? 'true' : 'false');
        continue;
      }
      case 'tags': {
        const add = (Array.isArray(d.add) ? d.add : []).map(String);
        const remove = (Array.isArray(d.remove) ? d.remove : []).map(String);
        if (add.length || remove.length) {
          actions.push({ type: 'tags', add, remove });
          const set = new Set(ctx.chatTagIds);
          add.forEach((x: string) => set.add(x));
          remove.forEach((x: string) => set.delete(x));
          ctx.chatTagIds = [...set];
        }
        id = nextOf(def, node.id, 'out');
        continue;
      }
      case 'wait': {
        const amount = Math.max(1, Number(d.amount) || 1);
        const mult = d.unit === 'hours' ? 3600 : d.unit === 'minutes' ? 60 : 1;
        const seconds = Math.min(7 * 86400, amount * mult);
        state.status = 'waiting';
        state.waiting_for = 'wait';
        state.wait_until = new Date(ctx.now.getTime() + seconds * 1000).toISOString();
        actions.push({ type: 'wait', seconds });
        return;
      }
      case 'pix': {
        const cents = Math.max(0, Math.round(Number(d.amount_cents) || 0));
        state.pix = { amount_cents: cents, description: String(d.description || 'Pagamento').slice(0, 200) };
        state.status = 'waiting';
        state.waiting_for = 'pix';
        actions.push({ type: 'pix', node_id: node.id, amount_cents: cents, description: state.pix.description, text: String(d.text || ''), send_qr: d.send_qr !== false, expires_minutes: Math.min(1440, Math.max(5, Number(d.expires_minutes) || 30)) });
        return;
      }
      case 'handoff':
        sendText(actions, fillVars(String(d.text || ''), state, ctx), ctx);
        actions.push({ type: 'handoff', assign_user_id: d.assign_user_id ? String(d.assign_user_id) : null });
        state.status = 'handoff';
        state.waiting_for = null;
        return;
      case 'end':
        sendText(actions, fillVars(String(d.text || ''), state, ctx), ctx);
        actions.push(d.close === false ? { type: 'finish' } : { type: 'close' });
        state.status = 'done';
        state.waiting_for = null;
        return;
      default:
        id = nextOf(def, node.id, 'out');
        continue;
    }
  }
  // saiu do grafo (bloco sem continuação) → fluxo concluído
  if (steps >= MAX_STEPS) actions.push({ type: 'info', text: 'Fluxo interrompido: laço detectado (muitos blocos seguidos sem esperar o cliente).' });
  state.status = 'done';
  state.waiting_for = null;
  actions.push({ type: 'finish' });
}

/** Começa o fluxo (cliente mandou a 1ª mensagem ou o atendente enviou para o bot). */
export function startFlow(def: BotDefinition, ctx: BotContext, firstInput?: string | null) {
  const state = emptyState();
  state.last_input = firstInput ?? null;
  const actions: BotAction[] = [];
  const start = startNode(def);
  if (!start) {
    actions.push({ type: 'info', text: 'O fluxo não tem bloco de início.' });
    state.status = 'done';
    return { state, actions };
  }
  const bh = ctx.settings.business_hours;
  if (bh?.enabled && !isBusinessOpen(bh, ctx.now)) {
    sendText(actions, fillVars(String(bh.outside_text || 'Estamos fora do horário de atendimento. Assim que possível retornaremos.'), state, ctx), ctx);
    if (bh.outside_action === 'message_only') {
      state.status = 'done';
      actions.push({ type: 'finish' });
      return { state, actions };
    }
    if (bh.outside_action === 'message_and_handoff') {
      actions.push({ type: 'handoff', assign_user_id: null });
      state.status = 'handoff';
      return { state, actions };
    }
  }
  walk(def, state, start.id, ctx, actions);
  return { state, actions };
}

/**
 * Cliente respondeu enquanto o bot esperava (opção, pergunta, PIX, passos do CRM).
 * `media` (opcional): arquivo que veio na mensagem (foto/documento…) — só os blocos de chamado usam.
 */
export function handleInput(def: BotDefinition, prev: BotState, input: string, ctx: BotContext, media?: BotInputMedia | null) {
  const state = cloneState(prev);
  state.last_input = String(input || '');
  const actions: BotAction[] = [];
  const node = nodeById(def, state.node_id);
  if (!node || state.status !== 'waiting') {
    actions.push({ type: 'info', text: 'O bot não está esperando resposta nesta conversa.' });
    return { state, actions };
  }
  const d = node.data || {};
  const maxRetries = maxRetriesOf(d, ctx);

  // palavra de reinício (Configurações → "menu", "#inicio"…): sai de QUALQUER espera (inclusive cobrança/CRM).
  // O runtime já recomeça o fluxo antes de chegar aqui; no simulador a conversa termina e a próxima começa do zero.
  if (isRestartWord(input, ctx.settings)) {
    actions.push({ type: 'info', text: 'Cliente pediu para recomeçar — saiu da espera; a próxima mensagem começa do início.' });
    state.status = 'done';
    state.waiting_for = null;
    state.crm = null;
    state.charge = null;
    state.book = null;
    state.ticket = null;
    state.order = null;
    state.pix = null;
    state.wait_until = null;
    actions.push({ type: 'finish' });
    return { state, actions };
  }

  // blocos de agenda (inclusive a espera do pagamento do agendamento)
  if (isBookType(node.type)) {
    bookInput(def, state, node, input, ctx, actions);
    return { state, actions };
  }

  // blocos de chamado (Fase 6B) — os únicos que aceitam arquivo (foto/documento) como resposta
  if (isTicketType(node.type)) {
    ticketInput(def, state, node, input, ctx, actions, media || null);
    return { state, actions };
  }

  // blocos de pedido (Fase 7) — inclusive a espera do PIX do pedido
  if (isOrderType(node.type)) {
    orderInput(def, state, node, input, ctx, actions);
    return { state, actions };
  }

  if (state.waiting_for && CRM_WAITING.has(state.waiting_for)) {
    crmInput(def, state, node, input, ctx, actions);
    return { state, actions };
  }

  if (state.waiting_for === 'menu') {
    const opt = matchOption(node, input, ctx);
    if (opt) {
      let next = nextOf(def, node.id, `opt-${opt.id}`);
      if (!next && opt.product) {
        // produto do catálogo sem ligação (entrou depois de o fluxo ser desenhado): não termina o fluxo em silêncio
        next = nextOf(def, node.id, 'invalid') || nextOf(def, node.id, 'out');
        if (!next) {
          actions.push({ type: 'info', text: `Produto “${opt.product.name}” sem ligação no menu — avisando e repetindo o menu` });
          sendText(actions, fillVars(String(d.unavailable_text || '').trim() || DEFAULT_UNAVAILABLE, state, ctx), ctx);
          sendText(actions, menuText(node, ctx.settings, state, ctx), ctx);
          return { state, actions };
        }
        actions.push({ type: 'info', text: `Produto “${opt.product.name}” sem ligação no menu — seguindo pela saída “${nextOf(def, node.id, 'invalid') ? 'inválida' : 'depois'}”` });
      }
      state.vars.opcao = String(opt.label || '');
      if (opt.product) {
        state.vars.produto_id = opt.product.id;
        state.vars.produto = opt.product.name;
        actions.push({ type: 'set_var', name: 'produto_id', value: opt.product.id });
      }
      state.status = 'active';
      state.waiting_for = null;
      state.retries = 0;
      actions.push({ type: 'info', text: `Opção escolhida: ${opt.label}` });
      walk(def, state, next, ctx, actions);
      return { state, actions };
    }
    state.retries += 1;
    const invalidEdge = nextOf(def, node.id, 'invalid');
    if (state.retries >= maxRetries && invalidEdge) {
      actions.push({ type: 'info', text: `Opção inválida (${state.retries}/${maxRetries}) — seguindo pelo caminho “inválida”` });
      state.status = 'active';
      state.waiting_for = null;
      state.retries = 0;
      walk(def, state, invalidEdge, ctx, actions);
      return { state, actions };
    }
    actions.push({ type: 'info', text: `Opção inválida (${state.retries}/${maxRetries})` });
    sendText(actions, fillVars(String(d.invalid_text || ctx.settings.invalid_option_text || DEFAULT_INVALID), state, ctx), ctx);
    if (state.retries >= maxRetries) sendText(actions, menuText(node, ctx.settings, state, ctx), ctx);
    return { state, actions };
  }

  if (state.waiting_for === 'question') {
    const r = validateAnswer(String(d.validate || 'any'), input);
    if (r.ok) {
      const name = String(d.var || '').trim().toLowerCase();
      if (name) {
        state.vars[name] = r.value;
        actions.push({ type: 'set_var', name, value: r.value });
      }
      if (d.save_to_contact === 'name' || d.save_to_contact === 'email') actions.push({ type: 'save_contact', field: d.save_to_contact, value: r.value });
      state.status = 'active';
      state.waiting_for = null;
      state.retries = 0;
      walk(def, state, nextOf(def, node.id, 'out'), ctx, actions);
      return { state, actions };
    }
    state.retries += 1;
    const invalidEdge = nextOf(def, node.id, 'invalid');
    if (state.retries >= maxRetries && invalidEdge) {
      state.status = 'active';
      state.waiting_for = null;
      state.retries = 0;
      walk(def, state, invalidEdge, ctx, actions);
      return { state, actions };
    }
    sendText(actions, fillVars(String(d.invalid_text || INVALID_FALLBACK[String(d.validate)] || 'Não entendi. Pode responder de novo?'), state, ctx), ctx);
    return { state, actions };
  }

  if (state.waiting_for === 'pix') {
    const n = norm(input);
    if (/\b(paguei|pago|ja paguei|pix feito|feito|comprovante|transferi)\b/.test(n)) actions.push({ type: 'pix_check' });
    else actions.push({ type: 'info', text: 'Aguardando a confirmação do pagamento' });
    return { state, actions };
  }

  if (state.waiting_for === 'wait') {
    actions.push({ type: 'info', text: 'O bot está numa espera programada; a mensagem do cliente não muda o fluxo.' });
    return { state, actions };
  }
  return { state, actions };
}

/** Eventos: espera concluída, PIX pago/expirado, resultado de ação do CRM, cobrança paga/expirada. */
export function handleEvent(def: BotDefinition, prev: BotState, event: BotEvent, ctx: BotContext, payload?: BotEventPayload | null) {
  const state = cloneState(prev);
  const actions: BotAction[] = [];
  const node = nodeById(def, state.node_id);
  if (!node) {
    state.status = 'done';
    return { state, actions };
  }
  const d = node.data || {};
  if (event === 'wait_done' && state.waiting_for === 'wait') {
    state.status = 'active';
    state.waiting_for = null;
    state.wait_until = null;
    walk(def, state, nextOf(def, node.id, 'out'), ctx, actions);
  } else if (event === 'pix_paid' && state.waiting_for === 'pix') {
    sendText(actions, fillVars(String(d.paid_text || '✅ Pagamento confirmado! Obrigado.'), state, ctx), ctx);
    state.status = 'active';
    state.waiting_for = null;
    walk(def, state, nextOf(def, node.id, 'paid'), ctx, actions);
  } else if (event === 'pix_expired' && state.waiting_for === 'pix') {
    sendText(actions, fillVars(String(d.expired_text || '⌛ O PIX expirou. Se quiser, é só pedir um novo.'), state, ctx), ctx);
    state.status = 'active';
    state.waiting_for = null;
    walk(def, state, nextOf(def, node.id, 'expired'), ctx, actions);
  } else if (event === 'crm_result' && isTicketType(node.type)) {
    // ações `ticket_*` (Fase 6B) respondem pelo mesmo evento `crm_result`
    if (state.waiting_for !== 'ticket:wait') {
      actions.push({ type: 'info', text: 'Resultado do chamado recebido sem ação pendente — ignorado.' });
      return { state, actions };
    }
    ticketResult(def, state, node, ctx, actions, payload || {});
  } else if (event === 'crm_result' && isOrderType(node.type)) {
    // ações `order_*` (Fase 7) respondem pelo mesmo evento `crm_result`
    if (state.waiting_for !== 'order:wait') {
      actions.push({ type: 'info', text: 'Resultado do pedido recebido sem ação pendente — ignorado.' });
      return { state, actions };
    }
    orderResult(def, state, node, ctx, actions, payload || {});
  } else if (event === 'crm_result') {
    if (state.waiting_for !== 'crm_wait' || !node.type.startsWith('crm_')) {
      actions.push({ type: 'info', text: 'Resultado do CRM recebido sem ação pendente — ignorado.' });
      return { state, actions };
    }
    crmResult(def, state, node, ctx, actions, payload || {});
  } else if (event === 'book_result') {
    if (state.waiting_for !== 'book:wait' || !isBookType(node.type)) {
      actions.push({ type: 'info', text: 'Resultado da agenda recebido sem ação pendente — ignorado.' });
      return { state, actions };
    }
    bookResult(def, state, node, ctx, actions, payload || {});
  } else if (event === 'charge_paid' || event === 'charge_expired') {
    if (state.waiting_for !== 'charge' || !state.charge) {
      actions.push({ type: 'info', text: 'Evento de cobrança sem cobrança pendente — ignorado.' });
      return { state, actions };
    }
    if (payload?.charge_id && payload.charge_id !== state.charge.id) {
      actions.push({ type: 'info', text: 'Evento de outra cobrança — ignorado.' });
      return { state, actions };
    }
    const paid = event === 'charge_paid';
    if (node.type === 'book_service') {
      bookChargeEvent(def, state, node, ctx, actions, paid, payload);
      return { state, actions };
    }
    if (node.type === 'order_cart') {
      orderChargeEvent(def, state, node, ctx, actions, paid, payload);
      return { state, actions };
    }
    if (payload?.customer) setCustomer(state, ctx, payload.customer);
    if (payload?.subscription) {
      const c = currentCustomer(state, ctx);
      if (c) {
        const i = (c.subscriptions || []).findIndex((s) => s.id === payload.subscription!.id);
        c.subscriptions = c.subscriptions || [];
        if (i >= 0) c.subscriptions[i] = payload.subscription;
        else c.subscriptions.push(payload.subscription);
      }
    }
    sendText(actions, fillVars(String((paid ? d.paid_text : d.expired_text) || '').trim() || (paid ? CRM_TEXTS.subscribe.paid_text : CRM_TEXTS.subscribe.expired_text), state, ctx), ctx);
    state.charge = null;
    state.crm = null;
    state.status = 'active';
    state.waiting_for = null;
    walk(def, state, nextOf(def, node.id, paid ? 'paid' : 'expired'), ctx, actions);
  }
  return { state, actions };
}

// ---------------------------------------------------------------- validação da definição
export const CRM_TYPES = ['crm_identify', 'crm_register', 'crm_subscribe', 'crm_info', 'crm_invoice', 'crm_cancel', 'crm_pause', 'crm_change_plan', 'crm_update'];
const TYPES = new Set(['start', 'message', 'menu', 'question', 'condition', 'tags', 'wait', 'pix', 'handoff', 'end', ...CRM_TYPES, ...BOOK_TYPES, ...TICKET_TYPES, ...ORDER_TYPES]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Problemas que impedem ativar o fluxo (lista vazia = ok). */
export function validateDefinition(def: BotDefinition | null | undefined): string[] {
  const errs: string[] = [];
  if (!def || !Array.isArray(def.nodes) || !Array.isArray(def.edges)) return ['O fluxo está vazio.'];
  const starts = def.nodes.filter((n) => n.type === 'start');
  if (starts.length !== 1) errs.push('O fluxo precisa de exatamente um bloco de início.');
  const ids = new Set(def.nodes.map((n) => n.id));
  for (const n of def.nodes) {
    if (!TYPES.has(n.type)) errs.push(`Bloco de tipo desconhecido: ${n.type}.`);
    const d = n.data || {};
    const title = d.title || n.type;
    if (n.type === 'menu' && d.source !== 'products' && !(Array.isArray(d.options) && d.options.length)) errs.push(`“${title}”: adicione pelo menos uma opção.`);
    if (n.type === 'question' && !String(d.text || '').trim()) errs.push(`“${title}”: escreva a pergunta.`);
    if (n.type === 'pix' && !(Number(d.amount_cents) > 0)) errs.push(`“${title}”: informe o valor da cobrança.`);
    if (n.type === 'message' && !(Array.isArray(d.messages) && d.messages.some((m: any) => String(m.text || '').trim() || m.media))) errs.push(`“${title}”: a mensagem está vazia.`);
    if ((n.type === 'crm_register' || n.type === 'crm_update') && !(Array.isArray(d.fields) && d.fields.some((f: any) => String(f?.key || '').trim()))) errs.push(`“${title}”: adicione pelo menos um campo para perguntar.`);
    if (n.type === 'crm_subscribe') {
      const pid = String(d.product_id || 'choose');
      if (pid !== 'choose' && pid !== 'from_var' && !UUID_RE.test(pid)) errs.push(`“${title}”: escolha um produto válido.`);
    }
    if (n.type === 'crm_pause' && d.max_days != null && !(Number(d.max_days) >= 1)) errs.push(`“${title}”: o máximo de dias precisa ser pelo menos 1.`);
    if (n.type === 'book_service') {
      if (Array.isArray(d.services) && d.services.some((x: any) => !UUID_RE.test(String(x)))) errs.push(`“${title}”: um dos serviços escolhidos é inválido.`);
      const r = String(d.resource || 'auto');
      if (r !== 'ask' && r !== 'auto' && !UUID_RE.test(r)) errs.push(`“${title}”: escolha um profissional/recurso válido.`);
    }
    if (n.type === 'waitlist_join') {
      const p = String(d.product_id || 'current');
      if (p !== 'current' && p !== 'ask' && !UUID_RE.test(p)) errs.push(`“${title}”: escolha um serviço válido.`);
    }
    if ((n.type === 'book_service' || n.type === 'my_appointments' || n.type === 'waitlist_join') && d.days_ahead != null && !(Number(d.days_ahead) >= 1 && Number(d.days_ahead) <= 60))
      errs.push(`“${title}”: a janela de dias precisa ficar entre 1 e 60.`);
    if (n.type === 'open_ticket') {
      const c = String(d.category ?? 'ask').trim();
      if (c !== 'ask' && !/^[a-z0-9_-]{1,40}$/.test(c)) errs.push(`“${title}”: escolha uma categoria válida.`);
      const p = String(d.priority ?? 'default');
      if (p !== 'default' && !TICKET_PRIORITIES.includes(p)) errs.push(`“${title}”: prioridade inválida.`);
    }
    if (n.type === 'my_tickets' && d.show != null && d.show !== 'active' && d.show !== 'all') errs.push(`“${title}”: escolha quais chamados mostrar.`);
    if (n.type === 'order_cart') {
      const c = d.categories ?? 'all';
      if (c !== 'all' && !(Array.isArray(c) && c.length && c.every((x: any) => typeof x === 'string' && x.trim()))) errs.push(`“${title}”: escolha as categorias do catálogo (ou todas).`);
      const pay = String(d.payment ?? 'ask');
      if (!['ask', 'pix', 'on_delivery'].includes(pay)) errs.push(`“${title}”: forma de pagamento inválida.`);
      if (d.allow_delivery === false && d.allow_pickup === false) errs.push(`“${title}”: permita entrega, retirada ou as duas.`);
    }
    if (n.type === 'my_orders' && d.show != null && d.show !== 'open' && d.show !== 'all') errs.push(`“${title}”: escolha quais pedidos mostrar.`);
  }
  for (const e of def.edges) if (!ids.has(e.source) || !ids.has(e.target)) errs.push('Há uma ligação apontando para um bloco que não existe.');
  const start = starts[0];
  if (start && !def.edges.some((e) => e.source === start.id)) errs.push('Ligue o bloco de início ao primeiro passo do fluxo.');
  return [...new Set(errs)];
}
