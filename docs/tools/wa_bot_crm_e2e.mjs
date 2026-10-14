// E2E — Fase 2 do plano de assinaturas: blocos de CRM no Fluxo do Bot (runtime B2R + simulador).
//
// NO SERVIDOR (contra 127.0.0.1:8000; cria uma org temporária pela API admin e apaga no fim):
//   scp docs/tools/wa_bot_crm_e2e.mjs pubmail-hostinger:/opt/pub-mail/back/wa_bot_crm_e2e.tmp.mjs
//   ssh pubmail-hostinger 'cd /opt/pub-mail/back && node wa_bot_crm_e2e.tmp.mjs; rm -f wa_bot_crm_e2e.tmp.mjs'
//
// LOCAL, sem banco (só a parte do simulador com cliente fictício, usando o `dist` do back com dependências falsas):
//   cd back && npx nest build && cd .. && LOCAL_DIST=back/dist node docs/tools/wa_bot_crm_e2e.mjs
//
// Cobertura:
//  1. Simulador com `crm_fixture` (cliente fictício resolvido em memória) percorrendo o fluxo-modelo
//     "Provedor": identificar pelo número / org que exige CPF (inválido → válido) / 2 clientes no número;
//     status; 2ª via com e sem cobrança aberta; cancelar com motivo (e manter); pausar 7 dias; trocar de
//     plano; cadastro novo (obrigatório, opcional, pular, confirmar) → assinar escolhendo o plano →
//     cartão da cobrança (pseudo-ação `charge`) → `charge_paid` → porta "pago"; `charge_expired`; recusa.
//  2. Simulador SEM fixture: ações de CRM viram "info" e o estado fica em `crm_wait`; `crm_result` manual.
//  3. Simulador com `crm_mode:'org'` (dados REAIS da org temporária, só leitura): produtos/cliente/
//     assinatura/cobrança criados pela API (cobrança em atraso inserida por SQL, sem gateway) →
//     identificar pelo número, status real, 2ª via mostra o valor com multa/juros, lookup real por CPF,
//     escritas viram "info" e NADA muda no banco; menu de produtos com os produtos da org.
//  4. Validação do DTO (crm_mode/evento inválidos → 400) e fluxo sem CRM igual ao de antes.
//  5. AGENDA (Fase 6, contrato §9.4) no simulador com `book_fixture` (horários em memória, nada reservado):
//     agendar escolhendo serviço/profissional/dia/hora → confirmação → "Agendado"; PIX na reserva → cartão da
//     cobrança → `charge_paid` → "Pagamento confirmado"; agenda lotada → lista de espera (período "tarde");
//     conflito na 1ª reserva → oferece de novo; "Meus agendamentos" → cancelar fora do prazo e remarcar.
//  6. CHAMADOS (Fase 6B, contrato §10.5) no simulador com `crm_fixture.tickets` (categorias/chamados em memória, nada
//     gravado): abrir chamado escolhendo a categoria → descrição → foto fictícia (`state.__sim_media`) → "pronto" →
//     protocolo + {{chamado.protocolo}} no bloco seguinte; "0" cancela; falha ao abrir → "Deu erro"; "Meus chamados" →
//     lista só os em andamento → detalhes → enviar mais informações; protocolo de outra pessoa → "não encontrei";
//     cliente só visto pelo código → sem "enviar mais informações"; condição "tem chamado aberto".
//  7. PEDIDOS + CAMPOS PERSONALIZADOS (Fase 7, contrato §11.1/§11.3) no simulador com `crm_fixture.catalog/order_settings/
//     custom_fields/addresses/orders` (nada gravado): pedido completo (categoria → produto → quantidade → carrinho →
//     entrega → endereço salvo → campo do pedido → observação → PIX → resumo) → cartão da cobrança → "Pagou" → porta
//     "pago"; retirada + pagar na retirada → porta out; cancelar; falha; PIX expirou; "Meus pedidos" com campo visível;
//     condição "tem pedido"; cadastro e chamado perguntando os campos personalizados.
//
// O caminho REAL de escrita (bot criando cliente/assinatura/cobrança, `charge_paid` do gateway retomando a
// conversa, entrega tardia) envia mensagens e cobra no gateway: é validado pelo Júlio no número de teste
// "Pub Mail" (antigo "A Zero 1"; ver docs/whatsapp-assinaturas-contrato.md §6).
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const LOCAL = process.env.LOCAL_DIST || '';
let fails = 0;
let total = 0;
const ok = (l, c, x) => {
  total++;
  if (!c) fails++;
  console.log((c ? 'PASS ' : 'FAIL ') + l + (c || x === undefined ? '' : '  → ' + JSON.stringify(x).slice(0, 500)));
};

// ---------------------------------------------------------------- transporte (API real ou serviço local)
let sim; // (body) => Promise<{ s, j }>
let call = null;
let sql = null;
let saTok = null;
let orgTok = null;
if (LOCAL) {
  const req = createRequire(path.resolve(LOCAL, '..', 'package.json'));
  const { WhatsAppBotService } = req(path.resolve(LOCAL, 'src/whatsapp/bot/whatsapp-bot.service.js'));
  const prisma = { whatsapp_crm_settings: { findUnique: async () => null }, whatsapp_bot_flows: { findFirst: async () => null } };
  const crm = { botProducts: async () => [], botCustomer: async () => { throw new Error('sem banco'); } };
  const presenter = { tagMap: async () => new Map() };
  const identity = { findCustomer: async () => ({ found: [] }) };
  const nil = {};
  const svc = new WhatsAppBotService(prisma, nil, nil, nil, nil, nil, presenter, { on() {}, onInbound() {} }, nil, crm, nil, nil, nil, identity, nil, nil);
  sim = async (body) => {
    try {
      return { s: 201, j: await svc.simulate('org-local', JSON.parse(JSON.stringify(body))) };
    } catch (e) {
      return { s: e?.status || 500, j: { message: e?.message } };
    }
  };
} else {
  const jwt = (await import('jsonwebtoken')).default;
  const API = 'http://127.0.0.1:8000';
  const env = Object.fromEntries(readFileSync('/opt/pub-mail/back/.env', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
  const SECRET = env.JWT_ACCESS_SECRET;
  const DB_PASS = readFileSync('/root/pubmail.secrets', 'utf8').split('\n').find((l) => l.startsWith('DB_PASS='))?.slice(8).trim();
  sql = (q) => execFileSync('mysql', ['-upubmail', `-p${DB_PASS}`, '-h127.0.0.1', '-N', '-e', q, 'pubmail'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  const sign = (u) => jwt.sign({ sub: u.id, org: u.org, role: u.role }, SECRET, { expiresIn: '20m' });
  call = async (tok, m, p, b) => {
    const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: b ? JSON.stringify(b) : undefined });
    let j = null;
    const t = await r.text();
    try { j = JSON.parse(t); } catch { j = t; }
    return { s: r.status, j };
  };
  const SA = sql(`SELECT CONCAT(u.id,'|',u.organization_id) FROM users u WHERE u.email='superadmin@pubmail.com' LIMIT 1`).split('|');
  saTok = sign({ id: SA[0], org: SA[1], role: 'SUPER_ADMIN' });
  globalThis.__sign = sign;
  // o simulador tem limite de 180/min por IP; a bateria passou disso → espera e repete no 429
  sim = async (body) => {
    for (let i = 0; ; i++) {
      const r = await call(orgTok, 'POST', '/whatsapp/bot/simulate', body);
      if (r.s !== 429 || i >= 6) return r;
      await new Promise((ok) => setTimeout(ok, 10_000));
    }
  };
}

// ---------------------------------------------------------------- helpers de conversa
const texts = (r) => (r?.j?.actions || []).filter((a) => a.type === 'send').map((a) => a.message?.text || '');
const allText = (r) => texts(r).join('\n---\n');
const has = (r, type) => (r?.j?.actions || []).some((a) => a.type === type);
const findAct = (r, type) => (r?.j?.actions || []).find((a) => a.type === type) || null;
const infos = (r) => (r?.j?.actions || []).filter((a) => a.type === 'info').map((a) => a.text).join(' | ');
function convo(def, extra = {}) {
  let state = null;
  const base = { definition: def, settings: { audience: { mode: 'all' }, typing: false }, ...extra };
  const go = async (body) => {
    const r = await sim({ ...base, ...(state ? { state } : {}), ...body });
    if (r.s === 200 || r.s === 201) state = r.j.state;
    else console.log('  simulate', r.s, JSON.stringify(r.j).slice(0, 400));
    return r;
  };
  return {
    start: (input = 'oi') => go({ input }),
    say: (input) => go({ input }),
    event: (event, event_payload) => go({ event, ...(event_payload ? { event_payload } : {}) }),
    // arquivo fictício do "cliente" (foto/documento): vai no estado, o simulador tira de lá (o DTO não tem campo próprio)
    media: (media, input = '') => go({ input, ...(state ? { state: { ...state, __sim_media: media } } : {}) }),
    get state() { return state; },
  };
}

// ---------------------------------------------------------------- fluxo-modelo "Provedor"
const N = (id, type, data = {}) => ({ id, type, position: { x: 0, y: 0 }, data });
const E = (source, sourceHandle, target) => ({ id: `${source}-${sourceHandle}-${target}`, source, sourceHandle, target });
function provedor(identifyMode = 'org') {
  return {
    nodes: [
      N('start', 'start'),
      N('ident', 'crm_identify', { title: 'Identificar', mode: identifyMode, retries: 2 }),
      N('menu', 'menu', { title: 'Menu', text: 'Olá, {{cliente.primeiro_nome}}! Como posso ajudar?', options: [{ id: 'st', label: 'Status' }, { id: 'inv', label: '2ª via' }, { id: 'can', label: 'Cancelar' }, { id: 'pau', label: 'Pausar' }, { id: 'chg', label: 'Trocar de plano' }] }),
      N('info', 'crm_info', { title: 'Status', what: 'status' }),
      N('inv', 'crm_invoice', { title: '2ª via', which: 'open', method: 'same' }),
      N('can', 'crm_cancel', { title: 'Cancelar', subscription: 'single', ask_reason: true, policy: 'product' }),
      N('pau', 'crm_pause', { title: 'Pausar', max_days: 30, ask_until: true }),
      N('chg', 'crm_change_plan', { title: 'Trocar' }),
      N('reg', 'crm_register', { title: 'Cadastro', intro_text: 'Vamos fazer seu cadastro 🙂', fields: [{ key: 'name', label: 'Nome' }, { key: 'doc', label: 'CPF/CNPJ' }, { key: 'email', label: 'E-mail', required: false }, { key: 'custom.bairro', label: 'Bairro', required: false }] }),
      N('sub', 'crm_subscribe', { title: 'Assinar', product_id: 'choose', method: 'pix', charge_now: true, confirm: true }),
      N('welcome', 'message', { messages: [{ id: 'w1', kind: 'text', text: 'Bem-vindo(a) à Provedor Net, {{cliente.primeiro_nome}}! 🚀' }] }),
      N('bad', 'end', { text: 'Não consegui te identificar. Um atendente vai te ajudar.', close: true }),
      N('end', 'end', { text: 'Até mais! 👋', close: true }),
    ],
    edges: [
      E('start', 'out', 'ident'),
      E('ident', 'found', 'menu'),
      E('ident', 'not_found', 'reg'),
      E('ident', 'invalid', 'bad'),
      E('menu', 'opt-st', 'info'),
      E('menu', 'opt-inv', 'inv'),
      E('menu', 'opt-can', 'can'),
      E('menu', 'opt-pau', 'pau'),
      E('menu', 'opt-chg', 'chg'),
      E('info', 'out', 'end'),
      E('inv', 'sent', 'end'),
      E('can', 'canceled', 'end'),
      E('can', 'kept', 'end'),
      E('pau', 'paused', 'end'),
      E('chg', 'changed', 'end'),
      E('chg', 'kept', 'end'),
      E('reg', 'done', 'sub'),
      E('sub', 'paid', 'welcome'),
      E('welcome', 'out', 'end'),
      E('sub', 'expired', 'end'),
      E('sub', 'declined', 'end'),
    ],
  };
}

// ---------------------------------------------------------------- cliente fictício (mesmo formato do front)
// datas em BRT (como o sistema): perto da meia-noite o dia UTC já virou e o de Brasília não
const BRT_TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const ymd = (d) => new Date(Date.parse(`${BRT_TODAY}T12:00:00Z`) + d * 86400000).toISOString().slice(0, 10);
const dmy = (s) => s.split('-').reverse().join('/');
const P1 = { id: 'sim-prod-1', name: 'Plano 100 Mega', description: null, price_cents: 9990, price_label: 'R$ 99,90', billing: 'monthly', billing_label: 'Mensal', trial_days: 0, cancel_policy: 'end_of_cycle', active: true };
const P2 = { id: 'sim-prod-2', name: 'Plano 300 Mega', description: null, price_cents: 14990, price_label: 'R$ 149,90', billing: 'monthly', billing_label: 'Mensal', trial_days: 0, cancel_policy: 'end_of_cycle', active: true };
const subOf = (id, p, patch = {}) => ({ id, product_id: p.id, product_name: p.name, price_cents: p.price_cents, price_label: p.price_label, billing: 'monthly', status: 'active', next_due_at: ymd(12), next_due_label: dmy(ymd(12)), days_overdue: 0, due_day: 10, cancel_at: null, paused_until: null, ...patch });
const chgOf = (id, p, patch = {}) => ({ id, amount_cents: p.price_cents, amount_label: p.price_label, description: `${p.name} — mensalidade`, due_at: ymd(5), due_label: dmy(ymd(5)), days_overdue: 0, kind: 'pix', pix_code: `000201PIX-SIMULADO-${id}`, boleto_url: null, status: 'PENDING', ...patch });
const MARIA = { id: 'sim-cust-ok', name: 'Maria da Silva', first_name: 'Maria', doc_masked: '***.982.247-**', code: 'CLI-001', email: 'maria@exemplo.com', status: 'ok', verified: true, custom: {}, subscriptions: [subOf('sim-sub-1', P1), subOf('sim-sub-2', P2, { next_due_at: ymd(20), next_due_label: dmy(ymd(20)) })], open_charges: [chgOf('sim-chg-1', P1)] };
const JOAO = { id: 'sim-cust-late', name: 'João Pereira', first_name: 'João', doc_masked: '***.111.222-**', code: 'CLI-002', email: 'joao@exemplo.com', status: 'overdue', verified: false, custom: {}, subscriptions: [subOf('sim-sub-9', P1, { status: 'overdue', days_overdue: 12, next_due_at: ymd(-12), next_due_label: dmy(ymd(-12)) })], open_charges: [chgOf('sim-chg-9', P1, { days_overdue: 12, due_at: ymd(-12), due_label: dmy(ymd(-12)) })] };
const CPF_OK = '52998224725';
const REASONS = ['Está caro', 'Não uso mais', 'Mudei de serviço', 'Problemas no atendimento', 'Outro'];
const fixture = (preset, extra = {}) => {
  const base = { products: [P1, P2], identity: { require_doc: false }, cancel_reasons: REASONS, lookup: { [CPF_OK]: MARIA, 'CLI-001': MARIA, 'CLI-002': JOAO } };
  const by = { none: { customer: null, customers: [] }, ok: { customer: MARIA, customers: [MARIA] }, overdue: { customer: JOAO, customers: [JOAO] }, two: { customer: MARIA, customers: [MARIA, JOAO] } };
  return { ...base, ...by[preset], ...extra };
};

async function simulatorScenarios() {
  const def = provedor('org');
  // ---- 1. identificar pelo número + status
  let c = convo(def, { crm_fixture: fixture('ok') });
  let r = await c.start();
  ok('fixture: identifica pelo número e mostra o menu', r.s === 201 && /Olá, Maria/.test(allText(r)) && r.j.state.customer_id === MARIA.id && r.j.state.waiting_for === 'menu', r.j);
  ok('fixture: resposta traz o cliente atual e o guarda em state.__fixture_customer', r.j.customer?.id === MARIA.id && r.j.state.__fixture_customer?.id === MARIA.id, r.j.customer);
  r = await c.say('1');
  ok('status: texto com nome, situação "em dia" e plano', /Maria/.test(allText(r)) && /em dia/.test(allText(r)) && /Plano 100 Mega/.test(allText(r)) && r.j.ended === true, allText(r));

  // ---- status de cliente em atraso
  c = convo(def, { crm_fixture: fixture('overdue') });
  await c.start();
  r = await c.say('1');
  ok('status: cliente em atraso aparece "em atraso"', /em atraso/.test(allText(r)), allText(r));

  // ---- 2. org exige CPF: inválido → válido → achou
  c = convo(def, { crm_fixture: fixture('none', { identity: { require_doc: true, ask_doc_text: 'Me diga seu CPF, por favor.' } }) });
  r = await c.start();
  ok('require_doc: pede o CPF (texto da org)', /Me diga seu CPF/.test(allText(r)) && r.j.state.waiting_for === 'crm_identify', allText(r));
  r = await c.say('123');
  ok('require_doc: CPF inválido → texto de inválido, continua esperando', r.j.state.waiting_for === 'crm_identify' && texts(r).length >= 1, allText(r));
  r = await c.say('529.982.247-25');
  ok('require_doc: CPF válido → ação crm_lookup → achou → menu', has(r, 'crm_lookup') && r.j.state.customer_id === MARIA.id && /Olá, Maria/.test(allText(r)), r.j);
  // não encontrado
  c = convo(def, { crm_fixture: fixture('none', { identity: { require_doc: true } }) });
  await c.start();
  r = await c.say('15350946056');
  ok('require_doc: CPF válido mas sem cadastro → porta not_found (cadastro)', has(r, 'crm_lookup') && /cadastro/i.test(allText(r)) && r.j.state.waiting_for === 'crm_register', allText(r));
  // inválido demais → porta invalid
  c = convo(def, { crm_fixture: fixture('none', { identity: { require_doc: true } }) });
  await c.start();
  await c.say('1');
  r = await c.say('2');
  ok('require_doc: inválido 2× (retries=2) → porta "invalid"', /Não consegui te identificar/.test(allText(r)) && r.j.ended === true, allText(r));

  // ---- 3. dois clientes no número → escolha
  c = convo(def, { crm_fixture: fixture('two') });
  r = await c.start();
  ok('2 clientes no número: lista para escolher', /mais de um cadastro/i.test(allText(r)) && r.j.state.waiting_for === 'crm_choose', allText(r));
  r = await c.say('2');
  ok('2 clientes: escolheu o 2º (João) → menu com o nome dele', r.j.state.customer_id === JOAO.id && /Olá, João/.test(allText(r)), allText(r));

  // ---- 4. 2ª via com e sem cobrança aberta
  c = convo(def, { crm_fixture: fixture('ok') });
  await c.start();
  r = await c.say('2');
  const card = findAct(r, 'charge');
  ok('2ª via: ação crm_send_charge + cartão da cobrança + "Enviei a 2ª via"', has(r, 'crm_send_charge') && card?.charge?.id === 'sim-chg-1' && /2ª via/.test(allText(r)), r.j.actions);
  c = convo(def, { crm_fixture: fixture('ok', { customer: { ...MARIA, open_charges: [] }, customers: [{ ...MARIA, open_charges: [] }] }) });
  await c.start();
  r = await c.say('2');
  ok('2ª via sem cobrança aberta → "não tem cobrança em aberto"', !has(r, 'crm_send_charge') && /não tem cobrança em aberto/.test(allText(r)), allText(r));

  // ---- 5. cancelar com motivo / manter
  c = convo(def, { crm_fixture: fixture('ok') });
  await c.start();
  r = await c.say('3');
  ok('cancelar: 2 assinaturas → pergunta qual', /Qual assinatura você quer cancelar/.test(allText(r)), allText(r));
  r = await c.say('1');
  ok('cancelar: pede o motivo com a lista da org', /motivo/.test(allText(r)) && /Está caro/.test(allText(r)), allText(r));
  r = await c.say('1');
  ok('cancelar: confirmação com o nome do plano', /Confirma o cancelamento de \*Plano 100 Mega\*/.test(allText(r)), allText(r));
  r = await c.say('1');
  const cancelAct = findAct(r, 'crm_cancel_subscription');
  ok('cancelar: ação com assinatura, motivo e política', cancelAct?.subscription_id === 'sim-sub-1' && cancelAct?.reason === 'Está caro' && cancelAct?.policy === 'product', cancelAct);
  ok('cancelar: fim do ciclo → "Seu acesso continua até"', /Cancelado\. Seu acesso continua até/.test(allText(r)) && r.j.ended === true, allText(r));
  ok('cancelar: cliente fictício ficou com cancel_at', r.j.state.__fixture_customer?.subscriptions?.find((s) => s.id === 'sim-sub-1')?.cancel_at === ymd(12), r.j.state.__fixture_customer?.subscriptions);
  c = convo(def, { crm_fixture: fixture('ok') });
  await c.start();
  await c.say('3');
  await c.say('2');
  await c.say('texto livre: mudei de cidade');
  r = await c.say('2');
  ok('cancelar → manter: texto de retenção e nenhuma ação', !has(r, 'crm_cancel_subscription') && /Que bom que você fica/.test(allText(r)), allText(r));

  // ---- 6. pausar 7 dias
  c = convo(def, { crm_fixture: fixture('ok') });
  await c.start();
  await c.say('4');
  r = await c.say('1');
  ok('pausar: pergunta quantos dias (até 30)', /Por quantos dias/.test(allText(r)) && /30/.test(allText(r)), allText(r));
  r = await c.say('45');
  ok('pausar: 45 dias (> máximo) → pede de novo', !has(r, 'crm_pause_subscription') && r.j.state.waiting_for === 'crm_pause', allText(r));
  r = await c.say('7 dias');
  ok('pausar: 7 dias → ação + "Pausado até"', findAct(r, 'crm_pause_subscription')?.days === 7 && new RegExp(`Pausado até ${dmy(ymd(7))}`).test(allText(r)), allText(r));

  // ---- 7. trocar de plano
  c = convo(def, { crm_fixture: fixture('ok') });
  await c.start();
  await c.say('5');
  r = await c.say('1');
  ok('trocar: lista só os outros planos', /Plano 300 Mega/.test(allText(r)) && !/Plano 100 Mega ·/.test(allText(r)), allText(r));
  r = await c.say('1');
  ok('trocar: confirmação com o plano novo', /Trocar para \*Plano 300 Mega\*/.test(allText(r)), allText(r));
  r = await c.say('1');
  ok('trocar: ação + "Plano trocado para *Plano 300 Mega*"', findAct(r, 'crm_change_plan')?.product_id === 'sim-prod-2' && /Plano trocado para \*Plano 300 Mega\*/.test(allText(r)), allText(r));

  // ---- 8. cadastro novo → assinar → pago
  c = convo(def, { crm_fixture: fixture('none') });
  r = await c.start();
  ok('não é cliente: vai para o cadastro (intro + nome)', /Vamos fazer seu cadastro/.test(allText(r)) && /nome completo/.test(allText(r)) && r.j.state.waiting_for === 'crm_register', allText(r));
  await c.say('Carlos Souza');
  r = await c.say('pular');
  ok('cadastro: campo obrigatório (CPF) não aceita "pular"', r.j.state.waiting_for === 'crm_register' && /CPF\/CNPJ não parece válido/.test(allText(r)), allText(r));
  r = await c.say(CPF_OK);
  ok('cadastro: opcional ganha "(ou responda *pular*)"', /pular/.test(allText(r)) && /e-mail/i.test(allText(r)), allText(r));
  r = await c.say('email-ruim');
  ok('cadastro: e-mail inválido → pede de novo', /e-mail não parece válido/.test(allText(r)), allText(r));
  await c.say('pular');
  r = await c.say('Centro');
  ok('cadastro: resumo para confirmar (CPF mascarado, sem e-mail pulado)', /Confira seus dados/.test(allText(r)) && /Nome: Carlos Souza/.test(allText(r)) && /\*\*\*\.982\.247-\*\*/.test(allText(r)) && !/E-mail:/.test(allText(r)) && /Bairro: Centro/.test(allText(r)), allText(r));
  r = await c.say('1');
  const created = findAct(r, 'crm_create_customer');
  ok('cadastro: ação crm_create_customer com os campos', created?.fields?.name === 'Carlos Souza' && created?.fields?.doc === CPF_OK && created?.fields?.['custom.bairro'] === 'Centro' && !created?.fields?.email, created);
  ok('cadastro concluído → bloco Assinar lista os planos', /Cadastro concluído/.test(allText(r)) && /Qual plano você quer/.test(allText(r)) && r.j.state.waiting_for === 'crm_subscribe', allText(r));
  ok('cliente fictício novo guardado no estado', r.j.state.__fixture_customer?.name === 'Carlos Souza' && r.j.state.__fixture_customer?.custom?.bairro === 'Centro', r.j.state.__fixture_customer);
  r = await c.say('1');
  ok('assinar: confirmação "Você escolheu *Plano 100 Mega* por *R$ 99,90* por mês"', /Você escolheu \*Plano 100 Mega\*/.test(allText(r)) && /por mês/.test(allText(r)), allText(r));
  r = await c.say('1');
  const subAct = findAct(r, 'crm_subscribe');
  const cardSub = findAct(r, 'charge');
  ok('assinar: ação crm_subscribe (pix, cobra agora, bloco)', subAct?.product_id === 'sim-prod-1' && subAct?.method === 'pix' && subAct?.charge_now === true && subAct?.node_id === 'sub', subAct);
  ok('assinar: pseudo-ação charge com PIX-SIMULADO e estado esperando a cobrança', /^sim-/.test(cardSub?.charge?.id || '') && /PIX-SIMULADO/.test(cardSub?.charge?.pix_code || '') && r.j.state.waiting_for === 'charge' && r.j.state.charge?.id === cardSub?.charge?.id, r.j);
  const chargeId = cardSub?.charge?.id;
  r = await c.say('paguei');
  ok('esperando cobrança: "paguei" → charge_check (info no simulador), estado igual', has(r, 'charge_check') && r.j.state.waiting_for === 'charge', r.j.actions);
  r = await c.event('charge_paid', { charge_id: 'outra-cobranca' });
  ok('charge_paid de outra cobrança → ignorado', r.j.state.waiting_for === 'charge' && /outra cobrança/.test(infos(r)), infos(r));
  r = await c.event('charge_paid', { charge_id: chargeId });
  ok('charge_paid → "Pagamento confirmado" + porta "pago" (boas-vindas) + fim', /Pagamento confirmado/.test(allText(r)) && /Bem-vindo\(a\) à Provedor Net, Carlos/.test(allText(r)) && r.j.ended === true, allText(r));
  ok('pago: cobrança sai das abertas do cliente fictício', !(r.j.state.__fixture_customer?.open_charges || []).some((o) => o.id === chargeId), r.j.state.__fixture_customer?.open_charges);

  // ---- 9. assinar → expirou / recusou
  const toSubscribe = async () => {
    const cc = convo(def, { crm_fixture: fixture('none') });
    await cc.start();
    for (const t of ['Ana Lima', CPF_OK, 'pular', 'pular', '1', '2']) await cc.say(t); // plano 2
    return cc;
  };
  c = await toSubscribe();
  r = await c.say('1');
  const card2 = findAct(r, 'charge');
  r = await c.event('charge_expired', { charge_id: card2?.charge?.id });
  ok('charge_expired → texto de vencida + porta "expired"', /cobrança venceu/.test(allText(r)) && r.j.ended === true, allText(r));
  c = await toSubscribe();
  r = await c.say('2');
  ok('assinar → "Agora não" → recusa sem ação de CRM', !has(r, 'crm_subscribe') && /mudar de ideia/.test(allText(r)) && r.j.ended === true, allText(r));

  // ---- 10. sem fixture: info + crm_wait + crm_result manual
  const askDoc = provedor('ask_doc');
  c = convo(askDoc);
  await c.start();
  r = await c.say(CPF_OK);
  ok('sem fixture: lookup vira info "Procuraria o cliente pelo CPF/CNPJ" e fica em crm_wait', /Procuraria o cliente pelo CPF\/CNPJ/.test(infos(r)) && !has(r, 'crm_lookup') && r.j.state.waiting_for === 'crm_wait', r.j);
  r = await c.event('crm_result', { ok: true, customers: [MARIA] });
  ok('sem fixture: crm_result manual (achou) → menu', /Olá, Maria/.test(allText(r)) && r.j.state.customer_id === MARIA.id, allText(r));
  r = await c.say('3');
  r = await c.say('1');
  r = await c.say('1');
  r = await c.say('1');
  ok('sem fixture: cancelar vira info "Cancelaria a assinatura" (estado em crm_wait)', /Cancelaria a assinatura/.test(infos(r)) && r.j.state.waiting_for === 'crm_wait', infos(r));
  r = await c.event('crm_result', { ok: false, error: 'teste' });
  ok('sem fixture: crm_result com erro → texto de falha', /não consegui concluir/i.test(allText(r)), allText(r));

  // ---- 11. validação / compatibilidade
  r = await sim({ definition: def, settings: {}, input: 'oi', crm_mode: 'xpto' });
  ok('DTO: crm_mode inválido → 400', LOCAL ? true : r.s === 400, r.j);
  r = await sim({ definition: def, settings: {}, state: { node_id: 'menu', status: 'waiting', waiting_for: 'menu' }, event: 'nada' });
  ok('evento desconhecido → 400', r.s === 400, r.j);
  const plain = { nodes: [N('s', 'start'), N('m', 'message', { messages: [{ id: 'a', kind: 'text', text: 'Oi {{nome}}! Tudo bem?' }] }), N('e', 'end', { text: 'Tchau', close: true })], edges: [E('s', 'out', 'm'), E('m', 'out', 'e')] };
  r = await sim({ definition: plain, settings: { typing: false }, input: 'oi' });
  ok('fluxo sem CRM: igual a antes (mensagem + fim, customer null)', r.s === 201 && /Oi Cliente Teste! Tudo bem\?/.test(allText(r)) && /Tchau/.test(allText(r)) && r.j.ended === true && r.j.customer === null, r.j);
}

// ---------------------------------------------------------------- dados reais (org temporária, só leitura)
async function orgScenarios(orgId) {
  const PHONE = '5500999990091';
  const DOC = '15350946056';
  let r = await call(orgTok, 'POST', '/whatsapp/products', { name: 'Fibra 200', price_cents: 8990, billing: 'monthly', cancel_policy: 'end_of_cycle' });
  const prodA = r.j?.id;
  ok('real: produto A criado', r.s === 201 && prodA, r.j);
  r = await call(orgTok, 'POST', '/whatsapp/products', { name: 'Fibra 500', price_cents: 12990, billing: 'monthly' });
  const prodB = r.j?.id;
  ok('real: produto B criado', r.s === 201 && prodB, r.j);
  r = await call(orgTok, 'POST', '/whatsapp/customers', { phone: PHONE, name: 'Rita Real', doc: DOC, email: 'rita@teste.local', custom: { bairro: 'Centro' } });
  const custId = r.j?.id;
  ok('real: cliente criado (telefone + CPF)', r.s === 201 && custId, r.j);
  r = await call(orgTok, 'POST', `/whatsapp/customers/${custId}/subscriptions`, { product_id: prodA, due_day: 10 });
  const subId = r.j?.subscription?.id;
  ok('real: assinatura criada sem cobrar (charge_now padrão false)', (r.s === 201 || r.s === 200) && subId, r.j?.subscription);
  // cobrança em atraso de 10 dias, sem gateway (só para a leitura do bot): base R$ 89,90
  const todayBRT = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const due = new Date(Date.parse(`${todayBRT}T12:00:00Z`) - 10 * 86400000).toISOString().slice(0, 10);
  sql(`INSERT INTO whatsapp_charges (id, organization_id, session_id, customer_id, subscription_id, product_id, chat_id, kind, amount_cents, base_amount_cents, description, due_at, status, origin, reminders, created_at, updated_at) VALUES (UUID(), '${orgId}', NULL, '${custId}', '${subId}', '${prodA}', '${PHONE}@c.us', 'pix', 8990, 8990, 'Fibra 200 — teste', '${due}', 'PENDING', 'manual', JSON_ARRAY(), NOW(3), NOW(3))`);
  const chargeId = sql(`SELECT id FROM whatsapp_charges WHERE organization_id='${orgId}' AND customer_id='${custId}' LIMIT 1`);
  ok('real: cobrança em atraso inserida', /^[0-9a-f-]{36}$/.test(chargeId), chargeId);

  const def = provedor('org');
  const real = (extra = {}) => convo(def, { crm_mode: 'org', crm_phone: PHONE, ...extra });
  let c = real();
  r = await c.start();
  ok('real: identifica pelo número (cliente da org) → menu com o primeiro nome', r.s === 201 && /Olá, Rita/.test(allText(r)) && r.j.state.customer_id === custId, r.j);
  const cust = r.j.customer;
  ok('real: BotCustomer no formato do contrato (doc mascarado, custom minúsculo, verified)', cust?.doc_masked === '***.509.460-**' && cust?.custom?.bairro === 'Centro' && cust?.verified === true && cust?.first_name === 'Rita', cust);
  ok('real: assinatura no formato do bot (produto, preço, vencimento YYYY-MM-DD)', cust?.subscriptions?.[0]?.product_name === 'Fibra 200' && cust.subscriptions[0].price_cents === 8990 && /^\d{4}-\d{2}-\d{2}$/.test(cust.subscriptions[0].next_due_at || ''), cust?.subscriptions);
  const oc = cust?.open_charges?.[0];
  ok('real: cobrança aberta com multa + juros (2% + 1% a.m. × 10 dias) e 10 dias de atraso', oc?.id === chargeId && oc.days_overdue === 10 && oc.amount_cents === 8990 + Math.ceil(8990 * 2 / 100) + Math.ceil(8990 * 1 * 10 / 100 / 30), oc);
  ok('real: status do cliente = overdue (cobrança vencida)', cust?.status === 'overdue', cust?.status);
  r = await c.say('1');
  ok('real: status (crm_info) mostra "em atraso" e o plano', /em atraso/.test(allText(r)) && /Fibra 200/.test(allText(r)), allText(r));

  c = real();
  await c.start();
  r = await c.say('2');
  ok('real: 2ª via mostra a cobrança real e NÃO envia (info)', findAct(r, 'charge')?.charge?.id === chargeId && /NÃO foi enviada/.test(infos(r)) && /2ª via/.test(allText(r)), r.j.actions);

  c = real();
  await c.start();
  for (const t of ['3', '1']) await c.say(t);
  r = await c.say('1');
  ok('real: cancelar → escrita vira info, estado em crm_wait', /nada é gravado/.test(infos(r)) && r.j.state.waiting_for === 'crm_wait', infos(r));
  ok('real: assinatura continua ativa no banco (nada gravado)', sql(`SELECT CONCAT(status,'|',IFNULL(cancel_at,'-')) FROM whatsapp_subscriptions WHERE id='${subId}'`) === 'active|-', sql(`SELECT CONCAT(status,'|',IFNULL(cancel_at,'-')) FROM whatsapp_subscriptions WHERE id='${subId}'`));

  // lookup real por CPF (outro número, org exigindo documento)
  c = convo(provedor('ask_doc'), { crm_mode: 'org', crm_phone: '5500999990099' });
  r = await c.start();
  ok('real (ask_doc): número sem cadastro → pede o CPF', r.j.state.waiting_for === 'crm_identify', allText(r));
  r = await c.say('529.982.247-25');
  ok('real: CPF que não é da org → não encontrado (cadastro)', /Não encontrei um cadastro/.test(allText(r)) || r.j.state.waiting_for === 'crm_register', allText(r));
  c = convo(provedor('ask_doc'), { crm_mode: 'org', crm_phone: '5500999990099' });
  await c.start();
  r = await c.say(DOC);
  ok('real: CPF do cliente → achou pelo hash → menu "Olá, Rita"', /Olá, Rita/.test(allText(r)) && r.j.state.customer_id === custId, allText(r));
  ok('real: lookup do simulador NÃO vincula o número', sql(`SELECT COUNT(*) FROM whatsapp_customer_contacts WHERE customer_id='${custId}'`) === '1');

  // menu de produtos com os produtos reais
  const menuDef = { nodes: [N('s', 'start'), N('m', 'menu', { text: 'Escolha:', source: 'products' }), N('e', 'end', { text: 'ok', close: true })], edges: [E('s', 'out', 'm'), E('m', 'invalid', 'e')] };
  r = await sim({ definition: menuDef, settings: { typing: false }, input: 'oi' });
  ok('real: menu source=products lista os produtos da org (sem fixture)', /Fibra 200/.test(allText(r)) && /Fibra 500/.test(allText(r)) && /R\$/.test(allText(r)), allText(r));
  void prodB;
}


// ---------------------------------------------------------------- AGENDA (Fase 6)
const SVA = { id: 'svc-a', name: 'Consulta', price_cents: 15000, price_label: 'R$ 150,00', duration_minutes: 30, duration_label: '30 min', booking: { payment: 'on_site', address: 'Rua Exemplo, 100' }, resources: [{ id: 'r1', name: 'Dra. Ana' }, { id: 'r2', name: 'Dr. Bruno' }] };
const SVB = { id: 'svc-b', name: 'Avaliação', price_cents: 8000, price_label: 'R$ 80,00', duration_minutes: 60, duration_label: '1 h', booking: { payment: 'on_booking' }, resources: [{ id: 'r1', name: 'Dra. Ana' }] };
const brtAt = (days, hm) => new Date(Date.parse(`${ymd(days)}T${hm}:00-03:00`)).toISOString();
const APPTS = [
  { id: 'ap-1', status: 'booked', payment: 'on_site', starts_at: brtAt(2, '10:00'), resource: { id: 'r1', name: 'Dra. Ana' }, product_id: 'svc-a', service_name: 'Consulta', price_cents: 15000, cancel_deadline: brtAt(1, '10:00'), can_cancel_free: false, can_reschedule: true },
  { id: 'ap-2', status: 'confirmed', payment: 'on_site', starts_at: brtAt(4, '15:00'), resource: { id: 'r2', name: 'Dr. Bruno' }, product_id: 'svc-a', service_name: 'Consulta', price_cents: 15000, cancel_deadline: brtAt(3, '15:00'), can_cancel_free: true, can_reschedule: true },
];
function agendaFlow() {
  return {
    nodes: [
      N('start', 'start'),
      N('bk', 'book_service', { title: 'Agendar', resource: 'ask', days_ahead: 14 }),
      N('wl', 'waitlist_join', { title: 'Espera', product_id: 'current', period: 'ask' }),
      N('ok', 'end', { text: 'FIM-AGENDOU', close: true }),
      N('fim', 'end', { text: 'FIM', close: true }),
    ],
    edges: [E('start', 'out', 'bk'), E('bk', 'booked', 'ok'), E('bk', 'no_slots', 'wl'), E('bk', 'expired', 'fim'), E('bk', 'cancel', 'fim'), E('wl', 'out', 'fim')],
  };
}
async function agendaScenarios() {
  const def = agendaFlow();
  // ---- agendar com pagamento no local, escolhendo profissional
  let c = convo(def, { book_fixture: { services: [SVA, SVB] } });
  let r = await c.start();
  ok('agenda: lista os serviços', r.s === 201 && /Consulta · R\$.150,00 · 30 min/.test(allText(r)) && r.j.state.waiting_for === 'book:service', r.j);
  r = await c.say('1');
  ok('agenda: pergunta com quem (+ tanto faz)', /Dra\. Ana/.test(allText(r)) && /Tanto faz/.test(allText(r)), allText(r));
  r = await c.say('Dr. Bruno');
  ok('agenda: lista de dias "· N horários"', /· \d+ horários/.test(allText(r)) && r.j.state.waiting_for === 'book:day', allText(r));
  r = await c.say('1');
  ok('agenda: lista de horários + "Outro dia"', /Outro dia/.test(allText(r)) && r.j.state.waiting_for === 'book:time', allText(r));
  r = await c.say('1');
  ok('agenda: confirmação com profissional e "pagamento no local"', /Dr\. Bruno/.test(allText(r)) && /pagamento no local/.test(allText(r)) && r.j.state.waiting_for === 'book:confirm', allText(r));
  r = await c.say('1');
  ok('agenda: confirmou → "Agendado ✅" + porta booked', /Agendado ✅ \*Consulta\*/.test(allText(r)) && /FIM-AGENDOU/.test(allText(r)) && r.j.ended === true, allText(r));
  ok('agenda: agendamento fictício guardado no estado', (r.j.state.__fixture_appts || []).some((a) => a.status === 'booked' && a.resource?.name === 'Dr. Bruno'), r.j.state.__fixture_appts);

  // ---- PIX na reserva → pagou
  c = convo(def, { book_fixture: { services: [SVB], payment: 'on_booking' } });
  await c.start();
  await c.say('1'); // dia (1 serviço e 1 profissional: não pergunta)
  await c.say('1'); // horário
  r = await c.say('sim');
  ok('agenda: PIX na reserva → cartão da cobrança + espera o pagamento', has(r, 'charge') && r.j.state.waiting_for === 'charge' && /pague/.test(allText(r)), r.j);
  r = await c.say('oi');
  ok('agenda: mensagem durante a espera → "aguardando o pagamento"', /aguardando o pagamento/.test(allText(r)) && r.j.state.waiting_for === 'charge', allText(r));
  r = await c.event('charge_paid', { charge_id: c.state.charge.id });
  ok('agenda: pagou → "Pagamento confirmado" + porta booked', /Pagamento confirmado ✅/.test(allText(r)) && /FIM-AGENDOU/.test(allText(r)), allText(r));
  // expirou
  c = convo(def, { book_fixture: { services: [SVB], payment: 'on_booking' } });
  await c.start();
  await c.say('1');
  await c.say('1');
  await c.say('1');
  r = await c.event('charge_expired', { charge_id: c.state.charge.id });
  ok('agenda: expirou → texto + porta expired', /horário foi liberado/.test(allText(r)) && /FIM/.test(allText(r)), allText(r));

  // ---- agenda lotada → lista de espera
  c = convo(def, { book_fixture: { services: [SVA], no_slots: true } });
  await c.start();
  r = await c.say('3'); // tanto faz
  ok('agenda: lotada → aviso + pergunta o período da lista de espera', /Não encontrei horários/.test(allText(r)) && /Qual período/.test(allText(r)) && r.j.state.waiting_for === 'book:period', allText(r));
  r = await c.say('tarde');
  ok('agenda: entrou na lista de espera de "Consulta"', /lista de espera de \*Consulta\*/.test(allText(r)) && /FIM/.test(allText(r)), allText(r));

  // ---- conflito na 1ª reserva
  c = convo(def, { book_fixture: { services: [SVA], conflict: true } });
  await c.start();
  await c.say('3');
  await c.say('1');
  await c.say('1');
  r = await c.say('1');
  ok('agenda: conflito → aviso e horários de novo', /acabou de ser reservado/.test(allText(r)) && r.j.state.waiting_for === 'book:time', allText(r));
  await c.say('1');
  r = await c.say('1');
  ok('agenda: 2ª tentativa agenda', /Agendado ✅/.test(allText(r)), allText(r));

  // ---- Meus agendamentos
  const defM = { nodes: [N('start', 'start'), N('ma', 'my_appointments', { title: 'Meus' }), N('fim', 'end', { text: 'FIM', close: true })], edges: [E('start', 'out', 'ma'), E('ma', 'out', 'fim'), E('ma', 'none', 'fim')] };
  c = convo(defM, { book_fixture: { services: [SVA], appointments: APPTS } });
  r = await c.start();
  ok('meus: lista os 2 agendamentos', /Consulta · Dra\. Ana/.test(allText(r)) && /Consulta · Dr\. Bruno/.test(allText(r)) && r.j.state.waiting_for === 'appt:choose', allText(r));
  r = await c.say('1');
  ok('meus: ações (confirmar/remarcar/cancelar)', /Confirmar presença/.test(allText(r)) && /Remarcar/.test(allText(r)) && /Cancelar/.test(allText(r)), allText(r));
  r = await c.say('cancelar');
  ok('meus: cancelar fora do prazo avisa a política', /prazo para cancelar sem custo terminou/.test(allText(r)), allText(r));
  r = await c.say('1');
  ok('meus: cancelado → texto + fim', /Agendamento cancelado/.test(allText(r)) && /FIM/.test(allText(r)), allText(r));
  c = convo(defM, { book_fixture: { services: [SVA], appointments: APPTS } });
  await c.start();
  await c.say('2');
  r = await c.say('remarcar');
  ok('meus: remarcar → dias', r.j.state.waiting_for === 'book:day', allText(r));
  await c.say('1');
  r = await c.say('1');
  ok('meus: confirmação mostra a data anterior', /de .+ às 15:00 para/.test(allText(r)), allText(r));
  r = await c.say('1');
  ok('meus: remarcado', /Remarcado ✅/.test(allText(r)), allText(r));
  c = convo(defM, { book_fixture: { services: [SVA], appointments: [] } });
  r = await c.start();
  ok('meus: sem agendamentos → texto', /não tem agendamentos/.test(allText(r)), allText(r));
}

// ---------------------------------------------------------------- CHAMADOS (Fase 6B)
const TCATS = [
  { key: 'duvida', label: 'Dúvida', active: true },
  { key: 'problema', label: 'Problema / reclamação', active: true },
  { key: 'antiga', label: 'Categoria antiga', active: false },
];
const TKS = [
  { id: 'tk-1', protocol: '2026000041', status: 'pending', category: 'problema', category_label: 'Problema / reclamação', subject: 'Internet caindo', sla_label: '20/10 às 18:00', last_update: 'Pode mandar uma foto do roteador?' },
  { id: 'tk-2', protocol: '2026000039', status: 'open', category: 'duvida', category_label: 'Dúvida', subject: 'Fatura', sla_label: '21/10 às 09:00' },
  { id: 'tk-3', protocol: '2025000007', status: 'closed', category: 'duvida', category_label: 'Dúvida', subject: 'Antigo' },
];
function ticketFlow() {
  return {
    nodes: [
      N('start', 'start'),
      N('ot', 'open_ticket', { title: 'Abrir chamado', category: 'ask', ask_photo: true }),
      N('ok', 'message', { messages: [{ id: 'm1', kind: 'text', text: 'FIM-CHAMADO {{chamado.protocolo}} · {{chamado.categoria}} · {{chamado.status}}' }] }),
      N('fim', 'end', { text: 'FIM', close: true }),
      N('err', 'end', { text: 'FIM-ERRO', close: true }),
    ],
    edges: [E('start', 'out', 'ot'), E('ot', 'out', 'ok'), E('ok', 'out', 'fim'), E('ot', 'cancel', 'fim'), E('ot', 'failed', 'err')],
  };
}
async function ticketScenarios() {
  const def = ticketFlow();
  // ---- abrir chamado completo
  let c = convo(def, { crm_fixture: { tickets: { categories: TCATS } } });
  let r = await c.start();
  ok('chamado: lista só as categorias ativas', r.s === 201 && /Dúvida/.test(allText(r)) && /Problema \/ reclamação/.test(allText(r)) && !/antiga/.test(allText(r)) && r.j.state.waiting_for === 'ticket:category', r.j);
  r = await c.say('2');
  ok('chamado: pede a descrição', /Descreva o que aconteceu/.test(allText(r)) && r.j.state.waiting_for === 'ticket:description', allText(r));
  r = await c.say('ok');
  ok('chamado: descrição curta → pede mais detalhe', /pelo menos 5 caracteres/.test(allText(r)), allText(r));
  r = await c.say('A internet cai toda noite depois das 22h');
  ok('chamado: pede fotos', /até 3 fotos/.test(allText(r)) && r.j.state.waiting_for === 'ticket:photo', allText(r));
  r = await c.media({ kind: 'image', filename: 'roteador.jpg' });
  ok('chamado: foto fictícia recebida (1 de 3)', /Recebi ✅ \(1 de 3\)/.test(allText(r)) && r.j.state.ticket.media_ids.length === 1 && !r.j.state.__sim_media, allText(r));
  r = await c.media({ kind: 'image', failed: true });
  ok('chamado: arquivo que não baixou → pede de novo', /Não consegui receber/.test(allText(r)) && r.j.state.ticket.media_ids.length === 1, allText(r));
  r = await c.say('pronto');
  const proto = (allText(r).match(/Protocolo: \*(\d{10})\*/) || [])[1];
  ok('chamado: aberto → protocolo + prazo no texto', Boolean(proto) && /Prazo para retorno/.test(allText(r)), allText(r));
  ok('chamado: {{chamado.*}} no bloco seguinte', new RegExp(`FIM-CHAMADO ${proto} · Problema / reclamação · Aberto`).test(allText(r)) && r.j.ended === true, allText(r));
  ok('chamado: fictício guardado no estado (1 anexo), nada gravado', (r.j.state.__fixture_tickets || []).some((t) => t.protocol === proto && t.media_count === 1) && /nada foi gravado/.test(infos(r)), r.j.state.__fixture_tickets);
  // ---- "0" cancela no menu de categorias
  c = convo(def, { crm_fixture: { tickets: { categories: TCATS } } });
  await c.start();
  r = await c.say('0');
  ok('chamado: "0" nas categorias → desistência + fim', /não abri nenhum chamado/.test(allText(r)) && /FIM/.test(allText(r)), allText(r));
  // ---- falha ao abrir
  c = convo(def, { crm_fixture: { tickets: { categories: TCATS, fail_create: true } } });
  await c.start();
  await c.say('1');
  await c.say('Dúvida sobre o vencimento da fatura');
  r = await c.say('0');
  ok('chamado: falha ao abrir → porta "Deu erro"', /FIM-ERRO/.test(allText(r)), allText(r));
  // ---- Meus chamados
  const defM = {
    nodes: [N('start', 'start'), N('mt', 'my_tickets', { title: 'Meus chamados', show: 'active', allow_add_info: true }), N('fim', 'end', { text: 'FIM', close: true }), N('none', 'end', { text: 'FIM-NENHUM', close: true })],
    edges: [E('start', 'out', 'mt'), E('mt', 'out', 'fim'), E('mt', 'none', 'none')],
  };
  c = convo(defM, { crm_fixture: { tickets: { tickets: TKS } } });
  r = await c.start();
  ok('meus chamados: lista só os em andamento + "digite o protocolo"', /2026000041/.test(allText(r)) && /2026000039/.test(allText(r)) && !/2025000007/.test(allText(r)) && /protocolo/.test(allText(r)) && r.j.state.waiting_for === 'ticket:choose', allText(r));
  r = await c.say('1');
  ok('meus chamados: detalhes com situação "Aguardando você" e última atualização', /Aguardando você/.test(allText(r)) && /foto do roteador/.test(allText(r)) && /Enviar mais informações/.test(allText(r)) && r.j.state.waiting_for === 'ticket:action', allText(r));
  r = await c.say('1');
  ok('meus chamados: pede a informação', /junto ao protocolo \*2026000041\*/.test(allText(r)) && r.j.state.waiting_for === 'ticket:info', allText(r));
  r = await c.media({ kind: 'image' }, 'foto do roteador');
  ok('meus chamados: foto juntada → texto + fim (nada gravado)', /Juntei sua mensagem/.test(allText(r)) && /FIM/.test(allText(r)) && /nada foi gravado/.test(infos(r)), allText(r));
  c = convo(defM, { crm_fixture: { tickets: { tickets: TKS } } });
  await c.start();
  r = await c.say('2026-000999');
  ok('meus chamados: protocolo de outra pessoa → "não encontrei"', /Não encontrei esse protocolo/.test(allText(r)) && r.j.state.waiting_for === 'ticket:choose', allText(r));
  r = await c.say('2026000039');
  ok('meus chamados: protocolo digitado da lista → detalhes', /Protocolo \*2026000039\*/.test(allText(r)), allText(r));
  c = convo(defM, { crm_fixture: { tickets: { tickets: [{ ...TKS[1], can_add_info: false }] } } });
  r = await c.start();
  ok('meus chamados: só leitura (código) → sem "enviar mais informações"', /2026000039/.test(allText(r)) && !/Enviar mais informações/.test(allText(r)) && /FIM/.test(allText(r)), allText(r));
  c = convo(defM, { crm_fixture: { tickets: { tickets: [TKS[2]] } } });
  r = await c.start();
  ok('meus chamados: nenhum em andamento → porta "sem chamados"', /não tem chamados/.test(allText(r)) && /FIM-NENHUM/.test(allText(r)), allText(r));
  // ---- condição "tem chamado aberto"
  const defC = {
    nodes: [N('start', 'start'), N('c', 'condition', { rules: [{ source: 'ticket', key: 'has_open', op: 'is', value: 'true' }] }), N('t', 'end', { text: 'TEM-ABERTO {{chamado.protocolo}}', close: true }), N('f', 'end', { text: 'SEM-ABERTO', close: true })],
    edges: [E('start', 'out', 'c'), E('c', 'true', 't'), E('c', 'false', 'f')],
  };
  r = await convo(defC, { crm_fixture: { tickets: { tickets: TKS } } }).start();
  ok('condição: tem chamado aberto → sim (+ {{chamado.protocolo}})', /TEM-ABERTO 2026000041/.test(allText(r)), allText(r));
  r = await convo(defC, { crm_fixture: { tickets: { tickets: [TKS[2]] } } }).start();
  ok('condição: só encerrado → não', /SEM-ABERTO/.test(allText(r)), allText(r));
}

// ---------------------------------------------------------------- PEDIDOS + CAMPOS PERSONALIZADOS (Fase 7)
const OCAT = {
  categories: [
    { name: 'Lanches', products: [{ id: 'sim-p1', name: 'X-Burguer', price_cents: 2500 }, { id: 'sim-p2', name: 'X-Salada', price_cents: 2800 }] },
    { name: 'Bebidas', products: [{ id: 'sim-p3', name: 'Refrigerante lata', price_cents: 600 }] },
  ],
};
const OSET = { enabled: true, delivery: { enabled: true, fee_cents: 500, free_from_cents: 0 }, pickup: { enabled: true, address: 'Rua Exemplo, 100' }, min_order_cents: 0, payment_methods: ['pix', 'on_delivery'], max_items: 30 };
const OCF = {
  customer: [{ key: 'plano_saude', label: 'Plano de saúde', type: 'select', options: ['Unimed', 'Amil'], required: true, ask_in_bot: true, visible_to_customer: true }],
  ticket: [{ key: 'contrato', label: 'Nº do contrato', type: 'number', required: true, ask_in_bot: true, visible_to_customer: true }],
  order: [{ key: 'tamanho', label: 'Tamanho', type: 'select', options: ['P', 'M', 'G'], required: true, ask_in_bot: true, visible_to_customer: true }],
};
const OADDR = { id: 'sim-a1', kind: 'delivery', label: 'Casa', street: 'Rua das Flores', number: '10', district: 'Centro', city: 'São Paulo', state: 'SP' };
function orderFlow() {
  return {
    nodes: [
      N('start', 'start'),
      N('oc', 'order_cart', { title: 'Fazer pedido', categories: 'all', payment: 'ask', ask_notes: true }),
      N('pago', 'end', { text: 'FIM-PAGO #{{pedido.numero}} {{pedido.status}}', close: true }),
      N('out', 'end', { text: 'FIM-OUT #{{pedido.numero}}', close: true }),
      N('exp', 'end', { text: 'FIM-EXPIROU', close: true }),
      N('can', 'end', { text: 'FIM-DESISTIU', close: true }),
      N('err', 'end', { text: 'FIM-ERRO', close: true }),
    ],
    edges: [E('start', 'out', 'oc'), E('oc', 'paid', 'pago'), E('oc', 'out', 'out'), E('oc', 'expired', 'exp'), E('oc', 'canceled', 'can'), E('oc', 'failed', 'err')],
  };
}
async function orderScenarios() {
  const def = orderFlow();
  const fx = { catalog: OCAT, order_settings: OSET, custom_fields: OCF, addresses: [OADDR] };
  // ---- pedido completo com PIX
  let c = convo(def, { crm_fixture: fx });
  let r = await c.start();
  ok('pedido: catálogo da fixture → categorias', r.s === 201 && /Lanches \(2\)/.test(allText(r)) && /Bebidas \(1\)/.test(allText(r)) && r.j.state.waiting_for === 'order:category', r.j);
  r = await c.say('1');
  ok('pedido: produtos com preço', /X-Burguer · R\$\s25,00/.test(allText(r)) && r.j.state.waiting_for === 'order:product', allText(r));
  r = await c.say('1');
  r = await c.say('2');
  ok('pedido: carrinho', /2× X-Burguer/.test(allText(r)) && /Finalizar pedido/.test(allText(r)) && r.j.state.waiting_for === 'order:cart', allText(r));
  r = await c.say('2');
  ok('pedido: entrega ou retirada', /Entrega \(taxa R\$\s5,00\)/.test(allText(r)) && r.j.state.waiting_for === 'order:delivery', allText(r));
  r = await c.say('1');
  ok('pedido: endereço salvo oferecido', /Rua das Flores, 10/.test(allText(r)) && r.j.state.waiting_for === 'order:address', allText(r));
  r = await c.say('1');
  ok('pedido: campo do pedido perguntado (fixture)', /Tamanho/.test(allText(r)) && r.j.state.waiting_for === 'order:custom', allText(r));
  r = await c.say('3');
  ok('pedido: pede a observação', r.j.state.waiting_for === 'order:notes', r.j.state);
  r = await c.say('pular');
  r = await c.say('1');
  ok('pedido: resumo com total e campo', /Total: R\$\s55,00/.test(allText(r)) && /\*Tamanho:\* G/.test(allText(r)) && r.j.state.waiting_for === 'order:confirm', allText(r));
  r = await c.say('1');
  const ch = findAct(r, 'charge');
  ok('pedido: PIX fictício (cartão da cobrança) + "recebido", nada gravado', ch && /^PIX-SIMULADO-/.test(ch.charge.pix_code) && /recebido/.test(allText(r)) && r.j.state.waiting_for === 'charge' && /nada foi gravado/.test(infos(r)), r.j);
  r = await c.event('charge_paid', { charge_id: ch?.charge?.id });
  ok('pedido: pagou → texto de pago + porta "pago" com o pedido confirmado', /confirmado/.test(allText(r)) && /FIM-PAGO #\d+ Confirmado/.test(allText(r)), allText(r));
  // ---- pagar na entrega + retirada
  c = convo(def, { crm_fixture: { ...fx, custom_fields: {} } });
  await c.start();
  for (const x of ['2', '1', '1', '2', '2']) r = await c.say(x);
  ok('pedido: retirada (sem endereço)', r.j.state.order.delivery === 'pickup' && r.j.state.waiting_for === 'order:notes', r.j.state);
  r = await c.say('sem gelo');
  r = await c.say('2');
  ok('pedido: "Pagar na retirada"', /Na retirada/.test(allText(r)), allText(r));
  r = await c.say('1');
  ok('pedido: na entrega → porta out, sem cobrança', /FIM-OUT #\d+/.test(allText(r)) && !findAct(r, 'charge'), allText(r));
  // ---- desistir / falha / expirar
  c = convo(def, { crm_fixture: fx });
  await c.start();
  r = await c.say('cancelar');
  ok('pedido: cancelar → porta "desistiu"', /FIM-DESISTIU/.test(allText(r)), allText(r));
  c = convo(def, { crm_fixture: { ...fx, custom_fields: {}, fail_create: true } });
  await c.start();
  for (const x of ['1', '1', '1', '2', '2', 'pular', '2']) r = await c.say(x);
  r = await c.say('1');
  ok('pedido: falha ao criar → "deu erro"', /FIM-ERRO/.test(allText(r)), allText(r));
  c = convo(def, { crm_fixture: { ...fx, custom_fields: {} } });
  await c.start();
  for (const x of ['1', '1', '1', '2', '2', 'pular', '1']) r = await c.say(x);
  r = await c.say('1');
  const ch2 = findAct(r, 'charge');
  r = await c.event('charge_expired', { charge_id: ch2?.charge?.id });
  ok('pedido: PIX expirou → porta "expirou"', /não foi pago a tempo/.test(allText(r)) && /FIM-EXPIROU/.test(allText(r)), allText(r));
  // ---- meus pedidos (fixture) com campo visível
  const defM = { nodes: [N('start', 'start'), N('mo', 'my_orders', { show: 'open' }), N('fim', 'end', { text: 'FIM', close: true }), N('none', 'end', { text: 'FIM-NENHUM', close: true })], edges: [E('start', 'out', 'mo'), E('mo', 'out', 'fim'), E('mo', 'none', 'none')] };
  const ORDS = [
    { id: 'o-1', number: 1234, status: 'preparing', payment_method: 'pix', payment_status: 'paid', items_text: '2× X-Burguer — R$ 50,00', total_cents: 5500, delivery_text: '🛵 Entrega', created_at: '2026-10-13T14:00:00Z', custom: { tamanho: 'G' } },
    { id: 'o-2', number: 1235, status: 'new', payment_method: 'on_delivery', payment_status: 'not_required', items_text: '1× X-Salada — R$ 28,00', total_cents: 2800, delivery_text: '🏪 Retirada', created_at: '2026-10-13T15:00:00Z' },
    { id: 'o-3', number: 1100, status: 'delivered', payment_method: 'pix', payment_status: 'paid', items_text: '1× Refrigerante', total_cents: 600, created_at: '2026-10-01T15:00:00Z' },
  ];
  c = convo(defM, { crm_fixture: { orders: ORDS, custom_fields: OCF } });
  r = await c.start();
  ok('meus pedidos: lista só os em andamento', /#1234 · Em preparo/.test(allText(r)) && /#1235 · Recebido/.test(allText(r)) && !/#1100/.test(allText(r)) && r.j.state.waiting_for === 'order:choose', allText(r));
  r = await c.say('1');
  ok('meus pedidos: detalhes com o campo visível', /Pedido \*#1234\*/.test(allText(r)) && /\*Tamanho:\* G/.test(allText(r)) && /FIM/.test(allText(r)), allText(r));
  r = await convo(defM, { crm_fixture: { orders: [ORDS[2]] } }).start();
  ok('meus pedidos: nenhum em andamento → "sem pedidos"', /FIM-NENHUM/.test(allText(r)), allText(r));
  // ---- condição de pedido
  const defC = { nodes: [N('start', 'start'), N('c', 'condition', { rules: [{ source: 'order', key: 'has_open_order', op: 'is', value: 'true' }] }), N('t', 'end', { text: 'TEM-PEDIDO {{pedido.numero}}', close: true }), N('f', 'end', { text: 'SEM-PEDIDO', close: true })], edges: [E('start', 'out', 'c'), E('c', 'true', 't'), E('c', 'false', 'f')] };
  r = await convo(defC, { crm_fixture: { orders: ORDS } }).start();
  ok('condição: tem pedido em andamento', /TEM-PEDIDO 1234/.test(allText(r)), allText(r));
  r = await convo(defC, { crm_fixture: { orders: [ORDS[2]] } }).start();
  ok('condição: só entregue → não', /SEM-PEDIDO/.test(allText(r)), allText(r));
  // ---- campos personalizados perguntados no cadastro e no chamado
  const defR = { nodes: [N('start', 'start'), N('reg', 'crm_register', { fields: [{ key: 'name', label: 'Nome' }], confirm: true }), N('fim', 'end', { text: 'FIM-CAD {{cliente.custom.plano_saude}}', close: true })], edges: [E('start', 'out', 'reg'), E('reg', 'done', 'fim')] };
  c = convo(defR, { crm_fixture: { customer: null, custom_fields: OCF } });
  await c.start();
  r = await c.say('Maria Souza');
  ok('cadastro: pergunta o campo do cliente com as opções', /Plano de saúde/.test(allText(r)) && /Amil/.test(allText(r)), allText(r));
  r = await c.say('2');
  ok('cadastro: resumo com o campo', /Plano de saúde: Amil/.test(allText(r)), allText(r));
  r = await c.say('1');
  ok('cadastro: cliente fictício com o campo', /FIM-CAD Amil/.test(allText(r)), allText(r));
  const defT = { nodes: [N('start', 'start'), N('ot', 'open_ticket', { category: 'duvida', ask_photo: false }), N('fim', 'end', { text: 'FIM {{chamado.protocolo}}', close: true })], edges: [E('start', 'out', 'ot'), E('ot', 'out', 'fim')] };
  c = convo(defT, { crm_fixture: { custom_fields: OCF, tickets: { categories: TCATS } } });
  await c.start();
  r = await c.say('Minha dúvida é sobre a fatura do mês');
  ok('chamado: pergunta o campo do chamado', /Nº do contrato/.test(allText(r)) && r.j.state.waiting_for === 'ticket:custom', allText(r));
  r = await c.say('4567');
  ok('chamado: aberto com o campo (fictício)', /Chamado aberto/.test(allText(r)) && (r.j.state.__fixture_tickets || []).some((t) => (t.fields || []).some((f) => f.display === '4.567')), r.j.state.__fixture_tickets);
}

// ---------------------------------------------------------------- main
let orgId = null;
try {
  if (!LOCAL) {
    const stamp = Date.now().toString(36);
    const r = await call(saTok, 'POST', '/admin/clients', { name: 'WA Bot CRM Owner', email: `wa-botcrm-${stamp}@teste.local`, password: 'Senha!Teste123', org_name: `E2E WA Bot CRM ${stamp}`, modules: ['whatsapp', 'settings'], price_cents: 0 });
    orgId = r.j?.organization?.id;
    const ownerId = r.j?.user?.id;
    ok('org temporária criada', r.s === 201 && orgId && ownerId, r.j);
    orgTok = globalThis.__sign({ id: ownerId, org: orgId, role: 'OWNER' });
  }
  await simulatorScenarios();
  await agendaScenarios();
  await ticketScenarios();
  await orderScenarios();
  if (!LOCAL) await orgScenarios(orgId);
} catch (e) {
  fails++;
  console.log('ERRO', e?.stack || e);
} finally {
  if (orgId) {
    const r = await call(saTok, 'DELETE', `/admin/organizations/${orgId}`);
    ok('org temporária apagada', r.s === 200 || r.s === 204, r.j);
    ok('nada da org ficou (clientes/assinaturas/cobranças/produtos)', ['whatsapp_customers', 'whatsapp_subscriptions', 'whatsapp_charges', 'whatsapp_products', 'whatsapp_contacts'].every((t) => sql(`SELECT COUNT(*) FROM ${t} WHERE organization_id='${orgId}'`) === '0'));
  }
  console.log(`\n${total - fails}/${total} passaram${fails ? ` — ${fails} FALHAS` : ''}`);
  process.exit(fails ? 1 : 0);
}
