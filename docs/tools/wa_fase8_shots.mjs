// Capturas das telas da Fase 8 (fila de envios, importação em segundo plano, auditoria, LGPD) numa ORG TEMPORÁRIA
// (apagada no fim) — roda NO SERVIDOR:
//   scp docs/tools/wa_fase8_shots.mjs pubmail-hostinger:/opt/pub-mail/back/wa_f8_shots.tmp.mjs
//   ssh pubmail-hostinger 'cd /opt/pub-mail/back && NODE_PATH=/opt/keepalive/node_modules node wa_f8_shots.tmp.mjs; rm -f wa_f8_shots.tmp.mjs'
// Saída: /tmp/shots-f8/*.png + relatório (rolagem lateral e erros de console).
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
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
const call = async (tok, m, p, b) => { const isForm = b instanceof FormData; const r = await fetch(API + p, { method: m, headers: { ...(isForm ? {} : { 'Content-Type': 'application/json' }), Authorization: 'Bearer ' + tok }, body: b ? (isForm ? b : JSON.stringify(b)) : undefined }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { s: r.status, j }; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = '/tmp/shots-f8'; fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const stamp = Date.now().toString(36);
const P = (n) => `55009999908${String(n).padStart(2, '0')}`;
let orgId;
const errors = []; const report = [];
try {
  const c = await call(saTok, 'POST', '/admin/clients', { name: 'Capturas Fase 8', email: `shots-f8-${stamp}@teste.local`, password: 'Senha!Teste123', org_name: `E2E Capturas Fase8 ${stamp}`, modules: ['whatsapp', 'settings'], price_cents: 0 });
  orgId = c.j.organization.id;
  const tok = sign(c.j.user.id, orgId, 'OWNER');
  const mk = async (label, phone, color) => { const s = await call(tok, 'POST', '/whatsapp/sessions', { label, color }); await q(`UPDATE whatsapp_sessions SET status='ready', engine='baileys', phone=?, push_name=?, paired_at=NOW(3), openwa_session_id=NULL WHERE id=?`, [phone, label, s.j.id]); return s.j.id; };
  const s1 = await mk('Vendas', '5500999990891', '#16a34a');
  const s2 = await mk('Suporte', '5500999990892', '#2563eb');
  await q(`UPDATE whatsapp_sessions SET outbox_paused_at=NOW(3), outbox_pause_reason='O WhatsApp restringiu este número' WHERE id=?`, [s2]);
  const plan = (await call(tok, 'POST', '/whatsapp/products', { name: 'Plano Fibra 300 MB', price_cents: 12990, billing: 'monthly', kind: 'plan' })).j;
  await call(tok, 'PUT', `/whatsapp/products/${plan.id}`, { price_cents: 13990 });
  const names = ['Maria Souza', 'João Pedro', 'Fernanda Rocha', 'Carlos Lima'];
  const custs = [];
  for (const [i, n] of names.entries()) { const r = await call(tok, 'POST', '/whatsapp/customers', { phone: P(30 + i), name: n, email: `${n.split(' ')[0].toLowerCase()}@exemplo.com` }); custs.push(r.j); }
  await call(tok, 'POST', `/whatsapp/customers/${custs[0].id}/subscriptions`, { product_id: plan.id, due_day: 10 });
  await call(tok, 'PUT', `/whatsapp/customers/${custs[0].id}`, { email: 'maria.souza@exemplo.com' });
  // fila: pendentes, enviadas e falhas nos 2 números
  const kinds = ['charge_charge', 'charge_reminder_due', 'charge_reminder_after', 'subscription_trial_ending', 'appt_reminder', 'order_confirmed'];
  for (let i = 0; i < 24; i++) {
    const sid = i % 3 === 0 ? s2 : s1; const st = i < 14 ? 'pending' : i < 20 ? 'sent' : 'failed';
    await q(`INSERT INTO whatsapp_outbox (id, organization_id, session_id, chat_id, kind, payload, run_at, status, attempts, last_error, sent_at, created_at) VALUES (?,?,?,?,?,?,NOW(3) + INTERVAL ? MINUTE,?,?,?,?,NOW(3) - INTERVAL ? MINUTE)`,
      [randomUUID(), orgId, sid, `${P(30 + (i % 4))}@c.us`, kinds[i % kinds.length], JSON.stringify({ messages: [{ kind: 'text', text: `Olá ${names[i % 4].split(' ')[0]}! Sua mensalidade de R$ 139,90 vence dia 10. Segue o PIX para pagamento.` }] }), i < 14 ? i : 0, st, st === 'failed' ? 3 : 0, st === 'failed' ? 'Número sem WhatsApp' : null, st === 'sent' ? new Date() : null, 60 - i]);
  }
  // importação (pequena, com erros) para o histórico
  const csv = ['phone;name;email;unit;product;price;due_day;balance', `${P(41)};Bruna Alves;bruna@exemplo.com;Centro;Plano Fibra 300 MB;139,90;10;`, `${P(42)};Diego Ramos;;Centro;;;;89,90`, '123;Telefone Ruim;;;;;;', `${P(44)};Elisa Prado;email-errado;;;;;`].join('\r\n');
  const fd = new FormData(); fd.append('file', new Blob(['﻿' + csv], { type: 'text/csv' }), 'clientes-setembro.csv');
  const imp = await call(tok, 'POST', '/whatsapp/imports', fd);
  for (let i = 0; i < 30; i++) { const g = await call(tok, 'GET', `/whatsapp/imports/${imp.j?.id}`); if (['done', 'failed'].includes(g.j?.status)) break; await sleep(1000); }
  await sleep(1000);
  await call(tok, 'POST', '/access/welcome-seen');
  const me = (await call(tok, 'GET', '/auth/me')).j;
  const browser = await chromium.launch();
  for (const mode of [{ name: '', view: { viewport: { width: 1440, height: 900 } }, dark: false }, { name: '-dark', view: { viewport: { width: 1440, height: 900 } }, dark: true }, { name: '-mobile', view: devices['iPhone 13'], dark: false }]) {
    const ctx = await browser.newContext({ ...mode.view, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', colorScheme: mode.dark ? 'dark' : 'light' });
    await ctx.addInitScript(([t, u2, dark]) => { try { localStorage.setItem('token', t); localStorage.setItem('refreshToken', t); localStorage.setItem('user', JSON.stringify(u2)); localStorage.setItem('theme-mode', dark ? 'dark' : 'light'); } catch {} }, [tok, me, mode.dark]);
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e.message || e).slice(0, 200)));
    const shot = async (n) => { await page.waitForTimeout(1600); const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })); await page.screenshot({ path: `${OUT}/${n}${mode.name}.png` }); report.push({ n: n + mode.name, hscroll: m.sw > m.cw }); };
    const go = (p) => page.goto('https://reveleonline.com' + p, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    // fila de envios
    await go('/whatsapp/settings'); await page.waitForTimeout(800);
    await page.getByText(/Fila de envios/).first().scrollIntoViewIfNeeded().catch((e) => errors.push('fila card: ' + e.message.slice(0, 80)));
    await shot('fila-card');
    await page.getByRole('button', { name: /Ver fila/ }).first().click({ timeout: 5000 }).catch((e) => errors.push('ver fila: ' + e.message.slice(0, 80)));
    await shot('fila-lista'); await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    // importação
    await go('/whatsapp/customers');
    await page.getByRole('button', { name: /Importar/ }).first().click({ timeout: 5000 }).catch((e) => errors.push('importar: ' + e.message.slice(0, 80)));
    await shot('importar'); await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    // cliente: histórico e LGPD
    await go('/whatsapp/customers');
    await page.getByText('Maria Souza').first().click({ timeout: 5000 }).catch((e) => errors.push('cliente: ' + e.message.slice(0, 80)));
    await page.waitForTimeout(800);
    await page.getByRole('tab', { name: /Histórico/ }).first().click({ timeout: 5000 }).catch((e) => errors.push('aba histórico: ' + e.message.slice(0, 80)));
    await shot('cliente-historico');
    await page.getByRole('tab', { name: /Mais/ }).first().click({ timeout: 5000 }).catch((e) => errors.push('aba mais: ' + e.message.slice(0, 80)));
    await page.getByText(/Privacidade|LGPD/).first().scrollIntoViewIfNeeded().catch(() => {});
    await shot('cliente-lgpd');
    await page.getByRole('button', { name: /Apagar dados/ }).first().click({ timeout: 5000 }).catch((e) => errors.push('apagar: ' + e.message.slice(0, 80)));
    await shot('cliente-apagar'); await page.keyboard.press('Escape'); await page.waitForTimeout(300); await page.keyboard.press('Escape');
    // auditoria
    await go('/settings/audit'); await shot('auditoria');
    await page.getByText(/Alterou|alterou/).first().click({ timeout: 5000 }).catch((e) => errors.push('auditoria linha: ' + e.message.slice(0, 80)));
    await shot('auditoria-diff');
    await ctx.close();
  }
  await browser.close();
} catch (e) { errors.push('SCRIPT ' + String(e?.stack || e).slice(0, 300)); }
finally {
  if (orgId) {
    await q(`UPDATE whatsapp_sessions SET status='none', openwa_session_id=NULL, paired_at=NULL WHERE organization_id=?`, [orgId]);
    await q(`DELETE FROM whatsapp_outbox WHERE organization_id=?`, [orgId]);
    await call(saTok, 'DELETE', `/admin/organizations/${orgId}`);
    const [left] = await q('SELECT (SELECT COUNT(*) FROM whatsapp_customers WHERE organization_id=?)+(SELECT COUNT(*) FROM org_audit_log WHERE organization_id=?) n', [orgId, orgId]);
    report.push({ cleanup: Number(left.n) === 0 ? 'org apagada' : `sobrou ${left.n}` });
  }
  await db.end();
  console.log(JSON.stringify({ report, errors: [...new Set(errors)].slice(0, 20) }, null, 1));
}
