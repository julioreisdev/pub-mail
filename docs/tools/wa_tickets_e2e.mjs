// E2E da Fase 6B (chamados / protocolos) — roda NO SERVIDOR (127.0.0.1:8000):
//   scp docs/tools/wa_tickets_e2e.mjs pubmail-hostinger:/opt/pub-mail/back/wa_tickets_e2e.tmp.mjs
//   ssh pubmail-hostinger 'cd /opt/pub-mail/back && node wa_tickets_e2e.tmp.mjs; rm -f wa_tickets_e2e.tmp.mjs'
// Org temporária (apagada no fim), número FALSO marcado `ready` por SQL com segredo de webhook fictício
// (mensagens do cliente chegam por webhook assinado; textos ao cliente ficam na fila e são apagados no fim).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';

const API = 'http://127.0.0.1:8000';
const env = Object.fromEntries(readFileSync('/opt/pub-mail/back/.env', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const DB_PASS = readFileSync('/root/pubmail.secrets', 'utf8').split('\n').find((l) => l.startsWith('DB_PASS='))?.slice(8).trim();
const sql = (q) => execFileSync('mysql', ['-upubmail', `-p${DB_PASS}`, '-h127.0.0.1', '-N', '-e', q, 'pubmail'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
const sign = (u) => jwt.sign({ sub: u.id, org: u.org, role: u.role }, env.JWT_ACCESS_SECRET, { expiresIn: '40m' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0, total = 0;
const ok = (l, c, x) => { total++; if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + l + (c || x === undefined ? '' : '  → ' + JSON.stringify(x).slice(0, 500))); };
const call = async (tok, m, p, b, h = {}) => { const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...h }, body: b ? JSON.stringify(b) : undefined }); let j = null; const t = await r.text(); try { j = JSON.parse(t); } catch { j = t; } return { s: r.status, j }; };
const hook = async (rowId, secret, event, data) => {
  const body = JSON.stringify({ event, data, idempotencyKey: randomUUID() });
  const sig = 'sha256=' + createHmac('sha256', secret).update(body).digest('base64');
  const r = await fetch(`${API}/webhooks/whatsapp/${rowId}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-OpenWA-Signature': sig, 'X-OpenWA-Idempotency-Key': randomUUID() }, body });
  return r.status;
};
const outbox = (kind) => Number(sql(`SELECT COUNT(*) FROM whatsapp_outbox WHERE organization_id='${orgId}' AND kind='${kind}'`));
const waitFor = async (fn, ms = 80_000, step = 2_000) => { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = await fn(); if (v) return v; await sleep(step); } return v; };

const SA = sql(`SELECT CONCAT(u.id,'|',u.organization_id) FROM users u WHERE u.email='superadmin@pubmail.com' LIMIT 1`).split('|');
const saTok = sign({ id: SA[0], org: SA[1], role: 'SUPER_ADMIN' });
const stamp = Date.now().toString(36);
const PHONE = `55009999904${String(Math.floor(Math.random() * 90) + 10)}`;
let orgId, tok, ownerId, memberId, memberTok, blindTok, sessionId, secret, apiKey;
try {
  // ---------------- org, usuários, número
  let r = await call(saTok, 'POST', '/admin/clients', { name: 'Chamados Owner', email: `tk-owner-${stamp}@teste.local`, password: 'Senha!Teste123', org_name: `E2E Chamados ${stamp}`, modules: ['whatsapp', 'settings'], price_cents: 0 });
  orgId = r.j?.organization?.id; ownerId = r.j?.user?.id;
  ok('org temporária criada', r.s === 201 && orgId, r.j);
  tok = sign({ id: ownerId, org: orgId, role: 'OWNER' });
  r = await call(saTok, 'POST', '/admin/users', { organization_id: orgId, name: 'Atendente Ana', email: `tk-member-${stamp}@teste.local`, password: 'Senha!Teste123', role: 'MEMBER', modules: ['whatsapp'] });
  memberId = r.j?.id; memberTok = sign({ id: memberId, org: orgId, role: 'MEMBER' });
  r = await call(saTok, 'POST', '/admin/users', { organization_id: orgId, name: 'Sem Número', email: `tk-blind-${stamp}@teste.local`, password: 'Senha!Teste123', role: 'MEMBER', modules: ['whatsapp'], whatsapp_sessions: [] });
  const blindId = r.j?.id; blindTok = sign({ id: blindId, org: orgId, role: 'MEMBER' });
  ok('2 membros criados (um sem acesso a número)', Boolean(memberId && blindId), r.j);
  r = await call(tok, 'POST', '/whatsapp/sessions', { label: 'Atendimento' });
  sessionId = r.j?.id; secret = randomBytes(24).toString('hex');
  sql(`UPDATE whatsapp_sessions SET status='ready', engine='baileys', phone='5500999990401', push_name='Prefeitura', paired_at=NOW(3), webhook_secret='${secret}', openwa_session_id=NULL WHERE id='${sessionId}'`);

  // ---------------- configurações
  r = await call(tok, 'GET', '/whatsapp/tickets/settings');
  ok('configuração padrão: 3 categorias, SLA por prioridade', r.s === 200 && r.j.categories?.length === 3 && r.j.sla_hours?.urgent === 4, r.j);
  r = await call(tok, 'PUT', '/whatsapp/tickets/settings', {
    prefix: 'pm', categories: [
      { label: 'Iluminação pública', sla_hours: 72, default_priority: 'high', assignee_id: memberId },
      { label: 'Buraco na rua', default_priority: 'normal' },
      { label: 'Desativada', active: false },
    ], warn_before_minutes: 60, auto_close_days: 7,
  });
  ok('configuração salva: prefixo PM, categoria com responsável', r.s === 200 && r.j.prefix === 'PM' && r.j.categories[0].key === 'iluminacao-publica' && r.j.categories[0].assignee_id === memberId, r.j);
  r = await call(memberTok, 'PUT', '/whatsapp/tickets/settings', { prefix: 'X' });
  ok('membro não altera configurações → 403', r.s === 403, r.j);
  r = await call(tok, 'PUT', '/whatsapp/tickets/settings', { categories: [] });
  ok('lista de categorias vazia → 400', r.s === 400, r.j);

  // ---------------- cliente (conversa via mensagem real assinada)
  const st = await hook(sessionId, secret, 'message.received', { id: `TK-1-${stamp}`, from: `${PHONE}@c.us`, to: '5500999990401@c.us', chatId: `${PHONE}@c.us`, type: 'text', body: 'Oi, boa tarde', timestamp: Math.floor(Date.now() / 1000), contact: { pushName: 'Maria Moradora' } });
  await sleep(1500);
  const chatUuid = sql(`SELECT id FROM whatsapp_chats WHERE organization_id='${orgId}' AND chat_id='${PHONE}@c.us' LIMIT 1`);
  ok('conversa do cliente criada pelo webhook', st === 200 && chatUuid.length === 36, { st, chatUuid });

  // ---------------- criação pelo painel
  r = await call(tok, 'POST', '/whatsapp/tickets', { category: 'iluminacao-publica', description: 'Poste apagado na Rua 3, em frente ao número 120.\nJá faz uma semana.', chat_id: chatUuid });
  const T1 = r.j;
  const year = new Date(Date.now() - 3 * 3600_000).getUTCFullYear();
  ok('chamado criado: protocolo PM<ano>000001, assunto = 1ª linha, prioridade da categoria', r.s === 201 && T1.protocol === `PM${year}000001` && T1.subject.startsWith('Poste apagado') && T1.priority === 'high' && T1.status === 'open', r.j);
  ok('responsável da categoria atribuído (Ana)', T1.assigned_user_id === memberId && T1.assigned?.name === 'Atendente Ana', T1.assigned);
  ok('prazo = 72 h da categoria', Math.abs(+new Date(T1.sla_due_at) - +new Date(T1.created_at) - 72 * 3600_000) < 5000, { due: T1.sla_due_at, created: T1.created_at });
  ok('conversa e contato ligados ao chamado', T1.chat_id === chatUuid && T1.contact?.id, { chat: T1.chat_id, contact: T1.contact });
  ok('descrição CIFRADA no banco', sql(`SELECT LEFT(description, 6) FROM whatsapp_tickets WHERE id='${T1.id}'`) === 'wenc1:', sql(`SELECT LEFT(description, 6) FROM whatsapp_tickets WHERE id='${T1.id}'`));
  ok('descrição volta legível na API', (await call(tok, 'GET', `/whatsapp/tickets/${T1.id}`)).j.description?.includes('Rua 3'));
  ok('aviso "chamado aberto" na fila do cliente', outbox('ticket_created') === 1, outbox('ticket_created'));
  r = await call(tok, 'POST', '/whatsapp/tickets', { category: 'desativada', description: 'teste de categoria inativa' });
  ok('categoria desativada → 400 CATEGORY_INVALID', r.s === 400 && r.j?.code === 'CATEGORY_INVALID', r.j);
  r = await call(tok, 'POST', '/whatsapp/tickets', { category: 'buraco-na-rua', description: 'x' });
  ok('descrição curta → 400', r.s === 400, r.j);
  ok('notificação "atribuído a você" para a Ana', await waitFor(() => Number(sql(`SELECT COUNT(*) FROM notification_log WHERE organization_id='${orgId}' AND user_id='${memberId}' AND kind='ticket_assigned'`)) >= 1, 8000, 1000), sql(`SELECT kind FROM notification_log WHERE organization_id='${orgId}'`));

  // ---------------- API pública + 50 criações em paralelo (protocolo sem furo)
  r = await call(tok, 'POST', '/org/api-keys', { name: 'Sistema da prefeitura', scopes: ['tickets:read', 'tickets:write'] });
  apiKey = r.j?.key;
  ok('chave de API com escopos de chamados', r.s === 201 && /^pm_/.test(apiKey || ''), { s: r.s });
  const ro = (await call(tok, 'POST', '/org/api-keys', { name: 'Só clientes', scopes: ['customers:read'] })).j?.key;
  r = await call(null, 'GET', '/api/v1/whatsapp/tickets', null, { Authorization: 'Bearer ' + ro });
  ok('chave sem escopo de chamados → 403 SCOPE_MISSING', r.s === 403 && r.j?.code === 'SCOPE_MISSING', r.j);
  const many = await Promise.all(Array.from({ length: 50 }, (_, i) => call(null, 'POST', '/api/v1/whatsapp/tickets', { category: 'buraco-na-rua', description: `Buraco número ${i + 1} na avenida principal`, notify: false }, { Authorization: 'Bearer ' + apiKey })));
  const created = many.filter((x) => x.s === 201).map((x) => x.j);
  const nums = created.map((x) => x.number).sort((a, b) => a - b);
  ok('50 criações em paralelo: todas criadas', created.length === 50, many.filter((x) => x.s !== 201).slice(0, 3).map((x) => [x.s, x.j?.message]));
  ok('números 2..51 contíguos, sem furo e sem repetição', nums.length === 50 && nums.every((n, i) => n === i + 2), nums.slice(0, 5).concat(['…'], nums.slice(-5)));
  ok('protocolos únicos', new Set(created.map((x) => x.protocol)).size === 50);
  ok('contador da org = 51', sql(`SELECT value FROM whatsapp_counters WHERE organization_id='${orgId}' AND name='ticket:${year}'`) === '51');
  r = await call(null, 'GET', `/api/v1/whatsapp/tickets?q=${encodeURIComponent(created[0].protocol)}`, null, { Authorization: 'Bearer ' + apiKey });
  ok('API: busca pelo protocolo', r.s === 200 && r.j.total === 1 && r.j.items[0].id === created[0].id, r.j?.total);

  // ---------------- lista, filtros, contagens
  r = await call(tok, 'GET', '/whatsapp/tickets/counts');
  ok('contagens: 51 abertos, 1 da Ana, 50 sem responsável', r.s === 200 && r.j.open === 51 && r.j.unassigned === 50, r.j);
  r = await call(memberTok, 'GET', '/whatsapp/tickets?assigned=me');
  ok('"meus" para a Ana = 1', r.s === 200 && r.j.total === 1 && r.j.items[0].id === T1.id, r.j?.total);
  r = await call(tok, 'GET', `/whatsapp/tickets?q=${encodeURIComponent('Maria')}`);
  ok('busca pelo nome do contato', r.s === 200 && r.j.items.some((x) => x.id === T1.id), r.j?.total);
  r = await call(tok, 'GET', '/whatsapp/tickets?category=iluminacao-publica&priority=high');
  ok('filtro categoria + prioridade', r.s === 200 && r.j.total === 1, r.j?.total);
  r = await call(tok, 'GET', `/whatsapp/tickets/by-chat/${chatUuid}`);
  ok('chamados da conversa (painel do chat)', r.s === 200 && r.j.items.length === 1 && r.j.items[0].id === T1.id, r.j);

  // ---------------- acesso por número
  r = await call(blindTok, 'GET', `/whatsapp/tickets/${T1.id}`);
  ok('membro sem acesso ao número → 404 no chamado da conversa', r.s === 404, r.s);
  r = await call(blindTok, 'GET', '/whatsapp/tickets?status=active');
  ok('membro sem número vê só chamados sem número (os 50 da API)', r.s === 200 && r.j.total === 50 && !r.j.items.some((x) => x.id === T1.id), r.j?.total);

  // ---------------- alterações
  r = await call(tok, 'PATCH', `/whatsapp/tickets/${T1.id}`, { priority: 'urgent' });
  ok('prioridade urgente: prazo continua o da categoria (72 h sobrepõe)', r.s === 200 && r.j.priority === 'urgent' && Math.abs(+new Date(r.j.sla_due_at) - +new Date(T1.sla_due_at)) < 2000, r.j?.sla_due_at);
  const T2 = created[1];
  r = await call(tok, 'PATCH', `/whatsapp/tickets/${T2.id}`, { priority: 'urgent' });
  ok('sem SLA na categoria: urgente recalcula para 4 h', r.s === 200 && Math.abs(+new Date(r.j.sla_due_at) - +new Date(T2.created_at) - 4 * 3600_000) < 5000, r.j?.sla_due_at);
  r = await call(tok, 'POST', `/whatsapp/tickets/${T2.id}/assign`, { user_id: ownerId });
  ok('atribuir a si mesmo', (r.s === 200 || r.s === 201) && r.j.assigned_user_id === ownerId, r.j?.assigned_user_id);
  r = await call(tok, 'POST', `/whatsapp/tickets/${T2.id}/assign`, { user_id: SA[0] });
  ok('responsável de outra org → 400', r.s === 400, r.j);
  r = await call(tok, 'POST', `/whatsapp/tickets/${T1.id}/comments`, { body: 'Equipe vai verificar o poste amanhã.', visibility: 'internal' });
  ok('nota interna: não vai ao cliente', r.s === 201 && outbox('ticket_comment') === 0, { s: r.s, n: outbox('ticket_comment') });
  r = await call(tok, 'POST', `/whatsapp/tickets/${T1.id}/comments`, { body: 'Pode confirmar o número exato da casa?', visibility: 'public', status: 'pending' });
  ok('resposta pública + aguardar cliente: status pending, texto "pending" na fila', r.s === 201 && r.j.ticket.status === 'pending' && outbox('ticket_pending') === 1, { s: r.s, st: r.j?.ticket?.status, n: outbox('ticket_pending') });
  ok('1ª resposta registrada', Boolean((await call(tok, 'GET', `/whatsapp/tickets/${T1.id}`)).j.first_response_at));
  ok('corpo do comentário CIFRADO no banco', sql(`SELECT LEFT(body, 6) FROM whatsapp_ticket_events WHERE ticket_id='${T1.id}' AND kind='comment' AND visibility='public' LIMIT 1`) === 'wenc1:');

  // ---------------- cliente responde (mensagem solta)
  await hook(sessionId, secret, 'message.received', { id: `TK-2-${stamp}`, from: `${PHONE}@c.us`, to: '5500999990401@c.us', chatId: `${PHONE}@c.us`, type: 'text', body: 'É o número 120, casa azul.', timestamp: Math.floor(Date.now() / 1000), contact: { pushName: 'Maria Moradora' } });
  const back = await waitFor(async () => (await call(tok, 'GET', `/whatsapp/tickets/${T1.id}`)).j.status === 'open', 10_000, 1000);
  ok('cliente respondeu: aguardando cliente → aberto', back, (await call(tok, 'GET', `/whatsapp/tickets/${T1.id}`)).j.status);
  r = await call(tok, 'GET', `/whatsapp/tickets/${T1.id}/events`);
  ok('linha do tempo com a mensagem do cliente', r.s === 200 && r.j.some((e) => e.kind === 'customer_message' && e.body === 'É o número 120, casa azul.'), r.j?.map((e) => e.kind));

  // ---------------- resolver, agradecimento não reabre, reclamação reabre
  r = await call(tok, 'PATCH', `/whatsapp/tickets/${T1.id}`, { status: 'resolved' });
  ok('resolvido: texto "resolvido" na fila', r.s === 200 && r.j.status === 'resolved' && r.j.resolved_at && outbox('ticket_resolved') === 1, { st: r.j?.status, n: outbox('ticket_resolved') });
  await hook(sessionId, secret, 'message.received', { id: `TK-3-${stamp}`, from: `${PHONE}@c.us`, to: '5500999990401@c.us', chatId: `${PHONE}@c.us`, type: 'text', body: 'Obrigada!', timestamp: Math.floor(Date.now() / 1000) });
  await sleep(2500);
  ok('"Obrigada!" não reabre', (await call(tok, 'GET', `/whatsapp/tickets/${T1.id}`)).j.status === 'resolved');
  await hook(sessionId, secret, 'message.received', { id: `TK-4-${stamp}`, from: `${PHONE}@c.us`, to: '5500999990401@c.us', chatId: `${PHONE}@c.us`, type: 'text', body: 'Apagou de novo hoje à noite', timestamp: Math.floor(Date.now() / 1000) });
  const reo = await waitFor(async () => { const t = (await call(tok, 'GET', `/whatsapp/tickets/${T1.id}`)).j; return t.status === 'open' && t.reopen_count === 1 ? t : null; }, 10_000, 1000);
  ok('reclamação reabre (reopen_count 1) e avisa o cliente', Boolean(reo) && outbox('ticket_reopened') === 1, { n: outbox('ticket_reopened') });

  // ---------------- SLA (runner a cada minuto, :50)
  const T3 = created[2], T4 = created[3], T5 = created[4];
  sql(`UPDATE whatsapp_tickets SET sla_due_at = DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 30 MINUTE) WHERE id='${T3.id}'`);
  sql(`UPDATE whatsapp_tickets SET sla_due_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 5 MINUTE) WHERE id='${T4.id}'`);
  await call(tok, 'PATCH', `/whatsapp/tickets/${T5.id}`, { status: 'resolved', notify: false });
  sql(`UPDATE whatsapp_tickets SET resolved_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 8 DAY) WHERE id='${T5.id}'`);
  const slaDone = await waitFor(() => sql(`SELECT CONCAT(IF(t3.sla_warned_at IS NULL,0,1), IF(t4.sla_breached_at IS NULL,0,1), IF(t5.status='closed',1,0)) FROM whatsapp_tickets t3, whatsapp_tickets t4, whatsapp_tickets t5 WHERE t3.id='${T3.id}' AND t4.id='${T4.id}' AND t5.id='${T5.id}'`) === '111', 80_000, 3000);
  ok('runner: aviso de prazo, prazo estourado e encerramento automático', slaDone, sql(`SELECT CONCAT(IFNULL(t3.sla_warned_at,'-'),' | ',IFNULL(t4.sla_breached_at,'-'),' | ',t5.status) FROM whatsapp_tickets t3, whatsapp_tickets t4, whatsapp_tickets t5 WHERE t3.id='${T3.id}' AND t4.id='${T4.id}' AND t5.id='${T5.id}'`));
  ok('eventos sla_warning e sla_breached gravados', sql(`SELECT COUNT(*) FROM whatsapp_ticket_events WHERE ticket_id IN ('${T3.id}','${T4.id}') AND kind IN ('sla_warning','sla_breached')`) === '2');
  ok('notificação de prazo (ticket_sla) para a equipe', Number(sql(`SELECT COUNT(*) FROM notification_log WHERE organization_id='${orgId}' AND kind='ticket_sla'`)) >= 2, sql(`SELECT COUNT(*) FROM notification_log WHERE organization_id='${orgId}' AND kind='ticket_sla'`));
  await sleep(65_000);
  ok('aviso de prazo não repete na rodada seguinte', sql(`SELECT COUNT(*) FROM whatsapp_ticket_events WHERE ticket_id IN ('${T3.id}','${T4.id}') AND kind IN ('sla_warning','sla_breached')`) === '2');
  r = await call(tok, 'GET', '/whatsapp/tickets?sla=overdue');
  ok('filtro "vencidos" acha o chamado estourado', r.s === 200 && r.j.items.some((x) => x.id === T4.id && x.sla_state === 'overdue'), r.j?.total);

  // ---------------- API: alterar e comentar
  r = await call(null, 'PATCH', `/api/v1/whatsapp/tickets/${T2.id}`, { status: 'pending' }, { Authorization: 'Bearer ' + apiKey });
  ok('API: mudar status', r.s === 200 && r.j.status === 'pending', r.j?.status);
  r = await call(null, 'POST', `/api/v1/whatsapp/tickets/${T2.id}/comments`, { body: 'Comentário do sistema externo', visibility: 'internal' }, { Authorization: 'Bearer ' + apiKey });
  ok('API: comentário interno', r.s === 201, r.j);
  r = await call(tok, 'PATCH', `/whatsapp/tickets/${T5.id}`, { status: 'open' });
  ok('reabrir encerrado pelo painel: prazo novo a partir de agora', r.s === 200 && r.j.status === 'open' && r.j.reopen_count === 1 && +new Date(r.j.sla_due_at) > Date.now(), { st: r.j?.status, due: r.j?.sla_due_at });
} catch (e) {
  fails++; console.log('ERRO', e?.stack || e);
} finally {
  if (orgId) {
    sql(`UPDATE whatsapp_sessions SET status='none', openwa_session_id=NULL, paired_at=NULL WHERE organization_id='${orgId}'`);
    sql(`DELETE FROM whatsapp_outbox WHERE organization_id='${orgId}'`);
    const r = await call(saTok, 'DELETE', `/admin/organizations/${orgId}`);
    const left = ['whatsapp_tickets', 'whatsapp_ticket_events', 'whatsapp_counters', 'notification_log'].map((t) => `${t}=${sql(`SELECT COUNT(*) FROM ${t} WHERE organization_id='${orgId}'`)}`);
    ok('org apagada: tabelas de chamados limpas', (r.s === 200 || r.s === 204) && left.every((x) => x.endsWith('=0')), left);
  }
  console.log(`\n${total - fails}/${total} passaram${fails ? ` — ${fails} FALHAS` : ''}`);
  process.exit(fails ? 1 : 0);
}
