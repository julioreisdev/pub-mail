// Capturas: modal de boas-vindas, quadro de Tarefas (Trello), detalhe do cartão, arrasto real e título da aba.
// ORG TEMPORÁRIA (apagada no fim). Roda NO SERVIDOR:
//   scp docs/tools/wa_tasks_board_shots.mjs pubmail-hostinger:/opt/pub-mail/back/wa_board_shots.tmp.mjs
//   ssh pubmail-hostinger 'cd /opt/pub-mail/back && NODE_PATH=/opt/keepalive/node_modules node wa_board_shots.tmp.mjs; rm -f wa_board_shots.tmp.mjs'
// Saída: /tmp/shots-board/*.png + relatório (títulos, arrasto, rolagem lateral, erros de console).
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
const sign = (sub, org, role) => jwt.sign({ sub, org, role }, env.JWT_ACCESS_SECRET, { expiresIn: '30m' });
const call = async (tok, m, p, b) => { const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { s: r.status, j }; };
const OUT = '/tmp/shots-board'; fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const [sa] = await q("SELECT id, organization_id FROM users WHERE email='superadmin@pubmail.com'");
const saTok = sign(sa.id, sa.organization_id, 'SUPER_ADMIN');
const stamp = Date.now().toString(36);
const errors = []; const report = {};
let orgId;
const iso = (h) => new Date(Date.now() + h * 3600_000).toISOString();
try {
  const c = await call(saTok, 'POST', '/admin/clients', { name: 'Mariana Costa', email: `board-shots-${stamp}@teste.local`, password: 'Senha!Teste123', org_name: `E2E Capturas Quadro ${stamp}`, modules: ['whatsapp', 'email', 'webchat', 'telegram', 'wordpress', 'settings'], price_cents: 0 });
  orgId = c.j.organization.id;
  const uid = c.j.user.id;
  const tok = sign(uid, orgId, 'OWNER');
  const me = (await call(tok, 'GET', '/auth/me')).j;

  // conteúdo do quadro
  const B = (await call(tok, 'GET', '/whatsapp/tasks/board')).j;
  const L = Object.fromEntries(B.lists.map((l) => [l.name, l.id]));
  const lab = Object.fromEntries(B.labels.map((l) => [l.name, l.id]));
  const mk = async (title, list, extra = {}) => (await call(tok, 'POST', '/whatsapp/tasks', { title, list_id: L[list] })).j && (await call(tok, 'GET', '/whatsapp/tasks/board')).j.lists.flatMap((l) => l.tasks).find((t) => t.title === title);
  const upd = (t, body) => call(tok, 'PUT', `/whatsapp/tasks/${t.id}`, body);
  let t;
  t = await mk('Ligar para a Clínica Bem Estar sobre a renovação', 'A fazer'); await upd(t, { label_ids: [lab['Venda'], lab['Importante']], due_at: iso(3), assigned_user_id: uid, description: 'Oferecer o plano anual com 2 meses grátis.' });
  t = await mk('Enviar 2ª via para o Carlos (Fibra 300)', 'A fazer'); await upd(t, { label_ids: [lab['Financeiro']], due_at: iso(-20) });
  t = await mk('Revisar respostas rápidas do suporte', 'A fazer'); await upd(t, { checklist: [{ text: 'Saudação' }, { text: 'Horário de atendimento', done: true }, { text: '2ª via' }] });
  t = await mk('Campanha de Black Friday', 'A fazer'); await upd(t, { cover: '#9f8fef', label_ids: [lab['Venda']], due_at: iso(24 * 9) });
  t = await mk('Orçamento de instalação — Ana Souza', 'Fazendo'); await upd(t, { label_ids: [lab['Aguardando cliente']], due_at: iso(1), assigned_user_id: uid, checklist: [{ text: 'Medir a sala', done: true }, { text: 'Montar proposta', done: true }, { text: 'Enviar no WhatsApp' }] });
  t = await mk('Configurar o bot de agendamento', 'Fazendo'); await upd(t, { label_ids: [lab['Suporte'], lab['Urgente']], cover: '#579dff' });
  t = await mk('Treinar a equipe no novo funil', 'Concluído'); await upd(t, { checklist: [{ text: 'Gravar vídeo', done: true }, { text: 'Reunião', done: true }] });
  await mk('Cadastrar produtos do catálogo', 'Concluído');

  const browser = await chromium.launch();
  const MODES = [{ name: 'desk', view: { viewport: { width: 1440, height: 900 } }, dark: false }, { name: 'desk-dark', view: { viewport: { width: 1440, height: 900 } }, dark: true }, { name: 'mobile', view: devices['iPhone 13'], dark: false }];
  const open = async (mode) => {
    const ctx = await browser.newContext({ ...mode.view, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', colorScheme: mode.dark ? 'dark' : 'light' });
    await ctx.addInitScript(([tk, u2, dark]) => { try { localStorage.setItem('token', tk); localStorage.setItem('refreshToken', tk); localStorage.setItem('user', JSON.stringify(u2)); localStorage.setItem('theme-mode', dark ? 'dark' : 'light'); } catch {} }, [tok, me, mode.dark]);
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${mode.name} ${m.text().slice(0, 180)}`); });
    page.on('pageerror', (e) => errors.push(`${mode.name} PAGEERROR ${String(e.message).slice(0, 180)}`));
    const shot = async (n) => { await page.waitForTimeout(1200); const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })); await page.screenshot({ path: `${OUT}/${n}-${mode.name}.png` }); report[`${n}-${mode.name}`] = { hscroll: m.sw > m.cw }; };
    const go = (p) => page.goto('https://reveleonline.com' + p, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    return { ctx, page, shot, go };
  };
  // 1ª passada: boas-vindas (conta nova, ainda não viu)
  for (const mode of MODES) {
    const { ctx, page, shot, go } = await open(mode);
    await go('/dashboard'); await page.waitForTimeout(1500);
    await shot('welcome');
    await ctx.close();
  }
  await call(tok, 'POST', '/access/welcome-seen');
  // 2ª passada: quadro
  for (const mode of MODES) {
    const { ctx, page, shot, go } = await open(mode);

    await go('/whatsapp/tasks'); await page.waitForTimeout(1200);
    await shot('board');
    if (mode.name === 'desk') {
      // títulos da aba
      report.titles = {};
      for (const p of ['/whatsapp/tasks', '/whatsapp/chat', '/whatsapp/settings', '/telegram/settings', '/settings/integrations', '/email/email-marketing', '/dashboard', '/webchat/webchats/abc/builder']) {
        await go(p); await page.waitForTimeout(400);
        report.titles[p] = await page.title();
      }
      await go('/whatsapp/tasks'); await page.waitForTimeout(1200);
      // arrasto real: "Revisar respostas rápidas" → coluna Fazendo (topo)
      const card = page.getByText('Revisar respostas rápidas do suporte').first();
      const target = page.getByText('Orçamento de instalação — Ana Souza').first();
      const cb = await card.boundingBox(); const tb = await target.boundingBox();
      if (cb && tb) {
        await card.dragTo(target, { targetPosition: { x: 20, y: 4 } }).catch((e) => errors.push('drag: ' + e.message.slice(0, 120)));
        await page.waitForTimeout(1500);
        const b2 = (await call(tok, 'GET', '/whatsapp/tasks/board')).j;
        const fazendo = b2.lists.find((l) => l.name === 'Fazendo').tasks.map((x) => x.title);
        report.drag = { fazendo, ok: fazendo[0] === 'Revisar respostas rápidas do suporte' };
      }
      await shot('board-after-drag');
      // menu da coluna
      await page.locator('button:has(svg.tabler-icon-dots)').first().click().catch((e) => errors.push('menu coluna: ' + e.message.slice(0, 80)));
      await shot('list-menu'); await page.keyboard.press('Escape');
      // compositor
      await page.getByRole('button', { name: 'Adicionar um cartão' }).first().click().catch(() => {});
      await page.keyboard.type('Novo cartão pelo compositor');
      await shot('composer'); await page.keyboard.press('Enter'); await page.waitForTimeout(800); await page.keyboard.press('Escape');
    }
    // detalhe do cartão
    await page.getByText('Orçamento de instalação — Ana Souza').first().click({ timeout: 5000 }).catch((e) => errors.push('abrir cartão: ' + e.message.slice(0, 80)));
    await shot('card-dialog');
    await page.keyboard.press('Escape');
    await ctx.close();
  }
  await browser.close();
} catch (e) { errors.push('SCRIPT ' + String(e?.stack || e).slice(0, 300)); }
finally {
  if (orgId) {
    await call(saTok, 'DELETE', `/admin/organizations/${orgId}`);
    const [left] = await q('SELECT (SELECT COUNT(*) FROM whatsapp_tasks WHERE organization_id=?)+(SELECT COUNT(*) FROM whatsapp_task_lists WHERE organization_id=?) n', [orgId, orgId]);
    report.cleanup = Number(left.n) === 0 ? 'org apagada' : `sobrou ${left.n}`;
  }
  await db.end();
  console.log(JSON.stringify({ report, errors: [...new Set(errors)].slice(0, 20) }, null, 1));
}
