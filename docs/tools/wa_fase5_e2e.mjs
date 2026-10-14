// E2E da Fase 5 (direito de acesso, API pública, webhooks de saída) — roda NO SERVIDOR (127.0.0.1:8000):
//   scp docs/tools/wa_fase5_e2e.mjs pubmail-hostinger:/opt/pub-mail/back/wa_f5_e2e.tmp.mjs
//   ssh pubmail-hostinger 'cd /opt/pub-mail/back && node wa_f5_e2e.tmp.mjs; rm -f wa_f5_e2e.tmp.mjs'
// Org temporária (apagada no fim). Receptor de webhook local em 127.0.0.1:18999 (a única porta liberada por
// `ORG_WEBHOOK_ALLOW_LOCAL_PORTS`); a assinatura HMAC de toda entrega é conferida. Números falsos 5500999990xx.
// Sem grupo real (precisa do OK do Júlio): o caminho do grupo é exercitado com número falso (fica esperando conexão).
import { execFileSync } from 'node:child_process';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';

const API = 'http://127.0.0.1:8000';
const env = Object.fromEntries(readFileSync('/opt/pub-mail/back/.env', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const DB_PASS = readFileSync('/root/pubmail.secrets', 'utf8').split('\n').find((l) => l.startsWith('DB_PASS='))?.slice(8).trim();
const sql = (q) => execFileSync('mysql', ['-upubmail', `-p${DB_PASS}`, '-h127.0.0.1', '-N', '-e', q, 'pubmail'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
const sign = (u) => jwt.sign({ sub: u.id, org: u.org, role: u.role }, env.JWT_ACCESS_SECRET, { expiresIn: '30m' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0, total = 0;
const ok = (l, c, x) => { total++; if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + l + (c || x === undefined ? '' : '  → ' + JSON.stringify(x).slice(0, 500))); };
const call = async (tok, m, p, b, h = {}) => { const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...h }, body: b ? JSON.stringify(b) : undefined }); let j = null; const t = await r.text(); try { j = JSON.parse(t); } catch { j = t; } return { s: r.status, j, h: r.headers }; };
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const addDays = (s, n) => new Date(new Date(`${s}T12:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);

// ---- receptor de webhooks (assinatura conferida em cada entrega)
const got = [];
let secret = '';
let failNext = 0; // responde 500 para as próximas N entregas
const server = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const ts = String(req.headers['x-pubmail-timestamp'] || '');
    const sig = String(req.headers['x-pubmail-signature'] || '');
    const want = 'sha256=' + createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
    const valid = sig.length === want.length && timingSafeEqual(Buffer.from(sig), Buffer.from(want));
    let j = null; try { j = JSON.parse(body); } catch {}
    got.push({ event: String(req.headers['x-pubmail-event'] || ''), delivery: String(req.headers['x-pubmail-delivery'] || ''), valid, body: j });
    if (failNext > 0) { failNext--; res.writeHead(500); res.end('erro de teste'); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
  });
});
await new Promise((r) => server.listen(18999, '127.0.0.1', r));
const waitEvent = async (event, pred = () => true, ms = 25_000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const e = got.find((x) => x.event === event && pred(x)); if (e) return e; await sleep(500); } return null; };

const SA = sql(`SELECT CONCAT(u.id,'|',u.organization_id) FROM users u WHERE u.email='superadmin@pubmail.com' LIMIT 1`).split('|');
const saTok = sign({ id: SA[0], org: SA[1], role: 'SUPER_ADMIN' });
const stamp = Date.now().toString(36);
let orgId, tok, memberTok, sessionId;
try {
  let r = await call(saTok, 'POST', '/admin/clients', { name: 'F5 Owner', email: `f5-${stamp}@teste.local`, password: 'Senha!Teste123', org_name: `E2E Fase5 ${stamp}`, modules: ['whatsapp', 'settings'], price_cents: 0 });
  orgId = r.j?.organization?.id; const ownerId = r.j?.user?.id;
  ok('org temporária criada', r.s === 201 && orgId, r.j);
  tok = sign({ id: ownerId, org: orgId, role: 'OWNER' });
  memberTok = sign({ id: ownerId, org: orgId, role: 'MEMBER' });

  // ================================================================ chaves de API
  r = await call(memberTok, 'POST', '/org/api-keys', { name: 'membro' });
  ok('membro não cria chave (403)', r.s === 403, r.j);
  r = await call(tok, 'POST', '/org/api-keys', { name: 'Só leitura' });
  const keyRead = r.j?.key;
  ok('chave criada (padrão = só leitura), devolvida inteira UMA vez', r.s === 201 && /^pm_[A-Za-z0-9]{8}_[A-Za-z0-9]{32}$/.test(keyRead || '') && (r.j.scopes || []).every((s) => s.endsWith(':read')), { s: r.s, scopes: r.j?.scopes });
  r = await call(tok, 'GET', '/org/api-keys');
  ok('lista sem a chave nem o hash', r.s === 200 && Array.isArray(r.j) && r.j.length === 1 && !JSON.stringify(r.j).includes(keyRead) && !JSON.stringify(r.j).includes('key_hash'), r.j);
  ok('banco guarda só o sha256', sql(`SELECT COUNT(*) FROM org_api_keys WHERE organization_id='${orgId}' AND key_hash=SHA2('${keyRead}',256)`) === '1');
  r = await call(null, 'GET', '/api/v1/whatsapp/products');
  ok('API sem chave → 401', r.s === 401);
  r = await call(null, 'GET', '/api/v1/whatsapp/products', null, { Authorization: 'Bearer pm_xxxxxxxx_' + 'y'.repeat(32) });
  ok('chave inexistente → 401', r.s === 401);
  r = await call(keyRead, 'GET', '/api/v1/whatsapp/products');
  ok('GET products com chave de leitura → 200 + cabeçalho de limite', r.s === 200 && r.h.get('x-ratelimit-limit') === '600', { s: r.s, j: r.j });
  r = await call(keyRead, 'POST', '/api/v1/whatsapp/customers', { name: 'X', phone: '5500999990150' });
  ok('escrever com chave só de leitura → 403 SCOPE_MISSING', r.s === 403 && r.j?.code === 'SCOPE_MISSING', r.j);
  r = await call(tok, 'POST', '/org/api-keys', { name: 'Integração', scopes: ['customers:read', 'customers:write', 'subscriptions:read', 'subscriptions:write', 'charges:read', 'charges:write', 'messages:send', 'contacts:write', 'entitlements:read', 'products:read'] });
  const key = r.j?.key;
  ok('chave com escrita criada', r.s === 201 && key, r.j);
  r = await call(tok, 'POST', '/org/api-keys', { name: 'escopo inválido', scopes: ['tudo:liberado'] });
  ok('escopo desconhecido → 400', r.s === 400, r.j);

  // ================================================================ webhook
  r = await call(tok, 'POST', '/org/webhooks', { name: 'http externo', url: 'http://example.com/hook', events: ['*'] });
  ok('webhook http (sem TLS) → 400', r.s === 400, r.j);
  r = await call(tok, 'POST', '/org/webhooks', { name: 'IP privado', url: 'https://10.0.0.5/hook', events: ['*'] });
  ok('webhook para IP privado → 400', r.s === 400, r.j);
  r = await call(tok, 'POST', '/org/webhooks', { name: 'Sistema do cliente', url: 'http://127.0.0.1:18999/hook', events: ['*', 'message.received'] });
  const hookId = r.j?.id; secret = r.j?.secret || '';
  ok('webhook local de teste criado; segredo whsec_ devolvido uma vez', r.s === 201 && hookId && /^whsec_[A-Za-z0-9]{32}$/.test(secret), { s: r.s, j: r.j?.message });
  r = await call(tok, 'GET', '/org/webhooks');
  ok('lista mostra o segredo só mascarado; segredo cifrado no banco', r.s === 200 && r.j[0]?.secret_masked && !JSON.stringify(r.j).includes(secret) && sql(`SELECT LEFT(secret,6) FROM org_webhooks WHERE id='${hookId}'`) === 'wenc1:', r.j?.[0]);
  r = await call(tok, 'POST', `/org/webhooks/${hookId}/test`);
  const ping = await waitEvent('ping', () => true, 5000);
  ok('Testar → ping entregue (200) com assinatura válida', r.s === 201 && r.j?.ok && r.j.status === 200 && ping?.valid, { r: r.j, ping: ping && { valid: ping.valid } });

  // ================================================================ clientes + eventos
  r = await call(key, 'POST', '/api/v1/whatsapp/customers', { name: 'Cliente API', phone: '5500999990151', email: `api-${stamp}@exemplo.com` });
  const C = r.j?.id;
  ok('POST customers pela API → 201', r.s === 201 && C, r.j);
  let ev = await waitEvent('customer.created', (x) => x.body?.data?.id === C);
  ok('webhook customer.created entregue, assinado, com id de entrega no corpo', ev?.valid && ev.body?.id === ev.delivery && ev.body?.organization_id === orgId, ev && { valid: ev.valid });
  r = await call(key, 'GET', '/api/v1/whatsapp/customers?phone=5500999990151');
  ok('GET customers?phone acha o cliente', r.s === 200 && (r.j.items || r.j).some?.((c) => c.id === C), r.j);
  r = await call(key, 'PUT', `/api/v1/whatsapp/customers/${C}`, { email: `novo-${stamp}@exemplo.com` });
  ev = await waitEvent('customer.updated', (x) => x.body?.data?.id === C);
  ok('PUT customers → webhook customer.updated', r.s === 200 && ev?.valid, { s: r.s, j: r.j?.message });

  // ================================================================ produto com acessos + assinatura
  r = await call(tok, 'POST', '/whatsapp/tags', { name: `VIP ${stamp}`, color: '#7C3AED' });
  const tagId = r.j?.id;
  r = await call(tok, 'POST', '/whatsapp/products', { name: 'Clube VIP', price_cents: 4990, billing: 'monthly', entitlement: { rules: [
    { kind: 'external', ref: 'area-vip', label: 'Área VIP do site', on_overdue: 'suspend', suspend_after_days: 3, on_cancel: 'revoke' },
    { kind: 'tag', ref: tagId, label: 'Etiqueta VIP', on_overdue: 'keep', on_cancel: 'revoke' },
  ] } });
  const P = r.j?.id;
  ok('produto com 2 regras de acesso (externa + etiqueta)', r.s === 201 && r.j?.entitlement?.rules?.length === 2 && r.j.entitlement.rules.every((x) => /^[a-z0-9]{8}$/.test(x.id)), r.j?.entitlement || r.j);
  r = await call(tok, 'POST', '/whatsapp/products', { name: 'Regra ruim', price_cents: 100, billing: 'monthly', entitlement: { rules: [{ kind: 'group_member', ref: 'naoehgrupo', label: 'x' }] } });
  ok('regra de grupo sem número/jid válido → 400', r.s === 400, r.j);
  r = await call(key, 'GET', '/api/v1/whatsapp/products');
  ok('GET products pela API lista o produto', r.s === 200 && (r.j.items || []).some((p) => p.id === P), r.j);
  r = await call(key, 'POST', `/api/v1/whatsapp/customers/${C}/subscriptions`, { product_id: P, due_day: 10 });
  const S = r.j?.subscription?.id || r.j?.id;
  ok('POST subscriptions pela API → 201 (sem cobrar)', r.s === 201 && S && sql(`SELECT COUNT(*) FROM whatsapp_charges WHERE subscription_id='${S}'`) === '0', r.j);
  ev = await waitEvent('subscription.created', (x) => x.body?.data?.id === S);
  ok('webhook subscription.created com o cliente junto', ev?.valid && ev.body?.data?.customer?.id === C, ev?.body?.data && Object.keys(ev.body.data));
  // acessos ativam (externo sem ação; etiqueta sem conversa ainda = ativo com nota)
  const waitStatus = async (want, ms = 40_000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const rows = sql(`SELECT GROUP_CONCAT(CONCAT(kind,':',status) ORDER BY kind) FROM whatsapp_entitlements WHERE subscription_id='${S}'`); if (rows === want) return rows; await sleep(1500); } return sql(`SELECT GROUP_CONCAT(CONCAT(kind,':',status,':',IFNULL(error,'')) ORDER BY kind) FROM whatsapp_entitlements WHERE subscription_id='${S}'`); };
  let st = await waitStatus('external:active,tag:active');
  ok('acessos liberados: externo e etiqueta ativos', st === 'external:active,tag:active', st);
  ev = await waitEvent('entitlement.activated', (x) => x.body?.data?.kind === 'external' && x.body?.data?.subscription_id === S);
  ok('webhook entitlement.activated (externo) com from/to', ev?.valid && ev.body.data.to === 'active' && ev.body.data.ref === 'area-vip', ev?.body?.data);
  r = await call(key, 'GET', `/api/v1/whatsapp/entitlements?customer_id=${C}`);
  ok('GET entitlements pela API', r.s === 200 && (r.j.items || r.j).length === 2, r.j);
  r = await call(tok, 'GET', `/whatsapp/entitlements?customer_id=${C}`);
  ok('GET /whatsapp/entitlements no painel (counts por status)', r.s === 200 && r.j.items?.length === 2 && r.j.counts?.active === 2, r.j?.counts);

  // ---- atraso: externo suspende depois de 3 dias; etiqueta "manter"
  sql(`UPDATE whatsapp_subscriptions SET status='overdue', next_due_at='${addDays(today, -4)}' WHERE id='${S}'`);
  r = await call(tok, 'POST', '/whatsapp/entitlements/sync', { subscription_id: S });
  st = await waitStatus('external:suspended,tag:active');
  ok('4 dias de atraso: externo SUSPENSO (regra 3 dias), etiqueta mantida (regra manter)', r.s === 201 && st === 'external:suspended,tag:active', { s: r.s, st });
  ev = await waitEvent('entitlement.suspended', (x) => x.body?.data?.subscription_id === S);
  ok('webhook entitlement.suspended', ev?.valid && ev.body.data.from === 'active', ev?.body?.data);
  sql(`UPDATE whatsapp_subscriptions SET status='overdue', next_due_at='${addDays(today, -1)}' WHERE id='${S}'`);
  await call(tok, 'POST', '/whatsapp/entitlements/sync', { subscription_id: S });
  st = await waitStatus('external:active,tag:active');
  ok('atraso volta a 1 dia (menos que 3) → reativa', st === 'external:active,tag:active', st);

  // ---- cancelamento imediato pela API: revoga tudo
  r = await call(key, 'POST', `/api/v1/whatsapp/subscriptions/${S}/cancel`, { policy: 'immediate', reason: 'Teste da API' });
  ok('cancelar pela API → 201', r.s === 201, r.j);
  st = await waitStatus('external:revoked,tag:revoked');
  ok('cancelada: acessos REVOGADOS', st === 'external:revoked,tag:revoked', st);
  ev = await waitEvent('subscription.canceled', (x) => x.body?.data?.id === S);
  const evr = await waitEvent('entitlement.revoked', (x) => x.body?.data?.subscription_id === S);
  ok('webhooks subscription.canceled + entitlement.revoked', ev?.valid && evr?.valid, { canceled: Boolean(ev), revoked: Boolean(evr) });

  // ---- regra de grupo com número falso: espera conexão sem contar tentativa
  r = await call(tok, 'POST', '/whatsapp/sessions', { label: 'F5 fake' });
  sessionId = r.j?.id;
  r = await call(tok, 'POST', '/whatsapp/products', { name: 'Grupo VIP', price_cents: 2990, billing: 'monthly', entitlement: { rules: [{ kind: 'group_member', session_id: sessionId, ref: '120363000000000001@g.us', label: 'Grupo VIP' }] } });
  const PG = r.j?.id;
  ok('produto com regra de grupo (número da org)', r.s === 201 && PG, r.j);
  r = await call(key, 'POST', `/api/v1/whatsapp/customers/${C}/subscriptions`, { product_id: PG, due_day: 10 });
  const SG = r.j?.subscription?.id || r.j?.id;
  await sleep(6000);
  const g = sql(`SELECT CONCAT(status,'|',desired,'|',attempts,'|',IFNULL(error,''),'|',target) FROM whatsapp_entitlements WHERE subscription_id='${SG}'`).split('|');
  ok('grupo com número desconectado: pendente, sem contar tentativa, alvo = telefone do cliente', g[0] === 'pending' && g[1] === 'active' && g[2] === '0' && /desconect|conect/i.test(g[3]) && g[4] === '5500999990151@c.us', g);
  r = await call(tok, 'GET', `/whatsapp/groups/120363000000000001@g.us/admin-check?session_id=${sessionId}`);
  ok('admin-check com número desconectado → 400 claro', r.s === 400, r.j);

  // ================================================================ mensagens pela API
  r = await call(key, 'POST', '/api/v1/whatsapp/messages', { to: '5500999990152', text: 'Olá pela API' });
  ok('mensagem sem número conectado → 409 NO_SESSION', r.s === 409 && r.j?.code === 'NO_SESSION', r.j);
  sql(`UPDATE whatsapp_sessions SET status='ready', openwa_session_id='f5-fake-${stamp}', engine='baileys', paired_at=NOW(3) WHERE id='${sessionId}'`);
  await sleep(16_000); // a lista de números conectados da fila fica em cache 15 s
  r = await call(key, 'POST', '/api/v1/whatsapp/messages', { to: '5500999990152', text: 'Olá pela API', idempotency_key: 'pedido-1' });
  const M1 = r.j?.id;
  ok('mensagem → fila (queued) pelo número', (r.s === 201 || r.s === 200) && M1 && ['queued', 'sending', 'sent', 'failed'].includes(r.j.status) && r.j.session_id === sessionId, r.j);
  r = await call(key, 'POST', '/api/v1/whatsapp/messages', { to: '5500999990152', text: 'Olá pela API', idempotency_key: 'pedido-1' });
  ok('mesma idempotency_key → mesma mensagem (sem duplicar)', r.j?.id === M1 && sql(`SELECT COUNT(*) FROM whatsapp_outbox WHERE organization_id='${orgId}' AND kind='api_message'`) === '1', r.j);
  r = await call(key, 'POST', '/api/v1/whatsapp/contacts/opt-out', { phone: '5500999990152', opted_out: true });
  ok('opt-out pela API', r.s === 201 || r.s === 200, r.j);
  r = await call(key, 'POST', '/api/v1/whatsapp/messages', { to: '5500999990152', text: 'Depois do opt-out' });
  ok('contato descadastrado → 409 OPTED_OUT', r.s === 409 && r.j?.code === 'OPTED_OUT', r.j);
  sql(`UPDATE whatsapp_outbox SET status='canceled' WHERE organization_id='${orgId}'`);

  // ================================================================ cobranças pela API (sem gateway → 400 claro)
  r = await call(key, 'POST', '/api/v1/whatsapp/charges', { customer_id: C, amount_cents: 1500, description: 'Teste API', kind: 'pix', send: false });
  ok('cobrança pela API sem gateway → 400 claro', r.s === 400 && /gateway/i.test(String(r.j?.message)), r.j);
  r = await call(key, 'POST', '/api/v1/whatsapp/charges', { customer_id: C, amount_cents: 1500, payment_method_id: 'x' });
  ok('API não aceita payment_method_id (cartão salvo) → 400', r.s === 400, r.j);
  r = await call(key, 'GET', `/api/v1/whatsapp/charges?customer_id=${C}`);
  ok('GET charges pela API', r.s === 200, r.j);

  // ================================================================ entrega com falha → nova tentativa
  failNext = 1;
  r = await call(key, 'PUT', `/api/v1/whatsapp/customers/${C}`, { name: 'Cliente API 2' });
  await sleep(4000);
  const d = sql(`SELECT CONCAT(id,'|',status,'|',attempts,'|',IFNULL(last_status,''),'|',next_try_at>NOW(3)) FROM org_webhook_deliveries WHERE webhook_id='${hookId}' AND event='customer.updated' ORDER BY created_at DESC LIMIT 1`).split('|');
  ok('receptor responde 500 → entrega pendente, tentativa 1, próxima no futuro', d[1] === 'pending' && d[2] === '1' && d[3] === '500' && d[4] === '1', d);
  sql(`UPDATE org_webhook_deliveries SET next_try_at=NOW(3) - INTERVAL 1 SECOND WHERE id='${d[0]}'`);
  await sleep(8000);
  ok('nova tentativa entregue (200)', sql(`SELECT CONCAT(status,'|',attempts) FROM org_webhook_deliveries WHERE id='${d[0]}'`) === 'delivered|2');
  r = await call(tok, 'GET', `/org/webhooks/${hookId}/deliveries?page=1`);
  ok('lista de entregas sem payload', r.s === 200 && r.j.items?.length > 3 && !('payload' in (r.j.items[0] || {})), r.j?.items?.[0]);
  r = await call(tok, 'GET', `/org/webhooks/deliveries/${d[0]}`);
  ok('detalhe da entrega com payload (cifrado no banco)', r.s === 200 && r.j.payload?.event === 'customer.updated' && sql(`SELECT LEFT(payload,6) FROM org_webhook_deliveries WHERE id='${d[0]}'`) === 'wenc1:', { s: r.s, ev: r.j?.payload?.event });
  r = await call(tok, 'POST', `/org/webhooks/deliveries/${d[0]}/retry`);
  ok('reenviar uma entrega manualmente', r.s === 201, r.j);
  ok('TODAS as entregas recebidas tinham assinatura válida', got.length > 5 && got.every((x) => x.valid), { n: got.length, invalid: got.filter((x) => !x.valid).map((x) => x.event) });

  // ================================================================ limite por chave e revogação
  const many = await Promise.all(Array.from({ length: 620 }, () => call(keyRead, 'GET', '/api/v1/whatsapp/products')));
  ok('620 chamadas no minuto → 429 a partir da 601ª', many.filter((x) => x.s === 429).length >= 15 && many.filter((x) => x.s === 200).length <= 600, { ok: many.filter((x) => x.s === 200).length, limited: many.filter((x) => x.s === 429).length });
  const keyId = sql(`SELECT id FROM org_api_keys WHERE organization_id='${orgId}' AND name='Integração'`);
  r = await call(tok, 'DELETE', `/org/api-keys/${keyId}`);
  await sleep(500);
  const after = await call(key, 'GET', '/api/v1/whatsapp/products');
  ok('chave revogada → 401 na hora', r.s === 200 && after.s === 401, { del: r.s, after: after.s });
} catch (e) {
  fails++; console.log('ERRO', e?.stack || e);
} finally {
  server.close();
  if (orgId) {
    sql(`UPDATE whatsapp_sessions SET status='none', openwa_session_id=NULL, paired_at=NULL WHERE organization_id='${orgId}'`);
    sql(`DELETE FROM whatsapp_outbox WHERE organization_id='${orgId}'`);
    const r = await call(saTok, 'DELETE', `/admin/organizations/${orgId}`);
    const left = ['whatsapp_entitlements', 'org_api_keys', 'org_webhooks', 'org_webhook_deliveries'].map((t) => `${t}=${sql(`SELECT COUNT(*) FROM ${t} WHERE organization_id='${orgId}'`)}`);
    ok('org apagada: chaves, webhooks, entregas e acessos removidos', (r.s === 200 || r.s === 204) && left.every((x) => x.endsWith('=0')), left);
  }
  console.log(`\n${total - fails}/${total} passaram${fails ? ` — ${fails} FALHAS` : ''}`);
  process.exit(fails ? 1 : 0);
}
