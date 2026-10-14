// E2E — Fase 1 do plano de assinaturas (identidade do cliente). Roda NO SERVIDOR contra 127.0.0.1:8000.
//   scp docs/tools/wa_identity_e2e.mjs pubmail-hostinger:/opt/pub-mail/back/wa_identity_e2e.tmp.mjs
//   ssh pubmail-hostinger 'cd /opt/pub-mail/back && node wa_identity_e2e.tmp.mjs; rm -f wa_identity_e2e.tmp.mjs'
// Cria uma organização temporária (via admin), clientes/contatos só dela, e apaga a org no fim.
// Nada vai ao gateway (não há número pareado). Segredos vêm dos arquivos do servidor, nunca impressos.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';

const API = 'http://127.0.0.1:8000';
const env = Object.fromEntries(readFileSync('/opt/pub-mail/back/.env', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const SECRET = env.JWT_ACCESS_SECRET;
const DB_PASS = readFileSync('/root/pubmail.secrets', 'utf8').split('\n').find((l) => l.startsWith('DB_PASS='))?.slice(8).trim();
const sql = (q) => execFileSync('mysql', ['-upubmail', `-p${DB_PASS}`, '-h127.0.0.1', '-N', '-e', q, 'pubmail'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
const sign = (u) => jwt.sign({ sub: u.id, org: u.org, role: u.role }, SECRET, { expiresIn: '20m' });

let fails = 0, total = 0;
const ok = (l, c, x) => { total++; if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + l + (c || x === undefined ? '' : '  → ' + JSON.stringify(x).slice(0, 400))); };
const call = async (tok, m, p, b, raw) => {
  const r = await fetch(API + p, { method: m, headers: raw ? { Authorization: 'Bearer ' + tok } : { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: raw ? b : b ? JSON.stringify(b) : undefined });
  let j = null; const t = await r.text(); try { j = JSON.parse(t); } catch { j = t; }
  return { s: r.status, j };
};
const SA = sql(`SELECT CONCAT(u.id,'|',u.organization_id) FROM users u WHERE u.email='superadmin@pubmail.com' LIMIT 1`).split('|');
const saTok = sign({ id: SA[0], org: SA[1], role: 'SUPER_ADMIN' });

// CPFs/CNPJ válidos (dígito verificador) — fictícios, só nesta org temporária
const CPF_A = '52998224725', CPF_B = '15350946056', CNPJ_C = '11222333000181', CPF_BAD = '12345678900';
const PHONE1 = '5500999990081', PHONE2 = '5500999990082', PHONE3 = '5500999990083';
const stamp = Date.now().toString(36);
let orgId, ownerId, tok, A, B, C;
try {
  // ---------------- org temporária
  let r = await call(saTok, 'POST', '/admin/clients', { name: 'WA Identity Owner', email: `wa-identity-${stamp}@teste.local`, password: 'Senha!Teste123', org_name: `E2E WA Identity ${stamp}`, modules: ['whatsapp', 'settings'], price_cents: 0 });
  orgId = r.j?.organization?.id; ownerId = r.j?.user?.id;
  ok('org temporária criada', r.s === 201 && orgId && ownerId, r.j);
  tok = sign({ id: ownerId, org: orgId, role: 'OWNER' });

  // ---------------- configuração de identidade (padrão: número identifica)
  r = await call(tok, 'GET', '/whatsapp/crm-settings');
  ok('settings: identity padrão (require_doc=false, use_code=false, textos)', r.s === 200 && r.j.identity && r.j.identity.require_doc === false && r.j.identity.use_code === false && r.j.identity.ask_doc_text.length > 10, r.j.identity);
  r = await call(tok, 'PUT', '/whatsapp/crm-settings', { identity: { use_code: true, code_label: 'Matrícula' } });
  ok('settings: PUT parcial mantém o resto (require_doc continua false)', r.s === 200 && r.j.identity.use_code === true && r.j.identity.code_label === 'Matrícula' && r.j.identity.require_doc === false, r.j.identity);
  r = await call(tok, 'PUT', '/whatsapp/crm-settings', { custom_fields: [{ key: 'plano', label: 'Plano' }] });
  ok('settings: salvar campos não apaga a identidade', r.s === 200 && r.j.identity.use_code === true && (Array.isArray(r.j.custom_fields) ? r.j.custom_fields : r.j.customer_fields).length === 1, r.j);

  // ---------------- cliente A (pelo telefone) com CPF, código e 1 número extra
  r = await call(tok, 'POST', '/whatsapp/customers', { phone: PHONE1, name: 'Ana Teste', doc: '529.982.247-25', code: 'MAT-001', kind: 'person', phones: [PHONE2] });
  A = r.j?.id;
  ok('cliente A criado com CPF/código/2 números', r.s === 201 && A && r.j.code === 'MAT-001' && r.j.doc === CPF_A && r.j.doc_masked === '***.982.247-**' && r.j.contacts?.length === 2 && r.j.contacts[0].role === 'owner' && r.j.contacts[0].primary === true, r.j);
  const row = sql(`SELECT CONCAT(IFNULL(doc,''),'|',IFNULL(doc_hash,'')) FROM whatsapp_customers WHERE id='${A}'`).split('|');
  ok('doc cifrado no banco (wenc1:) e doc_hash = sha256(org:dígitos)', row[0].startsWith('wenc1:') && row[1] === createHash('sha256').update(`${orgId}:${CPF_A}`).digest('hex'), row.map((x) => x.slice(0, 12)));
  ok('vínculos no banco: 2 (owner + user)', sql(`SELECT COUNT(*) FROM whatsapp_customer_contacts WHERE customer_id='${A}'`) === '2');

  // CPF inválido / código duplicado
  r = await call(tok, 'POST', '/whatsapp/customers', { phone: PHONE3, name: 'Doc ruim', doc: CPF_BAD });
  ok('CPF inválido → 400', r.s === 400, r.j);
  r = await call(tok, 'POST', '/whatsapp/customers', { phone: PHONE3, name: 'Código repetido', code: 'MAT-001' });
  ok('código duplicado → 400', r.s === 400 && /código/i.test(r.j?.message || ''), r.j);

  // mesmo número já é cliente: recusa sem `another`, aceita com
  r = await call(tok, 'POST', '/whatsapp/customers', { phone: PHONE1, name: 'Empresa da Ana', kind: 'company', doc: '11.222.333/0001-81' });
  ok('2º cliente no mesmo número sem `another` → 400 explicando', r.s === 400 && /outro cliente/i.test(r.j?.message || ''), r.j);
  r = await call(tok, 'POST', '/whatsapp/customers', { phone: PHONE1, name: 'Empresa da Ana', kind: 'company', doc: '11.222.333/0001-81', another: true });
  C = r.j?.id;
  ok('2º cliente no mesmo número com `another` → criado (empresa, CNPJ)', r.s === 201 && C && r.j.kind === 'company' && r.j.doc === CNPJ_C, r.j);

  // cliente B em outro número, com dependente apontando para A
  r = await call(tok, 'POST', '/whatsapp/customers', { phone: PHONE3, name: 'Bruno Teste', doc: CPF_B, parent_customer_id: A });
  B = r.j?.id;
  ok('cliente B criado como dependente de A', r.s === 201 && B && r.j.parent_customer_id === A, r.j);
  r = await call(tok, 'PUT', `/whatsapp/customers/${B}`, { parent_customer_id: B });
  ok('cliente responsável por si mesmo → 400', r.s === 400, r.j);

  // ---------------- lookup
  r = await call(tok, 'GET', `/whatsapp/customers/lookup?doc=${CPF_A}`);
  ok('lookup por CPF acha A', r.s === 200 && r.j.items?.length === 1 && r.j.items[0].id === A, r.j);
  r = await call(tok, 'GET', `/whatsapp/customers/lookup?doc=529.982.247-25`);
  ok('lookup por CPF com máscara acha A', r.s === 200 && r.j.items?.[0]?.id === A, r.j);
  r = await call(tok, 'GET', `/whatsapp/customers/lookup?doc=${CPF_BAD}`);
  ok('lookup por CPF inválido → 404 "inválido"', r.s === 404 && /inválido/i.test(r.j?.message || ''), r.j);
  r = await call(tok, 'GET', `/whatsapp/customers/lookup?doc=39053344705`);
  ok('lookup por CPF válido inexistente → 404 "não encontrado"', r.s === 404 && /não encontrado/i.test(r.j?.message || ''), r.j);
  r = await call(tok, 'GET', `/whatsapp/customers/lookup?code=MAT-001`);
  ok('lookup por código acha A', r.s === 200 && r.j.items?.[0]?.id === A, r.j);
  r = await call(tok, 'GET', `/whatsapp/customers/lookup?phone=${PHONE2}`);
  ok('lookup pelo 2º número de A acha A', r.s === 200 && r.j.items?.[0]?.id === A, r.j);
  r = await call(tok, 'GET', `/whatsapp/customers/lookup?phone=${PHONE1}`);
  ok('lookup pelo número compartilhado devolve A (titular) e C', r.s === 200 && r.j.items?.length === 2 && r.j.items[0].id === A, r.j.items?.map((x) => x.name));

  // ---------------- lista: busca por CPF (hash), código, telefone do número extra
  r = await call(tok, 'GET', `/whatsapp/customers?q=${CPF_A}`);
  ok('lista: busca por CPF casa pelo hash', r.s === 200 && r.j.items.length === 1 && r.j.items[0].id === A, r.j.items?.map((x) => x.name));
  r = await call(tok, 'GET', `/whatsapp/customers?q=MAT-00`);
  ok('lista: busca por parte do código', r.s === 200 && r.j.items.some((x) => x.id === A), r.j.items?.map((x) => x.name));
  r = await call(tok, 'GET', `/whatsapp/customers?q=${PHONE2.slice(-6)}`);
  ok('lista: busca pelo telefone do 2º número acha A', r.s === 200 && r.j.items.some((x) => x.id === A), r.j.items?.map((x) => x.name));
  r = await call(tok, 'GET', `/whatsapp/customers?q=${PHONE1.slice(-6)}`);
  ok('lista: telefone compartilhado acha A e C', r.s === 200 && r.j.items.length === 2, r.j.items?.map((x) => x.name));

  // ---------------- vínculos: papel, titular, remover
  const ct2 = (await call(tok, 'GET', `/whatsapp/customers/${A}`)).j.contacts.find((c) => c.phone === PHONE2);
  r = await call(tok, 'PATCH', `/whatsapp/customers/${A}/contacts/${ct2.id}`, { role: 'financial' });
  ok('papel do 2º número → financeiro', r.s === 200 && r.j.contacts.find((c) => c.id === ct2.id)?.role === 'financial', r.j.contacts);
  r = await call(tok, 'PATCH', `/whatsapp/customers/${A}/contacts/${ct2.id}`, { role: 'owner' });
  ok('2º número vira titular → passa a ser o principal (contact_id)', r.s === 200 && r.j.contact_id === ct2.id && r.j.phone === PHONE2, { contact_id: r.j.contact_id, phone: r.j.phone });
  r = await call(tok, 'PATCH', `/whatsapp/customers/${A}/contacts/${ct2.id}`, { role: 'chefe' });
  ok('papel inválido → 400', r.s === 400, r.j);
  r = await call(tok, 'DELETE', `/whatsapp/customers/${A}/contacts/${ct2.id}`);
  ok('desvincular o principal → o outro vira principal', r.s === 200 && r.j.contacts.length === 1 && r.j.phone === PHONE1, r.j.contacts);
  r = await call(tok, 'DELETE', `/whatsapp/customers/${A}/contacts/${r.j.contacts[0].id}`);
  ok('desvincular o último número → 400', r.s === 400, r.j);
  r = await call(tok, 'POST', `/whatsapp/customers/${A}/contacts`, { phone: PHONE2, role: 'dependent' });
  ok('vincular de novo pelo telefone (papel dependente)', r.s === 201 && r.j.contacts.length === 2 && r.j.contacts.find((c) => c.phone === PHONE2)?.role === 'dependent', r.j.contacts);
  r = await call(tok, 'POST', `/whatsapp/customers/${A}/contacts`, { phone: '12' });
  ok('vincular telefone inválido → 400', r.s === 400, r.j);

  // ---------------- by-chat (conversa fictícia por SQL) — vários clientes no mesmo número
  const sess = sql(`SELECT id FROM whatsapp_sessions WHERE organization_id='${orgId}' LIMIT 1`) || null;
  let sid = sess;
  if (!sid) { r = await call(tok, 'POST', '/whatsapp/sessions', { label: 'Teste' }); sid = r.j?.id; }
  const chatUuid = sql(`SELECT UUID()`);
  sql(`INSERT INTO whatsapp_chats (id, organization_id, session_id, chat_id, kind, name, created_at, updated_at) VALUES ('${chatUuid}','${orgId}','${sid}','${PHONE1}@c.us','individual','Ana Teste',NOW(3),NOW(3))`);
  r = await call(tok, 'GET', `/whatsapp/customers/by-chat/${chatUuid}`);
  ok('by-chat: titular primeiro + lista `customers` com os 2 do número', r.s === 200 && r.j.customer?.id === A && r.j.customers?.length === 2 && r.j.customers[0].role === 'owner', r.j.customers);
  r = await call(tok, 'GET', `/whatsapp/customers/by-chat/${chatUuid}?customer_id=${C}`);
  ok('by-chat?customer_id escolhe o outro cliente', r.s === 200 && r.j.customer?.id === C, r.j.customer?.name);
  r = await call(tok, 'GET', `/whatsapp/contacts/lookup?jid=${PHONE1}@c.us`);
  ok('contacts/lookup devolve customers[] com papel', r.s === 200 && r.j.customers?.length === 2 && r.j.customer?.id === A, r.j.customers);

  // ---------------- variáveis
  const [[sessPhone]] = [[null]];
  void sessPhone;
  const vars = await call(tok, 'POST', '/whatsapp/bot/simulate', { definition: { nodes: [{ id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} }, { id: 'm', type: 'message', position: { x: 0, y: 0 }, data: { messages: [{ id: 'x', kind: 'text', text: 'Olá {{cliente.nome}} {{cliente.codigo}}' }] } }], edges: [{ id: 'e', source: 'start', sourceHandle: 'out', target: 'm' }] }, settings: {}, state: null, input: 'oi' });
  ok('simulador continua funcionando (variável cliente.codigo existe no mapa)', vars.s === 201 || vars.s === 200, vars.j);

  // ---------------- importação/exportação com code/kind/phones
  const csv = ['phone,name,doc,code,kind,phones', `5500999990084,Carla Import,11144477735,MAT-010,pf,5500999990085|5500999990086`, `5500999990087,Loja Import,11444777000161,MAT-011,empresa,`].join('\n');
  const fd = new FormData(); fd.append('file', new Blob([csv], { type: 'text/csv' }), 'clientes.csv');
  r = await call(tok, 'POST', '/whatsapp/customers/import', fd, true);
  ok('import CSV: 2 clientes (código, tipo, números extras)', r.s === 201 && r.j.imported === 2 && r.j.skipped === 0, r.j);
  r = await call(tok, 'GET', `/whatsapp/customers/lookup?code=MAT-010`);
  ok('importado: 3 números (1 principal + 2 extras, todos linked_by=import)', r.s === 200 && r.j.items[0].contacts.length === 3 && r.j.items[0].contacts.filter((c) => !c.primary && c.linked_by === 'import').length === 2, r.j.items?.[0]?.contacts?.map((c) => `${c.phone}:${c.role}:${c.linked_by}`));
  r = await call(tok, 'GET', `/whatsapp/customers/lookup?code=MAT-011`);
  ok('importado: "empresa" vira kind=company', r.s === 200 && r.j.items[0].kind === 'company', r.j.items?.[0]);
  r = await call(tok, 'GET', '/whatsapp/customers/export');
  ok('export CSV tem colunas code,kind,phones e os números extras', r.s === 200 && /code,kind,phones/.test(String(r.j)) && /5500999990085\|5500999990086/.test(String(r.j)), String(r.j).slice(0, 200));

  // ---------------- remoção do cliente: vínculos somem, contatos ficam
  r = await call(tok, 'DELETE', `/whatsapp/customers/${C}`);
  ok('remover cliente C', r.s === 200, r.j);
  ok('vínculos de C apagados em cascata', sql(`SELECT COUNT(*) FROM whatsapp_customer_contacts WHERE customer_id='${C}'`) === '0');
  ok('contato do número compartilhado continua', sql(`SELECT COUNT(*) FROM whatsapp_contacts WHERE organization_id='${orgId}' AND phone='${PHONE1}'`) === '1');
} catch (e) {
  fails++; console.log('ERRO', e?.stack || e);
} finally {
  if (orgId) {
    const r = await call(saTok, 'DELETE', `/admin/organizations/${orgId}`);
    ok('org temporária apagada', r.s === 200 || r.s === 204, r.j);
    ok('nada da org ficou (clientes/vínculos/contatos/conversas)', ['whatsapp_customers', 'whatsapp_contacts', 'whatsapp_chats'].every((t) => sql(`SELECT COUNT(*) FROM ${t} WHERE organization_id='${orgId}'`) === '0') && sql(`SELECT COUNT(*) FROM whatsapp_customer_contacts cc JOIN whatsapp_customers c ON c.id=cc.customer_id WHERE c.organization_id='${orgId}'`) === '0');
  }
  console.log(`\n${total - fails}/${total} passaram${fails ? ` — ${fails} FALHAS` : ''}`);
  process.exit(fails ? 1 : 0);
}
