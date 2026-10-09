// E2E dos broadcasts anti-ban (08–09/10/2026) — roda NO SERVIDOR:
//   ssh pubmail-hostinger 'cat > /opt/pub-mail/back/bc.tmp.mjs' < docs/tools/wa_broadcast_antiban_e2e.mjs
//   ssh pubmail-hostinger 'cd /opt/pub-mail/back && NODE_PATH=/opt/keepalive/node_modules node bc.tmp.mjs; rm -f bc.tmp.mjs'
// Usa a conta do superadmin e o 1º número conectado. Números FALSOS (5500999990098/99): a checagem de
// existência pula o 99 (sem WhatsApp) sem enviar nada; o 98 só recebe uma linha DONE criada por SQL para
// testar a contagem de respostas. Tudo é apagado no fim.
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { createHmac, randomUUID } from 'node:crypto';
const API = 'http://127.0.0.1:8000';
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const db = await mysql.createConnection({ host: '127.0.0.1', user: env.DATABASE_USER, password: env.DATABASE_PASS, database: env.DATABASE_NAME });
const [[u]] = await db.query("SELECT id, organization_id, role FROM users WHERE email='superadmin@pubmail.com'");
const [[sess]] = await db.query("SELECT id, webhook_secret, phone, label FROM whatsapp_sessions WHERE organization_id=? AND status='ready' ORDER BY position LIMIT 1", [u.organization_id]);
const org = u.organization_id;
const tok = jwt.sign({ sub: u.id, org, role: u.role }, env.JWT_ACCESS_SECRET, { expiresIn: '1h' });
const call = async (m, p, body) => { const r = await fetch(API + p, { method: m, headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const hook = async (data) => { const body = JSON.stringify({ event: 'message.received', sessionId: 'x', data }); const sig = 'sha256=' + createHmac('sha256', sess.webhook_secret).update(body).digest('base64'); return fetch(`${API}/webhooks/whatsapp/${sess.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-OpenWA-Signature': sig, 'X-OpenWA-Idempotency-Key': randomUUID() }, body }).then((x) => x.json()); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 0, f = 0; const ok = (name, c, extra) => { n++; if (!c) { f++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ''); } };
const P_NO = '5500999990099', P_YES = '5500999990098';
let bcId = null, cNo = null, cYes = null;
try {
  let r = await call('GET', '/whatsapp/broadcasts/presets');
  ok('presets: padrão = personalizado 0,3 s, mínimo 0,1 s', r.s === 200 && r.j.default === 'custom' && r.j.items.find((x) => x.key === 'custom')?.interval_ms === 300 && r.j.limits.interval_ms.min === 100, r.j && { d: r.j.default, min: r.j.limits?.interval_ms });

  // contatos de teste (manuais)
  r = await call('POST', '/whatsapp/contacts', { phone: P_NO, name: 'E2E Sem WhatsApp' }); ok('contato manual (sem WhatsApp)', r.s === 201 && r.j.id, r.j); cNo = r.j?.id;
  r = await call('POST', '/whatsapp/contacts', { phone: P_YES, name: 'E2E Respondeu' }); ok('contato manual (responde)', r.s === 201 && r.j.id, r.j); cYes = r.j?.id;

  // campanha: 0,3 s, randomizar, 2 copies
  r = await call('POST', '/whatsapp/broadcasts', { name: 'E2E anti-ban', session_ids: [sess.id], targets: { contacts: 'none', contact_ids: [cNo, cYes], tags: [], groups: [] }, times: [], mode: 'sequential', pacing: { preset: 'custom', interval_ms: 300, jitter_pct: 20, daily_limit: null, pause_every: 0, pause_minutes: 0, window: null }, randomize_copies: true, exclude_inactive_days: null, active: false });
  ok('create: randomize_copies + 0,3 s', r.s === 201 && r.j.id && r.j.randomize_copies === true && r.j.pacing.interval_ms === 300 && r.j.exclude_inactive_days === null, r.j); bcId = r.j?.id;
  r = await call('PUT', `/whatsapp/broadcasts/${bcId}/copies`, { copies: [{ messages: [{ text: 'Copy A {{nome}}' }] }, { messages: [{ text: 'Copy B {{nome}}' }] }] }); ok('2 copies', r.s === 200 || r.s === 201, r.j);
  r = await call('PUT', `/whatsapp/broadcasts/${bcId}`, { name: 'E2E anti-ban', exclude_inactive_days: 7 }); ok('update exclude_inactive_days=7', r.s === 200 && r.j.exclude_inactive_days === 7, r.j);
  r = await call('PUT', `/whatsapp/broadcasts/${bcId}`, { name: 'E2E anti-ban', exclude_inactive_days: 999 }); ok('exclude_inactive_days fora da faixa → 400', r.s === 400);
  r = await call('PUT', `/whatsapp/broadcasts/${bcId}`, { name: 'E2E anti-ban', pacing: { preset: 'custom', interval_ms: 50 } }); ok('intervalo abaixo do mínimo sobe para 0,1 s', r.s === 200 && r.j.pacing.interval_ms === 100, r.j?.pacing);
  r = await call('PUT', `/whatsapp/broadcasts/${bcId}`, { name: 'E2E anti-ban', pacing: { preset: 'custom', interval_ms: 300 }, exclude_inactive_days: null }); ok('volta 0,3 s / sem exclusão', r.s === 200 && r.j.pacing.interval_ms === 300 && r.j.exclude_inactive_days === null);

  // estimativa: com exclusão de inativos, os 2 contatos (nunca responderam) somem
  r = await call('POST', '/whatsapp/broadcasts/audience-estimate', { targets: { contacts: 'none', contact_ids: [cNo, cYes] }, session_ids: [sess.id], distribution: 'shared' }); ok('estimativa sem exclusão = 2', r.s === 201 && r.j.contacts === 2, r.j);
  r = await call('POST', '/whatsapp/broadcasts/audience-estimate', { targets: { contacts: 'none', contact_ids: [cNo, cYes] }, session_ids: [sess.id], distribution: 'shared', exclude_inactive_days: 7 }); ok('estimativa com exclusão (7 dias) = 0 + aviso', r.s === 201 && r.j.contacts === 0 && (r.j.warnings || []).some((w) => /7 dias/.test(w)), r.j);

  // disparo: o worker checa existência → 99 e 98 não têm WhatsApp → SKIPPED, nada enviado
  r = await call('POST', `/whatsapp/broadcasts/${bcId}/fire`, {}); ok('fire', r.s === 201 && r.j.total === 2, r.j);
  const runId = r.j?.run_id;
  const [sendRows] = await db.query('SELECT copy_index FROM whatsapp_broadcast_sends WHERE run_id=?', [runId]);
  ok('sends com copy_index sorteado (randomizar)', sendRows.length === 2 && sendRows.every((x) => x.copy_index === 0 || x.copy_index === 1), sendRows);
  let run = null;
  for (let i = 0; i < 20; i++) { await sleep(2000); r = await call('GET', `/whatsapp/broadcasts/${bcId}/runs`); run = r.j?.items?.find((x) => x.id === runId); if (run && run.status === 'done') break; }
  ok('run concluída sem enviar: 2 pulados (número não tem WhatsApp)', run?.status === 'done' && run.skipped === 2 && run.sent === 0 && run.randomized === true, run);
  r = await call('GET', `/whatsapp/broadcasts/${bcId}/runs/${runId}/sends`); ok('sends SKIPPED com motivo', r.s === 200 && r.j.items.length === 2 && r.j.items.every((x) => x.status === 'SKIPPED' && /WhatsApp/.test(x.skip_reason || '')), r.j?.items);
  const [[cRow]] = await db.query('SELECT wa_exists, wa_checked_at FROM whatsapp_contacts WHERE id=?', [cNo]);
  ok('contato marcado wa_exists=false (cache 30 d)', cRow && cRow.wa_exists === 0 && cRow.wa_checked_at, cRow);

  // pausa / retomada / enviar mesmo assim (run criada por SQL com fila no futuro)
  const runB = randomUUID();
  await db.query("INSERT INTO whatsapp_broadcast_runs (id, broadcast_id, organization_id, run_at, messages, total, status) VALUES (?,?,?,NOW(),'[]',1,'running')", [runB, bcId, org]);
  await db.query("INSERT INTO whatsapp_broadcast_sends (id, organization_id, session_id, broadcast_id, run_id, target_kind, chat_id, contact_id, status, next_at) VALUES (?,?,?,?,?,'contact',?,?,'PENDING', DATE_ADD(NOW(), INTERVAL 1 DAY))", [randomUUID(), org, sess.id, bcId, runB, `${P_NO}@c.us`, cNo]);
  r = await call('POST', `/whatsapp/broadcasts/${bcId}/runs/${runB}/pause`, {}); ok('pausa manual', r.s === 201 && r.j.status === 'paused', r.j);
  r = await call('POST', `/whatsapp/broadcasts/${bcId}/runs/${runB}/pause`, {}); ok('pausar de novo → 400', r.s === 400);
  r = await call('GET', `/whatsapp/broadcasts/${bcId}/runs?status=paused`); ok('histórico filtra pausados (com motivo)', r.s === 200 && r.j.items.some((x) => x.id === runB && x.status === 'paused' && x.pause_reason === 'Pausado manualmente'), r.j?.items?.map((x) => [x.id === runB, x.status]));
  r = await call('GET', '/whatsapp/broadcasts'); const row = r.j.find((b) => b.id === bcId); ok('lista mostra paused_run', row?.paused_run?.id === runB, row?.paused_run);
  r = await call('POST', `/whatsapp/broadcasts/${bcId}/runs/${runB}/resume`, { force: true }); ok('enviar mesmo assim → running + forced_at', r.s === 201 && r.j.status === 'running' && r.j.forced_at, r.j);
  await sleep(6000); // o worker pega a fila (next_at zerado) → contato sem WhatsApp → SKIPPED → done
  r = await call('GET', `/whatsapp/broadcasts/${bcId}/runs`); const rb = r.j.items.find((x) => x.id === runB);
  ok('run retomada terminou (pulado)', rb && rb.status === 'done' && rb.skipped === 1, rb);
  r = await call('POST', `/whatsapp/broadcasts/${bcId}/runs/${runB}/resume`, {}); ok('retomar run concluída → 400', r.s === 400);

  // respostas: envio DONE por SQL + mensagem recebida do contato → marcado como respondeu
  const runC = randomUUID();
  await db.query("INSERT INTO whatsapp_broadcast_runs (id, broadcast_id, organization_id, run_at, messages, total, sent, status, finished_at) VALUES (?,?,?,NOW(),'[]',1,1,'done',NOW())", [runC, bcId, org]);
  await db.query("INSERT INTO whatsapp_broadcast_sends (id, organization_id, session_id, broadcast_id, run_id, target_kind, chat_id, contact_id, status, sent_at) VALUES (?,?,?,?,?,'contact',?,?,'DONE', NOW())", [randomUUID(), org, sess.id, bcId, runC, `${P_YES}@c.us`, cYes]);
  r = await call('GET', `/whatsapp/broadcasts/${bcId}/replies?days=7`); ok('replies antes: 1 contato enviado, 0 respostas', r.s === 200 && r.j.replied === 0 && r.j.contacts >= 1, r.j);
  const ts = Math.floor(Date.now() / 1000);
  await hook({ id: `E2E-BC-R-${ts}`, from: `${P_YES}@c.us`, to: `${sess.phone}@c.us`, chatId: `${P_YES}@c.us`, type: 'text', body: 'Oi, quero sim', timestamp: ts, contact: { pushName: 'E2E Respondeu' } });
  await sleep(2500);
  r = await call('GET', `/whatsapp/broadcasts/${bcId}/replies?days=7`); ok('replies depois: 1 resposta com nome e taxa', r.s === 200 && r.j.replied === 1 && r.j.items[0]?.name && r.j.rate > 0, r.j);
  r = await call('GET', `/whatsapp/broadcasts/${bcId}/runs`); const rc = r.j.items.find((x) => x.id === runC); ok('run mostra replied=1', rc?.replied === 1, rc);
  // agora o contato que respondeu entra na audiência "últimos 7 dias"; o outro não
  r = await call('POST', '/whatsapp/broadcasts/audience-estimate', { targets: { contacts: 'none', contact_ids: [cNo, cYes] }, session_ids: [sess.id], distribution: 'shared', exclude_inactive_days: 7 }); ok('estimativa com exclusão: só quem respondeu (1)', r.s === 201 && r.j.contacts === 1, r.j);

  // contato que bloqueou o número sai da audiência
  await db.query('UPDATE whatsapp_contacts SET blocked_us_at=NOW() WHERE id=?', [cYes]);
  r = await call('POST', '/whatsapp/broadcasts/audience-estimate', { targets: { contacts: 'none', contact_ids: [cNo, cYes] }, session_ids: [sess.id], distribution: 'shared' }); ok('quem bloqueou o número fica fora (1 de 2)', r.s === 201 && r.j.contacts === 1, r.j);

  r = await call('DELETE', `/whatsapp/broadcasts/${bcId}`); ok('delete broadcast', r.s === 200 || r.s === 204); bcId = null;
} catch (e) { f++; console.log('ERRO', e); }
// limpeza
try {
  if (bcId) await db.query('DELETE FROM whatsapp_broadcasts WHERE id=?', [bcId]);
  for (const p of [P_NO, P_YES]) {
    await db.query('DELETE FROM whatsapp_messages WHERE organization_id=? AND chat_id=?', [org, `${p}@c.us`]);
    await db.query('DELETE FROM whatsapp_service_events WHERE organization_id=? AND chat_id=?', [org, `${p}@c.us`]);
    await db.query('DELETE FROM whatsapp_bot_sessions WHERE organization_id=? AND chat_id=?', [org, `${p}@c.us`]);
    await db.query('DELETE FROM whatsapp_chats WHERE organization_id=? AND chat_id=?', [org, `${p}@c.us`]);
    await db.query('DELETE FROM whatsapp_contact_sessions WHERE contact_id IN (SELECT id FROM whatsapp_contacts WHERE organization_id=? AND (wa_id=? OR phone=?))', [org, `${p}@c.us`, p]);
    await db.query('DELETE FROM whatsapp_contacts WHERE organization_id=? AND (wa_id=? OR phone=?)', [org, `${p}@c.us`, p]);
  }
  await db.query('DELETE FROM notification_log WHERE organization_id=? AND user_id=? AND kind IN (?,?) AND created_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)', [org, u.id, 'broadcast_done', 'broadcast_paused']);
} catch (e) { console.log('limpeza:', e?.message || e); }
await db.end();
console.log(`${n - f}/${n} ok`);
process.exit(f ? 1 : 0);
