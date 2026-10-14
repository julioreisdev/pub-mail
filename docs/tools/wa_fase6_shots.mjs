// Capturas das telas da Fase 6 (Agenda, Recursos, serviço no produto, Métricas → Agenda) numa ORG TEMPORÁRIA
// (apagada no fim) — roda NO SERVIDOR:
//   scp docs/tools/wa_fase6_shots.mjs pubmail-hostinger:/opt/pub-mail/back/wa_f6_shots.tmp.mjs
//   ssh pubmail-hostinger 'cd /opt/pub-mail/back && NODE_PATH=/opt/keepalive/node_modules node wa_f6_shots.tmp.mjs; rm -f wa_f6_shots.tmp.mjs'
// Saída: /tmp/shots-f6/*.png + relatório (rolagem lateral e erros de console).
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
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
const call = async (tok, m, p, b) => { const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { s: r.status, j }; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const brt = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const addDays = (s, n) => new Date(new Date(`${s}T12:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
const at = (day, hm) => new Date(`${day}T${hm}:00-03:00`).toISOString();
const week = (ranges) => Object.fromEntries(['0', '1', '2', '3', '4', '5', '6'].map((k) => [k, ranges]));
const OUT = '/tmp/shots-f6'; fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const stamp = Date.now().toString(36);
const today = brt(), D1 = addDays(today, 1), D2 = addDays(today, 2);
let orgId;
const errors = []; const report = []; const setup = [];
try {
  const c = await call(saTok, 'POST', '/admin/clients', { name: 'Capturas Agenda', email: `shots-f6-${stamp}@teste.local`, password: 'Senha!Teste123', org_name: `E2E Capturas Fase6 ${stamp}`, modules: ['whatsapp', 'settings'], price_cents: 0 });
  orgId = c.j.organization.id;
  const tok = sign(c.j.user.id, orgId, 'OWNER');
  const sess = await call(tok, 'POST', '/whatsapp/sessions', { label: 'Recepção' });
  await q(`UPDATE whatsapp_sessions SET status='ready', openwa_session_id=?, engine='baileys', paired_at=NOW(3) WHERE id=?`, [`shots-f6-${stamp}`, sess.j.id]);
  const svc = async (name, price, extra) => (await call(tok, 'POST', '/whatsapp/products', { name, price_cents: price, billing: 'once', kind: 'service', duration_minutes: 60, buffer_after_minutes: 10, capacity: 1, booking: { payment: 'on_site', min_notice_hours: 1, max_days_ahead: 30, cancel_free_hours: 24, cancel_policy: 'credit', confirm: 'ask_d1' }, ...extra })).j;
  const CORTE = await svc('Corte de cabelo', 6000, { duration_minutes: 45 });
  const BARBA = await svc('Barba completa', 4000, { duration_minutes: 30, buffer_after_minutes: 5 });
  const AULA = await svc('Aula de pilates (turma)', 8000, { capacity: 6, buffer_after_minutes: 0 });
  const ANA = (await call(tok, 'POST', '/whatsapp/scheduling/resources', { name: 'Ana', kind: 'person', color: '#7C3AED', services: [CORTE.id, BARBA.id], availability: { weekly: week([{ start: '08:00', end: '12:00' }, { start: '13:00', end: '21:00' }]), slot_minutes: 15 } })).j;
  const BRUNO = (await call(tok, 'POST', '/whatsapp/scheduling/resources', { name: 'Bruno', kind: 'person', color: '#0EA5E9', services: [CORTE.id, BARBA.id], availability: { weekly: week([{ start: '09:00', end: '21:00' }]), slot_minutes: 15 } })).j;
  const SALA = (await call(tok, 'POST', '/whatsapp/scheduling/resources', { name: 'Sala 1', kind: 'room', color: '#16A34A', services: [AULA.id], availability: { weekly: week([{ start: '07:00', end: '21:00' }]), slot_minutes: 60 } })).j;
  await call(tok, 'POST', `/whatsapp/scheduling/resources/${ANA.id}/blocks`, { starts_at: at(D1, '12:00'), ends_at: at(D1, '13:30'), reason: 'Almoço estendido' });
  const names = ['Marina Souza', 'Carlos Lima', 'Fernanda Rocha', 'João Pedro', 'Patrícia Alves', 'Rafael Costa', 'Beatriz Nunes', 'Lucas Martins'];
  const cust = [];
  for (let i = 0; i < names.length; i++) cust.push((await call(tok, 'POST', '/whatsapp/customers', { name: names[i], phone: `55009999903${String(i).padStart(2, '0')}` })).j);
  const book = async (p, r, day, hm, ci) => { const x = await call(tok, 'POST', '/whatsapp/scheduling/appointments', { product_id: p.id, resource_id: r.id, starts_at: at(day, hm), customer_id: cust[ci].id, session_id: sess.j.id, ignore_notice: true, notify: false }); setup.push(`${day} ${hm} ${p.name}: ${x.s}${x.s >= 300 ? ' ' + JSON.stringify(x.j?.message) : ''}`); return x.j?.appointment || x.j; };
  // hoje (a partir de agora), amanhã e depois
  const nowH = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(new Date()));
  const hh = (h) => `${String(Math.min(20, h)).padStart(2, '0')}:00`;
  await book(CORTE, ANA, today, hh(nowH + 1), 0);
  await book(BARBA, BRUNO, today, hh(nowH + 1), 1);
  await book(AULA, SALA, today, hh(nowH + 2), 2);
  await book(AULA, SALA, today, hh(nowH + 2), 3);
  for (const [r, hm, ci, p] of [[ANA, '09:00', 0, CORTE], [ANA, '10:00', 1, BARBA], [ANA, '14:00', 2, CORTE], [ANA, '16:30', 3, CORTE], [BRUNO, '09:30', 4, CORTE], [BRUNO, '11:00', 5, BARBA], [BRUNO, '15:00', 6, CORTE], [BRUNO, '18:00', 7, BARBA]]) await book(p, r, D1, hm, ci);
  for (let i = 0; i < 5; i++) await book(AULA, SALA, D1, '07:00', i);
  for (const [r, hm, ci, p] of [[ANA, '10:00', 4, CORTE], [BRUNO, '13:00', 5, CORTE], [SALA, '19:00', 6, AULA]]) await book(p, r, D2, hm, ci);
  const a1 = await book(CORTE, BRUNO, D2, '17:00', 7);
  if (a1?.id) await call(tok, 'POST', `/whatsapp/scheduling/appointments/${a1.id}/confirm`, {});
  await call(tok, 'POST', '/whatsapp/scheduling/waitlist', { product_id: CORTE.id, resource_id: ANA.id, date_from: D1, date_to: D2, period: 'afternoon', customer_id: cust[1].id, session_id: sess.j.id });
  await call(tok, 'POST', '/whatsapp/scheduling/waitlist', { product_id: AULA.id, date_from: D1, date_to: addDays(today, 7), period: 'any', customer_id: cust[5].id, session_id: sess.j.id });
  await call(tok, 'POST', '/access/welcome-seen');
  const me = (await call(tok, 'GET', '/auth/me')).j;
  const browser = await chromium.launch();
  for (const mode of [{ name: '', view: { viewport: { width: 1440, height: 900 } }, dark: false }, { name: '-mobile-dark', view: devices['iPhone 13'], dark: true }]) {
    const ctx = await browser.newContext({ ...mode.view, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', colorScheme: mode.dark ? 'dark' : 'light' });
    await ctx.addInitScript(([t, u2, dark]) => { try { localStorage.setItem('token', t); localStorage.setItem('refreshToken', t); localStorage.setItem('user', JSON.stringify(u2)); localStorage.setItem('theme-mode', dark ? 'dark' : 'light'); } catch {} }, [tok, me, mode.dark]);
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e.message || e).slice(0, 200)));
    const shot = async (n) => { await page.waitForTimeout(1500); const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })); await page.screenshot({ path: `${OUT}/${n}${mode.name}.png` }); report.push({ n: n + mode.name, hscroll: m.sw > m.cw }); };
    const go = (p) => page.goto('https://reveleonline.com' + p, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await go('/whatsapp/agenda?view=today'); await shot('agenda-hoje');
    await go(`/whatsapp/agenda?view=day&date=${D1}`); await shot('agenda-dia');
    await go(`/whatsapp/agenda?view=week&date=${D1}`); await shot('agenda-semana');
    await go(`/whatsapp/agenda?view=list&date=${D1}`); await shot('agenda-lista');
    await go('/whatsapp/agenda?view=waitlist'); await shot('agenda-espera');
    await go('/whatsapp/agenda?view=settings'); await shot('agenda-config');
    await go(`/whatsapp/agenda?view=day&date=${D1}`);
    await page.getByText(/5 pessoas/).first().click({ timeout: 5000 }).catch((e) => errors.push('turma: ' + e.message.slice(0, 80)));
    await shot('agenda-turma');
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    await page.getByText('Marina Souza').first().click({ timeout: 5000 }).catch((e) => errors.push('abrir agendamento: ' + e.message.slice(0, 80)));
    await shot('agenda-detalhe');
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    await page.getByRole('button', { name: /Novo agendamento|Agendar/ }).first().click({ timeout: 5000 }).catch((e) => errors.push('novo: ' + e.message.slice(0, 80)));
    await shot('agenda-novo');
    await page.keyboard.press('Escape');
    await go('/whatsapp/resources'); await shot('recursos');
    await go('/whatsapp/products'); await shot('produtos');
    await go('/whatsapp/metrics');
    await page.locator('button[role=tab]', { hasText: 'Agenda' }).first().click().catch((e) => errors.push('aba agenda: ' + e.message.slice(0, 80)));
    await shot('metricas-agenda');
    await ctx.close();
  }
  await browser.close();
} catch (e) { errors.push('SCRIPT ' + String(e?.stack || e).slice(0, 300)); }
finally {
  if (orgId) {
    await q(`DELETE FROM whatsapp_outbox WHERE organization_id=?`, [orgId]);
    await call(saTok, 'DELETE', `/admin/organizations/${orgId}`);
    const [left] = await q('SELECT COUNT(*) n FROM whatsapp_appointments WHERE organization_id=?', [orgId]);
    report.push({ cleanup: left.n === 0 ? 'org apagada' : `sobrou ${left.n}` });
  }
  await db.end();
  console.log(JSON.stringify({ setup: setup.filter((x) => !/: 20[01]$/.test(x)), report, errors: [...new Set(errors)].slice(0, 20) }, null, 1));
}
