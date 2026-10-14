// Capturas das telas da Fase 6B (Chamados: fila, detalhe, novo, configurações, aba no chat) numa ORG TEMPORÁRIA
// (apagada no fim) — roda NO SERVIDOR:
//   scp docs/tools/wa_fase6b_shots.mjs pubmail-hostinger:/opt/pub-mail/back/wa_f6b_shots.tmp.mjs
//   ssh pubmail-hostinger 'cd /opt/pub-mail/back && NODE_PATH=/opt/keepalive/node_modules node wa_f6b_shots.tmp.mjs; rm -f wa_f6b_shots.tmp.mjs'
// Saída: /tmp/shots-f6b/*.png + relatório (rolagem lateral e erros de console).
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
const OUT = '/tmp/shots-f6b'; fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const stamp = Date.now().toString(36);
const hook = async (rowId, secret, event, data) => {
  const b = JSON.stringify({ event, data, idempotencyKey: randomUUID() });
  const sig = 'sha256=' + createHmac('sha256', secret).update(b).digest('base64');
  return (await fetch(`${API}/webhooks/whatsapp/${rowId}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-OpenWA-Signature': sig, 'X-OpenWA-Idempotency-Key': randomUUID() }, body: b })).status;
};
let orgId;
const errors = []; const report = [];
try {
  const c = await call(saTok, 'POST', '/admin/clients', { name: 'Capturas Chamados', email: `shots-f6b-${stamp}@teste.local`, password: 'Senha!Teste123', org_name: `E2E Capturas Fase6B ${stamp}`, modules: ['whatsapp', 'settings'], price_cents: 0 });
  orgId = c.j.organization.id;
  const tok = sign(c.j.user.id, orgId, 'OWNER');
  const ana = (await call(saTok, 'POST', '/admin/users', { organization_id: orgId, name: 'Ana Souza', email: `shots-f6b-ana-${stamp}@teste.local`, password: 'Senha!Teste123', role: 'MEMBER', modules: ['whatsapp'] })).j;
  const sess = await call(tok, 'POST', '/whatsapp/sessions', { label: 'Ouvidoria' });
  const secret = randomBytes(24).toString('hex');
  await q(`UPDATE whatsapp_sessions SET status='ready', engine='baileys', phone='5500999990501', push_name='Prefeitura', paired_at=NOW(3), webhook_secret=?, openwa_session_id=NULL WHERE id=?`, [secret, sess.j.id]);
  await call(tok, 'PUT', '/whatsapp/tickets/settings', { prefix: 'PM', categories: [
    { label: 'Iluminação pública', sla_hours: 72, default_priority: 'high', assignee_id: ana.id },
    { label: 'Buraco na rua', default_priority: 'normal' },
    { label: 'Coleta de lixo', default_priority: 'normal' },
    { label: 'Dúvida', default_priority: 'low' },
  ] });
  const people = [['Maria Moradora', 'Poste apagado na Rua 3, em frente ao número 120.\nJá faz uma semana que está assim.', 'iluminacao-publica'], ['João Pedro', 'Buraco grande na Avenida Brasil perto da padaria.', 'buraco-na-rua'], ['Fernanda Rocha', 'O caminhão do lixo não passou ontem na Rua das Flores.', 'coleta-de-lixo'], ['Carlos Lima', 'Qual o horário de atendimento da secretaria de obras?', 'duvida'], ['Patrícia Alves', 'Outro poste apagado na praça central.', 'iluminacao-publica']];
  const ids = [];
  for (let i = 0; i < people.length; i++) {
    const phone = `55009999905${String(10 + i)}`;
    await hook(sess.j.id, secret, 'message.received', { id: `SH-${i}-${stamp}`, from: `${phone}@c.us`, to: '5500999990501@c.us', chatId: `${phone}@c.us`, type: 'text', body: 'Oi, bom dia', timestamp: Math.floor(Date.now() / 1000), contact: { pushName: people[i][0] } });
    await sleep(700);
    const [chat] = await q('SELECT id FROM whatsapp_chats WHERE organization_id=? AND chat_id=?', [orgId, `${phone}@c.us`]);
    const t = await call(tok, 'POST', '/whatsapp/tickets', { category: people[i][2], description: people[i][1], chat_id: chat?.id, notify: false });
    ids.push({ id: t.j.id, chat: chat?.id });
  }
  await call(tok, 'POST', `/whatsapp/tickets/${ids[0].id}/comments`, { body: 'Equipe da elétrica agendada para amanhã de manhã.', visibility: 'internal' });
  await call(tok, 'POST', `/whatsapp/tickets/${ids[0].id}/comments`, { body: 'Pode confirmar o número exato da casa?', visibility: 'public', status: 'pending', notify: false });
  await hook(sess.j.id, secret, 'message.received', { id: `SH-r-${stamp}`, from: '5500999990510@c.us', to: '5500999990501@c.us', chatId: '5500999990510@c.us', type: 'text', body: 'É o 120, casa azul de muro branco.', timestamp: Math.floor(Date.now() / 1000) });
  await call(tok, 'PATCH', `/whatsapp/tickets/${ids[1].id}`, { priority: 'urgent' });
  await call(tok, 'PATCH', `/whatsapp/tickets/${ids[3].id}`, { status: 'resolved', notify: false });
  await q(`UPDATE whatsapp_tickets SET sla_due_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 2 HOUR) WHERE id=?`, [ids[2].id]);
  await q(`UPDATE whatsapp_tickets SET sla_due_at = DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 40 MINUTE) WHERE id=?`, [ids[4].id]);
  await sleep(1500);
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
    await go('/whatsapp/tickets'); await shot('fila');
    await go(`/whatsapp/tickets?ticket=${ids[0].id}`); await shot('detalhe');
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    await go('/whatsapp/tickets');
    await page.getByRole('button', { name: /Novo chamado/ }).first().click({ timeout: 5000 }).catch((e) => errors.push('novo: ' + e.message.slice(0, 80)));
    await shot('novo');
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    await page.getByRole('tab', { name: /Configura/ }).first().click({ timeout: 5000 }).catch((e) => errors.push('config: ' + e.message.slice(0, 80)));
    await shot('config');
    await go(`/whatsapp/chat?chat=${ids[0].chat}`);
    await page.waitForTimeout(1500);
    await shot('chat');
    await ctx.close();
  }
  await browser.close();
} catch (e) { errors.push('SCRIPT ' + String(e?.stack || e).slice(0, 300)); }
finally {
  if (orgId) {
    await q(`UPDATE whatsapp_sessions SET status='none', openwa_session_id=NULL, paired_at=NULL WHERE organization_id=?`, [orgId]);
    await q(`DELETE FROM whatsapp_outbox WHERE organization_id=?`, [orgId]);
    await call(saTok, 'DELETE', `/admin/organizations/${orgId}`);
    const [left] = await q('SELECT COUNT(*) n FROM whatsapp_tickets WHERE organization_id=?', [orgId]);
    report.push({ cleanup: left.n === 0 ? 'org apagada' : `sobrou ${left.n}` });
  }
  await db.end();
  console.log(JSON.stringify({ report, errors: [...new Set(errors)].slice(0, 20) }, null, 1));
}
