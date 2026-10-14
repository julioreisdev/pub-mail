// E2E com GATEWAY REAL (Mercado Pago da org do superadmin) — Fase 3: cancelamento imediato cancela o PIX no
// gateway e a 2ª via recria o PIX com multa + juros. Roda NO SERVIDOR (127.0.0.1:8000):
//   scp docs/tools/wa_subs_gateway_e2e.mjs pubmail-hostinger:/opt/pub-mail/back/wa_subs_gw.tmp.mjs
//   ssh pubmail-hostinger 'cd /opt/pub-mail/back && node wa_subs_gw.tmp.mjs; rm -f wa_subs_gw.tmp.mjs'
// Org temporária recebe uma CÓPIA do gateway (SQL no servidor, token nunca impresso). PIX de R$ 1,00 com send:false
// (nada vai ao WhatsApp de ninguém); número FALSO marcado `ready` por SQL só para a cobrança ter por onde "sair".
// No fim: todo PIX criado é cancelado no gateway e a org (com a cópia do gateway) é apagada.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';

const API = 'http://127.0.0.1:8000';
const env = Object.fromEntries(readFileSync('/opt/pub-mail/back/.env', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const DB_PASS = readFileSync('/root/pubmail.secrets', 'utf8').split('\n').find((l) => l.startsWith('DB_PASS='))?.slice(8).trim();
const sql = (q) => execFileSync('mysql', ['-upubmail', `-p${DB_PASS}`, '-h127.0.0.1', '-N', '-e', q, 'pubmail'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
const sign = (u) => jwt.sign({ sub: u.id, org: u.org, role: u.role }, env.JWT_ACCESS_SECRET, { expiresIn: '20m' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0, total = 0;
const ok = (l, c, x) => { total++; if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + l + (c || x === undefined ? '' : '  → ' + JSON.stringify(x).slice(0, 400))); };
const call = async (tok, m, p, b) => { const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: b ? JSON.stringify(b) : undefined }); let j = null; const t = await r.text(); try { j = JSON.parse(t); } catch { j = t; } return { s: r.status, j }; };
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const addDays = (s, n) => new Date(new Date(`${s}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);

const SA = sql(`SELECT CONCAT(u.id,'|',u.organization_id) FROM users u WHERE u.email='superadmin@pubmail.com' LIMIT 1`).split('|');
const saTok = sign({ id: SA[0], org: SA[1], role: 'SUPER_ADMIN' });
const stamp = Date.now().toString(36);
const created = new Set(); // ids de PIX criados no gateway (para cancelar no fim)
let orgId, tok, mpToken;
const mp = async (id) => (await fetch(`https://api.mercadopago.com/v1/payments/${id}`, { headers: { Authorization: `Bearer ${mpToken}` } })).json();
try {
  let r = await call(saTok, 'POST', '/admin/clients', { name: 'WA GW Owner', email: `wa-gw-${stamp}@teste.local`, password: 'Senha!Teste123', org_name: `E2E WA Gateway ${stamp}`, modules: ['whatsapp', 'settings'], price_cents: 0 });
  orgId = r.j?.organization?.id; const ownerId = r.j?.user?.id;
  ok('org temporária criada', r.s === 201 && orgId && ownerId, r.j);
  tok = sign({ id: ownerId, org: orgId, role: 'OWNER' });
  sql(`INSERT INTO telegram_payment_settings (id, organization_id, provider, access_token, active, created_at, updated_at) SELECT UUID(), '${orgId}', provider, access_token, 1, NOW(), NOW() FROM telegram_payment_settings WHERE organization_id='${SA[1]}'`);
  mpToken = sql(`SELECT access_token FROM telegram_payment_settings WHERE organization_id='${orgId}'`);
  ok('cópia do gateway (Mercado Pago) na org temporária', sql(`SELECT provider FROM telegram_payment_settings WHERE organization_id='${orgId}'`) === 'mercadopago' && mpToken.length > 20);
  r = await call(tok, 'GET', '/whatsapp/charges/settings');
  ok('gateway pronto para a org', r.s === 200 && r.j.gateway_ready === true, { ready: r.j?.gateway_ready });
  r = await call(tok, 'POST', '/whatsapp/sessions', { label: 'E2E GW fake' });
  const sessionId = r.j?.id;
  sql(`UPDATE whatsapp_sessions SET status='ready', openwa_session_id='e2e-gw-${stamp}', engine='baileys', paired_at=NOW(3) WHERE id='${sessionId}'`);
  r = await call(tok, 'POST', '/whatsapp/products', { name: 'Plano Teste R$1', price_cents: 100, billing: 'monthly', cancel_policy: 'immediate' });
  const P = r.j?.id;
  r = await call(tok, 'POST', '/whatsapp/customers', { phone: '5500999990071', name: 'Cliente Gateway' });
  const C = r.j?.id;
  r = await call(tok, 'POST', `/whatsapp/customers/${C}/subscriptions`, { product_id: P });
  const S = r.j?.subscription;
  ok('produto R$ 1,00, cliente e assinatura (sem cobrar na criação)', P && C && S?.id && sql(`SELECT COUNT(*) FROM whatsapp_charges WHERE subscription_id='${S.id}'`) === '0');

  // ---- cobrança real no gateway, sem enviar
  r = await call(tok, 'POST', '/whatsapp/charges', { customer_id: C, subscription_id: S.id, amount_cents: 100, kind: 'pix', send: false });
  const ch = r.j;
  const pix1 = sql(`SELECT IFNULL(pix_charge_id,'') FROM whatsapp_charges WHERE id='${ch?.id}'`);
  if (pix1) created.add(pix1);
  ok('cobrança criada no Mercado Pago (PIX copia e cola, R$ 1,00, sem envio)', r.s === 201 && pix1 && ch.pix?.code?.length > 20 && ch.amount_cents === 100 && !ch.sent_at, { s: r.s, msg: r.j?.message });
  let st = await mp(pix1);
  ok('no gateway: PIX pendente de R$ 1,00', st.status === 'pending' && Number(st.transaction_amount) === 1, { status: st.status, amount: st.transaction_amount });

  // ---- 2ª via com multa + juros: vencida há 6 dias → 100 + 2 (multa 2 %) + 1 (juros 1 % a.m. × 6 dias, para cima) = 103
  sql(`UPDATE whatsapp_charges SET due_at='${addDays(today, -6)}' WHERE id='${ch.id}'`);
  r = await call(tok, 'GET', `/whatsapp/charges/${ch.id}`);
  ok('prévia da 2ª via: 103 centavos (multa 2 + juros 1)', r.j?.penalty?.amount_cents === 103 && r.j.penalty.fee_cents === 2 && r.j.penalty.interest_cents === 1, r.j?.penalty);
  r = await call(tok, 'POST', `/whatsapp/charges/${ch.id}/resend`, {});
  // o envio para o número falso falha (esperado); o que importa é o PIX recriado no gateway
  const row = sql(`SELECT CONCAT(amount_cents,'|',IFNULL(base_amount_cents,''),'|',IFNULL(pix_charge_id,''),'|',status) FROM whatsapp_charges WHERE id='${ch.id}'`).split('|');
  const pix2 = row[2];
  if (pix2) created.add(pix2);
  ok('2ª via: cobrança passou a R$ 1,03 com base R$ 1,00 e PIX NOVO no gateway', row[0] === '103' && row[1] === '100' && pix2 && pix2 !== pix1 && row[3] === 'PENDING', { row, resend: r.s });
  st = await mp(pix2);
  ok('no gateway: PIX novo de R$ 1,03 pendente', st.status === 'pending' && Number(st.transaction_amount) === 1.03, { status: st.status, amount: st.transaction_amount });
  await sleep(1500);
  st = await mp(pix1);
  ok('no gateway: PIX antigo (R$ 1,00) cancelado — ninguém paga o valor velho', st.status === 'cancelled', { status: st.status });

  // ---- cancelamento imediato da assinatura cancela a cobrança no gateway
  r = await call(tok, 'POST', `/whatsapp/subscriptions/${S.id}/cancel`, { policy: 'immediate', reason: 'Teste do gateway' });
  ok('assinatura cancelada na hora', r.s === 201 && r.j.status === 'canceled', r.j);
  ok('cobrança da assinatura ficou CANCELED', sql(`SELECT status FROM whatsapp_charges WHERE id='${ch.id}'`) === 'CANCELED');
  await sleep(1500);
  st = await mp(pix2);
  ok('no gateway: o PIX da cobrança foi cancelado junto', st.status === 'cancelled', { status: st.status });
  r = await call(tok, 'GET', `/whatsapp/subscriptions/${S.id}/events`);
  ok('eventos: created, canceled(immediate)', r.s === 200 && r.j.map((e) => e.kind).join(',') === 'created,canceled' && r.j[1].data?.policy === 'immediate', r.j?.map((e) => e.kind));
  // ---- fim do teste grátis com dia escolhido: a rotina diária gera a cobrança PROPORCIONAL e o pagamento leva ao dia escolhido
  r = await call(tok, 'POST', '/whatsapp/products', { name: 'Plano Trial R$30', price_cents: 3000, billing: 'monthly', trial_days: 7 });
  const PT = r.j?.id;
  r = await call(tok, 'POST', '/whatsapp/customers', { phone: '5500999990072', name: 'Cliente Trial' });
  const CT = r.j?.id;
  r = await call(tok, 'POST', `/whatsapp/customers/${CT}/subscriptions`, { product_id: PT, due_day: 15 });
  const ST = r.j?.subscription;
  ok('assinatura com teste grátis e dia 15', r.s === 201 && ST?.custom?.trial_charge, ST);
  // simula: o teste acaba daqui a 2 dias e o dia escolhido cai 20 dias depois
  const end = addDays(today, 2), next = addDays(today, 22);
  sql(`UPDATE whatsapp_subscriptions SET trial_ends_at='${end}', next_due_at='${end}', custom=JSON_SET(custom,'$.trial_charge.due_at','${end}','$.trial_charge.next_due_at','${next}') WHERE id='${ST.id}'`);
  const dim = (y, m1) => new Date(Date.UTC(y, m1, 0)).getUTCDate();
  const nd = new Date(`${next}T00:00:00Z`);
  const prevMonth = new Date(Date.UTC(nd.getUTCFullYear(), nd.getUTCMonth() - 1, 1));
  const cycleStart = new Date(Date.UTC(prevMonth.getUTCFullYear(), prevMonth.getUTCMonth(), Math.min(nd.getUTCDate(), dim(prevMonth.getUTCFullYear(), prevMonth.getUTCMonth() + 1)))).toISOString().slice(0, 10);
  const cycleDays = Math.round((nd.getTime() - new Date(`${cycleStart}T00:00:00Z`).getTime()) / 86_400_000);
  const want = Math.ceil((3000 * 20) / cycleDays);
  r = await call(tok, 'POST', '/whatsapp/charges/run-daily');
  const tch = sql(`SELECT CONCAT(id,'|',amount_cents,'|',description,'|',DATE_FORMAT(due_at,'%Y-%m-%d'),'|',IFNULL(pix_charge_id,'')) FROM whatsapp_charges WHERE subscription_id='${ST.id}' LIMIT 1`).split('|');
  if (tch[4]) created.add(tch[4]);
  ok(`rotina diária: cobrança do fim do teste = ${want} centavos (20 de ${cycleDays} dias), "proporcional, 20 dias", vence no fim do teste`, r.s === 201 && tch[1] === String(want) && /proporcional, 20 dias/.test(tch[2]) && tch[3] === end && tch[4], { tch, daily: r.j?.errors });
  r = await call(tok, 'POST', `/whatsapp/charges/${tch[0]}/mark-paid`);
  const after = sql(`SELECT CONCAT(DATE_FORMAT(next_due_at,'%Y-%m-%d'),'|',IFNULL(JSON_EXTRACT(custom,'$.trial_charge'),'null')) FROM whatsapp_subscriptions WHERE id='${ST.id}'`).split('|');
  ok('pago: próximo vencimento = dia escolhido (não +1 mês) e a marca do fim do teste some', r.s === 201 && after[0] === next && after[1] === 'null', { after, s: r.s });
  sql(`UPDATE whatsapp_sessions SET status='none', openwa_session_id=NULL, paired_at=NULL WHERE id='${sessionId}'`);
} catch (e) {
  fails++; console.log('ERRO', e?.stack || e);
} finally {
  // garante que nenhum PIX criado aqui fica aberto no gateway
  for (const id of created) {
    try { const st = await mp(id); if (st.status === 'pending') await fetch(`https://api.mercadopago.com/v1/payments/${id}`, { method: 'PUT', headers: { Authorization: `Bearer ${mpToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled' }) }); } catch {}
  }
  if (created.size) { let open = 0; for (const id of created) { const st = await mp(id).catch(() => ({})); if (st.status !== 'cancelled') open++; } ok(`limpeza: todos os ${created.size} PIX criados estão cancelados no gateway`, open === 0, { open }); }
  if (orgId) {
    sql(`UPDATE whatsapp_sessions SET status='none', openwa_session_id=NULL, paired_at=NULL WHERE organization_id='${orgId}'`);
    const r = await call(saTok, 'DELETE', `/admin/organizations/${orgId}`);
    ok('org temporária apagada (com a cópia do gateway)', (r.s === 200 || r.s === 204) && sql(`SELECT COUNT(*) FROM telegram_payment_settings WHERE organization_id='${orgId}'`) === '0' && sql(`SELECT COUNT(*) FROM whatsapp_charges WHERE organization_id='${orgId}'`) === '0', r.j);
  }
  console.log(`\n${total - fails}/${total} passaram${fails ? ` — ${fails} FALHAS` : ''}`);
  process.exit(fails ? 1 : 0);
}
