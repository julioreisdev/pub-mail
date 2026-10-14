#!/usr/bin/env node
// Teste em Node do motor PURO do Fluxo do Bot (wa-bot.engine.ts) — Fase 7 (contrato §11.1 e §11.3):
// order_cart (catálogo → produtos paginados → quantidade → carrinho → entrega/retirada → endereço → campos do pedido →
// observação → pagamento → resumo → cria; PIX → espera a cobrança) · my_orders (lista → detalhes) · condição
// `source:'order'` · campos personalizados perguntados pelo bot (cadastro de cliente, chamado, pedido) e mostrados nas
// consultas ("Meus dados", "Meus chamados", "Meus pedidos").
//
// Compilar o motor (CommonJS) antes:
//   cd back && npx tsc src/whatsapp/bot/wa-bot.engine.ts src/whatsapp/wa-doc.util.ts src/whatsapp/wa-custom-fields.util.ts \
//     --outDir /tmp/wa-engine --module commonjs --target es2022 --moduleResolution node --esModuleInterop --skipLibCheck --strictNullChecks
// Rodar:
//   ENGINE_DIR=/tmp/wa-engine node docs/tools/wa_bot_order_test.mjs
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const dir = process.env.ENGINE_DIR || '/tmp/wa-engine';
const E = require(path.join(dir, 'bot', 'wa-bot.engine.js'));
const { startFlow, handleInput, handleEvent, validateDefinition, fillVars } = E;

let pass = 0;
let fail = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) pass += 1;
  else {
    fail += 1;
    failures.push(name + (extra ? ` :: ${typeof extra === 'string' ? extra : JSON.stringify(extra).slice(0, 600)}` : ''));
  }
}

let seq = 0;
const nid = (p) => `${p}-${++seq}`;
const node = (type, data = {}, id) => ({ id: id || nid(type), type, data, position: { x: 0, y: 0 } });
const edge = (source, handle, target) => ({ id: nid('e'), source, sourceHandle: handle, target });
const flow = (nodes, edges) => ({ nodes, edges });
const texts = (actions) => (actions || []).filter((a) => a.type === 'send').map((a) => a.message.text || '');
const allText = (actions) => texts(actions).join('\n---\n');
const act = (actions, type) => (actions || []).find((a) => a.type === type) || null;
const endedAt = (actions) => (allText(actions).match(/END:([a-z_-]+)/) || [])[1] || null;

const ORDER_CF = [
  { key: 'tamanho', label: 'Tamanho', type: 'select', options: ['P', 'M', 'G'], required: true, ask_in_bot: true, visible_to_customer: true },
  { key: 'referencia', label: 'Ponto de referência', type: 'text', required: false, ask_in_bot: true, visible_to_customer: false },
  { key: 'interno', label: 'Código interno', type: 'text', required: false, ask_in_bot: false },
];
const CUST_CF = [
  { key: 'plano_saude', label: 'Plano de saúde', type: 'select', options: ['Unimed', 'Amil'], required: true, ask_in_bot: true, visible_to_customer: true },
  { key: 'nascimento', label: 'Nascimento', type: 'date', required: false, ask_in_bot: true, visible_to_customer: true },
  { key: 'whatsapp_ok', label: 'Aceita WhatsApp', type: 'bool', required: false, ask_in_bot: true, visible_to_customer: false },
  { key: 'segredo', label: 'Observação interna', type: 'text', required: false, ask_in_bot: false, visible_to_customer: false },
];
const TICKET_CF = [{ key: 'contrato', label: 'Nº do contrato', type: 'number', required: true, ask_in_bot: true, visible_to_customer: true }];

function mkCtx(o = {}) {
  return {
    contact: { name: 'Cliente Teste', phone: '5511999999999', saved: false },
    chatTagIds: [],
    now: new Date('2026-10-13T15:00:00Z'),
    settings: { numbering: 'emoji', typing: false, max_retries: 3, restart_keywords: ['menu'], ...(o.settings || {}) },
    customer: o.customer || null,
    customers: o.customer ? [o.customer] : [],
    products: [],
    ...(o.custom_fields ? { custom_fields: structuredClone(o.custom_fields) } : {}),
    ...(o.orders ? { orders: structuredClone(o.orders) } : {}),
    ...(o.tickets ? { tickets: structuredClone(o.tickets) } : {}),
  };
}
function single(type, data, ports, extraNodes = [], extraEdges = []) {
  const start = node('start', {}, 'start');
  const n = node(type, data, 'X');
  const ends = ports.map((p) => node('end', { title: p, text: `END:${p} {{pedido.numero}}`, close: false }, `end-${p}`));
  return flow([start, n, ...ends, ...extraNodes], [edge('start', 'out', 'X'), ...ports.map((p) => edge('X', p, `end-${p}`)), ...extraEdges]);
}
const ev = (def, state, payload, ctx = mkCtx()) => handleEvent(def, state, 'crm_result', ctx, payload);
const say = (def, state, input, ctx = mkCtx()) => handleInput(def, state, input, ctx, null);

const P = (id, name, price) => ({ id, name, price_cents: price, price_label: `R$ ${(price / 100).toFixed(2).replace('.', ',')}` });
const CATALOG = {
  categories: [
    { name: 'Lanches', products: [P('p1', 'X-Burguer', 2500), P('p2', 'X-Salada', 2800)] },
    { name: 'Bebidas', products: [P('p3', 'Refrigerante lata', 600)] },
  ],
};
const SETTINGS = { enabled: true, delivery: { enabled: true, fee_cents: 500, free_from_cents: 0 }, pickup: { enabled: true, address: 'Rua Exemplo, 100' }, min_order_cents: 0, payment_methods: ['pix', 'on_delivery'], max_items: 30 };
const ADDR = { id: 'a1', kind: 'delivery', label: 'Casa', street: 'Rua das Flores', number: '10', district: 'Centro', city: 'São Paulo', state: 'SP' };
const BILL = { id: 'a2', kind: 'billing', street: 'Rua do Boleto', number: '1', district: 'X' };
const ORDER = (id, number, status, extra = {}) => ({
  id,
  number,
  status,
  status_label: { new: 'Recebido', confirmed: 'Confirmado', preparing: 'Em preparo', out_for_delivery: 'Saiu para entrega', delivered: 'Entregue', canceled: 'Cancelado' }[status],
  payment_method: 'pix',
  payment_method_label: 'PIX',
  payment_status: 'pending',
  payment_status_label: 'Aguardando pagamento',
  items_text: '2× X-Burguer — R$ 50,00',
  total_cents: 5500,
  total_label: 'R$ 55,00',
  delivery_text: '🛵 Entrega: Rua das Flores, 10',
  created_at: '2026-10-13T14:00:00Z',
  ...extra,
});
const ORDER_CART_PORTS = ['out', 'paid', 'expired', 'canceled', 'failed'];

// ================================================================ A. Pedido completo: 2 categorias, endereço salvo, campos, PIX pago
{
  const def = single('order_cart', { categories: 'all', payment: 'ask', ask_notes: true }, ORDER_CART_PORTS);
  const ctx = () => mkCtx({ custom_fields: { order: ORDER_CF } });
  let r = startFlow(def, ctx(), 'oi');
  check('A entra pedindo o catálogo ao runtime', act(r.actions, 'order_catalog')?.node_id === 'X' && r.state.waiting_for === 'order:wait' && r.state.status === 'waiting', r.actions);
  check('A snapshot dos campos do pedido (ask_in_bot/obrigatórios, sem o interno)', (r.state.order.cf || []).map((f) => f.key).join() === 'tamanho,referencia', r.state.order.cf);
  r = ev(def, r.state, { ok: true, catalog: CATALOG, order_settings: SETTINGS, addresses: [ADDR, BILL] }, ctx());
  check('A menu de categorias com a contagem', /1️⃣ Lanches \(2\)/.test(allText(r.actions)) && /2️⃣ Bebidas \(1\)/.test(allText(r.actions)) && r.state.waiting_for === 'order:category', allText(r.actions));
  check('A endereço de cobrança nunca é oferecido', r.state.order.addresses.length === 1 && r.state.order.addresses[0].id === 'a1');
  r = say(def, r.state, 'lanches', ctx());
  check('A categoria pelo nome → produtos numerados com preço', /1️⃣ X-Burguer · R\$ 25,00/.test(allText(r.actions)) && /3️⃣ ⬅️ Voltar às categorias/.test(allText(r.actions)) && r.state.waiting_for === 'order:product', allText(r.actions));
  r = say(def, r.state, '1', ctx());
  check('A produto → pergunta a quantidade com o preço', /Quantas unidades de \*X-Burguer\* \(R\$ 25,00 cada\)/.test(allText(r.actions)) && r.state.waiting_for === 'order:qty', allText(r.actions));
  r = say(def, r.state, 'cem', ctx());
  check('A quantidade inválida → avisa', /de 1 a 99/.test(allText(r.actions)) && r.state.waiting_for === 'order:qty' && r.state.retries === 1);
  r = say(def, r.state, '2 unidades', ctx());
  check('A "2 unidades" → adicionado + carrinho com 1/2/3', /Adicionei 2× \*X-Burguer\*/.test(allText(r.actions)) && /2× X-Burguer — R\$\s50,00/.test(allText(r.actions)) && /1️⃣ Adicionar mais itens/.test(allText(r.actions)) && /2️⃣ Finalizar pedido/.test(allText(r.actions)) && /3️⃣ Esvaziar carrinho/.test(allText(r.actions)) && r.state.waiting_for === 'order:cart', allText(r.actions));
  r = say(def, r.state, '1', ctx());
  check('A "adicionar mais" → categorias com "Ver carrinho"', /3️⃣ 🛒 Ver carrinho/.test(allText(r.actions)) && r.state.waiting_for === 'order:category', allText(r.actions));
  r = say(def, r.state, '2', ctx());
  r = say(def, r.state, '1', ctx());
  r = say(def, r.state, '3️⃣', ctx());
  check('A 2º produto (keycap) → carrinho com 2 linhas', r.state.order.cart.length === 2 && r.state.order.cart[1].qty === 3 && /Subtotal:\* R\$\s68,00/.test(allText(r.actions)), allText(r.actions));
  r = say(def, r.state, 'finalizar', ctx());
  check('A finalizar → entrega (com taxa) ou retirada (com endereço)', /1️⃣ 🛵 Entrega \(taxa R\$\s5,00\)/.test(allText(r.actions)) && /2️⃣ 🏪 Retirar no local: Rua Exemplo, 100/.test(allText(r.actions)) && r.state.waiting_for === 'order:delivery', allText(r.actions));
  r = say(def, r.state, '1', ctx());
  check('A entrega → endereços salvos + "digitar outro"', /1️⃣ Rua das Flores, 10 · Centro · São Paulo\/SP \(Casa\)/.test(allText(r.actions)) && /2️⃣ ✏️ Digitar outro endereço/.test(allText(r.actions)) && r.state.waiting_for === 'order:address', allText(r.actions));
  r = say(def, r.state, '1', ctx());
  check('A endereço salvo → 1º campo do pedido (lista)', /📝 \*Tamanho\*/.test(allText(r.actions)) && /1️⃣ P/.test(allText(r.actions)) && !/pular/.test(allText(r.actions)) && r.state.waiting_for === 'order:custom' && r.state.order.address_id === 'a1', allText(r.actions));
  r = say(def, r.state, 'pular', ctx());
  check('A campo obrigatório não aceita "pular"', /número de uma das opções/.test(allText(r.actions)) && r.state.waiting_for === 'order:custom' && r.state.order.cf_i === 0, allText(r.actions));
  r = say(def, r.state, 'g', ctx());
  check('A opção pelo texto (sem caixa) → próximo campo (opcional, aceita pular)', r.state.order.custom.tamanho === 'G' && /Ponto de referência/.test(allText(r.actions)) && /pular/.test(allText(r.actions)), allText(r.actions));
  r = say(def, r.state, 'pular', ctx());
  check('A opcional pulado → pede a observação', !('referencia' in r.state.order.custom) && r.state.waiting_for === 'order:notes', r.state.order);
  r = say(def, r.state, 'sem cebola', ctx());
  check('A observação → pagamento (PIX / na entrega)', r.state.order.notes === 'sem cebola' && /1️⃣ PIX/.test(allText(r.actions)) && /2️⃣ Pagar na entrega/.test(allText(r.actions)) && r.state.waiting_for === 'order:payment', allText(r.actions));
  r = say(def, r.state, 'pix', ctx());
  const sum = allText(r.actions);
  check('A resumo com itens, taxa, total, entrega, pagamento e campo', /Resumo do pedido/.test(sum) && /3× Refrigerante lata/.test(sum) && /Entrega: R\$\s5,00/.test(sum) && /Total: R\$\s73,00/.test(sum) && /Rua das Flores/.test(sum) && /💳 PIX/.test(sum) && /\*Tamanho:\* G/.test(sum) && /1️⃣ Confirmar pedido/.test(sum) && r.state.waiting_for === 'order:confirm', sum);
  r = say(def, r.state, 'sim', ctx());
  const oc = act(r.actions, 'order_create');
  check(
    'A confirmar → ação order_create completa',
    oc && oc.node_id === 'X' && oc.items.length === 2 && oc.items[0].product_id === 'p1' && oc.items[0].qty === 2 && oc.delivery.mode === 'delivery' && oc.delivery.address_id === 'a1' && oc.payment_method === 'pix' && oc.notes === 'sem cebola' && oc.custom.tamanho === 'G' && r.state.waiting_for === 'order:wait',
    oc,
  );
  const created = ORDER('o1', 1234, 'new', { custom: { tamanho: 'G' } });
  r = ev(def, r.state, { ok: true, order: created, charge: { id: 'ch1', amount_cents: 7300, description: 'Pedido #1234', due_at: '2026-10-13', pix_code: '000201PIX', sent: true } }, ctx());
  check('A PIX → texto "recebido" (sem repetir o código: o runtime já mandou) + espera a cobrança', /Pedido \*#1234\* recebido/.test(allText(r.actions)) && !/000201PIX/.test(allText(r.actions)) && r.state.waiting_for === 'charge' && r.state.charge.id === 'ch1', allText(r.actions));
  check('A {{pedido_numero}} em set_var', act(r.actions, 'set_var')?.name === 'pedido_numero' && r.state.vars.pedido_numero === '1234');
  const w = say(def, r.state, 'oi', ctx());
  check('A esperando o PIX: outra mensagem → texto de espera com o comando de reinício', /Ainda estou aguardando o pagamento do pedido \*#1234\*/.test(allText(w.actions)) && /\*menu\*/.test(allText(w.actions)) && w.state.waiting_for === 'charge', allText(w.actions));
  const pg = say(def, r.state, 'já paguei', ctx());
  check('A "já paguei" → charge_check', act(pg.actions, 'charge_check')?.charge_id === 'ch1');
  const other = handleEvent(def, r.state, 'charge_paid', ctx(), { charge_id: 'outra' });
  check('A charge_paid de outra cobrança → ignorado', /ignorado/.test(JSON.stringify(other.actions)) && other.state.waiting_for === 'charge');
  const paid = handleEvent(def, r.state, 'charge_paid', ctx(), { charge_id: 'ch1', order: { ...created, status: 'confirmed', status_label: 'Confirmado', payment_status: 'paid' } });
  check('A pago → texto de pago + porta paid', /Pagamento do pedido \*#1234\* confirmado/.test(allText(paid.actions)) && endedAt(paid.actions) === 'paid', allText(paid.actions));
  check('A variáveis do pedido depois de pago', fillVars('{{pedido.numero}}|{{pedido.status}}|{{pedido.total}}|{{pedido.pagamento}}', paid.state, ctx()) === '1234|Confirmado|R$ 55,00|PIX (pago)', fillVars('{{pedido.numero}}|{{pedido.status}}|{{pedido.total}}|{{pedido.pagamento}}', paid.state, ctx()));
  const exp = handleEvent(def, r.state, 'charge_expired', ctx(), { charge_id: 'ch1' });
  check('A expirou → texto + porta expired', /não foi pago a tempo/.test(allText(exp.actions)) && endedAt(exp.actions) === 'expired', allText(exp.actions));
  const canc = handleEvent(def, r.state, 'charge_expired', ctx(), { charge_id: 'ch1', order: { ...created, status: 'canceled' } });
  check('A loja cancelou (cobrança cancelada) → sem texto do bot, porta expired', !/não foi pago a tempo/.test(allText(canc.actions)) && endedAt(canc.actions) === 'expired', allText(canc.actions));
  const notSent = ev(def, { ...r.state, waiting_for: 'order:wait', status: 'waiting', charge: null, order: { ...r.state.order, step: 'create' } }, { ok: true, order: created, charge: { id: 'ch2', amount_cents: 7300, description: 'x', due_at: null, pix_code: '000201COPIA' } }, ctx());
  check('A cobrança que o runtime NÃO conseguiu mandar → o motor manda o código', /000201COPIA/.test(allText(notSent.actions)), allText(notSent.actions));
}

// ================================================================ B. Paginação (12 produtos, 1 categoria) + navegação
{
  const many = { categories: [{ name: 'Mercado', products: Array.from({ length: 12 }, (_, i) => P(`m${i + 1}`, `Item ${i + 1}`, 100 * (i + 1))) }] };
  const def = single('order_cart', {}, ORDER_CART_PORTS);
  let r = startFlow(def, mkCtx(), 'oi');
  r = ev(def, r.state, { ok: true, catalog: many, order_settings: SETTINGS }, mkCtx());
  const t1 = allText(r.actions);
  check('B 1 categoria → direto nos produtos, página 1 de 2', /página 1 de 2/.test(t1) && /9️⃣ Item 9/.test(t1) && /🔟 ➡️ Mais produtos/.test(t1) && !/Item 10 ·/.test(t1) && !/Voltar às categorias/.test(t1) && r.state.waiting_for === 'order:product', t1);
  const z = say(def, r.state, '0', mkCtx());
  check('B "0" com carrinho vazio e 1 categoria → inválida', /Não entendi/.test(allText(z.actions)) && z.state.retries === 1);
  r = say(def, r.state, '10', mkCtx());
  const t2 = allText(r.actions);
  check('B "10" → página 2: produtos 10–12 + "Página anterior"', /página 2 de 2/.test(t2) && /1️⃣ Item 10/.test(t2) && /3️⃣ Item 12/.test(t2) && /4️⃣ ⬅️ Página anterior/.test(t2) && r.state.order.page === 1, t2);
  const back = say(def, r.state, 'voltar', mkCtx());
  check('B "voltar" → página 1', back.state.order.page === 0 && /Item 1 ·/.test(allText(back.actions)));
  r = say(def, r.state, '2', mkCtx());
  check('B produto da página 2 (Item 11)', r.state.order.product.id === 'm11');
  r = say(def, r.state, '0', mkCtx());
  check('B "0" na quantidade → volta para a mesma página', r.state.waiting_for === 'order:product' && r.state.order.page === 1 && r.state.order.product === null);
  r = say(def, r.state, '1', mkCtx());
  r = say(def, r.state, '1', mkCtx());
  r = say(def, r.state, '1', mkCtx()); // adicionar mais (1 categoria → produtos)
  check('B "adicionar mais" com 1 categoria → produtos, com "Ver carrinho"', /🛒 Ver carrinho/.test(allText(r.actions)) && r.state.waiting_for === 'order:product', allText(r.actions));
  const zc = say(def, r.state, '0', mkCtx());
  check('B "0" com itens → carrinho', zc.state.waiting_for === 'order:cart');
  const kw = say(def, r.state, 'carrinho', mkCtx());
  check('B palavra "carrinho" → carrinho', kw.state.waiting_for === 'order:cart');
  // quantidade inválida 3x → volta aos produtos
  let q = say(def, r.state, '1', mkCtx());
  q = say(def, q.state, 'abc', mkCtx());
  q = say(def, q.state, '0 0', mkCtx());
  q = say(def, q.state, '150', mkCtx());
  check('B quantidade inválida 3× → volta à lista de produtos', q.state.waiting_for === 'order:product' && q.state.order.product === null, q.state.order);
  // mesmo produto de novo soma (teto 99)
  let s2 = say(def, r.state, '1', mkCtx());
  s2 = say(def, s2.state, '99', mkCtx());
  check('B mesmo produto soma na mesma linha com teto de 99', s2.state.order.cart.length === 1 && s2.state.order.cart[0].qty === 99, s2.state.order.cart);
}

// ================================================================ C. Pedido mínimo · limite de itens · esvaziar · PIX mínimo
{
  const def = single('order_cart', {}, ORDER_CART_PORTS);
  const go = (settings, picks) => {
    let r = startFlow(def, mkCtx(), 'oi');
    r = ev(def, r.state, { ok: true, catalog: CATALOG, order_settings: settings }, mkCtx());
    for (const p of picks) r = say(def, r.state, p, mkCtx());
    return r;
  };
  let r = go({ ...SETTINGS, min_order_cents: 5000 }, ['1', '1', '1', '2']);
  check('C abaixo do mínimo → texto do mínimo + carrinho de novo', /pedido mínimo é \*R\$\s50,00\*/.test(allText(r.actions)) && r.state.waiting_for === 'order:cart', allText(r.actions));
  r = go({ ...SETTINGS, max_items: 1 }, ['1', '1', '1', '1', '2', '1', '1']);
  check('C limite de produtos diferentes → recusa a 2ª linha', /máximo por pedido/.test(allText(r.actions)) && r.state.order.cart.length === 1 && r.state.waiting_for === 'order:cart', allText(r.actions));
  r = go(SETTINGS, ['1', '1', '1', '3']);
  check('C esvaziar → avisa e volta ao catálogo', /esvaziei o carrinho/.test(allText(r.actions)) && r.state.order.cart.length === 0 && r.state.waiting_for === 'order:category', allText(r.actions));
  const cheap = { categories: [{ name: 'Balas', products: [P('b1', 'Bala', 50)] }] };
  let c = startFlow(def, mkCtx(), 'oi');
  c = ev(def, c.state, { ok: true, catalog: cheap, order_settings: { ...SETTINGS, payment_methods: ['pix'] } }, mkCtx());
  c = say(def, c.state, '1', mkCtx());
  c = say(def, c.state, '1', mkCtx());
  c = say(def, c.state, '2', mkCtx());
  check('C só PIX e carrinho < R$ 1,00 → pede para completar', /PIX é a partir de R\$ 1,00/.test(allText(c.actions)) && c.state.waiting_for === 'order:cart', allText(c.actions));
}

// ================================================================ D. Só retirada + pagar na entrega (bloco) → porta out
{
  const def = single('order_cart', { payment: 'on_delivery', allow_delivery: false }, ORDER_CART_PORTS);
  let r = startFlow(def, mkCtx(), 'oi');
  r = ev(def, r.state, { ok: true, catalog: CATALOG, order_settings: SETTINGS }, mkCtx());
  for (const x of ['1', '2', '1', '2']) r = say(def, r.state, x, mkCtx());
  const sum = allText(r.actions);
  check('D sem pergunta de entrega/pagamento → resumo com retirada e "Pagar na retirada"', /Resumo do pedido/.test(sum) && /Retirada no local: Rua Exemplo, 100/.test(sum) && /Na retirada/.test(sum) && /Entrega: grátis/.test(sum) && r.state.order.delivery === 'pickup' && r.state.order.payment === 'on_delivery', sum);
  r = say(def, r.state, '1', mkCtx());
  const oc = act(r.actions, 'order_create');
  check('D order_create com retirada (sem endereço) e on_delivery', oc && oc.delivery.mode === 'pickup' && !('address_id' in oc.delivery) && oc.payment_method === 'on_delivery', oc);
  r = ev(def, r.state, { ok: true, order: ORDER('o2', 77, 'new', { payment_method: 'on_delivery', payment_method_label: 'Na entrega', payment_status: 'not_required', delivery_text: '🏪 Retirada no local' }) }, mkCtx());
  check('D criado sem cobrança → texto "recebido" + porta out', /Pedido \*#77\* recebido/.test(allText(r.actions)) && endedAt(r.actions) === 'out' && r.state.waiting_for === null, allText(r.actions));
  // bloco só PIX mas a loja não aceita PIX → falha
  const def2 = single('order_cart', { payment: 'pix' }, ORDER_CART_PORTS);
  let f = startFlow(def2, mkCtx(), 'oi');
  f = ev(def2, f.state, { ok: true, catalog: CATALOG, order_settings: { ...SETTINGS, payment_methods: ['on_delivery'] } }, mkCtx());
  check('D bloco só PIX e loja sem PIX → porta failed', endedAt(f.actions) === 'failed', allText(f.actions));
}

// ================================================================ E. Endereço digitado + confirmação
{
  const def = single('order_cart', { payment: 'on_delivery' }, ORDER_CART_PORTS);
  let r = startFlow(def, mkCtx(), 'oi');
  r = ev(def, r.state, { ok: true, catalog: CATALOG, order_settings: SETTINGS, addresses: [] }, mkCtx());
  for (const x of ['1', '1', '1', '2', '1']) r = say(def, r.state, x, mkCtx());
  check('E sem endereço salvo → pede para digitar', /Digite o endereço completo/.test(allText(r.actions)) && r.state.waiting_for === 'order:address_text', allText(r.actions));
  r = say(def, r.state, 'aqui', mkCtx());
  check('E endereço curto → pede completo', /endereço completo/.test(allText(r.actions)) && r.state.retries === 1);
  r = say(def, r.state, 'Rua Nova, 45 - Jardim América', mkCtx());
  check('E endereço → confirmação', /Entregar em: \*Rua Nova, 45 - Jardim América\*/.test(allText(r.actions)) && r.state.waiting_for === 'order:address_confirm', allText(r.actions));
  const no = say(def, r.state, '2', mkCtx());
  check('E "2" → digitar de novo', no.state.waiting_for === 'order:address_text');
  r = say(def, r.state, '1', mkCtx());
  check('E confirmado → resumo (pagamento fixo na entrega)', /Resumo do pedido/.test(allText(r.actions)) && /Total: R\$\s30,00/.test(allText(r.actions)), allText(r.actions));
  r = say(def, r.state, '1', mkCtx());
  const oc = act(r.actions, 'order_create');
  check('E order_create com o endereço digitado', oc && oc.delivery.address_id === null && oc.delivery.address.street === 'Rua Nova, 45 - Jardim América', oc);
}

// ================================================================ F. Desistir / alterar / catálogo vazio / desligado / falha
{
  const def = single('order_cart', { payment: 'on_delivery', allow_delivery: false }, ORDER_CART_PORTS);
  let r = startFlow(def, mkCtx(), 'oi');
  r = ev(def, r.state, { ok: true, catalog: CATALOG, order_settings: SETTINGS }, mkCtx());
  const c1 = say(def, r.state, 'cancelar', mkCtx());
  check('F "cancelar" → porta canceled (sem texto: ligada)', endedAt(c1.actions) === 'canceled' && !/cancelei o pedido/.test(allText(c1.actions)), allText(c1.actions));
  for (const x of ['1', '1', '1', '2']) r = say(def, r.state, x, mkCtx());
  const ed = say(def, r.state, '2', mkCtx());
  check('F "2" no resumo → volta ao carrinho', ed.state.waiting_for === 'order:cart' && ed.state.order.cart.length === 1);
  const c3 = say(def, r.state, '3', mkCtx());
  check('F "3" no resumo → porta canceled', endedAt(c3.actions) === 'canceled');
  const defNo = single('order_cart', {}, ['out']);
  let n = startFlow(defNo, mkCtx(), 'oi');
  n = ev(defNo, n.state, { ok: true, catalog: CATALOG, order_settings: SETTINGS }, mkCtx());
  n = say(defNo, n.state, 'desistir', mkCtx());
  check('F cancel sem ligação → texto + fim', /cancelei o pedido/.test(allText(n.actions)) && n.state.status === 'done');
  let e = startFlow(def, mkCtx(), 'oi');
  e = ev(def, e.state, { ok: true, catalog: { categories: [{ name: 'Vazia', products: [] }] }, order_settings: SETTINGS }, mkCtx());
  check('F catálogo vazio → texto + porta failed', /não há produtos disponíveis/.test(allText(e.actions)) && endedAt(e.actions) === 'failed', allText(e.actions));
  let dz = startFlow(def, mkCtx(), 'oi');
  dz = ev(def, dz.state, { ok: true, catalog: CATALOG, order_settings: { ...SETTINGS, enabled: false } }, mkCtx());
  check('F pedidos desligados → texto + failed', /não estamos recebendo pedidos/.test(allText(dz.actions)) && endedAt(dz.actions) === 'failed', allText(dz.actions));
  const onlyBeb = single('order_cart', { categories: ['bebidas'] }, ORDER_CART_PORTS);
  let ob = startFlow(onlyBeb, mkCtx(), 'oi');
  ob = ev(onlyBeb, ob.state, { ok: true, catalog: CATALOG, order_settings: SETTINGS }, mkCtx());
  check('F categorias do bloco (sem caixa/acento) → só Bebidas, direto nos produtos', /Refrigerante lata/.test(allText(ob.actions)) && !/X-Burguer/.test(allText(ob.actions)) && ob.state.waiting_for === 'order:product', allText(ob.actions));
  // falha na criação com user_text
  for (const x of ['1', '1', '1', '2']) r = say(def, r.state, x, mkCtx());
  let fc = say(def, r.state, '1', mkCtx());
  fc = ev(def, fc.state, { ok: false, error: 'BadRequest', user_text: 'Um dos produtos não está mais disponível.' }, mkCtx());
  check('F falha na criação → diz o user_text + failed', /não está mais disponível/.test(allText(fc.actions)) && endedAt(fc.actions) === 'failed', allText(fc.actions));
  // catálogo falhou
  let cf = startFlow(def, mkCtx(), 'oi');
  cf = ev(def, cf.state, { ok: false, error: 'boom' }, mkCtx());
  check('F catálogo falhou → failed', endedAt(cf.actions) === 'failed');
  // campo obrigatório inválido 3× → failed
  const defCf = single('order_cart', { payment: 'on_delivery', allow_delivery: false }, ORDER_CART_PORTS);
  const cctx = () => mkCtx({ custom_fields: { order: ORDER_CF } });
  let rc = startFlow(defCf, cctx(), 'oi');
  rc = ev(defCf, rc.state, { ok: true, catalog: CATALOG, order_settings: SETTINGS }, cctx());
  for (const x of ['1', '1', '1', '2', 'xx', 'yy']) rc = say(defCf, rc.state, x, cctx());
  check('F campo obrigatório inválido → repete com o erro', /número de uma das opções/.test(allText(rc.actions)) && rc.state.waiting_for === 'order:custom');
  rc = say(defCf, rc.state, 'zz', cctx());
  check('F campo obrigatório inválido 3× → failed', endedAt(rc.actions) === 'failed', allText(rc.actions));
}

// ================================================================ G. Meus pedidos
{
  const defM = single('my_orders', { show: 'open' }, ['out', 'none', 'failed']);
  let r = startFlow(defM, mkCtx(), 'oi');
  check('G entra pedindo a lista', act(r.actions, 'order_list')?.show === 'open' && act(r.actions, 'order_list')?.limit === 5 && r.state.waiting_for === 'order:wait');
  const list = [
    ORDER('o1', 1234, 'preparing', { payment_status: 'paid', payment_status_label: 'Pago', fields: [{ key: 'tamanho', label: 'Tamanho', display: 'G' }] }),
    ORDER('o2', 1240, 'new'),
    ORDER('o3', 1100, 'delivered'),
  ];
  const l = ev(defM, r.state, { ok: true, orders: list }, mkCtx());
  check('G lista só os em andamento (show open)', /#1234 · Em preparo/.test(allText(l.actions)) && /#1240 · Recebido/.test(allText(l.actions)) && !/#1100/.test(allText(l.actions)) && l.state.waiting_for === 'order:choose', allText(l.actions));
  const inv = say(defM, l.state, '9', mkCtx());
  check('G opção inválida → avisa', /Não entendi/.test(allText(inv.actions)) && inv.state.waiting_for === 'order:choose');
  const d = say(defM, l.state, '1', mkCtx());
  const dt = allText(d.actions);
  check('G detalhes com itens, situação, pagamento e campo visível', /Pedido \*#1234\*/.test(dt) && /2× X-Burguer/.test(dt) && /Situação: \*Em preparo\*/.test(dt) && /PIX \(pago\) — Pago/.test(dt) && /\*Tamanho:\* G/.test(dt) && endedAt(d.actions) === 'out', dt);
  const d2 = say(defM, l.state, '#1240', mkCtx());
  check('G pelo número do pedido (#1240)', /Pedido \*#1240\*/.test(allText(d2.actions)), allText(d2.actions));
  const z = say(defM, l.state, '0', mkCtx());
  check('G "0" → sai pela porta out', endedAt(z.actions) === 'out');
  const none = ev(defM, r.state, { ok: true, orders: [list[2]] }, mkCtx());
  check('G nenhum em andamento → texto + porta none', /ainda não tem pedidos/.test(allText(none.actions)) && endedAt(none.actions) === 'none', allText(none.actions));
  const defAll = single('my_orders', { show: 'all' }, ['out', 'none']);
  let ra = startFlow(defAll, mkCtx(), 'oi');
  check('G show all', act(ra.actions, 'order_list')?.show === 'all');
  ra = ev(defAll, ra.state, { ok: true, orders: [list[2]] }, mkCtx());
  check('G 1 pedido → detalhes direto (entregue)', /Pedido \*#1100\*/.test(allText(ra.actions)) && /Entregue/.test(allText(ra.actions)) && endedAt(ra.actions) === 'out', allText(ra.actions));
  const ff = ev(defM, r.state, { ok: false, error: 'x' }, mkCtx());
  check('G falha → failed', endedAt(ff.actions) === 'failed');
}

// ================================================================ H. Condição de pedido
{
  const mk = (key, value) =>
    flow(
      [node('start', {}, 'start'), node('condition', { rules: [{ source: 'order', key, op: 'is', value }] }, 'C'), node('end', { text: 'END:true', close: false }, 'T'), node('end', { text: 'END:false', close: false }, 'F')],
      [edge('start', 'out', 'C'), edge('C', 'true', 'T'), edge('C', 'false', 'F')],
    );
  check('H tem pedido em andamento', endedAt(startFlow(mk('has_open_order', 'true'), mkCtx({ orders: [ORDER('o1', 1, 'preparing')] }), 'oi').actions) === 'true');
  check('H entregue não conta', endedAt(startFlow(mk('has_open_order', 'true'), mkCtx({ orders: [ORDER('o1', 1, 'delivered')] }), 'oi').actions) === 'false');
  check('H sem pedidos → false (value false = true)', endedAt(startFlow(mk('has_open_order', 'false'), mkCtx(), 'oi').actions) === 'true');
  check('H aguardando PIX', endedAt(startFlow(mk('awaiting_payment', 'true'), mkCtx({ orders: [ORDER('o1', 1, 'new')] }), 'oi').actions) === 'true');
  check('H pago não aguarda', endedAt(startFlow(mk('awaiting_payment', 'true'), mkCtx({ orders: [ORDER('o1', 1, 'new', { payment_status: 'paid' })] }), 'oi').actions) === 'false');
  check('H {{pedidos.lista}} fora do bloco', /#5 · Recebido/.test(fillVars('{{pedidos.lista}}', E.emptyState(), mkCtx({ orders: [ORDER('o5', 5, 'new')] }))));
}

// ================================================================ I. Cadastro de cliente pergunta os campos personalizados
{
  const def = single('crm_register', { fields: [{ key: 'name', required: true }], confirm: true }, ['done', 'cancel', 'failed']);
  const ctx = () => mkCtx({ custom_fields: { customer: CUST_CF } });
  let r = startFlow(def, ctx(), 'oi');
  check('I começa pelo nome', /nome completo/.test(allText(r.actions)) && r.state.crm.cf.map((f) => f.key).join() === 'plano_saude,nascimento,whatsapp_ok', r.state.crm);
  r = say(def, r.state, 'Maria Souza', ctx());
  check('I depois do nome → campo de lista com opções', /📝 \*Plano de saúde\*/.test(allText(r.actions)) && /2️⃣ Amil/.test(allText(r.actions)) && r.state.waiting_for === 'crm_register', allText(r.actions));
  r = say(def, r.state, 'bradesco', ctx());
  check('I opção fora da lista → erro + repete a pergunta', /número de uma das opções/.test(allText(r.actions)) && /Plano de saúde/.test(allText(r.actions)) && r.state.retries === 1, allText(r.actions));
  r = say(def, r.state, '2', ctx());
  check('I "2" → Amil, próxima = data (opcional)', r.state.crm.fields['custom.plano_saude'] === 'Amil' && /Nascimento\* \(DD\/MM\/AAAA\)/.test(allText(r.actions)) && /pular/.test(allText(r.actions)), allText(r.actions));
  r = say(def, r.state, '31/02/1990', ctx());
  check('I data impossível → inválida', /formato DD\/MM\/AAAA/.test(allText(r.actions)) && r.state.retries === 1);
  r = say(def, r.state, '5/3/90', ctx());
  check('I data curta → ISO', r.state.crm.fields['custom.nascimento'] === '1990-03-05', r.state.crm.fields);
  r = say(def, r.state, 'não', ctx());
  check('I sim/não opcional: "não" é resposta (não pula)', r.state.crm.fields['custom.whatsapp_ok'] === 'false' && r.state.waiting_for === 'crm_confirm', r.state.crm.fields);
  const rs = allText(r.actions);
  check('I resumo com os valores legíveis', /Plano de saúde: Amil/.test(rs) && /Nascimento: 05\/03\/1990/.test(rs) && /Aceita WhatsApp: Não/.test(rs), rs);
  r = say(def, r.state, '1', ctx());
  const cc = act(r.actions, 'crm_create_customer');
  check('I ação com os campos custom.*', cc && cc.fields.name === 'Maria Souza' && cc.fields['custom.plano_saude'] === 'Amil' && cc.fields['custom.nascimento'] === '1990-03-05' && cc.fields['custom.whatsapp_ok'] === 'false', cc);
  // campo do bloco que já pergunta custom.plano_saude não é perguntado 2x; usa a regra do tipo
  const def2 = single('crm_register', { fields: [{ key: 'name' }, { key: 'custom.plano_saude', label: 'Convênio' }], confirm: false }, ['done', 'cancel', 'failed']);
  let r2 = startFlow(def2, ctx(), 'oi');
  check('I campo do bloco não repete no snapshot', !r2.state.crm.cf.some((f) => f.key === 'plano_saude'));
  r2 = say(def2, r2.state, 'Ana Lima', ctx());
  check('I campo do bloco com definição → pergunta com as opções', /2️⃣ Amil/.test(allText(r2.actions)), allText(r2.actions));
  r2 = say(def2, r2.state, 'unimed', ctx());
  check('I e valida pelo tipo (Unimed)', r2.state.crm.fields['custom.plano_saude'] === 'Unimed', r2.state.crm.fields);
  // crm_update não pergunta os campos extras
  const defU = single('crm_update', { fields: [{ key: 'email' }] }, ['out', 'cancel', 'no_customer', 'failed']);
  const cust = { id: 'c1', name: 'Maria', first_name: 'Maria', doc_masked: '', code: '', email: '', status: 'ok', verified: true, custom: {}, subscriptions: [], open_charges: [] };
  const ru = startFlow(defU, mkCtx({ customer: cust, custom_fields: { customer: CUST_CF } }), 'oi');
  check('I crm_update não pergunta campos extras', !ru.state.crm.cf, ru.state.crm);
}

// ================================================================ J. Chamado pergunta os campos do chamado antes de abrir
{
  const def = single('open_ticket', { category: 'problema', ask_photo: false }, ['out', 'cancel', 'failed']);
  const ctx = () => mkCtx({ custom_fields: { ticket: TICKET_CF } });
  let r = startFlow(def, ctx(), 'oi');
  r = say(def, r.state, 'A internet cai toda noite', ctx());
  check('J depois da descrição → campo do chamado', /📝 \*Nº do contrato\* \(só números\)/.test(allText(r.actions)) && r.state.waiting_for === 'ticket:custom', allText(r.actions));
  r = say(def, r.state, 'abc', ctx());
  check('J número inválido → repete', /só números/.test(allText(r.actions)) && r.state.waiting_for === 'ticket:custom' && r.state.retries === 1);
  r = say(def, r.state, '12.345', ctx());
  const tc = act(r.actions, 'ticket_create');
  check('J ticket_create com custom convertido (12.345 → 12345)', tc && tc.custom.contrato === 12345, tc);
  const c = say(def, startFlow(def, ctx(), 'oi').state, 'cancelar', ctx());
  check('J cancelar continua valendo', endedAt(c.actions) === 'cancel');
  const created = { id: 't1', protocol: '2026000050', status: 'open', category_label: 'Problema', fields: [{ key: 'contrato', label: 'Nº do contrato', display: '12.345' }] };
  r = ev(def, r.state, { ok: true, ticket: created }, ctx());
  check('J {{chamado.custom.contrato}} depois de aberto', fillVars('{{chamado.custom.contrato}}', r.state, ctx()) === '12.345');
}

// ================================================================ K. Consultas mostram os campos visíveis ao cliente
{
  const cust = { id: 'c1', name: 'Maria Souza', first_name: 'Maria', doc_masked: '***.***.***-25', code: 'CLI-1', email: 'm@ex.com', status: 'ok', verified: true, custom: { plano_saude: 'Amil', nascimento: '1990-03-05', segredo: 'não mostrar', whatsapp_ok: 'true' }, subscriptions: [], open_charges: [] };
  const def = single('crm_info', { what: 'data' }, ['out', 'no_customer']);
  const r = startFlow(def, mkCtx({ customer: cust, custom_fields: { customer: CUST_CF } }), 'oi');
  const t = allText(r.actions);
  check('K "Meus dados" com os campos visíveis (e só eles)', /\*Plano de saúde:\* Amil/.test(t) && /\*Nascimento:\* 05\/03\/1990/.test(t) && !/não mostrar/.test(t) && !/Aceita WhatsApp/.test(t), t);
  const r0 = startFlow(def, mkCtx({ customer: { ...cust, custom: {} }, custom_fields: { customer: CUST_CF } }), 'oi');
  check('K sem campos preenchidos → texto igual ao de antes', /\*Código:\* CLI-1/.test(allText(r0.actions)) && !/Plano/.test(allText(r0.actions)));
  check('K {{cliente.custom.x}} e {{cliente.x}}', fillVars('{{cliente.custom.plano_saude}}|{{cliente.plano_saude}}|{{cliente.custom.whatsapp_ok}}', E.emptyState(), mkCtx({ customer: cust, custom_fields: { customer: CUST_CF } })) === 'Amil|Amil|Sim');
  const defT = single('my_tickets', { show: 'active', allow_add_info: false }, ['out', 'none']);
  let rt = startFlow(defT, mkCtx(), 'oi');
  rt = ev(defT, rt.state, { ok: true, tickets: [{ id: 't1', protocol: '2026000050', status: 'open', status_label: 'Aberto', category_label: 'Problema', fields: [{ key: 'contrato', label: 'Nº do contrato', display: '12.345' }] }] });
  check('K "Meus chamados" com o campo visível', /\*Nº do contrato:\* 12\.345/.test(allText(rt.actions)), allText(rt.actions));
}

// ================================================================ L. Validação · reinício · espera do runtime
{
  check('L valid: categorias inválidas', validateDefinition(single('order_cart', { categories: [] }, ['out'])).some((x) => /categorias do catálogo/.test(x)));
  check('L valid: pagamento inválido', validateDefinition(single('order_cart', { payment: 'boleto' }, ['out'])).some((x) => /pagamento inválida/.test(x)));
  check('L valid: sem entrega nem retirada', validateDefinition(single('order_cart', { allow_delivery: false, allow_pickup: false }, ['out'])).some((x) => /entrega, retirada/.test(x)));
  check('L valid: my_orders show inválido', validateDefinition(single('my_orders', { show: 'x' }, ['out'])).some((x) => /quais pedidos/.test(x)));
  check('L valid: blocos de pedido ok', validateDefinition(single('order_cart', { categories: ['Lanches'], payment: 'pix' }, ['out'])).length === 0 && validateDefinition(single('my_orders', { show: 'all' }, ['out'])).length === 0);
  const def = single('order_cart', {}, ['out']);
  const r = startFlow(def, mkCtx(), 'oi');
  const w = say(def, r.state, 'oi');
  check('L order:wait: mensagem não muda o estado', w.state.waiting_for === 'order:wait' && !texts(w.actions).length);
  const c = ev(def, r.state, { ok: true, catalog: CATALOG, order_settings: SETTINGS });
  const rs = say(def, c.state, 'menu');
  check('L palavra de reinício limpa o pedido', rs.state.status === 'done' && rs.state.order === null);
  const ign = ev(def, c.state, { ok: true, catalog: CATALOG });
  check('L crm_result sem ação pendente → ignorado', /ignorado/.test(JSON.stringify(ign.actions)));
  // estado clonado: o carrinho do estado anterior não é mutado
  let a = c;
  for (const x of ['1', '1', '1']) a = say(def, a.state, x);
  const before = JSON.stringify(a.state.order.cart);
  const b = say(def, a.state, '1');
  const b2 = say(def, b.state, '2');
  say(def, b2.state, '1');
  check('L carrinho do estado anterior não é mutado', JSON.stringify(a.state.order.cart) === before);
}

const total = pass + fail;
for (const f of failures) console.log('FAIL', f);
console.log(`${pass}/${total} ${fail ? 'FAIL' : 'PASS'}`);
process.exit(fail ? 1 : 0);
