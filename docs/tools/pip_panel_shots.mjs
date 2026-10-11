// Capturas da página WordPress → Push In Play do Pub Mail (painel de métricas) — roda NO SERVIDOR:
//   ssh pubmail-hostinger 'cat > /opt/pub-mail/back/pip_panel_shots.tmp.mjs' < docs/tools/pip_panel_shots.mjs
//   ssh pubmail-hostinger 'cd /opt/pub-mail/back && NODE_PATH=/opt/keepalive/node_modules node pip_panel_shots.tmp.mjs; rm -f pip_panel_shots.tmp.mjs'
// JWT do superadmin assinado com o JWT_ACCESS_SECRET do back/.env (nunca impresso), injetado no localStorage.
// Env: DARK=1 (tema escuro), MOBILE=1 (iPhone 13), OUT=/tmp/shots. Saída: <OUT>/pip-panel[-dark][-mobile].png + erros de console.
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { createRequire } from 'node:module';
const require = createRequire('/opt/keepalive/package.json');
const { chromium, devices } = require('playwright');
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const db = await mysql.createConnection({ host: '127.0.0.1', user: env.DATABASE_USER, password: env.DATABASE_PASS, database: env.DATABASE_NAME });
const [[u]] = await db.query("SELECT id, organization_id, role FROM users WHERE email='superadmin@pubmail.com'");
await db.end();
const tok = jwt.sign({ sub: u.id, org: u.organization_id, role: u.role }, env.JWT_ACCESS_SECRET, { expiresIn: '1h' });
const me = await fetch('http://127.0.0.1:8000/auth/me', { headers: { Authorization: 'Bearer ' + tok } }).then((r) => r.json());
const OUT = process.env.OUT || '/tmp/shots';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const view = process.env.MOBILE ? devices['iPhone 13'] : { viewport: { width: 1440, height: 900 } };
const ctx = await browser.newContext({ ...view, locale: 'pt-BR', colorScheme: process.env.DARK ? 'dark' : 'light' });
await ctx.addInitScript(([t, u2, dark]) => { try { localStorage.setItem('token', t); localStorage.setItem('refreshToken', t); localStorage.setItem('user', JSON.stringify(u2)); localStorage.setItem('theme-mode', dark ? 'dark' : 'light'); } catch {} }, [tok, me, Boolean(process.env.DARK)]);
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 200)));
await page.goto('https://reveleonline.com/wordpress/push-in-play', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
await page.waitForTimeout(3500);
const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sh: document.documentElement.scrollHeight }));
const name = `pip-panel${process.env.DARK ? '-dark' : ''}${process.env.MOBILE ? '-mobile' : ''}`;
await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
const text = await page.locator('body').innerText();
console.log(JSON.stringify({ name, ...m, hscroll: m.sw > m.cw, errors, text: text.replace(/\s+/g, ' ').slice(0, 900) }, null, 1));
await browser.close();
