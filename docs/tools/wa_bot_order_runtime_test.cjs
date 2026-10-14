// Teste do RUNTIME do bot com os blocos de PEDIDOS e os CAMPOS PERSONALIZADOS (Fase 7, contrato §11.1/§11.3) com
// dependências falsas em memória — sem banco, sem WhatsApp. Usa o `dist` do back (nest build). Rodar na raiz do repo:
//   node docs/tools/wa_bot_order_runtime_test.cjs        (DIST_DIR=<pasta dist> se estiver em outro lugar)
// Cobre: pedido pela conversa (catálogo do serviço → produto → quantidade → entrega → endereço SALVO do titular (o de
// cobrança nunca) → campo do pedido → PIX → resumo) → `orders.create` com source bot + número/jid + contato + titular +
// bot{flow,node} + custom; cobrança mandada pelo `charges.resend` (o motor não repete o código); `charge_paid` retoma
// pela porta "pago"; envio da cobrança falhou → o motor manda o código; entrega tardia (cliente saiu do bloco); pedido
// marcado pago à mão (PIX cancelado) → "pago"; posse (cliente só visto pelo código não recebe pedido nem tem endereços);
// freio de 5 pedidos/h; erros do serviço → textos para o cliente; "Meus pedidos" com campos visíveis; contexto
// (condição de pedido / definições de campos só quando o fluxo usa); chamado leva os campos respondidos.
const path = require('path');
const DIST = process.env.DIST_DIR || path.resolve(__dirname, '../../back/dist');
const { WhatsAppBotService, BotUserError } = require(path.join(DIST, 'src/whatsapp/bot/whatsapp-bot.service.js'));
const { WhatsAppHooks } = require(path.join(DIST, 'src/whatsapp/whatsapp-hooks.service.js'));
const { emptyState } = require(path.join(DIST, 'src/whatsapp/bot/wa-bot.engine.js'));
const { BadRequestException } = require(require.resolve('@nestjs/common', { paths: [path.resolve(DIST, '..')] }));

let pass = 0, fail = 0;
const ok = (l, c, x) => { if (c) pass++; else { fail++; console.log('FAIL', l, x === undefined ? '' : JSON.stringify(x).slice(0, 700)); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ORG = 'org1', SID = 'S1', JID = '5500999990093@c.us', FLOW = 'F1';
const N = (id, type, data = {}) => ({ id, type, position: { x: 0, y: 0 }, data });
const E = (source, sourceHandle, target) => ({ id: `${source}-${sourceHandle}-${target}`, source, sourceHandle, target });
const msg = (id, text) => N(id, 'message', { messages: [{ id: 'm', kind: 'text', text }] });
const def = {
  nodes: [
    N('start', 'start'),
    N('menu', 'menu', { text: 'Olá! O que deseja?', options: [{ id: 'pedir', label: 'Fazer pedido' }, { id: 'meus', label: 'Meus pedidos' }] }),
    N('oc', 'order_cart', { categories: 'all', payment: 'ask', allow_delivery: true, allow_pickup: true }),
    N('mo', 'my_orders', { show: 'open' }),
    msg('m-out', 'OUT pedido {{pedido.numero}}'),
    msg('m-paid', 'PAGO pedido {{pedido.numero}} ({{pedido.status}})'),
    msg('m-exp', 'EXPIROU {{pedido.numero}}'),
    N('end', 'end', { text: 'Tchau', close: true }),
  ],
  edges: [
    E('start', 'out', 'menu'), E('menu', 'opt-pedir', 'oc'), E('menu', 'opt-meus', 'mo'),
    E('oc', 'out', 'm-out'), E('oc', 'paid', 'm-paid'), E('oc', 'expired', 'm-exp'),
    E('m-out', 'out', 'end'), E('m-paid', 'out', 'end'), E('m-exp', 'out', 'end'), E('mo', 'out', 'end'), E('mo', 'none', 'end'),
  ],
};

// ---------------- estado em memória
const db = { flow: { id: FLOW, organization_id: ORG, active: true, definition: def, settings: { audience: { mode: 'all' }, typing: false }, updated_at: new Date() }, sessions: new Map() };
const sent = [];
const calls = [];
const bkey = (w) => `${w.organization_id_session_id_chat_id.session_id}|${w.organization_id_session_id_chat_id.chat_id}`;
let rowSeq = 0;
const odb = new Map(); // pedidos
const CUSTS = {
  'cust-owner': { id: 'cust-owner', addresses: [{ id: 'ad1', kind: 'delivery', label: 'Casa', street: 'Rua das Flores', number: '10', district: 'Centro', city: 'São Paulo', state: 'SP' }, { id: 'ad2', kind: 'billing', street: 'Rua do Boleto', number: '1' }] },
  'cust-seen': { id: 'cust-seen', addresses: [{ id: 'ad9', kind: 'delivery', street: 'Rua Secreta', number: '99' }] },
};
const prisma = {
  whatsapp_bot_flows: { findFirst: async ({ where }) => (where.id === db.flow.id ? db.flow : null) },
  whatsapp_chats: { findUnique: async () => ({ id: 'chat-uuid', organization_id: ORG, session_id: SID, chat_id: JID, kind: 'individual', service_status: 'none', tags: [], name: 'Fulano' }) },
  whatsapp_bot_sessions: {
    findUnique: async ({ where }) => db.sessions.get(bkey(where)) || null,
    upsert: async ({ where, create, update }) => { const k = bkey(where); const cur = db.sessions.get(k); const row = cur ? { ...cur, ...update, updated_at: new Date() } : { id: `bs${++rowSeq}`, ...create, updated_at: new Date() }; db.sessions.set(k, row); return row; },
    update: async ({ where, data }) => { for (const [k, v] of db.sessions) if (v.id === where.id) db.sessions.set(k, { ...v, ...data }); return {}; },
  },
  whatsapp_contacts: { findUnique: async () => ({ id: 'C1', name: 'Fulano', phone: '5500999990093', saved: true }) },
  whatsapp_messages: { create: async () => ({}) },
  whatsapp_crm_settings: { findUnique: async () => null },
  whatsapp_customers: { findFirst: async ({ where }) => (where.organization_id === ORG ? CUSTS[where.id] || null : null) },
  whatsapp_orders: { findFirst: async ({ where }) => [...odb.values()].find((o) => o.charge?.id === where.charge_id) || null },
};
// ---------------- pedidos falsos (formato do WhatsAppOrdersService.shape)
let oSeq = 1000;
const orderErr = { next: null };
const orders = {
  catalog: async () => ({ categories: [{ name: 'Lanches', products: [{ id: 'p1', name: 'X-Burguer', price_cents: 2500, price_label: 'R$ 25,00' }, { id: 'p2', name: 'X-Salada', price_cents: 2800, price_label: 'R$ 28,00' }] }], total: 2 }),
  settings: async () => ({ enabled: true, delivery: { enabled: true, fee_cents: 500, free_from_cents: 0 }, pickup: { enabled: true, address: 'Rua Exemplo, 100' }, min_order_cents: 0, payment_methods: ['pix', 'on_delivery'], max_items: 30, texts: {} }),
  create: async (_o, input) => {
    calls.push(['create', input]);
    if (orderErr.next) { const e = orderErr.next; orderErr.next = null; throw e; }
    const number = ++oSeq;
    const total = input.items.reduce((a, i) => a + (i.product_id === 'p1' ? 2500 : 2800) * i.qty, 0) + (input.delivery?.mode === 'delivery' ? 500 : 0);
    const pix = input.payment_method === 'pix';
    const o = { id: `O${number}`, number, status: 'new', status_label: 'Recebido', payment_method: input.payment_method, payment_method_label: pix ? 'PIX' : 'Na entrega', payment_status: pix ? 'pending' : 'not_required', payment_status_label: pix ? 'Aguardando pagamento' : 'Paga na entrega', items_text: '2× X-Burguer — R$ 50,00', total_cents: total, total_label: `R$ ${(total / 100).toFixed(2)}`, delivery_text: '🛵 Entrega', custom: input.custom || {}, contact_id: input.contact_id, customer: input.customer_id ? { id: input.customer_id } : null, charge: pix ? { id: `CH${number}`, status: 'PENDING', pix_code: `PIXCODE${number}` } : null, created_at: new Date() };
    odb.set(o.id, o);
    return { order: o, charge: pix ? { id: `CH${number}`, amount_cents: total, description: `Pedido #${number}`, due_at: '2026-10-13', pix_code: `PIXCODE${number}` } : null };
  },
  get: async (_o, id) => odb.get(id),
  ofContact: async (_o, who, opts) => { calls.push(['ofContact', who, opts]); return [...odb.values()].filter((o) => (who.contact_id && o.contact_id === who.contact_id) || (o.customer && (who.customer_ids || []).includes(o.customer.id))).filter((o) => !opts?.open_only || ['new', 'confirmed', 'preparing', 'out_for_delivery'].includes(o.status)).slice(0, opts?.limit || 5); },
};
const resendFail = { on: false };
const charges = { resend: async (_o, id) => { calls.push(['resend', id]); if (resendFail.on) throw new Error('fila indisponível'); return { id, pix: { code: `PIXCODE-RESENT` }, amount_cents: 5500 }; } };
const CF = {
  customer: [],
  ticket: [{ key: 'contrato', label: 'Nº do contrato', type: 'number', required: true, ask_in_bot: true, visible_to_customer: true }],
  order: [{ key: 'tamanho', label: 'Tamanho', type: 'select', options: ['P', 'M', 'G'], required: true, ask_in_bot: true, visible_to_customer: true }],
};
let cfCalls = 0;
const customFields = { map: async () => { cfCalls++; return CF; }, invalidate: () => undefined };
const tcalls = [];
const tickets = { create: async (_o, input) => { tcalls.push(input); return { id: 'T1', protocol: '2026000001', status: 'open', status_label_customer: 'Aberto', category: input.category, category_label: 'Dúvida', contact_id: 'C1', custom: input.custom || {} }; }, lastPublicUpdate: async () => null };
const identity = {
  customersOfJid: async () => ({ contact: { id: 'C1' }, customers: [{ customer: { id: 'cust-owner' }, role: 'owner' }] }),
  contactOfJid: async () => ({ id: 'C1' }),
  findCustomer: async () => ({ found: [] }),
  ensureLinked: async () => undefined,
};
const crm = { varsForChat: async () => ({}), botProducts: async () => [], botCustomer: async () => { throw new Error('sem cliente'); } };
const hooks = new WhatsAppHooks();
const openwa = { sendText: async (_sid, _jid, text) => { sent.push(text); return { messageId: 'm' + sent.length }; }, typing: async () => undefined };
const attendance = { setStatus: async () => undefined, changeTags: async () => undefined, settings: async () => ({ reset_hours: 24 }), expired: () => false };
const sessionsSvc = { rowById: async () => ({ id: SID, openwa_session_id: 'ow1', status: 'ready', bot_flow_id: FLOW }) };
const svc = new WhatsAppBotService(prisma, openwa, {}, { bumpChat: async () => undefined }, { canonicalChatId: async (_o, _s, id) => id }, attendance, { message: () => undefined, tagMap: async () => new Map() }, hooks, { isOrgActive: async () => true }, crm, sessionsSvc, {}, {}, identity, {}, charges, undefined, tickets, orders, customFields);
svc.onModuleInit();
clearInterval(svc.timer);

const inbound = async (body, extra = {}) => { await svc.processInbound({ orgId: ORG, sessionId: SID, chatId: JID, session: null, message: { body, timestamp: new Date(Date.now() + 2000), type: 'chat', ...extra } }); await drain(); };
const drain = async () => { for (let i = 0; i < 100 && svc.queues.size; i++) await sleep(20); await sleep(30); };
const st = () => { const r = db.sessions.get(`${SID}|${JID}`); return r ? svc.stateOf(r) : null; };
const since = (n) => sent.slice(n).join('\n---\n');
const K = { session_id: SID, chat_id: JID };
const pay = async (chargeId, event = 'charge_paid') => { hooks.emit(event, { orgId: ORG, charge: { id: chargeId, organization_id: ORG, bot_flow_id: FLOW, bot_node_id: 'oc', session_id: SID, chat_id: JID, customer_id: 'cust-owner' } }); await drain(); };

async function orderUntilSummary(payment = '1') {
  await inbound('menu');
  await inbound('1'); // Fazer pedido → catálogo (1 categoria: direto nos produtos)
  await inbound('1'); // X-Burguer
  await inbound('2'); // 2 unidades → carrinho
  await inbound('2'); // finalizar → entrega/retirada
  await inbound('1'); // entrega → endereços salvos
  await inbound('1'); // endereço salvo → campo Tamanho
  await inbound('2'); // M → pagamento
  await inbound(payment); // 1 = PIX, 2 = na entrega → resumo
}

(async () => {
  // ---- A: pedido completo com PIX
  let n = sent.length;
  await inbound('oi');
  await inbound('1');
  ok('A1 catálogo do serviço (1 categoria → produtos direto)', /X-Burguer · R\$ 25,00/.test(since(n)) && st().waiting_for === 'order:product', since(n));
  ok('A2 contexto do fluxo com as definições de campos', cfCalls > 0 && (st().order.cf || []).map((f) => f.key).join() === 'tamanho', st().order);
  await inbound('1');
  await inbound('2');
  await inbound('2');
  n = sent.length;
  await inbound('1');
  ok('A3 endereços salvos do titular (o de cobrança não)', /Rua das Flores, 10/.test(since(n)) && !/Rua do Boleto/.test(since(n)) && st().waiting_for === 'order:address', since(n));
  await inbound('1');
  ok('A4 campo do pedido perguntado', st().waiting_for === 'order:custom', st());
  await inbound('2');
  n = sent.length;
  await inbound('1');
  ok('A5 resumo', /Resumo do pedido/.test(since(n)) && /Total: R\$\s55,00/.test(since(n)) && /\*Tamanho:\* M/.test(since(n)), since(n));
  n = sent.length;
  await inbound('1');
  const cr = calls.filter((c) => c[0] === 'create').pop();
  ok(
    'A6 orders.create: source bot, número+jid, contato, titular, bot{flow,node}, entrega com o endereço salvo, PIX, custom',
    cr && cr[1].source === 'bot' && cr[1].session_id === SID && cr[1].chat_id === JID && cr[1].contact_id === 'C1' && cr[1].customer_id === 'cust-owner' && cr[1].bot.flow_id === FLOW && cr[1].bot.node_id === 'oc' && cr[1].delivery.mode === 'delivery' && cr[1].delivery.address_id === 'ad1' && cr[1].payment_method === 'pix' && cr[1].custom.tamanho === 'M' && cr[1].user_id === null && cr[1].items[0].product_id === 'p1' && cr[1].items[0].qty === 2,
    cr,
  );
  const num = cr ? oSeq : 0;
  ok('A7 cobrança mandada pelo charges.resend + texto "recebido" sem repetir o código', calls.some((c) => c[0] === 'resend' && c[1] === `CH${num}`) && new RegExp(`Pedido \\*#${num}\\* recebido`).test(since(n)) && !/PIXCODE/.test(since(n)) && st().waiting_for === 'charge' && st().charge.id === `CH${num}` && st().charge.sent === true, since(n));
  n = sent.length;
  await pay(`CH${num}`);
  ok('A8 charge_paid → texto de pago + porta "pago" com {{pedido.*}}', new RegExp(`Pagamento do pedido \\*#${num}\\* confirmado`).test(since(n)) && new RegExp(`PAGO pedido ${num}`).test(since(n)), since(n));

  // ---- B: envio da cobrança falhou → o motor manda o código
  resendFail.on = true;
  await orderUntilSummary('1');
  n = sent.length;
  await inbound('1');
  resendFail.on = false;
  ok('B1 resend falhou → o código PIX vai no texto', new RegExp(`PIXCODE${oSeq}`).test(since(n)) && st().charge.sent === false, since(n));

  // ---- C: entrega tardia (cliente saiu do bloco antes de pagar)
  const late = oSeq;
  await inbound('menu');
  n = sent.length;
  await pay(`CH${late}`);
  ok('C1 pago fora de hora → entrega pela porta "pago"', new RegExp(`Pagamento do pedido \\*#${late}\\* confirmado`).test(since(n)) && new RegExp(`PAGO pedido ${late}`).test(since(n)), since(n));

  // ---- D: pedido marcado pago à mão → PIX cancelado (hook charge_canceled) → "pago"
  await orderUntilSummary('1');
  await inbound('1');
  const manual = oSeq;
  odb.get(`O${manual}`).payment_status = 'paid';
  odb.get(`O${manual}`).status = 'confirmed';
  n = sent.length;
  await pay(`CH${manual}`, 'charge_canceled');
  ok('D1 PIX cancelado porque pagou à mão → segue como pago', new RegExp(`PAGO pedido ${manual}`).test(since(n)) && !/EXPIROU/.test(since(n)), since(n));
  // expirou de verdade
  await orderUntilSummary('1');
  await inbound('1');
  const expd = oSeq;
  n = sent.length;
  await pay(`CH${expd}`, 'charge_expired');
  ok('D2 PIX expirou → porta "expirou"', new RegExp(`EXPIROU ${expd}`).test(since(n)), since(n));

  // ---- E: pagar na entrega → porta out; sem cobrança
  await orderUntilSummary('2');
  n = sent.length;
  await inbound('1');
  ok('E1 na entrega → "recebido" + porta out, sem resend', new RegExp(`OUT pedido ${oSeq}`).test(since(n)) && calls.filter((c) => c[0] === 'resend').length === 4, since(n));

  // ---- F: posse e freio (direto no runtime)
  const base = { ...emptyState() };
  const ctxOf = async (state) => svc.ctxFor(ORG, { id: 'chat-uuid', session_id: SID, chat_id: JID, tags: [], name: 'Fulano' }, { typing: false }, { flow: db.flow, def, state });
  let r = await svc.orderAction(ORG, K, FLOW, { type: 'order_catalog', node_id: 'oc' }, { ...base, customer_id: 'cust-seen', __seen: ['cust-seen'] }, await ctxOf(null));
  ok('F1 cliente só visto pelo código → endereços do titular, nunca os dele', r.ok && r.addresses.length === 1 && r.addresses[0].id === 'ad1', r.addresses);
  calls.length = 0;
  await svc.orderAction(ORG, { session_id: SID, chat_id: 'x1@c.us' }, FLOW, { type: 'order_create', node_id: 'oc', items: [{ product_id: 'p1', qty: 1 }], delivery: { mode: 'pickup' }, payment_method: 'on_delivery', notes: null, custom: {} }, { ...base, customer_id: 'cust-seen', __seen: ['cust-seen'] }, await ctxOf(null));
  const cF2 = calls.find((c) => c[0] === 'create');
  ok('F2 visto pelo código → pedido no titular vinculado', cF2 && cF2[1].customer_id === 'cust-owner', cF2);
  calls.length = 0;
  await svc.orderAction(ORG, { session_id: SID, chat_id: 'x2@c.us' }, FLOW, { type: 'order_create', node_id: 'oc', items: [{ product_id: 'p1', qty: 1 }], delivery: { mode: 'pickup' }, payment_method: 'on_delivery', notes: null, custom: {} }, { ...base, customer_id: 'cust-seen', __verified: ['cust-seen'] }, await ctxOf(null));
  const cF3 = calls.find((c) => c[0] === 'create');
  ok('F3 conferido pelo documento → pedido nele', cF3 && cF3[1].customer_id === 'cust-seen', cF3);
  const K3 = { session_id: SID, chat_id: 'freio@c.us' };
  let blocked = null;
  for (let i = 0; i < 6; i++) {
    try { await svc.orderAction(ORG, K3, FLOW, { type: 'order_create', node_id: 'oc', items: [{ product_id: 'p1', qty: 1 }], delivery: { mode: 'pickup' }, payment_method: 'on_delivery', notes: null, custom: {} }, base, await ctxOf(null)); } catch (e) { blocked = { i, e }; }
  }
  ok('F4 6º pedido na mesma hora → recusa amigável', blocked && blocked.i === 5 && blocked.e instanceof BotUserError, blocked && blocked.e.message);

  // ---- G: erros do serviço → textos para o cliente (zera o freio desta conversa: os cenários acima já fizeram 5 pedidos)
  svc.orderHits.clear();
  const tryCreate = async (err) => {
    orderErr.next = err;
    await orderUntilSummary('2');
    const m = sent.length;
    await inbound('1');
    return since(m);
  };
  let t = await tryCreate(new BadRequestException('O pedido mínimo é R$ 50,00.'));
  ok('G1 regra do pedido → mensagem do serviço ao cliente', /pedido mínimo é R\$ 50,00/.test(t), t);
  t = await tryCreate(new BadRequestException('Não foi possível gerar a cobrança do pedido. invalid_token MP 401'));
  ok('G2 falha do gateway → texto amigável (sem detalhe técnico)', /Não consegui gerar o PIX/.test(t) && !/invalid_token/.test(t), t);
  t = await tryCreate(new BadRequestException({ statusCode: 400, code: 'CUSTOM_REQUIRED', fields: [{ key: 'cor', label: 'Cor' }], message: 'Preencha: Cor.' }));
  ok('G3 campo obrigatório faltando → texto citando o campo', /informação obrigatória: Cor/.test(t), t);

  // ---- H: Meus pedidos, contexto e chamados
  n = sent.length;
  await inbound('menu');
  await inbound('2');
  const ofc = calls.filter((c) => c[0] === 'ofContact').pop();
  ok('H1 "Meus pedidos" lista pelo contato + clientes, só em andamento', ofc && ofc[1].contact_id === 'C1' && ofc[1].customer_ids.includes('cust-owner') && ofc[2].open_only === true, ofc);
  ok('H2 lista com os números', /#\d{4} ·/.test(since(n)) && st().waiting_for === 'order:choose', since(n));
  n = sent.length;
  await inbound('1');
  ok('H3 detalhes com o campo visível', /Pedido \*#\d{4}\*/.test(since(n)) && /\*Tamanho:\*/.test(since(n)), since(n));
  const condDef = { nodes: [N('s', 'start'), N('c', 'condition', { rules: [{ source: 'order', key: 'has_open_order', op: 'is', value: 'true' }] })], edges: [E('s', 'out', 'c')] };
  const chat = { id: 'chat-uuid', session_id: SID, chat_id: JID, tags: [], name: 'Fulano' };
  const ctx = await svc.ctxFor(ORG, chat, { typing: false }, { flow: { id: 'F-cond', updated_at: new Date() }, def: condDef, state: null });
  ok('H4 condição de pedido → ctx.orders em andamento', Array.isArray(ctx.orders) && ctx.orders.length > 0 && ctx.orders.every((o) => ['new', 'confirmed', 'preparing', 'out_for_delivery'].includes(o.status)), ctx.orders);
  const ctx2 = await svc.ctxFor(ORG, chat, { typing: false }, { flow: { id: 'F-plain', updated_at: new Date() }, def: { nodes: [N('s', 'start')], edges: [] }, state: null });
  ok('H5 fluxo sem pedidos/campos → não consulta', ctx2.orders === undefined && ctx2.custom_fields === undefined, ctx2);
  await svc.ticketAction(ORG, K, { type: 'ticket_create', node_id: 'ot', category: 'duvida', subject: null, description: 'Teste de campo', priority: null, media_ids: [], custom: { contrato: 123 } }, base);
  ok('H6 chamado leva os campos respondidos', tcalls[0] && tcalls[0].custom && tcalls[0].custom.contrato === 123, tcalls[0]);
  const tk = await svc.botTicket(ORG, { id: 'T1', protocol: '1', status: 'open', custom: { contrato: 123 } }, { contact_id: 'C1', strong: [] }, false);
  ok('H7 "Meus chamados": campo visível formatado', Array.isArray(tk.fields) && tk.fields[0].label === 'Nº do contrato' && tk.fields[0].display === '123', tk);

  console.log(`${pass}/${pass + fail} ${fail ? 'FAIL' : 'PASS'}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('ERRO', e && e.stack); process.exit(1); });
