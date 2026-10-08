// Capturas de TODAS as telas do WhatsApp em viewport de celular (iPhone 13, 390×664) — roda NO SERVIDOR:
//   ssh pubmail-hostinger 'cat > /opt/pub-mail/back/wa_mobile_shots.tmp.mjs' < docs/tools/wa_mobile_shots.mjs
//   ssh pubmail-hostinger 'cd /opt/pub-mail/back && NODE_PATH=/opt/keepalive/node_modules node wa_mobile_shots.tmp.mjs; rm -f wa_mobile_shots.tmp.mjs'
// Usa o Playwright/Chromium instalados em /opt/keepalive (keep-alive do Supabase). Assina um JWT de 1 h do
// superadmin com o JWT_ACCESS_SECRET do back/.env (nunca impresso) e injeta no localStorage antes de cada página.
// Saída: /tmp/shots/<tela>.png + relatório JSON (scrollWidth > clientWidth = rolagem horizontal da página).
// Com DARK=1 captura no tema escuro; DESKTOP=1 usa janela de 1366×768 em vez do celular. Puxar as imagens: ssh pubmail-hostinger 'cd /tmp/shots && tar -czf - *.png' | tar -xzf - -C <pasta>
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { createRequire } from 'node:module';
const require = createRequire('/opt/keepalive/package.json');
const { chromium, devices } = require('playwright');
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const db = await mysql.createConnection({ host: '127.0.0.1', user: env.DATABASE_USER, password: env.DATABASE_PASS, database: env.DATABASE_NAME });
const [[u]] = await db.query("SELECT id, organization_id, role FROM users WHERE email='superadmin@pubmail.com'");
const [[chat]] = await db.query("SELECT id FROM whatsapp_chats WHERE organization_id=? AND kind='individual' AND last_message_at IS NOT NULL ORDER BY last_message_at DESC LIMIT 1", [u.organization_id]);
const [[grp]] = await db.query("SELECT id FROM whatsapp_chats WHERE organization_id=? AND kind='group' AND last_message_at IS NOT NULL ORDER BY last_message_at DESC LIMIT 1", [u.organization_id]);
await db.end();
const tok = jwt.sign({ sub: u.id, org: u.organization_id, role: u.role }, env.JWT_ACCESS_SECRET, { expiresIn: '1h' });
const me = await fetch('http://127.0.0.1:8000/auth/me', { headers: { Authorization: 'Bearer ' + tok } }).then((r) => r.json());
fs.mkdirSync('/tmp/shots', { recursive: true });
const browser = await chromium.launch();
const view = process.env.DESKTOP ? { viewport: { width: 1366, height: 768 } } : devices['iPhone 13'];
const ctx = await browser.newContext({ ...view, locale: 'pt-BR', colorScheme: process.env.DARK ? 'dark' : 'light' });
await ctx.addInitScript(([t, u2, dark]) => { try { localStorage.setItem('token', t); localStorage.setItem('refreshToken', t); localStorage.setItem('user', JSON.stringify(u2)); localStorage.setItem('theme-mode', dark ? 'dark' : 'light'); } catch {} }, [tok, me, Boolean(process.env.DARK)]);
const page = await ctx.newPage();
const routes = [
  ['settings', '/whatsapp/settings'], ['chat-list', '/whatsapp/chat'], ['chat-open', `/whatsapp/chat?chat=${chat?.id}`], ['chat-group', `/whatsapp/chat?chat=${grp?.id}`], ['chat-team', '/whatsapp/chat?team=1'],
  ['bot', '/whatsapp/bot'], ['status', '/whatsapp/status'], ['schedules', '/whatsapp/schedules'], ['contacts', '/whatsapp/contacts'], ['pipeline', '/whatsapp/pipeline'], ['tasks', '/whatsapp/tasks'],
  ['customers', '/whatsapp/customers'], ['products', '/whatsapp/products'], ['charges', '/whatsapp/charges'], ['metrics', '/whatsapp/metrics'], ['broadcasts', '/whatsapp/broadcasts'],
];
const only = (process.env.ONLY || '').split(',').filter(Boolean);
const report = [];
for (const [name, path] of routes) {
  if (only.length && !only.includes(name)) continue;
  try {
    await page.goto('https://reveleonline.com' + path, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sh: document.documentElement.scrollHeight, ih: window.innerHeight }));
    await page.screenshot({ path: `/tmp/shots/${name}.png`, fullPage: Boolean(process.env.FULL) });
    report.push({ name, ...m, hscroll: m.sw > m.cw });
  } catch (e) { report.push({ name, error: String(e.message || e).slice(0, 120) }); }
}
await browser.close();
console.log(JSON.stringify(report));
