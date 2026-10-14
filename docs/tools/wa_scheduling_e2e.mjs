// E2E da Fase 6 (agendamento com pagamento) — roda NO SERVIDOR (127.0.0.1:8000):
//   scp docs/tools/wa_scheduling_e2e.mjs pubmail-hostinger:/opt/pub-mail/back/wa_sched_e2e.tmp.mjs
//   ssh pubmail-hostinger 'cd /opt/pub-mail/back && node wa_sched_e2e.tmp.mjs; rm -f wa_sched_e2e.tmp.mjs'
// Org temporária (apagada no fim), Asaas SANDBOX para o PIX da reserva (chave em /root/pubmail.secrets, nunca
// impressa), número FALSO marcado `ready` por SQL (mensagens ficam na fila e são canceladas no fim). Datas: amanhã BRT.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';

const API = 'http://127.0.0.1:8000';
const env = Object.fromEntries(readFileSync('/opt/pub-mail/back/.env', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const secrets = readFileSync('/root/pubmail.secrets', 'utf8').split('\n');
const secret = (k) => secrets.find((l) => l.startsWith(`${k}=`))?.slice(k.length + 1).trim();
const DB_PASS = secret('DB_PASS');
const KEY = secret('ASAAS_SANDBOX_API_KEY');
const sql = (q) => execFileSync('mysql', ['-upubmail', `-p${DB_PASS}`, '-h127.0.0.1', '-N', '-e', q, 'pubmail'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
const sign = (u) => jwt.sign({ sub: u.id, org: u.org, role: u.role }, env.JWT_ACCESS_SECRET, { expiresIn: '40m' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0, total = 0;
const ok = (l, c, x) => { total++; if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + l + (c || x === undefined ? '' : '  → ' + JSON.stringify(x).slice(0, 500))); };
const call = async (tok, m, p, b) => { const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: b ? JSON.stringify(b) : undefined }); let j = null; const t = await r.text(); try { j = JSON.parse(t); } catch { j = t; } return { s: r.status, j }; };
const asa = async (m, p) => { const r = await fetch('https://api-sandbox.asaas.com/v3' + p, { method: m, headers: { access_token: KEY, 'User-Agent': 'PubMail-E2E' } }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const brt = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const today = brt();
const addDays = (s, n) => new Date(new Date(`${s}T12:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
const D1 = addDays(today, 1), D2 = addDays(today, 2);
const at = (day, hm) => new Date(`${day}T${hm}:00-03:00`).toISOString();
const cpf = () => { const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)); const d = (a) => { const s = a.reduce((acc, v, i) => acc + v * (a.length + 1 - i), 0); const r = (s * 10) % 11; return r === 10 ? 0 : r; }; n.push(d(n)); n.push(d(n)); return n.join(''); };
const week = (ranges) => Object.fromEntries(['0', '1', '2', '3', '4', '5', '6'].map((k) => [k, ranges]));
const apptOf = (r) => r.j?.appointment || r.j;

const SA = sql(`SELECT CONCAT(u.id,'|',u.organization_id) FROM users u WHERE u.email='superadmin@pubmail.com' LIMIT 1`).split('|');
const saTok = sign({ id: SA[0], org: SA[1], role: 'SUPER_ADMIN' });
const stamp = Date.now().toString(36);
let orgId, tok, sessionId;
try {
  let r = await call(saTok, 'POST', '/admin/clients', { name: 'Agenda Owner', email: `agenda-${stamp}@teste.local`, password: 'Senha!Teste123', org_name: `E2E Agenda ${stamp}`, modules: ['whatsapp', 'settings'], price_cents: 0 });
  orgId = r.j?.organization?.id; const ownerId = r.j?.user?.id;
  ok('org temporária criada', r.s === 201 && orgId, r.j);
  tok = sign({ id: ownerId, org: orgId, role: 'OWNER' });
  r = await call(tok, 'POST', '/whatsapp/sessions', { label: 'Agenda fake' });
  sessionId = r.j?.id;
  sql(`UPDATE whatsapp_sessions SET status='ready', openwa_session_id='sched-fake-${stamp}', engine='baileys', paired_at=NOW(3) WHERE id='${sessionId}'`);

  // ================================================================ serviços e recursos
  const svc = async (name, extra) => (await call(tok, 'POST', '/whatsapp/products', { name, price_cents: 5000, billing: 'once', kind: 'service', duration_minutes: 60, buffer_after_minutes: 15, capacity: 1, booking: { payment: 'on_site', min_notice_hours: 2, max_days_ahead: 30, cancel_free_hours: 24, cancel_policy: 'credit', reschedule_limit: 2, confirm: 'ask_d1' }, ...extra })).j;
  const CORTE = await svc('Corte de cabelo');
  ok('serviço criado (kind service, 60 min + 15 de limpeza)', CORTE?.kind === 'service' && CORTE.duration_minutes === 60 && CORTE.buffer_after_minutes === 15 && CORTE.billing === 'once', CORTE);
  const AULA = await svc('Aula em grupo', { capacity: 3, buffer_after_minutes: 0 });
  const PIX = await svc('Massagem (paga na reserva)', { booking: { payment: 'on_booking', pay_within_minutes: 30, min_notice_hours: 2, max_days_ahead: 30, cancel_free_hours: 24, cancel_policy: 'credit' } });
  r = await call(tok, 'POST', '/whatsapp/products', { name: 'Serviço sem duração', price_cents: 100, billing: 'once', kind: 'service' });
  ok('serviço sem duração → 400', r.s === 400, r.j);
  r = await call(tok, 'POST', '/whatsapp/scheduling/resources', { name: 'Ana (cabeleireira)', kind: 'person', services: [CORTE.id, PIX.id], availability: { weekly: week([{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }]), slot_minutes: 30 } });
  const R1 = r.j?.id;
  ok('recurso com 2 janelas por dia', (r.s === 201 || r.s === 200) && R1, r.j);
  r = await call(tok, 'POST', '/whatsapp/scheduling/resources', { name: 'Sala de aula', kind: 'room', services: [AULA.id], availability: { weekly: week([{ start: '08:00', end: '20:00' }]), slot_minutes: 60 } });
  const R2 = r.j?.id;
  r = await call(tok, 'GET', `/whatsapp/scheduling/services`);
  ok('GET services lista os 3 serviços com os recursos', r.s === 200 && (r.j.items || r.j).length === 3, r.j);

  // ================================================================ disponibilidade + bloqueio
  r = await call(tok, 'POST', `/whatsapp/scheduling/resources/${R1}/blocks`, { starts_at: at(D1, '15:00'), ends_at: at(D1, '16:00'), reason: 'Consulta médica' });
  ok('bloqueio 15:00–16:00 amanhã', r.s === 201 || r.s === 200, r.j);
  r = await call(tok, 'GET', `/whatsapp/scheduling/availability?product_id=${CORTE.id}&resource_id=${R1}&from=${D1}&days=1`);
  const times = (r.j?.[0]?.slots || []).map((s) => s.time_label);
  // o serviço (60 min) precisa caber na janela e fora do bloqueio; a limpeza depois dele pode passar do fechamento/bloqueio
  ok('vagas de amanhã: 09:00–11:00, 14:00 (termina quando o bloqueio começa), 16:00–17:00', r.s === 200 && times.join(',') === '09:00,09:30,10:00,10:30,11:00,14:00,16:00,16:30,17:00', times);

  // ================================================================ clientes
  const mkCust = async (i, doc) => (await call(tok, 'POST', '/whatsapp/customers', { name: `Cliente Agenda ${i}`, phone: `55009999902${String(i).padStart(2, '0')}`, ...(doc ? { doc, email: `ag${i}-${stamp}@exemplo.com` } : {}) })).j;
  const C1 = await mkCust(1, cpf());

  // ================================================================ reserva no local + conflito + intervalo de limpeza
  r = await call(tok, 'POST', '/whatsapp/scheduling/appointments', { product_id: CORTE.id, resource_id: R1, starts_at: at(D1, '09:00'), customer_id: C1.id, session_id: sessionId });
  const A1 = apptOf(r);
  ok('reserva no local → booked, termina 10:15 (com limpeza)', (r.s === 201 || r.s === 200) && A1?.status === 'booked' && A1.payment === 'none' || A1?.payment === 'on_site', { s: r.s, st: A1?.status, pay: A1?.payment, m: r.j?.message });
  const C2 = await mkCust(2);
  r = await call(tok, 'POST', '/whatsapp/scheduling/appointments', { product_id: CORTE.id, resource_id: R1, starts_at: at(D1, '09:00'), customer_id: C2.id, session_id: sessionId });
  ok('mesmo horário → 409 SLOT_TAKEN', r.s === 409 && r.j?.code === 'SLOT_TAKEN', r.j);
  r = await call(tok, 'POST', '/whatsapp/scheduling/appointments', { product_id: CORTE.id, resource_id: R1, starts_at: at(D1, '10:00'), customer_id: C2.id, session_id: sessionId });
  ok('10:00 (dentro da limpeza até 10:15) → 409', r.s === 409, r.j);
  r = await call(tok, 'POST', '/whatsapp/scheduling/appointments', { product_id: CORTE.id, resource_id: R1, starts_at: at(D1, '10:30'), customer_id: C2.id, session_id: sessionId });
  const A2 = apptOf(r);
  ok('10:30 → livre', (r.s === 201 || r.s === 200) && A2?.status === 'booked', r.j);
  r = await call(tok, 'POST', '/whatsapp/scheduling/appointments', { product_id: CORTE.id, resource_id: R1, starts_at: at(D1, '12:30'), customer_id: C2.id, session_id: sessionId });
  ok('fora do horário (12:30) → 400', r.s === 400, r.j);
  r = await call(tok, 'POST', '/whatsapp/scheduling/appointments', { product_id: CORTE.id, resource_id: R1, starts_at: new Date(Date.now() + 60 * 60_000).toISOString(), customer_id: C2.id, session_id: sessionId });
  ok('antecedência mínima de 2 h → 400', r.s === 400, r.j);
  r = await call(tok, 'POST', '/whatsapp/scheduling/appointments', { product_id: CORTE.id, resource_id: R1, starts_at: at(addDays(today, 40), '09:00'), customer_id: C2.id, session_id: sessionId });
  ok('além de 30 dias → 400', r.s === 400, r.j);

  // ================================================================ capacidade 3 com 10 reservas ao mesmo tempo
  const many = await Promise.all(Array.from({ length: 10 }, (_, i) => mkCust(10 + i)));
  const res = await Promise.all(many.map((c) => call(tok, 'POST', '/whatsapp/scheduling/appointments', { product_id: AULA.id, resource_id: R2, starts_at: at(D1, '19:00'), customer_id: c.id, session_id: sessionId })));
  const accepted = res.filter((x) => x.s === 201 || x.s === 200).length, taken = res.filter((x) => x.s === 409).length;
  ok('aula (capacidade 3): 10 reservas simultâneas → exatamente 3 aceitas, 7 recusadas', accepted === 3 && taken === 7, { accepted, taken, others: res.filter((x) => ![200, 201, 409].includes(x.s)).map((x) => x.j?.message) });
  ok('banco confirma 3 na aula', sql(`SELECT COUNT(*) FROM whatsapp_appointments WHERE organization_id='${orgId}' AND product_id='${AULA.id}' AND status IN ('booked','confirmed')`) === '3');

  // ================================================================ pagamento na reserva (Asaas sandbox)
  r = await call(tok, 'PUT', '/payments/settings', { crm: { asaas_token: KEY, pix: 'asaas' } });
  ok('Asaas sandbox para o PIX', r.s === 200 && r.j?.crm?.effective?.pix === 'asaas', { s: r.s, m: r.j?.message });
  r = await call(tok, 'POST', '/whatsapp/scheduling/appointments', { product_id: PIX.id, resource_id: R1, starts_at: at(D2, '09:00'), customer_id: C1.id, session_id: sessionId });
  const AP = apptOf(r); const chargeP = r.j?.charge || AP?.charge;
  ok('serviço pago na reserva → pending_payment + PIX gerado', (r.s === 201 || r.s === 200) && AP?.status === 'pending_payment' && chargeP?.id && sql(`SELECT IFNULL(pix_charge_id,'') FROM whatsapp_charges WHERE id='${chargeP.id}'`).startsWith('pay_'), { s: r.s, st: AP?.status, m: r.j?.message });
  const payId = sql(`SELECT pix_charge_id FROM whatsapp_charges WHERE id='${chargeP.id}'`);
  const conf = await asa('POST', `/sandbox/payment/${payId}/confirm`);
  let st = '';
  for (let i = 0; i < 40; i++) { st = sql(`SELECT status FROM whatsapp_appointments WHERE id='${AP.id}'`); if (st === 'booked' || st === 'confirmed') break; if (i === 20) await call(tok, 'POST', `/whatsapp/charges/${chargeP.id}/check`); await sleep(3000); }
  ok('PIX pago (sandbox) → agendamento booked', conf.s === 200 && (st === 'booked' || st === 'confirmed'), { conf: conf.s, st });
  r = await call(tok, 'POST', '/whatsapp/scheduling/appointments', { product_id: PIX.id, resource_id: R1, starts_at: at(D2, '14:00'), customer_id: C1.id, session_id: sessionId });
  const AX = apptOf(r);
  sql(`UPDATE whatsapp_appointments SET pay_until=NOW(3) - INTERVAL 1 MINUTE WHERE id='${AX.id}'`);
  for (let i = 0; i < 30; i++) { st = sql(`SELECT status FROM whatsapp_appointments WHERE id='${AX.id}'`); if (st === 'expired') break; await sleep(3000); }
  ok('não pagou no prazo → expired (rodada por minuto) e a cobrança sai do Asaas', st === 'expired' && ['CANCELED', 'EXPIRED'].includes(sql(`SELECT status FROM whatsapp_charges WHERE id='${(r.j?.charge || AX.charge).id}'`)), { st });
  r = await call(tok, 'GET', `/whatsapp/scheduling/availability?product_id=${PIX.id}&resource_id=${R1}&from=${D2}&days=1`);
  ok('horário expirado volta a ficar livre', (r.j?.[0]?.slots || []).some((s) => s.time_label === '14:00'), (r.j?.[0]?.slots || []).map((s) => s.time_label));

  // ================================================================ cancelamento com crédito, remarcação
  r = await call(tok, 'POST', `/whatsapp/scheduling/appointments/${AP.id}/cancel`, { reason: 'Cliente pediu' });
  ok('cancelar o pago (equipe, dentro do prazo) → crédito do valor pago', r.s === 201 && r.j?.status === 'canceled' && Number(sql(`SELECT IFNULL(SUM(amount_cents-used_cents),0) FROM whatsapp_customer_credits WHERE customer_id='${C1.id}'`)) === 5000, { s: r.s, st: r.j?.status, credit: r.j?.credit_granted_cents });
  r = await call(tok, 'POST', '/whatsapp/scheduling/appointments', { product_id: PIX.id, resource_id: R1, starts_at: at(D2, '16:00'), customer_id: C1.id, session_id: sessionId });
  ok('nova reserva paga usa o crédito → booked sem cobrança', apptOf(r)?.status === 'booked' && apptOf(r)?.credit_cents === 5000 && !r.j?.charge, { st: apptOf(r)?.status, credit: apptOf(r)?.credit_cents });
  r = await call(tok, 'POST', `/whatsapp/scheduling/appointments/${A2.id}/reschedule`, { starts_at: at(D1, '16:00') });
  const A2b = apptOf(r);
  ok('remarcar → novo agendamento 16:00 e o antigo cancelado "remarcado"', r.s === 201 && A2b?.time_label === '16:00' && A2b.rescheduled_from === A2.id && sql(`SELECT CONCAT(status,'|',cancel_reason) FROM whatsapp_appointments WHERE id='${A2.id}'`) === 'canceled|remarcado', { s: r.s, t: A2b?.time_label, m: r.j?.message });

  // ================================================================ falta automática + lembrete D-1
  sql(`UPDATE whatsapp_appointments SET starts_at=NOW(3) - INTERVAL 45 MINUTE, ends_at=NOW(3) + INTERVAL 30 MINUTE, service_ends_at=NOW(3) + INTERVAL 15 MINUTE WHERE id='${A1.id}'`);
  for (let i = 0; i < 30; i++) { st = sql(`SELECT status FROM whatsapp_appointments WHERE id='${A1.id}'`); if (st === 'no_show') break; await sleep(3000); }
  ok('45 min depois do início sem atendimento → falta automática', st === 'no_show', st);
  r = await call(tok, 'POST', `/whatsapp/scheduling/appointments/${A1.id}/done`);
  ok('equipe corrige: concluído a partir de falta', r.s === 201 && r.j?.status === 'done', r.j);
  sql(`UPDATE whatsapp_appointments SET created_at=NOW(3) - INTERVAL 3 HOUR, reminders=NULL WHERE id='${A2b.id}'`);
  await call(tok, 'PUT', '/whatsapp/scheduling/settings', { reminder_d1_hour: '00:00' });
  let d1 = '0';
  for (let i = 0; i < 30; i++) { d1 = sql(`SELECT COUNT(*) FROM whatsapp_outbox WHERE organization_id='${orgId}' AND dedupe_key LIKE 'appt:${A2b.id}:d1%'`); if (d1 !== '0') break; await sleep(3000); }
  ok('lembrete D-1 com pedido de confirmação entra na fila', d1 !== '0', d1);

  // ================================================================ lista de espera
  r = await call(tok, 'POST', '/whatsapp/scheduling/waitlist', { product_id: CORTE.id, resource_id: R1, date_from: D1, date_to: D2, period: 'any', customer_id: C2.id, session_id: sessionId });
  const W = r.j?.id;
  ok('entrar na lista de espera', (r.s === 201 || r.s === 200) && W, r.j);
  r = await call(tok, 'POST', `/whatsapp/scheduling/waitlist/${W}/offer`, {});
  ok('oferecer vaga → offered com horário e mensagem na fila', (r.s === 201 || r.s === 200) && sql(`SELECT status FROM whatsapp_waitlist WHERE id='${W}'`) === 'offered', { s: r.s, j: r.j });

  // ================================================================ ICS, relatório, contagens
  r = await call(tok, 'GET', `/whatsapp/scheduling/resources/${R2}/ics-link`);
  const icsPath = String(r.j?.url || '').replace(/^https?:\/\/[^/]+/, '');
  const ics = await (await fetch(API + icsPath)).text();
  ok('feed ICS: VCALENDAR com 3 VEVENT da aula, CRLF, sem telefone', /^BEGIN:VCALENDAR\r\n/.test(ics) && (ics.match(/BEGIN:VEVENT/g) || []).length === 3 && !ics.includes('5500999902'), { path: icsPath, n: (ics.match(/BEGIN:VEVENT/g) || []).length });
  r = await (await fetch(API + '/public/calendar/tokeninvalido123.ics')).status;
  ok('token de calendário inválido → 404', r === 404, r);
  r = await call(tok, 'GET', `/whatsapp/scheduling/appointments/counts?date=${D1}`);
  ok('contagens do dia', r.s === 200 && typeof r.j.total === 'number', r.j);
  r = await call(tok, 'GET', `/whatsapp/scheduling/report?from=${today}&to=${D2}`);
  ok('relatório com ocupação por recurso e receita por serviço', r.s === 200 && Array.isArray(r.j.by_resource) && Array.isArray(r.j.by_service) && r.j.totals, Object.keys(r.j || {}));
  r = await call(tok, 'GET', `/whatsapp/scheduling/appointments?from=${today}&to=${D2}&page=1`);
  ok('lista de agendamentos paginada', r.s === 200 && r.j.items?.length > 0 && r.j.total >= r.j.items.length, { total: r.j?.total });
} catch (e) {
  fails++; console.log('ERRO', e?.stack || e);
} finally {
  if (orgId) {
    const ids = sql(`SELECT CONCAT_WS(',',IFNULL(pix_charge_id,''),IFNULL(boleto_charge_id,''),IFNULL(card_charge_id,'')) FROM whatsapp_charges WHERE organization_id='${orgId}' AND status<>'PAID'`).split('\n').join(',').split(',').filter((v) => /^pay_/.test(v));
    for (const id of ids) await asa('DELETE', `/payments/${id}`).catch(() => {});
    sql(`UPDATE whatsapp_sessions SET status='none', openwa_session_id=NULL, paired_at=NULL WHERE organization_id='${orgId}'`);
    sql(`DELETE FROM whatsapp_outbox WHERE organization_id='${orgId}'`);
    const r = await call(saTok, 'DELETE', `/admin/organizations/${orgId}`);
    const left = ['whatsapp_resources', 'whatsapp_resource_blocks', 'whatsapp_appointments', 'whatsapp_waitlist', 'whatsapp_subscription_usage', 'whatsapp_customer_credits'].map((t) => `${t}=${sql(`SELECT COUNT(*) FROM ${t} WHERE organization_id='${orgId}'`)}`);
    ok('org apagada: tabelas da agenda limpas', (r.s === 200 || r.s === 204) && left.every((x) => x.endsWith('=0')), left);
  }
  console.log(`\n${total - fails}/${total} passaram${fails ? ` — ${fails} FALHAS` : ''}`);
  process.exit(fails ? 1 : 0);
}
