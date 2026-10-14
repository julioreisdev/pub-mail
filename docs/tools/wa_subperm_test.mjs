// Teste PURO das sub-permissões do WhatsApp (Fase 7): node docs/tools/wa_subperm_test.mjs
import assert from 'node:assert/strict';
import * as M from '../../back/src/platform-billing/modules.const.ts';
let ok = 0, fail = 0;
const t = (n, fn) => { try { fn(); ok++; } catch (e) { fail++; console.log(`✗ ${n}\n   ${e.message}`); } };
t('só whatsapp = as três (compatível)', () => assert.deepEqual(M.normalizeSubPermissions(['whatsapp']), ['whatsapp:finance', 'whatsapp:crm', 'whatsapp:settings']));
t('sem whatsapp = nenhuma', () => assert.deepEqual(M.normalizeSubPermissions(['email', 'whatsapp:finance']), []));
t('escolhidas', () => assert.deepEqual(M.normalizeSubPermissions(['whatsapp', 'whatsapp:crm']), ['whatsapp:crm']));
t('marcador = nenhuma', () => assert.deepEqual(M.normalizeSubPermissions(['whatsapp', 'whatsapp:basic']), []));
t('gravação com nenhuma escolhida põe marcador', () => assert.deepEqual(M.normalizeModuleList(['whatsapp', 'whatsapp:basic']), ['whatsapp', 'whatsapp:basic']));
t('gravação só whatsapp = três', () => assert.deepEqual(M.normalizeModuleList(['whatsapp']), ['whatsapp', 'whatsapp:finance', 'whatsapp:crm', 'whatsapp:settings']));
t('gravação sem whatsapp descarta sub', () => assert.deepEqual(M.normalizeModuleList(['email', 'whatsapp:crm']), ['email']));
t('normalizeModules ignora sub', () => assert.deepEqual(M.normalizeModules(['whatsapp', 'whatsapp:crm']), ['whatsapp']));
const cases = [
  ['/whatsapp/charges', 'GET', 'whatsapp:finance'], ['/whatsapp/charges/abc/resend', 'POST', 'whatsapp:finance'], ['/whatsapp/finance/export', 'GET', 'whatsapp:finance'],
  ['/whatsapp/customers', 'GET', 'whatsapp:crm'], ['/whatsapp/customers/by-chat/x', 'GET', null], ['/whatsapp/customers/lookup', 'GET', null], ['/whatsapp/customers/1', 'PATCH', 'whatsapp:crm'],
  ['/whatsapp/products', 'GET', null], ['/whatsapp/products', 'POST', 'whatsapp:crm'], ['/whatsapp/coupons', 'GET', 'whatsapp:crm'],
  ['/whatsapp/sessions', 'GET', null], ['/whatsapp/sessions/1', 'PUT', 'whatsapp:settings'], ['/whatsapp/bot/flows/1', 'PUT', 'whatsapp:settings'], ['/whatsapp/bot/simulate', 'POST', null],
  ['/whatsapp/orders/abc/mark-paid', 'POST', 'whatsapp:finance'], ['/whatsapp/orders/abc/status', 'POST', null], ['/whatsapp/orders', 'POST', null],
  ['/whatsapp/customers/abc/payment-methods', 'GET', 'whatsapp:finance'], ['/whatsapp/customers/abc/payment-methods/x', 'DELETE', 'whatsapp:finance'],
  ['/whatsapp/subscriptions', 'GET', 'whatsapp:crm'], ['/whatsapp/subscriptions/1/events', 'GET', 'whatsapp:crm'], ['/whatsapp/subscriptions/1/cancel', 'POST', 'whatsapp:crm'],
  ['/whatsapp/metrics', 'GET', null], ['/whatsapp/ratings', 'GET', null], ['/whatsapp/entitlements', 'GET', 'whatsapp:crm'], ['/whatsapp/entitlements/1/retry', 'POST', 'whatsapp:crm'],
  ['/whatsapp/customer-pick', 'GET', null],
  [M.normalizeApiPath('/WhatsApp/Orders/ABC/Mark-Paid/'), 'POST', 'whatsapp:finance'],
  ['/whatsapp/tickets/settings', 'PUT', 'whatsapp:settings'], ['/whatsapp/tickets', 'POST', null], ['/whatsapp/chats', 'GET', null], ['/whatsapp/chargesx', 'GET', null],
];
for (const [p, m, want] of cases) t(`${m} ${p} → ${want}`, () => assert.equal(M.subPermissionFor(p, m), want));
console.log(`\n${ok}/${ok + fail} passaram${fail ? ` — ${fail} FALHAS` : ''}`);
process.exit(fail ? 1 : 0);
