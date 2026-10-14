// E2E da Fase 7 (genérico: campos personalizados, unidades, pedidos, financeiro, sub-permissões) — roda NO SERVIDOR:
//   scp docs/tools/wa_fase7_e2e.mjs pubmail-hostinger:/opt/pub-mail/back/wa_f7_e2e.tmp.mjs
//   ssh pubmail-hostinger 'cd /opt/pub-mail/back && node wa_f7_e2e.tmp.mjs; rm -f wa_f7_e2e.tmp.mjs'
// Org temporária (apagada no fim), número FALSO `ready` por SQL, Asaas SANDBOX para o PIX (chave em /root/pubmail.secrets,
// nunca impressa; cobranças abertas são apagadas no Asaas no fim).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';

const API = 'http://127.0.0.1:8000';
const env = Object.fromEntries(readFileSync('/opt/pub-mail/back/.env', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const secrets = readFileSync('/root/pubmail.secrets', 'utf8').split('\n');
const secret = (k) => secrets.find((l) => l.startsWith(`${k}=`))?.slice(k.length + 1).trim();
const DB_PASS = secret('DB_PASS');
const KEY = secret('ASAAS_SANDBOX_API_KEY');
const sql = (q) => execFileSync('mysql', ['-upubmail', `-p${DB_PASS}`, '-h127.0.0.1', '-N', '-e', q, 'pubmail'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
const sign = (u) => jwt.sign({ sub: u.id, org: u.org, role: u.role }, env.JWT_ACCESS_SECRET, { expiresIn: '40m' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0, total = 0;
const ok = (l, c, x) => { total++; if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + l + (c || x === undefined ? '' : '  → ' + JSON.stringify(x).slice(0, 500))); };
const call = async (tok, m, p, b, h = {}) => { const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...h }, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { j = t; } return { s: r.status, j, raw: t, headers: r.headers }; };
const asa = async (m, p) => { const r = await fetch('https://api-sandbox.asaas.com/v3' + p, { method: m, headers: { access_token: KEY, 'User-Agent': 'PubMail-E2E' } }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const cpf = () => { const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)); const d = (a) => { const s = a.reduce((acc, v, i) => acc + v * (a.length + 1 - i), 0); const r = (s * 10) % 11; return r === 10 ? 0 : r; }; n.push(d(n)); n.push(d(n)); return n.join(''); };
const brt = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

const SA = sql(`SELECT CONCAT(u.id,'|',u.organization_id) FROM users u WHERE u.email='superadmin@pubmail.com' LIMIT 1`).split('|');
const saTok = sign({ id: SA[0], org: SA[1], role: 'SUPER_ADMIN' });
const stamp = Date.now().toString(36);
let orgId, tok, sessionId;
try {
  // ---------------- org, usuários com sub-permissões, número
  let r = await call(saTok, 'POST', '/admin/clients', { name: 'F7 Owner', email: `f7-owner-${stamp}@teste.local`, password: 'Senha!Teste123', org_name: `E2E Fase7 ${stamp}`, modules: ['whatsapp', 'settings'], price_cents: 0 });
  orgId = r.j?.organization?.id; const ownerId = r.j?.user?.id;
  ok('org temporária criada', r.s === 201 && orgId, r.j);
  tok = sign({ id: ownerId, org: orgId, role: 'OWNER' });
  r = await call(saTok, 'POST', '/admin/users', { organization_id: orgId, name: 'Atendente CRM', email: `f7-crm-${stamp}@teste.local`, password: 'Senha!Teste123', role: 'MEMBER', modules: ['whatsapp', 'whatsapp:crm'] });
  const crmId = r.j?.id; const crmTok = sign({ id: crmId, org: orgId, role: 'MEMBER' });
  r = await call(saTok, 'POST', '/admin/users', { organization_id: orgId, name: 'Atendente Básico', email: `f7-basic-${stamp}@teste.local`, password: 'Senha!Teste123', role: 'MEMBER', modules: ['whatsapp', 'whatsapp:basic'] });
  const basicId = r.j?.id; const basicTok = sign({ id: basicId, org: orgId, role: 'MEMBER' });
  r = await call(saTok, 'POST', '/admin/users', { organization_id: orgId, name: 'Antigo', email: `f7-old-${stamp}@teste.local`, password: 'Senha!Teste123', role: 'MEMBER', modules: ['whatsapp'] });
  const oldTok = sign({ id: r.j?.id, org: orgId, role: 'MEMBER' });
  ok('3 membros criados', Boolean(crmId && basicId && r.j?.id));
  r = await call(tok, 'POST', '/whatsapp/sessions', { label: 'Loja' });
  sessionId = r.j?.id;
  sql(`UPDATE whatsapp_sessions SET status='ready', engine='baileys', phone='5500999990701', paired_at=NOW(3), openwa_session_id='f7-fake-${stamp}' WHERE id='${sessionId}'`);

  // ---------------- sub-permissões
  r = await call(crmTok, 'GET', '/auth/me');
  ok('/auth/me do membro CRM: só whatsapp:crm', JSON.stringify(r.j?.access?.permissions || r.j?.permissions) === '["whatsapp:crm"]', r.j?.access?.permissions);
  r = await call(oldTok, 'GET', '/auth/me');
  ok('membro com só "whatsapp" (como os antigos) = as três', (r.j?.access?.permissions || []).length === 3, r.j?.access?.permissions);
  r = await call(crmTok, 'GET', '/whatsapp/charges');
  ok('membro sem financeiro: cobranças → 403 PERMISSION_DENIED', r.s === 403 && r.j?.code === 'PERMISSION_DENIED' && r.j?.permission === 'whatsapp:finance', r.j);
  r = await call(crmTok, 'GET', '/whatsapp/finance');
  ok('membro sem financeiro: financeiro → 403', r.s === 403, r.s);
  r = await call(crmTok, 'GET', '/whatsapp/customers');
  ok('membro CRM: lista de clientes 200', r.s === 200, r.s);
  r = await call(basicTok, 'GET', '/whatsapp/customers');
  ok('membro básico: lista de clientes → 403', r.s === 403 && r.j?.permission === 'whatsapp:crm', r.j);
  r = await call(basicTok, 'GET', '/whatsapp/products');
  ok('membro básico: ler produtos continua (leitura)', r.s === 200, r.s);
  r = await call(basicTok, 'GET', '/whatsapp/chats');
  ok('membro básico: chat continua', r.s === 200, r.s);
  r = await call(oldTok, 'GET', '/whatsapp/charges');
  ok('membro antigo: cobranças 200', r.s === 200, r.s);

  // ---------------- campos personalizados
  r = await call(tok, 'PUT', '/whatsapp/crm-settings', { custom_fields: {
    customer: [{ label: 'Data de nascimento', type: 'date', required: true, ask_in_bot: true }, { label: 'Plano odonto', type: 'select', options: ['Sim', 'Não'], visible_to_customer: true }],
    product: [{ label: 'Marca', type: 'text' }],
    ticket: [{ label: 'Bairro', type: 'select', options: ['Centro', 'Norte'], required: true }],
    order: [{ label: 'Troco para', type: 'number' }],
    charge: [{ label: 'Centro de custo', type: 'text', required: true }],
  } });
  ok('campos salvos por entidade', r.s === 200 && r.j.custom_fields?.customer?.length === 2 && r.j.custom_fields?.order?.[0]?.key === 'troco_para' && r.j.customer_fields?.length === 2, r.j?.custom_fields);
  r = await call(tok, 'PUT', '/whatsapp/crm-settings', { custom_fields: { product: [{ label: 'Marca', type: 'text' }, { label: 'Peso', type: 'number' }] } });
  ok('salvar uma entidade mantém as outras', r.s === 200 && r.j.custom_fields.product.length === 2 && r.j.custom_fields.customer.length === 2, { p: r.j?.custom_fields?.product?.length, c: r.j?.custom_fields?.customer?.length });
  r = await call(tok, 'POST', '/whatsapp/customers', { name: 'Sem nascimento', phone: '5500999990710' });
  ok('cliente sem campo obrigatório → 400 CUSTOM_REQUIRED', r.s === 400 && r.j?.code === 'CUSTOM_REQUIRED' && r.j.fields?.[0]?.key === 'data_de_nascimento', r.j);
  r = await call(tok, 'POST', '/whatsapp/customers', { name: 'Data errada', phone: '5500999990710', custom: { data_de_nascimento: '31/02/1990' } });
  ok('data impossível → 400 CUSTOM_INVALID', r.s === 400 && r.j?.code === 'CUSTOM_INVALID', r.j);

  // ---------------- unidades + cliente com unidade, código externo e endereços
  r = await call(tok, 'POST', '/whatsapp/units', { name: 'Loja Centro', code: 'CTR', phone: '5533999990000', address: { street: 'Rua A', number: '10', city: 'Teófilo Otoni', state: 'mg' } });
  const U1 = r.j; ok('unidade criada', r.s === 201 && U1?.id && U1.address?.state === 'MG', r.j);
  r = await call(tok, 'POST', '/whatsapp/units', { name: 'Loja Norte' }); const U2 = r.j;
  r = await call(crmTok, 'POST', '/whatsapp/units', { name: 'X' });
  ok('membro não cria unidade → 403', r.s === 403, r.s);
  const doc1 = cpf();
  r = await call(tok, 'POST', '/whatsapp/customers', { name: 'Maria Cliente', phone: '5500999990711', doc: doc1, email: `maria-${stamp}@exemplo.com`, unit_id: U1.id, external_id: `ERP-${stamp}`, custom: { data_de_nascimento: '05/03/1990', plano_odonto: 'sim' }, addresses: [{ kind: 'delivery', label: 'Casa', street: 'Rua das Flores', number: '120', district: 'Centro', city: 'Teófilo Otoni', state: 'MG', zip: '39800-000', is_default: true }] });
  const C1 = r.j;
  ok('cliente com unidade, externo, endereço e campos', r.s === 201 && C1.unit?.name === 'Loja Centro' && C1.external_id === `ERP-${stamp}` && C1.addresses?.[0]?.zip === '39800000' && C1.custom?.data_de_nascimento === '1990-03-05' && C1.custom?.plano_odonto === 'Sim', r.j);
  r = await call(tok, 'POST', '/whatsapp/customers', { name: 'Outro', phone: '5500999990712', external_id: `ERP-${stamp}`, custom: { data_de_nascimento: '1991-01-01' } });
  ok('código externo repetido → 400', r.s === 400 && /externo/i.test(r.j?.message), r.j);
  r = await call(tok, 'GET', `/whatsapp/customers?unit_id=${U1.id}`);
  ok('filtro por unidade', r.s === 200 && r.j.items?.length === 1 && r.j.items[0].id === C1.id, r.j?.total);
  r = await call(tok, 'PUT', `/whatsapp/customers/${C1.id}`, { custom: { data_de_nascimento: '' } });
  ok('edição apagando obrigatório → 400', r.s === 400 && r.j?.code === 'CUSTOM_REQUIRED', r.j);
  r = await call(tok, 'POST', '/org/api-keys', { name: 'ERP', scopes: ['customers:read', 'orders:read', 'orders:write', 'subscriptions:write'] });
  const apiKey = r.j?.key;
  r = await call(null, 'GET', `/api/v1/whatsapp/customers?external_id=ERP-${stamp}`, null, { Authorization: 'Bearer ' + apiKey });
  ok('API: busca pelo código externo', r.s === 200 && r.j.items?.[0]?.id === C1.id, r.j);

  // ---------------- chamado com campo obrigatório
  r = await call(tok, 'POST', '/whatsapp/tickets', { category: 'duvida', description: 'Teste de campo obrigatório', customer_id: C1.id, notify: false });
  ok('chamado sem campo obrigatório → 400', r.s === 400 && r.j?.code === 'CUSTOM_REQUIRED', r.j);
  r = await call(tok, 'POST', '/whatsapp/tickets', { category: 'duvida', description: 'Teste de campo obrigatório', customer_id: C1.id, custom: { bairro: 'norte' }, notify: false });
  ok('chamado com campo (opção normalizada)', r.s === 201 && r.j.custom?.bairro === 'Norte', r.j);

  // ---------------- Asaas sandbox (PIX das cobranças e pedidos)
  r = await call(tok, 'PUT', '/payments/settings', { crm: { asaas_token: KEY, pix: 'asaas' } });
  ok('Asaas sandbox para o PIX', r.s === 200, r.j?.message);
  r = await call(tok, 'POST', '/whatsapp/charges', { customer_id: C1.id, amount_cents: 1500, description: 'Teste', kind: 'pix', send: false });
  ok('cobrança manual sem campo obrigatório → 400', r.s === 400 && r.j?.code === 'CUSTOM_REQUIRED', r.j);

  // ---------------- pedidos
  const mk = async (b) => (await call(tok, 'POST', '/whatsapp/products', { billing: 'once', active: true, ...b })).j;
  const PIZZA = await mk({ name: 'Pizza grande', price_cents: 4000, category: 'Pizzas', custom: { marca: 'Da casa' } });
  const REFRI = await mk({ name: 'Refrigerante 2L', price_cents: 800, category: 'Bebidas' });
  await mk({ name: 'Plano mensal', price_cents: 5000, billing: 'monthly' });
  r = await call(tok, 'PUT', '/whatsapp/orders/settings', { delivery: { enabled: true, fee_cents: 500, free_from_cents: 10000 }, pickup: { enabled: true, address: 'Rua A, 10' }, min_order_cents: 1000, payment_methods: ['pix', 'on_delivery'] });
  ok('configuração de pedidos', r.s === 200 && r.j.delivery.fee_cents === 500 && r.j.min_order_cents === 1000, r.j);
  r = await call(tok, 'GET', '/whatsapp/orders/catalog');
  ok('catálogo: 2 categorias, sem plano recorrente', r.s === 200 && r.j.categories.length === 2 && r.j.total === 2, r.j);
  r = await call(tok, 'POST', '/whatsapp/orders', { customer_id: C1.id, items: [{ product_id: REFRI.id, qty: 1 }], delivery: { mode: 'pickup' }, payment_method: 'on_delivery' });
  ok('abaixo do pedido mínimo → 400', r.s === 400 && /mínimo/.test(r.j?.message), r.j);
  r = await call(tok, 'POST', '/whatsapp/orders', { customer_id: C1.id, items: [{ product_id: PIZZA.id, qty: 1 }], delivery: { mode: 'delivery' }, payment_method: 'on_delivery' });
  ok('entrega sem endereço (cliente sem escolha) → 400', r.s === 400 && /endereço/.test(r.j?.message), r.j);
  r = await call(tok, 'POST', '/whatsapp/orders', { customer_id: C1.id, items: [{ product_id: PIZZA.id, qty: 1 }, { product_id: REFRI.id, qty: 2 }, { product_id: PIZZA.id, qty: 1 }], delivery: { mode: 'delivery', address_id: C1.addresses[0].id }, payment_method: 'on_delivery', custom: { troco_para: '100,00' } });
  const O1 = r.j?.order;
  ok('pedido com entrega: itens somados, taxa 5,00, total 101,00, troco', r.s === 201 && O1.items.length === 2 && O1.items[0].qty === 2 && O1.delivery_fee_cents === 500 && O1.total_cents === 10100 && O1.custom?.troco_para === 100 && O1.payment_status === 'not_required' && O1.unit?.name === 'Loja Centro', r.j);
  ok('aviso "pedido recebido" na fila', Number(sql(`SELECT COUNT(*) FROM whatsapp_outbox WHERE organization_id='${orgId}' AND kind='order_created'`)) === 1);
  r = await call(tok, 'POST', `/whatsapp/orders/${O1.id}/status`, { status: 'delivered' });
  ok('pular para entregue a partir de recebido → 400', r.s === 400, r.j);
  for (const st of ['confirmed', 'preparing', 'out_for_delivery']) r = await call(tok, 'POST', `/whatsapp/orders/${O1.id}/status`, { status: st });
  ok('andamento até "saiu para entrega"', (r.s === 200 || r.s === 201) && r.j.status === 'out_for_delivery' && r.j.history.length === 4, r.j?.status);
  r = await call(tok, 'POST', `/whatsapp/orders/${O1.id}/status`, { status: 'delivered' });
  ok('entregue com pagamento na entrega → pago', (r.s === 200 || r.s === 201) && r.j.status === 'delivered' && r.j.payment_status === 'paid', r.j?.payment_status);
  r = await call(tok, 'POST', '/whatsapp/orders', { customer_id: C1.id, items: [{ product_id: PIZZA.id, qty: 3 }], delivery: { mode: 'pickup' }, payment_method: 'pix' });
  const O2 = r.j?.order;
  ok('pedido por PIX: cobrança gerada no Asaas', r.s === 201 && O2.payment_status === 'pending' && O2.charge?.id && sql(`SELECT IFNULL(pix_charge_id,'') FROM whatsapp_charges WHERE id='${O2.charge.id}'`).startsWith('pay_'), r.j);
  const payId = sql(`SELECT pix_charge_id FROM whatsapp_charges WHERE id='${O2.charge.id}'`);
  const conf = await asa('POST', `/sandbox/payment/${payId}/confirm`);
  let pst = '';
  for (let i = 0; i < 40; i++) { pst = sql(`SELECT CONCAT(payment_status,'|',status) FROM whatsapp_orders WHERE id='${O2.id}'`); if (pst.startsWith('paid')) break; if (i === 20) await call(tok, 'POST', `/whatsapp/charges/${O2.charge.id}/check`); await sleep(3000); }
  ok('PIX pago (sandbox) → pedido pago e confirmado', conf.s === 200 && pst === 'paid|confirmed', { conf: conf.s, pst });
  r = await call(tok, 'POST', '/whatsapp/orders', { customer_id: C1.id, items: [{ product_id: PIZZA.id, qty: 1 }], delivery: { mode: 'pickup' }, payment_method: 'pix' });
  const O3 = r.j?.order;
  r = await call(tok, 'POST', `/whatsapp/orders/${O3.id}/status`, { status: 'canceled', reason: 'Cliente desistiu' });
  ok('cancelar pedido PIX cancela a cobrança', (r.s === 200 || r.s === 201) && r.j.status === 'canceled' && sql(`SELECT status FROM whatsapp_charges WHERE id='${O3.charge.id}'`) === 'CANCELED', { st: r.j?.status, ch: sql(`SELECT status FROM whatsapp_charges WHERE id='${O3.charge.id}'`) });
  const many = await Promise.all(Array.from({ length: 20 }, () => call(null, 'POST', '/api/v1/whatsapp/orders', { customer_id: C1.id, items: [{ product_id: PIZZA.id, qty: 1 }], delivery: { mode: 'pickup' }, payment_method: 'on_delivery', notify: false }, { Authorization: 'Bearer ' + apiKey })));
  const nums = many.filter((x) => x.s === 201).map((x) => x.j.order.number).sort((a, b) => a - b);
  ok('20 pedidos simultâneos pela API: números 4..23 sem furo', nums.length === 20 && nums.every((n, i) => n === i + 4), nums);
  r = await call(tok, 'GET', '/whatsapp/orders/board');
  ok('quadro com colunas por status', r.s === 200 && r.j.columns.length === 6 && r.j.columns.find((c) => c.status === 'new').items.length === 20, r.j?.columns?.map((c) => `${c.status}:${c.items.length}`));
  r = await call(tok, 'GET', '/whatsapp/orders/counts');
  ok('contagens de pedidos', r.s === 200 && r.j.open === 21 && r.j.canceled === 1 && r.j.delivered === 1, r.j);
  r = await call(tok, 'GET', `/whatsapp/orders?q=${O1.number}`);
  ok('busca pelo número', r.s === 200 && r.j.items.some((x) => x.id === O1.id), r.j?.total);

  // ---------------- financeiro
  r = await call(null, 'POST', `/api/v1/whatsapp/customers/${C1.id}/subscriptions`, { product_id: sql(`SELECT id FROM whatsapp_products WHERE organization_id='${orgId}' AND name='Plano mensal'`), due_day: 10 }, { Authorization: 'Bearer ' + apiKey });
  ok('assinatura mensal criada (sem cobrar)', r.s === 201, r.j?.message);
  r = await call(tok, 'GET', `/whatsapp/finance?from=${brt()}&to=${brt()}`);
  // recebido = cobranças pagas + "Pedidos pagos na entrega" (pedido pago sem cobrança paga — revisão P7-8, 14/10/2026)
  const recSql = Number(sql(`SELECT IFNULL(SUM(amount_cents),0) FROM whatsapp_charges WHERE organization_id='${orgId}' AND status='PAID'`))
    + Number(sql(`SELECT IFNULL(SUM(o.total_cents),0) FROM whatsapp_orders o LEFT JOIN whatsapp_charges c ON c.id=o.charge_id WHERE o.organization_id='${orgId}' AND o.payment_status='paid' AND o.total_cents>0 AND (c.id IS NULL OR c.status<>'PAID')`));
  ok('financeiro: MRR 50,00, 1 ativa, recebido = SQL, PIX por meio', r.s === 200 && r.j.kpis.mrr_cents === 5000 && r.j.kpis.active_subscriptions === 1 && r.j.kpis.received_cents === recSql && r.j.received_by_method.some((m) => m.method === 'pix'), { k: r.j?.kpis, recSql });
  ok('financeiro: por unidade (Loja Centro)', r.j?.by_unit?.[0]?.name === 'Loja Centro', r.j?.by_unit);
  r = await call(tok, 'GET', `/whatsapp/finance?unit_id=${U2.id}`);
  ok('financeiro filtrado pela unidade sem clientes = zero', r.s === 200 && r.j.kpis.received_cents === 0 && r.j.kpis.mrr_cents === 0, r.j?.kpis);
  const csvRes = await fetch(`${API}/whatsapp/finance/export?kind=charges&from=${brt()}&to=${brt()}`, { headers: { Authorization: 'Bearer ' + tok } });
  const csvBuf = Buffer.from(await csvRes.arrayBuffer());
  const csvTxt = csvBuf.toString('utf8');
  ok('export CSV com BOM e cabeçalho', csvRes.status === 200 && csvBuf[0] === 0xef && csvBuf[1] === 0xbb && csvBuf[2] === 0xbf && csvTxt.includes('Pago em;Cliente') && csvTxt.includes('Maria Cliente'), csvTxt.slice(0, 120));

  // ---------------- unidade apagada solta o vínculo
  r = await call(tok, 'DELETE', `/whatsapp/units/${U1.id}`);
  ok('apagar unidade solta clientes e pedidos', r.s === 200 && sql(`SELECT IFNULL(unit_id,'null') FROM whatsapp_customers WHERE id='${C1.id}'`) === 'null' && sql(`SELECT COUNT(*) FROM whatsapp_orders WHERE organization_id='${orgId}' AND unit_id IS NOT NULL`) === '0', r.j);

  // ---------------- modelos
  r = await call(tok, 'GET', '/whatsapp/templates');
  ok('lista de modelos responde', r.s === 200 && Array.isArray(r.j), r.s);
} catch (e) {
  fails++; console.log('ERRO', e?.stack || e);
} finally {
  if (orgId) {
    const ids = sql(`SELECT CONCAT_WS(',',IFNULL(pix_charge_id,''),IFNULL(boleto_charge_id,''),IFNULL(card_charge_id,'')) FROM whatsapp_charges WHERE organization_id='${orgId}' AND status<>'PAID'`).split('\n').join(',').split(',').filter((v) => /^pay_/.test(v));
    for (const id of ids) await asa('DELETE', `/payments/${id}`).catch(() => {});
    sql(`UPDATE whatsapp_sessions SET status='none', openwa_session_id=NULL, paired_at=NULL WHERE organization_id='${orgId}'`);
    sql(`DELETE FROM whatsapp_outbox WHERE organization_id='${orgId}'`);
    const r = await call(saTok, 'DELETE', `/admin/organizations/${orgId}`);
    const left = ['whatsapp_units', 'whatsapp_orders', 'whatsapp_counters', 'whatsapp_customers', 'whatsapp_charges'].map((t) => `${t}=${sql(`SELECT COUNT(*) FROM ${t} WHERE organization_id='${orgId}'`)}`);
    ok('org apagada: tabelas limpas', (r.s === 200 || r.s === 204) && left.every((x) => x.endsWith('=0')), left);
  }
  console.log(`\n${total - fails}/${total} passaram${fails ? ` — ${fails} FALHAS` : ''}`);
  process.exit(fails ? 1 : 0);
}
