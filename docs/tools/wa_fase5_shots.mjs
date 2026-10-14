// Capturas das telas da Fase 5 (API e Webhooks, regras de acesso no produto, acessos do cliente) numa ORG TEMPORÁRIA
// (apagada no fim) — roda NO SERVIDOR:
//   scp docs/tools/wa_fase5_shots.mjs pubmail-hostinger:/opt/pub-mail/back/wa_f5_shots.tmp.mjs
//   ssh pubmail-hostinger 'cd /opt/pub-mail/back && NODE_PATH=/opt/keepalive/node_modules node wa_f5_shots.tmp.mjs; rm -f wa_f5_shots.tmp.mjs'
// Saída: /tmp/shots-f5/*.png + relatório (rolagem lateral e erros de console).
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import { createServer } from 'node:http';
import mysql from 'mysql2/promise';
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
const call = async (tok, m, p, b, h = {}) => { const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...h }, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = '/tmp/shots-f5'; fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const server = createServer((req, res) => { req.resume(); req.on('end', () => { res.writeHead(200); res.end('ok'); }); });
await new Promise((r) => server.listen(18999, '127.0.0.1', r));
const stamp = Date.now().toString(36);
let orgId;
const errors = []; const report = [];
try {
  const c = await call(saTok, 'POST', '/admin/clients', { name: 'Capturas Owner', email: `shots-f5-${stamp}@teste.local`, password: 'Senha!Teste123', org_name: `E2E Capturas Fase5 ${stamp}`, modules: ['whatsapp', 'settings'], price_cents: 0 });
  orgId = c.organization.id;
  const tok = sign(c.user.id, orgId, 'OWNER');
  const key = await call(tok, 'POST', '/org/api-keys', { name: 'ERP da loja', scopes: ['customers:read', 'customers:write', 'subscriptions:read', 'subscriptions:write', 'charges:read', 'entitlements:read', 'products:read'] });
  await call(tok, 'POST', '/org/api-keys', { name: 'Painel BI (só leitura)' });
  const hook = await call(tok, 'POST', '/org/webhooks', { name: 'ERP — eventos', url: 'http://127.0.0.1:18999/hook', events: ['*'] });
  await call(tok, 'POST', `/org/webhooks/${hook.id}/test`);
  const tag = await call(tok, 'POST', '/whatsapp/tags', { name: 'VIP', color: '#7C3AED' });
  const p = await call(tok, 'POST', '/whatsapp/products', { name: 'Clube VIP mensal', price_cents: 4990, billing: 'monthly', entitlement: { rules: [
    { kind: 'external', ref: 'area-vip', label: 'Área de membros do site', on_overdue: 'suspend', suspend_after_days: 3, on_cancel: 'revoke' },
    { kind: 'tag', ref: tag.id, label: 'Etiqueta VIP no chat', on_overdue: 'keep', on_cancel: 'revoke' },
  ] } });
  const cust = await call(key.key, 'POST', '/api/v1/whatsapp/customers', { name: 'Rita Cliente Exemplo', phone: '5500999990191', email: 'rita@exemplo.com' });
  await call(key.key, 'POST', `/api/v1/whatsapp/customers/${cust.id}/subscriptions`, { product_id: p.id, due_day: 10 });
  await sleep(6000); // acessos ativam + entregas do webhook
  await call(tok, 'POST', '/access/welcome-seen');
  const me = await call(tok, 'GET', '/auth/me');
  const browser = await chromium.launch();
  for (const mode of [{ name: '', view: { viewport: { width: 1440, height: 900 } }, dark: false }, { name: '-mobile-dark', view: devices['iPhone 13'], dark: true }]) {
    const ctx = await browser.newContext({ ...mode.view, locale: 'pt-BR', colorScheme: mode.dark ? 'dark' : 'light' });
    await ctx.addInitScript(([t, u2, dark]) => { try { localStorage.setItem('token', t); localStorage.setItem('refreshToken', t); localStorage.setItem('user', JSON.stringify(u2)); localStorage.setItem('theme-mode', dark ? 'dark' : 'light'); } catch {} }, [tok, me, mode.dark]);
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e.message || e).slice(0, 200)));
    const shot = async (n) => { await page.waitForTimeout(1300); const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })); await page.screenshot({ path: `${OUT}/${n}${mode.name}.png` }); report.push({ n: n + mode.name, hscroll: m.sw > m.cw }); };
    await page.goto('https://reveleonline.com/settings/api', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await shot('api-chaves');
    await page.locator('button[role=tab]', { hasText: 'Webhooks' }).first().click().catch((e) => errors.push('aba webhooks: ' + e.message.slice(0, 80)));
    await shot('api-webhooks');
    await page.locator('button', { hasText: 'Entregas' }).first().click().catch((e) => errors.push('entregas: ' + e.message.slice(0, 80)));
    await shot('api-entregas');
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    await page.locator('button[role=tab]', { hasText: 'Documenta' }).first().click().catch((e) => errors.push('aba docs: ' + e.message.slice(0, 80)));
    await shot('api-docs');
    await page.goto('https://reveleonline.com/whatsapp/products', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await shot('produtos-chip-acessos');
    await page.locator('div', { hasText: 'Clube VIP mensal' }).locator('button:has(svg.tabler-icon-pencil)').last().click({ timeout: 5000 }).catch((e) => errors.push('produto: ' + e.message.slice(0, 80)));
    await page.waitForTimeout(800);
    await page.getByText('Ao pagar, liberar', { exact: false }).first().click().catch(() => {});
    await page.getByText('Ao pagar, liberar', { exact: false }).first().scrollIntoViewIfNeeded().catch(() => {});
    await shot('produto-regras');
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    await page.goto('https://reveleonline.com/whatsapp/customers', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await page.getByText('Rita Cliente Exemplo').first().click().catch(() => {});
    await page.waitForTimeout(1200);
    await page.getByRole('tab', { name: /Assinaturas/ }).first().click().catch(() => {});
    await page.getByText('Acessos liberados', { exact: false }).first().scrollIntoViewIfNeeded().catch(() => {});
    await shot('cliente-acessos');
    await ctx.close();
  }
  await browser.close();
} catch (e) { errors.push('SCRIPT ' + String(e?.stack || e).slice(0, 300)); }
finally {
  server.close();
  if (orgId) {
    await q(`DELETE FROM whatsapp_outbox WHERE organization_id=?`, [orgId]);
    await call(saTok, 'DELETE', `/admin/organizations/${orgId}`);
    const [left] = await q('SELECT COUNT(*) n FROM org_api_keys WHERE organization_id=?', [orgId]);
    report.push({ cleanup: left.n === 0 ? 'org apagada' : `sobrou ${left.n}` });
  }
  await db.end();
  console.log(JSON.stringify({ report, errors: [...new Set(errors)].slice(0, 20) }, null, 1));
}
