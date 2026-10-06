// Varredura SÓ LEITURA do módulo WhatsApp na org do superadmin (2 números reais). Roda NO SERVIDOR em /opt/pub-mail/back.
// Nunca envia mensagem, nunca altera dados. Imprime PASS/FAIL por endpoint com o shape esperado do multi-número.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';

const API = 'http://127.0.0.1:8000';
const env = Object.fromEntries(readFileSync('/opt/pub-mail/back/.env', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const DB_PASS = readFileSync('/root/pubmail.secrets', 'utf8').split('\n').find((l) => l.startsWith('DB_PASS='))?.slice(8).trim();
const sql = (q) => execFileSync('mysql', ['-upubmail', `-p${DB_PASS}`, '-h127.0.0.1', '-N', '-e', q, 'pubmail'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
const [UID, ORG] = sql(`SELECT CONCAT(id,'|',organization_id) FROM users WHERE email='superadmin@pubmail.com'`).split('|');
const tok = jwt.sign({ sub: UID, org: ORG, role: 'SUPER_ADMIN' }, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
let fails = 0, total = 0;
const ok = (l, c, x) => { total++; if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + l + (c || x === undefined ? '' : '  → ' + JSON.stringify(x).slice(0, 300))); };
const get = async (p) => { const r = await fetch(API + p, { headers: { Authorization: 'Bearer ' + tok } }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const L = (j) => (Array.isArray(j) ? j : j?.items || []);

let r = await get('/whatsapp/sessions'); const sessions = L(r.j);
ok('sessions: 2 números, ambos conectados', r.s === 200 && sessions.length === 2 && sessions.every((s) => s.connected), sessions.map((s) => [s.label, s.status]));
const [A, B] = sessions.sort((x, y) => x.position - y.position);
console.log(`números: A=${A.label} (${A.phone}) B=${B.label} (${B.phone})`);
for (const s of [A, B]) {
  r = await get(`/whatsapp/sessions/${s.id}`); ok(`sessions/:id ${s.label} ready + warmup`, r.s === 200 && r.j.status === 'ready' && r.j.engine, [r.j?.status, r.j?.engine, r.j?.warmup_day]);
  r = await get(`/whatsapp/sessions/${s.id}/profile`); ok(`profile ${s.label}`, r.s === 200 && (r.j.name || r.j.phone), r.j);
  r = await get(`/whatsapp/sessions/${s.id}/diagnostics`); ok(`diagnostics ${s.label}`, r.s === 200 && r.j, Object.keys(r.j || {}));
  r = await get(`/whatsapp/sessions/${s.id}/events?limit=5`); ok(`events ${s.label}`, r.s === 200 && Array.isArray(L(r.j)));
  r = await get(`/whatsapp/sessions/${s.id}/data-summary`); ok(`data-summary ${s.label} (chats>0)`, r.s === 200 && r.j.chats > 0, r.j);
}
r = await get('/whatsapp/sessions/data-summary'); ok('data-summary org = soma', r.s === 200 && r.j.numbers === 2, r.j);

// ---------------- chat
r = await get('/whatsapp/chats?page_size=5'); const all = r.j;
ok('chats todos: itens com session_id + session', r.s === 200 && L(all).every((c) => c.session_id && c.session?.label && /^[0-9a-f-]{36}$/.test(c.chat_id)), L(all)[0]);
r = await get(`/whatsapp/chats?session_id=${B.id}&page_size=50`); const bChats = r.j;
ok(`chats filtradas por B: todas de B (${L(bChats).length})`, r.s === 200 && L(bChats).length > 0 && L(bChats).every((c) => c.session_id === B.id), L(bChats).map((c) => c.session?.label).slice(0, 3));
r = await get(`/whatsapp/chats?session_id=${A.id}&page_size=5`); ok('chats filtradas por A: todas de A', r.s === 200 && L(r.j).every((c) => c.session_id === A.id));
r = await get('/whatsapp/chats/counts'); ok('counts com by_session dos 2 números', r.s === 200 && r.j.by_session && A.id in r.j.by_session, r.j);
r = await get(`/whatsapp/chats/counts?session_id=${B.id}`); const cB = r.j; ok('counts filtrado por B ≤ total', r.s === 200 && cB.all <= all.total && cB.all === bChats.total, [cB.all, bChats.total]);
const chatB = L(bChats).find((c) => c.kind === 'individual') || L(bChats)[0];
if (chatB) {
  r = await get(`/whatsapp/chats/${chatB.chat_id}`); ok('GET chat de B por uuid', r.s === 200 && r.j.session_id === B.id, r.j?.session?.label);
  r = await get(`/whatsapp/chats/${chatB.chat_id}/messages?limit=5`); ok('mensagens de B com session_id', r.s === 200 && L(r.j).every((m) => m.session_id === B.id && m.chat_id === chatB.chat_id), L(r.j).length);
  r = await get(`/whatsapp/chats/${chatB.chat_id}/service/events`); ok('linha do tempo da conversa de B', r.s === 200);
  r = await get(`/whatsapp/chats/${chatB.chat_id}/notes`); ok('notas da conversa de B', r.s === 200);
  r = await get(`/whatsapp/pipeline/chat/${chatB.chat_id}`); ok('funil da conversa de B', r.s === 200 && (r.j.session_id === B.id || r.j.chat_id === chatB.chat_id), r.j);
  r = await get(`/whatsapp/customers/by-chat/${chatB.chat_id}`); ok('cliente por conversa de B', r.s === 200 && r.j.chat?.session_id === B.id, r.j?.chat);
  r = await get(`/whatsapp/tasks?chat_id=${chatB.chat_id}`); ok('tarefas da conversa de B', r.s === 200);
  r = await get(`/whatsapp/charges?chat_id=${chatB.chat_id}`); ok('cobranças da conversa de B', r.s === 200);
  r = await get(`/whatsapp/contacts/lookup?jid=${encodeURIComponent(chatB.jid)}&session_id=${B.id}&chat_id=${chatB.chat_id}`);
  ok('lookup do contato pelo número B', r.s === 200 && r.j.chat?.session_id === B.id, r.j?.chats?.map((c) => c.session?.label));
  const ph = await fetch(`${API}/whatsapp/chats/${chatB.chat_id}/photo`, { headers: { Authorization: 'Bearer ' + tok } }); ok('foto da conversa de B (200 ou 404)', [200, 404].includes(ph.status), ph.status);
}
r = await get(`/whatsapp/groups?session_id=${B.id}`); ok('grupos do número B', r.s === 200 && L(r.j).every((g) => g.session_id === B.id), L(r.j).length);
r = await get('/whatsapp/groups'); ok('grupos de todos (≥ grupos de B)', r.s === 200);
r = await get('/whatsapp/chat-filters'); ok('filtros do chat', r.s === 200);
r = await get('/whatsapp/attendants'); ok('atendentes', r.s === 200 && L(r.j).length >= 1);
r = await get(`/whatsapp/attendants?session_id=${B.id}`); ok('atendentes do número B', r.s === 200);
r = await get('/whatsapp/service-settings'); ok('config de atendimento (org)', r.s === 200 && typeof r.j.reset_hours !== 'undefined', r.j);
r = await get('/whatsapp/tags'); ok('etiquetas', r.s === 200);
r = await get('/whatsapp/quick-replies'); ok('respostas rápidas', r.s === 200);

// ---------------- contatos
r = await get('/whatsapp/contacts?page_size=5'); ok('contatos: chats[] com chat_id + session', r.s === 200 && L(r.j).length > 0 && L(r.j).every((c) => Array.isArray(c.chats) && c.chats.every((x) => x.chat_id && x.session_id)), L(r.j)[0]?.chats);
r = await get(`/whatsapp/contacts?session_id=${B.id}&page_size=50`); ok(`contatos do número B (${r.j?.total}) só com conversa em B`, r.s === 200 && r.j.total > 0 && L(r.j).every((c) => c.chats.some((x) => x.session_id === B.id)), r.j?.total);
r = await get('/whatsapp/contacts/tags'); ok('tags de contato', r.s === 200);

// ---------------- status
r = await get('/whatsapp/contact-statuses'); ok('status dos contatos: 2 blocos (um por número)', r.s === 200 && r.j.sessions?.length === 2 && r.j.sessions.every((b) => b.session?.label), r.j?.sessions?.map((b) => [b.session?.label, b.contacts?.length]));
r = await get(`/whatsapp/contact-statuses?session_id=${B.id}`); ok('status dos contatos só de B (1 bloco)', r.s === 200 && r.j.sessions?.length === 1 && r.j.sessions[0].session.id === B.id);
r = await get('/whatsapp/statuses?status=posted'); ok('meus status publicados (lista com session)', r.s === 200 && L(r.j).every((s) => s.session_id && s.session), L(r.j).length);
r = await get(`/whatsapp/statuses?status=posted&session_id=${B.id}`); ok('meus status filtrados por B', r.s === 200 && L(r.j).every((s) => s.session_id === B.id));

// ---------------- bot
r = await get('/whatsapp/bot/flows'); const flows = L(r.j); ok('fluxos do bot (≥1) com sessions[]', r.s === 200 && flows.length >= 1 && flows.every((f) => Array.isArray(f.sessions)), flows.map((f) => [f.name, f.active, f.sessions.map((s) => s.label)]));
if (flows[0]) { r = await get(`/whatsapp/bot/flows/${flows[0].id}`); ok('fluxo completo (definition)', r.s === 200 && r.j.definition); }
r = await get('/whatsapp/bot/sessions'); ok('monitor do bot', r.s === 200 && Array.isArray(L(r.j)));
r = await get(`/whatsapp/bot/sessions?session_id=${B.id}`); ok('monitor do bot por B', r.s === 200);
r = await get('/whatsapp/bot'); ok('GET /whatsapp/bot compat: sessions com bot_flow_id', r.s === 200 && Array.isArray(r.j.sessions) && r.j.sessions.length === 2, r.j?.sessions?.map((s) => [s.label, s.bot_flow_id ? 'flow' : '-']));

// ---------------- agendamentos / broadcasts
r = await get('/whatsapp/schedules?status=pending'); ok('agendamentos pendentes', r.s === 200);
r = await get(`/whatsapp/schedules?status=history&session_id=${B.id}`); ok('histórico por B', r.s === 200);
r = await get('/whatsapp/broadcasts'); ok('broadcasts (lista)', r.s === 200 && Array.isArray(L(r.j)));
r = await get('/whatsapp/broadcasts/presets'); ok('presets', r.s === 200 && L(r.j).length === 5);

// ---------------- CRM
r = await get('/whatsapp/pipeline/stages'); ok('etapas do funil', r.s === 200);
r = await get('/whatsapp/pipeline/board'); ok('board (todos)', r.s === 200);
r = await get(`/whatsapp/pipeline/board?session_id=${B.id}`); ok('board por B', r.s === 200 && r.j.session_id === B.id);
r = await get('/whatsapp/tasks'); ok('tarefas', r.s === 200);
r = await get(`/whatsapp/tasks/counts?session_id=${B.id}`); ok('contadores de tarefas por B', r.s === 200);
r = await get('/whatsapp/customers'); ok('clientes', r.s === 200);
r = await get(`/whatsapp/customers?session_id=${B.id}`); ok('clientes por B', r.s === 200);
r = await get('/whatsapp/products'); ok('produtos', r.s === 200);
r = await get('/whatsapp/charges'); ok('cobranças (chat_id uuid)', r.s === 200 && L(r.j).every((c) => !c.chat_id || /^[0-9a-f-]{36}$/.test(c.chat_id)), L(r.j)[0]);
r = await get(`/whatsapp/charges?session_id=${B.id}`); ok('cobranças por B', r.s === 200);
r = await get('/whatsapp/metrics'); ok('métricas com by_session (2)', r.s === 200 && r.j.by_session?.length === 2, r.j?.by_session?.map((x) => x.label));
r = await get(`/whatsapp/metrics?session_id=${B.id}`); ok('métricas por B', r.s === 200 && r.j.by_session?.length === 1);
r = await get('/whatsapp/ratings'); ok('avaliações', r.s === 200);
r = await get('/whatsapp/crm-settings'); ok('crm-settings', r.s === 200);
r = await get(`/admin/organizations/${ORG}/whatsapp-sessions`); ok('admin: números da org (2)', r.s === 200 && L(r.j).length === 2);

console.log(`\n${total - fails}/${total} passaram`);
process.exit(fails ? 1 : 0);
