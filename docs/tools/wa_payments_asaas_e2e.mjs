// E2E da Fase 4 (gateways por finalidade + Asaas SANDBOX) — roda NO SERVIDOR (127.0.0.1:8000):
//   scp docs/tools/wa_payments_asaas_e2e.mjs pubmail-hostinger:/opt/pub-mail/back/wa_asaas_e2e.tmp.mjs
//   ssh pubmail-hostinger 'cd /opt/pub-mail/back && node wa_asaas_e2e.tmp.mjs; rm -f wa_asaas_e2e.tmp.mjs'
// Org temporária com a chave SANDBOX do Asaas (`ASAAS_SANDBOX_API_KEY` em /root/pubmail.secrets, nunca impressa).
// Número FALSO marcado `ready` por SQL (as mensagens não chegam a ninguém). Cobre: PIX/boleto/cartão pelo Asaas,
// cadastro sem CPF, página segura do cartão paga no sandbox → webhook real → cartão salvo (cifrado), link público,
// parcelamento, assinatura no cartão salvo (2 ciclos, o 2º pela rotina diária), recusa → novas tentativas → PIX,
// webhook com token errado ignorado, conciliação + correção, cancelamento remoto, remover cartão.
// No fim: toda cobrança aberta no Asaas é removida e a org é apagada.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';

const API = 'http://127.0.0.1:8000';
const env = Object.fromEntries(readFileSync('/opt/pub-mail/back/.env', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const secrets = readFileSync('/root/pubmail.secrets', 'utf8').split('\n');
const secret = (k) => secrets.find((l) => l.startsWith(`${k}=`))?.slice(k.length + 1).trim();
const DB_PASS = secret('DB_PASS');
const KEY = secret('ASAAS_SANDBOX_API_KEY');
const ASAAS = 'https://api-sandbox.asaas.com/v3';
const sql = (q) => execFileSync('mysql', ['-upubmail', `-p${DB_PASS}`, '-h127.0.0.1', '-N', '-e', q, 'pubmail'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
const sign = (u) => jwt.sign({ sub: u.id, org: u.org, role: u.role }, env.JWT_ACCESS_SECRET, { expiresIn: '30m' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0, total = 0;
const ok = (l, c, x) => { total++; if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + l + (c || x === undefined ? '' : '  → ' + JSON.stringify(x).slice(0, 500))); };
const call = async (tok, m, p, b, h = {}) => { const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...h }, body: b ? JSON.stringify(b) : undefined }); let j = null; const t = await r.text(); try { j = JSON.parse(t); } catch { j = t; } return { s: r.status, j }; };
const asa = async (m, p, b) => { const r = await fetch(ASAAS + p, { method: m, headers: { access_token: KEY, 'Content-Type': 'application/json', 'User-Agent': 'PubMail-E2E' }, body: b ? JSON.stringify(b) : undefined }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const cpf = () => { const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)); const d = (a) => { const s = a.reduce((acc, v, i) => acc + v * (a.length + 1 - i), 0); const r = (s * 10) % 11; return r === 10 ? 0 : r; }; n.push(d(n)); n.push(d(n)); return n.join(''); };
const card = { holderName: 'TESTE E2E', number: '4444444444444444', expiryMonth: '12', expiryYear: '2030', ccv: '123' };
const row = (id, cols) => sql(`SELECT CONCAT_WS('|',${cols.map((c) => `IFNULL(${c},'')`).join(',')}) FROM whatsapp_charges WHERE id='${id}'`).split('|');
const waitStatus = async (id, want, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (sql(`SELECT status FROM whatsapp_charges WHERE id='${id}'`) === want) return true; await sleep(2000); } return false; };

const SA = sql(`SELECT CONCAT(u.id,'|',u.organization_id) FROM users u WHERE u.email='superadmin@pubmail.com' LIMIT 1`).split('|');
const saTok = sign({ id: SA[0], org: SA[1], role: 'SUPER_ADMIN' });
const stamp = Date.now().toString(36);
let orgId, tok, sessionId;
try {
  if (!KEY) throw new Error('ASAAS_SANDBOX_API_KEY ausente em /root/pubmail.secrets');
  let r = await call(saTok, 'POST', '/admin/clients', { name: 'WA Asaas Owner', email: `wa-asaas-${stamp}@teste.local`, password: 'Senha!Teste123', org_name: `E2E WA Asaas ${stamp}`, modules: ['whatsapp', 'settings'], price_cents: 0 });
  orgId = r.j?.organization?.id; const ownerId = r.j?.user?.id;
  ok('org temporária criada', r.s === 201 && orgId && ownerId, r.j);
  tok = sign({ id: ownerId, org: orgId, role: 'OWNER' });

  // ---------------------------------------------------------------- gateway por finalidade
  r = await call(tok, 'PUT', '/payments/settings', { crm: { asaas_token: 'chave-invalida-de-teste' } });
  ok('chave do Asaas inválida → recusada antes de salvar', r.s === 400 && /Asaas/.test(String(r.j?.message)), { s: r.s, m: r.j?.message });
  r = await call(tok, 'PUT', '/payments/settings', { crm: { card: 'asaas' } });
  ok('escolher Asaas sem chave → 400', r.s === 400, { s: r.s, m: r.j?.message });
  r = await call(tok, 'PUT', '/payments/settings', { crm: { asaas_token: KEY, pix: 'asaas', boleto: 'asaas', card: 'asaas' } });
  const crm = r.j?.crm;
  ok('chave sandbox salva (mascarada), PIX/boleto/cartão pelo Asaas', r.s === 200 && crm?.asaas?.has_token && crm.asaas.sandbox && !JSON.stringify(r.j).includes(KEY) && crm.effective?.pix === 'asaas' && crm.effective?.boleto === 'asaas' && crm.effective?.card === 'asaas', { s: r.s, m: r.j?.message, eff: crm?.effective });
  ok('webhook cadastrado sozinho na conta do Asaas', crm?.asaas?.webhook_ok === true, { err: crm?.asaas?.webhook_error });
  r = await call(tok, 'POST', '/payments/settings/test', { provider: 'asaas' });
  ok('testar Asaas → ok (sandbox)', r.s === 201 && r.j?.ok && /Sandbox/.test(r.j.detail || ''), r.j);
  r = await call(tok, 'GET', '/whatsapp/charges/settings');
  ok('cobranças: PIX, boleto e cartão disponíveis pelo Asaas', r.j?.gateway_ready && r.j.pix_available && r.j.boleto_available && r.j.card_available && r.j.providers?.card === 'asaas', { p: r.j?.providers });

  r = await call(tok, 'POST', '/whatsapp/sessions', { label: 'E2E Asaas fake' });
  sessionId = r.j?.id;
  sql(`UPDATE whatsapp_sessions SET status='ready', openwa_session_id='e2e-asaas-${stamp}', engine='baileys', paired_at=NOW(3) WHERE id='${sessionId}'`);

  // ---------------------------------------------------------------- cliente sem documento
  r = await call(tok, 'POST', '/whatsapp/customers', { phone: '5500999990081', name: 'Sem Documento' });
  const C0 = r.j?.id;
  r = await call(tok, 'POST', '/whatsapp/charges', { customer_id: C0, amount_cents: 500, description: 'Sem doc', kind: 'pix', send: false });
  const r2 = await call(tok, 'POST', '/whatsapp/charges', { customer_id: C0, amount_cents: 500, description: 'Sem doc', kind: 'card', send: false });
  ok('sem CPF/CNPJ: PIX e cartão pelo Asaas → 400 claro, nenhuma cobrança gravada', r.s === 400 && /CPF\/CNPJ/.test(r.j?.message) && r2.s === 400 && sql(`SELECT COUNT(*) FROM whatsapp_charges WHERE customer_id='${C0}'`) === '0', { a: r.j?.message, b: r2.j?.message });

  // ---------------------------------------------------------------- cliente com CPF
  const DOC = cpf();
  r = await call(tok, 'POST', '/whatsapp/customers', { phone: '5500999990082', name: 'Cliente Asaas', doc: DOC, email: `cliente-${stamp}@exemplo.com` });
  const C = r.j?.id;
  ok('cliente com CPF', r.s === 201 && C, r.j);

  r = await call(tok, 'POST', '/whatsapp/charges', { customer_id: C, amount_cents: 1500, description: 'PIX Asaas', kind: 'pix', send: false });
  const pixCh = r.j;
  let x = row(pixCh?.id, ['pix_charge_id', 'pix_provider', 'pay_link_token']);
  ok('PIX pelo Asaas: id pay_…, copia e cola, provedor e link público', r.s === 201 && /^pay_/.test(x[0]) && x[1] === 'asaas' && pixCh.pix?.code?.length > 20 && /\/pay\//.test(pixCh.pay_link || '') && pixCh.providers?.pix === 'asaas', { s: r.s, m: r.j?.message, x });
  const refs = sql(`SELECT IFNULL(provider_refs,'') FROM whatsapp_customers WHERE id='${C}'`);
  ok('id do cliente no Asaas guardado (por conta)', /"asaas:[0-9a-f]{8}":\s*"cus_/.test(refs), refs);

  r = await call(tok, 'POST', '/whatsapp/charges', { customer_id: C, amount_cents: 2000, description: 'Boleto Asaas', kind: 'boleto', send: false });
  const bolCh = r.j;
  x = row(bolCh?.id, ['boleto_charge_id', 'boleto_provider']);
  ok('boleto pelo Asaas só com CPF (sem endereço): link + linha digitável', r.s === 201 && /^pay_/.test(x[0]) && x[1] === 'asaas' && /^https:/.test(bolCh.boleto?.url || '') && (bolCh.boleto?.digitable || '').length >= 40, { s: r.s, m: r.j?.message });

  // ---------------------------------------------------------------- cartão na página segura → webhook real → cartão salvo
  r = await call(tok, 'POST', '/whatsapp/charges', { customer_id: C, amount_cents: 1250, description: 'Cartão página', kind: 'card', send: false });
  const cardCh = r.j;
  x = row(cardCh?.id, ['card_charge_id', 'card_url', 'card_provider']);
  ok('cartão sem cartão salvo → página segura do Asaas', r.s === 201 && /^pay_/.test(x[0]) && /asaas\.com/.test(x[1]) && x[2] === 'asaas' && cardCh.card?.url, { s: r.s, m: r.j?.message });
  r = await asa('POST', `/payments/${x[0]}/payWithCreditCard`, { creditCard: card, creditCardHolderInfo: { name: 'Teste E2E', email: `cliente-${stamp}@exemplo.com`, cpfCnpj: DOC, postalCode: '01310100', addressNumber: '100', phone: '11999999999' } });
  ok('sandbox: cliente paga na página do Asaas', r.s === 200, { s: r.s, e: r.j?.errors });
  const viaWebhook = await waitStatus(cardCh.id, 'PAID', 90_000);
  ok('webhook real do Asaas confirmou o cartão (sem clicar em verificar)', viaWebhook);
  if (!viaWebhook) await call(tok, 'POST', `/whatsapp/charges/${cardCh.id}/check`);
  x = row(cardCh.id, ['status', 'paid_via', 'payment_method_id']);
  const pm = sql(`SELECT CONCAT_WS('|',id,provider,IFNULL(brand,''),IFNULL(last4,''),LEFT(provider_token,6),status) FROM whatsapp_payment_methods WHERE customer_id='${C}'`).split('|');
  ok('pago no cartão e cartão salvo (final 4444, token CIFRADO no banco)', x[0] === 'PAID' && x[1] === 'card' && x[2] === pm[0] && pm[3] === '4444' && pm[4] === 'wenc1:' && pm[5] === 'active', { x, pm: pm.slice(1, 4).concat(pm[5]) });
  r = await call(tok, 'GET', `/whatsapp/customers/${C}/payment-methods`);
  ok('lista de cartões salvos (sem token)', r.s === 200 && r.j.length === 1 && r.j[0].last4 === '4444' && !JSON.stringify(r.j).includes('token'), r.j);
  const METHOD = pm[0];

  // ---------------------------------------------------------------- link público
  const payTok = row(bolCh.id, ['pay_link_token'])[0];
  r = await call(null, 'GET', `/public/pay/${payTok}`);
  ok('página pública: valor, boleto e cartão; nada de CPF/telefone', r.s === 200 && r.j.amount_cents === 2000 && r.j.boleto?.digitable && r.j.card && !JSON.stringify(r.j).includes(DOC) && !JSON.stringify(r.j).includes('5500999990082'), r.j);
  r = await call(null, 'GET', '/public/pay/token-que-nao-existe-123456');
  ok('token inexistente → 404', r.s === 404);
  r = await call(null, 'POST', `/public/pay/${payTok}/card`, { installments: 1 });
  const bolCard = row(bolCh.id, ['card_charge_id', 'card_provider']);
  ok('"Pagar com cartão" na página → página segura do Asaas', r.s === 201 && /asaas\.com/.test(r.j?.url || '') && /^pay_/.test(bolCard[0]), { s: r.s, m: r.j?.message });
  const bolIds = [row(bolCh.id, ['boleto_charge_id'])[0], bolCard[0]];
  r = await call(tok, 'POST', `/whatsapp/charges/${bolCh.id}/cancel`);
  await sleep(1500);
  const st1 = await asa('GET', `/payments/${bolIds[0]}`), st2 = await asa('GET', `/payments/${bolIds[1]}`);
  ok('cancelar → boleto E cartão removidos no Asaas', r.s === 201 && r.j.status === 'CANCELED' && (st1.s === 404 || st1.j?.deleted) && (st2.s === 404 || st2.j?.deleted), { a: st1.j?.deleted ?? st1.s, b: st2.j?.deleted ?? st2.s });

  // ---------------------------------------------------------------- parcelamento (produto avulso)
  r = await call(tok, 'POST', '/whatsapp/products', { name: 'Curso parcelável', price_cents: 3000, billing: 'once', installments_max: 3 });
  const PO = r.j?.id;
  ok('produto avulso com até 3 parcelas', r.s === 201 && r.j.installments_max === 3, r.j);
  r = await call(tok, 'POST', '/whatsapp/charges', { customer_id: C, product_id: PO, kind: 'card', installments: 3, send: false });
  const instCh = r.j;
  x = row(instCh?.id, ['card_charge_id', 'installments']);
  const inst = await asa('GET', `/payments/${x[0]}`);
  ok('cartão em 3× → parcelamento criado no Asaas', r.s === 201 && x[1] === '3' && Boolean(inst.j?.installment) && Number(inst.j?.installmentNumber) === 1, { s: r.s, m: r.j?.message, x, inst: inst.j?.installment });
  r = await call(null, 'GET', `/public/pay/${row(instCh.id, ['pay_link_token'])[0]}`);
  ok('página pública oferece até 3 parcelas', r.j?.card?.installments_max === 3 && r.j.card.installments === 3, r.j?.card);

  // ---------------------------------------------------------------- assinatura no cartão salvo (2 ciclos)
  r = await call(tok, 'POST', '/whatsapp/products', { name: 'Mensal cartão', price_cents: 1000, billing: 'monthly' });
  const PM = r.j?.id;
  const dd = Number(today.slice(8, 10)) > 28 ? 28 : Number(today.slice(8, 10));
  r = await call(tok, 'POST', `/whatsapp/customers/${C}/subscriptions`, { product_id: PM, due_day: dd, payment_method: 'card', payment_method_id: METHOD });
  const S = r.j?.subscription;
  ok('assinatura no cartão salvo', r.s === 201 && S?.payment_method === 'card' && S.payment_method_id === METHOD, S);
  sql(`UPDATE whatsapp_subscriptions SET next_due_at='${today}' WHERE id='${S.id}'`);
  // cobrança manual só usa o cartão salvo se ele vier explícito (revisão C-H1, 14/10/2026); a rotina diária (recurring) herda sozinha
  r = await call(tok, 'POST', '/whatsapp/charges', { customer_id: C, subscription_id: S.id, payment_method_id: METHOD, send: false });
  x = row(r.j?.id, ['status', 'paid_via', 'kind', 'card_attempts']);
  let nd = sql(`SELECT DATE_FORMAT(next_due_at,'%Y-%m-%d') FROM whatsapp_subscriptions WHERE id='${S.id}'`);
  ok('1º ciclo: cobrado sozinho no cartão salvo (vence hoje) e o vencimento avançou (card_attempts conta só recusas = 0)', x[0] === 'PAID' && x[1] === 'card' && x[2] === 'card' && x[3] === '0' && nd > today, { x, nd, m: r.j?.message });
  const firstNext = nd;
  // simula o mês seguinte: o ciclo anterior venceu há 1 mês e o próximo vence hoje
  sql(`UPDATE whatsapp_charges SET due_at=DATE_SUB('${today}', INTERVAL 1 MONTH) WHERE subscription_id='${S.id}'`);
  sql(`UPDATE whatsapp_subscriptions SET next_due_at='${today}' WHERE id='${S.id}'`);
  r = await call(tok, 'POST', '/whatsapp/charges/run-daily');
  let c2 = sql(`SELECT CONCAT_WS('|',id,status,IFNULL(paid_via,''),IFNULL(card_error,'')) FROM whatsapp_charges WHERE subscription_id='${S.id}' ORDER BY created_at DESC LIMIT 1`).split('|');
  // sandbox lento (timeout de 15 s = resultado desconhecido → nova tentativa em 1 h): força a tentativa seguinte, que ADOTA
  // o pagamento se o Asaas chegou a criá-lo (nunca cobra em dobro)
  for (let i = 0; i < 2 && c2[1] === 'PENDING'; i++) {
    console.log(`  (2º ciclo: tentativa ${i + 1} ficou pendente — ${c2[3] || 'sem erro'} — forçando a próxima)`);
    sql(`UPDATE whatsapp_charges SET card_next_attempt_at=NOW(3) - INTERVAL 1 MINUTE WHERE id='${c2[0]}'`);
    await call(tok, 'POST', `/whatsapp/charges/${c2[0]}/resend`, {});
    c2 = sql(`SELECT CONCAT_WS('|',id,status,IFNULL(paid_via,''),IFNULL(card_error,'')) FROM whatsapp_charges WHERE subscription_id='${S.id}' ORDER BY created_at DESC LIMIT 1`).split('|');
  }
  ok('2º ciclo: só UMA cobrança de cartão existe no Asaas para a referência (adoção após timeout, nunca em dobro)', (await asa('GET', `/payments?externalReference=${c2[0]}&billingType=CREDIT_CARD`)).j?.data?.filter((p) => !p.deleted).length === 1);
  nd = sql(`SELECT DATE_FORMAT(next_due_at,'%Y-%m-%d') FROM whatsapp_subscriptions WHERE id='${S.id}'`);
  const queued = sql(`SELECT COUNT(*) FROM whatsapp_outbox WHERE organization_id='${orgId}' AND dedupe_key LIKE 'charge:${c2[0]}:%'`);
  ok('2º ciclo pela rotina diária: gerado, debitado no cartão, sem mensagem de cobrança na fila', r.s === 201 && c2[1] === 'PAID' && c2[2] === 'card' && nd > today && queued === '0', { s: r.s, m: r.j?.message, c2, nd, firstNext, queued, err: r.j?.errors, generated: r.j?.generated });
  r = await call(tok, 'GET', `/whatsapp/subscriptions/${S.id}/events`);
  ok('eventos da assinatura: 2 pagamentos via cartão', r.j?.filter?.((e) => e.kind === 'paid' && e.data?.via === 'card').length === 2, r.j?.map?.((e) => `${e.kind}:${e.data?.via || ''}`));

  // ---------------------------------------------------------------- débito agendado (vence no futuro) → rodada automática
  const in2 = new Date(new Date(`${today}T12:00:00Z`).getTime() + 2 * 86_400_000).toISOString().slice(0, 10);
  r = await call(tok, 'POST', '/whatsapp/charges', { customer_id: C, amount_cents: 900, description: 'Débito agendado', kind: 'card', payment_method_id: METHOD, due_at: in2, send: false });
  const schCh = r.j?.id;
  x = row(schCh, ['status', 'card_attempts', `DATE_FORMAT(card_next_attempt_at,'%Y-%m-%d %H:%i')`, 'card_charge_id']);
  ok('vencimento futuro: nada cobrado agora; débito marcado para o dia do vencimento às 09:00 (BRT)', r.s === 201 && x[0] === 'PENDING' && x[1] === '0' && x[2] === `${in2} 12:00` && !x[3], { s: r.s, x, m: r.j?.message });
  r = await call(null, 'GET', `/public/pay/${row(schCh, ['pay_link_token'])[0]}`);
  ok('página pública: "débito automático no cartão final 4444", sem botão de pagar à parte', r.j?.auto_card?.last4 === '4444' && !r.j.card, { auto: r.j?.auto_card, card: r.j?.card });
  r = await call(null, 'POST', `/public/pay/${row(schCh, ['pay_link_token'])[0]}/card`, {});
  ok('pagar à parte um débito automático → recusado (evita cobrança em dobro)', r.s === 400, { s: r.s, m: r.j?.message });
  sql(`UPDATE whatsapp_charges SET card_next_attempt_at=NOW(3) - INTERVAL 1 MINUTE WHERE id='${schCh}'`);
  const byRunner = await waitStatus(schCh, 'PAID', 330_000);
  ok('rodada automática (a cada 5 min) debitou no dia: PAID via cartão', byRunner && row(schCh, ['paid_via'])[0] === 'card', row(schCh, ['status', 'card_attempts', 'card_error']));

  // ---------------------------------------------------------------- recusa → novas tentativas → PIX
  const tk = await asa('POST', '/creditCard/tokenize', { customer: JSON.parse(refs)[Object.keys(JSON.parse(refs))[0]], creditCard: { holderName: 'RECUSA E2E', number: '5184019740373151', expiryMonth: '12', expiryYear: '2030', ccv: '123' }, creditCardHolderInfo: { name: 'Recusa E2E', email: `cliente-${stamp}@exemplo.com`, cpfCnpj: DOC, postalCode: '01310100', addressNumber: '100', phone: '11999999999' }, remoteIp: '179.197.225.107' });
  const badToken = tk.j?.creditCardToken || 'tok_invalido_pubmail_e2e';
  console.log(`  (cartão recusado: ${tk.j?.creditCardToken ? 'token do sandbox para 5184…3151' : `tokenização não disponível no sandbox (${tk.s}: ${(tk.j?.errors || []).map((e) => e.description).join(' · ')}) → token inválido`})`);
  sql(`INSERT INTO whatsapp_payment_methods (id, organization_id, customer_id, provider, provider_token, brand, last4, status) VALUES (UUID(), '${orgId}', '${C}', 'asaas', '${badToken.replace(/'/g, '')}', 'MASTERCARD', '3151', 'active')`);
  const BAD = sql(`SELECT id FROM whatsapp_payment_methods WHERE customer_id='${C}' AND last4='3151'`);
  r = await call(tok, 'POST', '/whatsapp/charges', { customer_id: C, amount_cents: 1100, description: 'Cartão recusado', kind: 'card', payment_method_id: BAD, send: false });
  const decCh = r.j?.id;
  x = row(decCh, ['status', 'card_attempts', 'card_error', `TIMESTAMPDIFF(MINUTE,NOW(3),card_next_attempt_at)`]);
  // o sandbox não tokeniza o cartão de recusa → o que dá para exercitar é o ERRO do gateway (token inválido):
  // não conta como recusa (card_attempts fica 0), guarda o erro e tenta de novo em 1 h
  ok('tentativa com token inválido = erro do gateway: card_attempts 0, erro guardado, nova tentativa em ~1 h', r.s === 201 && x[0] === 'PENDING' && x[1] === '0' && x[2] && Number(x[3]) >= 50 && Number(x[3]) <= 61, { s: r.s, m: r.j?.message, x });
  r = await call(null, 'GET', `/public/pay/${row(decCh, ['pay_link_token'])[0]}`);
  ok('página pública enquanto o débito automático ainda vai ser tentado: mostra "débito automático", sem pagar à parte', r.s === 200 && !r.j.card && r.j.auto_card?.last4 === '3151', { card: r.j?.card, auto: r.j?.auto_card });
  r = await call(tok, 'POST', `/whatsapp/charges/${decCh}/resend`, {});
  x = row(decCh, ['card_attempts', 'kind', `TIMESTAMPDIFF(MINUTE,NOW(3),card_next_attempt_at)`]);
  // (o envio do aviso para o número FALSO falha no gateway → a resposta pode ser erro; o que importa é não ter debitado)
  ok('"Reenviar" com tentativa agendada para daqui a 1 h NÃO antecipa o débito (só reenvia o aviso)', x[0] === '0' && x[1] === 'card' && Number(x[2]) >= 50, { s: r.s, x });
  sql(`UPDATE whatsapp_charges SET card_next_attempt_at=NOW(3) - INTERVAL 1 MINUTE WHERE id='${decCh}'`);
  await call(tok, 'POST', `/whatsapp/charges/${decCh}/resend`, {});
  x = row(decCh, ['card_attempts', 'kind', 'card_error']);
  ok('tentativa devida + "Reenviar" → tenta de novo: continua erro (0 recusas), ainda no cartão', x[0] === '0' && x[1] === 'card' && x[2], x);
  // erro persistente: vencida há mais de 7 dias com erro → a rodada do cartão (a cada 5 min) desiste e vira PIX
  sql(`UPDATE whatsapp_charges SET due_at=DATE_SUB('${today}', INTERVAL 8 DAY), card_next_attempt_at=NOW(3) - INTERVAL 1 MINUTE WHERE id='${decCh}'`);
  const fell = await (async () => { const t0 = Date.now(); while (Date.now() - t0 < 330_000) { if (row(decCh, ['kind'])[0] === 'pix') return true; await sleep(5000); } return false; })();
  x = row(decCh, ['card_attempts', 'kind', 'pix_charge_id', 'pix_provider', 'status', 'card_charge_id']);
  ok('erro de cartão por > 7 dias → a rodada virou a cobrança em PIX (Asaas) e mandou para a fila', fell && x[1] === 'pix' && /^pay_/.test(x[2]) && x[3] === 'asaas' && x[4] === 'PENDING' && !x[5] && sql(`SELECT COUNT(*) FROM whatsapp_outbox WHERE dedupe_key LIKE 'charge:${decCh}:charge:%'`) === '1', x);

  // ---------------------------------------------------------------- webhook com token errado + conciliação
  sql(`UPDATE telegram_payment_settings SET providers=JSON_SET(providers,'$.asaas_webhook_token','ZzZzZzZzZzZzZzZzZzZzZzZzZzZzZzZzZzZzZzZz') WHERE organization_id='${orgId}'`);
  r = await call(tok, 'POST', '/whatsapp/charges', { customer_id: C, amount_cents: 1700, description: 'Pago fora (conciliação)', kind: 'pix', send: false });
  const recCh = r.j?.id;
  const recPay = row(recCh, ['pix_charge_id'])[0];
  const conf = await asa('POST', `/sandbox/payment/${recPay}/confirm`);
  ok('sandbox: PIX confirmado no Asaas', conf.s === 200, { s: conf.s, e: conf.j?.errors });
  r = await call(null, 'POST', '/payments/webhook/asaas', { event: 'PAYMENT_RECEIVED', payment: { id: recPay } }, { 'asaas-access-token': 'token-errado' });
  await sleep(12_000); // o webhook real do Asaas também chega com o token antigo (≠ do banco) → ignorado
  ok('webhook com token errado (o forjado e o real com token antigo) → ignorado, segue em aberto', r.s === 200 && sql(`SELECT status FROM whatsapp_charges WHERE id='${recCh}'`) === 'PENDING');
  r = await call(tok, 'GET', `/whatsapp/charges/reconcile?from=${today}&to=${today}`);
  const div = (r.j?.items || []).find((i) => i.charge_id === recCh);
  ok('conciliação aponta "pago no Asaas, aberto aqui"', r.s === 200 && r.j.supported && div?.kind === 'paid_remote' && div.fixable, { s: r.s, n: r.j?.items?.length, div, m: r.j?.message });
  ok('conciliação: as cobranças pagas no cartão batem (sem divergência)', !(r.j?.items || []).some((i) => i.charge_id === cardCh.id), r.j?.items?.map?.((i) => i.kind));
  r = await call(tok, 'POST', `/whatsapp/charges/${recCh}/reconcile-fix`);
  ok('corrigir → liquidada (PAID via PIX)', r.s === 201 && r.j?.fixed && sql(`SELECT CONCAT(status,'|',paid_via) FROM whatsapp_charges WHERE id='${recCh}'`) === 'PAID|pix', r.j);

  // ---------------------------------------------------------------- remover cartão
  const oldTok = sql(`SELECT provider_token FROM whatsapp_payment_methods WHERE id='${METHOD}'`);
  r = await call(tok, 'DELETE', `/whatsapp/customers/${C}/payment-methods/${METHOD}`);
  const rm = { listed: Array.isArray(r.j) && r.j.some((m) => m.id === METHOD), status: sql(`SELECT status FROM whatsapp_payment_methods WHERE id='${METHOD}'`), tokenChanged: sql(`SELECT provider_token FROM whatsapp_payment_methods WHERE id='${METHOD}'`) !== oldTok, sub: sql(`SELECT IFNULL(payment_method_id,'null') FROM whatsapp_subscriptions WHERE id='${S.id}'`) };
  ok('remover cartão: some da lista, token apagado, assinatura sem cartão', r.s === 200 && !rm.listed && rm.status === 'removed' && rm.tokenChanged && rm.sub === 'null', rm);
} catch (e) {
  fails++; console.log('ERRO', e?.stack || e);
} finally {
  if (orgId) {
    // nada fica aberto no Asaas: remove toda cobrança desta org que ainda não foi paga
    const ids = sql(`SELECT CONCAT_WS(',',IFNULL(pix_charge_id,''),IFNULL(boleto_charge_id,''),IFNULL(card_charge_id,'')) FROM whatsapp_charges WHERE organization_id='${orgId}' AND status<>'PAID'`).split('\n').join(',').split(',').filter((v) => /^pay_/.test(v));
    for (const id of ids) await asa('DELETE', `/payments/${id}`).catch(() => {});
    let open = 0;
    for (const id of ids) { const st = await asa('GET', `/payments/${id}`); if (st.s === 200 && !st.j?.deleted && !['RECEIVED', 'CONFIRMED'].includes(st.j?.status)) open++; }
    ok(`limpeza: ${ids.length} cobrança(s) não pagas removidas no Asaas`, open === 0, { open });
    sql(`UPDATE whatsapp_sessions SET status='none', openwa_session_id=NULL, paired_at=NULL WHERE organization_id='${orgId}'`);
    sql(`DELETE FROM whatsapp_outbox WHERE organization_id='${orgId}'`);
    const r = await call(saTok, 'DELETE', `/admin/organizations/${orgId}`);
    ok('org temporária apagada (gateway, cobranças, cartões)', (r.s === 200 || r.s === 204) && sql(`SELECT COUNT(*) FROM whatsapp_payment_methods WHERE organization_id='${orgId}'`) === '0' && sql(`SELECT COUNT(*) FROM whatsapp_charges WHERE organization_id='${orgId}'`) === '0' && sql(`SELECT COUNT(*) FROM telegram_payment_settings WHERE organization_id='${orgId}'`) === '0', r.j);
  }
  console.log(`\n${total - fails}/${total} passaram${fails ? ` — ${fails} FALHAS` : ''}`);
  process.exit(fails ? 1 : 0);
}
