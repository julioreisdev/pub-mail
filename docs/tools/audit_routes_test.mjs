// Testes do mapa de rotas da auditoria (Fase 8, §12.4) — função PURA, roda no Mac sem build:
//   node docs/tools/audit_routes_test.mjs
// (Node ≥ 22.18/23.6 remove os tipos do .ts sozinho.)
import { auditRouteFor, summaryFor, sanitize, capJson, diffRows, recordName, MASK } from '../../back/src/audit/audit-routes.util.ts';

let ok = 0, fail = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { ok++; } else { fail++; console.log(`FALHOU ${name}\n  recebido: ${g}\n  esperado: ${w}`); }
};
const r = (m, p) => { const x = auditRouteFor(m, p); return x ? [x.entity, x.entityId, x.action, x.customerId, x.actor] : null; };
const U = '1b2c3d4e-0000-4000-8000-00000000abcd';
const V = '9f8e7d6c-1111-4111-8111-111111111111';

// leituras e fora do escopo
eq('GET não audita', r('GET', `/whatsapp/customers/${U}`), null);
eq('fora do escopo', r('POST', '/auth/login'), null);
eq('team fora', r('POST', '/team/chats/dm'), null);
eq('webhook fora', r('POST', '/webhooks/whatsapp/abc'), null);
eq('payments webhook fora', r('POST', '/payments/webhook/asaas'), null);

// ruidosas
eq('envio no chat', r('POST', '/whatsapp/messages/send'), null);
eq('reação', r('POST', `/whatsapp/messages/${U}/react`), null);
eq('lido', r('POST', `/whatsapp/chats/${U}/read`), null);
eq('digitando', r('POST', `/whatsapp/chats/${U}/typing`), null);
eq('simulador', r('POST', '/whatsapp/bot/simulate'), null);
eq('upload mídia', r('POST', '/whatsapp/media'), null);
eq('preview assinatura', r('POST', `/whatsapp/customers/${U}/subscriptions/preview`), null);
eq('erase (serviço grava)', r('POST', `/whatsapp/customers/${U}/erase`), null);
eq('fila linha retry', r('POST', `/whatsapp/outbox/${U}/retry`), null);
eq('fila linha cancel', r('POST', `/whatsapp/outbox/${U}/cancel`), null);
eq('api mensagem', r('POST', '/api/v1/whatsapp/messages'), null);
eq('cupom validar', r('POST', '/whatsapp/coupons/validate'), null);
eq('teste gateway', r('POST', '/payments/settings/test'), null);
eq('teste webhook saída', r('POST', `/org/webhooks/${U}/test`), null);

// CRM
eq('cria cliente', r('POST', '/whatsapp/customers'), ['customers', null, 'customers.create', null, 'user']);
eq('altera cliente', r('PUT', `/whatsapp/customers/${U}`), ['customers', U, 'customers.update', null, 'user']);
eq('apaga cliente', r('DELETE', `/whatsapp/customers/${U}`), ['customers', U, 'customers.delete', null, 'user']);
eq('import clientes', r('POST', '/whatsapp/customers/import'), ['customers', null, 'customers.import', null, 'user']);
eq('vincula número', r('POST', `/whatsapp/customers/${U}/contacts`), ['customers', U, 'customers.contacts.create', U, 'user']);
eq('papel número', r('PATCH', `/whatsapp/customers/${U}/contacts/${V}`), ['customers', U, 'customers.contacts.update', U, 'user']);
eq('desvincula', r('DELETE', `/whatsapp/customers/${U}/contacts/${V}`), ['customers', U, 'customers.contacts.delete', U, 'user']);
eq('nova assinatura', r('POST', `/whatsapp/customers/${U}/subscriptions`), ['subscriptions', null, 'subscriptions.create', U, 'user']);
eq('edita assinatura (legado)', r('PUT', `/whatsapp/customers/${U}/subscriptions/${V}`), ['subscriptions', V, 'subscriptions.update', U, 'user']);
eq('cancela assinatura', r('POST', `/whatsapp/subscriptions/${V}/cancel`), ['subscriptions', V, 'subscriptions.cancel', null, 'user']);
eq('troca plano', r('POST', `/whatsapp/subscriptions/${V}/change-plan`), ['subscriptions', V, 'subscriptions.change-plan', null, 'user']);
eq('produto', r('PUT', `/whatsapp/products/${U}`), ['products', U, 'products.update', null, 'user']);
eq('cupom', r('POST', '/whatsapp/coupons'), ['coupons', null, 'coupons.create', null, 'user']);
eq('unidades reorder', r('PUT', '/whatsapp/units/reorder'), ['units', null, 'units.reorder', null, 'user']);
eq('cobrança baixa', r('POST', `/whatsapp/charges/${U}/mark-paid`), ['charges', U, 'charges.mark-paid', null, 'user']);
eq('cobrança settings', r('PUT', '/whatsapp/charges/settings'), ['charges.settings', null, 'charges.settings.update', null, 'user']);
eq('rotina diária', r('POST', '/whatsapp/charges/run-daily'), ['charges', null, 'charges.run-daily', null, 'user']);
eq('cartão removido', r('DELETE', `/whatsapp/customers/${U}/payment-methods/${V}`), ['payment-methods', V, 'payment-methods.delete', U, 'user']);
eq('crm settings', r('PUT', '/whatsapp/crm-settings'), ['crm-settings', null, 'crm-settings.update', null, 'user']);

// bot / funil / agenda / chamados / pedidos / fila
eq('fluxo bot', r('PUT', `/whatsapp/bot/flows/${U}`), ['bot.flows', U, 'bot.flows.update', null, 'user']);
eq('liga bot', r('POST', `/whatsapp/bot/flows/${U}/active`), ['bot.flows', U, 'bot.flows.active', null, 'user']);
eq('etapa funil', r('DELETE', `/whatsapp/pipeline/stages/${U}`), ['pipeline.stages', U, 'pipeline.stages.delete', null, 'user']);
eq('agenda cancela', r('POST', `/whatsapp/scheduling/appointments/${U}/cancel`), ['appointments', U, 'appointments.cancel', null, 'user']);
eq('agenda edita', r('PATCH', `/whatsapp/scheduling/appointments/${U}`), ['appointments', U, 'appointments.update', null, 'user']);
eq('bloqueio recurso', r('POST', `/whatsapp/scheduling/resources/${U}/blocks`), ['resources', U, 'resources.blocks.create', null, 'user']);
eq('chamado comenta', r('POST', `/whatsapp/tickets/${U}/comments`), ['tickets', U, 'tickets.comments', null, 'user']);
eq('pedido status', r('POST', `/whatsapp/orders/${U}/status`), ['orders', U, 'orders.status', null, 'user']);
eq('fila pausa número', r('POST', `/whatsapp/outbox/sessions/${U}/pause`), ['outbox', U, 'outbox.pause', null, 'user']);
eq('fila ritmo número', r('PUT', `/whatsapp/outbox/sessions/${U}/rate`), ['outbox', U, 'outbox.rate', null, 'user']);
eq('fila em massa', r('POST', '/whatsapp/outbox/retry-failed'), ['outbox', null, 'outbox.retry-failed', null, 'user']);
eq('número start', r('POST', `/whatsapp/sessions/${U}/start`), ['sessions', U, 'sessions.start', null, 'user']);
eq('número pacing', r('PUT', `/whatsapp/sessions/${U}/pacing`), ['sessions', U, 'sessions.pacing', null, 'user']);
eq('broadcast copies', r('PUT', `/whatsapp/broadcasts/${U}/copies`), ['broadcasts', U, 'broadcasts.copies', null, 'user']);
eq('broadcast run pausa', r('POST', `/whatsapp/broadcasts/${U}/runs/${V}/pause`), ['broadcasts', U, 'broadcasts.runs.pause', null, 'user']);
eq('contatos bulk', r('POST', '/whatsapp/contacts/bulk'), ['contacts', null, 'contacts.bulk', null, 'user']);
eq('nota', r('PUT', `/whatsapp/chats/${U}/notes/${V}`), ['notes', V, 'notes.update', null, 'user']);
eq('etiquetas da conversa', r('PUT', `/whatsapp/chats/${U}/tags`), ['chats', U, 'chats.tags', null, 'user']);
eq('modelo aplicar', r('POST', '/whatsapp/templates/clinica/apply'), ['templates', 'clinica', 'templates.apply', null, 'user']);
eq('importação job', r('POST', '/whatsapp/imports'), ['imports', null, 'imports.create', null, 'user']);

// API v1 (actor api)
eq('api cria cliente', r('POST', '/api/v1/whatsapp/customers'), ['customers', null, 'customers.create', null, 'api']);
eq('api cancela', r('POST', `/api/v1/whatsapp/subscriptions/${V}/cancel`), ['subscriptions', V, 'subscriptions.cancel', null, 'api']);
eq('api assinatura do cliente', r('POST', `/api/v1/whatsapp/customers/${U}/subscriptions`), ['subscriptions', null, 'subscriptions.create', U, 'api']);

// outros grupos
eq('gateway', r('PUT', '/payments/settings'), ['payments.settings', null, 'payments.settings.update', null, 'user']);
eq('integrações', r('PATCH', '/system-settings'), ['system-settings', null, 'system-settings.update', null, 'user']);
eq('chave IA', r('DELETE', '/system-settings/ai-keys'), ['system-settings', null, 'system-settings.ai-keys.remove', null, 'user']);
eq('organização', r('PATCH', '/organizations/me'), ['organizations', null, 'organizations.update', null, 'user']);
eq('usuário', r('PATCH', `/users/${U}`), ['users', U, 'users.update', null, 'user']);
eq('chave API', r('POST', '/org/api-keys'), ['api-keys', null, 'api-keys.create', null, 'user']);
eq('webhook segredo', r('POST', `/org/webhooks/${U}/rotate-secret`), ['webhooks', U, 'webhooks.rotate-secret', null, 'user']);
eq('com query e barra final', r('PUT', `/whatsapp/products/${U}/?x=1`), ['products', U, 'products.update', null, 'user']);

// resumos
eq('resumo alterar produto', summaryFor({ entity: 'products', verb: 'update' }, 'Plano X'), 'Alterou o produto “Plano X”');
eq('resumo trocar plano', summaryFor({ entity: 'subscriptions', verb: 'change-plan' }, 'Ouro'), 'Trocou o plano da assinatura “Ouro”');
eq('resumo baixa', summaryFor({ entity: 'charges', verb: 'mark-paid' }), 'Deu baixa manual na cobrança');
eq('resumo vincular', summaryFor({ entity: 'customers', verb: 'contacts.create' }, 'Ana'), 'Vinculou um número ao cliente “Ana”');
eq('resumo rotina', summaryFor({ entity: 'charges', verb: 'run-daily' }, 'x'), 'Rodou a rotina diária de cobranças');
eq('resumo desconhecido', summaryFor({ entity: 'orders', verb: 'zzz' }), 'Executou “zzz” no pedido');
eq('resumo configs', summaryFor({ entity: 'crm-settings', verb: 'update' }), 'Alterou as configurações do CRM');
eq('resumo apagar dados', summaryFor({ entity: 'customers', verb: 'erase' }, 'João'), 'Apagou os dados pessoais (LGPD) do cliente “João”');

// saneamento
const s = sanitize({ name: 'A', doc: '12345678900', access_token: 'APP-xyz', password: 'p', nested: { api_key: 'k', ok: 1 }, card_token: 'tok', keys: ['a', 'b'], long: 'x'.repeat(900) });
eq('mascara doc', s.doc, MASK);
eq('mascara access_token', s.access_token, MASK);
eq('mascara password', s.password, MASK);
eq('mascara aninhado', s.nested, { api_key: MASK, ok: 1 });
eq('mascara card', s.card_token, MASK);
eq('mascara keys', s.keys, MASK);
eq('corta string', s.long.length, 500);
eq('nome intacto', s.name, 'A');
const big = capJson({ body: 'y'.repeat(20000), list: Array.from({ length: 100 }, (_, i) => ({ i, t: 'z'.repeat(300) })) });
eq('teto 8KB', Buffer.byteLength(JSON.stringify(big)) <= 8192, true);
eq('teto marca truncated', big.truncated, true);
eq('pequeno passa', capJson({ a: 1 }), { a: 1 });

// diff
const d = diffRows({ id: '1', name: 'A', doc: '111', price_cents: 100, custom: { a: 1 }, updated_at: new Date(1) }, { id: '1', name: 'B', doc: '222', price_cents: 100, custom: { a: 2 }, updated_at: new Date(2) });
eq('diff campos', d.map((x) => x.field), ['name', 'doc', 'custom']);
eq('diff doc mascarado', d[1], { field: 'doc', before: MASK, after: MASK });
eq('diff valor', d[0], { field: 'name', before: 'A', after: 'B' });
eq('diff sem antes', diffRows(null, { a: 1 }), []);
eq('nome registro', recordName({ product_name: 'Plano' }), 'Plano');
eq('nome pedido', recordName({ number: 12 }), '#12');

// A-17 (revisão 14/10/2026): documento da organização mascarado
const so = sanitize({ name: 'Org', document_id: '12.345.678/0001-90', cpf: '123', cnpj: '456', document: 'x', doc_masked: '***.123' });
eq('document_id mascarado', so.document_id, MASK);
eq('cpf mascarado', so.cpf, MASK);
eq('cnpj mascarado', so.cnpj, MASK);
eq('document mascarado', so.document, MASK);
eq('doc_masked fica', so.doc_masked, '***.123');
eq('diff document_id', diffRows({ document_id: 'a' }, { document_id: 'b' }), [{ field: 'document_id', before: MASK, after: MASK }]);
eq('org GET /org/audit não audita', r('GET', '/org/audit'), null);

console.log(`\n${ok} ok, ${fail} falha(s)`);
process.exit(fail ? 1 : 0);
