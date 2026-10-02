// E2E da licença do plugin no Pub Mail (produção) — conta temporária criada e apagada pelo superadmin.
// Uso: SA_EMAIL=... SA_PASS=... node wp_lic_api.mjs <passo>   (segredos nunca são impressos)
import fs from 'node:fs';
const API = 'https://api.reveleonline.com';
const S = new URL('.', import.meta.url).pathname;
const STATE = S + 'wp_lic_state.json';
const st = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {};
const save = () => { fs.writeFileSync(STATE, JSON.stringify(st)); fs.chmodSync(STATE, 0o600); };
async function call(method, path, body, token, raw) {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (raw) return r;
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, json: j, text: t };
}
const login = async (email, password) => {
  st.tok = st.tok || {};
  const c = st.tok[email];
  if (c && c.exp > Date.now()) return c.t; // reaproveita (o login tem limite de 10/min)
  const t = ((await call('POST', '/auth/login', { email, password })).json?.tokens || {}).accessToken;
  if (t) { st.tok[email] = { t, exp: Date.now() + 20 * 3600 * 1000 }; save(); }
  return t;
};
let fails = 0, total = 0;
const ok = (l, c, x) => { total++; if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + l + (c || x === undefined ? '' : '  → ' + JSON.stringify(x).slice(0, 600))); };
const step = process.argv[2];
const sa = async () => login(process.env.SA_EMAIL, process.env.SA_PASS);

if (step === 'create') {
  const t = await sa(); ok('superadmin loga', !!t);
  st.email = `wp-e2e-${Date.now()}@example.com`; st.pass = 'Wp' + Math.random().toString(36).slice(2, 12) + '!9';
  const r = await call('POST', '/admin/clients', { name: 'Teste Plugin WP', email: st.email, password: st.pass, org_name: 'Teste Plugin WP (temporária)', modules: ['wordpress'], price_cents: 990, period_days: 30 }, t);
  st.org = r.json?.organization?.id; st.user = r.json?.user?.id; save();
  ok('cliente temporário criado com o módulo WordPress', r.status < 300 && !!st.org, [r.status, r.json?.message]);
  const p = await call('POST', `/admin/billing/subscriptions/${st.org}/mark-paid`, null, t);
  ok('marcado como pago (ACTIVE, 30 dias)', p.status < 300, [p.status, p.json?.message]);
}
if (step === 'info') {
  const t = await login(st.email, st.pass); ok('cliente loga', !!t);
  const r = await call('GET', '/wordpress/translator', null, t);
  const d = r.json || {};
  ok('GET /wordpress/translator: chave criada, acesso ativo com data de fim, versão do plugin', r.status === 200 && /^trinv_/.test(d.license?.prefix || '') && d.access?.active === true && !!d.access?.until && d.plugin?.version === '1.2.0', { status: r.status, license: d.license, access: d.access, plugin: d.plugin });
  st.prefix = d.license?.prefix; save();
  const z = await call('GET', '/wordpress/translator/download', null, t, true);
  const buf = Buffer.from(await z.arrayBuffer());
  fs.writeFileSync(S + 'tradutor-invisivel-pubmail.zip', buf);
  ok('download do plugin (.zip) vinculado à conta', z.status === 200 && /zip/.test(z.headers.get('content-type') || '') && buf.length > 20000, [z.status, z.headers.get('content-type'), buf.length]);
  const noauth = await call('GET', '/wordpress/translator/download');
  ok('download sem login é recusado', noauth.status === 401, noauth.status);
  const t2 = await sa();
  const other = await call('GET', '/wordpress/translator', null, t2);
  ok('outra conta (superadmin) tem outra chave', other.status === 200 && other.json?.license?.prefix && other.json.license.prefix !== st.prefix, other.json?.license);
}
if (step === 'expire' || step === 'renew' || step === 'block' || step === 'unblock') {
  const t = await sa();
  if (step === 'renew') { const r = await call('POST', `/admin/billing/subscriptions/${st.org}/mark-paid`, null, t); ok('renovado (marcar pago)', r.status < 300, r.status); }
  if (step === 'block') { const r = await call('POST', `/admin/billing/subscriptions/${st.org}/block`, null, t); ok('conta bloqueada', r.status < 300, r.status); }
  if (step === 'unblock') { const r = await call('POST', `/admin/billing/subscriptions/${st.org}/unblock`, null, t); ok('conta desbloqueada', r.status < 300, r.status); }
}
if (step === 'nomodule' || step === 'module') {
  const t = await sa();
  const r = await call('PATCH', `/admin/users/${st.user}`, { modules: step === 'module' ? ['wordpress'] : [] }, t);
  ok(step === 'module' ? 'módulo WordPress devolvido' : 'módulo WordPress retirado do usuário', r.status < 300, [r.status, r.json?.message]);
}
if (step === 'rotate') {
  const t = await login(st.email, st.pass);
  const r = await call('POST', '/wordpress/translator/rotate', null, t);
  ok('nova chave gerada', r.status < 300 && r.json?.license?.prefix && r.json.license.prefix !== st.prefix, [r.status, r.json?.license]);
  st.prefix = r.json?.license?.prefix; save();
  const z = await call('GET', '/wordpress/translator/download', null, t, true);
  fs.writeFileSync(S + 'tradutor-invisivel-pubmail.zip', Buffer.from(await z.arrayBuffer()));
  ok('plugin novo baixado', z.status === 200, z.status);
}
if (step === 'sites') {
  const t = await login(st.email, st.pass);
  const r = await call('GET', '/wordpress/translator', null, t);
  console.log(JSON.stringify(r.json?.sites?.map((s) => ({ host: s.host, v: s.plugin_version, active: s.active, old_key: s.old_key, checks: s.checks }))));
}
if (step === 'public') {
  const bad = await call('POST', '/public/wp-plugin/check', { key: 'trinv_' + 'x'.repeat(36), site: 'https://example.com/' });
  const p = JSON.parse(Buffer.from(bad.json?.d || '', 'base64').toString() || '{}');
  ok('chave inexistente: resposta assinada dizendo inválida', bad.status < 300 && p.active === false && p.status === 'invalid' && !!bad.json?.s, p);
  const g = await call('POST', '/public/wp-plugin/check', { key: 'lixo' });
  ok('chave com formato errado: inválida', JSON.parse(Buffer.from(g.json?.d || '', 'base64').toString() || '{}').status === 'invalid');
  const u = await call('POST', '/public/wp-plugin/update', { key: 'lixo' });
  ok('atualização com chave inválida: nada', u.status < 300 && u.json?.ok === false, u.json);
  const pk = await call('GET', '/public/wp-plugin/package?t=abc');
  ok('pacote sem token válido: 404', pk.status === 404, pk.status);
}
if (step === 'cleanup') {
  const t = await sa();
  const r = await call('DELETE', `/admin/organizations/${st.org}`, null, t);
  ok('conta temporária apagada', r.status < 300, [r.status, r.json?.message]);
}
console.log(`${total - fails}/${total}`);
process.exit(fails ? 1 : 0);
