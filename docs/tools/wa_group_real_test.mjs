// Teste com GRUPO REAL (autorizado pelo Júlio em 13/10/2026) — roda NO SERVIDOR (127.0.0.1:8000):
//   scp docs/tools/wa_group_real_test.mjs pubmail-hostinger:/opt/pub-mail/back/wa_group_real.tmp.mjs
//   ssh pubmail-hostinger 'cd /opt/pub-mail/back && node wa_group_real.tmp.mjs; rm -f wa_group_real.tmp.mjs'
// Org SuperAdmin: o número "Pub Mail" cria um grupo com o número "Principal" (o Júlio), remove-o, e o MOTOR DE ACESSO
// o adiciona (assinatura ativa) e o remove (assinatura encerrada). Encerrar é feito no banco + sync (o cancelamento
// pela API mandaria o aviso "sua assinatura foi cancelada" para o Júlio). No fim: cliente/produto de teste apagados por
// id e o "Pub Mail" sai do grupo. O Júlio (número rotulado "Júlio") recebe as notificações do WhatsApp de "adicionado"/"removido" (3 de cada).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';

const API = 'http://127.0.0.1:8000';
const env = Object.fromEntries(readFileSync('/opt/pub-mail/back/.env', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const DB_PASS = readFileSync('/root/pubmail.secrets', 'utf8').split('\n').find((l) => l.startsWith('DB_PASS='))?.slice(8).trim();
const sql = (q) => execFileSync('mysql', ['-upubmail', `-p${DB_PASS}`, '-h127.0.0.1', '-N', '-e', q, 'pubmail'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
const sign = (u) => jwt.sign({ sub: u.id, org: u.org, role: u.role }, env.JWT_ACCESS_SECRET, { expiresIn: '30m' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mask = (p) => String(p || '').replace(/^(\d{4})\d+(\d{4})$/, '$1•••$2');
let fails = 0, total = 0;
const ok = (l, c, x) => { total++; if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + l + (c || x === undefined ? '' : '  → ' + JSON.stringify(x).slice(0, 400))); };
const call = async (tok, m, p, b) => { const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: b ? JSON.stringify(b) : undefined }); let j = null; const t = await r.text(); try { j = JSON.parse(t); } catch { j = t; } return { s: r.status, j }; };
const GW = String(env.OPENWA_BAILEYS_URL || '').replace(/\/+$/, '');
const gw = async (m, p, b) => { const r = await fetch(GW + p, { method: m, headers: { 'Content-Type': 'application/json', 'X-API-Key': env.OPENWA_BAILEYS_API_KEY }, body: b ? JSON.stringify(b) : undefined }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };

const SA = sql(`SELECT CONCAT(u.id,'|',u.organization_id) FROM users u WHERE u.email='superadmin@pubmail.com' LIMIT 1`).split('|');
const orgId = SA[1];
const tok = sign({ id: SA[0], org: orgId, role: 'SUPER_ADMIN' });
let groupId = null, sid = null, custId = null, prodId = null, subId = null, sessPubMail = null;
const inGroup = async (phone) => { const r = await gw('GET', `/sessions/${sid}/groups/${encodeURIComponent(groupId)}`); return (r.j?.participants || []).some((p) => String(p.number || p.id || '').replace(/\D/g, '').endsWith(phone.slice(-8))); };
try {
  const sessions = (await call(tok, 'GET', '/whatsapp/sessions')).j;
  const list = Array.isArray(sessions) ? sessions : sessions?.items || [];
  sessPubMail = list.find((s) => /pub\s*mail/i.test(s.label || '') && (s.connected || s.status === 'ready'));
  // o número pessoal do Júlio = o OUTRO número da org (rótulo "Júlio"; telefone lido do banco)
  const phone = sql(`SELECT phone FROM whatsapp_sessions WHERE organization_id='${orgId}' AND id<>'${sessPubMail?.id || ''}' AND phone IS NOT NULL AND phone<>'' ORDER BY position LIMIT 1`).replace(/\D/g, '');
  ok('número "Pub Mail" conectado e telefone pessoal do Júlio conhecido', sessPubMail && phone.length >= 12, { pub: sessPubMail?.label, pessoal: mask(phone) });
  if (!sessPubMail || phone.length < 12) throw new Error('pré-requisito faltando — nada foi criado');
  sid = sql(`SELECT openwa_session_id FROM whatsapp_sessions WHERE id='${sessPubMail.id}'`);
  // 1) grupo real criado pelo "Pub Mail" com o Júlio
  const name = `Pub Mail · teste de acesso ${new Date().toISOString().slice(11, 16)}`;
  let r = await gw('POST', `/sessions/${sid}/groups`, { name, participants: [`${phone}@c.us`] });
  groupId = r.j?.id || r.j?.groupId || r.j?.gid || null;
  if (!groupId) { await sleep(3000); const g = await gw('GET', `/sessions/${sid}/groups?limit=1000`); groupId = (g.j || []).find((x) => x.name === name)?.id || null; }
  ok('grupo real criado pelo "Pub Mail" (o Júlio adicionado na criação)', (r.s === 200 || r.s === 201) && /@g\.us$/.test(groupId || ''), { s: r.s, j: r.j });
  if (!groupId) throw new Error('grupo não criado — parando');
  await sleep(2500);
  r = await call(tok, 'GET', `/whatsapp/groups/${encodeURIComponent(groupId)}/admin-check?session_id=${sessPubMail.id}`);
  ok('admin-check: o "Pub Mail" é admin do grupo', r.s === 200 && r.j?.is_admin === true && r.j.participants_count >= 2, r.j);
  // 2) tira o Júlio direto pelo gateway (o motor é quem vai colocar de volta)
  r = await gw('DELETE', `/sessions/${sid}/groups/${encodeURIComponent(groupId)}/participants`, { participants: [`${phone}@c.us`] });
  await sleep(2500);
  ok('gateway: remover participante funciona (DELETE com corpo)', r.s === 200 && !(await inGroup(phone)), { s: r.s, j: r.j });
  // 3) cliente + produto com regra de grupo + assinatura → motor adiciona
  r = await call(tok, 'POST', '/whatsapp/customers', { name: 'TESTE acesso ao grupo (apagar)', phone, another: true });
  custId = r.j?.id;
  ok('cliente de teste criado no número do Júlio', r.s === 201 && custId, r.j);
  if (!custId) throw new Error('cliente não criado — parando');
  r = await call(tok, 'POST', '/whatsapp/products', { name: 'TESTE grupo VIP (apagar)', price_cents: 100, billing: 'monthly', active: false, entitlement: { rules: [{ kind: 'group_member', session_id: sessPubMail.id, ref: groupId, label: 'Grupo VIP de teste', on_overdue: 'suspend', suspend_after_days: 0, on_cancel: 'revoke', invite_fallback: false }] } });
  prodId = r.j?.id;
  ok('produto de teste com regra "entrar no grupo"', r.s === 201 && prodId, r.j);
  r = await call(tok, 'POST', `/whatsapp/customers/${custId}/subscriptions`, { product_id: prodId, due_day: 10 });
  subId = r.j?.subscription?.id;
  ok('assinatura criada (sem cobrar)', r.s === 201 && subId, r.j);
  const waitEnt = async (want, ms = 60_000) => { const t0 = Date.now(); let last = ''; while (Date.now() - t0 < ms) { last = sql(`SELECT CONCAT(status,'|',desired,'|',attempts,'|',IFNULL(error,'')) FROM whatsapp_entitlements WHERE subscription_id='${subId}'`); if (last.startsWith(want + '|')) return last; await sleep(2000); } return last; };
  let st = await waitEnt('active');
  await sleep(2000);
  ok('MOTOR adicionou o Júlio ao grupo (status ativo, está no grupo)', st.startsWith('active|') && (await inGroup(phone)), st);
  // 4) atraso com suspender após 0 dias → motor remove
  sql(`UPDATE whatsapp_subscriptions SET status='overdue', next_due_at=DATE_SUB(CURDATE(), INTERVAL 1 DAY) WHERE id='${subId}'`);
  await call(tok, 'POST', '/whatsapp/entitlements/sync', { subscription_id: subId });
  st = await waitEnt('suspended');
  await sleep(2000);
  ok('em atraso (suspender após 0 dias): MOTOR removeu do grupo', st.startsWith('suspended|') && !(await inGroup(phone)), st);
  // 5) pagou (volta a ativa) → motor adiciona de novo
  sql(`UPDATE whatsapp_subscriptions SET status='active', next_due_at=DATE_ADD(CURDATE(), INTERVAL 20 DAY) WHERE id='${subId}'`);
  await call(tok, 'POST', '/whatsapp/entitlements/sync', { subscription_id: subId });
  st = await waitEnt('active');
  await sleep(2000);
  ok('em dia de novo: MOTOR adicionou de volta', st.startsWith('active|') && (await inGroup(phone)), st);
  // 6) encerrada → revogado e removido
  sql(`UPDATE whatsapp_subscriptions SET status='canceled', canceled_at=NOW(3) WHERE id='${subId}'`);
  await call(tok, 'POST', '/whatsapp/entitlements/sync', { subscription_id: subId });
  st = await waitEnt('revoked');
  await sleep(2000);
  ok('encerrada: acesso REVOGADO e fora do grupo', st.startsWith('revoked|') && !(await inGroup(phone)), st);
  ok('nenhuma mensagem foi para a fila do Júlio durante o teste', sql(`SELECT COUNT(*) FROM whatsapp_outbox WHERE organization_id='${orgId}' AND created_at > NOW() - INTERVAL 15 MINUTE AND (kind LIKE 'subscription_%' OR kind LIKE 'entitlement_%')`) === '0');
} catch (e) {
  fails++; console.log('ERRO', e?.stack || e);
} finally {
  // limpeza só do que o teste criou (por id)
  if (custId) { const r = await call(tok, 'DELETE', `/whatsapp/customers/${custId}`); console.log(`  limpeza: cliente de teste ${r.s}`); }
  if (prodId) { const r = await call(tok, 'DELETE', `/whatsapp/products/${prodId}`); console.log(`  limpeza: produto de teste ${r.s}`); }
  if (groupId && sid) { const r = await gw('POST', `/sessions/${sid}/groups/${encodeURIComponent(groupId)}/leave`, {}); console.log(`  limpeza: "Pub Mail" saiu do grupo de teste ${r.s}`); }
  if (subId) console.log(`  restos no banco: ${sql(`SELECT COUNT(*) FROM whatsapp_entitlements WHERE subscription_id='${subId}'`)} acesso(s), ${sql(`SELECT COUNT(*) FROM whatsapp_subscriptions WHERE id='${subId}'`)} assinatura(s)`);
  console.log(`\n${total - fails}/${total} passaram${fails ? ` — ${fails} FALHAS` : ''}`);
  process.exit(fails ? 1 : 0);
}
