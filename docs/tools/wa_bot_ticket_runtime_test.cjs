// Teste do RUNTIME do bot com os blocos de CHAMADOS (Fase 6B, contrato §10.5) com dependências falsas em memória —
// sem banco, sem WhatsApp. Usa o `dist` do back (nest build). Rodar na raiz do repo:
//   node docs/tools/wa_bot_ticket_runtime_test.cjs        (DIST_DIR=<pasta dist> se estiver em outro lugar)
// Cobre: abrir chamado pela conversa (categorias do serviço → descrição → FOTO recebida na mensagem → "pronto") →
// `tickets.create` com source bot + número/jid da conversa + contato + titular vinculado + media_ids; "Meus chamados" →
// lista com `can_add_info` → juntar informação (`customerMessage` by bot); posse: cliente só visto pelo código lê mas
// não junta informação (recusa amigável), chamado de outra pessoa = 404 e o protocolo dele "não existe"; freio de
// 5 chamados/h por conversa; chamados em andamento no contexto quando o fluxo usa a condição de chamado.
const path = require('path');
const DIST = process.env.DIST_DIR || path.resolve(__dirname, '../../back/dist');
const { WhatsAppBotService, BotUserError } = require(path.join(DIST, 'src/whatsapp/bot/whatsapp-bot.service.js'));
const { WhatsAppHooks } = require(path.join(DIST, 'src/whatsapp/whatsapp-hooks.service.js'));
const { emptyState } = require(path.join(DIST, 'src/whatsapp/bot/wa-bot.engine.js'));

let pass = 0, fail = 0;
const ok = (l, c, x) => { if (c) pass++; else { fail++; console.log('FAIL', l, x === undefined ? '' : JSON.stringify(x).slice(0, 600)); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ORG = 'org1', SID = 'S1', JID = '5500999990092@c.us', FLOW = 'F1';
const N = (id, type, data = {}) => ({ id, type, position: { x: 0, y: 0 }, data });
const E = (source, sourceHandle, target) => ({ id: `${source}-${sourceHandle}-${target}`, source, sourceHandle, target });
const def = {
  nodes: [
    N('start', 'start'),
    N('menu', 'menu', { text: 'Como posso ajudar?', options: [{ id: 'abrir', label: 'Abrir chamado' }, { id: 'meus', label: 'Meus chamados' }] }),
    N('ot', 'open_ticket', { category: 'ask', ask_photo: true, priority: 'high' }),
    N('mt', 'my_tickets', { show: 'active', allow_add_info: true }),
    N('after', 'message', { messages: [{ id: 'a', kind: 'text', text: 'Seu protocolo é {{chamado.protocolo}}' }] }),
    N('end', 'end', { text: 'Tchau', close: true }),
  ],
  edges: [E('start', 'out', 'menu'), E('menu', 'opt-abrir', 'ot'), E('menu', 'opt-meus', 'mt'), E('ot', 'out', 'after'), E('after', 'out', 'end'), E('mt', 'out', 'end'), E('mt', 'none', 'end')],
};

// ---------------- estado em memória
const db = { flow: { id: FLOW, organization_id: ORG, active: true, definition: def, settings: { audience: { mode: 'all' }, typing: false }, updated_at: new Date() }, sessions: new Map() };
const sent = [];
const tcalls = [];
const bkey = (w) => `${w.organization_id_session_id_chat_id.session_id}|${w.organization_id_session_id_chat_id.chat_id}`;
let rowSeq = 0;
const prisma = {
  whatsapp_bot_flows: { findFirst: async ({ where }) => (where.id === db.flow.id ? db.flow : null) },
  whatsapp_chats: { findUnique: async () => ({ id: 'chat-uuid', organization_id: ORG, session_id: SID, chat_id: JID, kind: 'individual', service_status: 'none', tags: [], name: 'Fulano' }) },
  whatsapp_bot_sessions: {
    findUnique: async ({ where }) => db.sessions.get(bkey(where)) || null,
    upsert: async ({ where, create, update }) => { const k = bkey(where); const cur = db.sessions.get(k); const row = cur ? { ...cur, ...update, updated_at: new Date() } : { id: `bs${++rowSeq}`, ...create, updated_at: new Date() }; db.sessions.set(k, row); return row; },
    update: async ({ where, data }) => { for (const [k, v] of db.sessions) if (v.id === where.id) db.sessions.set(k, { ...v, ...data }); return {}; },
  },
  whatsapp_contacts: { findUnique: async () => ({ id: 'C1', name: 'Fulano', phone: '5500999990092', saved: true }) },
  whatsapp_messages: { create: async () => ({}) },
  whatsapp_crm_settings: { findUnique: async () => null },
};
// ---------------- chamados falsos (formato do WhatsAppTicketsService.shape)
const tdb = new Map();
let tSeq = 40;
const shape = (t) => ({ status_label_customer: { open: 'Aberto', pending: 'Aguardando você', resolved: 'Resolvido', closed: 'Encerrado' }[t.status], category_label: t.category === 'problema' ? 'Problema' : 'Dúvida', priority_label: 'Alta', sla_label: '20/10 às 18:00', sla_relative: 'em 24 h', media_ids: [], ...t });
const mine = (t, who) => Boolean((who.contact_id && t.contact_id === who.contact_id) || (t.customer?.id && (who.customer_ids || []).includes(t.customer.id)));
tdb.set('T-own', shape({ id: 'T-own', protocol: '2026000010', status: 'pending', category: 'problema', contact_id: 'C1', customer: { id: 'cust-owner' } }));
tdb.set('T-seen', shape({ id: 'T-seen', protocol: '2026000011', status: 'open', category: 'duvida', contact_id: 'C-outro', customer: { id: 'cust-seen' } }));
tdb.set('T-alheio', shape({ id: 'T-alheio', protocol: '2026000012', status: 'open', category: 'duvida', contact_id: 'C-outro', customer: { id: 'cust-outro' } }));
const tickets = {
  settings: async () => ({ categories: [{ key: 'duvida', label: 'Dúvida', active: true }, { key: 'problema', label: 'Problema', active: true }, { key: 'velha', label: 'Velha', active: false }] }),
  create: async (_o, input) => { tcalls.push(['create', input]); const id = `T${++tSeq}`; const t = shape({ id, protocol: `20260000${tSeq}`, status: 'open', category: input.category, contact_id: input.contact_id || null, customer: input.customer_id ? { id: input.customer_id } : null, media_ids: input.media_ids || [] }); tdb.set(id, t); return t; },
  ofContact: async (_o, who, opts) => { tcalls.push(['ofContact', who, opts]); return [...tdb.values()].filter((t) => mine(t, who) && (!opts?.active_only || ['open', 'pending'].includes(t.status))).slice(0, opts?.limit || 5); },
  byProtocol: async (_o, p, who) => { const t = [...tdb.values()].find((x) => x.protocol === p); return t && mine(t, who) ? t : null; },
  belongsTo: async (_o, id, who) => { const t = tdb.get(id); return Boolean(t && mine(t, who)); },
  customerMessage: async (_o, id, input, by) => { tcalls.push(['msg', id, input, by]); const t = tdb.get(id); if (t.status === 'closed') return { ok: false, reason: 'closed', ticket: t }; const n = { ...t, status: 'open', status_label_customer: 'Aberto' }; tdb.set(id, n); return { ok: true, ticket: n }; },
  lastPublicUpdate: async (_o, id) => (id === 'T-own' ? { body: 'Pode mandar uma foto?', at: new Date() } : null),
};
const identity = {
  customersOfJid: async () => ({ contact: { id: 'C1' }, customers: [{ customer: { id: 'cust-user' }, role: 'user' }, { customer: { id: 'cust-owner' }, role: 'owner' }] }),
  contactOfJid: async () => ({ id: 'C1' }),
  findCustomer: async () => ({ found: [] }),
  ensureLinked: async () => undefined,
};
const crm = { varsForChat: async () => ({}), botProducts: async () => [], botCustomer: async () => { throw new Error('sem cliente'); } };
const hooks = new WhatsAppHooks();
const openwa = { sendText: async (_sid, _jid, text) => { sent.push(text); return { messageId: 'm' + sent.length }; }, typing: async () => undefined };
const attendance = { setStatus: async () => undefined, changeTags: async () => undefined, settings: async () => ({ reset_hours: 24 }), expired: () => false };
const sessionsSvc = { rowById: async () => ({ id: SID, openwa_session_id: 'ow1', status: 'ready', bot_flow_id: FLOW }) };
const svc = new WhatsAppBotService(prisma, openwa, {}, { bumpChat: async () => undefined }, { canonicalChatId: async (_o, _s, id) => id }, attendance, { message: () => undefined, tagMap: async () => new Map() }, hooks, { isOrgActive: async () => true }, crm, sessionsSvc, {}, {}, identity, {}, {}, undefined, tickets);
svc.onModuleInit();
clearInterval(svc.timer);

const inbound = async (body, extra = {}) => { await svc.processInbound({ orgId: ORG, sessionId: SID, chatId: JID, session: null, message: { body, timestamp: new Date(Date.now() + 2000), type: 'chat', ...extra } }); await drain(); };
const drain = async () => { for (let i = 0; i < 100 && svc.queues.size; i++) await sleep(20); await sleep(20); };
const st = () => { const r = db.sessions.get(`${SID}|${JID}`); return r ? svc.stateOf(r) : null; };
const since = (n) => sent.slice(n).join('\n---\n');
const K = { session_id: SID, chat_id: JID };

(async () => {
  // ---- A: abrir chamado pela conversa
  let n = sent.length;
  await inbound('oi');
  ok('A1 menu', /Como posso ajudar/.test(since(n)), sent);
  n = sent.length;
  await inbound('1');
  ok('A2 categorias do serviço (só ativas)', /Dúvida/.test(since(n)) && /Problema/.test(since(n)) && !/Velha/.test(since(n)) && st().waiting_for === 'ticket:category', since(n));
  await inbound('2');
  ok('A3 pede a descrição', st().waiting_for === 'ticket:description', st());
  await inbound('O sinal some toda noite depois das 22h');
  ok('A4 pede fotos', st().waiting_for === 'ticket:photo', st());
  n = sent.length;
  await inbound('', { type: 'image', media_id: 'MED1' });
  ok('A5 foto da mensagem chega ao motor', /Recebi ✅ \(1 de 3\)/.test(since(n)) && (st().ticket.media_ids || []).join() === 'MED1', since(n));
  n = sent.length;
  await inbound('', { type: 'image', media_id: null });
  ok('A6 foto que não baixou → pede de novo', /Não consegui receber/.test(since(n)), since(n));
  n = sent.length;
  await inbound('pronto');
  const cr = tcalls.find((c) => c[0] === 'create');
  ok('A7 tickets.create: source bot, número + jid, contato, titular vinculado, prioridade, anexos', cr && cr[1].source === 'bot' && cr[1].session_id === SID && cr[1].chat_id === JID && cr[1].contact_id === 'C1' && cr[1].customer_id === 'cust-owner' && cr[1].category === 'problema' && cr[1].priority === 'high' && cr[1].media_ids.join() === 'MED1' && cr[1].user_id === null && /22h/.test(cr[1].description), cr);
  ok('A8 protocolo dito + {{chamado.protocolo}} no bloco seguinte', /Protocolo: \*202600004\d\*/.test(since(n)) && /Seu protocolo é 202600004\d/.test(since(n)), since(n));

  // ---- B: meus chamados → juntar informação
  n = sent.length;
  await inbound('menu');
  await inbound('2');
  ok('B1 lista os chamados do contato (não os alheios)', /2026000010/.test(since(n)) && !/2026000012/.test(since(n)) && !/2026000011/.test(since(n)) && st().waiting_for === 'ticket:choose', since(n));
  const ofc = tcalls.filter((c) => c[0] === 'ofContact').pop();
  ok('B2 lista pelo contato + clientes vinculados, só em andamento', ofc && ofc[1].contact_id === 'C1' && ofc[1].customer_ids.includes('cust-owner') && ofc[2].active_only === true, ofc);
  n = sent.length;
  await inbound('2026000010');
  ok('B3 protocolo digitado → detalhes com a última atualização + "enviar mais"', /Aguardando você/.test(since(n)) && /Pode mandar uma foto/.test(since(n)) && /Enviar mais informações/.test(since(n)), since(n));
  await inbound('1');
  n = sent.length;
  await inbound('Reiniciei o roteador e continua', { type: 'image', media_id: 'MED2' });
  const msg = tcalls.find((c) => c[0] === 'msg');
  ok('B4 customerMessage by bot com texto e foto', msg && msg[1] === 'T-own' && msg[2].body === 'Reiniciei o roteador e continua' && msg[2].media_id === 'MED2' && msg[3].by === 'bot', msg);
  ok('B5 confirmação ao cliente', /Juntei sua mensagem ao protocolo \*2026000010\*/.test(since(n)), since(n));
  n = sent.length;
  await inbound('menu');
  await inbound('2');
  await inbound('2026000012');
  ok('B6 protocolo de outra pessoa → "não encontrei"', /Não encontrei esse protocolo/.test(since(n)), since(n));

  // ---- C: posse (direto no runtime)
  const base = { ...emptyState() };
  let r = await svc.ticketAction(ORG, K, { type: 'ticket_list', show: 'active', limit: 5 }, { ...base, __seen: ['cust-seen'] });
  const seenT = (r.tickets || []).find((t) => t.id === 'T-seen');
  const ownT = (r.tickets || []).find((t) => t.id === 'T-own');
  ok('C1 cliente visto pelo código: lista o chamado dele como só leitura', seenT && seenT.can_add_info === false && ownT && ownT.can_add_info !== false, r.tickets);
  let err = null;
  try { await svc.ticketAction(ORG, K, { type: 'ticket_add_info', id: 'T-seen', body: 'oi', media_id: null }, { ...base, __seen: ['cust-seen'] }); } catch (e) { err = e; }
  ok('C2 só código → recusa amigável pedindo o CPF', err instanceof BotUserError && /CPF\/CNPJ/.test(err.message), err && err.message);
  err = null;
  try { await svc.ticketAction(ORG, K, { type: 'ticket_add_info', id: 'T-alheio', body: 'oi', media_id: null }, base); } catch (e) { err = e; }
  ok('C3 chamado de outra pessoa → 404', err && err.status === 404, err && err.message);
  r = await svc.ticketAction(ORG, K, { type: 'ticket_add_info', id: 'T-seen', body: 'oi', media_id: null }, { ...base, __verified: ['cust-seen'] });
  ok('C4 conferido pelo documento → junta a informação', r.ok === true, r);
  r = await svc.ticketAction(ORG, K, { type: 'ticket_lookup', protocol: '2026000012' }, base);
  ok('C5 consulta de protocolo alheio → ticket null (não revela)', r.ok === true && r.ticket === null, r);
  tdb.set('T-closed', shape({ id: 'T-closed', protocol: '2026000013', status: 'closed', category: 'duvida', contact_id: 'C1', customer: null }));
  r = await svc.ticketAction(ORG, K, { type: 'ticket_add_info', id: 'T-closed', body: 'oi', media_id: null }, base);
  ok('C6 chamado encerrado → code CLOSED', r.ok === false && r.code === 'CLOSED', r);
  // cliente só visto pelo código não recebe o chamado no cadastro (fica no titular vinculado)
  tcalls.length = 0;
  await svc.ticketAction(ORG, { session_id: SID, chat_id: 'outro@c.us' }, { type: 'ticket_create', node_id: 'ot', category: 'duvida', subject: null, description: 'Teste de posse', priority: null, media_ids: [] }, { ...base, customer_id: 'cust-seen', __seen: ['cust-seen'] });
  ok('C7 cliente só visto pelo código → chamado no titular vinculado, não no visto', tcalls[0] && tcalls[0][1].customer_id === 'cust-owner', tcalls[0]);
  tcalls.length = 0;
  await svc.ticketAction(ORG, { session_id: SID, chat_id: 'outro2@c.us' }, { type: 'ticket_create', node_id: 'ot', category: 'duvida', subject: null, description: 'Teste de posse', priority: null, media_ids: [] }, { ...base, customer_id: 'cust-user' });
  ok('C8 cliente identificado e vinculado → chamado nele', tcalls[0] && tcalls[0][1].customer_id === 'cust-user', tcalls[0]);

  // ---- D: freio de 5 chamados/h por conversa
  const K3 = { session_id: SID, chat_id: 'freio@c.us' };
  let blocked = null;
  for (let i = 0; i < 6; i++) {
    try { await svc.ticketAction(ORG, K3, { type: 'ticket_create', node_id: 'ot', category: 'duvida', subject: null, description: `Chamado ${i}`, priority: null, media_ids: [] }, base); } catch (e) { blocked = { i, e }; }
  }
  ok('D1 6º chamado na mesma hora → recusa amigável', blocked && blocked.i === 5 && blocked.e instanceof BotUserError, blocked && blocked.e.message);

  // ---- E: chamados em andamento no contexto (condição de chamado)
  const condDef = { nodes: [N('s', 'start'), N('c', 'condition', { rules: [{ source: 'ticket', key: 'has_open', op: 'is', value: 'true' }] })], edges: [E('s', 'out', 'c')] };
  const chat = { id: 'chat-uuid', session_id: SID, chat_id: JID, tags: [], name: 'Fulano' };
  const ctx = await svc.ctxFor(ORG, chat, { typing: false }, { flow: { id: 'F-cond', updated_at: new Date() }, def: condDef, state: null });
  ok('E1 fluxo com condição de chamado → ctx.tickets em andamento', Array.isArray(ctx.tickets) && ctx.tickets.some((t) => t.id === 'T-own') && !ctx.tickets.some((t) => t.id === 'T-closed'), ctx.tickets);
  const ctx2 = await svc.ctxFor(ORG, chat, { typing: false }, { flow: { id: 'F-plain', updated_at: new Date() }, def: { nodes: [N('s', 'start')], edges: [] }, state: null });
  ok('E2 fluxo sem chamados → não consulta', ctx2.tickets === undefined, ctx2.tickets);

  console.log(`${pass}/${pass + fail} ${fail ? 'FAIL' : 'PASS'}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('ERRO', e && e.stack); process.exit(1); });
