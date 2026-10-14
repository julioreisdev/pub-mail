#!/usr/bin/env node
// Teste em Node do motor PURO do Fluxo do Bot (wa-bot.engine.ts) — blocos básicos + blocos de CRM (Fase 2)
// + blocos de agenda (Fase 6: book_service, my_appointments, waitlist_join).
//
// Compilar o motor (CommonJS) antes:
//   cd back && npx tsc src/whatsapp/bot/wa-bot.engine.ts src/whatsapp/wa-doc.util.ts src/whatsapp/wa-custom-fields.util.ts \
//     --outDir /tmp/wa-engine --module commonjs --target es2022 --moduleResolution node --esModuleInterop --skipLibCheck --strictNullChecks
// Rodar:
//   ENGINE_DIR=/tmp/wa-engine node docs/tools/wa_bot_engine_test.mjs
// (ENGINE_DIR = pasta de saída do tsc; o motor fica em <ENGINE_DIR>/bot/wa-bot.engine.js)
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const dir = process.env.ENGINE_DIR || '/tmp/wa-engine';
const E = require(path.join(dir, 'bot', 'wa-bot.engine.js'));
const { startFlow, handleInput, handleEvent, validateDefinition, validateAnswer, emptyState, fillVars, customerVars } = E;

let pass = 0;
let fail = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) pass += 1;
  else {
    fail += 1;
    failures.push(name + (extra ? ` :: ${typeof extra === 'string' ? extra : JSON.stringify(extra).slice(0, 400)}` : ''));
  }
}

// ---------------------------------------------------------------- helpers de grafo
let seq = 0;
const nid = (p) => `${p}-${++seq}`;
const node = (type, data = {}, id) => ({ id: id || nid(type), type, data, position: { x: 0, y: 0 } });
const edge = (source, handle, target) => ({ id: nid('e'), source, sourceHandle: handle, target });
const flow = (nodes, edges) => ({ nodes, edges });
const texts = (actions) => (actions || []).filter((a) => a.type === 'send').map((a) => a.message.text || '');
const allText = (actions) => texts(actions).join('\n---\n');
const act = (actions, type) => (actions || []).find((a) => a.type === type) || null;
const hasInfo = (actions, re) => (actions || []).some((a) => a.type === 'info' && re.test(a.text));

// ---------------------------------------------------------------- fixtures do CRM
const P1 = { id: '11111111-1111-4111-8111-111111111111', name: 'Internet 100MB', description: 'Plano básico', price_cents: 9990, price_label: 'R$ 99,90', billing: 'monthly', billing_label: 'Mensal', trial_days: 0, cancel_policy: 'end_of_cycle', active: true };
const P2 = { id: '22222222-2222-4222-8222-222222222222', name: 'Internet 300MB', description: 'Plano turbo', price_cents: 14990, price_label: 'R$ 149,90', billing: 'monthly', billing_label: 'Mensal', trial_days: 7, cancel_policy: 'immediate', active: true };
const P3 = { id: '33333333-3333-4333-8333-333333333333', name: 'Instalação', description: null, price_cents: 15000, price_label: 'R$ 150,00', billing: 'once', billing_label: 'Avulso', trial_days: 0, cancel_policy: 'immediate', active: true };
const P4 = { id: '44444444-4444-4444-8444-444444444444', name: 'Plano antigo', description: null, price_cents: 5000, price_label: 'R$ 50,00', billing: 'yearly', billing_label: 'Anual', trial_days: 0, cancel_policy: 'end_of_cycle', active: false };
const PRODUCTS = [P1, P2, P3, P4];

const S1 = { id: 'sub-1', product_id: P1.id, product_name: P1.name, price_cents: 9990, price_label: 'R$ 99,90', billing: 'monthly', status: 'active', next_due_at: '2026-11-10', next_due_label: '10/11/2026', days_overdue: 0, due_day: 10, cancel_at: null, paused_until: null };
const S2 = { id: 'sub-2', product_id: P2.id, product_name: P2.name, price_cents: 14990, price_label: 'R$ 149,90', billing: 'monthly', status: 'active', next_due_at: '2026-11-15', next_due_label: '15/11/2026', days_overdue: 0, due_day: 15, cancel_at: null, paused_until: null };
const C1 = { id: 'chg-1', amount_cents: 9990, amount_label: 'R$ 99,90', description: 'Internet 100MB — outubro', due_at: '2026-10-20', due_label: '20/10/2026', days_overdue: 0, kind: 'pix', pix_code: '000201PIX-1', boleto_url: null, status: 'pending' };
const C2 = { id: 'chg-2', amount_cents: 14990, amount_label: 'R$ 149,90', description: 'Internet 300MB — outubro', due_at: '2026-10-25', due_label: '25/10/2026', days_overdue: 0, kind: 'pix', pix_code: '000201PIX-2', boleto_url: null, status: 'pending' };

const CUST_OK = { id: 'cust-ok', name: 'Maria da Silva', first_name: 'Maria', doc_masked: '***.456.789-**', code: 'CLI-001', email: 'maria@ex.com', status: 'ok', verified: true, custom: { plano_tv: 'Sim', unidade: 'Centro' }, subscriptions: [S1, S2], open_charges: [C1] };
const CUST_OVERDUE = { id: 'cust-late', name: 'João Atrasado', first_name: 'João', doc_masked: '***.111.222-**', code: 'CLI-002', email: 'joao@ex.com', status: 'overdue', verified: false, custom: {}, subscriptions: [{ ...S1, id: 'sub-9', status: 'overdue', days_overdue: 12 }], open_charges: [{ ...C1, id: 'chg-9', days_overdue: 12, due_at: '2026-09-30', due_label: '30/09/2026' }] };
const CUST_NONE = { id: 'cust-none', name: 'Ana Nova', first_name: 'Ana', doc_masked: '', code: '', email: '', status: 'none', verified: false, custom: {}, subscriptions: [], open_charges: [] };

const IDENTITY = { require_doc: false, use_code: false, code_label: 'Código do cliente', ask_doc_text: 'Para continuar, me informe o seu CPF ou CNPJ (só números).', doc_not_found_text: 'Não encontrei um cadastro com esse documento.', doc_invalid_text: 'Esse documento não parece válido. Pode conferir e enviar de novo?' };
const REASONS = ['Está caro', 'Não uso mais', 'Mudei de serviço', 'Outro'];

function mkCtx(o = {}) {
  const customer = o.customer === undefined ? structuredClone(CUST_OK) : o.customer ? structuredClone(o.customer) : null;
  return {
    contact: { name: 'Cliente Teste', phone: '5511999999999', saved: false },
    chatTagIds: [],
    now: new Date('2026-10-12T15:00:00Z'),
    settings: { numbering: 'emoji', typing: false, max_retries: 3, ...(o.settings || {}) },
    customer,
    customers: o.customers ? structuredClone(o.customers) : customer ? [customer] : [],
    products: structuredClone(o.products || PRODUCTS),
    identity: { ...IDENTITY, ...(o.identity || {}) },
    cancel_reasons: o.cancel_reasons || REASONS,
  };
}

// fluxo: start → <bloco> com portas ligadas a "end" com texto = nome da porta
function single(type, data, ports, extraNodes = [], extraEdges = []) {
  const start = node('start', {}, 'start');
  const n = node(type, data, 'X');
  const ends = ports.map((p) => node('end', { title: p, text: `END:${p}`, close: false }, `end-${p}`));
  const edges = [edge('start', 'out', 'X'), ...ports.map((p) => edge('X', p, `end-${p}`)), ...extraEdges];
  return flow([start, n, ...ends, ...extraNodes], edges);
}
const endedAt = (actions) => (allText(actions).match(/END:([a-z_-]+)/) || [])[1] || null;
const NB = String.fromCharCode(0xa0); // Intl pt-BR separa "R$" do número com espaço duro

// ================================================================ básicos antigos
{
  const def = single('menu', { title: 'Menu', text: 'Escolha:', options: [{ id: 'a', label: 'Falar com atendente', keywords: ['humano'] }, { id: 'b', label: 'Sair' }] }, ['opt-a', 'opt-b', 'invalid']);
  let r = startFlow(def, mkCtx(), 'oi');
  check('menu: lista numerada com emoji', allText(r.actions).includes('1️⃣ Falar com atendente') && r.state.waiting_for === 'menu');
  r = handleInput(def, r.state, '2', mkCtx());
  check('menu: escolha por número', endedAt(r.actions) === 'opt-b' && r.state.vars.opcao === 'Sair');
  r = startFlow(def, mkCtx(), 'oi');
  r = handleInput(def, r.state, 'quero um humano', mkCtx());
  check('menu: escolha por palavra-chave', endedAt(r.actions) === 'opt-a');
  r = startFlow(def, mkCtx(), 'oi');
  r = handleInput(def, r.state, 'xx', mkCtx());
  r = handleInput(def, r.state, 'xx', mkCtx());
  check('menu: inválida 2×, continua esperando', r.state.waiting_for === 'menu' && r.state.retries === 2);
  r = handleInput(def, r.state, 'xx', mkCtx());
  check('menu: 3ª inválida → porta invalid', endedAt(r.actions) === 'invalid');
  const defNum = single('menu', { text: 'Escolha:', numbering: 'number', options: [{ id: 'a', label: 'A' }] }, ['opt-a']);
  r = startFlow(defNum, mkCtx(), 'oi');
  check('menu: numeração "1." quando numbering=number', allText(r.actions).includes('*1.* A'));
}
{
  const def = single('question', { text: 'Seu e-mail?', var: 'email', validate: 'email', save_to_contact: 'email' }, ['out', 'invalid']);
  let r = startFlow(def, mkCtx(), 'oi');
  check('pergunta: espera resposta', r.state.waiting_for === 'question');
  r = handleInput(def, r.state, 'nao-e-email', mkCtx());
  check('pergunta: inválida avisa', /e-mail/i.test(allText(r.actions)) && r.state.waiting_for === 'question');
  r = handleInput(def, r.state, 'Ana@Ex.com', mkCtx());
  check('pergunta: válida salva var + contato', r.state.vars.email === 'ana@ex.com' && act(r.actions, 'save_contact')?.value === 'ana@ex.com' && endedAt(r.actions) === 'out');
}
{
  const cond = node('condition', { title: 'É vip?', match: 'all', rules: [{ source: 'var', key: 'nome_x', op: 'contains', value: 'vip' }] }, 'X');
  const def = single('condition', cond.data, ['true', 'false']);
  const r1 = startFlow(def, mkCtx(), 'oi');
  check('condição: var vazia → false', endedAt(r1.actions) === 'false');
  const st = { ...emptyState(), vars: { nome_x: 'cliente VIP' } };
  const defM = single('message', { messages: [{ id: 'm', kind: 'text', text: 'Olá {{primeiro_nome}}, {{nome_x}}' }] }, ['out']);
  const r2 = startFlow(defM, { ...mkCtx(), vars: { nome_x: 'x' } }, 'oi');
  check('mensagem: variáveis preenchidas', allText(r2.actions).includes('Olá Cliente, x'));
  void st;
}
{
  const def = single('pix', { amount_cents: 4990, description: 'Consultoria', text: 'Pague {{pix_valor}}', paid_text: 'Pago!', expired_text: 'Expirou!' }, ['paid', 'expired']);
  let r = startFlow(def, mkCtx(), 'oi');
  check('pix: ação pix + espera', act(r.actions, 'pix')?.amount_cents === 4990 && r.state.waiting_for === 'pix');
  r = handleInput(def, r.state, 'ja paguei', mkCtx());
  check('pix: "paguei" → pix_check', Boolean(act(r.actions, 'pix_check')));
  const paid = handleEvent(def, r.state, 'pix_paid', mkCtx());
  check('pix: pago → paid (4 argumentos)', allText(paid.actions).includes('Pago!') && endedAt(paid.actions) === 'paid');
  const exp = handleEvent(def, r.state, 'pix_expired', mkCtx());
  check('pix: expirado → expired', endedAt(exp.actions) === 'expired');
}
{
  const a = node('tags', { add: ['t1'], remove: [] }, 'a');
  const b = node('tags', { add: ['t2'], remove: [] }, 'b');
  const def = flow([node('start', {}, 'start'), a, b], [edge('start', 'out', 'a'), edge('a', 'out', 'b'), edge('b', 'out', 'a')]);
  const r = startFlow(def, mkCtx(), 'oi');
  check('laço: interrompido e finaliza', hasInfo(r.actions, /laço/) && r.state.status === 'done');
}
{
  const def = single('wait', { amount: 5, unit: 'minutes' }, ['out']);
  let r = startFlow(def, mkCtx(), 'oi');
  check('espera: wait 300s', act(r.actions, 'wait')?.seconds === 300 && r.state.waiting_for === 'wait');
  r = handleEvent(def, r.state, 'wait_done', mkCtx());
  check('espera: wait_done segue', endedAt(r.actions) === 'out');
  const h = startFlow(single('handoff', { text: 'Passando…', assign_user_id: 'u1' }, []), mkCtx(), 'oi');
  check('atendente: handoff', h.state.status === 'handoff' && act(h.actions, 'handoff')?.assign_user_id === 'u1');
  const e = startFlow(single('end', { text: 'Tchau', close: true }, []), mkCtx(), 'oi');
  check('encerrar: close', e.state.status === 'done' && Boolean(act(e.actions, 'close')));
  const bh = startFlow(single('message', { messages: [{ id: 'm', kind: 'text', text: 'x' }] }, []), mkCtx({ settings: { business_hours: { enabled: true, days: {}, outside_text: 'Fechado', outside_action: 'message_only' } } }), 'oi');
  check('horário: fora → só mensagem', allText(bh.actions) === 'Fechado' && bh.state.status === 'done');
  // sessão antiga (sem crm/charge/customer_id) continua funcionando
  const defMenu = single('menu', { text: 'Escolha:', options: [{ id: 'a', label: 'A' }] }, ['opt-a']);
  const old = { node_id: 'X', status: 'waiting', waiting_for: 'menu', vars: {}, retries: 0, wait_until: null, last_input: null, pix: null };
  const r2 = handleInput(defMenu, old, '1', mkCtx());
  check('estado antigo sem crm/charge funciona', endedAt(r2.actions) === 'opt-a' && r2.state.crm === null && r2.state.charge === null && r2.state.customer_id === null);
}

// ================================================================ validateAnswer novos
{
  check('validateAnswer doc: CPF válido', validateAnswer('doc', '529.982.247-25').ok && validateAnswer('doc', '529.982.247-25').value === '52998224725');
  check('validateAnswer doc: CNPJ válido', validateAnswer('doc', '11.222.333/0001-81').ok);
  check('validateAnswer doc: inválido', !validateAnswer('doc', '123').ok && !validateAnswer('doc', '111.111.111-11').ok);
  check('validateAnswer cnpj', validateAnswer('cnpj', '11222333000181').ok && !validateAnswer('cnpj', '52998224725').ok);
  check('validateAnswer cep', validateAnswer('cep', '01310-100').ok && !validateAnswer('cep', '1234').ok);
  check('validateAnswer uf', validateAnswer('uf', 'sp').value === 'SP' && !validateAnswer('uf', 'São Paulo').ok);
  check('validateAnswer code', validateAnswer('code', ' CLI 001 ').value === 'CLI 001' && !validateAnswer('code', 'x'.repeat(40)).ok);
}

// ================================================================ crm_identify
{
  const def = single('crm_identify', { mode: 'phone' }, ['found', 'not_found', 'invalid']);
  const r = startFlow(def, mkCtx(), 'oi');
  check('identify phone: 1 cliente → found + customer_id', endedAt(r.actions) === 'found' && r.state.customer_id === 'cust-ok');
  const r0 = startFlow(def, mkCtx({ customer: null }), 'oi');
  check('identify phone: sem cliente → not_found sem texto', endedAt(r0.actions) === 'not_found' && texts(r0.actions).length === 1);
  const ctx2 = mkCtx({ customers: [CUST_OK, CUST_OVERDUE] });
  let r2 = startFlow(def, ctx2, 'oi');
  const t = allText(r2.actions);
  check('identify phone: 2 clientes → lista numerada', t.includes('mais de um cadastro') && t.includes('1️⃣ Maria da Silva') && t.includes('2️⃣ João Atrasado') && r2.state.waiting_for === 'crm_choose');
  r2 = handleInput(def, r2.state, '2', ctx2);
  check('identify choose: "2" → found com o 2º', endedAt(r2.actions) === 'found' && r2.state.customer_id === 'cust-late' && ctx2.customer.id === 'cust-late');
  let r3 = startFlow(def, mkCtx({ customers: [CUST_OK, CUST_OVERDUE] }), 'oi');
  r3 = handleInput(def, r3.state, '9', mkCtx({ customers: [CUST_OK, CUST_OVERDUE] }));
  check('identify choose: inválida avisa e continua', r3.state.waiting_for === 'crm_choose' && /Não entendi/.test(allText(r3.actions)));
}
{
  const def = single('crm_identify', { mode: 'org', found_text: 'Oi, {{cliente.primeiro_nome}}!' }, ['found', 'not_found', 'invalid']);
  const ctx = mkCtx({ identity: { require_doc: true }, customer: null });
  let r = startFlow(def, ctx, 'oi');
  check('identify org+require_doc: pergunta o documento', allText(r.actions).includes('CPF ou CNPJ') && r.state.waiting_for === 'crm_identify');
  r = handleInput(def, r.state, '529.982.247-25', ctx);
  const look = act(r.actions, 'crm_lookup');
  check('identify: documento válido → crm_lookup + crm_wait', look?.by === 'doc' && look?.value === '52998224725' && r.state.waiting_for === 'crm_wait' && r.state.status === 'waiting');
  const found = handleEvent(def, r.state, 'crm_result', ctx, { ok: true, customer: structuredClone(CUST_OK) });
  check('identify: crm_result found → found_text + porta found', allText(found.actions).includes('Oi, Maria!') && endedAt(found.actions) === 'found' && found.state.customer_id === 'cust-ok' && ctx.customer?.id === 'cust-ok');
  // "não achei" = ok:true sem clientes (é o que o crm_lookup devolve); ok:false = FALHA (freio/erro) → porta invalid (13/10/2026)
  const nf = handleEvent(def, r.state, 'crm_result', mkCtx({ identity: { require_doc: true }, customer: null }), { ok: true, customers: [] });
  check('identify: crm_result not found → texto + not_found', allText(nf.actions).includes('Não encontrei um cadastro') && endedAt(nf.actions) === 'not_found');
  const fl = handleEvent(def, r.state, 'crm_result', mkCtx({ identity: { require_doc: true }, customer: null }), { ok: false, user_text: 'Muitas tentativas por aqui' });
  check('identify: crm_result ok:false (falha) → user_text + porta invalid, sem not_found_text', allText(fl.actions).includes('Muitas tentativas') && !allText(fl.actions).includes('Não encontrei') && endedAt(fl.actions) === 'invalid');
  const multi = handleEvent(def, r.state, 'crm_result', mkCtx({ identity: { require_doc: true }, customer: null }), { ok: true, customers: [structuredClone(CUST_OK), structuredClone(CUST_OVERDUE)] });
  check('identify: crm_result com 2 clientes → escolha', multi.state.waiting_for === 'crm_choose' && allText(multi.actions).includes('2️⃣'));
  // inválido 3×
  let r2 = startFlow(def, mkCtx({ identity: { require_doc: true }, customer: null }), 'oi');
  r2 = handleInput(def, r2.state, '123', mkCtx({ identity: { require_doc: true } }));
  check('identify: documento inválido avisa (1/3)', /não parece válido/.test(allText(r2.actions)) && r2.state.waiting_for === 'crm_identify' && r2.state.retries === 1);
  r2 = handleInput(def, r2.state, '123', mkCtx({ identity: { require_doc: true } }));
  r2 = handleInput(def, r2.state, '123', mkCtx({ identity: { require_doc: true } }));
  check('identify: 3× inválido → porta invalid', endedAt(r2.actions) === 'invalid');
  const defNoInv = single('crm_identify', { mode: 'ask_doc', retries: 2 }, ['found', 'not_found']);
  let r3 = startFlow(defNoInv, mkCtx(), 'oi');
  r3 = handleInput(defNoInv, r3.state, 'abc', mkCtx());
  r3 = handleInput(defNoInv, r3.state, 'abc', mkCtx());
  check('identify: invalid sem ligação → cai em not_found (retries=2)', endedAt(r3.actions) === 'not_found');
  const defCode = single('crm_identify', { mode: 'ask_code' }, ['found', 'not_found']);
  const ctxC = mkCtx({ identity: { use_code: true, code_label: 'Matrícula' } });
  let r4 = startFlow(defCode, ctxC, 'oi');
  check('identify ask_code: pergunta com o rótulo da org', allText(r4.actions).includes('Qual é o seu Matrícula?'));
  r4 = handleInput(defCode, r4.state, 'CLI-001', ctxC);
  check('identify ask_code: → crm_lookup by code', act(r4.actions, 'crm_lookup')?.by === 'code' && act(r4.actions, 'crm_lookup')?.value === 'CLI-001');
  const nothing = handleEvent(def, r.state, 'crm_result', ctx, { ok: true, customer: null });
  check('identify: crm_result ok sem cliente → not_found', endedAt(nothing.actions) === 'not_found');
}

// ================================================================ crm_register / crm_update
{
  const fields = [{ key: 'name', required: true }, { key: 'email', required: false }, { key: 'doc' }, { key: 'custom.unidade', label: 'Unidade' }];
  const def = single('crm_register', { intro_text: 'Vamos fazer seu cadastro!', fields, confirm: true, link_role: 'owner' }, ['done', 'cancel', 'failed']);
  let r = startFlow(def, mkCtx({ customer: null }), 'oi');
  check('register: intro + 1ª pergunta', texts(r.actions)[0] === 'Vamos fazer seu cadastro!' && /nome completo/.test(texts(r.actions)[1]) && r.state.waiting_for === 'crm_register');
  r = handleInput(def, r.state, 'Maria da Silva', mkCtx({ customer: null }));
  check('register: campo opcional avisa "pular"', /e-mail/.test(allText(r.actions)) && /pular/.test(allText(r.actions)) && r.state.crm.fields.name === 'Maria da Silva');
  r = handleInput(def, r.state, 'nao-e', mkCtx({ customer: null }));
  check('register: e-mail inválido repete', /e-mail não parece válido/.test(allText(r.actions)) && r.state.crm.step === 1);
  r = handleInput(def, r.state, 'pular', mkCtx({ customer: null }));
  check('register: "pular" deixa vazio e pergunta o doc', r.state.crm.fields.email === '' && /CPF ou CNPJ/.test(allText(r.actions)));
  r = handleInput(def, r.state, '529.982.247-25', mkCtx({ customer: null }));
  check('register: campo custom usa o rótulo', /Qual é o seu unidade\?/i.test(allText(r.actions)));
  r = handleInput(def, r.state, 'Centro', mkCtx({ customer: null }));
  const t = allText(r.actions);
  check('register: confirmação com resumo (doc mascarado)', t.includes('Nome: Maria da Silva') && t.includes('CPF/CNPJ: ***.982.247-**') && t.includes('Unidade: Centro') && !t.includes('E-mail:') && r.state.waiting_for === 'crm_confirm');
  const yes = handleInput(def, r.state, '1', mkCtx({ customer: null }));
  const cre = act(yes.actions, 'crm_create_customer');
  check('register: confirmar → crm_create_customer + crm_wait', cre?.fields?.name === 'Maria da Silva' && cre?.fields?.doc === '52998224725' && cre?.fields?.['custom.unidade'] === 'Centro' && cre?.link_role === 'owner' && yes.state.waiting_for === 'crm_wait');
  const ctxDone = mkCtx({ customer: null });
  const done = handleEvent(def, yes.state, 'crm_result', ctxDone, { ok: true, customer: structuredClone(CUST_OK) });
  check('register: crm_result ok → done_text + done + cliente setado', allText(done.actions).includes('Cadastro concluído ✅') && endedAt(done.actions) === 'done' && done.state.customer_id === 'cust-ok' && ctxDone.customer?.id === 'cust-ok');
  const failed = handleEvent(def, yes.state, 'crm_result', mkCtx({ customer: null }), { ok: false, error: 'duplicado' });
  check('register: crm_result falhou → porta failed (ligada = sem texto)', endedAt(failed.actions) === 'failed' && hasInfo(failed.actions, /duplicado/) && texts(failed.actions).length === 1);
  const no = handleInput(def, r.state, '2', mkCtx({ customer: null }));
  check('register: "2" na confirmação → cancel', endedAt(no.actions) === 'cancel');
  let r2 = startFlow(def, mkCtx({ customer: null }), 'oi');
  r2 = handleInput(def, r2.state, 'cancelar', mkCtx({ customer: null }));
  check('register: "cancelar" em qualquer pergunta → cancel', endedAt(r2.actions) === 'cancel' && r2.state.crm === null);
  const defNoConfirm = single('crm_register', { fields: [{ key: 'name' }], confirm: false }, ['done', 'cancel']);
  let r3 = startFlow(defNoConfirm, mkCtx({ customer: null }), 'oi');
  r3 = handleInput(defNoConfirm, r3.state, 'Ana', mkCtx({ customer: null }));
  check('register: sem confirmação → ação direto', Boolean(act(r3.actions, 'crm_create_customer')) && r3.state.waiting_for === 'crm_wait');
  // update
  const defU = single('crm_update', { fields: [{ key: 'email' }], confirm: true }, ['out', 'cancel', 'no_customer', 'failed']);
  const nc = startFlow(defU, mkCtx({ customer: null }), 'oi');
  check('update: sem cliente → no_customer', endedAt(nc.actions) === 'no_customer');
  let u = startFlow(defU, mkCtx(), 'oi');
  u = handleInput(defU, u.state, 'novo@ex.com', mkCtx());
  check('update: confirmação', /novos dados/.test(allText(u.actions)) && u.state.waiting_for === 'crm_confirm');
  u = handleInput(defU, u.state, 'sim', mkCtx());
  check('update: sim → crm_update_customer', act(u.actions, 'crm_update_customer')?.fields?.email === 'novo@ex.com');
  u = handleEvent(defU, u.state, 'crm_result', mkCtx(), { ok: true, customer: { ...structuredClone(CUST_OK), email: 'novo@ex.com' } });
  check('update: resultado → done_text + out', allText(u.actions).includes('Dados atualizados ✅') && endedAt(u.actions) === 'out');
}

// ================================================================ crm_subscribe
{
  const def = single('crm_subscribe', { product_id: 'choose', method: 'pix', confirm: true, charge_now: true }, ['paid', 'subscribed', 'expired', 'declined', 'no_customer', 'failed']);
  const ctx = mkCtx({ customer: CUST_NONE });
  let r = startFlow(def, ctx, 'oi');
  const t = allText(r.actions);
  check('subscribe choose: lista só os ativos com "Nome · R$ X/mês"', t.includes('1️⃣ Internet 100MB · R$ 99,90/mês') && t.includes('3️⃣ Instalação · R$ 150,00') && !t.includes('Plano antigo') && r.state.waiting_for === 'crm_subscribe');
  r = handleInput(def, r.state, '2', ctx);
  const c = allText(r.actions);
  check('subscribe: confirmação com produto.nome/valor/periodo', c.includes('*Internet 300MB*') && c.includes('*R$ 149,90* por mês') && r.state.crm.step === 'confirm' && r.state.vars.produto_id === P2.id);
  const declined = handleInput(def, r.state, '2', ctx);
  check('subscribe: "2" → declined_text + declined', /mudar de ideia/.test(allText(declined.actions)) && endedAt(declined.actions) === 'declined');
  r = handleInput(def, r.state, '1', ctx);
  const sub = act(r.actions, 'crm_subscribe');
  check('subscribe: "1" → ação crm_subscribe', sub?.product_id === P2.id && sub?.method === 'pix' && sub?.charge_now === true && sub?.node_id === 'X' && r.state.waiting_for === 'crm_wait');
  const charge = { id: 'chg-new', amount_cents: 14990, description: 'Internet 300MB — 1ª mensalidade', due_at: '2026-10-15', pix_code: 'PIX-SIMULADO-1', boleto_url: null };
  let w = handleEvent(def, r.state, 'crm_result', ctx, { ok: true, charge, subscription: { ...S2, id: 'sub-new' } });
  check('subscribe: resultado com cobrança → waiting charge', w.state.waiting_for === 'charge' && w.state.charge?.id === 'chg-new' && texts(w.actions).length === 0);
  const chk = handleInput(def, w.state, 'paguei', ctx);
  check('subscribe: "paguei" → charge_check', act(chk.actions, 'charge_check')?.charge_id === 'chg-new' && chk.state.waiting_for === 'charge');
  const other = handleInput(def, w.state, 'oi', ctx);
  // revisão 13/10: além do info, o cliente recebe um texto (antes ficava sem resposta)
  check('subscribe: outra mensagem enquanto espera → texto + info', hasInfo(other.actions, /Aguardando a confirmação/) && /aguardando o pagamento/i.test(allText(other.actions)) && other.state.waiting_for === 'charge');
  const wrong = handleEvent(def, w.state, 'charge_paid', ctx, { charge_id: 'outra' });
  check('subscribe: charge_paid com id errado → ignorado', wrong.state.waiting_for === 'charge' && hasInfo(wrong.actions, /outra cobrança/));
  const paid = handleEvent(def, w.state, 'charge_paid', ctx, { charge_id: 'chg-new' });
  check('subscribe: charge_paid → paid_text + paid', /Pagamento confirmado ✅/.test(allText(paid.actions)) && allText(paid.actions).includes('*Internet 300MB*') && endedAt(paid.actions) === 'paid' && paid.state.charge === null);
  const exp = handleEvent(def, w.state, 'charge_expired', ctx, { charge_id: 'chg-new' });
  check('subscribe: charge_expired → expired', /venceu sem pagamento/.test(allText(exp.actions)) && endedAt(exp.actions) === 'expired');
  const noCharge = handleEvent(def, r.state, 'crm_result', ctx, { ok: true, subscription: { ...S2, id: 'sub-new' } });
  check('subscribe: resultado sem cobrança → subscribed_text + subscribed', /Assinatura ativada ✅/.test(allText(noCharge.actions)) && endedAt(noCharge.actions) === 'subscribed');
  const failed = handleEvent(def, r.state, 'crm_result', ctx, { ok: false, error: 'gateway' });
  check('subscribe: resultado falhou → failed', endedAt(failed.actions) === 'failed');
  const late = handleEvent(def, r.state, 'crm_result', ctx, { ok: true });
  void late;
  const badEvt = handleEvent(def, r.state, 'charge_paid', ctx, { charge_id: 'x' });
  check('charge_paid sem waiting charge → ignorado', badEvt.state.waiting_for === 'crm_wait');
  const noWait = handleEvent(def, w.state, 'crm_result', ctx, { ok: true });
  check('crm_result sem crm_wait → ignorado', noWait.state.waiting_for === 'charge' && hasInfo(noWait.actions, /ignorado/));
}
{
  // no_customer ligada vs. não ligada
  const linked = single('crm_subscribe', { product_id: P1.id }, ['paid', 'no_customer']);
  const r1 = startFlow(linked, mkCtx({ customer: null }), 'oi');
  check('subscribe: no_customer ligada → segue sem texto', endedAt(r1.actions) === 'no_customer' && texts(r1.actions).length === 1);
  const unlinked = single('crm_subscribe', { product_id: P1.id }, ['paid']);
  const r2 = startFlow(unlinked, mkCtx({ customer: null }), 'oi');
  check('subscribe: no_customer desligada → texto padrão + finish', /Não encontrei o seu cadastro/.test(allText(r2.actions)) && r2.state.status === 'done' && Boolean(act(r2.actions, 'finish')));
  // método ask — cliente SEM assinatura (revisão 13/10: quem já assina o plano não assina de novo, ver seção "revisão")
  const noCtx = () => mkCtx({ customer: CUST_NONE });
  const ask = single('crm_subscribe', { product_id: P1.id, method: 'ask', confirm: false }, ['paid']);
  let r3 = startFlow(ask, noCtx(), 'oi');
  check('subscribe ask: pergunta a forma', /Como prefere pagar/.test(allText(r3.actions)) && r3.state.crm.step === 'method');
  r3 = handleInput(ask, r3.state, 'xx', noCtx());
  check('subscribe ask: inválida repete', r3.state.crm.step === 'method');
  r3 = handleInput(ask, r3.state, '2', noCtx());
  check('subscribe ask: "2" → boleto, sem confirmação → ação', act(r3.actions, 'crm_subscribe')?.method === 'boleto');
  // from_var via menu de produtos
  const menu = node('menu', { text: 'Qual plano?', source: 'products', product_ids: [P1.id, P2.id] }, 'M');
  const subN = node('crm_subscribe', { product_id: 'from_var', confirm: false }, 'S');
  const defFv = flow([node('start', {}, 'start'), menu, subN, node('end', { text: 'END:inv', close: false }, 'EI')], [edge('start', 'out', 'M'), edge('M', `opt-${P1.id}`, 'S'), edge('M', `opt-${P2.id}`, 'S'), edge('M', 'invalid', 'EI')]);
  let r4 = startFlow(defFv, noCtx(), 'oi');
  const mt = allText(r4.actions);
  check('menu products: só os product_ids, rótulo com preço', mt.includes('1️⃣ Internet 100MB · R$ 99,90/mês') && mt.includes('2️⃣ Internet 300MB') && !mt.includes('Instalação'));
  r4 = handleInput(defFv, r4.state, '2', noCtx());
  check('menu products: escolha grava produto_id/produto/opcao e segue pela porta opt-<id>', r4.state.vars.produto_id === P2.id && r4.state.vars.produto === 'Internet 300MB' && r4.state.vars.opcao.includes('Internet 300MB') && act(r4.actions, 'crm_subscribe')?.product_id === P2.id);
  let r5 = startFlow(defFv, mkCtx(), 'oi');
  r5 = handleInput(defFv, r5.state, 'instalação', mkCtx());
  r5 = handleInput(defFv, r5.state, 'x', mkCtx());
  r5 = handleInput(defFv, r5.state, 'x', mkCtx());
  check('menu products: 3× inválida → invalid', endedAt(r5.actions) === 'inv');
  const r6 = startFlow(defFv, mkCtx({ products: [P4] }), 'oi');
  check('menu products: sem produto ativo → invalid direto', endedAt(r6.actions) === 'inv');
  // produto fixo
  const fixed = single('crm_subscribe', { product_id: P3.id, confirm: true }, ['paid']);
  const r7 = startFlow(fixed, mkCtx(), 'oi');
  check('subscribe fixo (avulso): confirmação sem período', allText(r7.actions).includes('*Instalação* por *R$ 150,00*.'));
  const gone = single('crm_subscribe', { product_id: P4.id }, ['paid', 'failed']);
  const r8 = startFlow(gone, mkCtx(), 'oi');
  check('subscribe fixo inativo → failed', endedAt(r8.actions) === 'failed');
  const one = single('crm_subscribe', { product_id: 'choose', product_ids: [P1.id], confirm: false }, ['paid']);
  const r9 = startFlow(one, noCtx(), 'oi');
  check('subscribe choose com 1 produto → escolhe direto', act(r9.actions, 'crm_subscribe')?.product_id === P1.id);
}

// ================================================================ crm_info
{
  const def = single('crm_info', { what: 'status' }, ['out', 'no_customer']);
  const r = startFlow(def, mkCtx(), 'oi');
  const t = allText(r.actions);
  check('info status: variáveis preenchidas', t.includes('Olá, Maria!') && t.includes('*Situação:* em dia') && t.includes('*Plano:* Internet 100MB') && t.includes('*Valor:* R$ 99,90') && t.includes('10/11/2026') && endedAt(r.actions) === 'out');
  const late = startFlow(def, mkCtx({ customer: CUST_OVERDUE }), 'oi');
  check('info status: em atraso', allText(late.actions).includes('em atraso'));
  const nc = startFlow(def, mkCtx({ customer: null }), 'oi');
  check('info: sem cliente → no_customer', endedAt(nc.actions) === 'no_customer');
  const subs = startFlow(single('crm_info', { what: 'subscriptions' }, ['out']), mkCtx(), 'oi');
  const ts = allText(subs.actions);
  check('info subscriptions: assinaturas.lista', ts.includes('• Internet 100MB — R$ 99,90 — vence 10/11 — em dia') && ts.includes('• Internet 300MB'));
  const nxt = startFlow(single('crm_info', { what: 'next_charge' }, ['out']), mkCtx(), 'oi');
  check('info next_charge: cobrancas.lista', allText(nxt.actions).includes('• R$ 99,90 — vence 20/10 — Internet 100MB — outubro'));
  const custom = startFlow(single('crm_info', { what: 'custom', template: 'TV: {{cliente.plano_tv}} / Unidade: {{cliente.unidade}} / Doc {{cliente.documento}} / {{cliente.produtos}}' }, ['out']), mkCtx(), 'oi');
  check('info custom: cliente.<custom> e cliente.produtos', texts(custom.actions)[0] === 'TV: Sim / Unidade: Centro / Doc ***.456.789-** / Internet 100MB, Internet 300MB', texts(custom.actions)[0]);
  const data = startFlow(single('crm_info', { what: 'data' }, ['out']), mkCtx(), 'oi');
  check('info data', allText(data.actions).includes('*E-mail:* maria@ex.com') && allText(data.actions).includes('*Código:* CLI-001'));
  const none = startFlow(single('crm_info', { what: 'subscriptions' }, ['out']), mkCtx({ customer: CUST_NONE }), 'oi');
  check('info: sem assinatura → texto amigável', allText(none.actions).includes('Você ainda não tem assinatura.'));
}

// ================================================================ crm_invoice
{
  const two = { ...structuredClone(CUST_OK), open_charges: [C2, C1] };
  const def = single('crm_invoice', { which: 'open', method: 'same' }, ['sent', 'nothing_open', 'no_customer', 'failed']);
  let r = startFlow(def, mkCtx({ customer: two }), 'oi');
  const a = act(r.actions, 'crm_send_charge');
  check('invoice open: pendente mais antiga + method same', a?.charge_id === 'chg-1' && a?.method === 'same' && r.state.waiting_for === 'crm_wait' && r.state.charge?.id === 'chg-1');
  r = handleEvent(def, r.state, 'crm_result', mkCtx({ customer: two }), { ok: true, charge: { id: 'chg-1', amount_cents: 10190, description: 'c/ juros', due_at: '2026-10-20' } });
  check('invoice: resultado → sent_text + sent', allText(r.actions).includes('Enviei a 2ª via acima 👆') && endedAt(r.actions) === 'sent');
  const last = startFlow(single('crm_invoice', { which: 'last', method: 'boleto' }, ['sent']), mkCtx({ customer: two }), 'oi');
  check('invoice last: mais recente + boleto', act(last.actions, 'crm_send_charge')?.charge_id === 'chg-2' && act(last.actions, 'crm_send_charge')?.method === 'boleto');
  const defC = single('crm_invoice', { which: 'choose' }, ['sent']);
  let ch = startFlow(defC, mkCtx({ customer: two }), 'oi');
  const t = allText(ch.actions);
  check('invoice choose: lista', t.includes('Qual cobrança') && t.includes('1️⃣ R$ 99,90 — vence 20/10') && t.includes('2️⃣ R$ 149,90 — vence 25/10') && ch.state.waiting_for === 'crm_choose');
  ch = handleInput(defC, ch.state, '2', mkCtx({ customer: two }));
  check('invoice choose: "2" → envia a 2ª', act(ch.actions, 'crm_send_charge')?.charge_id === 'chg-2');
  const none = startFlow(def, mkCtx({ customer: CUST_NONE }), 'oi');
  check('invoice: nothing_open', endedAt(none.actions) === 'nothing_open');
  const unlinked = startFlow(single('crm_invoice', { which: 'open' }, ['sent']), mkCtx({ customer: CUST_NONE }), 'oi');
  check('invoice: nothing_open desligada → texto + finish', allText(unlinked.actions).includes('não tem cobrança em aberto') && unlinked.state.status === 'done');
  const failed = handleEvent(def, startFlow(def, mkCtx({ customer: two }), 'oi').state, 'crm_result', mkCtx({ customer: two }), { ok: false });
  check('invoice: falhou → failed', endedAt(failed.actions) === 'failed');
}

// ================================================================ crm_cancel
{
  const def = single('crm_cancel', { subscription: 'single', ask_reason: true, retention_text: 'Temos um desconto de 20% para você ficar 😉', policy: 'product' }, ['canceled', 'kept', 'no_subscription', 'no_customer', 'failed']);
  const oneSub = { ...structuredClone(CUST_OK), subscriptions: [S1] };
  let r = startFlow(def, mkCtx({ customer: oneSub }), 'oi');
  const t = allText(r.actions);
  check('cancel: motivos numerados (da org)', t.includes('Pode me dizer o motivo?') && t.includes('1️⃣ Está caro') && t.includes('4️⃣ Outro') && r.state.waiting_for === 'crm_cancel' && r.state.crm.subscription_id === 'sub-1');
  r = handleInput(def, r.state, '2', mkCtx({ customer: oneSub }));
  const c = allText(r.actions);
  check('cancel: motivo por número → retenção + confirmação com assinatura.produto', r.state.crm.reason === 'Não uso mais' && c.includes('desconto de 20%') && c.includes('cancelamento de *Internet 100MB*') && r.state.crm.step === 'confirm');
  const kept = handleInput(def, r.state, '2', mkCtx({ customer: oneSub }));
  check('cancel: "2" → kept_text + kept', /Que bom que você fica/.test(allText(kept.actions)) && endedAt(kept.actions) === 'kept');
  const yes = handleInput(def, r.state, '1', mkCtx({ customer: oneSub }));
  const a = act(yes.actions, 'crm_cancel_subscription');
  check('cancel: "1" → ação com motivo/política', a?.subscription_id === 'sub-1' && a?.reason === 'Não uso mais' && a?.policy === 'product' && yes.state.waiting_for === 'crm_wait');
  const res = handleEvent(def, yes.state, 'crm_result', mkCtx({ customer: oneSub }), { ok: true, subscription: { ...S1, status: 'active', cancel_at: '2026-11-10' } });
  check('cancel: fim do ciclo → "continua até 10/11"', allText(res.actions).includes('Cancelado. Seu acesso continua até 10/11.') && endedAt(res.actions) === 'canceled');
  const resNow = handleEvent(def, yes.state, 'crm_result', mkCtx({ customer: oneSub }), { ok: true, subscription: { ...S1, status: 'canceled', cancel_at: null } });
  check('cancel: imediato → "a partir de agora"', allText(resNow.actions).includes('O cancelamento vale a partir de agora.'));
  // motivo livre
  let f = startFlow(def, mkCtx({ customer: oneSub }), 'oi');
  f = handleInput(def, f.state, 'Vou me mudar de cidade', mkCtx({ customer: oneSub }));
  check('cancel: motivo livre', f.state.crm.reason === 'Vou me mudar de cidade' && f.state.crm.step === 'confirm');
  // 2 assinaturas: pergunta qual
  let two = startFlow(def, mkCtx(), 'oi');
  const t2 = allText(two.actions);
  check('cancel single com 2 assinaturas → escolhe', t2.includes('Qual assinatura você quer cancelar?') && t2.includes('2️⃣ Internet 300MB — R$ 149,90 — em dia') && two.state.crm.step === 'sub');
  two = handleInput(def, two.state, '2', mkCtx());
  check('cancel: escolheu a 2ª → motivo', two.state.crm.subscription_id === 'sub-2' && two.state.crm.step === 'reason');
  const nosub = startFlow(def, mkCtx({ customer: CUST_NONE }), 'oi');
  check('cancel: no_subscription', endedAt(nosub.actions) === 'no_subscription');
  const defImm = single('crm_cancel', { ask_reason: false, policy: 'immediate', confirm_text: 'Cancela {{assinatura.produto}}? 1 sim 2 não' }, ['canceled', 'kept']);
  let im = startFlow(defImm, mkCtx({ customer: oneSub }), 'oi');
  check('cancel sem motivo: vai direto à confirmação', allText(im.actions) === 'Cancela Internet 100MB? 1 sim 2 não');
  im = handleInput(defImm, im.state, 'sim', mkCtx({ customer: oneSub }));
  check('cancel: policy immediate + reason null', act(im.actions, 'crm_cancel_subscription')?.policy === 'immediate' && act(im.actions, 'crm_cancel_subscription')?.reason === null);
  const failed = handleEvent(defImm, im.state, 'crm_result', mkCtx({ customer: oneSub }), { ok: false });
  check('cancel: falhou sem porta → texto + finish', /não consegui concluir/.test(allText(failed.actions)) && failed.state.status === 'done');
}

// ================================================================ crm_pause
{
  const oneSub = { ...structuredClone(CUST_OK), subscriptions: [S1] };
  const def = single('crm_pause', { max_days: 30, ask_until: true }, ['paused', 'no_subscription', 'no_customer', 'failed']);
  let r = startFlow(def, mkCtx({ customer: oneSub }), 'oi');
  check('pause: pergunta os dias com {{max_dias}}', allText(r.actions).includes('(até 30)') && r.state.waiting_for === 'crm_pause');
  r = handleInput(def, r.state, 'abc', mkCtx({ customer: oneSub }));
  check('pause: inválido avisa com o máximo', allText(r.actions).includes('de 1 a 30') && r.state.waiting_for === 'crm_pause');
  r = handleInput(def, r.state, '999', mkCtx({ customer: oneSub }));
  check('pause: acima do máximo avisa', r.state.waiting_for === 'crm_pause' && r.state.retries === 2);
  r = handleInput(def, r.state, '7 dias', mkCtx({ customer: oneSub }));
  check('pause: "7 dias" → ação days=7', act(r.actions, 'crm_pause_subscription')?.days === 7 && act(r.actions, 'crm_pause_subscription')?.subscription_id === 'sub-1');
  r = handleEvent(def, r.state, 'crm_result', mkCtx({ customer: oneSub }), { ok: true, subscription: { ...S1, status: 'paused', paused_until: '2026-10-19' } });
  check('pause: resultado → paused_text com a data', allText(r.actions).includes('Pausado até 19/10/2026 ⏸️') && endedAt(r.actions) === 'paused');
  const fixed = startFlow(single('crm_pause', { max_days: 10, ask_until: false, days: 99 }, ['paused']), mkCtx({ customer: oneSub }), 'oi');
  check('pause: ask_until=false usa days (limitado ao máximo)', act(fixed.actions, 'crm_pause_subscription')?.days === 10);
  const paused = startFlow(def, mkCtx({ customer: { ...oneSub, subscriptions: [{ ...S1, status: 'paused' }] } }), 'oi');
  check('pause: já pausada → no_subscription', endedAt(paused.actions) === 'no_subscription');
  let two = startFlow(def, mkCtx(), 'oi');
  check('pause: 2 assinaturas → escolhe', two.state.crm.step === 'sub');
  two = handleInput(def, two.state, '1', mkCtx());
  check('pause: escolheu → pergunta dias', two.state.crm.step === 'days' && two.state.crm.subscription_id === 'sub-1');
}

// ================================================================ crm_change_plan
{
  const oneSub = { ...structuredClone(CUST_OK), subscriptions: [S1] };
  const def = single('crm_change_plan', { product_ids: [], confirm: true }, ['changed', 'kept', 'no_subscription', 'no_customer', 'failed']);
  let r = startFlow(def, mkCtx({ customer: oneSub }), 'oi');
  const t = allText(r.actions);
  // revisão 13/10: produto avulso ("Instalação", once) não é destino de troca (o serviço recusa) → fora da lista
  check('change_plan: lista sem o plano atual (e sem avulsos)', t.includes('Para qual plano') && t.includes('1️⃣ Internet 300MB') && !t.includes('Instalação') && !t.includes('Internet 100MB') && r.state.waiting_for === 'crm_change_plan');
  r = handleInput(def, r.state, '1', mkCtx({ customer: oneSub }));
  check('change_plan: confirmação com o novo produto', allText(r.actions).includes('Trocar para *Internet 300MB* por *R$ 149,90* por mês?') && r.state.crm.product_id === P2.id);
  const kept = handleInput(def, r.state, '2', mkCtx({ customer: oneSub }));
  check('change_plan: "2" → kept', endedAt(kept.actions) === 'kept' && /continua o mesmo/.test(allText(kept.actions)));
  r = handleInput(def, r.state, '1', mkCtx({ customer: oneSub }));
  const a = act(r.actions, 'crm_change_plan');
  check('change_plan: "1" → ação', a?.subscription_id === 'sub-1' && a?.product_id === P2.id && r.state.waiting_for === 'crm_wait');
  r = handleEvent(def, r.state, 'crm_result', mkCtx({ customer: oneSub }), { ok: true, subscription: { ...S1, product_id: P2.id, product_name: P2.name, price_cents: 14990, price_label: 'R$ 149,90' }, product: P2 });
  check('change_plan: resultado → changed_text', allText(r.actions).includes('Plano trocado para *Internet 300MB* ✅') && endedAt(r.actions) === 'changed');
  const none = startFlow(single('crm_change_plan', { product_ids: [P1.id] }, ['changed', 'failed']), mkCtx({ customer: oneSub }), 'oi');
  check('change_plan: nenhum outro plano → failed', endedAt(none.actions) === 'failed');
  let two = startFlow(def, mkCtx(), 'oi');
  check('change_plan: 2 assinaturas → escolhe a assinatura', allText(two.actions).includes('Qual assinatura você quer trocar?') && two.state.crm.step === 'sub');
  two = handleInput(def, two.state, '2', mkCtx());
  check('change_plan: escolheu a 2ª → lista exclui o produto dela', !allText(two.actions).includes('Internet 300MB') && allText(two.actions).includes('Internet 100MB') && two.state.crm.subscription_id === 'sub-2');
  const noConfirm = single('crm_change_plan', { confirm: false }, ['changed']);
  let nc = startFlow(noConfirm, mkCtx({ customer: oneSub }), 'oi');
  nc = handleInput(noConfirm, nc.state, '1', mkCtx({ customer: oneSub }));
  check('change_plan: sem confirmação → ação direto', Boolean(act(nc.actions, 'crm_change_plan')));
}

// ================================================================ condition source customer
{
  const cond = (rules, ctx) => endedAt(startFlow(single('condition', { match: 'all', rules }, ['true', 'false']), ctx, 'oi').actions);
  check('cond customer status is ok', cond([{ source: 'customer', key: 'status', op: 'is', value: 'ok' }], mkCtx()) === 'true');
  check('cond customer status is_not ok (atrasado)', cond([{ source: 'customer', key: 'status', op: 'is_not', value: 'ok' }], mkCtx({ customer: CUST_OVERDUE })) === 'true');
  check('cond customer sem cliente → status none', cond([{ source: 'customer', key: 'status', op: 'is', value: 'none' }], mkCtx({ customer: null })) === 'true');
  check('cond customer product is', cond([{ source: 'customer', key: 'product', op: 'is', value: P2.id }], mkCtx()) === 'true' && cond([{ source: 'customer', key: 'product', op: 'is', value: P3.id }], mkCtx()) === 'false');
  check('cond customer days_overdue gt', cond([{ source: 'customer', key: 'days_overdue', op: 'gt', value: '10' }], mkCtx({ customer: CUST_OVERDUE })) === 'true' && cond([{ source: 'customer', key: 'days_overdue', op: 'gt', value: '10' }], mkCtx()) === 'false');
  check('cond customer days_overdue lt', cond([{ source: 'customer', key: 'days_overdue', op: 'lt', value: '5' }], mkCtx()) === 'true');
  check('cond customer verified', cond([{ source: 'customer', key: 'verified', op: 'is', value: 'true' }], mkCtx()) === 'true' && cond([{ source: 'customer', key: 'verified', op: 'is', value: 'false' }], mkCtx({ customer: null })) === 'true');
  check('cond customer has_open_charge', cond([{ source: 'customer', key: 'has_open_charge', op: 'is', value: 'true' }], mkCtx()) === 'true' && cond([{ source: 'customer', key: 'has_open_charge', op: 'is', value: 'false' }], mkCtx({ customer: CUST_NONE })) === 'true');
  check('cond customer has_subscription', cond([{ source: 'customer', key: 'has_subscription', op: 'is', value: 'false' }], mkCtx({ customer: CUST_NONE })) === 'true');
  check('cond customer custom eq/contains/empty', cond([{ source: 'customer', key: 'custom.plano_tv', op: 'eq', value: 'sim' }], mkCtx()) === 'true' && cond([{ source: 'customer', key: 'custom.unidade', op: 'contains', value: 'cen' }], mkCtx()) === 'true' && cond([{ source: 'customer', key: 'custom.zzz', op: 'empty' }], mkCtx()) === 'true' && cond([{ source: 'customer', key: 'custom.unidade', op: 'not_empty' }], mkCtx({ customer: null })) === 'false');
  check('cond match any mistura fontes', cond([{ source: 'customer', key: 'status', op: 'is', value: 'overdue' }, { source: 'tag', key: 't', op: 'has' }], { ...mkCtx(), chatTagIds: ['t'] }) === 'false');
}

// ================================================================ variáveis e validateDefinition
{
  const st = { ...emptyState(), customer_id: 'cust-ok', crm: { subscription_id: 'sub-2', product_id: P3.id }, charge: { id: 'c', amount_cents: 1234, description: 'Teste', due_at: '2026-12-01', pix_code: 'PIXCODE', boleto_url: 'https://b' } };
  const v = customerVars(st, mkCtx());
  check('vars: assinatura = a escolhida em state.crm', v['assinatura.produto'] === 'Internet 300MB' && v['assinatura.valor'] === 'R$ 149,90' && v['assinatura.vencimento'] === '15/11/2026' && v['assinatura.status'] === 'em dia');
  check('vars: cobranca = state.charge', v['cobranca.valor'] === `R$${NB}12,34` && v['cobranca.vencimento'] === '01/12/2026' && v['cobranca.pix'] === 'PIXCODE' && v['cobranca.boleto_link'] === 'https://b' && v['cobranca.descricao'] === 'Teste');
  check('vars: produto = state.crm.product_id (avulso sem período)', v['produto.nome'] === 'Instalação' && v['produto.periodo'] === '' && v['produto.valor'] === 'R$ 150,00');
  check('vars: cliente.* ', v['cliente.nome'] === 'Maria da Silva' && v['cliente.codigo'] === 'CLI-001' && v['cliente.dia_vencimento'] === '10' && v['cliente.vencimento'] === '10/11/2026');
  const f = fillVars('{{cliente.status}} / {{produto.periodo}} / {{desconhecida}} / {{max_dias}} / {{resumo}}', emptyState(), mkCtx({ customer: CUST_OVERDUE }), { max_dias: '15', resumo: 'R' });
  check('fillVars: extras + desconhecida vazia (produto cai na assinatura)', f === 'em atraso /  por mês /  / 15 / R', f);
  const over = customerVars(emptyState(), mkCtx({ customer: CUST_OVERDUE }));
  check('vars: cobranca.dias_atraso da cobrança aberta', over['cobranca.dias_atraso'] === '12' && over['cobrancas.lista'].includes('(12 dias em atraso)'));
  const yearly = customerVars({ ...emptyState(), crm: { product_id: P4.id } }, mkCtx());
  check('vars: produto.periodo anual', yearly['produto.periodo'] === ' por ano');

  const ok = flow([node('start', {}, 's'), node('crm_register', { fields: [{ key: 'name' }] }, 'r'), node('crm_subscribe', { product_id: P1.id }, 'sb'), node('menu', { source: 'products' }, 'm')], [edge('s', 'out', 'r')]);
  check('validateDefinition: blocos novos válidos', validateDefinition(ok).length === 0, validateDefinition(ok));
  const bad = flow([node('start', {}, 's'), node('crm_register', { fields: [] }, 'r'), node('crm_update', {}, 'u'), node('crm_subscribe', { product_id: 'abc' }, 'sb'), node('crm_pause', { max_days: 0 }, 'p'), node('crm_wtf', {}, 'w')], [edge('s', 'out', 'r')]);
  const errs = validateDefinition(bad);
  check('validateDefinition: register sem campo', errs.some((e) => /pelo menos um campo/.test(e)));
  check('validateDefinition: subscribe produto inválido', errs.some((e) => /produto válido/.test(e)));
  check('validateDefinition: pause max_days', errs.some((e) => /pelo menos 1/.test(e)));
  check('validateDefinition: tipo desconhecido', errs.some((e) => /crm_wtf/.test(e)));
  check('validateDefinition: 2 erros de campos (register + update)', errs.filter((e) => /pelo menos um campo/.test(e)).length === 2);
}

// ================================================================ fluxo-modelo "Provedor": identificar → menu → status / 2ª via / cancelar
{
  const start = node('start', {}, 'start');
  const ident = node('crm_identify', { mode: 'org' }, 'ident');
  const menu = node('menu', { text: 'Olá, {{cliente.primeiro_nome}}! O que você precisa?', options: [{ id: 'st', label: 'Ver minha situação' }, { id: 'inv', label: '2ª via do boleto' }, { id: 'can', label: 'Cancelar' }] }, 'menu');
  const info = node('crm_info', { what: 'status' }, 'info');
  const inv = node('crm_invoice', { which: 'open' }, 'inv');
  const can = node('crm_cancel', { ask_reason: true }, 'can');
  const reg = node('crm_register', { fields: [{ key: 'name' }, { key: 'doc' }] }, 'reg');
  const end = node('end', { text: 'Até mais!', close: true }, 'end');
  const def = flow(
    [start, ident, menu, info, inv, can, reg, end],
    [edge('start', 'out', 'ident'), edge('ident', 'found', 'menu'), edge('ident', 'not_found', 'reg'), edge('reg', 'done', 'menu'), edge('menu', 'opt-st', 'info'), edge('menu', 'opt-inv', 'inv'), edge('menu', 'opt-can', 'can'), edge('info', 'out', 'end'), edge('inv', 'sent', 'end'), edge('can', 'canceled', 'end'), edge('can', 'kept', 'menu')],
  );
  const ctx = mkCtx();
  let r = startFlow(def, ctx, 'oi');
  check('provedor: identifica pelo número e mostra o menu com o nome', allText(r.actions).includes('Olá, Maria!') && r.state.waiting_for === 'menu' && r.state.customer_id === 'cust-ok');
  r = handleInput(def, r.state, '1', ctx);
  check('provedor: situação → end', allText(r.actions).includes('*Situação:* em dia') && allText(r.actions).includes('Até mais!') && r.state.status === 'done');
  r = startFlow(def, ctx, 'oi');
  r = handleInput(def, r.state, '2', ctx);
  check('provedor: 2ª via → crm_send_charge', act(r.actions, 'crm_send_charge')?.charge_id === 'chg-1');
  r = handleEvent(def, r.state, 'crm_result', ctx, { ok: true });
  check('provedor: enviada → end', r.state.status === 'done' && allText(r.actions).includes('Até mais!'));
  r = startFlow(def, ctx, 'oi');
  r = handleInput(def, r.state, '3', ctx);
  r = handleInput(def, r.state, '1', ctx); // assinatura 1
  r = handleInput(def, r.state, '1', ctx); // motivo
  r = handleInput(def, r.state, '2', ctx); // manter
  check('provedor: manter → volta ao menu', r.state.waiting_for === 'menu' && allText(r.actions).includes('O que você precisa?'));
  const ctxNew = mkCtx({ customer: null });
  let n = startFlow(def, ctxNew, 'oi');
  check('provedor: número novo → cadastro', /nome completo/.test(allText(n.actions)) && n.state.node_id === 'reg');
  n = handleInput(def, n.state, 'Ana Nova', ctxNew);
  n = handleInput(def, n.state, '52998224725', ctxNew);
  n = handleInput(def, n.state, '1', ctxNew);
  n = handleEvent(def, n.state, 'crm_result', ctxNew, { ok: true, customer: structuredClone(CUST_NONE) });
  check('provedor: cadastrado → menu com o nome novo', allText(n.actions).includes('Olá, Ana!') && n.state.waiting_for === 'menu' && n.state.customer_id === 'cust-none');
}

// ================================================================ revisão 13/10/2026 (correções da revisão de código)
{
  const oneSub = { ...structuredClone(CUST_OK), subscriptions: [S1] };
  // B — "cancelar" na confirmação do CANCELAMENTO é sim; "manter" é não; primeira palavra decide
  const defC = single('crm_cancel', { ask_reason: false, policy: 'immediate' }, ['canceled', 'kept']);
  let c = startFlow(defC, mkCtx({ customer: oneSub }), 'oi');
  check('B cancel: "cancelar" confirma', Boolean(act(handleInput(defC, c.state, 'cancelar', mkCtx({ customer: oneSub })).actions, 'crm_cancel_subscription')));
  check('B cancel: "Sim, cancelar!" confirma', Boolean(act(handleInput(defC, c.state, 'Sim, cancelar!', mkCtx({ customer: oneSub })).actions, 'crm_cancel_subscription')));
  check('B cancel: "manter" mantém', endedAt(handleInput(defC, c.state, 'manter', mkCtx({ customer: oneSub })).actions) === 'kept');
  check('B cancel: "não, manter" mantém', endedAt(handleInput(defC, c.state, 'não, manter', mkCtx({ customer: oneSub })).actions) === 'kept');
  const defR = single('crm_register', { fields: [{ key: 'name' }], confirm: true }, ['done', 'cancel', 'failed']);
  let rg = startFlow(defR, mkCtx({ customer: null }), 'oi');
  rg = handleInput(defR, rg.state, 'Ana Nova', mkCtx({ customer: null }));
  check('B register: "cancelar" na confirmação continua sendo não', endedAt(handleInput(defR, rg.state, 'cancelar', mkCtx({ customer: null })).actions) === 'cancel');

  // C — cancel_at = hoje (imediato) → "vale a partir de agora"; futuro → "continua até"
  const yes = handleInput(defC, c.state, '1', mkCtx({ customer: oneSub }));
  const today = handleEvent(defC, yes.state, 'crm_result', mkCtx({ customer: oneSub }), { ok: true, subscription: { ...S1, status: 'canceled', cancel_at: '2026-10-12' } });
  check('C fim_texto: cancel_at = hoje → "a partir de agora"', allText(today.actions).includes('O cancelamento vale a partir de agora.'));
  const future = handleEvent(defC, yes.state, 'crm_result', mkCtx({ customer: oneSub }), { ok: true, subscription: { ...S1, status: 'active', cancel_at: '2026-11-10' } });
  check('C fim_texto: cancel_at futuro → "continua até 10/11"', allText(future.actions).includes('continua até 10/11.'));

  // E — customer_id que não está no contexto NÃO cai no cliente do número
  const defI = single('crm_info', { what: 'status' }, ['out', 'no_customer']);
  const gone = { ...emptyState(), node_id: 'start', status: 'active', customer_id: 'cust-sumiu' };
  check('E currentCustomer: identificado fora do contexto → null', customerVars(gone, mkCtx())['cliente.nome'] === '');
  void defI;

  // G — troca de plano: só active|overdue, sem cancel_at, recorrente; destino sem avulso
  const defG = single('crm_change_plan', {}, ['changed', 'kept', 'no_subscription', 'failed']);
  check('G change_plan: pausada → no_subscription', endedAt(startFlow(defG, mkCtx({ customer: { ...oneSub, subscriptions: [{ ...S1, status: 'paused' }] } }), 'oi').actions) === 'no_subscription');
  check('G change_plan: com cancelamento agendado → no_subscription', endedAt(startFlow(defG, mkCtx({ customer: { ...oneSub, subscriptions: [{ ...S1, cancel_at: '2026-11-10' }] } }), 'oi').actions) === 'no_subscription');
  check('G change_plan: avulsa → no_subscription', endedAt(startFlow(defG, mkCtx({ customer: { ...oneSub, subscriptions: [{ ...S1, billing: 'once', product_id: P3.id }] } }), 'oi').actions) === 'no_subscription');

  // H — subscription:'choose' pergunta mesmo com uma assinatura só
  const defH = single('crm_cancel', { subscription: 'choose', ask_reason: false }, ['canceled', 'kept']);
  const h = startFlow(defH, mkCtx({ customer: oneSub }), 'oi');
  check('H cancel choose com 1 assinatura → pergunta qual', h.state.crm.step === 'sub' && allText(h.actions).includes('Qual assinatura você quer cancelar?'));

  // I — menu de produtos: produto sem ligação → "inválida"; sem "inválida" → aviso + menu de novo
  const menuI = node('menu', { text: 'Qual?', source: 'products', product_ids: [P1.id, P2.id] }, 'M');
  const defI1 = flow([node('start', {}, 'start'), menuI, node('end', { text: 'END:inv', close: false }, 'EI')], [edge('start', 'out', 'M'), edge('M', 'invalid', 'EI')]);
  let i1 = startFlow(defI1, mkCtx(), 'oi');
  i1 = handleInput(defI1, i1.state, '2', mkCtx());
  check('I menu products: produto sem ligação → cai em invalid', endedAt(i1.actions) === 'inv' && i1.state.vars.produto_id === P2.id);
  const defI2 = flow([node('start', {}, 'start'), menuI], [edge('start', 'out', 'M')]);
  let i2 = startFlow(defI2, mkCtx(), 'oi');
  i2 = handleInput(defI2, i2.state, '1', mkCtx());
  check('I menu products: sem nenhuma saída → aviso + menu repetido, continua esperando', i2.state.waiting_for === 'menu' && /não está disponível/.test(allText(i2.actions)) && allText(i2.actions).includes('1️⃣ Internet 100MB'));

  // J — dias da pausa: "cancelar" desiste (texto + failed); 3× inválido → failed; só número no começo
  const defP = single('crm_pause', { max_days: 30 }, ['paused', 'failed']);
  let p = startFlow(defP, mkCtx({ customer: oneSub }), 'oi');
  const giveUp = handleInput(defP, p.state, 'cancelar', mkCtx({ customer: oneSub }));
  check('J pause: "cancelar" → texto de desistência + failed', /continua como está/.test(allText(giveUp.actions)) && endedAt(giveUp.actions) === 'failed');
  check('J pause: "dia 7" não vale (número precisa vir primeiro)', handleInput(defP, p.state, 'dia 7', mkCtx({ customer: oneSub })).state.waiting_for === 'crm_pause');
  let p3 = handleInput(defP, p.state, 'x', mkCtx({ customer: oneSub }));
  p3 = handleInput(defP, p3.state, 'x', mkCtx({ customer: oneSub }));
  p3 = handleInput(defP, p3.state, 'x', mkCtx({ customer: oneSub }));
  check('J pause: 3× inválido → failed', endedAt(p3.actions) === 'failed');
  let rg3 = startFlow(defR, mkCtx({ customer: null }), 'oi');
  rg3 = handleInput(defR, rg3.state, '1', mkCtx({ customer: null }));
  rg3 = handleInput(defR, rg3.state, '2', mkCtx({ customer: null }));
  rg3 = handleInput(defR, rg3.state, '3', mkCtx({ customer: null }));
  check('J register: 3× resposta inválida → failed', endedAt(rg3.actions) === 'failed' && rg3.state.crm === null);

  // K — esperando a cobrança: texto com a palavra de reinício; palavra de reinício sai da espera
  const defK = single('crm_subscribe', { product_id: P1.id, confirm: false }, ['paid', 'expired']);
  const kctx = () => mkCtx({ customer: CUST_NONE, settings: { restart_keywords: ['menu'] } });
  let k = startFlow(defK, kctx(), 'oi');
  k = handleEvent(defK, k.state, 'crm_result', kctx(), { ok: true, charge: { id: 'chg-k', amount_cents: 9990, description: 'x', due_at: '2026-10-15' } });
  const kOther = handleInput(defK, k.state, 'e aí?', kctx());
  check('K charge: outra mensagem → texto com "*menu*"', allText(kOther.actions).includes('digite *menu*') && kOther.state.waiting_for === 'charge');
  const kRestart = handleInput(defK, k.state, 'menu', kctx());
  check('K charge: palavra de reinício sai da espera', kRestart.state.status === 'done' && kRestart.state.waiting_for === null && Boolean(act(kRestart.actions, 'finish')));

  // L — já assina o plano: fixo → already_text + failed; choose → plano some da lista
  const defL = single('crm_subscribe', { product_id: P1.id }, ['paid', 'failed']);
  const l1 = startFlow(defL, mkCtx({ customer: oneSub }), 'oi');
  check('L subscribe fixo já assinado → already_text + failed', /já tem uma assinatura de \*Internet 100MB\*/.test(allText(l1.actions)) && endedAt(l1.actions) === 'failed');
  const defL2 = single('crm_subscribe', { product_id: 'choose' }, ['paid']);
  const l2 = startFlow(defL2, mkCtx({ customer: oneSub }), 'oi');
  check('L subscribe choose exclui o plano já assinado', !allText(l2.actions).includes('Internet 100MB') && allText(l2.actions).includes('Internet 300MB'));

  // M — consulta recusada (freio) → user_text + porta invalid (ou not_found)
  const defM = single('crm_identify', { mode: 'ask_doc' }, ['found', 'not_found', 'invalid']);
  let m = startFlow(defM, mkCtx({ customer: null }), 'oi');
  m = handleInput(defM, m.state, '52998224725', mkCtx({ customer: null }));
  const mFail = handleEvent(defM, m.state, 'crm_result', mkCtx({ customer: null }), { ok: false, error: 'throttle', user_text: 'Muitas tentativas 🙏' });
  check('M identify: resultado ok:false → user_text + invalid', allText(mFail.actions).includes('Muitas tentativas 🙏') && endedAt(mFail.actions) === 'invalid' && !/Não encontrei/.test(allText(mFail.actions)));
  const defM2 = single('crm_identify', { mode: 'ask_doc' }, ['found', 'not_found']);
  const mFail2 = handleEvent(defM2, m.state, 'crm_result', mkCtx({ customer: null }), { ok: false });
  check('M identify: ok:false sem invalid ligada → failed_text padrão + not_found', /não consegui concluir/.test(allText(mFail2.actions)) && endedAt(mFail2.actions) === 'not_found');
  // user_text também nas outras falhas (ex.: código só permite consultar)
  const defU = single('crm_update', { fields: [{ key: 'email' }], confirm: false }, ['out', 'failed']);
  let u = startFlow(defU, mkCtx(), 'oi');
  u = handleInput(defU, u.state, 'a@b.com', mkCtx());
  const uFail = handleEvent(defU, u.state, 'crm_result', mkCtx(), { ok: false, user_text: 'Confirme o CPF.' });
  check('M update: ok:false com user_text → texto do runtime + failed', allText(uFail.actions).includes('Confirme o CPF.') && endedAt(uFail.actions) === 'failed');

  // O — semestral
  check('O produto.periodo semiannual', fillVars('{{produto.periodo}}', { ...emptyState(), crm: { product_id: 'p-sem' } }, mkCtx({ products: [{ ...P1, id: 'p-sem', billing: 'semiannual' }] })) === ' por semestre');

  // P — campo personalizado "nome" não sobrescreve cliente.nome
  const vP = customerVars(emptyState(), mkCtx({ customer: { ...structuredClone(CUST_OK), custom: { nome: 'INVASOR', unidade: 'Centro' } } }));
  check('P custom não sobrescreve os fixos', vP['cliente.nome'] === 'Maria da Silva' && vP['cliente.unidade'] === 'Centro');
}


// ================================================================ AGENDA (Fase 6, contrato §9.4)
{
  const SV1 = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', name: 'Corte', price_cents: 5000, price_label: 'R$ 50,00', duration_minutes: 30, duration_label: '30 min', booking: { payment: 'on_site', address: 'Rua A, 10' }, resources: [{ id: 'res-joao', name: 'João' }, { id: 'res-maria', name: 'Maria' }] };
  const SV2 = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', name: 'Barba', price_cents: 3000, price_label: 'R$ 30,00', duration_minutes: 30, duration_label: '30 min', booking: { payment: 'on_booking' }, resources: [{ id: 'res-joao', name: 'João' }] };
  // horário em Brasília (BRT -03:00) → ISO UTC
  const iso = (date, hm) => new Date(Date.parse(`${date}T${hm}:00-03:00`)).toISOString();
  const pad = (n) => String(n).padStart(2, '0');
  const mkSlots = (date, n, res = { id: 'res-maria', name: 'Maria' }) =>
    Array.from({ length: n }, (_, i) => {
      const m = 9 * 60 + i * 30;
      const t = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
      return { starts_at: iso(date, t), ends_at: iso(date, t), time_label: t, resource_id: res.id, resource_name: res.name, left: 1 };
    });
  const DAYS = [
    { date: '2026-10-14', label: 'qua 14/10', slots: mkSlots('2026-10-14', 14) },
    { date: '2026-10-15', label: 'qui 15/10', slots: mkSlots('2026-10-15', 2) },
  ];
  const BPORTS = ['booked', 'pending_payment', 'expired', 'no_slots', 'cancel', 'failed'];
  const ctxB = () => mkCtx({ customer: null });
  const ev = (def, st, payload, ctx = ctxB()) => handleEvent(def, st, 'book_result', ctx, payload);
  const inp = (def, st, text, ctx = ctxB()) => handleInput(def, st, text, ctx);

  // A — caminho feliz (pagamento no local), profissional escolhido, paginação de horários, "15h"
  const defA = single('book_service', { resource: 'ask', days_ahead: 14 }, BPORTS.filter((p) => p !== 'pending_payment'));
  let a = startFlow(defA, ctxB(), 'oi');
  check('A book: entra pedindo os serviços ao runtime', act(a.actions, 'book_services') && a.state.waiting_for === 'book:wait' && a.state.status === 'waiting');
  a = ev(defA, a.state, { ok: true, services: [SV1, SV2] });
  check('A book: lista de serviços numerada', /Qual serviço/.test(allText(a.actions)) && /1️⃣ Corte · R\$ 50,00 · 30 min/.test(allText(a.actions)) && a.state.waiting_for === 'book:service', allText(a.actions));
  a = inp(defA, a.state, '1');
  check('A book: pergunta com quem (+ "Tanto faz")', /Com quem/.test(allText(a.actions)) && /3️⃣ Tanto faz/.test(allText(a.actions)) && a.state.waiting_for === 'book:resource' && a.state.vars.servico_id === SV1.id);
  a = inp(defA, a.state, 'Maria');
  const av1 = act(a.actions, 'book_availability');
  check('A book: disponibilidade da janela (Maria, de hoje, 14 dias)', av1 && av1.product_id === SV1.id && av1.resource_id === 'res-maria' && av1.from === '2026-10-12' && av1.days === 14, av1);
  a = ev(defA, a.state, { ok: true, days: DAYS });
  check('A book: dias "1️⃣ qua 14/10 · 14 horários"', /1️⃣ qua 14\/10 · 14 horários/.test(allText(a.actions)) && /2️⃣ qui 15\/10 · 2 horários/.test(allText(a.actions)) && a.state.waiting_for === 'book:day', allText(a.actions));
  a = inp(defA, a.state, '1');
  const av2 = act(a.actions, 'book_availability');
  check('A book: escolheu o dia → busca de novo só aquele dia', av2 && av2.from === '2026-10-14' && av2.days === 1 && a.state.book.date === '2026-10-14');
  a = ev(defA, a.state, { ok: true, days: DAYS });
  const tA = allText(a.actions);
  check('A book: 12 horários + "Mais horários" + "Outro dia"', /qua 14\/10/.test(tA) && /09:00/.test(tA) && /14:30/.test(tA) && !/15:00/.test(tA) && /Mais horários/.test(tA) && /Outro dia/.test(tA) && a.state.waiting_for === 'book:time', tA);
  a = inp(defA, a.state, '13');
  check('A book: página 2 dos horários', /15:00/.test(allText(a.actions)) && /15:30/.test(allText(a.actions)) && /Primeiros horários/.test(allText(a.actions)));
  a = inp(defA, a.state, '15h');
  const tC = allText(a.actions);
  check('A book: "15h" escolhe o horário → confirmação com serviço/profissional/data/pagamento', /\*Corte\*/.test(tC) && /Maria/.test(tC) && /qua 14\/10 às 15:00/.test(tC) && /pagamento no local/.test(tC) && a.state.waiting_for === 'book:confirm', tC);
  a = inp(defA, a.state, '1');
  const cr = act(a.actions, 'book_create');
  check('A book: confirma → book_create com horário e recurso', cr && cr.product_id === SV1.id && cr.resource_id === 'res-maria' && cr.starts_at === iso('2026-10-14', '15:00') && cr.node_id === 'X', cr);
  const apA = { id: 'ap-1', status: 'booked', payment: 'on_site', starts_at: iso('2026-10-14', '15:00'), date_label: 'qua 14/10', time_label: '15:00', resource: { id: 'res-maria', name: 'Maria' }, product_id: SV1.id, service_name: 'Corte', price_cents: 5000, price_label: 'R$ 50,00', charge: null };
  a = ev(defA, a.state, { ok: true, appointment: apA, charge: null });
  check('A book: agendado → texto + porta booked', /Agendado ✅ \*Corte\* em qua 14\/10 às 15:00 com Maria/.test(allText(a.actions)) && endedAt(a.actions) === 'booked', allText(a.actions));
  check('A book: depois do bloco o agendamento fica em foco para {{agendamento.*}}', fillVars('{{agendamento.servico}} {{agendamento.data}} {{agendamento.hora}} {{agendamento.endereco}}', a.state, ctxB()) === 'Corte qua 14/10 15:00 Rua A, 10');

  // B — com pagamento: serviço filtrado (1 só, não pergunta), recurso automático, "quarta", "sim", PIX, paguei, pago
  const defB = single('book_service', { services: [SV2.id], resource: 'auto' }, BPORTS.filter((p) => p !== 'pending_payment'));
  let b = startFlow(defB, ctxB(), 'oi');
  b = ev(defB, b.state, { ok: true, services: [SV1, SV2] });
  const avB = act(b.actions, 'book_availability');
  check('B book: 1 serviço no filtro → não pergunta; recurso automático (null)', avB && avB.product_id === SV2.id && avB.resource_id === null && !/Qual serviço/.test(allText(b.actions)), b.actions);
  b = ev(defB, b.state, { ok: true, days: DAYS });
  b = inp(defB, b.state, 'quarta');
  check('B book: "quarta" escolhe o dia', act(b.actions, 'book_availability')?.from === '2026-10-14');
  b = ev(defB, b.state, { ok: true, days: [{ ...DAYS[0], slots: [...mkSlots('2026-10-14', 1, { id: 'res-joao', name: 'João' }), ...mkSlots('2026-10-14', 2).slice(1)] }] });
  check('B book: recurso automático com 2 profissionais → horário mostra o nome', /09:00 · João/.test(allText(b.actions)), allText(b.actions));
  b = inp(defB, b.state, '1');
  check('B book: confirmação fala do PIX', /pagamento por PIX para confirmar/.test(allText(b.actions)));
  b = inp(defB, b.state, 'sim');
  check('B book: "sim" cria', act(b.actions, 'book_create')?.resource_id === 'res-joao');
  const chB = { id: 'ch-ap-1', amount_cents: 3000, description: 'Barba · qua 14/10 09:00', due_at: '2026-10-12', pix_code: 'PIXAPPT123', pay_link: null };
  b = ev(defB, b.state, { ok: true, appointment: { ...apA, id: 'ap-2', status: 'pending_payment', service_name: 'Barba', product_id: SV2.id }, charge: chB });
  check('B book: cobrança → texto + código PIX + espera `charge`', /pague \*R\$.30,00\*/.test(allText(b.actions)) && texts(b.actions).includes('PIXAPPT123') && b.state.waiting_for === 'charge' && b.state.charge?.id === 'ch-ap-1', allText(b.actions));
  const bOi = inp(defB, b.state, 'oi');
  check('B book: mensagem durante a espera → texto de aguardando com o comando', /aguardando o pagamento/.test(allText(bOi.actions)) && bOi.state.waiting_for === 'charge');
  const bPg = inp(defB, b.state, 'já paguei');
  check('B book: "paguei" → charge_check', act(bPg.actions, 'charge_check')?.charge_id === 'ch-ap-1');
  const bOther = handleEvent(defB, b.state, 'charge_paid', ctxB(), { charge_id: 'outra' });
  check('B book: pagamento de outra cobrança ignorado', bOther.state.waiting_for === 'charge' && !texts(bOther.actions).length);
  const bPaid = handleEvent(defB, b.state, 'charge_paid', ctxB(), { charge_id: 'ch-ap-1', appointment: { ...apA, id: 'ap-2', status: 'booked', service_name: 'Barba' } });
  check('B book: pago → texto de pago + porta booked', /Pagamento confirmado ✅ Seu horário está garantido: \*Barba\*/.test(allText(bPaid.actions)) && endedAt(bPaid.actions) === 'booked' && !bPaid.state.charge, allText(bPaid.actions));
  const bExp = handleEvent(defB, b.state, 'charge_expired', ctxB(), { charge_id: 'ch-ap-1' });
  check('B book: expirou → texto + porta expired', /horário foi liberado/.test(allText(bExp.actions)) && endedAt(bExp.actions) === 'expired');
  // porta "pendente" ligada → segue sem esperar
  const defB3 = single('book_service', { services: [SV2.id], resource: 'auto', confirm: false }, BPORTS);
  let b3 = startFlow(defB3, ctxB(), 'oi');
  b3 = ev(defB3, b3.state, { ok: true, services: [SV2] });
  b3 = ev(defB3, b3.state, { ok: true, days: DAYS });
  b3 = inp(defB3, b3.state, '2');
  b3 = ev(defB3, b3.state, { ok: true, days: DAYS });
  b3 = inp(defB3, b3.state, '1');
  check('B3 book: confirm:false → cria direto ao escolher o horário', Boolean(act(b3.actions, 'book_create')));
  b3 = ev(defB3, b3.state, { ok: true, appointment: { ...apA, status: 'pending_payment' }, charge: chB });
  check('B3 book: porta pending_payment ligada → PIX e segue (sem esperar)', texts(b3.actions).includes('PIXAPPT123') && endedAt(b3.actions) === 'pending_payment' && b3.state.waiting_for !== 'charge');

  // C — sem horários / sem serviços
  let c = startFlow(defA, ctxB(), 'oi');
  c = ev(defA, c.state, { ok: true, services: [SV2] });
  c = ev(defA, c.state, { ok: true, days: [{ date: '2026-10-14', label: 'qua 14/10', slots: [] }] });
  check('C book: sem horário → aviso SEMPRE + porta no_slots', /Não encontrei horários livres para \*Barba\*/.test(allText(c.actions)) && endedAt(c.actions) === 'no_slots', allText(c.actions));
  let c2 = startFlow(defA, ctxB(), 'oi');
  c2 = ev(defA, c2.state, { ok: true, services: [] });
  check('C book: sem serviço → "não há serviços" + no_slots', /não há serviços disponíveis/.test(allText(c2.actions)) && endedAt(c2.actions) === 'no_slots');
  // dias fora da janela (days_ahead 3) não aparecem
  const defC3 = single('book_service', { resource: 'auto', days_ahead: 3 }, BPORTS);
  let c3 = startFlow(defC3, ctxB(), 'oi');
  c3 = ev(defC3, c3.state, { ok: true, services: [SV1] });
  check('C book: days_ahead 3 → pede 3 dias ao serviço', act(c3.actions, 'book_availability')?.days === 3);
  c3 = ev(defC3, c3.state, { ok: true, days: [...DAYS, { date: '2026-10-20', label: 'ter 20/10', slots: mkSlots('2026-10-20', 3) }] });
  check('C book: janela de 3 dias corta 15/10 e 20/10', /qua 14\/10/.test(allText(c3.actions)) && !/15\/10/.test(allText(c3.actions)) && !/20\/10/.test(allText(c3.actions)), allText(c3.actions));

  // D — conflito: horário tomado → avisa e oferece os próximos livres do mesmo dia; 3º conflito → failed
  let dd = startFlow(defB, ctxB(), 'oi');
  dd = ev(defB, dd.state, { ok: true, services: [SV2] });
  dd = ev(defB, dd.state, { ok: true, days: DAYS });
  dd = inp(defB, dd.state, '1');
  dd = ev(defB, dd.state, { ok: true, days: DAYS });
  dd = inp(defB, dd.state, '1');
  dd = inp(defB, dd.state, '1');
  dd = ev(defB, dd.state, { ok: false, code: 'SLOT_TAKEN', error: 'ocupado' });
  check('D book: SLOT_TAKEN → aviso + nova busca do mesmo dia', /acabou de ser reservado/.test(allText(dd.actions)) && act(dd.actions, 'book_availability')?.from === '2026-10-14' && dd.state.book.conflicts === 1);
  dd = ev(defB, dd.state, { ok: true, days: [{ ...DAYS[0], slots: DAYS[0].slots.slice(1) }] });
  check('D book: oferece os horários restantes', /09:30/.test(allText(dd.actions)) && !/1️⃣ 09:00/.test(allText(dd.actions)) && dd.state.waiting_for === 'book:time');
  dd = inp(defB, dd.state, '1');
  dd = inp(defB, dd.state, '1');
  dd = ev(defB, dd.state, { ok: false, code: 'CONTACT_BUSY' });
  check('D book: CONTACT_BUSY → "você já tem um agendamento"', /já tem um agendamento nesse horário/.test(allText(dd.actions)));
  dd = ev(defB, dd.state, { ok: true, days: DAYS });
  dd = inp(defB, dd.state, '1');
  dd = inp(defB, dd.state, '1');
  dd = ev(defB, dd.state, { ok: false, code: 'SLOT_TAKEN' });
  check('D book: 3º conflito → failed', endedAt(dd.actions) === 'failed', allText(dd.actions));
  // dia esgotou entre a lista e a escolha → aviso + janela de novo
  let d2 = startFlow(defB, ctxB(), 'oi');
  d2 = ev(defB, d2.state, { ok: true, services: [SV2] });
  d2 = ev(defB, d2.state, { ok: true, days: DAYS });
  d2 = inp(defB, d2.state, '1');
  d2 = ev(defB, d2.state, { ok: true, days: [DAYS[1]] });
  check('D book: dia esgotado → aviso e busca a janela inteira', /acabaram de esgotar/.test(allText(d2.actions)) && act(d2.actions, 'book_availability')?.from === '2026-10-12');
  // CUSTOMER_REQUIRED (recusa do runtime) → user_text + failed
  let d3 = startFlow(defB, ctxB(), 'oi');
  d3 = ev(defB, d3.state, { ok: true, services: [SV2] });
  d3 = ev(defB, d3.state, { ok: true, days: DAYS });
  d3 = inp(defB, d3.state, '1');
  d3 = ev(defB, d3.state, { ok: true, days: DAYS });
  d3 = inp(defB, d3.state, '1');
  d3 = inp(defB, d3.state, '1');
  d3 = ev(defB, d3.state, { ok: false, code: 'CUSTOMER_REQUIRED', user_text: 'Para agendar, preciso do seu cadastro 🙂' });
  check('D book: CUSTOMER_REQUIRED → user_text + failed', allText(d3.actions).includes('preciso do seu cadastro') && endedAt(d3.actions) === 'failed');

  // E — desistir / outro horário / outro dia / opção inválida
  let e = startFlow(defA, ctxB(), 'oi');
  e = ev(defA, e.state, { ok: true, services: [SV1, SV2] });
  e = inp(defA, e.state, 'desistir');
  check('E book: "desistir" em qualquer pergunta → texto + porta cancel', /não agendei nada/.test(allText(e.actions)) && endedAt(e.actions) === 'cancel');
  let e2 = startFlow(defB, ctxB(), 'oi');
  e2 = ev(defB, e2.state, { ok: true, services: [SV2] });
  e2 = ev(defB, e2.state, { ok: true, days: DAYS });
  e2 = inp(defB, e2.state, '1');
  e2 = ev(defB, e2.state, { ok: true, days: DAYS });
  e2 = inp(defB, e2.state, '1');
  const e3 = inp(defB, e2.state, '2');
  check('E book: confirmação "2" → volta aos horários', e3.state.waiting_for === 'book:time' && /09:00/.test(allText(e3.actions)));
  const e4 = inp(defB, e3.state, 'outro dia');
  check('E book: "outro dia" → lista de dias (sem nova busca)', e4.state.waiting_for === 'book:day' && !act(e4.actions, 'book_availability') && /qui 15\/10/.test(allText(e4.actions)));
  const e5 = inp(defB, e2.state, '3');
  check('E book: confirmação "3" → desistiu (cancel)', endedAt(e5.actions) === 'cancel');
  const e6 = inp(defB, e4.state, '9');
  check('E book: dia inválido → "não entendi" e continua esperando', /Não entendi/.test(allText(e6.actions)) && e6.state.waiting_for === 'book:day');

  // F — paginação de dias (> 8)
  const many = Array.from({ length: 10 }, (_, i) => ({ date: `2026-10-${pad(13 + i)}`, label: `d${13 + i}`, slots: mkSlots(`2026-10-${pad(13 + i)}`, 1) }));
  const defF = single('book_service', { resource: 'auto', days_ahead: 30 }, BPORTS);
  let f = startFlow(defF, ctxB(), 'oi');
  f = ev(defF, f.state, { ok: true, services: [SV1] });
  f = ev(defF, f.state, { ok: true, days: many });
  check('F book: 8 dias + "Ver mais dias"', /8️⃣ d20/.test(allText(f.actions)) && /Ver mais dias/.test(allText(f.actions)) && !/d21/.test(allText(f.actions)), allText(f.actions));
  f = inp(defF, f.state, '9');
  check('F book: página 2 de dias', /d21/.test(allText(f.actions)) && /d22/.test(allText(f.actions)) && /Voltar aos primeiros dias/.test(allText(f.actions)));

  // G — Meus agendamentos: confirmar / cancelar (política) / remarcar / nenhum
  const AP1 = { id: 'ap-10', status: 'booked', payment: 'on_site', starts_at: iso('2026-10-14', '10:00'), date_label: 'qua 14/10', time_label: '10:00', resource: { id: 'res-maria', name: 'Maria' }, product_id: SV1.id, service_name: 'Corte', price_cents: 5000, price_label: 'R$ 50,00', can_cancel_free: true, can_reschedule: true, cancel_deadline: iso('2026-10-13', '10:00') };
  const AP2 = { ...AP1, id: 'ap-11', status: 'confirmed', starts_at: iso('2026-10-16', '14:00'), date_label: 'sex 16/10', time_label: '14:00', can_cancel_free: false };
  const MPORTS = ['out', 'none', 'failed'];
  const defG = single('my_appointments', {}, MPORTS);
  let g = startFlow(defG, ctxB(), 'oi');
  check('G appt: lista pedida ao runtime', act(g.actions, 'appt_list') && g.state.waiting_for === 'book:wait');
  g = ev(defG, g.state, { ok: true, appointments: [AP2, AP1, { ...AP1, id: 'old', status: 'done' }] });
  check('G appt: 2 próximos em ordem (concluído fica de fora)', /1️⃣ qua 14\/10 às 10:00 · Corte · Maria/.test(allText(g.actions)) && /2️⃣ sex 16\/10/.test(allText(g.actions)) && !/3️⃣/.test(allText(g.actions)) && g.state.waiting_for === 'appt:choose', allText(g.actions));
  const g1 = inp(defG, g.state, '1');
  check('G appt: ações do agendamento (confirmar/remarcar/cancelar/nada)', /Confirmar presença/.test(allText(g1.actions)) && /Remarcar/.test(allText(g1.actions)) && /Cancelar/.test(allText(g1.actions)) && /Nada, obrigado/.test(allText(g1.actions)) && g1.state.waiting_for === 'appt:action', allText(g1.actions));
  let gc = inp(defG, g1.state, 'confirmar');
  check('G appt: confirmar → appt_confirm', act(gc.actions, 'appt_confirm')?.id === 'ap-10');
  gc = ev(defG, gc.state, { ok: true, appointment: { ...AP1, status: 'confirmed' } });
  check('G appt: confirmado → texto + out', /Presença confirmada ✅ Até qua 14\/10 às 10:00/.test(allText(gc.actions)) && endedAt(gc.actions) === 'out');
  const g2 = inp(defG, g.state, '2');
  check('G appt: já confirmado não oferece "Confirmar presença"', !/Confirmar presença/.test(allText(g2.actions)));
  let gx = inp(defG, g2.state, 'cancelar');
  check('G appt: cancelar fora do prazo → aviso da política (prazo) e pede confirmação', /prazo para cancelar sem custo terminou \(13\/10 às 10:00\)/.test(allText(gx.actions)) && gx.state.waiting_for === 'appt:cancel', allText(gx.actions));
  const gxNo = inp(defG, gx.state, 'não');
  check('G appt: "não" → mantém (out)', /continua como está/.test(allText(gxNo.actions)) && endedAt(gxNo.actions) === 'out');
  gx = inp(defG, gx.state, 'sim, cancelar');
  check('G appt: "sim, cancelar" → appt_cancel', act(gx.actions, 'appt_cancel')?.id === 'ap-11');
  gx = ev(defG, gx.state, { ok: true, appointment: { ...AP2, status: 'canceled' } });
  check('G appt: cancelado → texto + out', /Agendamento cancelado/.test(allText(gx.actions)) && endedAt(gx.actions) === 'out');
  const gFree = inp(defG, g1.state, '3');
  check('G appt: cancelar no prazo → "sem custo"', /cancelar sem custo 🙂/.test(allText(gFree.actions)));
  // remarcar
  let gr = inp(defG, g1.state, 'remarcar');
  const avR = act(gr.actions, 'book_availability');
  check('G appt: remarcar → disponibilidade do mesmo serviço/profissional', avR && avR.product_id === SV1.id && avR.resource_id === 'res-maria', avR);
  gr = ev(defG, gr.state, { ok: true, days: DAYS });
  gr = inp(defG, gr.state, '2');
  gr = ev(defG, gr.state, { ok: true, days: DAYS });
  gr = inp(defG, gr.state, '2');
  check('G appt: confirmação da remarcação com data anterior e nova', /de qua 14\/10 às 10:00 para \*qui 15\/10 às 09:30\*/.test(allText(gr.actions)), allText(gr.actions));
  gr = inp(defG, gr.state, '1');
  const rs = act(gr.actions, 'book_reschedule');
  check('G appt: book_reschedule com o agendamento e o novo horário', rs && rs.appointment_id === 'ap-10' && rs.starts_at === iso('2026-10-15', '09:30'));
  const grBusy = ev(defG, gr.state, { ok: false, code: 'SLOT_TAKEN' });
  check('G appt: conflito na remarcação → oferece de novo', /acabou de ser reservado/.test(allText(grBusy.actions)) && act(grBusy.actions, 'book_availability'));
  gr = ev(defG, gr.state, { ok: true, appointment: { ...AP1, id: 'ap-12', starts_at: iso('2026-10-15', '09:30'), date_label: 'qui 15/10', time_label: '09:30' } });
  check('G appt: remarcado → texto com a nova data + out', /Remarcado ✅ Agora é \*qui 15\/10 às 09:30\* com Maria/.test(allText(gr.actions)) && endedAt(gr.actions) === 'out', allText(gr.actions));
  // nenhum
  const gn = ev(defG, startFlow(defG, ctxB(), 'oi').state, { ok: true, appointments: [] });
  check('G appt: nenhum → texto + porta none', /não tem agendamentos/.test(allText(gn.actions)) && endedAt(gn.actions) === 'none');
  // um só → direto nas ações; sem remarcação permitida
  const g1x = ev(defG, startFlow(defG, ctxB(), 'oi').state, { ok: true, appointments: [{ ...AP1, can_reschedule: false }] });
  check('G appt: 1 agendamento → ações direto; sem "Remarcar" quando can_reschedule=false', g1x.state.waiting_for === 'appt:action' && !/Remarcar/.test(allText(g1x.actions)) && /Corte/.test(allText(g1x.actions)));
  const gBack = inp(defG, g1x.state, 'nada');
  check('G appt: "nada" → out sem texto', endedAt(gBack.actions) === 'out' && texts(gBack.actions).length === 1);
  // falha do runtime (posse) → user_text + failed
  const gF = ev(defG, inp(defG, inp(defG, g1.state, '3').state, '1').state, { ok: false, user_text: 'Para remarcar ou cancelar, confirme o seu CPF/CNPJ.' });
  check('G appt: recusa do runtime → user_text + failed', /confirme o seu CPF/.test(allText(gF.actions)) && endedAt(gF.actions) === 'failed', allText(gF.actions));

  // H — lista de espera depois de "sem horário" (serviço atual) com período perguntado
  const start = node('start', {}, 'start');
  const bk = node('book_service', { resource: 'auto' }, 'BK');
  const wl = node('waitlist_join', { product_id: 'current', period: 'ask', days_ahead: 14 }, 'WL');
  const endW = node('end', { text: 'END:out', close: false }, 'end-out');
  const defH = flow([start, bk, wl, endW], [edge('start', 'out', 'BK'), edge('BK', 'no_slots', 'WL'), edge('WL', 'out', 'end-out')]);
  let h = startFlow(defH, ctxB(), 'oi');
  h = ev(defH, h.state, { ok: true, services: [SV1] });
  h = ev(defH, h.state, { ok: true, days: [] });
  check('H waitlist: sem horário → aviso e pergunta o período (sem pedir o serviço de novo)', /Não encontrei horários/.test(allText(h.actions)) && /Qual período/.test(allText(h.actions)) && !act(h.actions, 'book_services') && h.state.waiting_for === 'book:period', allText(h.actions));
  h = handleInput(defH, h.state, 'tarde', ctxB());
  const wj = act(h.actions, 'waitlist_join');
  check('H waitlist: waitlist_join com serviço atual, período e janela', wj && wj.product_id === SV1.id && wj.period === 'afternoon' && wj.date_from === '2026-10-12' && wj.date_to === '2026-10-25', wj);
  h = handleEvent(defH, h.state, 'book_result', ctxB(), { ok: true });
  check('H waitlist: inscrito → texto + out', /lista de espera de \*Corte\*/.test(allText(h.actions)) && endedAt(h.actions) === 'out', allText(h.actions));
  // fixo + período "qualquer": sem perguntas
  const defH2 = single('waitlist_join', { product_id: SV2.id, period: 'any' }, ['out', 'failed']);
  let h2 = startFlow(defH2, ctxB(), 'oi');
  check('H waitlist: serviço fixo → pede a lista de serviços (para o nome)', act(h2.actions, 'book_services'));
  h2 = ev(defH2, h2.state, { ok: true, services: [SV1, SV2] });
  check('H waitlist: período "qualquer" → entra direto', act(h2.actions, 'waitlist_join')?.period === 'any' && act(h2.actions, 'waitlist_join')?.product_id === SV2.id);

  // I — condições e variáveis
  const now = new Date('2026-10-12T15:00:00Z');
  const ctxI = { ...mkCtx({ customer: { ...structuredClone(CUST_OK), custom: { no_shows: '3' } } }), now, appointments: [{ ...AP1, starts_at: new Date(now.getTime() + 5 * 3600_000).toISOString() }] };
  const condFlow = (rules) => {
    const st = node('start', {}, 'start');
    const cn = node('condition', { rules, match: 'all' }, 'C');
    const t = node('end', { text: 'END:true', close: false }, 'end-true');
    const fl = node('end', { text: 'END:false', close: false }, 'end-false');
    return flow([st, cn, t, fl], [edge('start', 'out', 'C'), edge('C', 'true', 'end-true'), edge('C', 'false', 'end-false')]);
  };
  const cond = (rules, ctx = ctxI) => endedAt(startFlow(condFlow(rules), ctx, 'oi').actions);
  check('I cond: próximo em até 24 h → sim', cond([{ source: 'appointment', key: 'next_in_hours', op: 'lte', value: '24' }]) === 'true');
  check('I cond: próximo em mais de 24 h → não', cond([{ source: 'appointment', key: 'next_in_hours', op: 'gt', value: '24' }]) === 'false');
  check('I cond: sem agendamento → "em até N h" é não', cond([{ source: 'appointment', key: 'next_in_hours', op: 'lte', value: '24' }], { ...ctxI, appointments: [] }) === 'false');
  check('I cond: tem pendente = false', cond([{ source: 'appointment', key: 'has_pending', op: 'is', value: 'true' }]) === 'false');
  check('I cond: tem agendamento = true', cond([{ source: 'appointment', key: 'has_upcoming', op: 'is', value: 'true' }]) === 'true');
  check('I cond: faltas > 2 (cliente.custom.no_shows)', cond([{ source: 'customer', key: 'no_shows', op: 'gt', value: '2' }]) === 'true');
  check('I cond: faltas do contexto têm prioridade', cond([{ source: 'customer', key: 'no_shows', op: 'gt', value: '2' }], { ...ctxI, no_shows: 0 }) === 'false');
  const vI = fillVars('{{agendamento.servico}}|{{agendamento.data}}|{{agendamento.profissional}}|{{agendamento.prazo_cancelamento}}', emptyState(), ctxI);
  check('I vars: {{agendamento.*}} do próximo agendamento do contexto', vI === 'Corte|qua 14/10|Maria|13/10 às 10:00', vI);
  check('I vars: agendamentos.lista', /• qua 14\/10 às 10:00 · Corte · Maria — agendado/.test(fillVars('{{agendamentos.lista}}', emptyState(), ctxI)));

  // J — validação, eventos fora de hora, reinício
  check('J valid: blocos de agenda aceitos', validateDefinition(defA).length === 0 && validateDefinition(defG).length === 0 && validateDefinition(defH).length === 0, validateDefinition(defA));
  check('J valid: recurso inválido', validateDefinition(single('book_service', { resource: 'xx' }, ['booked'])).some((x) => /recurso válido/.test(x)));
  check('J valid: serviço da lista de espera inválido', validateDefinition(single('waitlist_join', { product_id: 'zz' }, ['out'])).some((x) => /serviço válido/.test(x)));
  check('J valid: janela de dias fora de 1..60', validateDefinition(single('book_service', { days_ahead: 90 }, ['booked'])).some((x) => /entre 1 e 60/.test(x)));
  let j = startFlow(defA, ctxB(), 'oi');
  j = ev(defA, j.state, { ok: true, services: [SV1, SV2] });
  const jIgn = ev(defA, j.state, { ok: true, services: [] });
  check('J book_result sem ação pendente → ignorado', /ignorado/.test(JSON.stringify(jIgn.actions)) && jIgn.state.waiting_for === 'book:service');
  const jRes = handleInput(defA, j.state, 'menu', mkCtx({ customer: null, settings: { restart_keywords: ['menu'] } }));
  check('J reinício limpa a agenda', jRes.state.status === 'done' && jRes.state.book === null);
  const jWait = handleInput(defA, startFlow(defA, ctxB(), 'oi').state, 'oi', ctxB());
  check('J book:wait: mensagem não muda o estado', jWait.state.waiting_for === 'book:wait' && !texts(jWait.actions).length);
}

// ================================================================ produtos do tipo serviço ficam fora dos blocos de CRM
{
  const SVCP = { ...P1, id: '55555555-5555-4555-8555-555555555555', name: 'Corte de cabelo', billing: 'once', kind: 'service' };
  const ctxS = mkCtx({ customer: structuredClone(CUST_NONE), products: [P1, SVCP] });
  const defS = single('crm_subscribe', { product_id: 'choose' }, ['paid', 'subscribed', 'expired', 'declined', 'no_customer', 'failed']);
  const rS = startFlow(defS, ctxS, 'oi');
  check('S assinar: serviço da agenda não entra na escolha de plano', !/Corte de cabelo/.test(allText(rS.actions)), allText(rS.actions));
  const defM = flow([node('start', {}, 'start'), node('menu', { source: 'products', text: 'Planos' }, 'M')], [edge('start', 'out', 'M')]);
  const rM = startFlow(defM, ctxS, 'oi');
  check('S menu de produtos: serviço da agenda fica de fora', /Internet 100MB/.test(allText(rM.actions)) && !/Corte de cabelo/.test(allText(rM.actions)), allText(rM.actions));
}

// ---------------------------------------------------------------- resultado
const total = pass + fail;
for (const f of failures) console.log('FAIL', f);
console.log(`${pass}/${total} ${fail ? 'FAIL' : 'PASS'}`);
process.exit(fail ? 1 : 0);
