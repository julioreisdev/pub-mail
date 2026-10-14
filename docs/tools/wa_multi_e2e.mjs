// E2E WhatsApp MULTI-NÚMERO — roda NO SERVIDOR contra 127.0.0.1:8000.
// Cria uma organização temporária (via admin), 2 números simulados (linhas de whatsapp_sessions com
// webhook_secret fictício — nada vai ao gateway), manda webhooks assinados como o OpenWA faria,
// testa acesso por número de um MEMBER, bot/agendamentos/status/broadcasts por número, purge por número,
// e apaga a organização no fim. Segredos vêm do ambiente/arquivos, nunca impressos.
import { createHmac, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';

const API = 'http://127.0.0.1:8000';
const env = Object.fromEntries(readFileSync('/opt/pub-mail/back/.env', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const SECRET = env.JWT_ACCESS_SECRET;
const DB_PASS = readFileSync('/root/pubmail.secrets', 'utf8').split('\n').find((l) => l.startsWith('DB_PASS='))?.slice(8).trim();
const sql = (q) => execFileSync('mysql', ['-upubmail', `-p${DB_PASS}`, '-h127.0.0.1', '-N', '-e', q, 'pubmail'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
const sign = (u) => jwt.sign({ sub: u.id, org: u.org, role: u.role }, SECRET, { expiresIn: '20m' });

let fails = 0, total = 0;
const ok = (l, c, x) => { total++; if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + l + (c || x === undefined ? '' : '  → ' + JSON.stringify(x).slice(0, 400))); };
const call = async (tok, m, p, b) => {
  const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: b ? JSON.stringify(b) : undefined });
  let j = null; try { j = await r.json(); } catch { /* vazio */ }
  return { s: r.status, j };
};
const hook = async (rowId, secret, event, data) => {
  const body = JSON.stringify({ event, data, idempotencyKey: randomUUID() });
  const sig = 'sha256=' + createHmac('sha256', secret).update(body).digest('base64');
  const r = await fetch(`${API}/webhooks/whatsapp/${rowId}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-OpenWA-Signature': sig, 'X-OpenWA-Idempotency-Key': randomUUID() }, body });
  return r.json();
};
const L = (j) => (Array.isArray(j) ? j : j?.items || []);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SA = sql(`SELECT CONCAT(u.id,'|',u.organization_id) FROM users u WHERE u.email='superadmin@pubmail.com' LIMIT 1`).split('|');
const saTok = sign({ id: SA[0], org: SA[1], role: 'SUPER_ADMIN' });

const stamp = Date.now().toString(36);
const EMAIL_OWNER = `wa-multi-owner-${stamp}@teste.local`, EMAIL_MEMBER = `wa-multi-member-${stamp}@teste.local`;
const PHONE1 = '5500999990071', PHONE2 = '5500999990072';
let orgId, ownerId, memberId, ownerTok, memberTok, A, B, flowId;
try {
  // ---------------- org temporária com 2 usuários
  let r = await call(saTok, 'POST', '/admin/clients', { name: 'WA Multi Owner', email: EMAIL_OWNER, password: 'Senha!Teste123', org_name: `E2E WA Multi ${stamp}`, modules: ['whatsapp', 'settings'], price_cents: 0 });
  orgId = r.j?.organization?.id; ownerId = r.j?.user?.id;
  ok('org temporária criada (grátis) com dono', r.s === 201 && orgId && ownerId, r.j);
  ownerTok = sign({ id: ownerId, org: orgId, role: 'OWNER' });
  r = await call(saTok, 'POST', '/admin/users', { organization_id: orgId, name: 'WA Multi Member', email: EMAIL_MEMBER, password: 'Senha!Teste123', role: 'MEMBER', modules: ['whatsapp'] });
  memberId = r.j?.id; ok('membro criado com módulo whatsapp (todos os números)', r.s === 201 && memberId && r.j.whatsapp_sessions === null, r.j);
  memberTok = sign({ id: memberId, org: orgId, role: 'MEMBER' });

  // ---------------- números
  r = await call(ownerTok, 'GET', '/whatsapp/sessions'); ok('org nova: lista de números vazia', r.s === 200 && L(r.j).length === 0, r.j);
  r = await call(ownerTok, 'POST', '/whatsapp/sessions', { label: 'Vendas', color: '#3B82F6' }); A = r.j?.id;
  ok('número A criado (Vendas, azul, status none)', r.s === 201 && A && r.j.label === 'Vendas' && r.j.color === '#3B82F6' && r.j.status === 'none', r.j);
  r = await call(ownerTok, 'POST', '/whatsapp/sessions', { label: 'Suporte' }); B = r.j?.id;
  ok('número B criado (Suporte, cor automática diferente)', r.s === 201 && B && r.j.color && r.j.color !== '#3B82F6', r.j);
  r = await call(memberTok, 'POST', '/whatsapp/sessions', { label: 'X' }); ok('membro não cria número → 403', r.s === 403, r.j);
  r = await call(ownerTok, 'PUT', `/whatsapp/sessions/${A}`, { label: 'Vendas SP', color: '#EC4899' }); ok('renomear + cor do número', r.s === 200 && r.j.label === 'Vendas SP' && r.j.color === '#EC4899', r.j);
  r = await call(ownerTok, 'PUT', `/whatsapp/sessions/${A}`, { color: 'azul' }); ok('cor inválida → 400', r.s === 400, r.j);
  r = await call(ownerTok, 'PUT', '/whatsapp/sessions/reorder', { ids: [B, A] });
  ok('reordenar abas (B antes de A)', r.s === 200 && L(r.j)[0]?.id === B && L(r.j)[1]?.id === A, L(r.j).map((x) => x.label));

  // simula o pareamento: linhas "ready" com segredo de webhook (nada vai ao gateway)
  const secA = randomUUID(), secB = randomUUID();
  sql(`UPDATE whatsapp_sessions SET status='ready', engine='baileys', phone='5500999990001', push_name='Vendas', paired_at=NOW(3), webhook_secret='${secA}', openwa_session_id=NULL WHERE id='${A}'`);
  sql(`UPDATE whatsapp_sessions SET status='ready', engine='baileys', phone='5500999990002', push_name='Suporte', paired_at=NOW(3), webhook_secret='${secB}', openwa_session_id=NULL WHERE id='${B}'`);
  await sleep(300);

  // ---------------- mensagens chegando em cada número (mesmo contato nos 2)
  const ts = Math.floor(Date.now() / 1000);
  let h = await hook(A, secA, 'message.received', { id: `E2E-A-1-${stamp}`, from: `${PHONE1}@c.us`, to: '5500999990001@c.us', chatId: `${PHONE1}@c.us`, type: 'text', body: 'Oi, quero comprar', timestamp: ts, contact: { pushName: 'Cliente Multi' } });
  ok('webhook assinado do número A aceito', h?.ok === true, h);
  h = await hook(B, secB, 'message.received', { id: `E2E-B-1-${stamp}`, from: `${PHONE1}@c.us`, to: '5500999990002@c.us', chatId: `${PHONE1}@c.us`, type: 'text', body: 'Oi, preciso de suporte', timestamp: ts + 1, contact: { pushName: 'Cliente Multi' } });
  h = await hook(B, secB, 'message.received', { id: `E2E-B-2-${stamp}`, from: `${PHONE2}@c.us`, to: '5500999990002@c.us', chatId: `${PHONE2}@c.us`, type: 'text', body: 'Outro cliente', timestamp: ts + 2, contact: { pushName: 'Segundo' } });
  h = await hook(A, secA, 'message.received', { id: `E2E-A-2-${stamp}`, from: `${PHONE1}@c.us`, to: '5500999990001@c.us', chatId: `${PHONE1}@c.us`, type: 'text', body: '@5500999990002 pode me ajudar?', timestamp: ts + 3 });
  // assinatura errada é rejeitada
  const bad = await fetch(`${API}/webhooks/whatsapp/${A}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-OpenWA-Signature': 'sha256=AAAA' }, body: JSON.stringify({ event: 'message.received', data: { id: 'x', from: `${PHONE2}@c.us`, type: 'text', body: 'invasor' } }) }).then((x) => x.json());
  ok('webhook com assinatura errada → ok:false', bad?.ok === false, bad);
  await sleep(1200);

  r = await call(ownerTok, 'GET', '/whatsapp/chats');
  const chats = r.j?.items || [];
  const chatA1 = chats.find((c) => c.session_id === A && c.phone === PHONE1), chatB1 = chats.find((c) => c.session_id === B && c.phone === PHONE1), chatB2 = chats.find((c) => c.session_id === B && c.phone === PHONE2);
  ok('3 conversas (A:1, B:2), cada uma com session_id + session {label,color}', r.s === 200 && chats.length === 3 && chatA1 && chatB1 && chatB2 && chatB1.session?.label === 'Suporte' && chatA1.session?.color === '#EC4899', chats.map((c) => [c.session?.label, c.phone]));
  ok('chat_id público é uuid e jid é o id do WhatsApp', /^[0-9a-f-]{36}$/.test(chatA1?.chat_id || '') && chatA1?.jid === `${PHONE1}@c.us`, chatA1);
  ok('mesmo contato em 2 números = 2 conversas distintas', chatA1?.chat_id !== chatB1?.chat_id);
  r = await call(ownerTok, 'GET', `/whatsapp/chats?session_id=${A}`); ok('filtro por número A → 1 conversa', r.s === 200 && r.j.items.length === 1 && r.j.items[0].session_id === A, r.j?.items?.length);
  r = await call(ownerTok, 'GET', '/whatsapp/chats/counts'); // by_session = nº de CONVERSAS com não lidas por número (mesma régua do chip "Não lidos"): A tem 1 conversa, B tem 2
  ok('contagens com by_session (conversas com não lidas por número)', r.s === 200 && r.j.by_session && Number(r.j.by_session[A]) === 1 && Number(r.j.by_session[B]) === 2, r.j);
  r = await call(ownerTok, 'GET', `/whatsapp/chats/counts?session_id=${B}`); ok('contagens filtradas pelo número B', r.s === 200 && r.j.all === 2, r.j);
  r = await call(ownerTok, 'GET', `/whatsapp/chats/${chatA1.chat_id}/messages`); ok('mensagens da conversa A (2) com session_id', r.s === 200 && r.j.items.length === 2 && r.j.items.every((m) => m.session_id === A && m.chat_id === chatA1.chat_id), r.j?.items?.length);
  r = await call(ownerTok, 'GET', '/whatsapp/contacts'); const cont = (r.j?.items || []).find((c) => c.phone === PHONE1);
  ok('contato é da org e lista as conversas nos 2 números', r.s === 200 && cont && Array.isArray(cont.chats) && cont.chats.length === 2 && new Set(cont.chats.map((c) => c.session_id)).size === 2, cont?.chats);
  r = await call(ownerTok, 'GET', `/whatsapp/contacts?session_id=${A}`); ok('contatos filtrados por número A (só quem tem conversa lá)', r.s === 200 && r.j.items.some((c) => c.phone === PHONE1) && !r.j.items.some((c) => c.phone === PHONE2), r.j?.items?.map((c) => c.phone));
  r = await call(ownerTok, 'GET', `/whatsapp/contacts/lookup?jid=${PHONE1}@c.us&session_id=${B}`); ok('lookup resolve a conversa do número pedido + lista as outras', r.s === 200 && r.j.chat?.session_id === B && r.j.chats?.length === 2, r.j);
  r = await call(ownerTok, 'POST', '/whatsapp/chats/open', { phone: PHONE2, session_id: A }); ok('abrir conversa pelo número A com telefone cria a conversa no número A', r.s === 201 && r.j.session_id === A && r.j.phone === PHONE2, r.j);
  // a partir daqui: A tem 2 conversas (PHONE1, PHONE2) e B tem 2 (PHONE1, PHONE2) = 4
  r = await call(ownerTok, 'GET', '/whatsapp/chat-filters'); ok('filtros de conversa listam vazio', r.s === 200);

  // ---------------- acesso por número do MEMBER
  r = await call(memberTok, 'GET', '/whatsapp/chats'); ok('membro (todos) vê as 4 conversas', r.s === 200 && r.j.items.length === 4, r.j?.items?.length);
  r = await call(saTok, 'PATCH', `/admin/users/${memberId}`, { whatsapp_sessions: [A] }); ok('admin restringe o membro ao número A', r.s === 200 && JSON.stringify(r.j.whatsapp_sessions) === JSON.stringify([A]), r.j);
  r = await call(saTok, 'GET', `/admin/organizations/${orgId}/whatsapp-sessions`); ok('admin lista os números da org (2)', r.s === 200 && L(r.j).length === 2 && L(r.j).every((x) => x.label && x.color), r.j);
  r = await call(memberTok, 'GET', '/whatsapp/sessions'); ok('membro restrito só vê o número A', r.s === 200 && L(r.j).length === 1 && L(r.j)[0].id === A, L(r.j).map((x) => x.label));
  r = await call(memberTok, 'GET', `/whatsapp/sessions/${B}`); ok('membro restrito: GET número B → 403', r.s === 403, r.j);
  r = await call(memberTok, 'GET', '/whatsapp/chats'); ok('membro restrito: lista só as conversas de A (2)', r.s === 200 && r.j.items.length === 2 && r.j.items.every((c) => c.session_id === A), r.j?.items?.length);
  r = await call(memberTok, 'GET', `/whatsapp/chats?session_id=${B}`); ok('membro restrito: filtro pelo número B → vazio', r.s === 200 && r.j.items.length === 0, r.j);
  r = await call(memberTok, 'GET', `/whatsapp/chats/${chatB1.chat_id}/messages`); ok('membro restrito: conversa de B → 404', r.s === 404, r.j);
  r = await call(memberTok, 'POST', '/whatsapp/messages/send-text', { chat_id: chatB1.chat_id, text: 'x' }); ok('membro restrito: enviar na conversa de B → 404', r.s === 404, r.j);
  r = await call(memberTok, 'GET', '/whatsapp/contacts'); ok('membro restrito: contatos listam só conversas de A', r.s === 200 && r.j.items.every((c) => (c.chats || []).every((x) => x.session_id === A)), r.j?.items?.map((c) => c.chats));
  r = await call(memberTok, 'POST', '/whatsapp/statuses', { session_ids: [B], type: 'text', body: 'x', schedule_at: new Date(Date.now() + 3600e3).toISOString() }); ok('membro restrito: status pelo número B → 404', r.s === 404, r.j);
  r = await call(memberTok, 'GET', '/whatsapp/chats/counts'); ok('membro restrito: contagens só de A', r.s === 200 && r.j.all === 2 && !(B in (r.j.by_session || {})), r.j);
  r = await call(saTok, 'PATCH', `/admin/users/${memberId}`, { whatsapp_sessions: null }); ok('admin devolve "todos" ao membro', r.s === 200 && r.j.whatsapp_sessions === null, r.j);
  r = await call(memberTok, 'GET', '/whatsapp/sessions'); ok('membro volta a ver os 2 números (cache invalidado)', r.s === 200 && L(r.j).length === 2, L(r.j).length);

  // ---------------- bot: fluxos por número
  r = await call(ownerTok, 'GET', '/whatsapp/bot/flows'); ok('org nova: nenhum fluxo', r.s === 200 && L(r.j).length === 0, r.j);
  r = await call(ownerTok, 'POST', '/whatsapp/bot/flows', { name: 'Fluxo Vendas' }); flowId = r.j?.id; ok('fluxo criado desligado', r.s === 201 && flowId && r.j.active === false, r.j);
  r = await call(ownerTok, 'PUT', `/whatsapp/bot/flows/${flowId}/sessions`, { session_ids: [A] }); ok('fluxo atribuído ao número A', r.s === 200, r.j);
  r = await call(ownerTok, 'GET', `/whatsapp/sessions/${A}`); ok('número A aponta para o fluxo', r.s === 200 && r.j.bot_flow_id === flowId, r.j?.bot_flow_id);
  r = await call(ownerTok, 'PUT', `/whatsapp/sessions/${B}`, { bot_flow_id: flowId }); ok('número B recebe o mesmo fluxo pela tela de Configurações', r.s === 200 && r.j.bot_flow_id === flowId, r.j);
  r = await call(ownerTok, 'GET', '/whatsapp/bot/flows'); ok('lista de fluxos mostra os 2 números no fluxo', r.s === 200 && L(r.j)[0]?.sessions?.length === 2, L(r.j)[0]?.sessions);
  r = await call(ownerTok, 'PUT', `/whatsapp/sessions/${B}`, { bot_flow_id: null }); ok('número B sem bot', r.s === 200 && r.j.bot_flow_id === null, r.j);
  r = await call(ownerTok, 'GET', '/whatsapp/bot'); ok('GET /whatsapp/bot compat traz flows + sessions com bot_flow_id', r.s === 200 && Array.isArray(r.j.flows) && Array.isArray(r.j.sessions) && r.j.sessions.find((s) => s.id === A)?.bot_flow_id === flowId, r.j?.sessions);

  // ---------------- agendamentos (1 linha por número, mesmo lote)
  const when = new Date(Date.now() + 2 * 3600e3).toISOString();
  r = await call(ownerTok, 'POST', '/whatsapp/schedules', { session_ids: [A, B], mode: 'all', targets: [PHONE2], messages: [{ text: 'Olá {{nome}}' }], schedule_at: when });
  ok('agendamento modo "all" em 2 números → 2 linhas com o mesmo batch_id', r.s === 201 && r.j.items?.length === 2 && r.j.batch_id && new Set(r.j.items.map((x) => x.session_id)).size === 2, r.j);
  const batch1 = r.j?.batch_id;
  r = await call(ownerTok, 'POST', '/whatsapp/schedules', { session_ids: [A, B], mode: 'split', targets: [PHONE2, '5500999990073'], messages: [{ text: 'Split' }], schedule_at: when });
  ok('agendamento modo "split" divide os 2 alvos entre os números', r.s === 201 && r.j.items?.length === 2 && r.j.items.every((x) => x.targets.length === 1), r.j?.items?.map((x) => [x.session?.label, x.targets.length]));
  r = await call(ownerTok, 'POST', '/whatsapp/schedules', { session_ids: [B], targets: [chatA1.chat_id], messages: [{ text: 'uuid' }], schedule_at: when });
  ok('alvo uuid de conversa vai SEMPRE pelo número da conversa (A), mesmo escolhendo B', r.s === 201 && r.j.items?.length === 1 && r.j.items[0].session_id === A, r.j?.items?.map((x) => x.session?.label));
  r = await call(ownerTok, 'GET', `/whatsapp/schedules?status=pending&session_id=${A}`); ok('lista pendentes filtrada por número A', r.s === 200 && r.j.items.length === 3 && r.j.items.every((x) => x.session_id === A && x.session?.label), r.j?.items?.length);
  r = await call(ownerTok, 'GET', `/whatsapp/schedules?status=pending&batch_id=${batch1}`); ok('lista por batch_id', r.s === 200 && r.j.items.length === 2, r.j?.items?.length);
  const schedA = r.j.items.find((x) => x.session_id === A);
  r = await call(ownerTok, 'PATCH', `/whatsapp/schedules/${schedA.id}`, { messages: [{ text: 'Editado' }], apply_to_batch: true });
  ok('editar uma linha com apply_to_batch replica no lote', r.s === 200 && (await call(ownerTok, 'GET', `/whatsapp/schedules?status=pending&batch_id=${batch1}`)).j.items.every((x) => x.messages[0].text === 'Editado'), r.j);

  // ---------------- status publicados (1 por número)
  r = await call(ownerTok, 'POST', '/whatsapp/statuses', { session_ids: [A, B], type: 'text', body: 'Promo', bg_color: '#123456', schedule_at: when });
  ok('status agendado em 2 números → batch com 2 itens', r.s === 201 && r.j.batch_id && r.j.items?.length === 2 && new Set(r.j.items.map((x) => x.session_id)).size === 2, r.j);
  r = await call(ownerTok, 'GET', `/whatsapp/statuses?session_id=${B}`); ok('status listados por número B com session', r.s === 200 && r.j.items.length === 1 && r.j.items[0].session?.label === 'Suporte', r.j);
  r = await call(ownerTok, 'POST', '/whatsapp/statuses', { session_ids: [], type: 'text', body: 'x' }); ok('status sem número → 400', r.s === 400, r.j);
  r = await call(ownerTok, 'GET', '/whatsapp/contact-statuses'); ok('status dos contatos agrupado por número (2 blocos)', r.s === 200 && r.j.sessions?.length === 2 && r.j.sessions.every((s) => s.session?.label && Array.isArray(s.contacts)), r.j);

  // ---------------- broadcasts (números + ritmo)
  r = await call(ownerTok, 'GET', '/whatsapp/broadcasts/presets'); const presets = r.j?.items || [];
  ok('presets de ritmo: fast/normal/safe/very_safe/custom com risco', r.s === 200 && ['fast', 'normal', 'safe', 'very_safe', 'custom'].every((k) => presets.some((p) => p.key === k)) && presets.find((p) => p.key === 'fast')?.risk === 'high', presets.map((p) => p.key));
  r = await call(ownerTok, 'POST', '/whatsapp/broadcasts', { name: 'Campanha', session_ids: [A, B], targets: { contacts: 'all' }, pacing: { preset: 'fast' }, times: [600] });
  ok('preset fast sem risk_ack → 400', r.s === 400, r.j);
  r = await call(ownerTok, 'POST', '/whatsapp/broadcasts', { name: 'Campanha', session_ids: [A, B], targets: { contacts: 'all' }, pacing: { preset: 'safe' }, times: [600], risk_ack: true });
  const bcId = r.j?.id; ok('broadcast criado em 2 números com preset safe', r.s === 201 && bcId && r.j.session_ids?.length === 2 && r.j.pacing?.preset === 'safe', r.j);
  r = await call(ownerTok, 'POST', '/whatsapp/broadcasts/audience-estimate', { targets: { contacts: 'all' }, session_ids: [A, B] });
  ok('estimativa de audiência com divisão por número (2 contatos)', (r.s === 200 || r.s === 201) && r.j.total === 2 && r.j.by_session?.length === 2 && r.j.by_session.reduce((n, s) => n + s.contacts, 0) === 2, r.j);
  r = await call(ownerTok, 'PUT', `/whatsapp/broadcasts/${bcId}`, { name: 'Campanha', session_ids: [A, B], targets: { contacts: 'all' }, pacing: { preset: 'custom', interval_ms: 500, jitter_pct: 200, daily_limit: 99999 }, times: [600], risk_ack: true });
  ok('custom com valores fora da faixa é saneado (clamps)', r.s === 200 && r.j.pacing?.interval_ms >= 100 && r.j.pacing?.jitter_pct <= 80 && r.j.pacing?.daily_limit <= 5000, r.j?.pacing);
  r = await call(ownerTok, 'GET', '/whatsapp/broadcasts'); ok('lista traz sessions + warmup por número', r.s === 200 && L(r.j).some((b) => b.id === bcId && b.sessions?.length === 2 && Array.isArray(b.warmup)), L(r.j)[0]);

  // ---------------- CRM: conversa por número
  r = await call(ownerTok, 'GET', `/whatsapp/customers/by-chat/${chatB1.chat_id}`); ok('by-chat (uuid) devolve chat com session_id', r.s === 200 && r.j.chat?.session_id === B, r.j);
  r = await call(ownerTok, 'POST', '/whatsapp/tasks', { chat_id: chatB1.chat_id, title: 'Ligar', due_at: when }); const taskId = r.j?.id;
  ok('tarefa ligada à conversa de B traz session_id e chat.chat_id uuid', r.s === 201 && r.j.session_id === B && r.j.chat?.chat_id === chatB1.chat_id, r.j);
  r = await call(ownerTok, 'GET', `/whatsapp/tasks?session_id=${A}`); ok('tarefas filtradas por A não incluem a de B', r.s === 200 && !L(r.j).some((t) => t.id === taskId), r.j);
  r = await call(ownerTok, 'POST', `/whatsapp/chats/${chatA1.chat_id}/notes`, { text: 'nota A' }); ok('nota na conversa A grava session_id', r.s === 201 && r.j.session_id === A, r.j);
  r = await call(ownerTok, 'GET', `/whatsapp/pipeline/board?session_id=${B}`); ok('funil filtrado por número B', r.s === 200 && r.j.session_id === B, Object.keys(r.j || {}));
  r = await call(ownerTok, 'GET', `/whatsapp/metrics?session_id=${A}`); ok('métricas por número com by_session', r.s === 200 && Array.isArray(r.j.by_session) && r.j.by_session.length === 1 && r.j.by_session[0].session_id === A, r.j?.by_session);

  // ---------------- tempo real: sala por número (só confere que o gateway aceita o handshake)
  // (coberto no navegador; aqui não abrimos socket)

  // ---------------- purge por número
  r = await call(ownerTok, 'GET', `/whatsapp/sessions/${A}/data-summary`); ok('resumo de dados do número A (2 conversas, 2 msgs)', r.s === 200 && r.j.chats === 2 && r.j.messages === 2, r.j);
  r = await call(ownerTok, 'POST', `/whatsapp/sessions/${A}/purge`, { confirm: 'APAGAR' }); ok('purge do número A', r.s === 201 || r.s === 200, r.j);
  await sleep(2500);
  r = await call(ownerTok, 'GET', '/whatsapp/chats'); ok('conversas de A sumiram, as de B continuam (2)', r.s === 200 && r.j.items.length === 2 && r.j.items.every((c) => c.session_id === B), r.j?.items?.map((c) => c.session?.label));
  r = await call(ownerTok, 'GET', `/whatsapp/sessions/${A}`); ok('número A continua existindo, desconectado, sem bot', r.s === 200 && r.j.status === 'none' && r.j.bot_flow_id === null, r.j);
  r = await call(ownerTok, 'GET', '/whatsapp/contacts'); ok('contatos (da org) continuam após o purge de A', r.s === 200 && r.j.items.some((c) => c.phone === PHONE1), r.j?.items?.length);
  r = await call(ownerTok, 'DELETE', `/whatsapp/sessions/${A}`); ok('apagar o número A (linha some, cascata)', r.s === 200, r.j);
  r = await call(ownerTok, 'GET', '/whatsapp/sessions'); ok('resta só o número B', r.s === 200 && L(r.j).length === 1 && L(r.j)[0].id === B, L(r.j).map((x) => x.label));
  r = await call(ownerTok, 'GET', `/whatsapp/schedules?status=pending`); ok('agendamentos do número apagado sumiram (cascata), os de B ficam', r.s === 200 && r.j.items.every((x) => x.session_id === B), r.j?.items?.map((x) => x.session?.label));
} catch (e) {
  fails++; console.log('EXCEPTION', e?.stack || e);
} finally {
  if (orgId) {
    const d = await call(saTok, 'DELETE', `/admin/organizations/${orgId}`);
    const left = sql(`SELECT COUNT(*) FROM whatsapp_sessions WHERE organization_id='${orgId}'`);
    console.log(`limpeza: org apagada (${d.s}); sessões restantes=${left}; users=${sql(`SELECT COUNT(*) FROM users WHERE organization_id='${orgId}'`)}`);
  }
}
console.log(`\n${total - fails}/${total} passaram`);
process.exit(fails ? 1 : 0);
