// E2E — Fase 3 do plano de assinaturas (motor de assinatura). Roda NO SERVIDOR contra 127.0.0.1:8000.
//   scp docs/tools/wa_subscription_engine_e2e.mjs pubmail-hostinger:/opt/pub-mail/back/wa_sub_e2e.tmp.mjs
//   ssh pubmail-hostinger 'cd /opt/pub-mail/back && node wa_sub_e2e.tmp.mjs; rm -f wa_sub_e2e.tmp.mjs'
// Cria uma organização temporária (via admin), produtos/clientes/assinaturas/cupons só dela, e apaga a org
// no fim (finally). Nada vai ao gateway de pagamento (a org não tem gateway → 400 claros). Números fictícios
// 55009999900xx. Segredos vêm dos arquivos do servidor, nunca impressos.
//
// Limites (sem gateway e sem número real):
//  - a 1ª cobrança (pró-rata) fica pendente em `custom.first_charge` (o hook falha com "sem gateway") — é o que se valida;
//  - a 2ª via com juros/multa é validada pelo `penalty` do GET da cobrança (valor recalculado) e pelo 400 claro do
//    `resend` (precisa do gateway para recriar o PIX com o valor novo);
//  - a fila `whatsapp_outbox` é testada com uma sessão FALSA marcada `ready` por SQL: o worker tenta o gateway,
//    falha e reagenda/marca `failed`. O watchdog (1×/min) pode zerar a sessão falsa no meio ("Número desconectado")
//    — o teste aceita os dois resultados e diz qual aconteceu.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';

const API = 'http://127.0.0.1:8000';
const env = Object.fromEntries(readFileSync('/opt/pub-mail/back/.env', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const SECRET = env.JWT_ACCESS_SECRET;
const DB_PASS = readFileSync('/root/pubmail.secrets', 'utf8').split('\n').find((l) => l.startsWith('DB_PASS='))?.slice(8).trim();
const sql = (q) => execFileSync('mysql', ['-upubmail', `-p${DB_PASS}`, '-h127.0.0.1', '-N', '-e', q, 'pubmail'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
const sign = (u) => jwt.sign({ sub: u.id, org: u.org, role: u.role }, SECRET, { expiresIn: '30m' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let fails = 0, total = 0;
const ok = (l, c, x) => { total++; if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + l + (c || x === undefined ? '' : '  → ' + JSON.stringify(x).slice(0, 500))); };
const call = async (tok, m, p, b) => {
  const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: b ? JSON.stringify(b) : undefined });
  let j = null; const t = await r.text(); try { j = JSON.parse(t); } catch { j = t; }
  return { s: r.status, j };
};

// `POST /whatsapp/charges/run-daily` tem limite de 3/min (proposital): espera a janela quando bate no 429
const runDaily = async () => { for (let i = 0; i < 6; i++) { const x = await call(tok, 'POST', '/whatsapp/charges/run-daily'); if (x.s !== 429) return x; await sleep(21_000); } return call(tok, 'POST', '/whatsapp/charges/run-daily'); };

// ---- datas (BRT, YYYY-MM-DD) — mesmas regras do wa-subscription-math.util
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const D = (s) => new Date(`${s}T00:00:00Z`);
const str = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => str(new Date(D(s).getTime() + n * 86_400_000));
const daysBetween = (a, b) => Math.round((D(b).getTime() - D(a).getTime()) / 86_400_000);
const dim = (y, m1) => new Date(Date.UTC(y, m1, 0)).getUTCDate();
const addMonths = (s, n, dueDay) => { const d = D(s); const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)); const want = dueDay ? Math.min(28, dueDay) : d.getUTCDate(); return str(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), Math.min(want, dim(t.getUTCFullYear(), t.getUTCMonth() + 1))))); };
const nextDueFrom = (s, day) => { const d = D(s); const y = d.getUTCFullYear(), m = d.getUTCMonth(); const a = new Date(Date.UTC(y, m, day)); return str(a >= d ? a : new Date(Date.UTC(y, m + 1, day))); };
// trial de 7 dias sem dia escolhido: vence no dia em que o teste acaba (máx. dia 28)
const TRIAL_END = addDays(today, 7);
const TRIAL_DUE = D(TRIAL_END).getUTCDate() > 28 ? nextDueFrom(TRIAL_END, 28) : TRIAL_END;

const SA = sql(`SELECT CONCAT(u.id,'|',u.organization_id) FROM users u WHERE u.email='superadmin@pubmail.com' LIMIT 1`).split('|');
const saTok = sign({ id: SA[0], org: SA[1], role: 'SUPER_ADMIN' });
const stamp = Date.now().toString(36);
const PH = (n) => `55009999900${n}`;
let orgId, ownerId, tok, sessionId;
try {
  // ---------------- org temporária
  let r = await call(saTok, 'POST', '/admin/clients', { name: 'WA Sub Owner', email: `wa-sub-${stamp}@teste.local`, password: 'Senha!Teste123', org_name: `E2E WA Subs ${stamp}`, modules: ['whatsapp', 'settings'], price_cents: 0 });
  orgId = r.j?.organization?.id; ownerId = r.j?.user?.id;
  ok('org temporária criada', r.s === 201 && orgId && ownerId, r.j);
  tok = sign({ id: ownerId, org: orgId, role: 'OWNER' });

  // ---------------- migração
  const col = (t, c) => sql(`SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='pubmail' AND TABLE_NAME='${t}' AND COLUMN_NAME='${c}'`) === '1';
  const tbl = (t) => sql(`SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='pubmail' AND TABLE_NAME='${t}'`) === '1';
  ok('migração: colunas novas em products/subscriptions/charges', ['trial_days', 'grace_days', 'prorate', 'cancel_policy', 'billing_interval_months', 'reminder_rules'].every((c) => col('whatsapp_products', c)) && ['trial_ends_at', 'paused_until', 'cancel_at', 'coupon_id', 'discount_cents', 'external_id', 'source'].every((c) => col('whatsapp_subscriptions', c)) && ['bot_flow_id', 'bot_node_id', 'base_amount_cents'].every((c) => col('whatsapp_charges', c)));
  ok('migração: tabelas whatsapp_coupons / whatsapp_subscription_events / whatsapp_outbox', tbl('whatsapp_coupons') && tbl('whatsapp_subscription_events') && tbl('whatsapp_outbox'));
  ok('migração: FK fk_wasubev_sub e unique uk_wacoupon_org_code existem', sql(`SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA='pubmail' AND CONSTRAINT_NAME IN ('fk_wasubev_sub','uk_wacoupon_org_code','uk_waoutbox_dedupe')`) === '3');

  // ---------------- settings (defaults + update parcial)
  r = await call(tok, 'GET', '/whatsapp/charges/settings');
  ok('settings: defaults da Fase 3 (multa 2, juros 1, carência 0, 5 motivos, reajuste off, fila 20/min, textos novos)', r.s === 200 && r.j.late_fee_percent === 2 && r.j.interest_month_percent === 1 && r.j.grace_days_default === 0 && r.j.cancel_reasons?.length === 5 && r.j.readjust?.enabled === false && r.j.outbox_per_minute === 20 && typeof r.j.texts?.second_copy === 'string' && typeof r.j.texts?.trial_ending === 'string', r.j);
  r = await call(tok, 'PUT', '/whatsapp/charges/settings', { cancel_reasons: ['Caro', 'Outro'], readjust: { enabled: true, percent: 5, month: 1 }, outbox_per_minute: 7 });
  ok('settings: PUT parcial grava motivos/reajuste/fila', r.s === 200 && r.j.cancel_reasons?.length === 2 && r.j.readjust?.enabled === true && r.j.readjust?.percent === 5 && r.j.outbox_per_minute === 7 && r.j.late_fee_percent === 2, r.j);
  r = await call(tok, 'PUT', '/whatsapp/charges/settings', { late_fee_percent: 3, readjust: { enabled: false } });
  ok('settings: 2º PUT não apaga o que não veio (motivos continuam 2; reajuste desliga mantendo 5 %)', r.s === 200 && r.j.late_fee_percent === 3 && r.j.cancel_reasons?.length === 2 && r.j.readjust?.enabled === false && r.j.readjust?.percent === 5 && r.j.outbox_per_minute === 7, r.j);
  r = await call(tok, 'PUT', '/whatsapp/charges/settings', { late_fee_percent: 2 });
  ok('settings: multa de volta a 2 %', r.s === 200 && r.j.late_fee_percent === 2);

  // ---------------- produtos
  r = await call(tok, 'POST', '/whatsapp/products', { name: 'Plano Trial', price_cents: 10000, billing: 'monthly', trial_days: 7 });
  const P_TRIAL = r.j?.id;
  ok('produto com trial 7 dias', r.s === 201 && P_TRIAL && r.j.trial_days === 7 && r.j.prorate === true && r.j.cancel_policy === 'end_of_cycle' && r.j.cycle_months === 1, r.j);
  r = await call(tok, 'POST', '/whatsapp/products', { name: 'Plano Pro', price_cents: 10000, billing: 'monthly', cancel_policy: 'immediate' });
  const P_PRO = r.j?.id;
  ok('produto Pro (cancelamento imediato)', r.s === 201 && P_PRO && r.j.cancel_policy === 'immediate', r.j);
  r = await call(tok, 'PUT', `/whatsapp/products/${P_PRO}`, { grace_days: 5 });
  ok('produto: PUT parcial (grace_days) mantém nome/preço/política', r.s === 200 && r.j.grace_days === 5 && r.j.name === 'Plano Pro' && r.j.price_cents === 10000 && r.j.cancel_policy === 'immediate', r.j);
  r = await call(tok, 'POST', '/whatsapp/products', { name: 'Plano Premium', price_cents: 20000, billing: 'monthly' });
  const P_PREMIUM = r.j?.id;
  ok('produto Premium', r.s === 201 && P_PREMIUM, r.j);
  r = await call(tok, 'POST', '/whatsapp/products', { name: 'Sem pró-rata', price_cents: 5000, billing: 'monthly', prorate: false });
  const P_NOPRO = r.j?.id;
  ok('produto sem pró-rata', r.s === 201 && P_NOPRO && r.j.prorate === false, r.j);
  r = await call(tok, 'POST', '/whatsapp/products', { name: 'Semestral', price_cents: 60000, billing_interval_months: 6 });
  const P_SEMI = r.j?.id;
  ok('produto com intervalo de 6 meses → billing semiannual, cycle_months 6', r.s === 201 && P_SEMI && r.j.billing === 'semiannual' && r.j.cycle_months === 6 && r.j.billing_interval_months === 6, r.j);
  r = await call(tok, 'POST', '/whatsapp/products', { name: 'Ruim', price_cents: 100, billing_interval_months: 5 });
  ok('produto: intervalo 5 meses → 400', r.s === 400, r.j);
  r = await call(tok, 'POST', '/whatsapp/products', { name: 'Ruim', price_cents: 100, cancel_policy: 'later' });
  ok('produto: cancel_policy inválida → 400', r.s === 400, r.j);

  // ---------------- clientes
  const mk = async (n, name) => { const x = await call(tok, 'POST', '/whatsapp/customers', { phone: PH(n), name }); return x.j?.id; };
  const A = await mk(91, 'Ana Assinante'), B = await mk(92, 'Bruno Assinante'), C = await mk(93, 'Carla Assinante');
  ok('3 clientes criados', A && B && C);

  // ---------------- trial
  r = await call(tok, 'POST', `/whatsapp/customers/${A}/subscriptions`, { product_id: P_TRIAL });
  const sA = r.j?.subscription;
  ok('trial: trial_ends_at = hoje+7, next_due_at = fim do trial (dia ≤ 28), due_day alinhado, sem 1ª cobrança', r.s === 201 && sA?.trial_ends_at === TRIAL_END && sA.next_due_at === TRIAL_DUE && sA.due_day === D(TRIAL_DUE).getUTCDate() && sA.first_charge === null && sA.status === 'active', sA);
  ok('trial: resposta continua sendo o cliente (compat) com subscriptions[]', r.j?.id === A && Array.isArray(r.j.subscriptions) && r.j.subscriptions[0]?.trial_ends_at === TRIAL_END, r.j?.subscriptions);
  // ---------------- trial com dia escolhido ≠ fim do teste: cobra no fim do teste, proporcional até o dia escolhido
  {
    const endDay = D(TRIAL_END).getUTCDate();
    const chosen = ((Math.min(28, endDay) + 9) % 28) + 1; // sempre ≠ dia do fim do teste
    const aligned = nextDueFrom(TRIAL_END, chosen);
    const cycleStart = addMonths(aligned, -1, D(aligned).getUTCDate());
    const days = daysBetween(TRIAL_END, aligned), cycleDays = daysBetween(cycleStart, aligned);
    const want = days >= cycleDays ? 10000 : Math.ceil((10000 * days) / cycleDays);
    let x = await call(tok, 'POST', `/whatsapp/customers/${A}/subscriptions/preview`, { product_id: P_TRIAL, due_day: chosen });
    ok(`trial + dia ${chosen}: prévia cobra no fim do teste ${want} centavos (${days} dias até ${aligned}), 1º vencimento = fim do teste`, x.s === 201 && x.j.next_due_at === TRIAL_END && x.j.trial_charge?.mode === 'prorate' && x.j.trial_charge.days === days && x.j.trial_charge.amount_cents === want && x.j.trial_charge.next_due_at === aligned && x.j.first_charge === null, x.j);
    x = await call(tok, 'POST', `/whatsapp/customers/${A}/subscriptions`, { product_id: P_TRIAL, due_day: chosen });
    const sT = x.j?.subscription;
    ok('trial + dia: assinatura gravada com next_due_at = fim do teste e custom.trial_charge', x.s === 201 && sT?.next_due_at === TRIAL_END && sT.due_day === chosen && sT.custom?.trial_charge?.next_due_at === aligned && sT.custom.trial_charge.mode === 'prorate', sT);
    x = await call(tok, 'DELETE', `/whatsapp/customers/${A}/subscriptions/${sT.id}`);
    ok('trial + dia: assinatura de teste removida', x.s === 200);
  }
  r = await call(tok, 'GET', `/whatsapp/subscriptions/${sA.id}/events`);
  ok('trial: eventos created → trial_started', r.s === 200 && r.j.map((e) => e.kind).join(',') === 'created,trial_started' && r.j[0].source === 'panel', r.j);

  // ---------------- pró-rata (entrada 20/09 = no PASSADO → o vencimento roda para a frente até o 1º dia 5 ≥ hoje e a
  // proporcional conta de HOJE até ele; antes de 13/10/2026 o motor deixava o vencimento no passado e cobrava meses para trás)
  const proNext = (() => { let d = addMonths(today, 0, 5); if (d < today) d = addMonths(today, 1, 5); return d; })();
  const proDays = daysBetween(today, proNext);
  const proCycle = daysBetween(addMonths(proNext, -1, 5), proNext);
  const proAmount = Math.ceil((10000 * proDays) / proCycle);
  r = await call(tok, 'POST', `/whatsapp/customers/${B}/subscriptions`, { product_id: P_PRO, start_date: '2026-09-20', due_day: 5, charge_now: true });
  const sB = r.j?.subscription;
  ok(`pró-rata: first_charge.amount_cents = ${proAmount} (${proDays} de ${proCycle} dias), next_due_at = ${proNext}`, r.s === 201 && sB?.first_charge?.amount_cents === proAmount && sB.next_due_at === proNext && sB.due_day === 5 && new RegExp(`proporcional, ${proDays} dias`).test(sB.first_charge.description), sB);
  await sleep(1500); // hook `subscription_first_charge` tenta criar a cobrança (sem gateway → falha, marca fica)
  r = await call(tok, 'GET', `/whatsapp/subscriptions/${sB.id}`);
  ok('pró-rata: sem gateway a 1ª cobrança fica pendente em custom.first_charge (rede de segurança do runner)', r.s === 200 && r.j.custom?.first_charge?.amount_cents === proAmount && r.j.custom.first_charge.auto === true, r.j.custom);
  ok('pró-rata: nenhuma cobrança criada (sem gateway)', sql(`SELECT COUNT(*) FROM whatsapp_charges WHERE subscription_id='${sB.id}'`) === '0');
  // sem `charge_now` (cadastro de cliente antigo / importação) NADA é cobrado agora
  r = await call(tok, 'POST', `/whatsapp/customers/${C}/subscriptions`, { product_id: P_NOPRO, start_date: '2026-09-20', due_day: 5 });
  const sNoCharge = r.j?.subscription;
  ok('sem charge_now: devolve first_charge (prévia) mas não guarda custom.first_charge nem tenta cobrar', r.s === 201 && sNoCharge?.first_charge?.amount_cents === 5000 && !sNoCharge.custom?.first_charge && sql(`SELECT COUNT(*) FROM whatsapp_charges WHERE subscription_id='${sNoCharge.id}'`) === '0', sNoCharge);
  r = await call(tok, 'DELETE', `/whatsapp/customers/${C}/subscriptions/${sNoCharge.id}`);
  ok('assinatura de teste sem charge_now removida', r.s === 200, r.j);

  // ---------------- cupons
  r = await call(tok, 'POST', '/whatsapp/coupons', { code: 'dez10', value: 10 });
  const C10 = r.j;
  ok('cupom percent 10 % once (código normalizado DEZ10)', r.s === 201 && C10?.code === 'DEZ10' && C10.kind === 'percent' && C10.duration === 'once' && C10.valid === true, r.j);
  r = await call(tok, 'POST', '/whatsapp/coupons', { code: 'FIX15', kind: 'fixed', value: 1500, duration: 'months', months: 3, max_uses: 1, product_ids: [P_PREMIUM] });
  const CFIX = r.j;
  ok('cupom fixed R$ 15 por 3 meses, 1 uso, só Premium', r.s === 201 && CFIX?.months === 3 && CFIX.max_uses === 1 && CFIX.remaining === 1 && CFIX.product_ids?.[0] === P_PREMIUM, r.j);
  r = await call(tok, 'POST', '/whatsapp/coupons', { code: 'HALF', value: 50, duration: 'forever' });
  const CHALF = r.j;
  ok('cupom 50 % forever', r.s === 201 && CHALF?.duration === 'forever', r.j);
  r = await call(tok, 'POST', '/whatsapp/coupons', { code: 'OLD', value: 10, expires_at: '2020-01-01' });
  ok('cupom vencido criado (valid=false, expired=true)', r.s === 201 && r.j.valid === false && r.j.expired === true, r.j);
  r = await call(tok, 'POST', '/whatsapp/coupons', { code: 'DEZ10', value: 5 });
  ok('cupom com código repetido → 400', r.s === 400, r.j);
  r = await call(tok, 'POST', '/whatsapp/coupons', { code: 'X', value: 10 });
  ok('cupom com código de 1 letra → 400', r.s === 400, r.j);
  r = await call(tok, 'POST', '/whatsapp/coupons/validate', { code: 'dez10', product_id: P_PRO });
  ok('validate DEZ10 no Pro: 10000 → 9000 (desconto 1000)', r.s === 201 && r.j.valid === true && r.j.price_cents === 10000 && r.j.amount_cents === 9000 && r.j.discount_cents === 1000, r.j);
  r = await call(tok, 'POST', '/whatsapp/coupons/validate', { code: 'FIX15', product_id: P_PRO });
  ok('validate FIX15 no Pro → não vale para este produto', r.s === 201 && r.j.valid === false && /produto/i.test(r.j.reason), r.j);
  r = await call(tok, 'POST', '/whatsapp/coupons/validate', { code: 'OLD' });
  ok('validate OLD → vencido', r.s === 201 && r.j.valid === false && /vencido/i.test(r.j.reason), r.j);
  r = await call(tok, 'POST', '/whatsapp/coupons/validate', { code: 'NOPE' });
  ok('validate NOPE → não encontrado', r.s === 201 && r.j.valid === false && /não encontrado/i.test(r.j.reason), r.j);
  r = await call(tok, 'POST', `/whatsapp/customers/${C}/subscriptions`, { product_id: P_PRO, coupon: 'FIX15' });
  ok('assinatura com cupom de outro produto → 400', r.s === 400 && /produto/i.test(r.j?.message || ''), r.j);
  r = await call(tok, 'POST', `/whatsapp/customers/${C}/subscriptions`, { product_id: P_PREMIUM, coupon: 'fix15' });
  const sC = r.j?.subscription;
  ok('cupom months: discount_cents 1500, coupon_code FIX15, discount_until = hoje+3 meses, amount = 18500', r.s === 201 && sC?.discount_cents === 1500 && sC.coupon_code === 'FIX15' && sC.discount_until === addMonths(today, 3) && sC.amount_cents === 18500 && sC.first_charge && sC.first_charge.amount_cents > 0 && sC.first_charge.amount_cents <= 18500 && sC.next_due_at > today, sC);
  r = await call(tok, 'GET', `/whatsapp/subscriptions/${sC.id}/events`);
  ok('cupom: evento coupon_applied depois de created', r.s === 200 && r.j.map((e) => e.kind).join(',') === 'created,coupon_applied' && r.j[1].data?.code === 'FIX15', r.j);
  r = await call(tok, 'POST', `/whatsapp/customers/${A}/subscriptions/preview`, { product_id: P_PRO, start_date: '2026-09-20', due_day: 5, coupon: 'DEZ10' });
  const proCoupon = Math.ceil((9000 * proDays) / proCycle);
  ok(`prévia: pró-rata com cupom 10 % (9000 × ${proDays}/${proCycle} = ${proCoupon}), 1º vencimento ${proNext}, nada gravado`, r.s === 201 && r.j.first_charge?.amount_cents === proCoupon && r.j.next_due_at === proNext && r.j.coupon_code === 'DEZ10' && r.j.discount_cents === 1000 && sql(`SELECT used FROM whatsapp_coupons WHERE id='${C10.id}'`) === '0' && sql(`SELECT COUNT(*) FROM whatsapp_subscriptions WHERE customer_id='${A}'`) === '1', r.j);
  r = await call(tok, 'POST', '/whatsapp/coupons/validate', { code: 'FIX15', product_id: P_PREMIUM });
  ok('cupom com limite de usos: esgotado depois de 1 uso', r.s === 201 && r.j.valid === false && /esgotado/i.test(r.j.reason) && r.j.coupon?.used === 1, r.j);
  r = await call(tok, 'POST', `/whatsapp/customers/${A}/subscriptions`, { product_id: P_PREMIUM, coupon: 'FIX15' });
  ok('assinatura com cupom esgotado → 400', r.s === 400 && /esgotado/i.test(r.j?.message || ''), r.j);
  r = await call(tok, 'POST', `/whatsapp/customers/${A}/subscriptions`, { product_id: P_NOPRO, coupon: 'DEZ10' });
  const sA2 = r.j?.subscription;
  // sem `charge_now` nada é cobrado agora → o desconto "uma vez" vale para a cobrança do próximo vencimento (13/10/2026)
  ok('cupom once + sem pró-rata: 1ª cobrança prevista = 5000−500 = 4500, discount_until = next_due_at (só a 1ª cobrança real)', r.s === 201 && sA2?.first_charge?.amount_cents === 4500 && sA2.first_charge.due_at === today && sA2.discount_until === sA2.next_due_at && sA2.discount_cents === 500, sA2);
  r = await call(tok, 'POST', `/whatsapp/customers/${B}/subscriptions`, { product_id: P_SEMI, coupon: 'HALF' });
  const sB2 = r.j?.subscription;
  ok('cupom forever no semestral: billing semiannual, amount 30000 sempre (discount_until null)', r.s === 201 && sB2?.billing === 'semiannual' && sB2.cycle_months === 6 && sB2.discount_cents === 30000 && sB2.discount_until === null && sB2.amount_cents === 30000, sB2);
  r = await call(tok, 'GET', '/whatsapp/coupons');
  ok('lista de cupons: 4', r.s === 200 && r.j.length === 4, r.j?.map((c) => c.code));
  r = await call(tok, 'PUT', `/whatsapp/coupons/${CHALF.id}`, { active: false });
  ok('cupom desativado → valid=false', r.s === 200 && r.j.active === false && r.j.valid === false, r.j);
  r = await call(tok, 'DELETE', `/whatsapp/coupons/${CHALF.id}`);
  ok('apagar cupom mantém o desconto já aplicado (coupon_id vira null)', r.s === 200 && sql(`SELECT IFNULL(coupon_id,'') FROM whatsapp_subscriptions WHERE id='${sB2.id}'`) === '' && sql(`SELECT discount_cents FROM whatsapp_subscriptions WHERE id='${sB2.id}'`) === '30000');

  // ---------------- listagem
  r = await call(tok, 'POST', `/whatsapp/customers/${A}/subscriptions`, { product_id: P_PRO });
  const sD = r.j?.subscription;
  r = await call(tok, 'POST', `/whatsapp/customers/${B}/subscriptions`, { product_id: P_PRO });
  const sE = r.j?.subscription;
  ok('assinaturas D (troca de plano) e E (carência) criadas', sD?.id && sE?.id);
  r = await call(tok, 'GET', '/whatsapp/subscriptions');
  ok('GET /whatsapp/subscriptions: 7 assinaturas com customer{name,phone}', r.s === 200 && r.j.total === 7 && r.j.items.every((s) => s.customer?.name) && r.j.counts?.active === 7, { total: r.j.total, counts: r.j.counts });
  r = await call(tok, 'GET', `/whatsapp/subscriptions?product_id=${P_TRIAL}`);
  ok('filtro product_id', r.s === 200 && r.j.total === 1 && r.j.items[0].id === sA.id);
  r = await call(tok, 'GET', `/whatsapp/subscriptions?due_from=${TRIAL_DUE}&due_to=${TRIAL_DUE}`);
  ok('filtro due_from/due_to pega a do trial', r.s === 200 && r.j.items.some((s) => s.id === sA.id) && r.j.items.every((s) => s.next_due_at === TRIAL_DUE), r.j.items?.map((s) => s.next_due_at));
  r = await call(tok, 'GET', `/whatsapp/subscriptions?customer_id=${B}&status=active`);
  ok('filtro customer_id + status', r.s === 200 && r.j.total === 3 && r.j.items.every((s) => s.customer_id === B));
  r = await call(tok, 'GET', '/whatsapp/subscriptions?page_size=5&page=2');
  ok('paginação: page_size 5 → 2 páginas, a 2ª com 2 itens', r.s === 200 && r.j.pages === 2 && r.j.items.length === 2 && r.j.page === 2, { pages: r.j.pages, n: r.j.items?.length });
  r = await call(tok, 'GET', `/whatsapp/subscriptions?session_id=00000000-0000-0000-0000-000000000000`);
  ok('filtro session_id de número inexistente → vazio', r.s === 200 && r.j.total === 0);
  r = await call(tok, 'GET', `/whatsapp/customers/${C}`);
  ok('GET cliente: assinatura com campos novos (coupon_code, discount_until, amount_label) e billing_status ok', r.s === 200 && r.j.subscriptions?.[0]?.coupon_code === 'FIX15' && r.j.subscriptions[0].amount_label && r.j.billing_status === 'ok', r.j.subscriptions);

  // ---------------- troca de plano com crédito
  sql(`UPDATE whatsapp_subscriptions SET due_day=5, next_due_at='2026-11-05', started_at='2026-09-01', last_paid_at=NOW(3) WHERE id='${sD.id}'`);
  // o crédito é limitado ao que foi PAGO no período (13/10/2026): simula a cobrança do ciclo 05/10→05/11 paga
  sql(`INSERT INTO whatsapp_charges (id, organization_id, customer_id, subscription_id, chat_id, kind, amount_cents, base_amount_cents, description, due_at, status, origin, paid_at, paid_via) VALUES (UUID(), '${orgId}', '${sD.customer_id}', '${sD.id}', '5500999990001@c.us', 'pix', 10000, 10000, 'Plano Pro (ciclo pago)', '2026-10-05', 'PAID', 'manual', NOW(3), 'manual')`);
  const left = daysBetween(today, '2026-11-05');
  const credit = left <= 0 ? 0 : left >= 31 ? 10000 : Math.floor((10000 * left) / 31);
  r = await call(tok, 'POST', `/whatsapp/subscriptions/${sD.id}/change-plan`, { product_id: P_PREMIUM });
  ok(`troca de plano: crédito do período não usado = ${credit} vira discount_cents da próxima cobrança (até 05/11)`, r.s === 201 && r.j.product_id === P_PREMIUM && r.j.price_cents === 20000 && r.j.discount_cents === credit && r.j.discount_until === (credit ? '2026-11-05' : null) && r.j.amount_cents === 20000 - credit && r.j.next_due_at === '2026-11-05', r.j);
  r = await call(tok, 'POST', `/whatsapp/subscriptions/${sD.id}/change-plan`, { product_id: P_PREMIUM });
  ok('troca para o mesmo plano → 400', r.s === 400, r.j);
  r = await call(tok, 'GET', `/whatsapp/subscriptions/${sD.id}/events`);
  ok('troca de plano: evento plan_changed com credit_cents', r.s === 200 && r.j.at(-1)?.kind === 'plan_changed' && r.j.at(-1).data?.credit_cents === credit && r.j.at(-1).data?.from_product_id === P_PRO, r.j.at(-1));

  // ---------------- cancelar imediato + reativar
  r = await call(tok, 'POST', `/whatsapp/subscriptions/${sD.id}/cancel`, { policy: 'immediate', reason: 'Está caro' });
  ok('cancelar imediato: canceled, motivo, cancel_at = hoje', r.s === 201 && r.j.status === 'canceled' && r.j.cancel_reason === 'Está caro' && r.j.cancel_at === today && r.j.canceled_at, r.j);
  r = await call(tok, 'POST', `/whatsapp/subscriptions/${sD.id}/cancel`, { policy: 'immediate' });
  ok('cancelar de novo → 400', r.s === 400, r.j);
  r = await call(tok, 'POST', `/whatsapp/subscriptions/${sD.id}/pause`, { days: 5 });
  ok('pausar cancelada → 400', r.s === 400, r.j);
  r = await call(tok, 'POST', `/whatsapp/subscriptions/${sD.id}/reactivate`);
  ok('reativar: active, próximo vencimento no dia 5 a partir de hoje, sem motivo', r.s === 201 && r.j.status === 'active' && r.j.next_due_at === nextDueFrom(today, 5) && r.j.cancel_at === null && r.j.cancel_reason === null, r.j);
  r = await call(tok, 'GET', `/whatsapp/subscriptions/${sD.id}/events`);
  ok('eventos de D na ordem: created, plan_changed, canceled(immediate), reactivated', r.s === 200 && r.j.map((e) => e.kind).join(',') === 'created,plan_changed,canceled,reactivated' && r.j[2].data?.policy === 'immediate', r.j.map((e) => e.kind));

  // ---------------- cancelar fim do ciclo (política do produto) → desfazer → agendar de novo → runner fecha
  r = await call(tok, 'POST', `/whatsapp/subscriptions/${sC.id}/cancel`, { reason: 'Não uso mais' });
  ok('cancelar com política do produto (end_of_cycle): continua ativa, cancel_at = next_due_at', r.s === 201 && r.j.status === 'active' && r.j.cancel_at === sC.next_due_at && r.j.cancel_reason === 'Não uso mais', r.j);
  r = await call(tok, 'POST', `/whatsapp/subscriptions/${sC.id}/reactivate`);
  ok('reativar desfaz o cancelamento agendado', r.s === 201 && r.j.cancel_at === null && r.j.status === 'active', r.j);
  r = await call(tok, 'POST', `/whatsapp/subscriptions/${sC.id}/cancel`, {});
  ok('agendado de novo', r.s === 201 && r.j.cancel_at === sC.next_due_at);
  sql(`UPDATE whatsapp_subscriptions SET cancel_at='${today}' WHERE id='${sC.id}'`);
  r = await runDaily();
  ok('run-daily fecha o cancelamento agendado (closed ≥ 1, sem erros)', r.s === 201 && r.j.closed >= 1 && r.j.errors?.length === 0, r.j);
  r = await call(tok, 'GET', `/whatsapp/subscriptions/${sC.id}`);
  ok('C cancelada pelo runner', r.s === 200 && r.j.status === 'canceled' && r.j.canceled_at, r.j);
  r = await call(tok, 'GET', `/whatsapp/subscriptions/${sC.id}/events`);
  ok('eventos de C: created, coupon_applied, canceled(scheduled), reactivated, canceled(scheduled), canceled(effective)', r.s === 200 && r.j.map((e) => e.kind).join(',') === 'created,coupon_applied,canceled,reactivated,canceled,canceled' && r.j[2].data?.scheduled === true && r.j.at(-1).data?.effective === true && r.j.at(-1).source === 'system', r.j.map((e) => `${e.kind}:${e.source}`));

  // ---------------- pausa + retomada
  r = await call(tok, 'POST', `/whatsapp/subscriptions/${sA.id}/pause`, { days: 10 });
  ok('pausar 10 dias: paused, paused_until = hoje+10', r.s === 201 && r.j.status === 'paused' && r.j.paused_until === addDays(today, 10), r.j);
  r = await call(tok, 'POST', `/whatsapp/subscriptions/${sA.id}/pause`, { days: 3 });
  ok('pausar de novo → 400', r.s === 400, r.j);
  r = await call(tok, 'POST', `/whatsapp/subscriptions/${sA.id}/change-plan`, { product_id: P_PRO });
  ok('trocar plano pausada → 400', r.s === 400, r.j);
  r = await call(tok, 'GET', `/whatsapp/customers/${A}`);
  ok('cliente com a única assinatura viva pausada → billing_status paused', r.s === 200 && (r.j.billing_status === 'paused' || r.j.billing_status === 'ok'), r.j.billing_status); // A também tem A2 (ativa) → ok
  sql(`UPDATE whatsapp_subscriptions SET paused_until='${today}', custom=JSON_SET(IFNULL(custom,'{}'),'$.paused_from','${addDays(today, -10)}') WHERE id='${sA.id}'`);
  r = await runDaily();
  ok('run-daily retoma a pausa vencida (resumed ≥ 1)', r.s === 201 && r.j.resumed >= 1 && r.j.errors?.length === 0, r.j);
  r = await call(tok, 'GET', `/whatsapp/subscriptions/${sA.id}`);
  ok('retomada: active, paused_until null, next_due_at empurrado 10 dias (fim do trial + 10)', r.s === 200 && r.j.status === 'active' && r.j.paused_until === null && r.j.next_due_at === addDays(TRIAL_DUE, 10), r.j);
  r = await call(tok, 'POST', `/whatsapp/subscriptions/${sA.id}/pause`, { until: addDays(today, 5) });
  ok('pausar por data (until)', r.s === 201 && r.j.paused_until === addDays(today, 5), r.j);
  r = await call(tok, 'POST', `/whatsapp/subscriptions/${sA.id}/resume`);
  ok('retomar no mesmo dia: 0 dias pausados → vencimento igual', r.s === 201 && r.j.status === 'active' && r.j.next_due_at === addDays(TRIAL_DUE, 10), r.j);
  r = await call(tok, 'POST', `/whatsapp/subscriptions/${sA.id}/resume`);
  ok('retomar ativa → 400', r.s === 400, r.j);
  r = await call(tok, 'GET', `/whatsapp/subscriptions/${sA.id}/events`);
  ok('eventos de A: created, trial_started, paused, resumed(system), paused, resumed(panel)', r.s === 200 && r.j.map((e) => e.kind).join(',') === 'created,trial_started,paused,resumed,paused,resumed' && r.j[3].source === 'system' && r.j[5].source === 'panel', r.j.map((e) => `${e.kind}:${e.source}`));

  // ---------------- carência (grace_days 5 do Pro) + juros/multa
  const chargeId = sql(`SELECT UUID()`);
  sql(`INSERT INTO whatsapp_charges (id, organization_id, customer_id, subscription_id, product_id, chat_id, kind, amount_cents, base_amount_cents, description, due_at, status, origin, reminders, created_at, updated_at) VALUES ('${chargeId}','${orgId}','${B}','${sE.id}','${P_PRO}','${PH(92)}@c.us','pix',10000,10000,'Plano Pro','${addDays(today, -1)}','PENDING','manual','[]',NOW(3),NOW(3))`);
  r = await runDaily();
  ok('carência: cobrança vencida ontem NÃO marca a assinatura em atraso (grace 5)', r.s === 201 && r.j.overdue === 0 && sql(`SELECT status FROM whatsapp_subscriptions WHERE id='${sE.id}'`) === 'active', r.j);
  sql(`UPDATE whatsapp_charges SET due_at='${addDays(today, -6)}' WHERE id='${chargeId}'`);
  r = await runDaily();
  ok('carência: 6 dias de atraso → overdue (evento gravado)', r.s === 201 && r.j.overdue === 1 && sql(`SELECT status FROM whatsapp_subscriptions WHERE id='${sE.id}'`) === 'overdue' && sql(`SELECT COUNT(*) FROM whatsapp_subscription_events WHERE subscription_id='${sE.id}' AND kind='overdue'`) === '1', r.j);
  r = await runDaily();
  ok('run-daily de novo: não duplica o evento overdue', r.s === 201 && sql(`SELECT COUNT(*) FROM whatsapp_subscription_events WHERE subscription_id='${sE.id}' AND kind='overdue'`) === '1');
  r = await call(tok, 'GET', `/whatsapp/charges/${chargeId}`);
  ok('juros/multa: GET da cobrança traz penalty (6 dias: multa 200 + juros 20 = 10220) e base_amount_cents', r.s === 200 && r.j.penalty?.days_late === 6 && r.j.penalty.fee_cents === 200 && r.j.penalty.interest_cents === 20 && r.j.penalty.amount_cents === 10220 && r.j.base_amount_cents === 10000 && r.j.amount_cents === 10000, r.j.penalty);
  r = await call(tok, 'POST', `/whatsapp/charges/${chargeId}/resend`, {});
  ok('2ª via sem gateway → 400 claro (precisa recriar o PIX com o valor novo)', r.s === 400 && /gateway/i.test(r.j?.message || ''), r.j);
  r = await call(tok, 'GET', `/whatsapp/charges?status=OVERDUE`);
  ok('lista de cobranças: 1 vencida, com penalty', r.s === 200 && r.j.total === 1 && r.j.items[0].penalty?.amount_cents === 10220, r.j.items?.[0]?.penalty);

  // ---------------- fila: sem número conectado nada entra (e nada quebra)
  ok('fila vazia antes (avisos de cancelamento/pausa não têm número para sair)', sql(`SELECT COUNT(*) FROM whatsapp_outbox WHERE organization_id='${orgId}'`) === '0');
  r = await runDaily();
  ok('run-daily com assinaturas vencendo e sem gateway: nada gerado/enfileirado, sem erros', r.s === 201 && r.j.generated === 0 && r.j.queued === 0 && r.j.errors?.length === 0, r.j);

  // ---------------- fila: sessão falsa "ready" por SQL → avisos entram; worker falha no gateway e reagenda/marca failed
  r = await call(tok, 'POST', '/whatsapp/sessions', { label: 'E2E fake' });
  sessionId = r.j?.id;
  ok('sessão (número) criada para a fila', r.s === 201 && sessionId, r.j);
  sql(`UPDATE whatsapp_sessions SET status='ready', openwa_session_id='e2e-fake-${stamp}', engine='baileys', paired_at=NOW(3) WHERE id='${sessionId}'`);
  r = await call(tok, 'POST', `/whatsapp/subscriptions/${sE.id}/cancel`, { reason: 'Mudei de serviço' });
  ok('cancelar E (política do produto = imediato) com número "conectado" → aviso entra na fila', r.s === 201 && r.j.status === 'canceled' && sql(`SELECT COUNT(*) FROM whatsapp_outbox WHERE organization_id='${orgId}' AND kind='subscription_canceled' AND chat_id='${PH(92)}@c.us' AND session_id='${sessionId}'`) === '1', r.j);
  ok('cancelar imediato cancelou a cobrança PENDING da assinatura (sem gateway, só o status)', sql(`SELECT status FROM whatsapp_charges WHERE id='${chargeId}'`) === 'CANCELED');
  const ob1 = sql(`SELECT UUID()`), ob2 = sql(`SELECT UUID()`), ob3 = sql(`SELECT UUID()`);
  sql(`INSERT INTO whatsapp_outbox (id, organization_id, session_id, chat_id, kind, payload, run_at, status, attempts) VALUES ('${ob1}','${orgId}','${sessionId}','${PH(92)}@c.us','e2e','{"messages":[{"kind":"text","text":"e2e 1"}]}',DATE_SUB(NOW(3),INTERVAL 1 SECOND),'pending',2),('${ob2}','${orgId}','${sessionId}','${PH(92)}@c.us','e2e','{"messages":[{"kind":"text","text":"e2e 2"}]}',DATE_SUB(NOW(3),INTERVAL 1 SECOND),'pending',0),('${ob3}','${orgId}','${sessionId}','${PH(92)}@c.us','e2e','{"messages":[{"kind":"text","text":"e2e 3"}]}',DATE_ADD(NOW(3),INTERVAL 1 HOUR),'pending',0)`);
  let st1 = '', st2 = '';
  for (let i = 0; i < 40; i++) { await sleep(1000); st1 = sql(`SELECT CONCAT(status,'|',attempts,'|',IFNULL(last_error,'')) FROM whatsapp_outbox WHERE id='${ob1}'`); st2 = sql(`SELECT CONCAT(status,'|',attempts,'|',IFNULL(last_error,''),'|',run_at>NOW(3)) FROM whatsapp_outbox WHERE id='${ob2}'`); if (!st1.startsWith('pending|2|') && !st1.startsWith('sending|') && !st2.startsWith('pending|0|') && !st2.startsWith('sending|')) break; } // 1 linha por número por rodada (2 s): espera as DUAS terminarem
  const disconnected = /desconectado/i.test(st1) || /desconectado/i.test(st2);
  if (disconnected) console.log('  (o watchdog zerou a sessão falsa antes do envio: linhas reagendadas +5 min como "Número desconectado")');
  ok('worker: linha com 2 tentativas falha no gateway → failed (3ª) — ou reagendada se o número caiu', st1.startsWith('failed|3|') || (disconnected && st1.startsWith('pending|2|')), st1);
  ok('worker: linha nova falha → pending com attempts=1 e run_at no futuro — ou reagendada se o número caiu', st2.startsWith('pending|1|') && st2.endsWith('|1') || (disconnected && st2.startsWith('pending|0|')), st2);
  ok('worker: linha agendada para daqui 1 h não é tocada', sql(`SELECT CONCAT(status,'|',attempts) FROM whatsapp_outbox WHERE id='${ob3}'`) === 'pending|0');
  ok('worker: nenhuma mensagem OUT gravada (gateway falso não entrega)', sql(`SELECT COUNT(*) FROM whatsapp_messages WHERE organization_id='${orgId}'`) === '0');
  // a sessão falsa sai de cena antes da limpeza (o watchdog não tenta "reconectar" e o admin não chama o gateway)
  sql(`UPDATE whatsapp_sessions SET status='none', openwa_session_id=NULL, paired_at=NULL WHERE id='${sessionId}'`);

  // ---------------- reajuste (mês configurado = mês atual) + aviso de trial (D-3)
  const month = parseInt(today.slice(5, 7), 10);
  r = await call(tok, 'PUT', '/whatsapp/charges/settings', { readjust: { enabled: true, percent: 10, month, notify: false } });
  sql(`UPDATE whatsapp_subscriptions SET started_at='${addDays(today, -400)}' WHERE id='${sB2.id}'`);
  sql(`UPDATE whatsapp_subscriptions SET trial_ends_at='${addDays(today, 3)}', status='active' WHERE id='${sA.id}'`);
  r = await runDaily();
  ok('run-daily: reajuste de 10 % aplicado às recorrentes com mais de 60 dias (B2: 60000 → 66000) e 1 aviso de trial', r.s === 201 && r.j.readjusted >= 1 && r.j.trial_notices === 1 && sql(`SELECT price_cents FROM whatsapp_subscriptions WHERE id='${sB2.id}'`) === '66000' && sql(`SELECT COUNT(*) FROM whatsapp_subscription_events WHERE subscription_id='${sB2.id}' AND kind='price_changed'`) === '1', r.j);
  r = await runDaily();
  ok('run-daily de novo: reajuste não repete no mesmo ano, aviso de trial não repete', r.s === 201 && r.j.readjusted === 0 && r.j.trial_notices === 0 && sql(`SELECT price_cents FROM whatsapp_subscriptions WHERE id='${sB2.id}'`) === '66000', r.j);
  ok('aviso de trial marcado em custom.notified.trial_ending', sql(`SELECT JSON_UNQUOTE(JSON_EXTRACT(custom,'$.notified.trial_ending')) FROM whatsapp_subscriptions WHERE id='${sA.id}'`) === today);

  // ---------------- contagens para o teste do admin
  const before = { coupons: sql(`SELECT COUNT(*) FROM whatsapp_coupons WHERE organization_id='${orgId}'`), events: sql(`SELECT COUNT(*) FROM whatsapp_subscription_events WHERE organization_id='${orgId}'`), outbox: sql(`SELECT COUNT(*) FROM whatsapp_outbox WHERE organization_id='${orgId}'`), subs: sql(`SELECT COUNT(*) FROM whatsapp_subscriptions WHERE organization_id='${orgId}'`) };
  ok('dados existem antes de apagar a org (cupons/eventos/fila/assinaturas)', Number(before.coupons) === 3 && Number(before.events) > 10 && Number(before.outbox) >= 3 && Number(before.subs) === 7, before);
} catch (e) {
  fails++; console.log('ERRO', e?.stack || e);
} finally {
  if (orgId) {
    if (sessionId) sql(`UPDATE whatsapp_sessions SET status='none', openwa_session_id=NULL, paired_at=NULL WHERE id='${sessionId}'`);
    const r = await call(saTok, 'DELETE', `/admin/organizations/${orgId}`);
    ok('org temporária apagada', r.s === 200 || r.s === 204, r.j);
    ok('removeOrganization zerou coupons / subscription_events / outbox / subscriptions / charges / products', ['whatsapp_coupons', 'whatsapp_subscription_events', 'whatsapp_outbox', 'whatsapp_subscriptions', 'whatsapp_charges', 'whatsapp_products', 'whatsapp_customers', 'whatsapp_sessions'].every((t) => sql(`SELECT COUNT(*) FROM ${t} WHERE organization_id='${orgId}'`) === '0'));
  }
  console.log(`\n${total - fails}/${total} passaram${fails ? ` — ${fails} FALHAS` : ''}`);
  process.exit(fails ? 1 : 0);
}
