// Capturas das telas da Fase 4 (gateways, cartão, link de pagamento, conciliação) numa ORG TEMPORÁRIA com o Asaas
// SANDBOX (apagada no fim) — roda NO SERVIDOR:
//   scp docs/tools/wa_payments_shots.mjs pubmail-hostinger:/opt/pub-mail/back/wa_pay_shots.tmp.mjs
//   ssh pubmail-hostinger 'cd /opt/pub-mail/back && NODE_PATH=/opt/keepalive/node_modules node wa_pay_shots.tmp.mjs; rm -f wa_pay_shots.tmp.mjs'
// Saída: /tmp/shots-pay/*.png + relatório (rolagem lateral e erros de console).
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { createRequire } from 'node:module';
const require = createRequire('/opt/keepalive/package.json');
const { chromium, devices } = require('playwright');
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const KEY = fs.readFileSync('/root/pubmail.secrets', 'utf8').split('\n').find((l) => l.startsWith('ASAAS_SANDBOX_API_KEY='))?.slice(22).trim();
const API = 'http://127.0.0.1:8000';
const db = await mysql.createConnection({ host: '127.0.0.1', user: env.DATABASE_USER, password: env.DATABASE_PASS, database: env.DATABASE_NAME });
const q = async (s, p) => (await db.query(s, p))[0];
const [sa] = await q("SELECT id, organization_id FROM users WHERE email='superadmin@pubmail.com'");
const sign = (sub, org, role) => jwt.sign({ sub, org, role }, env.JWT_ACCESS_SECRET, { expiresIn: '30m' });
const saTok = sign(sa.id, sa.organization_id, 'SUPER_ADMIN');
const call = async (tok, m, p, b) => { const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };
const asa = async (m, p, b) => { const r = await fetch('https://api-sandbox.asaas.com/v3' + p, { method: m, headers: { access_token: KEY, 'Content-Type': 'application/json', 'User-Agent': 'PubMail-E2E' }, body: b ? JSON.stringify(b) : undefined }); try { return await r.json(); } catch { return null; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = '/tmp/shots-pay'; fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const stamp = Date.now().toString(36);
const DOC = '52998224725';
let orgId;
const errors = []; const report = [];
try {
  const c = await call(saTok, 'POST', '/admin/clients', { name: 'Capturas Owner', email: `shots-pay-${stamp}@teste.local`, password: 'Senha!Teste123', org_name: `E2E Capturas Pagamentos ${stamp}`, modules: ['whatsapp', 'settings'], price_cents: 0 });
  orgId = c.organization.id;
  const tok = sign(c.user.id, orgId, 'OWNER');
  await call(tok, 'PUT', '/payments/settings', { crm: { asaas_token: KEY, pix: 'asaas', boleto: 'asaas', card: 'asaas' } });
  const s = await call(tok, 'POST', '/whatsapp/sessions', { label: 'Principal' });
  await q(`UPDATE whatsapp_sessions SET status='ready', openwa_session_id=?, engine='baileys', paired_at=NOW(3) WHERE id=?`, [`shots-pay-${stamp}`, s.id]);
  const pm = await call(tok, 'POST', '/whatsapp/products', { name: 'Plano Fibra 300 Mega', price_cents: 9990, billing: 'monthly' });
  const po = await call(tok, 'POST', '/whatsapp/products', { name: 'Instalação + roteador', price_cents: 36000, billing: 'once', installments_max: 6 });
  const cust = await call(tok, 'POST', '/whatsapp/customers', { phone: '5500999990091', name: 'Rita Cliente Exemplo', doc: DOC, email: 'rita@exemplo.com' });
  // cartão salvo: paga a página segura no sandbox
  const ch1 = await call(tok, 'POST', '/whatsapp/charges', { customer_id: cust.id, product_id: po.id, kind: 'card', send: false });
  const [r1] = await q('SELECT card_charge_id FROM whatsapp_charges WHERE id=?', [ch1.id]);
  await asa('POST', `/payments/${r1.card_charge_id}/payWithCreditCard`, { creditCard: { holderName: 'RITA EXEMPLO', number: '4444444444444444', expiryMonth: '12', expiryYear: '2030', ccv: '123' }, creditCardHolderInfo: { name: 'Rita Exemplo', email: 'rita@exemplo.com', cpfCnpj: DOC, postalCode: '01310100', addressNumber: '100', phone: '11999999999' } });
  await sleep(3000);
  await call(tok, 'POST', `/whatsapp/charges/${ch1.id}/check`);
  const methods = await call(tok, 'GET', `/whatsapp/customers/${cust.id}/payment-methods`);
  const due = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  await call(tok, 'POST', `/whatsapp/customers/${cust.id}/subscriptions`, { product_id: pm.id, due_day: 10, payment_method: 'card', payment_method_id: methods[0]?.id || null });
  const pixCh = await call(tok, 'POST', '/whatsapp/charges', { customer_id: cust.id, amount_cents: 9990, description: 'Mensalidade de outubro', kind: 'both', send: false });
  const instCh = await call(tok, 'POST', '/whatsapp/charges', { customer_id: cust.id, product_id: po.id, kind: 'card', installments: 6, send: false });
  const autoCh = await call(tok, 'POST', '/whatsapp/charges', { customer_id: cust.id, amount_cents: 9990, description: 'Mensalidade de novembro', kind: 'card', payment_method_id: methods[0]?.id, due_at: due, send: false });
  await call(tok, 'POST', '/access/welcome-seen');
  const me = await call(tok, 'GET', '/auth/me');
  const linkOf = async (id) => (await q('SELECT pay_link_token t FROM whatsapp_charges WHERE id=?', [id]))[0]?.t;
  const browser = await chromium.launch();
  for (const mode of [{ name: '', view: { viewport: { width: 1440, height: 900 } }, dark: false }, { name: '-mobile-dark', view: devices['iPhone 13'], dark: true }]) {
    const ctx = await browser.newContext({ ...mode.view, locale: 'pt-BR', colorScheme: mode.dark ? 'dark' : 'light' });
    await ctx.addInitScript(([t, u2, dark]) => { try { localStorage.setItem('token', t); localStorage.setItem('refreshToken', t); localStorage.setItem('user', JSON.stringify(u2)); localStorage.setItem('theme-mode', dark ? 'dark' : 'light'); } catch {} }, [tok, me, mode.dark]);
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e.message || e).slice(0, 200)));
    const shot = async (n, full = false) => { await page.waitForTimeout(1300); const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })); await page.screenshot({ path: `${OUT}/${n}${mode.name}.png`, fullPage: full }); report.push({ n: n + mode.name, hscroll: m.sw > m.cw }); };
    // Configurações → Pagamentos
    await page.goto('https://reveleonline.com/settings/payments', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.getByText('Cobranças do WhatsApp').first().scrollIntoViewIfNeeded().catch(() => {});
    await shot('pagamentos-gateways');
    // Cobranças
    await page.goto('https://reveleonline.com/whatsapp/charges', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await shot('cobrancas-lista');
    await page.getByRole('button', { name: /Nova cobrança/ }).first().click().catch(() => {});
    await page.waitForTimeout(800);
    await page.locator('[role=dialog] input').first().fill('Rita').catch(() => {});
    await page.waitForTimeout(1200);
    await page.getByRole('option', { name: /Rita/ }).first().click().catch(() => {});
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: /Cartão/ }).first().click().catch(() => {});
    await shot('cobranca-nova-cartao');
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    await page.getByRole('button', { name: /^Cancelar$/ }).first().click().catch(() => {});
    await page.waitForTimeout(1200);
    {
      await page.locator('button', { hasText: 'Conciliar' }).first().click({ timeout: 5000 }).catch((e) => errors.push('conciliar: ' + String(e.message).slice(0, 120)));
      await page.waitForTimeout(4000);
      await shot('conciliacao');
      await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    }
    // Cliente → Assinaturas (forma de pagamento + cartões salvos)
    await page.goto('https://reveleonline.com/whatsapp/customers', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.getByText('Rita Cliente Exemplo').first().click().catch(() => {});
    await page.waitForTimeout(1500);
    await page.getByRole('tab', { name: /Assinaturas/ }).first().click().catch(() => {});
    await shot('cliente-assinatura-cartao');
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    // Produto avulso com parcelas
    await page.goto('https://reveleonline.com/whatsapp/products', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await page.locator('div', { hasText: 'Instalação + roteador' }).locator('button:has(svg.tabler-icon-pencil)').last().click({ timeout: 5000 }).catch((e) => errors.push('produto: ' + String(e.message).slice(0, 120)));
    await page.waitForTimeout(800);
    await shot('produto-parcelas');
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    // Página pública de pagamento (visual fixo; sem login)
    const pub = await ctx.newPage();
    pub.on('pageerror', (e) => errors.push('PAGEERROR pay ' + String(e.message || e).slice(0, 200)));
    for (const [n, id] of [['pay-pix-boleto-cartao', pixCh.id], ['pay-parcelado', instCh.id], ['pay-debito-automatico', autoCh.id], ['pay-pago', ch1.id]]) {
      await pub.goto(`https://reveleonline.com/pay/${await linkOf(id)}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
      await pub.waitForTimeout(1500);
      const m = await pub.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      await pub.screenshot({ path: `${OUT}/${n}${mode.name}.png`, fullPage: true });
      report.push({ n: n + mode.name, hscroll: m.sw > m.cw });
    }
    await ctx.close();
  }
  await browser.close();
} catch (e) { errors.push('SCRIPT ' + String(e?.stack || e).slice(0, 300)); }
finally {
  if (orgId) {
    const rows = await q(`SELECT pix_charge_id a, boleto_charge_id b, card_charge_id c FROM whatsapp_charges WHERE organization_id=? AND status<>'PAID'`, [orgId]);
    for (const r of rows) for (const id of [r.a, r.b, r.c]) if (id) await asa('DELETE', `/payments/${id}`);
    await q(`UPDATE whatsapp_sessions SET status='none', openwa_session_id=NULL, paired_at=NULL WHERE organization_id=?`, [orgId]);
    await q(`DELETE FROM whatsapp_outbox WHERE organization_id=?`, [orgId]);
    await call(saTok, 'DELETE', `/admin/organizations/${orgId}`);
    const [left] = await q('SELECT COUNT(*) n FROM whatsapp_charges WHERE organization_id=?', [orgId]);
    report.push({ cleanup: left.n === 0 ? 'org apagada' : `sobrou ${left.n}` });
  }
  await db.end();
  console.log(JSON.stringify({ report, errors: [...new Set(errors)].slice(0, 20) }, null, 1));
}
