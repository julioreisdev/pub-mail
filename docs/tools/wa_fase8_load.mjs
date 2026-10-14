// Carga da Fase 8 (assinaturas WhatsApp, contrato §12.5) — roda NO SERVIDOR:
//   scp docs/tools/wa_fase8_load.mjs pubmail-hostinger:/opt/pub-mail/back/wa_f8_load.tmp.mjs
//   ssh pubmail-hostinger 'cd /opt/pub-mail/back && NODE_PATH=/opt/keepalive/node_modules node wa_f8_load.tmp.mjs; rm -f wa_f8_load.tmp.mjs'
// Org temporária (apagada no fim) com N clientes + N assinaturas + N cobranças pendentes inseridos em lote por SQL.
// Gateway fictício "pronto" (nenhuma assinatura vence na janela → a rotina varre tudo sem chamar o gateway).
// Número fictício SEM sessão no gateway → nada é enviado de verdade (a fila reagenda "Número desconectado").
// Mede: rotina diária (< 60 s), listagens do painel (< 500 ms), consulta do worker da fila, pausa da fila.
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import http from 'node:http';

const N = Number(process.env.N || 10_000);
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const API = 'http://127.0.0.1:8000';
const db = await mysql.createConnection({ host: '127.0.0.1', user: env.DATABASE_USER, password: env.DATABASE_PASS, database: env.DATABASE_NAME });
const q = async (s, p) => (await db.query(s, p))[0];
const [sa] = await q("SELECT id, organization_id FROM users WHERE email='superadmin@pubmail.com'");
const sign = (sub, org, role) => jwt.sign({ sub, org, role }, env.JWT_ACCESS_SECRET, { expiresIn: '60m' });
const saTok = sign(sa.id, sa.organization_id, 'SUPER_ADMIN');
const call = async (tok, m, p, b) => { const t0 = performance.now(); const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { s: r.status, j, ms: performance.now() - t0 }; };
// chamada longa (a rotina diária pode passar dos 5 min do fetch na 1ª rodada): http puro, sem limite de tempo
const callLong = (tok, m, p) => new Promise((resolve) => {
  const t0 = performance.now();
  const req = http.request(API + p, { method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok } }, (res) => {
    let b = ''; res.on('data', (x) => (b += x)); res.on('end', () => { let j; try { j = JSON.parse(b); } catch { j = b; } resolve({ s: res.statusCode, j, ms: performance.now() - t0 }); });
  });
  req.on('error', (e) => resolve({ s: 0, j: String(e), ms: performance.now() - t0 }));
  req.end();
});
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; console.log('ok  ', name); } else { fail++; console.log('FAIL', name, extra !== undefined ? `→ ${JSON.stringify(extra).slice(0, 400)}` : ''); } };
const brt = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const addDays = (s, n) => new Date(new Date(`${s}T12:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
const today = brt();
const stamp = Date.now().toString(36);
let orgId = null;

async function bulk(table, cols, rows) {
  for (let i = 0; i < rows.length; i += 1000) {
    const part = rows.slice(i, i + 1000);
    await db.query(`INSERT INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(',')}) VALUES ?`, [part]);
  }
}
async function timed(label, tok, path, limitMs = 500) {
  const runs = [];
  let last;
  for (let i = 0; i < 3; i++) { last = await call(tok, 'GET', path); runs.push(last.ms); }
  runs.sort((a, b) => a - b);
  ok(`${label}: ${Math.round(runs[1])} ms (mediana de 3) < ${limitMs} ms`, last.s === 200 && runs[1] < limitMs, { s: last.s, runs: runs.map(Math.round), j: last.s !== 200 ? last.j : undefined });
  return last;
}

try {
  const c = await call(saTok, 'POST', '/admin/clients', { name: 'Carga Fase 8', email: `load-f8-${stamp}@teste.local`, password: 'Senha!Teste123', org_name: `E2E Carga Fase8 ${stamp}`, modules: ['whatsapp', 'settings'], price_cents: 0 });
  orgId = c.j?.organization?.id;
  ok('org temporária criada', c.s === 201 && orgId, c.j);
  const tok = sign(c.j.user.id, orgId, 'OWNER');
  const sess = await call(tok, 'POST', '/whatsapp/sessions', { label: 'Carga' });
  const sessionId = sess.j?.id;
  await q(`UPDATE whatsapp_sessions SET status='ready', engine='baileys', phone='5500999990901', push_name='Carga', paired_at=NOW(3), openwa_session_id=NULL WHERE id=?`, [sessionId]);
  const p = await call(tok, 'POST', '/whatsapp/products', { name: 'Plano Carga', price_cents: 4990, billing: 'monthly', kind: 'plan' });
  const productId = p.j?.id;
  ok('número e produto', sessionId && productId, { sess: sess.j, p: p.j });
  // gateway fictício "pronto" (nenhuma chamada sai: nada vence na janela de geração)
  await q(`INSERT INTO telegram_payment_settings (id, organization_id, provider, access_token, active, created_at, updated_at) VALUES (UUID(), ?, 'mercadopago', 'TEST-0000-load-fake', 1, NOW(3), NOW(3))`, [orgId]).catch((e) => console.log('gateway fake:', e.message));

  // ---- dados em lote
  const t0 = Date.now();
  const contacts = [], chats = [], customers = [], links = [], subs = [], charges = [];
  for (let i = 0; i < N; i++) {
    const phone = `55009${String(80000000 + i).padStart(8, '0')}`;
    const jid = `${phone}@c.us`;
    const contactId = randomUUID(), customerId = randomUUID(), subId = randomUUID();
    contacts.push([contactId, orgId, jid, phone, `Cliente Carga ${i}`, 1, 'import']);
    chats.push([randomUUID(), orgId, sessionId, jid, 'individual', `Cliente Carga ${i}`]);
    customers.push([customerId, orgId, contactId, `Cliente Carga ${i}`, 'active', 'import']);
    links.push([customerId, contactId, 'owner', 'import']);
    // vencimentos fora da janela de geração (hoje+20..+49) → a rotina varre e não gera
    const due = addDays(today, 20 + (i % 30));
    subs.push([subId, orgId, customerId, productId, 'Plano Carga', 4990, 'monthly', Number(due.slice(8, 10)) > 28 ? 28 : Number(due.slice(8, 10)), 'active', addDays(today, -60), due, 'import']);
    // cobrança pendente do ciclo anterior: vencimentos de hoje-15 a hoje+4 (lembretes D-3/D0/D+1/D+5 e atraso)
    charges.push([randomUUID(), orgId, customerId, subId, sessionId, jid, 4990, 'Plano Carga', addDays(today, -15 + (i % 20)), 'PENDING', 'pix', 'recurring', new Date()]);
  }
  await bulk('whatsapp_contacts', ['id', 'organization_id', 'wa_id', 'phone', 'name', 'saved', 'source'], contacts);
  await bulk('whatsapp_chats', ['id', 'organization_id', 'session_id', 'chat_id', 'kind', 'name'], chats);
  await bulk('whatsapp_customers', ['id', 'organization_id', 'contact_id', 'name', 'status', 'source'], customers);
  await bulk('whatsapp_customer_contacts', ['customer_id', 'contact_id', 'role', 'linked_by'], links);
  await bulk('whatsapp_subscriptions', ['id', 'organization_id', 'customer_id', 'product_id', 'product_name', 'price_cents', 'billing', 'due_day', 'status', 'started_at', 'next_due_at', 'source'], subs);
  await bulk('whatsapp_charges', ['id', 'organization_id', 'customer_id', 'subscription_id', 'session_id', 'chat_id', 'amount_cents', 'description', 'due_at', 'status', 'kind', 'origin', 'sent_at'], charges);
  const [cnt] = await q('SELECT (SELECT COUNT(*) FROM whatsapp_customers WHERE organization_id=?) c, (SELECT COUNT(*) FROM whatsapp_subscriptions WHERE organization_id=?) s, (SELECT COUNT(*) FROM whatsapp_charges WHERE organization_id=?) ch', [orgId, orgId, orgId]);
  ok(`dados inseridos: ${cnt.c} clientes, ${cnt.s} assinaturas, ${cnt.ch} cobranças (${Math.round((Date.now() - t0) / 1000)} s)`, Number(cnt.c) === N && Number(cnt.s) === N && Number(cnt.ch) === N, cnt);

  // ---- rotina diária
  const st = await call(tok, 'GET', '/whatsapp/charges/settings');
  console.log('     gateway_ready =', st.j?.gateway_ready, '· auto_recurring =', st.j?.auto_recurring);
  const d = await callLong(tok, 'POST', '/whatsapp/charges/run-daily');
  console.log('     tempos:', JSON.stringify(d.j?.timings));
  const res = d.j || {};
  ok(`rotina diária: ${Math.round(d.ms / 1000)} s < 60 s`, (d.s === 200 || d.s === 201) && d.ms < 60_000, { s: d.s, j: d.j });
  const expectReminders = charges.filter((x) => [-3, 0, 1, 5].includes(Math.round((new Date(`${today}T12:00:00Z`) - new Date(`${x[8]}T12:00:00Z`)) / 86_400_000))).length;
  ok(`lembretes enfileirados para TODAS as cobranças do dia (${res.reminders} ≈ ${expectReminders}; antes parava nas 1.000 primeiras)`, res.reminders === expectReminders, res);
  ok(`nenhuma cobrança gerada (nada vence na janela) e sem erros`, res.generated === 0 && !(res.errors || []).length, { generated: res.generated, errors: (res.errors || []).slice(0, 5) });
  const [ov] = await q(`SELECT COUNT(*) n FROM whatsapp_subscriptions WHERE organization_id=? AND status='overdue'`, [orgId]);
  ok(`assinaturas marcadas em atraso: ${ov.n} (rodada informou ${res.overdue})`, Number(ov.n) === res.overdue && res.overdue > 0, { ov, overdue: res.overdue });
  const [tg] = await q(`SELECT COUNT(*) n FROM whatsapp_chats c JOIN whatsapp_tags t ON t.organization_id=c.organization_id AND t.name='Inadimplente' WHERE c.organization_id=? AND JSON_CONTAINS(c.tags, JSON_QUOTE(t.id))`, [orgId]);
  ok(`etiqueta "Inadimplente" nas conversas em atraso: ${tg.n}`, Number(tg.n) > 0, tg);
  const d2 = await callLong(tok, 'POST', '/whatsapp/charges/run-daily');
  console.log('     tempos (2ª):', JSON.stringify(d2.j?.timings));
  ok(`2ª rodada no mesmo dia: ${Math.round(d2.ms / 1000)} s, não repete lembretes (${d2.j?.reminders} enfileirados)`, d2.ms < 60_000 && (d2.j?.queued ?? 0) === 0, d2.j);

  // ---- fila
  const [ob] = await q(`SELECT COUNT(*) n FROM whatsapp_outbox WHERE organization_id=? AND status='pending'`, [orgId]);
  ok(`fila com ${ob.n} envios pendentes`, Number(ob.n) === res.queued, { ob, queued: res.queued });
  const tq = performance.now();
  await q(`SELECT id FROM (SELECT id, run_at, ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY run_at, created_at) AS rn FROM whatsapp_outbox WHERE status='pending' AND run_at <= NOW(3)) t WHERE rn=1 ORDER BY run_at LIMIT 200`);
  const tqMs = performance.now() - tq;
  ok(`consulta do worker da fila (a cada 2 s): ${Math.round(tqMs)} ms < 300 ms`, tqMs < 300, tqMs);
  const sum = await timed('fila: resumo', tok, '/whatsapp/outbox/summary');
  if (sum.s === 200) {
    await timed('fila: lista', tok, '/whatsapp/outbox?status=pending&page=1');
    const pz = await call(tok, 'POST', `/whatsapp/outbox/sessions/${sessionId}/pause`, { reason: 'teste de carga' });
    const [ps] = await q(`SELECT outbox_paused_at FROM whatsapp_sessions WHERE id=?`, [sessionId]);
    ok('fila: pausar o número', (pz.s === 200 || pz.s === 201) && ps.outbox_paused_at, pz.j);
    const before = await q(`SELECT COUNT(*) n FROM whatsapp_outbox WHERE organization_id=? AND status='pending'`, [orgId]);
    await new Promise((r) => setTimeout(r, 8000));
    const after = await q(`SELECT COUNT(*) n, MAX(attempts) a FROM whatsapp_outbox WHERE organization_id=? AND status='pending'`, [orgId]);
    ok('fila: número pausado não é processado (pendentes intactos, sem tentativa)', Number(before[0].n) === Number(after[0].n) && Number(after[0].a || 0) === 0, { before, after });
    const rz = await call(tok, 'POST', `/whatsapp/outbox/sessions/${sessionId}/resume`);
    ok('fila: retomar', rz.s === 200 || rz.s === 201, rz.j);
  }

  // ---- listagens do painel
  await timed('clientes (página 1)', tok, '/whatsapp/customers?page=1');
  await timed('clientes (busca)', tok, '/whatsapp/customers?q=Carga%20999');
  await timed('cobranças (página 1)', tok, '/whatsapp/charges?page=1');
  await timed('cobranças pendentes', tok, '/whatsapp/charges?status=PENDING&page=1');
  await timed('financeiro (este mês)', tok, `/whatsapp/finance?from=${today.slice(0, 8)}01&to=${today}`, 1500);
  await timed('auditoria', tok, '/whatsapp/audit?page=1');
  await timed('importações', tok, '/whatsapp/imports');
} catch (e) {
  fail++; console.log('ERRO', e?.stack || e);
} finally {
  if (orgId) {
    const del = await call(saTok, 'DELETE', `/admin/organizations/${orgId}`);
    const left = await q(`SELECT (SELECT COUNT(*) FROM whatsapp_customers WHERE organization_id=?)+(SELECT COUNT(*) FROM whatsapp_subscriptions WHERE organization_id=?)+(SELECT COUNT(*) FROM whatsapp_charges WHERE organization_id=?)+(SELECT COUNT(*) FROM whatsapp_outbox WHERE organization_id=?)+(SELECT COUNT(*) FROM whatsapp_contacts WHERE organization_id=?)+(SELECT COUNT(*) FROM org_audit_log WHERE organization_id=?)+(SELECT COUNT(*) FROM telegram_payment_settings WHERE organization_id=?) n`, [orgId, orgId, orgId, orgId, orgId, orgId, orgId]);
    if (Number(left[0].n)) { // a remoção da org não pegou algo: limpa por id da org temporária (só ela)
      for (const t of ['whatsapp_outbox', 'whatsapp_charges', 'whatsapp_subscription_events', 'whatsapp_subscriptions', 'whatsapp_customers', 'whatsapp_chats', 'whatsapp_contacts', 'org_audit_log', 'telegram_payment_settings']) await q(`DELETE FROM ${t} WHERE organization_id=?`, [orgId]).catch(() => undefined);
    }
    ok(`limpeza: org apagada e nada sobrou (${left[0].n} linhas antes da limpeza extra)`, (del.s === 200 || del.s === 204) && Number(left[0].n) === 0, { del: del.s, left: left[0].n });
  }
  await db.end();
  console.log(`\n${pass}/${pass + fail} passaram${fail ? ` — ${fail} FALHAS` : ''}`);
}
