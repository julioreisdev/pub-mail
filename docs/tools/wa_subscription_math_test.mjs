// Tabela de casos da matemática do motor de assinatura (Fase 3) — datas FIXAS, sem Date.now().
//   cd back && yarn nest build && node ../docs/tools/wa_subscription_math_test.mjs
// Importa as funções puras do dist (`wa-subscription-math.util.js`). Saída: PASS/FAIL por caso + "N/N".
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const M = require(path.resolve(here, '../../back/dist/src/whatsapp/wa-subscription-math.util.js'));

let total = 0, fails = 0;
const eq = (label, got, want) => {
  total++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

// ---- pró-rata (preço × dias até o 1º vencimento ÷ dias do ciclo que termina nele, ceil)
eq('pró-rata: entrada 20/09 com vencimento dia 5 = 15 dias de 30 → R$ 50,00 de R$ 100,00', M.prorateCents(10000, '2026-09-20', '2026-10-05', 1), 5000);
eq('pró-rata: mês de 31 dias (20/10 → 05/11 = 16 de 31) → ceil(5161,29) = 5162', M.prorateCents(10000, '2026-10-20', '2026-11-05', 1), 5162);
eq('pró-rata: ano bissexto (10/02/2028 → 01/03/2028 = 20 de 29) → ceil(6896,55) = 6897', M.prorateCents(10000, '2028-02-10', '2028-03-01', 1), 6897);
eq('pró-rata: trimestral (20/01 → 05/02 = 16 de 92) → ceil(5217,39) = 5218', M.prorateCents(30000, '2026-01-20', '2026-02-05', 3), 5218);
eq('pró-rata: anual (01/03 → 10/03 = 9 de 365) → ceil(2958,90) = 2959', M.prorateCents(120000, '2026-03-01', '2026-03-10', 12), 2959);
eq('pró-rata: anual cruzando bissexto (01/03/2027 → 10/03/2028 = 375 ≥ 366) → preço cheio', M.prorateCents(120000, '2027-03-01', '2028-03-10', 12), 120000);
eq('pró-rata: 0 dias → 0', M.prorateCents(10000, '2026-10-05', '2026-10-05', 1), 0);
eq('pró-rata: dias ≥ ciclo → preço cheio', M.prorateCents(10000, '2026-08-01', '2026-10-05', 1), 10000);

// ---- juros + multa (multa 2 % fixa + juros 1 %/mês pro rata die, ceil em centavos)
eq('juros/multa: 0 dias de atraso → sem encargos', M.penaltyBreakdown(10000, '2026-10-05', '2026-10-05', 2, 1), { amount_cents: 10000, base_cents: 10000, fee_cents: 0, interest_cents: 0, days_late: 0 });
eq('juros/multa: 1 dia → multa 200 + juros ceil(3,33) = 4 → 10204', M.penaltyBreakdown(10000, '2026-10-05', '2026-10-06', 2, 1), { amount_cents: 10204, base_cents: 10000, fee_cents: 200, interest_cents: 4, days_late: 1 });
eq('juros/multa: 15 dias → multa 200 + juros 50 → 10250', M.penaltyBreakdown(10000, '2026-10-05', '2026-10-20', 2, 1), { amount_cents: 10250, base_cents: 10000, fee_cents: 200, interest_cents: 50, days_late: 15 });
eq('juros/multa: 45 dias → multa 200 + juros 150 → 10350', M.penaltyBreakdown(10000, '2026-10-05', '2026-11-19', 2, 1), { amount_cents: 10350, base_cents: 10000, fee_cents: 200, interest_cents: 150, days_late: 45 });
eq('juros/multa: antes do vencimento → 0 (dias negativos viram 0)', M.penaltyCents(10000, '2026-10-05', '2026-10-01', 2, 1), 0);
eq('juros/multa: penaltyCents = multa + juros (15 dias) = 250', M.penaltyCents(10000, '2026-10-05', '2026-10-20', 2, 1), 250);
eq('juros/multa: sem multa e sem juros configurados → 0', M.penaltyCents(10000, '2026-10-05', '2026-11-05', 0, 0), 0);

// ---- crédito de troca de plano (preço × dias restantes ÷ dias do período, floor)
eq('crédito: período 05/10→05/11 (31 d), hoje 20/10 → 16 dias → floor(5161,29) = 5161', M.creditCents(10000, '2026-10-05', '2026-11-05', '2026-10-20'), 5161);
eq('crédito: hoje = início do período → preço cheio', M.creditCents(10000, '2026-10-05', '2026-11-05', '2026-10-05'), 10000);
eq('crédito: hoje ≥ vencimento → 0', M.creditCents(10000, '2026-10-05', '2026-11-05', '2026-11-05'), 0);

// ---- cupom
eq('cupom percent 10 % em 99,90 → desconto 9,99', M.applyCoupon(9990, { kind: 'percent', value: 10 }), { amount_cents: 8991, discount_cents: 999 });
eq('cupom fixed 15,00 em 99,90 → 84,90', M.applyCoupon(9990, { kind: 'fixed', value: 1500 }), { amount_cents: 8490, discount_cents: 1500 });
eq('cupom fixed maior que o preço → zera (nunca negativo)', M.applyCoupon(1000, { kind: 'fixed', value: 1500 }), { amount_cents: 0, discount_cents: 1000 });
eq('cupom percent > 100 é limitado a 100 %', M.applyCoupon(1000, { kind: 'percent', value: 150 }), { amount_cents: 0, discount_cents: 1000 });
eq('cupom once → vale até a 1ª cobrança', M.couponUntil({ kind: 'percent', value: 10, duration: 'once' }, '2026-09-20', '2026-09-20'), '2026-09-20');
eq('cupom months 3 a partir de 31/01 → 30/04 (abril tem 30)', M.couponUntil({ kind: 'percent', value: 10, duration: 'months', months: 3 }, '2026-01-31', '2026-02-05'), '2026-04-30');
eq('cupom forever → sem fim', M.couponUntil({ kind: 'percent', value: 10, duration: 'forever' }, '2026-01-31', '2026-02-05'), null);
eq('desconto vigente: cobrança no último dia válido → sim', M.discountActive(500, '2026-10-05', '2026-10-05'), true);
eq('desconto vigente: cobrança um dia depois → não', M.discountActive(500, '2026-10-05', '2026-10-06'), false);
eq('desconto vigente: sem data de fim → sempre', M.discountActive(500, null, '2030-01-01'), true);
eq('desconto vigente: zero → nunca', M.discountActive(0, null, '2026-10-05'), false);

// ---- pausa / datas
eq('retomada de pausa: 20/10→30/10 pausados empurram 05/11 para 15/11', M.nextDueAfterPause('2026-11-05', '2026-10-20', '2026-10-30'), '2026-11-15');
eq('retomada de pausa: retomada no mesmo dia → não empurra', M.nextDueAfterPause('2026-11-05', '2026-10-20', '2026-10-20'), '2026-11-05');
eq('próximo vencimento dia 5 a partir de 20/09 → 05/10', M.nextDueFromDate('2026-09-20', 5), '2026-10-05');
eq('próximo vencimento dia 5 a partir do próprio dia 5 → mesmo dia', M.nextDueFromDate('2026-09-05', 5), '2026-09-05');
eq('somar 1 mês a 31/01 → 28/02 (sem dia fixo, limita ao fim do mês)', M.addMonths('2026-01-31', 1), '2026-02-28');
eq('somar 1 mês a 31/01 com dia 5 → 05/02', M.addMonths('2026-01-31', 1, 5), '2026-02-05');
eq('subtrair 1 mês de 05/03/2028 (bissexto) → 05/02/2028', M.addMonths('2028-03-05', -1, 5), '2028-02-05');
eq('dias entre 05/10 e 05/11 = 31', M.daysBetween('2026-10-05', '2026-11-05'), 31);
eq('ciclo por produto: intervalo 6 → 6; enum quarterly → 3; once → 0', [M.cycleMonthsOf('monthly', 6), M.cycleMonthsOf('quarterly', null), M.cycleMonthsOf('once', null)], [6, 3, 0]);
eq('reajuste 7,5 % em 99,90 → ceil(107,3925) = 107,40', M.readjustCents(9990, 7.5), 10740);
eq('fmtDateBR', M.fmtDateBR('2026-10-05'), '05/10/2026');
// isDateStr exige data REAL (o Date do JS aceitaria "2026-02-30" e viraria 2 de março)
eq('isDateStr: 2026-02-30 não existe → false', M.isDateStr('2026-02-30'), false);
eq('isDateStr: 2028-02-29 (bissexto) → true; 2027-02-29 → false', [M.isDateStr('2028-02-29'), M.isDateStr('2027-02-29')], [true, false]);

console.log(`\n${total - fails}/${total}${fails ? ` — ${fails} FALHAS` : ''}`);
process.exit(fails ? 1 : 0);
