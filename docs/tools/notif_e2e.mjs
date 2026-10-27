// E2E das notificações — roda NO SERVIDOR (cd /opt/pub-mail/back). Dados de teste com número falso, limpos por SQL no fim.
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { createHmac, randomUUID } from 'node:crypto';
const API = 'http://127.0.0.1:8000';
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const db = await mysql.createConnection({ host: '127.0.0.1', user: env.DATABASE_USER, password: env.DATABASE_PASS, database: env.DATABASE_NAME });
const [[u]] = await db.query("SELECT id, organization_id, role FROM users WHERE email='superadmin@pubmail.com'");
const [[sess]] = await db.query("SELECT id, webhook_secret, phone FROM whatsapp_sessions WHERE organization_id=? AND status='ready' ORDER BY position LIMIT 1", [u.organization_id]);
const tok = jwt.sign({ sub: u.id, org: u.organization_id, role: u.role }, env.JWT_ACCESS_SECRET, { expiresIn: '1h' });
const call = async (m, p, body) => { const r = await fetch(API + p, { method: m, headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const hook = async (data) => { const body = JSON.stringify({ event: 'message.received', sessionId: 'x', data }); const sig = 'sha256=' + createHmac('sha256', sess.webhook_secret).update(body).digest('base64'); return fetch(`${API}/webhooks/whatsapp/${sess.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-OpenWA-Signature': sig, 'X-OpenWA-Idempotency-Key': randomUUID() }, body }).then((x) => x.json()); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 0, f = 0; const ok = (name, c, extra) => { n++; if (!c) { f++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ''); } };
const start = new Date();
const P1 = '5500999990077', P2 = '5500999990078';
try {
  let r = await call('GET', '/notifications/catalog');
  ok('catalog: push ligado + vapid + 19 tipos', r.s === 200 && r.j.push_enabled === true && String(r.j.vapid_public_key).length === 87 && r.j.kinds.length >= 19, r.j && { pe: r.j.push_enabled, k: r.j.kinds?.length }); // 19 na criação; cresce com módulos novos
  const defaults = r.j.defaults;
  r = await call('GET', '/notifications/prefs'); ok('prefs carregam', r.s === 200 && typeof r.j.enabled === 'boolean' && r.j.message, r.j);
  const orig = r.j; // preferências REAIS do usuário: restauradas no fim
  await call('PUT', '/notifications/prefs', { prefs: defaults });
  r = await call('GET', '/notifications/prefs'); ok('prefs padrão', r.s === 200 && r.j.enabled === true && r.j.message.scope === 'all', r.j);
  r = await call('PUT', '/notifications/prefs', { prefs: { sound: 'chime', message: { scope: 'mine' }, quiet: { enabled: true, start: '23:00', end: '06:00' }, pipeline: { enabled: true, stages: ['x'] } } });
  ok('PUT parcial normaliza e mescla', r.s === 200 && r.j.sound === 'chime' && r.j.message.scope === 'mine' && r.j.quiet.enabled && r.j.quiet.start === '23:00' && r.j.pipeline.stages?.[0] === 'x' && r.j.push === true, r.j);
  r = await call('PUT', '/notifications/prefs', { prefs: { sound: 'zzz', vibrate: 9, message: { contacts: { mode: 'only', chats: [{ chat_id: 'c1', name: 'A' }, {}] } } } });
  ok('PUT lixo → valores válidos', r.s === 200 && r.j.sound === 'chime' && ['short', 'double', 'long', 'none'].includes(r.j.vibrate) && r.j.message.contacts.mode === 'only' && r.j.message.contacts.chats.length === 1, r.j);
  r = await call('PUT', '/notifications/prefs', { prefs: defaults }); ok('volta aos padrões', r.s === 200 && r.j.message.scope === 'all' && r.j.message.contacts.mode === 'all');

  // aparelhos
  const endpoint = `https://fcm.googleapis.com/fcm/send/e2e-fake-${Date.now()}`;
  r = await call('POST', '/notifications/subscriptions', { endpoint, keys: { p256dh: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', auth: 'AAAAAAAAAAAAAAAAAAAAAA' }, device_label: 'E2E Android · Chrome' });
  ok('subscribe', r.s === 201 && r.j.id, r.j); const subId = r.j?.id;
  r = await call('POST', '/notifications/subscriptions', { endpoint, keys: { p256dh: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', auth: 'AAAAAAAAAAAAAAAAAAAAAA' } });
  ok('subscribe de novo = mesmo id (upsert por endpoint)', r.s === 201 && r.j.id === subId, r.j);
  r = await call('GET', '/notifications/subscriptions'); ok('lista 1 aparelho', r.s === 200 && r.j.some((d) => d.id === subId && d.device_label === 'E2E Android · Chrome'), r.j);
  r = await call('POST', '/notifications/subscriptions/touch', { endpoint }); ok('touch', r.s === 201 && r.j.ok);
  r = await call('POST', '/notifications/subscriptions', { endpoint: 'http://nao-https/x', keys: { p256dh: 'a', auth: 'b' } }); ok('endpoint sem https → 400', r.s === 400);
  // a conta do superadmin é a do Júlio: com aparelho REAL inscrito o teste mandaria notificação para ele → só roda sem aparelho real
  const realDevs = (await call('GET', '/notifications/subscriptions')).j.filter((d) => d.id !== subId).length;
  if (realDevs) { console.log(`PULADO teste push: a conta tem ${realDevs} aparelho(s) real(is) inscrito(s) — não manda notificação de teste para eles`); n++; }
  else { r = await call('POST', '/notifications/test', { channel: 'push' }); ok('teste push (aparelho falso → 0 entregues, sem erro)', r.s === 201 && r.j.push === 0 && r.j.push_enabled === true, r.j); }
  r = await call('POST', '/notifications/test', { channel: 'inapp' }); ok('teste painel (inapp = true se o superadmin está com o painel aberto, senão false)', r.s === 201 && typeof r.j.inapp === 'boolean', r.j);
  r = await call('GET', '/notifications/subscriptions'); if (realDevs) { n++; } else ok('aparelho falso: falha contada ou removido (404/410)', r.s === 200 && (!r.j.some((d) => d.id === subId) || r.j.find((d) => d.id === subId).failures >= 1), r.j);
  r = await call('DELETE', `/notifications/subscriptions/${subId}`); ok('delete por id', r.s === 200);

  // ícone: upload de um PNG mínimo (1x1) e preferência com emoji/url
  {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kAAAAABJRU5ErkJggg==', 'base64');
    const fd = new FormData(); fd.append('file', new Blob([png], { type: 'image/png' }), 'icon.png');
    const up = await fetch(API + '/notifications/icon?slot=e2e', { method: 'POST', headers: { Authorization: 'Bearer ' + tok }, body: fd }); const uj = await up.json().catch(() => null);
    ok('upload do ícone → url pública', up.status === 201 && /\/uploads\/notification-icons\/.+-e2e\.png\?v=/.test(uj?.url || ''), uj);
    if (uj?.url) { const g = await fetch(uj.url); ok('ícone servido pelo nginx (200 image/png)', g.status === 200 && /image\/png/.test(g.headers.get('content-type') || ''), g.status); }
    r = await call('PUT', '/notifications/prefs', { prefs: { icon: { mode: 'emoji', emoji: '🔔', url: uj?.url || 'https://x.test/a.png' }, contact_photo: false } });
    ok('prefs de ícone (emoji + url) e contact_photo', r.s === 200 && r.j.icon.mode === 'emoji' && r.j.icon.emoji === '🔔' && r.j.contact_photo === false, r.j?.icon);
    r = await call('PUT', '/notifications/prefs', { prefs: { icon: { mode: 'image', url: 'javascript:alert(1)' } } });
    ok('url de ícone inválida é ignorada (nunca gravada)', r.s === 200 && !/javascript/.test(r.j.icon.url || ''), r.j?.icon);
    await call('PUT', '/notifications/prefs', { prefs: defaults });
  }
  // personalizados
  r = await call('POST', '/notifications/custom', { name: 'E2E teste', emoji: '🧪', icon_url: 'https://reveleonline.com/pwa/icon-192.png', title: 'Olá do E2E', body: 'corpo', url: '/whatsapp/notifications', sound: 'ping', vibrate: 'double', important: true, recipients: { mode: 'me' } });
  ok('custom create (com icon_url)', r.s === 201 && r.j.id && r.j.recipients.mode === 'me' && r.j.important === true && r.j.icon_url === 'https://reveleonline.com/pwa/icon-192.png', r.j); const cid = r.j?.id;
  r = await call('POST', '/notifications/custom', { name: 'x', title: 'y', url: 'javascript:alert(1)' }); ok('custom url inválida → 400', r.s === 400);
  r = await call('POST', `/notifications/custom/${cid}/fire`, { only_me: true }); ok('fire only_me → 1 candidato, 1 enviado', r.s === 201 && r.j.candidates === 1 && r.j.sent === 1, r.j);
  r = await call('PUT', `/notifications/custom/${cid}`, { title: 'Editado', recipients: { mode: 'all' } }); ok('custom update (admin pode "all")', r.s === 200 && r.j.title === 'Editado' && r.j.recipients.mode === 'all', r.j);
  r = await call('POST', `/notifications/custom/${cid}/fire`, {}); ok('fire all → candidatos ≥ 1', r.s === 201 && r.j.candidates >= 1 && r.j.sent >= 1, r.j);
  r = await call('GET', '/notifications/custom'); ok('custom list', r.s === 200 && r.j.some((c) => c.id === cid && c.fire_count === 2), r.j?.map((c) => [c.name, c.fire_count]));
  r = await call('POST', '/notifications/custom', { name: 'E2E agendado', title: 'Agendado', recipients: { mode: 'me' }, schedule_at: new Date(Date.now() - 60_000).toISOString() });
  ok('custom agendado (passado) criado com sent_at null', r.s === 201 && r.j.schedule_at && !r.j.sent_at, r.j); const sid = r.j?.id;

  // histórico
  r = await call('GET', '/notifications/history'); ok('history com custom (2 disparos + teste)', r.s === 200 && r.j.items.filter((i) => i.kind === 'custom').length >= 2 && r.j.items.some((i) => i.kind === 'test'), r.j?.items?.map((i) => i.kind));
  const firstId = r.j.items[0]?.id;
  r = await call('POST', '/notifications/history/read', { ids: [firstId] }); ok('mark read', r.s === 201 && r.j.updated === 1, r.j);

  // ponte com o WhatsApp: mensagem recebida (número falso) → aviso 'message' para o superadmin
  const ts = Math.floor(Date.now() / 1000);
  let h = await hook({ id: `E2E-N-1-${ts}`, from: `${P1}@c.us`, to: `${sess.phone}@c.us`, chatId: `${P1}@c.us`, type: 'text', body: 'Teste de notificação', timestamp: ts, contact: { pushName: 'Cliente Notif' } });
  ok('webhook aceito', h?.ok !== false, h);
  await sleep(2500);
  r = await call('GET', '/notifications/history');
  const msgLog = r.j.items.find((i) => i.kind === 'message' && i.data?.jid === `${P1}@c.us`);
  ok('aviso de mensagem registrado (título = nome do contato, texto = prévia)', Boolean(msgLog) && /Cliente Notif/.test(msgLog.title) && /Teste de notificação/.test(msgLog.body || ''), msgLog);
  ok('status sent (painel aberto) ou no_device (ninguém online)', ['sent', 'no_device'].includes(msgLog?.status || ''), msgLog?.status);
  // rajada: 3 mensagens em sequência do MESMO contato → 3 avisos (sem o freio antigo de 12 s)
  for (let i = 0; i < 3; i++) { await hook({ id: `E2E-N-R${i}-${ts}`, from: `${P1}@c.us`, to: `${sess.phone}@c.us`, chatId: `${P1}@c.us`, type: 'text', body: `Rajada ${i}`, timestamp: ts + 10 + i }); await sleep(2000); }
  await sleep(1500);
  r = await call('GET', '/notifications/history');
  ok('3 mensagens seguidas = 3 avisos', r.j.items.filter((i) => i.kind === 'message' && i.data?.jid === `${P1}@c.us`).length >= 4, r.j.items.filter((i) => i.kind === 'message').length);
  // escopo "só minhas": conversa sem atendente → não avisa
  await call('PUT', '/notifications/prefs', { prefs: { message: { scope: 'mine' } } });
  h = await hook({ id: `E2E-N-2-${ts}`, from: `${P2}@c.us`, to: `${sess.phone}@c.us`, chatId: `${P2}@c.us`, type: 'text', body: 'Segunda', timestamp: ts + 1, contact: { pushName: 'Cliente Dois' } });
  await sleep(2500);
  r = await call('GET', '/notifications/history');
  ok('escopo "só minhas" bloqueia conversa sem atendente', !r.j.items.some((i) => i.kind === 'message' && i.data?.jid === `${P2}@c.us`), r.j.items.filter((i) => i.kind === 'message').map((i) => i.data?.jid));
  // tipo desligado
  await call('PUT', '/notifications/prefs', { prefs: { message: { scope: 'all', enabled: false } } });
  h = await hook({ id: `E2E-N-3-${ts}`, from: `${P2}@c.us`, to: `${sess.phone}@c.us`, chatId: `${P2}@c.us`, type: 'text', body: 'Terceira', timestamp: ts + 2 });
  await sleep(2500);
  r = await call('GET', '/notifications/history');
  ok('tipo "mensagem" desligado → nada', !r.j.items.some((i) => i.kind === 'message' && i.data?.jid === `${P2}@c.us`));
  await call('PUT', '/notifications/prefs', { prefs: orig }); // devolve as preferências reais do usuário

  // agendado disparou pelo cron? (até 70 s)
  let fired = false;
  for (let i = 0; i < 8 && !fired; i++) { await sleep(10_000); r = await call('GET', '/notifications/custom'); fired = Boolean(r.j.find((c) => c.id === sid)?.sent_at); }
  ok('aviso agendado disparado pelo cron (≤ 80 s)', fired);

  r = await call('DELETE', `/notifications/custom/${cid}`); ok('custom delete', r.s === 200);
  r = await call('DELETE', `/notifications/custom/${sid}`); ok('custom agendado delete', r.s === 200);
  r = await call('DELETE', '/notifications/history'); ok('clear history', r.s === 200 && r.j.removed >= 3, r.j);
} catch (e) { f++; console.log('ERRO', e); }
// limpeza
const org = u.organization_id;
for (const p of [P1, P2]) {
  await db.query('DELETE FROM whatsapp_messages WHERE organization_id=? AND chat_id=?', [org, `${p}@c.us`]);
  await db.query('DELETE FROM whatsapp_service_events WHERE organization_id=? AND chat_id=?', [org, `${p}@c.us`]);
  await db.query('DELETE FROM whatsapp_bot_sessions WHERE organization_id=? AND chat_id=?', [org, `${p}@c.us`]);
  await db.query('DELETE FROM whatsapp_chats WHERE organization_id=? AND chat_id=?', [org, `${p}@c.us`]);
  await db.query('DELETE FROM whatsapp_contact_sessions WHERE contact_id IN (SELECT id FROM whatsapp_contacts WHERE organization_id=? AND (wa_id=? OR phone=?))', [org, `${p}@c.us`, p]);
  await db.query('DELETE FROM whatsapp_contacts WHERE organization_id=? AND (wa_id=? OR phone=?)', [org, `${p}@c.us`, p]);
}
await db.query("DELETE FROM notification_custom WHERE organization_id=? AND name LIKE 'E2E%'", [org]);
await db.query('DELETE FROM notification_log WHERE organization_id=? AND user_id=? AND created_at>=?', [org, u.id, start]);
await db.query("DELETE FROM push_subscriptions WHERE endpoint LIKE '%e2e-fake-%'");
try { fs.unlinkSync(`/opt/pub-mail/back/uploads/notification-icons/${u.id}-e2e.png`); } catch {}
await db.end();
console.log(`${n - f}/${n} ok`);
process.exit(f ? 1 : 0);
