// E2E da Fase 8 (assinaturas WhatsApp, contrato §12): fila de envios (painel/pausa/ritmo/retry), importação em segundo
// plano, auditoria e LGPD — roda NO SERVIDOR numa ORG TEMPORÁRIA (apagada no fim, limpeza só pelo id dela):
//   scp docs/tools/wa_fase8_e2e.mjs pubmail-hostinger:/opt/pub-mail/back/wa_f8_e2e.tmp.mjs
//   ssh pubmail-hostinger 'cd /opt/pub-mail/back && NODE_PATH=/opt/keepalive/node_modules node wa_f8_e2e.tmp.mjs; rm -f wa_f8_e2e.tmp.mjs'
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { createHmac, randomUUID } from 'node:crypto';

const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const API = 'http://127.0.0.1:8000';
const db = await mysql.createConnection({ host: '127.0.0.1', user: env.DATABASE_USER, password: env.DATABASE_PASS, database: env.DATABASE_NAME });
const q = async (s, p) => (await db.query(s, p))[0];
const one = async (s, p) => (await q(s, p))[0];
const [sa] = await q("SELECT id, organization_id FROM users WHERE email='superadmin@pubmail.com'");
const sign = (sub, org, role) => jwt.sign({ sub, org, role }, env.JWT_ACCESS_SECRET, { expiresIn: '30m' });
const saTok = sign(sa.id, sa.organization_id, 'SUPER_ADMIN');
const call = async (tok, m, p, b, raw = false) => {
  const isForm = b instanceof FormData;
  const r = await fetch(API + p, { method: m, headers: { ...(isForm ? {} : { 'Content-Type': 'application/json' }), Authorization: 'Bearer ' + tok }, body: b ? (isForm ? b : JSON.stringify(b)) : undefined });
  if (raw) return { s: r.status, buf: Buffer.from(await r.arrayBuffer()), h: r.headers };
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { s: r.status, j };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; console.log('ok  ', name); } else { fail++; console.log('FAIL', name, extra !== undefined ? `→ ${JSON.stringify(extra).slice(0, 500)}` : ''); } };
const okS = (r) => r.s === 200 || r.s === 201;
const brt = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const addDays = (s, n) => new Date(new Date(`${s}T12:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
const today = brt();
const stamp = Date.now().toString(36);
const P = (n) => `55009999908${String(n).padStart(2, '0')}`;
let orgId = null;

try {
  // ---------------------------------------------------------------- setup
  const c = await call(saTok, 'POST', '/admin/clients', { name: 'E2E Fase 8', email: `e2e-f8-${stamp}@teste.local`, password: 'Senha!Teste123', org_name: `E2E Fase8 ${stamp}`, modules: ['whatsapp', 'settings'], price_cents: 0 });
  orgId = c.j?.organization?.id;
  ok('org temporária', c.s === 201 && orgId, c.j);
  const ownerId = c.j.user.id;
  const tok = sign(ownerId, orgId, 'OWNER');
  const m = await call(saTok, 'POST', '/admin/users', { organization_id: orgId, name: 'Atendente F8', email: `e2e-f8-m-${stamp}@teste.local`, password: 'Senha!Teste123', role: 'MEMBER', modules: ['whatsapp', 'whatsapp:crm'] });
  const memberTok = sign(m.j?.id || m.j?.user?.id, orgId, 'MEMBER');
  const sess = await call(tok, 'POST', '/whatsapp/sessions', { label: 'F8' });
  const sid = sess.j?.id;
  await q(`UPDATE whatsapp_sessions SET status='ready', engine='baileys', phone='5500999990899', push_name='F8', paired_at=NOW(3), openwa_session_id=NULL, webhook_secret=? WHERE id=?`, [`sec-${stamp}`, sid]);
  ok('número fictício + membro', sid && (m.s === 201 || m.s === 200), { sess: sess.j, m: m.j });

  // ---------------------------------------------------------------- 1. auditoria (criar/alterar produto)
  const prod = await call(tok, 'POST', '/whatsapp/products', { name: 'Plano E2E F8', price_cents: 9990, billing: 'monthly', kind: 'plan' });
  const productId = prod.j?.id;
  const up = await call(tok, 'PUT', `/whatsapp/products/${productId}`, { price_cents: 10990 });
  ok('produto criado e alterado', okS(prod) && okS(up), { prod: prod.j, up: up.j });
  await sleep(800); // a auditoria grava depois da resposta
  let a = await call(tok, 'GET', `/whatsapp/audit?entity=products&entity_id=${productId}`);
  const items = a.j?.items || [];
  ok('auditoria: criação do produto registrada', items.some((x) => /create/.test(x.action)), items.map((x) => x.action));
  const upd = items.find((x) => /update/.test(x.action));
  const ch = JSON.stringify(upd?.changes || {});
  ok('auditoria: alteração com antes × depois do preço', upd && ch.includes('9990') && ch.includes('10990'), upd);
  ok('auditoria: autor = usuário dono', upd && upd.user_id === ownerId && upd.user_name, upd);
  const am = await call(memberTok, 'GET', '/whatsapp/audit');
  ok('auditoria: MEMBER não lê (403)', am.s === 403, am);
  const meta = await call(tok, 'GET', '/whatsapp/audit/meta');
  ok('auditoria: meta (usuários/entidades)', okS(meta), meta.j);

  // ---------------------------------------------------------------- 2. fila de envios
  const cust = await call(tok, 'POST', '/whatsapp/customers', { phone: P(1), name: 'Cliente Fila F8' });
  const custId = cust.j?.id;
  const jid = `${P(1)}@c.us`;
  const ob = [];
  for (let i = 0; i < 3; i++) { const id = randomUUID(); ob.push(id); await q(`INSERT INTO whatsapp_outbox (id, organization_id, session_id, chat_id, kind, payload, run_at, status) VALUES (?,?,?,?,?,?,NOW(3),'pending')`, [id, orgId, sid, jid, i === 2 ? 'subscription_trial_ending' : 'charge_reminder_due', JSON.stringify({ messages: [{ kind: 'text', text: `Mensagem de teste ${i} da fila` }] })]); }
  let sm = await call(tok, 'GET', '/whatsapp/outbox/summary');
  const bs = (sm.j?.by_session || []).find((x) => x.session_id === sid);
  ok('fila: resumo com o número e 3 pendentes', okS(sm) && sm.j?.totals?.pending >= 3 && bs && bs.pending >= 3, sm.j);
  let ls = await call(tok, 'GET', `/whatsapp/outbox?status=pending&session_id=${sid}`);
  const it0 = (ls.j?.items || []).find((x) => x.id === ob[0]);
  ok('fila: lista com destino, prévia e rótulo', it0 && it0.preview?.includes('Mensagem de teste') && it0.kind_label && it0.destination, it0);
  ls = await call(tok, 'GET', `/whatsapp/outbox?kind=subscription&session_id=${sid}`);
  ok('fila: filtro por tipo (grupo assinatura)', (ls.j?.items || []).length === 1 && ls.j.items[0].id === ob[2], (ls.j?.items || []).map((x) => x.kind));
  let r = await call(tok, 'POST', `/whatsapp/outbox/sessions/${sid}/pause`, { reason: 'teste E2E' });
  let srow = await one('SELECT outbox_paused_at, outbox_pause_reason FROM whatsapp_sessions WHERE id=?', [sid]);
  ok('fila: pausar número', okS(r) && srow.outbox_paused_at && srow.outbox_pause_reason === 'teste E2E', r.j);
  await sleep(7000);
  const stillP = await one(`SELECT COUNT(*) n, MAX(attempts) a FROM whatsapp_outbox WHERE id IN (?) AND status='pending'`, [ob]);
  ok('fila: número pausado não é processado (3 pendentes, 0 tentativas)', Number(stillP.n) === 3 && Number(stillP.a) === 0, stillP);
  r = await call(memberTok, 'POST', `/whatsapp/outbox/sessions/${sid}/resume`);
  ok('fila: MEMBER não retoma (403)', r.s === 403, r);
  r = await call(tok, 'PUT', `/whatsapp/outbox/sessions/${sid}/rate`, { per_minute: 7 });
  sm = await call(tok, 'GET', '/whatsapp/outbox/summary');
  ok('fila: ritmo do número = 7/min', okS(r) && (sm.j?.by_session || []).find((x) => x.session_id === sid)?.effective_per_minute === 7, sm.j?.by_session);
  r = await call(tok, 'PUT', '/whatsapp/outbox/rate', { per_minute: 25 });
  sm = await call(tok, 'GET', '/whatsapp/outbox/summary');
  ok('fila: ritmo da org = 25/min (sem apagar outras configurações)', okS(r) && sm.j?.org_per_minute === 25, sm.j?.org_per_minute);
  r = await call(tok, 'POST', `/whatsapp/outbox/${ob[0]}/cancel`);
  let st0 = await one('SELECT status FROM whatsapp_outbox WHERE id=?', [ob[0]]);
  ok('fila: cancelar uma linha', okS(r) && st0.status === 'canceled', { r: r.j, st0 });
  r = await call(tok, 'POST', `/whatsapp/outbox/${ob[0]}/retry`);
  st0 = await one('SELECT status, attempts FROM whatsapp_outbox WHERE id=?', [ob[0]]);
  ok('fila: tentar de novo volta para pendente', okS(r) && st0.status === 'pending' && Number(st0.attempts) === 0, { r: r.j, st0 });
  r = await call(tok, 'POST', '/whatsapp/outbox/cancel-pending', { session_id: sid });
  const pendLeft = await one(`SELECT COUNT(*) n FROM whatsapp_outbox WHERE organization_id=? AND status='pending'`, [orgId]);
  ok('fila: cancelar pendentes do número (em massa)', okS(r) && Number(pendLeft.n) === 0, { r: r.j, pendLeft });
  r = await call(tok, 'POST', `/whatsapp/outbox/sessions/${sid}/resume`);
  srow = await one('SELECT outbox_paused_at FROM whatsapp_sessions WHERE id=?', [sid]);
  ok('fila: retomar número', okS(r) && !srow.outbox_paused_at, r.j);
  // pausa automática: evento de restrição do WhatsApp (webhook assinado como o OpenWA)
  await q(`UPDATE whatsapp_sessions SET openwa_session_id=? WHERE id=?`, [`e2e-f8-${stamp}`, sid]);
  const body = JSON.stringify({ event: 'session.restriction', data: { sessionId: `e2e-f8-${stamp}`, reason: 'teste de restrição' } });
  const wh = await fetch(`${API}/webhooks/whatsapp/${sid}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-OpenWA-Signature': 'sha256=' + createHmac('sha256', `sec-${stamp}`).update(body).digest('base64'), 'X-OpenWA-Idempotency-Key': randomUUID() }, body });
  await sleep(2500);
  srow = await one('SELECT outbox_paused_at, outbox_pause_reason FROM whatsapp_sessions WHERE id=?', [sid]);
  await q(`UPDATE whatsapp_sessions SET openwa_session_id=NULL WHERE id=?`, [sid]);
  ok('fila: restrição do WhatsApp pausa o número sozinha', wh.status === 200 && srow.outbox_paused_at && /restring/i.test(srow.outbox_pause_reason || ''), { wh: wh.status, srow });
  await call(tok, 'POST', `/whatsapp/outbox/sessions/${sid}/resume`);
  await sleep(800);
  a = await call(tok, 'GET', '/whatsapp/audit?q=fila');
  const aOut = await call(tok, 'GET', `/whatsapp/audit?page=1&page_size=100`);
  ok('auditoria: ação em massa da fila registrada', (aOut.j?.items || []).some((x) => /cancel-pending|cancel_pending|outbox/.test(`${x.action} ${x.path}`)), (aOut.j?.items || []).map((x) => x.action).slice(0, 20));

  // ---------------------------------------------------------------- 3. importação em segundo plano
  await call(tok, 'PUT', '/whatsapp/crm-settings', { custom_fields: { customer: [{ key: 'plano_saude', label: 'Plano de saúde', type: 'select', options: ['Amil', 'Unimed'] }] } });
  const tpl = await call(tok, 'GET', '/whatsapp/imports/template.csv', null, true);
  const tplText = tpl.buf.toString('utf8');
  ok('importação: modelo CSV com BOM, colunas novas e campo personalizado', tpl.s === 200 && tpl.buf[0] === 0xef && /paid_history/.test(tplText) && /custom\.plano_saude/.test(tplText), tplText.slice(0, 200));
  const d1 = addDays(today, -60), d2 = addDays(today, -30), nd = addDays(today, 20), bd = addDays(today, 5);
  const csv = [
    'phone;name;email;unit;external_id;product;price;due_day;next_due;balance;balance_due;paid_history;custom.plano_saude',
    `${P(11)};Ana Import;ana@exemplo.com;Centro;ERP-1;Plano E2E F8;109,90;10;${nd};150,00;${bd};${d1}:109,90|${d2}:109,90;Amil`,
    `${P(12)};"Bruno; Import";;Centro;ERP-2;;;;;;;;Unimed`,
    `12345;Telefone Ruim;;;;;;;;;;;`,
    `${P(14)};Carla Custom;;;;;;;;;;;Bradesco`,
    `${P(15)};Dani Data;;;;;;;31/02/2026;;;;`,
  ].join('\r\n');
  const send = async (dry) => {
    const fd = new FormData();
    fd.append('file', new Blob(['﻿' + csv], { type: 'text/csv' }), 'clientes-e2e.csv');
    fd.append('dry_run', dry ? 'true' : 'false');
    return call(tok, 'POST', '/whatsapp/imports', fd);
  };
  const waitJob = async (id) => { for (let i = 0; i < 60; i++) { const g = await call(tok, 'GET', `/whatsapp/imports/${id}`); if (['done', 'failed', 'canceled'].includes(g.j?.status)) return g.j; await sleep(1500); } return null; };
  let j = await send(true);
  ok('importação: simulação aceita (job criado)', okS(j) && j.j?.id, j.j);
  let job = await waitJob(j.j?.id);
  const custBefore = await one('SELECT COUNT(*) n FROM whatsapp_customers WHERE organization_id=?', [orgId]);
  ok('importação: simulação termina sem gravar nada', job?.status === 'done' && Number(custBefore.n) === 1 && job.error_count >= 3, { job, custBefore });
  j = await send(false);
  job = await waitJob(j.j?.id);
  ok(`importação: concluída (${job?.created_count} criados, ${job?.error_count} erros)`, job?.status === 'done' && job.created_count === 2 && job.error_count === 3 && job.total_rows === 5, job);
  const ana = await one(`SELECT c.id, c.name, c.external_id, c.unit_id, JSON_UNQUOTE(JSON_EXTRACT(c.custom,'$.plano_saude')) ps FROM whatsapp_customers c WHERE c.organization_id=? AND c.external_id='ERP-1'`, [orgId]);
  const unit = ana ? await one('SELECT name FROM whatsapp_units WHERE id=?', [ana.unit_id]) : null;
  ok('importação: cliente com id externo, unidade criada e campo personalizado', ana && ana.name === 'Ana Import' && unit?.name === 'Centro' && ana.ps === 'Amil', { ana, unit });
  const bruno = await one(`SELECT name FROM whatsapp_customers WHERE organization_id=? AND external_id='ERP-2'`, [orgId]);
  ok('importação: campo com ";" entre aspas', bruno?.name === 'Bruno; Import', bruno);
  const sub = ana ? await one(`SELECT id, next_due_at, price_cents, status FROM whatsapp_subscriptions WHERE customer_id=?`, [ana.id]) : null;
  ok('importação: assinatura com próximo vencimento do arquivo', sub && new Date(sub.next_due_at).toISOString().slice(0, 10) === nd && sub.price_cents === 10990, sub);
  const chs = ana ? await q(`SELECT status, amount_cents, origin, paid_via, sent_at, DATE_FORMAT(due_at,'%Y-%m-%d') due FROM whatsapp_charges WHERE customer_id=? ORDER BY due_at`, [ana.id]) : [];
  ok('importação: 2 pagamentos do histórico (PAID, via import, sem envio)', chs.filter((x) => x.status === 'PAID' && x.paid_via === 'import' && !x.sent_at).length === 2, chs);
  ok('importação: saldo devedor = 1 cobrança pendente sem envio', chs.filter((x) => x.status === 'PENDING' && x.amount_cents === 15000 && x.due === bd && !x.sent_at).length === 1, chs);
  const outboxImp = await one(`SELECT COUNT(*) n FROM whatsapp_outbox WHERE organization_id=? AND id NOT IN (?)`, [orgId, ob]); // as 3 da seção da fila são do próprio teste
  ok('importação: nenhuma mensagem enfileirada', Number(outboxImp.n) === 0, outboxImp);
  const errCsv = await call(tok, 'GET', `/whatsapp/imports/${j.j.id}/errors.csv`, null, true);
  const et = errCsv.buf.toString('utf8');
  ok('importação: relatório de erros (telefone, campo personalizado, data)', errCsv.s === 200 && /;phone;/i.test(et) && /plano_saude/.test(et) && /next_due/i.test(et), et.slice(0, 400));
  j = await send(false);
  job = await waitJob(j.j?.id);
  const chs2 = ana ? await one(`SELECT COUNT(*) n FROM whatsapp_charges WHERE customer_id=?`, [ana.id]) : null;
  ok('importação: reimportar não duplica clientes nem cobranças', job?.status === 'done' && job.created_count === 0 && Number(chs2?.n) === 3, { job, chs2 });
  const lst = await call(tok, 'GET', '/whatsapp/imports');
  ok('importação: histórico com 3 jobs', (lst.j?.items || []).length === 3, lst.j);
  const mi = await call(memberTok, 'GET', '/whatsapp/imports');
  ok('importação: MEMBER não acessa (403)', mi.s === 403, mi);

  // ---------------------------------------------------------------- 4. LGPD (exportar / apagar)
  const ex = await call(tok, 'GET', `/whatsapp/customers/${ana.id}/export`);
  ok('LGPD: exportar dados (cliente, assinaturas, cobranças)', ex.s === 200 && ex.j?.customer?.name === 'Ana Import' && (ex.j?.subscriptions || []).length === 1 && (ex.j?.charges || []).length === 3, ex.j && { keys: Object.keys(ex.j), customer: ex.j.customer?.name });
  r = await call(tok, 'POST', `/whatsapp/customers/${ana.id}/erase`, { confirm: 'nao' });
  ok('LGPD: apagar sem confirmação → 400', r.s === 400, r);
  r = await call(memberTok, 'POST', `/whatsapp/customers/${ana.id}/erase`, { confirm: 'APAGAR' });
  ok('LGPD: MEMBER não apaga (403)', r.s === 403, r);
  r = await call(tok, 'POST', `/whatsapp/customers/${ana.id}/erase`, { confirm: 'APAGAR', delete_messages: true });
  ok('LGPD: apagar', okS(r), r.j);
  const anaAfter = await one('SELECT name, doc, doc_hash, email, external_id, custom, erased_at, status FROM whatsapp_customers WHERE id=?', [ana.id]);
  ok('LGPD: cliente anonimizado', anaAfter && anaAfter.name !== 'Ana Import' && !anaAfter.email && !anaAfter.external_id && !anaAfter.custom && anaAfter.erased_at && anaAfter.status === 'inactive', anaAfter);
  const subAfter = await one('SELECT status FROM whatsapp_subscriptions WHERE id=?', [sub.id]);
  ok('LGPD: assinatura cancelada', subAfter?.status === 'canceled', subAfter);
  const chAfter = await q('SELECT status FROM whatsapp_charges WHERE customer_id=?', [ana.id]);
  ok('LGPD: pendente cancelada, pagas mantidas', chAfter.filter((x) => x.status === 'PAID').length === 2 && !chAfter.some((x) => x.status === 'PENDING'), chAfter);
  const ctAfter = await one(`SELECT ct.name, ct.opted_out_at FROM whatsapp_contacts ct WHERE ct.organization_id=? AND ct.phone=?`, [orgId, P(11)]);
  ok('LGPD: contato anonimizado e descadastrado', ctAfter && !ctAfter.name && ctAfter.opted_out_at, ctAfter);
  r = await call(tok, 'POST', `/whatsapp/customers/${ana.id}/erase`, { confirm: 'APAGAR' });
  ok('LGPD: apagar de novo → 400', r.s === 400, r);
  await sleep(800);
  a = await call(tok, 'GET', `/whatsapp/audit?entity=customers&entity_id=${ana.id}`);
  ok('LGPD: auditoria registra exportação e apagamento (1 registro de apagar)', (a.j?.items || []).filter((x) => x.action === 'customers.erase').length === 1 && (a.j?.items || []).some((x) => x.action === 'customers.export'), (a.j?.items || []).map((x) => x.action));
} catch (e) {
  fail++; console.log('ERRO', e?.stack || e);
} finally {
  if (orgId) {
    const del = await call(saTok, 'DELETE', `/admin/organizations/${orgId}`);
    const left = await one(`SELECT (SELECT COUNT(*) FROM org_audit_log WHERE organization_id=?)+(SELECT COUNT(*) FROM whatsapp_import_jobs WHERE organization_id=?)+(SELECT COUNT(*) FROM whatsapp_customers WHERE organization_id=?)+(SELECT COUNT(*) FROM whatsapp_outbox WHERE organization_id=?)+(SELECT COUNT(*) FROM whatsapp_units WHERE organization_id=?) n`, [orgId, orgId, orgId, orgId, orgId]);
    const dirGone = !fs.existsSync(path.join(process.cwd(), 'protected', 'imports', orgId));
    ok(`limpeza: org apagada, auditoria/importações/arquivos removidos`, (del.s === 200 || del.s === 204) && Number(left.n) === 0 && dirGone, { del: del.s, left: left.n, dirGone });
  }
  await db.end();
  console.log(`\n${pass}/${pass + fail} passaram${fail ? ` — ${fail} FALHAS` : ''}`);
}
