// Capturas das telas da Fase 7 (Pedidos, Financeiro, Clientes/Unidades, campos personalizados, modelos, permissões) numa ORG TEMPORÁRIA
// (apagada no fim) — roda NO SERVIDOR:
//   scp docs/tools/wa_fase7_shots.mjs pubmail-hostinger:/opt/pub-mail/back/wa_f7_shots.tmp.mjs
//   ssh pubmail-hostinger 'cd /opt/pub-mail/back && NODE_PATH=/opt/keepalive/node_modules node wa_f7_shots.tmp.mjs; rm -f wa_f7_shots.tmp.mjs'
// Saída: /tmp/shots-f7/*.png + relatório (rolagem lateral e erros de console).
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire('/opt/keepalive/package.json');
const { chromium, devices } = require('playwright');
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const API = 'http://127.0.0.1:8000';
const db = await mysql.createConnection({ host: '127.0.0.1', user: env.DATABASE_USER, password: env.DATABASE_PASS, database: env.DATABASE_NAME });
const q = async (s, p) => (await db.query(s, p))[0];
const [sa] = await q("SELECT id, organization_id FROM users WHERE email='superadmin@pubmail.com'");
const sign = (sub, org, role) => jwt.sign({ sub, org, role }, env.JWT_ACCESS_SECRET, { expiresIn: '30m' });
const saTok = sign(sa.id, sa.organization_id, 'SUPER_ADMIN');
const call = async (tok, m, p, b) => { const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { s: r.status, j }; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const brt = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const addDays = (s, n) => new Date(new Date(`${s}T12:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
const at = (day, hm) => new Date(`${day}T${hm}:00-03:00`).toISOString();
const week = (ranges) => Object.fromEntries(['0', '1', '2', '3', '4', '5', '6'].map((k) => [k, ranges]));
const OUT = '/tmp/shots-f7'; fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const stamp = Date.now().toString(36);
let orgId;
const errors = []; const report = [];
const dayAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 19).replace('T', ' ');
try {
  const c = await call(saTok, 'POST', '/admin/clients', { name: 'Capturas Fase 7', email: `shots-f7-${stamp}@teste.local`, password: 'Senha!Teste123', org_name: `E2E Capturas Fase7 ${stamp}`, modules: ['whatsapp', 'settings'], price_cents: 0 });
  orgId = c.j.organization.id;
  const tok = sign(c.j.user.id, orgId, 'OWNER');
  await call(saTok, 'POST', '/admin/users', { organization_id: orgId, name: 'Atendente Bia', email: `shots-f7-bia-${stamp}@teste.local`, password: 'Senha!Teste123', role: 'MEMBER', modules: ['whatsapp', 'whatsapp:crm'] });
  const sess = await call(tok, 'POST', '/whatsapp/sessions', { label: 'Loja' });
  await q(`UPDATE whatsapp_sessions SET status='ready', engine='baileys', phone='5500999990801', push_name='Mercadinho', paired_at=NOW(3), openwa_session_id=NULL WHERE id=?`, [sess.j.id]);
  await call(tok, 'PUT', '/whatsapp/crm-settings', { custom_fields: {
    customer: [{ label: 'Data de nascimento', type: 'date', ask_in_bot: true }, { label: 'Como conheceu', type: 'select', options: ['Instagram', 'Indicação', 'Google'], visible_to_customer: false }],
    order: [{ label: 'Troco para', type: 'number', ask_in_bot: true, help: 'Só para pagamento na entrega' }],
    product: [{ label: 'Marca', type: 'text' }],
  } });
  const u1 = (await call(tok, 'POST', '/whatsapp/units', { name: 'Loja Centro', code: 'CTR', phone: '5533999990000', address: { street: 'Av. Brasil', number: '100', city: 'Teófilo Otoni', state: 'MG' } })).j;
  await call(tok, 'POST', '/whatsapp/units', { name: 'Loja Bairro Novo', code: 'BNV' });
  const mk = async (b) => (await call(tok, 'POST', '/whatsapp/products', { billing: 'once', active: true, ...b })).j;
  const p1 = await mk({ name: 'Pão francês (kg)', price_cents: 1890, category: 'Padaria' });
  const p2 = await mk({ name: 'Leite integral 1L', price_cents: 549, category: 'Laticínios' });
  const p3 = await mk({ name: 'Café 500g', price_cents: 1999, category: 'Mercearia', custom: { marca: 'Da Fazenda' } });
  await mk({ name: 'Arroz 5kg', price_cents: 2790, category: 'Mercearia' });
  const plan = (await call(tok, 'POST', '/whatsapp/products', { name: 'Clube de vantagens', price_cents: 2990, billing: 'monthly' })).j;
  await call(tok, 'PUT', '/whatsapp/orders/settings', { delivery: { enabled: true, fee_cents: 600, free_from_cents: 10000 }, pickup: { enabled: true, address: 'Av. Brasil, 100' }, min_order_cents: 1500, payment_methods: ['pix', 'on_delivery'] });
  const names = ['Maria Souza', 'João Pedro', 'Fernanda Rocha', 'Carlos Lima', 'Patrícia Alves'];
  const custs = [];
  for (let i = 0; i < names.length; i++) {
    const r = await call(tok, 'POST', '/whatsapp/customers', { name: names[i], phone: `55009999908${10 + i}`, unit_id: i % 2 ? undefined : u1.id, external_id: `ERP-${1000 + i}`, custom: { data_de_nascimento: `1990-0${(i % 9) + 1}-15`, como_conheceu: ['Instagram', 'Indicação', 'Google'][i % 3] },
      addresses: [{ kind: 'delivery', label: 'Casa', street: 'Rua das Flores', number: String(100 + i), district: 'Centro', city: 'Teófilo Otoni', state: 'MG', zip: '39800000', is_default: true }] });
    custs.push(r.j);
  }
  for (const cu of custs.slice(0, 3)) await call(tok, 'POST', `/whatsapp/customers/${cu.id}/subscriptions`, { product_id: plan.id, due_day: 10 });
  const orders = [];
  const mkOrder = async (ci, items, mode, pm) => { const r = await call(tok, 'POST', '/whatsapp/orders', { customer_id: custs[ci].id, items, delivery: mode === 'delivery' ? { mode, address_id: custs[ci].addresses[0].id } : { mode }, payment_method: pm, notify: false, custom: pm === 'on_delivery' ? { troco_para: '50' } : {} }); if (r.s !== 201) errors.push('pedido: ' + JSON.stringify(r.j).slice(0, 120)); orders.push(r.j?.order); return r.j?.order; };
  await mkOrder(0, [{ product_id: p1.id, qty: 1 }, { product_id: p2.id, qty: 2 }], 'delivery', 'on_delivery');
  const o2 = await mkOrder(1, [{ product_id: p3.id, qty: 2 }], 'pickup', 'on_delivery');
  const o3 = await mkOrder(2, [{ product_id: p1.id, qty: 2 }, { product_id: p3.id, qty: 1 }], 'delivery', 'on_delivery');
  const o4 = await mkOrder(3, [{ product_id: p2.id, qty: 6 }], 'delivery', 'on_delivery');
  if (o2) await call(tok, 'POST', `/whatsapp/orders/${o2.id}/status`, { status: 'confirmed', notify: false });
  if (o3) { await call(tok, 'POST', `/whatsapp/orders/${o3.id}/status`, { status: 'preparing', notify: false }); }
  if (o4) for (const st of ['confirmed', 'preparing', 'out_for_delivery']) await call(tok, 'POST', `/whatsapp/orders/${o4.id}/status`, { status: st, notify: false });
  // recebimentos de exemplo (financeiro): linhas PAID em dias diferentes
  for (let i = 0; i < 18; i++) {
    const cu = custs[i % custs.length];
    await q(`INSERT INTO whatsapp_charges (id, organization_id, session_id, customer_id, product_id, chat_id, kind, amount_cents, base_amount_cents, description, due_at, status, origin, provider, paid_at, paid_via, reminders, pay_link_token, updated_at) VALUES (UUID(), ?, ?, ?, ?, ?, 'pix', ?, ?, 'Mensalidade', ?, 'PAID', 'manual', 'mercadopago', ?, ?, '[]', ?, NOW(3))`,
      [orgId, sess.j.id, cu.id, i % 3 === 0 ? plan.id : p3.id, `55009999908${10 + (i % 5)}@c.us`, 2990 + (i % 4) * 1000, 2990 + (i % 4) * 1000, dayAgo(i).slice(0, 10), dayAgo(i), ['pix', 'pix', 'boleto', 'card'][i % 4], `shots${stamp}${i}`]);
  }
  await q(`INSERT INTO whatsapp_charges (id, organization_id, session_id, customer_id, chat_id, kind, amount_cents, base_amount_cents, description, due_at, status, origin, provider, reminders, pay_link_token, updated_at) VALUES (UUID(), ?, ?, ?, ?, 'pix', 2990, 2990, 'Mensalidade em atraso', ?, 'PENDING', 'manual', 'mercadopago', '[]', ?, NOW(3))`, [orgId, sess.j.id, custs[4].id, '5500999990814@c.us', dayAgo(5).slice(0, 10), `shots${stamp}late`]);
  await call(tok, 'POST', '/access/welcome-seen');
  const me = (await call(tok, 'GET', '/auth/me')).j;
  const browser = await chromium.launch();
  for (const mode of [{ name: '', view: { viewport: { width: 1440, height: 900 } }, dark: false }, { name: '-mobile-dark', view: devices['iPhone 13'], dark: true }]) {
    const ctx = await browser.newContext({ ...mode.view, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', colorScheme: mode.dark ? 'dark' : 'light' });
    await ctx.addInitScript(([t, u2, dark]) => { try { localStorage.setItem('token', t); localStorage.setItem('refreshToken', t); localStorage.setItem('user', JSON.stringify(u2)); localStorage.setItem('theme-mode', dark ? 'dark' : 'light'); } catch {} }, [tok, me, mode.dark]);
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e.message || e).slice(0, 200)));
    const shot = async (n) => { await page.waitForTimeout(1600); const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })); await page.screenshot({ path: `${OUT}/${n}${mode.name}.png` }); report.push({ n: n + mode.name, hscroll: m.sw > m.cw }); };
    const go = (p) => page.goto('https://reveleonline.com' + p, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await go('/whatsapp/orders'); await shot('pedidos-quadro');
    await go('/whatsapp/orders?view=list'); await shot('pedidos-lista');
    if (o4) { await go(`/whatsapp/orders?order=${o4.id}`); await shot('pedido-detalhe'); }
    await go('/whatsapp/orders');
    await page.getByRole('button', { name: /Novo pedido/ }).first().click({ timeout: 5000 }).catch((e) => errors.push('novo pedido: ' + e.message.slice(0, 80)));
    await shot('pedido-novo'); await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    await go('/whatsapp/orders?view=settings'); await shot('pedidos-config');
    await go('/whatsapp/finance'); await shot('financeiro');
    await go('/whatsapp/customers'); await shot('clientes');
    await page.getByRole('tab', { name: /Unidades/ }).first().click({ timeout: 5000 }).catch((e) => errors.push('aba unidades: ' + e.message.slice(0, 80)));
    await shot('unidades');
    await go('/whatsapp/customers');
    await page.getByText('Maria Souza').first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.getByRole('tab', { name: /Endereços/ }).first().click({ timeout: 5000 }).catch((e) => errors.push('aba endereços: ' + e.message.slice(0, 80)));
    await shot('cliente-enderecos'); await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    await go('/whatsapp/settings'); await page.waitForTimeout(800);
    await page.getByText(/Começar com um modelo/).first().scrollIntoViewIfNeeded().catch(() => {});
    await shot('config-modelos');
    await page.getByRole('button', { name: /Campos personalizados|Editar campos/ }).first().click({ timeout: 5000 }).catch((e) => errors.push('campos: ' + e.message.slice(0, 80)));
    await shot('campos-editor'); await page.keyboard.press('Escape');
    await ctx.close();
  }
  await browser.close();
} catch (e) { errors.push('SCRIPT ' + String(e?.stack || e).slice(0, 300)); }
finally {
  if (orgId) {
    await q(`UPDATE whatsapp_sessions SET status='none', openwa_session_id=NULL, paired_at=NULL WHERE organization_id=?`, [orgId]);
    await q(`DELETE FROM whatsapp_outbox WHERE organization_id=?`, [orgId]);
    await call(saTok, 'DELETE', `/admin/organizations/${orgId}`);
    const [left] = await q('SELECT COUNT(*) n FROM whatsapp_orders WHERE organization_id=?', [orgId]);
    report.push({ cleanup: left.n === 0 ? 'org apagada' : `sobrou ${left.n}` });
  }
  await db.end();
  console.log(JSON.stringify({ report, errors: [...new Set(errors)].slice(0, 20) }, null, 1));
}
