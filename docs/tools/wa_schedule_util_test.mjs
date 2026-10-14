// Teste PURO dos helpers da agenda (Fase 6). Node ≥ 23.6 importa o .ts direto (type stripping):
//   node docs/tools/wa_schedule_util_test.mjs
import assert from 'node:assert/strict';
import * as U from '../../back/src/whatsapp/scheduling/wa-schedule.util.ts';

let ok = 0, fail = 0;
const t = (name, fn) => { try { fn(); ok++; } catch (e) { fail++; console.log(`✗ ${name}\n   ${e.message}`); } };

// ---- datas BRT
t('brtToUtc 09:00 BRT = 12:00Z', () => assert.equal(U.brtToUtc('2026-10-15', '09:00').toISOString(), '2026-10-15T12:00:00.000Z'));
t('brtToUtc 24:00 = dia seguinte 03:00Z', () => assert.equal(U.brtToUtc('2026-10-15', '24:00').toISOString(), '2026-10-16T03:00:00.000Z'));
t('brtDateStr 02:00Z = dia anterior', () => assert.equal(U.brtDateStr(new Date('2026-10-16T02:00:00Z')), '2026-10-15'));
t('brtDateStr 03:00Z = mesmo dia', () => assert.equal(U.brtDateStr(new Date('2026-10-16T03:00:00Z')), '2026-10-16'));
t('fmtDay qui 15/10', () => assert.equal(U.fmtDay('2026-10-15'), 'qui 15/10'));
t('fmtDay de Date (01:00Z = 22h do dia anterior)', () => assert.equal(U.fmtDay(new Date('2026-10-16T01:00:00Z')), 'qui 15/10'));
t('fmtTime 17:30Z = 14:30', () => assert.equal(U.fmtTime('2026-10-15T17:30:00Z'), '14:30'));
t('fmtDuration', () => { assert.equal(U.fmtDuration(45), '45 min'); assert.equal(U.fmtDuration(60), '1h'); assert.equal(U.fmtDuration(90), '1h30'); });
t('weekdayOf', () => assert.equal(U.weekdayOf('2026-10-15'), 4));
t('addDaysStr cruza mês', () => assert.equal(U.addDaysStr('2026-10-31', 1), '2026-11-01'));
t('isDay rejeita 2026-02-30', () => { assert.equal(U.isDay('2026-02-30'), false); assert.equal(U.isDay('2026-02-28'), true); });
t('periodOf', () => { assert.equal(U.periodOf(new Date('2026-10-15T13:00:00Z')), 'morning'); assert.equal(U.periodOf(new Date('2026-10-15T18:00:00Z')), 'afternoon'); assert.equal(U.periodOf(new Date('2026-10-15T22:00:00Z')), 'evening'); });
t('cancelDeadline', () => assert.equal(U.cancelDeadline('2026-10-15T12:00:00Z', 24).toISOString(), '2026-10-14T12:00:00.000Z'));

// ---- normalização
t('normalizeBooking defaults', () => assert.deepEqual(U.normalizeBooking(null), U.DEFAULT_BOOKING));
t('normalizeBooking clamps', () => { const b = U.normalizeBooking({ payment: 'x', pay_within_minutes: 1, max_days_ahead: 9999, reschedule_limit: -3, address: '  Rua A  ' }); assert.equal(b.payment, 'on_site'); assert.equal(b.pay_within_minutes, 5); assert.equal(b.max_days_ahead, 365); assert.equal(b.reschedule_limit, 0); assert.equal(b.address, 'Rua A'); });
t('normalizeAvailability padrão', () => { const a = U.normalizeAvailability(null); assert.equal(a.slot_minutes, 15); assert.equal(a.weekly['1'][0].start, '09:00'); assert.deepEqual(a.weekly['0'], []); });
t('normalizeAvailability une sobrepostos e descarta inválidos', () => {
  const a = U.normalizeAvailability({ weekly: { 1: [{ start: '13:00', end: '18:00' }, { start: '09:00', end: '14:00' }, { start: '20:00', end: '19:00' }, { start: 'x', end: '10:00' }] }, slot_minutes: 30 });
  assert.deepEqual(a.weekly['1'], [{ start: '09:00', end: '18:00' }]); assert.equal(a.slot_minutes, 30); assert.deepEqual(a.weekly['2'], []);
});
t('normalizeAvailability slot inválido = 15', () => assert.equal(U.normalizeAvailability({ weekly: {}, slot_minutes: 7 }).slot_minutes, 15));
t('normalizeIncludedPlans', () => { const id = '11111111-1111-1111-1111-111111111111'; assert.deepEqual(U.normalizeIncludedPlans([{ plan_id: id, uses_per_cycle: 500 }, { plan_id: id }, { plan_id: 'x' }]), [{ plan_id: id, uses_per_cycle: 100 }]); });
t('normalizeSchedulingSettings', () => { const s = U.normalizeSchedulingSettings({ reminder_d1_hour: '25:00', texts: { booked: '  ', paid: 'Pago!' }, no_show_after_minutes: 0 }); assert.equal(s.reminder_d1_hour, '18:00'); assert.equal(s.texts.booked, U.SCHEDULING_TEXTS.booked); assert.equal(s.texts.paid, 'Pago!'); assert.equal(s.no_show_after_minutes, 0); });

// ---- carga / capacidade
const D = (h, m = 0) => new Date(Date.UTC(2026, 9, 15, h + 3, m)); // hora BRT de 15/10
t('overlaps semiaberto', () => { assert.equal(U.overlaps(D(9), D(10), D(10), D(11)), false); assert.equal(U.overlaps(D(9), D(10, 1), D(10), D(11)), true); });
t('maxLoad sequenciais não somam', () => assert.equal(U.maxLoad([{ start: D(9), end: D(10) }, { start: D(10), end: D(11) }], D(9, 30), D(10, 30)), 1));
t('maxLoad simultâneos somam', () => assert.equal(U.maxLoad([{ start: D(9), end: D(10) }, { start: D(9, 30), end: D(10, 30) }], D(9, 45), D(10, 15)), 2));
t('maxLoad outro serviço = Infinity', () => assert.equal(U.maxLoad([{ start: D(9), end: D(10), foreign: true }], D(9, 30), D(9, 45)), Infinity));
t('maxLoad fora do intervalo = 0', () => assert.equal(U.maxLoad([{ start: D(8), end: D(9) }], D(9), D(10)), 0));

const avail = U.normalizeAvailability({ weekly: { 4: [{ start: '09:00', end: '12:00' }] }, slot_minutes: 30 }); // 15/10/2026 = quinta (4)
const base = { availability: avail, blocks: [], busy: [], capacity: 1, duration: 60, buffer: 0, day: '2026-10-15', now: new Date('2026-10-14T12:00:00Z') };
t('slotsForDay grade 30 min, serviço 60 min, janela 9–12', () => assert.deepEqual(U.slotsForDay(base).map((s) => U.fmtTime(s.starts_at)), ['09:00', '09:30', '10:00', '10:30', '11:00']));
t('slotsForDay buffer não sai da janela de serviço', () => { const s = U.slotsForDay({ ...base, buffer: 15 }); assert.equal(U.fmtTime(s[s.length - 1].starts_at), '11:00'); assert.equal(U.fmtTime(s[s.length - 1].ends_at), '12:15'); assert.equal(U.fmtTime(s[s.length - 1].service_ends_at), '12:00'); });
t('slotsForDay com agendamento 10:00–11:00 (cap 1)', () => assert.deepEqual(U.slotsForDay({ ...base, busy: [{ start: D(10), end: D(11) }] }).map((s) => U.fmtTime(s.starts_at)), ['09:00', '11:00']));
t('slotsForDay buffer do candidato bate no ocupado', () => assert.deepEqual(U.slotsForDay({ ...base, buffer: 15, busy: [{ start: D(10), end: D(11) }] }).map((s) => U.fmtTime(s.starts_at)), ['11:00']));
t('slotsForDay buffer do existente (ends_at inclui o buffer)', () => assert.deepEqual(U.slotsForDay({ ...base, busy: [{ start: D(9), end: D(10, 15) }] }).map((s) => U.fmtTime(s.starts_at)), ['10:30', '11:00']));
t('slotsForDay capacidade 2: left', () => { const s = U.slotsForDay({ ...base, capacity: 2, busy: [{ start: D(10), end: D(11) }] }); assert.equal(s.find((x) => U.fmtTime(x.starts_at) === '10:00').left, 1); assert.equal(s.find((x) => U.fmtTime(x.starts_at) === '09:00').left, 2); });
t('slotsForDay capacidade 2 lotada', () => assert.equal(U.slotsForDay({ ...base, capacity: 2, busy: [{ start: D(10), end: D(11) }, { start: D(10), end: D(11) }] }).some((x) => U.fmtTime(x.starts_at) === '10:00'), false));
t('slotsForDay outro serviço bloqueia mesmo com capacidade', () => assert.equal(U.slotsForDay({ ...base, capacity: 5, busy: [{ start: D(10), end: D(11), foreign: true }] }).some((x) => U.fmtTime(x.starts_at) === '10:00'), false));
t('slotsForDay bloqueio', () => assert.deepEqual(U.slotsForDay({ ...base, blocks: [{ start: D(9), end: D(10, 30) }] }).map((s) => U.fmtTime(s.starts_at)), ['10:30', '11:00']));
t('slotsForDay antecedência mínima', () => assert.deepEqual(U.slotsForDay({ ...base, now: new Date('2026-10-15T11:00:00Z'), minNoticeHours: 2 }).map((s) => U.fmtTime(s.starts_at)), ['10:00', '10:30', '11:00']));
t('slotsForDay dia passado = []', () => assert.deepEqual(U.slotsForDay({ ...base, now: new Date('2026-10-16T12:00:00Z') }), []));
t('slotsForDay além do limite de dias', () => assert.deepEqual(U.slotsForDay({ ...base, now: new Date('2026-10-01T12:00:00Z'), maxDaysAhead: 7 }), []));
t('slotsForDay dia sem grade', () => assert.deepEqual(U.slotsForDay({ ...base, day: '2026-10-16' }), []));
t('withinAvailability', () => { assert.equal(U.withinAvailability(avail, D(11), D(12)), true); assert.equal(U.withinAvailability(avail, D(11, 30), D(12, 30)), false); });

// ---- textos
t('fillScheduleText remove linha vazia', () => assert.equal(U.fillScheduleText('Oi {{cliente.primeiro_nome}}\n📍 {{agendamento.endereco}}\nFim', { 'cliente.primeiro_nome': 'Ana', 'agendamento.endereco': '' }), 'Oi Ana\nFim'));
t('fillScheduleText mantém linha com texto', () => assert.equal(U.fillScheduleText('Local: {{agendamento.endereco}}', { 'agendamento.endereco': '' }), 'Local:'));
t('fillScheduleText desconhecida fica', () => assert.equal(U.fillScheduleText('{{x.y}}', {}), '{{x.y}}'));

// ---- ics
t('icsEscape', () => assert.equal(U.icsEscape('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne'));
t('icsDate', () => assert.equal(U.icsDate('2026-10-15T17:30:00.000Z'), '20261015T173000Z'));
t('icsFold ≤75 octetos e reconstrói', () => {
  const long = 'SUMMARY:' + 'Corte de cabelo com acentuação ção '.repeat(6);
  const folded = U.icsFold(long);
  for (const l of folded.split('\r\n')) assert.ok(Buffer.byteLength(l, 'utf8') <= 75, `linha com ${Buffer.byteLength(l)} bytes`);
  assert.equal(folded.split('\r\n').map((l, i) => (i ? l.slice(1) : l)).join(''), long);
});
t('buildIcs CRLF e estrutura', () => {
  const ics = U.buildIcs('Ana', [{ uid: 'x@pubmail', start: '2026-10-15T12:00:00Z', end: '2026-10-15T13:00:00Z', summary: 'Corte · Ana' }], new Date('2026-10-14T00:00:00Z'));
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n')); assert.ok(ics.endsWith('END:VCALENDAR\r\n')); assert.ok(ics.includes('DTSTART:20261015T120000Z\r\n')); assert.ok(!/[^\r]\n/.test(ics));
});

console.log(`${ok} ok · ${fail} falha(s)`);
process.exit(fail ? 1 : 0);
