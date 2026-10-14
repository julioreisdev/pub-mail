// Teste do RUNTIME do bot com blocos de CRM (Fase 2, B2R) com dependências falsas em memória — sem banco,
// sem gateway, sem WhatsApp. Usa o `dist` do back (nest build). Rodar na raiz do repo:
//   node docs/tools/wa_bot_crm_runtime_test.cjs        (BACK_DIR=<pasta do back> se estiver em outro lugar)
// Cobre: cadastro → assinatura → charges.create com bot{flow,node} → hook charge_paid retoma pela porta "pago";
// entrega tardia; expirada fora de hora ignorada; bloco sumido; atendente preservado; posse (assinatura/cliente
// de outra conversa recusados); 2ª via movida para a conversa; fluxo sem CRM sem consultas novas; crm_wait preso.
// + AGENDA (Fase 6): posse dos agendamentos (contato/vinculado/documento × só código), agendar pelo titular, conflito,
//   lista, lista de espera e retomada do pagamento do agendamento (pula se o dist ainda não tem a agenda).
const path = require('path');
const BACK = process.env.BACK_DIR || path.resolve(__dirname, '../../back');
const { WhatsAppBotService } = require(path.join(BACK, 'dist/src/whatsapp/bot/whatsapp-bot.service.js'));
const { WhatsAppHooks } = require(path.join(BACK, 'dist/src/whatsapp/whatsapp-hooks.service.js'));
const { WhatsAppCrmService } = require(path.join(BACK, 'dist/src/whatsapp/whatsapp-crm.service.js'));

let pass = 0, fail = 0;
const ok = (l, c, x) => { if (c) pass++; else { fail++; console.log('FAIL', l, x === undefined ? '' : JSON.stringify(x).slice(0, 600)); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ORG = 'org1', SID = 'S1', JID = '5500999990091@c.us', FLOW = 'F1';
const N = (id, type, data = {}) => ({ id, type, position: { x: 0, y: 0 }, data });
const E = (source, sourceHandle, target) => ({ id: `${source}-${sourceHandle}-${target}`, source, sourceHandle, target });
const def = {
  nodes: [
    N('start', 'start'), N('ident', 'crm_identify', { mode: 'org' }),
    N('menu', 'menu', { text: 'Olá, {{cliente.primeiro_nome}}!', options: [{ id: 'st', label: 'Status' }, { id: 'can', label: 'Cancelar' }, { id: 'inv', label: '2ª via' }] }),
    N('info', 'crm_info', { what: 'status' }), N('can', 'crm_cancel', { ask_reason: false, policy: 'product' }), N('inv', 'crm_invoice', {}),
    N('reg', 'crm_register', { fields: [{ key: 'name' }, { key: 'email', required: false }, { key: 'custom.bairro', label: 'Bairro', required: false }, { key: 'address.city', label: 'Cidade', required: false }] }),
    N('sub', 'crm_subscribe', { product_id: 'choose', method: 'pix', charge_now: true }),
    N('welcome', 'message', { messages: [{ id: 'w', kind: 'text', text: 'Bem-vindo, {{cliente.primeiro_nome}}!' }] }),
    N('end', 'end', { text: 'Tchau', close: true }),
  ],
  edges: [E('start', 'out', 'ident'), E('ident', 'found', 'menu'), E('ident', 'not_found', 'reg'), E('menu', 'opt-st', 'info'), E('menu', 'opt-can', 'can'), E('menu', 'opt-inv', 'inv'), E('info', 'out', 'end'), E('can', 'canceled', 'end'), E('reg', 'done', 'sub'), E('sub', 'paid', 'welcome'), E('welcome', 'out', 'end')],
};
const plainDef = { nodes: [N('s', 'start'), N('m', 'message', { messages: [{ id: 'x', kind: 'text', text: 'Oi {{nome}}' }] })], edges: [E('s', 'out', 'm')] };

// ---------------- estado em memória
const db = {
  flow: { id: FLOW, organization_id: ORG, active: true, definition: def, settings: { audience: { mode: 'all' }, typing: false }, updated_at: new Date() },
  sessions: new Map(), // key chat → row
  customers: new Map(), // id → {id,name,custom,address,status,linked}
  subs: new Map(), // id → {id, customer_id, product_id, product_name, price_cents, status, next_due_at}
  charges: new Map(),
  products: [{ id: 'P1', name: 'Fibra 200', price_cents: 8990, billing: 'monthly', active: true }, { id: 'P2', name: 'Fibra 500', price_cents: 12990, billing: 'monthly', active: true }],
};
const sent = [];
const calls = [];
const bkey = (w) => `${w.organization_id_session_id_chat_id.session_id}|${w.organization_id_session_id_chat_id.chat_id}`;
let rowSeq = 0;
const prisma = {
  whatsapp_bot_flows: { findFirst: async ({ where }) => (where.id === db.flow.id ? db.flow : null) },
  whatsapp_chats: { findUnique: async () => ({ id: 'chat-uuid', organization_id: ORG, session_id: SID, chat_id: JID, kind: 'individual', service_status: db.chatStatus || 'none', tags: [], name: 'Fulano' }) },
  whatsapp_bot_sessions: {
    findUnique: async ({ where }) => db.sessions.get(bkey(where)) || null,
    upsert: async ({ where, create, update }) => { const k = bkey(where); const cur = db.sessions.get(k); const row = cur ? { ...cur, ...update, updated_at: new Date() } : { id: `bs${++rowSeq}`, ...create, updated_at: new Date() }; db.sessions.set(k, row); return row; },
    update: async ({ where, data }) => { for (const [k, v] of db.sessions) if (v.id === where.id) db.sessions.set(k, { ...v, ...data }); return {}; },
  },
  whatsapp_contacts: { findUnique: async () => ({ id: 'C1', name: 'Fulano', phone: '5500999990091', saved: true }) },
  whatsapp_messages: { create: async () => ({}) },
  whatsapp_crm_settings: { findUnique: async () => null },
  whatsapp_products: { findFirst: async ({ where }) => db.products.find((p) => p.id === where.id && p.active) || null },
  whatsapp_charges: { findFirst: async ({ where }) => (where.id ? db.charges.get(where.id) || null : null), update: async ({ where, data }) => { db.charges.set(where.id, { ...db.charges.get(where.id), ...data }); return db.charges.get(where.id); } },
  whatsapp_subscriptions: { findFirst: async ({ where }) => { const s = db.subs.get(where.id); return s && where.organization_id === ORG ? s : null; } },
  whatsapp_customers: { findFirst: async ({ where }) => db.customers.get(where.id) || null },
};
const botCustomerOf = (id) => {
  const c = db.customers.get(id);
  if (!c) throw new Error('404');
  const subs = [...db.subs.values()].filter((s) => s.customer_id === id).map((s) => ({ id: s.id, product_id: s.product_id, product_name: s.product_name, price_cents: s.price_cents, price_label: 'R$ x', billing: 'monthly', status: s.status, next_due_at: s.next_due_at, next_due_label: '', days_overdue: 0, due_day: 10, cancel_at: s.cancel_at || null, paused_until: null }));
  const open = [...db.charges.values()].filter((x) => x.customer_id === id && x.status === 'PENDING').map((x) => ({ id: x.id, amount_cents: x.amount_cents, amount_label: 'R$ x', description: x.description, due_at: '2026-10-12', days_overdue: 0, kind: 'pix', pix_code: 'PIX', boleto_url: null, status: 'PENDING' }));
  return { id, name: c.name, first_name: c.name.split(' ')[0], doc_masked: '', code: '', email: c.email || '', status: subs.some((s) => s.status === 'active') ? 'ok' : 'none', verified: true, custom: c.custom || {}, subscriptions: subs, open_charges: open };
};
const crm = {
  varsForChat: async () => { calls.push('varsForChat'); return { 'cliente.nome': 'Legado' }; },
  botProducts: async () => db.products.map((p) => ({ ...p, description: null, price_label: 'R$ ' + p.price_cents / 100, billing_label: 'Mensal', trial_days: 0, cancel_policy: 'end_of_cycle' })),
  // `verified` como no serviço real: vinculado ao número (linked) OU conferido pelo documento (opts.verified)
  botCustomer: async (_o, id, opts) => ({ ...botCustomerOf(id), verified: Boolean(opts?.verified) || Boolean(db.customers.get(id)?.linked) }),
  botSubscription: (s) => WhatsAppCrmService.prototype.botSubscription.call({}, s, '2026-10-12'),
  createCustomer: async (_o, _u, dto) => { calls.push(['createCustomer', dto]); const id = 'cust' + (db.customers.size + 1); db.customers.set(id, { id, name: dto.name, email: dto.email, custom: dto.custom || {}, address: dto.address || null, linked: true }); return { id }; },
  updateCustomer: async (_o, id, dto) => { calls.push(['updateCustomer', id, dto]); db.customers.set(id, { ...db.customers.get(id), ...dto }); return {}; },
};
const identity = {
  customersOfJid: async () => { calls.push('customersOfJid'); return { contact: { id: 'C1' }, customers: [...db.customers.values()].filter((c) => c.linked).map((c) => ({ customer: c, role: 'owner' })) }; },
  contactOfJid: async () => ({ id: 'C1' }),
  findCustomer: async () => ({ found: [] }),
  ensureLinked: async (...a) => { calls.push(['ensureLinked', ...a]); },
  setRole: async () => undefined,
};
const subscriptions = {
  preview: async () => ({ first_charge: { amount_cents: 5000, due_at: '2026-10-12', description: 'Fibra 200 (proporcional)' } }),
  createSubscription: async (_o, cid, dto, meta) => { calls.push(['createSubscription', cid, dto, meta]); const id = 'sub' + (db.subs.size + 1); const p = db.products.find((x) => x.id === dto.product_id); const s = { id, customer_id: cid, product_id: p.id, product_name: p.name, price_cents: p.price_cents, status: 'active', next_due_at: '2026-11-10' }; db.subs.set(id, s); return { ...s, price_label: 'R$', billing: 'monthly', first_charge: { amount_cents: 5000, due_at: '2026-10-12', description: 'Fibra 200 (proporcional)' } }; },
  cancel: async (_o, id, opts) => { calls.push(['cancel', id, opts]); const s = { ...db.subs.get(id), cancel_at: '2026-11-10' }; db.subs.set(id, s); return { ...s, price_label: 'R$', billing: 'monthly' }; },
  get: async (_o, id) => ({ ...db.subs.get(id), price_label: 'R$', billing: 'monthly' }),
};
let chSeq = 0;
const charges = {
  settings: async () => ({ gateway_ready: true, boleto_available: false }),
  create: async (_o, _u, dto, origin) => { calls.push(['chargesCreate', dto, origin]); const id = 'CH' + ++chSeq; const row = { id, organization_id: ORG, customer_id: dto.customer_id, subscription_id: dto.subscription_id, session_id: dto.session_id, chat_id: dto.chat_id, amount_cents: dto.amount_cents, description: dto.description, due_at: new Date('2026-10-12T00:00:00Z'), status: 'PENDING', pix_code: 'PIXCODE', boleto_url: null, bot_flow_id: dto.bot.flow_id, bot_node_id: dto.bot.node_id }; db.charges.set(id, row); return { id, amount_cents: row.amount_cents, description: row.description, due_at: '2026-10-12', pix: { code: 'PIXCODE' }, boleto: null }; },
  resend: async (_o, id, opts) => { calls.push(['resend', id, opts]); const c = db.charges.get(id); return { id, amount_cents: c.amount_cents, description: c.description, due_at: '2026-10-12', pix: { code: 'PIX2' } }; },
  check: async (_o, id) => ({ status: db.charges.get(id).status }),
};
const hooks = new WhatsAppHooks();
const openwa = { sendText: async (_sid, jid, text) => { sent.push(text); return { messageId: 'm' + sent.length }; }, typing: async () => undefined };
const attendance = { setStatus: async (_o, _k, st) => { calls.push(['setStatus', st]); }, changeTags: async () => undefined, settings: async () => ({ reset_hours: 24 }), expired: () => false };
const sessionsSvc = { rowById: async () => ({ id: SID, openwa_session_id: 'ow1', status: 'ready', bot_flow_id: FLOW }) };
const svc = new WhatsAppBotService(prisma, openwa, {}, { bumpChat: async () => undefined }, { canonicalChatId: async (_o, _s, id) => id }, attendance, { message: () => undefined, tagMap: async () => new Map() }, hooks, { isOrgActive: async () => true }, crm, sessionsSvc, {}, {}, identity, subscriptions, charges);
svc.onModuleInit();
clearInterval(svc.timer);

const inbound = async (body) => { await svc.processInbound({ orgId: ORG, sessionId: SID, chatId: JID, session: null, message: { body, timestamp: new Date(Date.now() + 2000) } }); await drain(); };
const drain = async () => { for (let i = 0; i < 100 && svc.queues.size; i++) await sleep(20); await sleep(20); };
const st = () => { const r = db.sessions.get(`${SID}|${JID}`); return r ? svc.stateOf(r) : null; };
const since = (n) => sent.slice(n).join('\n---\n');

(async () => {
  // ---- A: não é cliente → cadastro → assinar → cobrança criada pelo runtime
  let n = sent.length;
  await inbound('oi');
  ok('A1 não cliente: pergunta o nome (cadastro)', /nome completo/.test(since(n)), sent);
  ok('A1 fluxo com CRM consulta identidade e NÃO chama varsForChat', calls.includes('customersOfJid') && !calls.includes('varsForChat'), calls);
  await inbound('Carlos Souza');
  await inbound('pular');
  await inbound('Centro');
  n = sent.length;
  await inbound('Recife');
  ok('A2 resumo', /Confira seus dados/.test(since(n)) && /Bairro: Centro/.test(since(n)), since(n));
  n = sent.length;
  await inbound('1');
  const cc = calls.find((c) => c[0] === 'createCustomer');
  ok('A3 createCustomer com contact_id/source bot/custom/address', cc && cc[1].contact_id === 'C1' && cc[1].source === 'bot' && cc[1].name === 'Carlos Souza' && cc[1].custom.bairro === 'Centro' && cc[1].address.city === 'Recife' && !cc[1].email, cc);
  ok('A3 cadastro concluído + lista de planos', /Cadastro concluído/.test(since(n)) && /Fibra 500/.test(since(n)), since(n));
  ok('A3 estado: customer_id cust1, esperando crm_subscribe, verificado', st().customer_id === 'cust1' && st().waiting_for === 'crm_subscribe' && (st().__verified || []).includes('cust1'), st());
  await inbound('1');
  n = sent.length;
  await inbound('1');
  const cs = calls.find((c) => c[0] === 'createSubscription');
  ok('A4 createSubscription(source bot, produto P1)', cs && cs[1] === 'cust1' && cs[2].product_id === 'P1' && cs[3].source === 'bot', cs);
  const ch = calls.find((c) => c[0] === 'chargesCreate');
  ok('A4 charges.create com bot{flow,node}, conversa, kind pix, send, origin bot', ch && ch[1].bot.flow_id === FLOW && ch[1].bot.node_id === 'sub' && ch[1].chat_id === JID && ch[1].session_id === SID && ch[1].kind === 'pix' && ch[1].send === true && ch[2] === 'bot' && ch[1].amount_cents === 5000 && ch[1].subscription_id === 'sub1', ch);
  ok('A4 estado esperando a cobrança CH1', st().waiting_for === 'charge' && st().charge?.id === 'CH1' && st().charge?.pix_code === 'PIXCODE', st());
  // "paguei" sem pagar → mensagem
  n = sent.length;
  await inbound('paguei');
  ok('A5 "paguei" sem pagamento → aviso de que ainda não identificou', /Ainda não identifiquei/.test(since(n)) && st().waiting_for === 'charge', since(n));
  // ---- B: hook charge_paid → retoma pela porta "pago"
  n = sent.length;
  db.charges.set('CH1', { ...db.charges.get('CH1'), status: 'PAID' });
  hooks.emit('charge_paid', { orgId: ORG, charge: db.charges.get('CH1') });
  await sleep(50); await drain();
  ok('B charge_paid → paid_text + boas-vindas + fim', /Pagamento confirmado/.test(since(n)) && /Bem-vindo, Carlos/.test(since(n)) && /Tchau/.test(since(n)) && st().status === 'done', since(n));
  // repetido → ignorado como entrega tardia? (conversa não espera) → entrega tardia de novo NÃO deve acontecer duas vezes? (o settle emite 1x; aqui só conferimos o caminho)
  // ---- C: entrega tardia (conversa já terminou) com cobrança CH9 paga
  db.charges.set('CH9', { id: 'CH9', organization_id: ORG, customer_id: 'cust1', subscription_id: 'sub1', session_id: SID, chat_id: JID, amount_cents: 5000, description: 'x', due_at: new Date(), status: 'PAID', bot_flow_id: FLOW, bot_node_id: 'sub' });
  n = sent.length;
  hooks.emit('charge_paid', { orgId: ORG, charge: db.charges.get('CH9') });
  await sleep(50); await drain();
  ok('C entrega tardia: paid_text + boas-vindas', /Pagamento confirmado/.test(since(n)) && /Bem-vindo/.test(since(n)), since(n));
  // expirada fora de hora → nada
  n = sent.length;
  hooks.emit('charge_expired', { orgId: ORG, charge: { ...db.charges.get('CH9'), status: 'EXPIRED' } });
  await sleep(50); await drain();
  ok('C expirada fora de hora → ignorada', sent.length === n, since(n));
  // bloco sumiu → nada enviado (entrega manual)
  n = sent.length;
  hooks.emit('charge_paid', { orgId: ORG, charge: { ...db.charges.get('CH9'), id: 'CH10', bot_node_id: 'nao-existe' } });
  await sleep(50); await drain();
  ok('C bloco inexistente → nada enviado', sent.length === n, since(n));
  // atendente humano → entrega sem encerrar e sem mexer no estado
  db.chatStatus = 'human';
  const before = JSON.stringify(st());
  const statusCalls = calls.filter((c) => c[0] === 'setStatus').length;
  n = sent.length;
  hooks.emit('charge_paid', { orgId: ORG, charge: { ...db.charges.get('CH9'), id: 'CH11' } });
  await sleep(50); await drain();
  ok('C humano: mensagens entregues, sem close/setStatus e estado intacto', /Pagamento confirmado/.test(since(n)) && calls.filter((c) => c[0] === 'setStatus').length === statusCalls && JSON.stringify(st()) === before, { s: since(n) });
  db.chatStatus = 'none';
  // cobrança sem bot_flow_id → ignorada
  n = sent.length;
  hooks.emit('charge_paid', { orgId: ORG, charge: { ...db.charges.get('CH9'), id: 'CH12', bot_flow_id: null } });
  await sleep(50); await drain();
  ok('cobrança manual (sem bot_flow_id) não mexe no bot', sent.length === n);

  // ---- D: cliente identificado → cancelar assinatura de OUTRO cliente é recusado
  db.customers.set('cust2', { id: 'cust2', name: 'Outra Pessoa', linked: false });
  db.subs.set('subX', { id: 'subX', customer_id: 'cust2', product_id: 'P1', product_name: 'Fibra 200', price_cents: 8990, status: 'active', next_due_at: '2026-11-10' });
  const state = { ...svc.stateOf(null), node_id: 'can', status: 'waiting', waiting_for: 'crm_wait', customer_id: 'cust1', crm: { purpose: 'cancel', step: 'action', subscription_id: 'subX' } };
  const ctx = await svc.ctxFor(ORG, await prisma.whatsapp_chats.findUnique(), db.flow.settings, { flow: db.flow, def, state });
  n = sent.length;
  await svc.runCrm(ORG, await sessionsSvc.rowById(), { session_id: SID, chat_id: JID }, FLOW, { type: 'crm_cancel_subscription', subscription_id: 'subX', reason: null, policy: 'product' }, state, ctx, def, 0);
  ok('D assinatura de outro cliente → cancel NÃO chamado, texto de falha', !calls.some((c) => c[0] === 'cancel') && /não consegui concluir/i.test(since(n)), since(n));
  // a própria → chama cancel com source bot
  const st2 = { ...state, crm: { ...state.crm, subscription_id: 'sub1' } };
  n = sent.length;
  await svc.runCrm(ORG, await sessionsSvc.rowById(), { session_id: SID, chat_id: JID }, FLOW, { type: 'crm_cancel_subscription', subscription_id: 'sub1', reason: 'Caro', policy: 'product' }, st2, ctx, def, 0);
  const cancelCall = calls.find((c) => c[0] === 'cancel');
  ok('D própria assinatura → cancel(source bot, motivo) + texto "Cancelado"', cancelCall && cancelCall[1] === 'sub1' && cancelCall[2].source === 'bot' && cancelCall[2].reason === 'Caro' && /Cancelado/.test(since(n)), [cancelCall, since(n)]);
  // cliente de fora da conversa no estado → recusado
  const st3 = { ...state, customer_id: 'cust2', crm: { ...state.crm, subscription_id: 'subX' } };
  const ctx3 = { ...ctx, customer: ctx.customers[0] };
  calls.length = 0;
  await svc.runCrm(ORG, await sessionsSvc.rowById(), { session_id: SID, chat_id: JID }, FLOW, { type: 'crm_cancel_subscription', subscription_id: 'subX', reason: null, policy: 'product' }, st3, ctx3, def, 0);
  ok('D customer_id que não é da conversa → recusado', !calls.some((c) => c[0] === 'cancel'));

  // ---- E: 2ª via sai nesta conversa
  db.charges.set('CH20', { id: 'CH20', organization_id: ORG, customer_id: 'cust1', session_id: 'OUTRO', chat_id: '5511@c.us', status: 'PENDING', amount_cents: 1000, description: 'm' });
  calls.length = 0;
  const st4 = { ...state, node_id: 'inv', crm: { purpose: 'invoice', step: 'action' } };
  await svc.runCrm(ORG, await sessionsSvc.rowById(), { session_id: SID, chat_id: JID }, FLOW, { type: 'crm_send_charge', charge_id: 'CH20', method: 'same' }, st4, ctx, def, 0);
  ok('E 2ª via: cobrança movida para esta conversa + resend', db.charges.get('CH20').session_id === SID && db.charges.get('CH20').chat_id === JID && calls.some((c) => c[0] === 'resend' && c[1] === 'CH20'), calls);

  // ---- F: fluxo sem CRM → varsForChat, sem identidade
  calls.length = 0;
  db.flow = { ...db.flow, id: 'F2', definition: plainDef, updated_at: new Date() };
  sessionsSvc.rowById = async () => ({ id: SID, openwa_session_id: 'ow1', status: 'ready', bot_flow_id: 'F2' });
  svc.sessionCache.clear();
  db.sessions.clear();
  n = sent.length;
  await inbound('oi');
  ok('F fluxo sem CRM: varsForChat, sem customersOfJid', calls.includes('varsForChat') && !calls.includes('customersOfJid') && /Oi Fulano/.test(since(n)), [calls, since(n)]);
  // texto com {{cliente.nome}} (fluxo antigo) → carrega o cliente (o motor sobrescreve cliente.* com o do contexto)
  calls.length = 0;
  db.flow = { ...db.flow, id: 'F3', definition: { ...plainDef, nodes: plainDef.nodes.map((x) => (x.id === 'm' ? N('m', 'message', { messages: [{ id: 'x', kind: 'text', text: 'Oi {{cliente.nome}}' }] }) : x)) }, updated_at: new Date() };
  sessionsSvc.rowById = async () => ({ id: SID, openwa_session_id: 'ow1', status: 'ready', bot_flow_id: 'F3' });
  svc.sessionCache.clear();
  db.sessions.clear();
  n = sent.length;
  await inbound('oi');
  ok('F2 fluxo antigo com {{cliente.nome}} → carrega o cliente (sem varsForChat)', calls.includes('customersOfJid') && !calls.includes('varsForChat') && /Oi Carlos Souza/.test(since(n)), [calls, since(n)]);

  // ---- G: crm_wait preso há > 2 min → recomeça
  db.flow = { ...db.flow, id: FLOW, definition: def, updated_at: new Date() };
  sessionsSvc.rowById = async () => ({ id: SID, openwa_session_id: 'ow1', status: 'ready', bot_flow_id: FLOW });
  svc.sessionCache.clear();
  db.sessions.set(`${SID}|${JID}`, { id: 'bsX', organization_id: ORG, session_id: SID, chat_id: JID, flow_id: FLOW, node_id: 'ident', status: 'waiting', retries: 0, vars: { vars: {}, __waiting_for: 'crm_wait' }, updated_at: new Date(Date.now() - 5 * 60_000) });
  n = sent.length;
  await inbound('oi');
  ok('G crm_wait preso → recomeça (cliente identificado → menu)', /Olá, Carlos/.test(since(n)), since(n));

  // ---- H (revisão 13/10): achado pelo CÓDIGO = só leitura → `__seen`, sem vínculo; escrita exige CPF/vínculo
  identity.findCustomer = async (_o, q) => (q.code === 'CLI-9' ? { found: [{ id: 'cust2' }] } : { found: [] });
  db.sessions.set(`${SID}|${JID}`, { id: 'bsH', organization_id: ORG, session_id: SID, chat_id: JID, flow_id: FLOW, node_id: 'ident', status: 'waiting', retries: 0, vars: { vars: {}, __waiting_for: 'crm_wait', __crm: { purpose: 'identify', step: 'lookup' } }, updated_at: new Date() });
  const stH = st();
  const ctxH = await svc.ctxFor(ORG, await prisma.whatsapp_chats.findUnique(), db.flow.settings, { flow: db.flow, def, state: stH });
  calls.length = 0;
  n = sent.length;
  await svc.runCrm(ORG, await sessionsSvc.rowById(), { session_id: SID, chat_id: JID }, FLOW, { type: 'crm_lookup', by: 'code', value: 'CLI-9' }, stH, ctxH, def, 0);
  await drain();
  ok('H código: cliente vai para __seen (não __verified), sem ensureLinked, e o fluxo segue (menu)', (st().__seen || []).includes('cust2') && !(st().__verified || []).includes('cust2') && !calls.some((c) => c[0] === 'ensureLinked') && st().customer_id === 'cust2' && /Olá, Outra/.test(since(n)), [st(), since(n)]);
  await inbound('2'); // Cancelar → assinatura subX do cust2 → confirmação
  n = sent.length;
  calls.length = 0;
  await inbound('1'); // confirma → runtime recusa: código só consulta
  ok('H escrita com cliente só "visto" → recusa amigável (CPF) e cancel NÃO chamado', /confirme o seu CPF/i.test(since(n)) && !calls.some((c) => c[0] === 'cancel'), [since(n), calls]);
  // o mesmo cliente conferido pelo DOCUMENTO → __verified + ensureLinked
  identity.findCustomer = async (_o, q) => (q.doc ? { found: [{ id: 'cust2' }] } : { found: [] });
  db.sessions.set(`${SID}|${JID}`, { id: 'bsH2', organization_id: ORG, session_id: SID, chat_id: JID, flow_id: FLOW, node_id: 'ident', status: 'waiting', retries: 0, vars: { vars: {}, __waiting_for: 'crm_wait', __crm: { purpose: 'identify', step: 'lookup' } }, updated_at: new Date() });
  const stH2 = st();
  const ctxH2 = await svc.ctxFor(ORG, await prisma.whatsapp_chats.findUnique(), db.flow.settings, { flow: db.flow, def, state: stH2 });
  calls.length = 0;
  await svc.runCrm(ORG, await sessionsSvc.rowById(), { session_id: SID, chat_id: JID }, FLOW, { type: 'crm_lookup', by: 'doc', value: '52998224725' }, stH2, ctxH2, def, 0);
  await drain();
  ok('H documento: __verified + ensureLinked', (st().__verified || []).includes('cust2') && calls.some((c) => c[0] === 'ensureLinked' && c[2] === 'cust2'), [st(), calls]);

  // ---- I (revisão 13/10): cadastro com o número já tendo cliente COM documento diferente → cliente NOVO (another)
  db.customers.set('cust1', { ...db.customers.get('cust1'), doc: '11111111111', code: 'C-1', notes: 'nota da equipe' });
  identity.findCustomer = async () => ({ found: [] });
  db.sessions.set(`${SID}|${JID}`, { id: 'bsI', organization_id: ORG, session_id: SID, chat_id: JID, flow_id: FLOW, node_id: 'reg', status: 'waiting', retries: 0, vars: { vars: {}, __waiting_for: 'crm_wait', __crm: { purpose: 'register', step: 'action' } }, updated_at: new Date() });
  const stI = st();
  const ctxI = await svc.ctxFor(ORG, await prisma.whatsapp_chats.findUnique(), db.flow.settings, { flow: db.flow, def, state: stI });
  calls.length = 0;
  await svc.runCrm(ORG, await sessionsSvc.rowById(), { session_id: SID, chat_id: JID }, FLOW, { type: 'crm_create_customer', fields: { name: 'Beatriz Lima', doc: '52998224725', notes: 'vem do bot' }, link_role: 'owner' }, stI, ctxI, def, 0);
  await drain();
  const ccI = calls.find((c) => c[0] === 'createCustomer');
  ok('I outro documento → createCustomer(another:true), cliente antigo intocado', ccI && ccI[1].another === true && ccI[1].name === 'Beatriz Lima' && !calls.some((c) => c[0] === 'updateCustomer') && db.customers.get('cust1').name === 'Carlos Souza', [ccI, calls]);
  // mesmo documento → atualiza sem tocar em doc/código; notes ACRESCENTADA com carimbo
  db.sessions.set(`${SID}|${JID}`, { id: 'bsI2', organization_id: ORG, session_id: SID, chat_id: JID, flow_id: FLOW, node_id: 'reg', status: 'waiting', retries: 0, vars: { vars: {}, __waiting_for: 'crm_wait', __crm: { purpose: 'register', step: 'action' }, __customer_id: 'cust1' }, updated_at: new Date() });
  const stI2 = st();
  const ctxI2 = await svc.ctxFor(ORG, await prisma.whatsapp_chats.findUnique(), db.flow.settings, { flow: db.flow, def, state: stI2 });
  calls.length = 0;
  await svc.runCrm(ORG, await sessionsSvc.rowById(), { session_id: SID, chat_id: JID }, FLOW, { type: 'crm_create_customer', fields: { name: 'Carlos S. Souza', doc: '11111111111', code: 'X-9', notes: 'vem do bot' }, link_role: 'owner' }, stI2, ctxI2, def, 0);
  await drain();
  const upI = calls.find((c) => c[0] === 'updateCustomer');
  ok('I mesmo documento → updateCustomer sem doc/code, notes acrescentada com carimbo [bot …]', upI && upI[1] === 'cust1' && upI[2].doc === undefined && upI[2].code === undefined && /^nota da equipe\n\[bot \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}\] vem do bot$/.test(upI[2].notes) && !calls.some((c) => c[0] === 'createCustomer'), [upI, calls]);


  // ================================================================ AGENDA (Fase 6) — segurança e retomada do pagamento
  // Só roda com o `dist` que já tem os blocos de agenda (nest build depois da Fase 6); senão avisa e pula.
  if (!require('fs').existsSync(path.join(BACK, 'dist/src/whatsapp/bot/wa-bot-booking.runtime.js'))) {
    console.log('SKIP agenda: dist sem wa-bot-booking.runtime.js (rode o nest build)');
  } else {
    const { ConflictException } = require(path.join(BACK, 'node_modules/@nestjs/common'));
    const SVC = { id: 'svc-1', name: 'Corte', price_cents: 5000, price_label: 'R$ 50,00', duration_minutes: 30, duration_label: '30 min', booking: { payment: 'on_booking' }, resources: [{ id: 'res-1', name: 'Ana' }] };
    const TAKEN = '2026-10-20T13:00:00.000Z';
    const appts = new Map();
    const mkAppt = (id, o = {}) => ({ id, status: 'booked', payment: 'on_site', starts_at: '2026-10-21T13:00:00.000Z', date_label: 'qua 21/10', time_label: '10:00', resource: { id: 'res-1', name: 'Ana' }, product_id: 'svc-1', service_name: 'Corte', price_cents: 5000, can_cancel_free: true, can_reschedule: true, contact_id: null, customer: null, session_id: SID, jid: null, ...o });
    appts.set('ap-contact', mkAppt('ap-contact', { contact_id: 'C1' })); // do contato desta conversa
    appts.set('ap-linked', mkAppt('ap-linked', { customer: { id: 'cust1', name: 'Carlos' } })); // do cliente vinculado (cust1)
    appts.set('ap-seen', mkAppt('ap-seen', { customer: { id: 'cust2', name: 'Outra' } })); // de cliente só "visto" (código)
    appts.set('ap-other', mkAppt('ap-other', { contact_id: 'C9', customer: { id: 'cust9', name: 'Estranho' }, session_id: 'S9', jid: '5500000000000@c.us' }));
    const schedCalls = [];
    const sched = {
      services: async () => [SVC],
      resourcesFor: async () => SVC.resources,
      availability: async (_o, q) => { schedCalls.push(['availability', q]); return [{ date: '2026-10-20', label: 'ter 20/10', slots: [{ starts_at: TAKEN, time_label: '10:00', resource_id: 'res-1', resource_name: 'Ana', left: 1 }] }]; },
      book: async (_o, input) => {
        schedCalls.push(['book', input]);
        if (input.starts_at === TAKEN) throw new ConflictException({ message: 'Horário ocupado', code: 'SLOT_TAKEN' });
        const ap = mkAppt('ap-new', { status: 'pending_payment', contact_id: input.contact_id, customer: input.customer_id ? { id: input.customer_id } : null, charge: { id: 'CHA', status: 'PENDING', pix_code: 'PIXAG', pay_link: null } });
        appts.set('ap-new', ap);
        db.charges.set('CHA', { id: 'CHA', organization_id: ORG, customer_id: input.customer_id || null, session_id: SID, chat_id: JID, amount_cents: 5000, description: 'Corte', status: 'PENDING', bot_flow_id: input.bot.flow_id, bot_node_id: input.bot.node_id });
        return { appointment: ap, charge: { id: 'CHA', amount_cents: 5000, description: 'Corte · qua 21/10 10:00', due_at: '2026-10-12', pix: { code: 'PIXAG' } } };
      },
      get: async (_o, id) => { const a = appts.get(id); if (!a) { const e = new Error('404'); e.status = 404; throw e; } return a; },
      belongsTo: async (_o, id, who) => { const a = appts.get(id); return Boolean(a && ((who.contact_id && a.contact_id === who.contact_id) || (a.customer?.id && (who.customer_ids || []).includes(a.customer.id)))); },
      upcomingOf: async (_o, q) => { schedCalls.push(['upcomingOf', q]); return [...appts.values()].filter((a) => (q.contact_id && a.contact_id === q.contact_id) || (q.customer_id && a.customer?.id === q.customer_id)); },
      confirm: async (_o, id) => ({ ...appts.get(id), status: 'confirmed' }),
      cancel: async (_o, id, opts) => { schedCalls.push(['cancel', id, opts]); return { ...appts.get(id), status: 'canceled' }; },
      reschedule: async (_o, id, opts) => { schedCalls.push(['reschedule', id, opts]); return { ...appts.get(id), starts_at: opts.starts_at }; },
      waitlistJoin: async (_o, input) => { schedCalls.push(['waitlistJoin', input]); return { id: 'wl1' }; },
    };
    prisma.whatsapp_appointments = { findFirst: async ({ where }) => ([...appts.values()].find((a) => a.charge?.id === where.charge_id) || null) };
    const svcB = new WhatsAppBotService(prisma, openwa, {}, { bumpChat: async () => undefined }, { canonicalChatId: async (_o, _s, id) => id }, attendance, { message: () => undefined, tagMap: async () => new Map() }, hooks, { isOrgActive: async () => true }, crm, sessionsSvc, {}, {}, identity, subscriptions, charges, sched);
    const KB = { session_id: SID, chat_id: JID };
    const base = (o = {}) => ({ ...svcB.stateOf(null), node_id: 'BK', status: 'waiting', waiting_for: 'book:wait', ...o });
    identity.customersOfJid = async () => ({ contact: { id: 'C1' }, customers: [{ customer: { id: 'cust1' }, role: 'owner' }] });
    const tryAct = async (a, st) => { try { return await svcB.bookAction(ORG, KB, FLOW, a, st); } catch (e) { return { thrown: e }; } };

    // posse dos agendamentos
    let r = await tryAct({ type: 'appt_cancel', id: 'ap-other', reason: null }, base());
    ok('AG1 cancelar agendamento de outro contato/cliente → recusado (404) e cancel NÃO chamado', r.thrown && /não encontrado/i.test(r.thrown.message) && !schedCalls.some((c) => c[0] === 'cancel'), r);
    r = await tryAct({ type: 'appt_cancel', id: 'ap-seen', reason: null }, base({ __seen: ['cust2'] }));
    ok('AG2 cliente só visto pelo código NÃO cancela (pede CPF)', r.thrown && /confirme o seu CPF/i.test(r.thrown.message) && !schedCalls.some((c) => c[0] === 'cancel'), r);
    r = await tryAct({ type: 'book_reschedule', appointment_id: 'ap-seen', starts_at: TAKEN, resource_id: null }, base({ __seen: ['cust2'] }));
    ok('AG2 cliente só visto pelo código NÃO remarca', r.thrown && /confirme o seu CPF/i.test(r.thrown.message) && !schedCalls.some((c) => c[0] === 'reschedule'), r);
    r = await tryAct({ type: 'appt_confirm', id: 'ap-seen' }, base({ __seen: ['cust2'] }));
    ok('AG2 cliente só visto pode confirmar presença (leitura)', r.ok === true && r.appointment.status === 'confirmed', r);
    r = await tryAct({ type: 'appt_cancel', id: 'ap-seen', reason: null }, base({ __verified: ['cust2'] }));
    ok('AG3 mesmo cliente conferido pelo documento → cancela', r.ok === true && schedCalls.some((c) => c[0] === 'cancel' && c[1] === 'ap-seen' && c[2].by === 'customer'), r);
    r = await tryAct({ type: 'appt_cancel', id: 'ap-contact', reason: null }, base());
    ok('AG4 agendamento do contato desta conversa → cancela (motivo padrão)', r.ok === true && schedCalls.some((c) => c[0] === 'cancel' && c[1] === 'ap-contact' && /WhatsApp/.test(c[2].reason)), r);
    r = await tryAct({ type: 'book_reschedule', appointment_id: 'ap-linked', starts_at: '2026-10-22T13:00:00.000Z', resource_id: 'res-1' }, base());
    ok('AG5 agendamento do cliente vinculado ao número → remarca (by customer)', r.ok === true && schedCalls.some((c) => c[0] === 'reschedule' && c[1] === 'ap-linked' && c[2].by === 'customer' && c[2].resource_id === 'res-1'), r);
    // agendar
    r = await tryAct({ type: 'book_create', product_id: 'svc-1', resource_id: null, starts_at: '2026-10-21T13:00:00.000Z', node_id: 'BK' }, base({ customer_id: 'cust2', __seen: ['cust2'] }));
    ok('AG6 cliente só visto pelo código não agenda no cadastro dele', r.thrown && /confirme o seu CPF/i.test(r.thrown.message) && !schedCalls.some((c) => c[0] === 'book'), r);
    r = await tryAct({ type: 'book_create', product_id: 'svc-1', resource_id: null, starts_at: '2026-10-21T13:00:00.000Z', node_id: 'BK' }, base());
    const bk = schedCalls.find((c) => c[0] === 'book');
    ok('AG7 agenda pelo titular vinculado + contato + conversa + bot{flow,node} + source bot', bk && bk[1].customer_id === 'cust1' && bk[1].contact_id === 'C1' && bk[1].chat_id === JID && bk[1].session_id === SID && bk[1].source === 'bot' && bk[1].bot.flow_id === FLOW && bk[1].bot.node_id === 'BK' && !('resource_id' in bk[1]), bk);
    ok('AG7 resultado com agendamento e cobrança (PIX)', r.ok === true && r.appointment.id === 'ap-new' && r.charge?.id === 'CHA' && r.charge.pix_code === 'PIXAG', r);
    // conflito → código no payload (via runBook) e o motor oferece de novo
    const defBK = { nodes: [N('start', 'start'), N('BK', 'book_service', { resource: 'auto' }), N('ok', 'end', { text: 'FIM-OK', close: false })], edges: [E('start', 'out', 'BK'), E('BK', 'booked', 'ok')] };
    const stBK = base({ book: { mode: 'book', step: 'create', service: { id: 'svc-1', name: 'Corte', price_cents: 5000 }, date: '2026-10-20', slot: { starts_at: TAKEN, resource_id: 'res-1' } } });
    const ctxBK = { contact: { name: 'Fulano' }, chatTagIds: [], now: new Date('2026-10-12T15:00:00Z'), settings: { typing: false } };
    let n0 = sent.length;
    db.sessions.set(`${SID}|${JID}`, { id: 'bsBK', organization_id: ORG, session_id: SID, chat_id: JID, flow_id: FLOW, node_id: 'BK', status: 'waiting', retries: 0, vars: { vars: {}, __waiting_for: 'book:wait' }, updated_at: new Date() });
    await svcB.runBook(ORG, await sessionsSvc.rowById(), KB, FLOW, { type: 'book_create', product_id: 'svc-1', resource_id: null, starts_at: TAKEN, node_id: 'BK' }, stBK, ctxBK, defBK, 0);
    ok('AG8 SLOT_TAKEN → aviso + nova busca de horários do mesmo dia', /acabou de ser reservado/.test(sent.slice(n0).join('\n')) && schedCalls.filter((c) => c[0] === 'availability').some((c) => c[1].from === '2026-10-20'), sent.slice(n0));
    // lista de agendamentos: contato + clientes (vinculado, conferido, visto)
    r = await tryAct({ type: 'appt_list' }, base({ __seen: ['cust2'] }));
    ok('AG9 lista = contato + cliente vinculado + visto (sem os de outros)', r.ok && ['ap-contact', 'ap-linked', 'ap-seen'].every((id) => r.appointments.some((a) => a.id === id)) && !r.appointments.some((a) => a.id === 'ap-other'), r.appointments?.map((a) => a.id));
    // lista de espera
    r = await tryAct({ type: 'waitlist_join', product_id: 'svc-1', resource_id: null, period: 'afternoon', date_from: '2026-10-12', date_to: '2026-10-25' }, base({ customer_id: 'cust2', __seen: ['cust2'] }));
    const wl = schedCalls.find((c) => c[0] === 'waitlistJoin');
    ok('AG10 lista de espera: contato sempre; cliente só visto não entra (fica pelo contato/titular)', r.ok && wl && wl[1].contact_id === 'C1' && wl[1].customer_id !== 'cust2' && wl[1].period === 'afternoon', wl);
    // retomada: agendamento esperando a cobrança CHA → hook charge_paid → texto de pago + porta booked
    const stPay = { ...svcB.stateOf(null), node_id: 'BK', status: 'waiting', waiting_for: 'charge', charge: { id: 'CHA', amount_cents: 5000, description: 'Corte', due_at: null }, book: { mode: 'book', step: 'create', service: { id: 'svc-1', name: 'Corte', price_cents: 5000 } } };
    db.flow = { ...db.flow, id: FLOW, definition: defBK, updated_at: new Date() };
    sessionsSvc.rowById = async () => ({ id: SID, openwa_session_id: 'ow1', status: 'ready', bot_flow_id: FLOW });
    svcB.sessionCache?.clear?.();
    await svcB.persist(ORG, KB, FLOW, stPay);
    n0 = sent.length;
    // direto no handler do svcB (o `svc` dos testes anteriores também ouve o hook — evitar entrega em dobro no teste)
    svcB.onChargeHook({ orgId: ORG, charge: { ...db.charges.get('CHA'), status: 'PAID' } }, 'charge_paid');
    await sleep(80);
    for (let i = 0; i < 100 && (svc.queues.size || svcB.queues.size); i++) await sleep(20);
    const paidTxt = sent.slice(n0).join('\n');
    ok('AG11 charge_paid do agendamento → "Pagamento confirmado … Corte" + porta booked', /Pagamento confirmado ✅ Seu horário está garantido: \*Corte\*/.test(paidTxt) && /FIM-OK/.test(paidTxt), sent.slice(n0));
  }

  console.log(`${pass}/${pass + fail} PASS`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
