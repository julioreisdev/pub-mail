// Capturas das telas das Fases 2 e 3 (assinaturas) — roda NO SERVIDOR, SÓ LEITURA (abre telas e diálogos, não salva nada):
//   ssh pubmail-hostinger 'cat > /opt/pub-mail/back/wa_subs_shots.tmp.mjs' < docs/tools/wa_subs_shots.mjs
//   ssh pubmail-hostinger 'cd /opt/pub-mail/back && NODE_PATH=/opt/keepalive/node_modules node wa_subs_shots.tmp.mjs; rm -f wa_subs_shots.tmp.mjs'
// DARK=1 tema escuro · MOBILE=1 iPhone 13. Saída /tmp/shots-subs/*.png + relatório (rolagem lateral e erros de console).
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { createRequire } from 'node:module';
const require = createRequire('/opt/keepalive/package.json');
const { chromium, devices } = require('playwright');
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const db = await mysql.createConnection({ host: '127.0.0.1', user: env.DATABASE_USER, password: env.DATABASE_PASS, database: env.DATABASE_NAME });
const [[u]] = await db.query("SELECT id, organization_id, role FROM users WHERE email='superadmin@pubmail.com'");
const [[flow]] = await db.query('SELECT id FROM whatsapp_bot_flows WHERE organization_id=? ORDER BY position LIMIT 1', [u.organization_id]);
await db.end();
const tok = jwt.sign({ sub: u.id, org: u.organization_id, role: u.role }, env.JWT_ACCESS_SECRET, { expiresIn: '1h' });
const me = await fetch('http://127.0.0.1:8000/auth/me', { headers: { Authorization: 'Bearer ' + tok } }).then((r) => r.json());
const OUT = '/tmp/shots-subs'; fs.mkdirSync(OUT, { recursive: true });
const suffix = `${process.env.MOBILE ? '-mobile' : ''}${process.env.DARK ? '-dark' : ''}`;
const browser = await chromium.launch();
const view = process.env.MOBILE ? devices['iPhone 13'] : { viewport: { width: 1440, height: 900 } };
const ctx = await browser.newContext({ ...view, locale: 'pt-BR', colorScheme: process.env.DARK ? 'dark' : 'light' });
await ctx.addInitScript(([t, u2, dark]) => { try { localStorage.setItem('token', t); localStorage.setItem('refreshToken', t); localStorage.setItem('user', JSON.stringify(u2)); localStorage.setItem('theme-mode', dark ? 'dark' : 'light'); } catch {} }, [tok, me, Boolean(process.env.DARK)]);
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e.message || e).slice(0, 200)));
const report = [];
const shot = async (name) => { await page.waitForTimeout(1200); const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })); await page.screenshot({ path: `${OUT}/${name}${suffix}.png` }); report.push({ name, hscroll: m.sw > m.cw }); };
const go = async (path) => { await page.goto('https://reveleonline.com' + path, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}); await page.waitForTimeout(2000); };
const click = async (re) => { const b = page.getByRole('button', { name: re }).first(); if (await b.count()) { await b.click().catch(() => {}); return true; } report.push({ missing: String(re) }); return false; };
const close = async () => { await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(500); };

await go('/whatsapp/products'); await shot('produtos');
if (await click(/Novo produto/)) {
  await shot('produto-dialogo');
  for (const t of [/Teste grátis/i, /Cancelamento/i, /Régua/i]) await page.getByText(t).first().click().catch(() => {});
  await page.waitForTimeout(600);
  await page.locator('[role=dialog] .MuiDialogContent-root, [role=dialog]').first().evaluate((el) => { el.scrollTop = el.scrollHeight / 2; }).catch(() => {});
  await shot('produto-dialogo-regras'); await close();
}
await go('/whatsapp/products?tab=coupons'); await shot('cupons');
if (await click(/Novo cupom/)) { await shot('cupom-dialogo'); await close(); }
await go('/whatsapp/charges');
if (await click(/^Configurar$/)) { await page.getByText(/Juros, multa/).first().scrollIntoViewIfNeeded().catch(() => {}); await shot('cobrancas-config'); await close(); }
await go('/whatsapp/customers'); await shot('clientes');
await go(`/whatsapp/bot${flow ? `?flow=${flow.id}` : ''}`); await shot('bot-construtor');
await page.getByText(/^Cliente$/).first().scrollIntoViewIfNeeded().catch(() => {}); await shot('bot-paleta-cliente');
await browser.close();
console.log(JSON.stringify({ report, errors: [...new Set(errors)].slice(0, 15) }, null, 1));
