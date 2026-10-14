// Teste PURO dos helpers de chamados (Fase 6B). Node ≥ 23.6 importa o .ts direto (type stripping):
//   node docs/tools/wa_ticket_util_test.mjs
import assert from 'node:assert/strict';
import * as U from '../../back/src/whatsapp/tickets/wa-ticket.util.ts';

let ok = 0, fail = 0;
const t = (name, fn) => { try { fn(); ok++; } catch (e) { fail++; console.log(`✗ ${name}\n   ${e.message}`); } };

// ---- configuração
const def = U.normalizeTicketSettings(null);
t('padrão: 3 categorias ativas', () => { assert.equal(def.categories.length, 3); assert.ok(def.categories.every((c) => c.active)); });
t('padrão: SLA por prioridade', () => assert.deepEqual(def.sla_hours, { low: 120, normal: 48, high: 24, urgent: 4 }));
t('padrão: reinicia todo ano, sem prefixo', () => { assert.equal(def.reset_yearly, true); assert.equal(def.prefix, ''); });
t('padrão: textos preenchidos', () => assert.ok(def.texts.created.includes('{{chamado.protocolo}}')));
t('texto vazio volta ao padrão', () => assert.equal(U.normalizeTicketSettings({ texts: { created: '   ' } }).texts.created, def.texts.created));
t('nunca lança com lixo', () => { U.normalizeTicketSettings('x'); U.normalizeTicketSettings({ categories: 'x', sla_hours: 5, texts: null }); });
const cs = U.normalizeTicketSettings({ categories: [
  { label: 'Iluminação Pública', sla_hours: 72, default_priority: 'high' },
  { key: 'iluminacao-publica', label: 'Duplicada' },
  { label: '', key: 'vazia' },
  { label: 'Buraco na rua', active: false, assignee_id: 'nao-uuid' },
  { label: 'Água', sla_hours: '' },
] });
t('chave gerada sem acento', () => assert.equal(cs.categories[0].key, 'iluminacao-publica'));
t('chave duplicada descartada', () => assert.equal(cs.categories.filter((c) => c.key === 'iluminacao-publica').length, 1));
t('sem rótulo descartada', () => assert.ok(!cs.categories.some((c) => c.key === 'vazia')));
t('inativa preservada', () => assert.equal(cs.categories.find((c) => c.key === 'buraco-na-rua').active, false));
t('responsável inválido vira null', () => assert.equal(cs.categories.find((c) => c.key === 'buraco-na-rua').assignee_id, null));
t('sla vazio = null (usa o da prioridade)', () => assert.equal(cs.categories.find((c) => c.key === 'agua').sla_hours, null));
t('prefixo limpo e maiúsculo', () => assert.equal(U.normalizeTicketSettings({ prefix: 'pm-1 2x9' }).prefix, 'PM12X9'));
t('prefixo até 6', () => assert.equal(U.normalizeTicketSettings({ prefix: 'ABCDEFGH' }).prefix, 'ABCDEF'));
t('limites (warn mínimo 5 min)', () => assert.equal(U.normalizeTicketSettings({ warn_before_minutes: 1 }).warn_before_minutes, 5));
t('categoryKey', () => { assert.equal(U.categoryKey('  Ônibus / Trânsito '), 'onibus-transito'); assert.equal(U.categoryKey(''), ''); });

// ---- protocolo
const now = new Date('2026-10-13T15:00:00Z');
t('protocolo anual 2026000042', () => assert.equal(U.formatProtocol({ prefix: '', reset_yearly: true }, 42, now), '2026000042'));
t('protocolo com prefixo', () => assert.equal(U.formatProtocol({ prefix: 'PM', reset_yearly: true }, 7, now), 'PM2026000007'));
t('protocolo sem reinício = 8 dígitos', () => assert.equal(U.formatProtocol({ prefix: '', reset_yearly: false }, 123, now), '00000123'));
t('ano BRT na virada (31/12 23:30 BRT = 01/01 02:30Z)', () => assert.equal(U.brtYear(new Date('2027-01-01T02:30:00Z')), 2026));
t('contador anual / único', () => { assert.equal(U.counterName({ reset_yearly: true }, now), 'ticket:2026'); assert.equal(U.counterName({ reset_yearly: false }, now), 'ticket'); });
t('protocolo digitado com traço', () => assert.equal(U.normalizeProtocolInput(' 2026-000042 '), '2026000042'));

// ---- prazos
t('SLA da prioridade', () => assert.equal(+U.computeDue(def, 'duvida', 'urgent', now).sla_due_at - +now, 4 * 3600_000));
t('SLA da categoria sobrepõe', () => assert.equal(+U.computeDue(cs, 'iluminacao-publica', 'low', now).sla_due_at - +now, 72 * 3600_000));
t('1ª resposta da prioridade', () => assert.equal(+U.computeDue(def, 'duvida', 'high', now).first_response_due_at - +now, 4 * 3600_000));
const due = new Date(+now + 30 * 60_000);
t('slaState due_soon', () => assert.equal(U.slaState({ status: 'open', sla_due_at: due }, 60, +now), 'due_soon'));
t('slaState ok', () => assert.equal(U.slaState({ status: 'open', sla_due_at: due }, 10, +now), 'ok'));
t('slaState overdue', () => assert.equal(U.slaState({ status: 'pending', sla_due_at: due }, 10, +due + 1000), 'overdue'));
t('slaState met', () => assert.equal(U.slaState({ status: 'resolved', sla_due_at: due, resolved_at: now }, 60, +now), 'met'));
t('slaState breached_met', () => assert.equal(U.slaState({ status: 'closed', sla_due_at: due, resolved_at: new Date(+due + 60_000) }, 60, +now), 'breached_met'));
t('fmtDueRelative', () => { assert.equal(U.fmtDueRelative(new Date(+now + 2 * 3600_000), +now), 'em 2 h'); assert.equal(U.fmtDueRelative(new Date(+now - 3 * 86_400_000), +now), 'há 3 dias'); });
t('fmtDueAbsolute BRT', () => assert.equal(U.fmtDueAbsolute(new Date('2026-10-15T17:30:00Z'), now), '15/10 às 14:30'));
t('fmtDueAbsolute outro ano', () => assert.equal(U.fmtDueAbsolute(new Date('2027-01-05T12:00:00Z'), now), '05/01/2027 às 09:00'));
t('assunto padrão = 1ª linha', () => assert.equal(U.defaultSubject('\n  Poste apagado na rua 3\nhá dias', 'X'), 'Poste apagado na rua 3'));
t('assunto padrão corta em 80', () => assert.ok(U.defaultSubject('a'.repeat(200), 'X').length <= 80));
t('assunto vazio = categoria', () => assert.equal(U.defaultSubject('', 'Dúvida'), 'Dúvida'));

// ---- agradecimento não reabre
for (const s of ['ok', 'Obrigado!', 'obg', 'valeu 👍', '👍', 'ok, obrigada', 'Tá bom']) t(`cortesia: "${s}"`, () => assert.equal(U.isCourtesy(s), true));
for (const s of ['ainda não voltou a luz', 'ok mas continua sem funcionar', 'obrigado, mas o problema voltou hoje cedo']) t(`não é cortesia: "${s}"`, () => assert.equal(U.isCourtesy(s), false));

console.log(`\n${ok}/${ok + fail} passaram${fail ? ` — ${fail} FALHAS` : ''}`);
process.exit(fail ? 1 : 0);
