// Capturas da aba "Assinaturas" do cliente (Fase 3) numa ORG TEMPORÁRIA (dados de teste, apagada no fim) — roda NO SERVIDOR:
//   ssh pubmail-hostinger 'cat > /opt/pub-mail/back/wa_subs_cust.tmp.mjs' < docs/tools/wa_subs_customer_shots.mjs
//   ssh pubmail-hostinger 'cd /opt/pub-mail/back && NODE_PATH=/opt/keepalive/node_modules node wa_subs_cust.tmp.mjs; rm -f wa_subs_cust.tmp.mjs'
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { createRequire } from 'node:module';
const require = createRequire('/opt/keepalive/package.json');
const { chromium, devices } = require('playwright');
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const API = 'http://127.0.0.1:8000';
const db = await mysql.createConnection({ host: '127.0.0.1', user: env.DATABASE_USER, password: env.DATABASE_PASS, database: env.DATABASE_NAME });
const [[sa]] = await db.query("SELECT id, organization_id, role FROM users WHERE email='superadmin@pubmail.com'");
await db.end();
const sign = (sub, org, role) => jwt.sign({ sub, org, role }, env.JWT_ACCESS_SECRET, { expiresIn: '30m' });
const saTok = sign(sa.id, sa.organization_id, 'SUPER_ADMIN');
const call = async (tok, m, p, b) => { const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };
const OUT = '/tmp/shots-subs'; fs.mkdirSync(OUT, { recursive: true });
const stamp = Date.now().toString(36);
let orgId;
const errors = []; const report = [];
try {
  const c = await call(saTok, 'POST', '/admin/clients', { name: 'Capturas Owner', email: `shots-${stamp}@teste.local`, password: 'Senha!Teste123', org_name: `E2E Capturas ${stamp}`, modules: ['whatsapp', 'settings'], price_cents: 0 });
  orgId = c.organization.id;
  const tok = sign(c.user.id, orgId, 'OWNER');
  const p1 = await call(tok, 'POST', '/whatsapp/products', { name: 'Plano 100 Mega', price_cents: 9990, billing: 'monthly', trial_days: 7 });
  await call(tok, 'POST', '/whatsapp/products', { name: 'Plano 300 Mega', price_cents: 14990, billing: 'monthly', grace_days: 5 });
  await call(tok, 'POST', '/whatsapp/coupons', { code: 'BEMVINDO10', value: 10, duration: 'months', months: 3 });
  const cust = await call(tok, 'POST', '/whatsapp/customers', { phone: '5500999990081', name: 'Rita Cliente Exemplo', doc: '52998224725', email: 'rita@exemplo.com' });
  await call(tok, 'POST', `/whatsapp/customers/${cust.id}/subscriptions`, { product_id: p1.id, coupon: 'BEMVINDO10', due_day: 10 });
  await call(tok, 'POST', '/access/welcome-seen'); // conta nova: sem o modal de boas-vindas por cima
  const me = await call(tok, 'GET', '/auth/me');
  const browser = await chromium.launch();
  for (const mode of [{ name: '', view: { viewport: { width: 1440, height: 900 } }, dark: false }, { name: '-mobile-dark', view: devices['iPhone 13'], dark: true }]) {
    const ctx = await browser.newContext({ ...mode.view, locale: 'pt-BR', colorScheme: mode.dark ? 'dark' : 'light' });
    await ctx.addInitScript(([t, u2, dark]) => { try { localStorage.setItem('token', t); localStorage.setItem('refreshToken', t); localStorage.setItem('user', JSON.stringify(u2)); localStorage.setItem('theme-mode', dark ? 'dark' : 'light'); } catch {} }, [tok, me, mode.dark]);
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e.message || e).slice(0, 200)));
    const shot = async (n) => { await page.waitForTimeout(1300); const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })); await page.screenshot({ path: `${OUT}/${n}${mode.name}.png` }); report.push({ n: n + mode.name, hscroll: m.sw > m.cw }); };
    await page.goto('https://reveleonline.com/whatsapp/customers', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await page.getByText('Rita Cliente Exemplo').first().click().catch(() => {});
    await page.waitForTimeout(1500);
    await page.getByRole('tab', { name: /Assinaturas/ }).first().click().catch(() => {});
    await shot('cliente-assinaturas');
    // formulário de nova assinatura com prévia
    const add = page.getByRole('button', { name: /Adicionar produto \/ assinatura/ }).first();
    if (await add.count()) { await add.click().catch(() => {}); await page.waitForTimeout(800); await page.getByRole('button', { name: /Cupom|Aplicar/ }).first().scrollIntoViewIfNeeded().catch(() => {}); await page.locator('[role=dialog] input[type=checkbox]').last().check().catch(() => {}); await page.waitForTimeout(1200); await shot('cliente-nova-assinatura'); await page.getByRole('button', { name: /^Cancelar$/ }).first().click().catch(() => {}); await page.waitForTimeout(500); }
    else report.push({ missing: 'botão nova assinatura' });
    // menu ⋮ da assinatura → Cancelar (só abre o diálogo; nada é confirmado)
    const more = page.locator('[role=dialog] button[aria-label="Ações da assinatura"]').first();
    if (await more.count()) { await more.click().catch(() => {}); await shot('cliente-assinatura-menu'); const cancel = page.getByRole('menuitem', { name: /Cancelar/ }).first(); if (await cancel.count()) { await cancel.click().catch(() => {}); await shot('cliente-assinatura-cancelar'); } await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
    else report.push({ missing: 'botão de ações da assinatura (aria-label)' });
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    await ctx.close();
  }
  await browser.close();
} catch (e) { errors.push('SCRIPT ' + String(e?.stack || e).slice(0, 300)); }
finally {
  if (orgId) { const r = await fetch(`${API}/admin/organizations/${orgId}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + saTok } }); report.push({ org_apagada: r.status }); }
  console.log(JSON.stringify({ report, errors: [...new Set(errors)] }, null, 1));
}
