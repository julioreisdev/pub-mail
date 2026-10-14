// Fluxo do Bot do WhatsApp — peças PURAS do runtime dos blocos de AGENDA (Fase 6, contrato em
// docs/whatsapp-assinaturas-contrato.md §9.4). Sem banco e sem Nest:
//  - `BOOK_ACTIONS`: ações que o runtime executa no WhatsAppSchedulingService e respondem com `book_result`
//  - `flowUsesAppointments`: o fluxo precisa dos próximos agendamentos no contexto (condições/variáveis)?
//  - formatos do serviço → motor: `toBotService`, `toBotAppointment`, `toBotDays`, `bookingCharge`
//  - simulador: `simulateBookAction` (serviços/profissionais/horários/agendamentos EM MEMÓRIA, sem banco),
//    `settleFixtureAppointment` (Pagou/Expirou), `fixtureAppointments`, `describeBookAction`.
import {
  BotAction,
  BotAppointment,
  BotCharge,
  BotDay,
  BotDefinition,
  BotEventPayload,
  BotService,
  BotSlot,
  BotState,
  addDaysYmd,
  fmtDayLabel,
  formatBRL,
  isBookType,
} from './wa-bot.engine';
import { toBotCharge } from './wa-bot-crm.runtime';

/** Ações de agenda que o runtime executa e respondem com `book_result`. */
export const BOOK_ACTIONS = new Set([
  'book_services',
  'book_resources',
  'book_availability',
  'book_create',
  'book_reschedule',
  'appt_list',
  'appt_confirm',
  'appt_cancel',
  'waitlist_join',
]);
/** Só leitura (o simulador com dados reais da org consulta de verdade; as demais são simuladas). */
export const BOOK_READ_ACTIONS = new Set(['book_services', 'book_resources', 'book_availability']);

const APPT_VAR_RE = /\{\{\s*agendamentos?\./i;

/**
 * O fluxo usa os próximos agendamentos do contato FORA dos blocos de agenda? Condição `source:'appointment'`
 * ou texto com `{{agendamento.*}}`/`{{agendamentos.lista}}` em blocos comuns. (Os blocos de agenda buscam o que
 * precisam pelas próprias ações.)
 */
export function flowUsesAppointments(def: BotDefinition | null | undefined): boolean {
  const nodes = Array.isArray(def?.nodes) ? def!.nodes : [];
  const others: any[] = [];
  for (const n of nodes) {
    const t = String(n?.type || '');
    const d: any = n?.data || {};
    if (t === 'condition' && Array.isArray(d.rules) && d.rules.some((r: any) => r?.source === 'appointment')) return true;
    if (!isBookType(t)) others.push(d);
  }
  try {
    return APPT_VAR_RE.test(JSON.stringify(others));
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------ formatos do serviço → motor
const isObj = (v: unknown): v is Record<string, any> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const str = (v: any) => (v == null ? '' : String(v));

export function toBotService(s: any): BotService {
  const resources = Array.isArray(s?.resources) ? s.resources.filter((r: any) => r && r.id).map((r: any) => ({ id: str(r.id), name: str(r.name) })) : undefined;
  return {
    id: str(s?.id),
    name: str(s?.name),
    description: s?.description ?? null,
    price_cents: Number(s?.price_cents) || 0,
    price_label: str(s?.price_label) || formatBRL(Number(s?.price_cents) || 0),
    duration_minutes: Number(s?.duration_minutes) || 0,
    duration_label: str(s?.duration_label),
    booking: isObj(s?.booking) ? { payment: s.booking.payment, deposit_cents: Number(s.booking.deposit_cents) || 0, address: s.booking.address ?? null } : null,
    ...(resources ? { resources } : {}),
  };
}

const iso = (v: any) => (v instanceof Date ? v.toISOString() : str(v));

export function toBotAppointment(a: any): BotAppointment {
  return {
    id: str(a?.id),
    status: str(a?.status),
    payment: a?.payment ? str(a.payment) : undefined,
    starts_at: iso(a?.starts_at),
    ends_at: a?.ends_at ? iso(a.ends_at) : undefined,
    date_label: a?.date_label ? str(a.date_label) : undefined,
    time_label: a?.time_label ? str(a.time_label) : undefined,
    resource: a?.resource?.id ? { id: str(a.resource.id), name: str(a.resource.name) } : null,
    product_id: a?.product_id ? str(a.product_id) : null,
    service_name: str(a?.service_name),
    price_cents: a?.price_cents != null ? Number(a.price_cents) || 0 : undefined,
    price_label: a?.price_label ? str(a.price_label) : undefined,
    paid_cents: a?.paid_cents != null ? Number(a.paid_cents) || 0 : undefined,
    charge: a?.charge?.id
      ? { id: str(a.charge.id), status: a.charge.status ? str(a.charge.status) : undefined, pix_code: a.charge.pix_code ?? null, pay_link: a.charge.pay_link ?? null, amount_cents: a.charge.amount_cents != null ? Number(a.charge.amount_cents) : undefined }
      : null,
    cancel_deadline: a?.cancel_deadline ? iso(a.cancel_deadline) : null,
    can_cancel_free: a?.can_cancel_free !== false,
    can_reschedule: a?.can_reschedule !== false,
    address: a?.address ?? null,
  };
}

export function toBotDays(days: any): BotDay[] {
  return (Array.isArray(days) ? days : [])
    .filter((d: any) => d && d.date)
    .map((d: any) => ({
      date: str(d.date).slice(0, 10),
      label: str(d.label) || fmtDayLabel(str(d.date)),
      slots: (Array.isArray(d.slots) ? d.slots : [])
        .filter((s: any) => s && s.starts_at)
        .map((s: any) => ({ starts_at: iso(s.starts_at), ends_at: s.ends_at ? iso(s.ends_at) : undefined, time_label: s.time_label ? str(s.time_label) : undefined, resource_id: s.resource_id ? str(s.resource_id) : null, resource_name: s.resource_name ? str(s.resource_name) : undefined, left: s.left != null ? Number(s.left) : undefined })),
    }));
}

/** Cobrança devolvida por `book()` (formato das cobranças, com `pix`/`pay_link`) → `BotState['charge']`. */
export function bookingCharge(charge: any, appointment?: any): BotCharge | null {
  if (!charge?.id) return null;
  const c = toBotCharge(charge);
  c.pay_link = charge.pay_link ?? charge.link ?? appointment?.charge?.pay_link ?? null;
  if (!c.pix_code) c.pix_code = appointment?.charge?.pix_code ?? null;
  if (!c.amount_cents && appointment?.charge?.amount_cents) c.amount_cents = Number(appointment.charge.amount_cents) || 0;
  return c;
}

// ================================================================== simulador (sem banco)
export type BookFixture = {
  services?: any[]; // serviços reais (GET /whatsapp/scheduling/services) ou de exemplo
  appointments?: BotAppointment[]; // agendamentos fictícios do contato
  payment?: 'on_site' | 'on_booking' | 'deposit' | 'included' | null; // sobrescreve o pagamento de todos os serviços
  no_slots?: boolean; // simula agenda lotada
  conflict?: boolean; // 1ª reserva devolve SLOT_TAKEN (testa "horário acabou de ser reservado")
};

export const SAMPLE_SERVICES: BotService[] = [
  { id: 'sim-svc-1', name: 'Consulta', price_cents: 15000, price_label: formatBRL(15000), duration_minutes: 30, duration_label: '30 min', booking: { payment: 'on_site', address: 'Rua Exemplo, 100' }, resources: [{ id: 'sim-res-1', name: 'Dra. Ana' }, { id: 'sim-res-2', name: 'Dr. Bruno' }] },
  { id: 'sim-svc-2', name: 'Avaliação', price_cents: 8000, price_label: formatBRL(8000), duration_minutes: 60, duration_label: '1 h', booking: { payment: 'on_booking', address: 'Rua Exemplo, 100' }, resources: [{ id: 'sim-res-1', name: 'Dra. Ana' }] },
];

const rid = () => Math.random().toString(36).slice(2, 10);
const pad = (n: number) => String(n).padStart(2, '0');
const brtIso = (ymd: string, minutes: number) => new Date(Date.parse(`${ymd}T${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:00-03:00`)).toISOString();
const brtYmd = (d: Date) => new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
const brtHm = (isoStr: string) => new Date(Date.parse(isoStr) - 3 * 3_600_000).toISOString().slice(11, 16);
const LIVE = new Set(['pending_payment', 'booked', 'confirmed', 'in_progress']);

function servicesOf(fx: BookFixture): BotService[] {
  const list = (Array.isArray(fx.services) && fx.services.length ? fx.services : SAMPLE_SERVICES).map(toBotService).filter((s) => s.id);
  return list.map((s) => ({
    ...s,
    resources: s.resources && s.resources.length ? s.resources : [{ id: 'sim-res-1', name: 'Profissional' }],
    booking: { ...(s.booking || {}), payment: fx.payment || s.booking?.payment || 'on_site' },
  }));
}

/** Agendamentos fictícios do contato: os criados na simulação (`state.__fixture_appts`) + os da fixture. */
export function fixtureAppointments(state: BotState | null, fx: BookFixture): BotAppointment[] {
  const made: BotAppointment[] = Array.isArray((state as any)?.__fixture_appts) ? (state as any).__fixture_appts : [];
  const base = (Array.isArray(fx.appointments) ? fx.appointments : []).map(toBotAppointment).filter((a) => a.id && !made.some((m) => m.id === a.id));
  return [...made, ...base];
}
function saveAppt(state: BotState, a: BotAppointment) {
  const made: BotAppointment[] = Array.isArray((state as any).__fixture_appts) ? [...(state as any).__fixture_appts] : [];
  const i = made.findIndex((x) => x.id === a.id);
  if (i >= 0) made[i] = a;
  else made.push(a);
  (state as any).__fixture_appts = made.slice(-10);
}

/** Horários fictícios: seg–sáb, 09:00–12:00 e 14:00–18:00, passo = duração (mín. 30 min), sem os já reservados. */
function fixtureDays(svc: BotService, resourceId: string | null, from: string, days: number, now: Date, taken: BotAppointment[]): BotDay[] {
  const step = Math.max(30, Number(svc.duration_minutes) || 30);
  const res = svc.resources || [];
  const out: BotDay[] = [];
  for (let i = 0; i < Math.max(1, Math.min(60, days)); i++) {
    const ymd = addDaysYmd(from, i);
    if (new Date(`${ymd}T12:00:00Z`).getUTCDay() === 0) continue;
    const slots: BotSlot[] = [];
    for (const [a, b] of [[9 * 60, 12 * 60], [14 * 60, 18 * 60]]) {
      for (let m = a; m + step <= b; m += step) {
        const starts_at = brtIso(ymd, m);
        if (Date.parse(starts_at) < now.getTime() + 3_600_000) continue; // antecedência mínima de 1 h
        const free = (resourceId ? res.filter((r) => r.id === resourceId) : res).find((r) => !taken.some((t) => LIVE.has(t.status) && t.resource?.id === r.id && t.starts_at === starts_at));
        if (!free) continue;
        slots.push({ starts_at, ends_at: brtIso(ymd, m + step), time_label: brtHm(starts_at), resource_id: free.id, resource_name: free.name, left: 1 });
      }
    }
    if (slots.length) out.push({ date: ymd, label: fmtDayLabel(ymd), slots });
  }
  return out;
}

function apptOf(svc: BotService, starts_at: string, resource: { id: string; name: string } | null, status: string, payment: string): BotAppointment {
  const ymd = brtYmd(new Date(starts_at));
  return {
    id: `sim-ap-${rid()}`,
    status,
    payment,
    starts_at,
    ends_at: new Date(Date.parse(starts_at) + (Number(svc.duration_minutes) || 30) * 60_000).toISOString(),
    date_label: fmtDayLabel(ymd),
    time_label: brtHm(starts_at),
    resource,
    product_id: svc.id,
    service_name: svc.name,
    price_cents: svc.price_cents,
    price_label: svc.price_label || formatBRL(svc.price_cents),
    paid_cents: 0,
    charge: null,
    cancel_deadline: new Date(Date.parse(starts_at) - 24 * 3_600_000).toISOString(),
    can_cancel_free: Date.parse(starts_at) - 24 * 3_600_000 > Date.now(),
    can_reschedule: true,
    address: svc.booking?.address ?? null,
  };
}

/**
 * Resolve uma ação de agenda EM MEMÓRIA (simulador). Devolve o `book_result` e pseudo-ações extras
 * (`{type:'charge', charge}` quando o agendamento "gerou" um PIX). Agendamentos criados ficam em
 * `state.__fixture_appts` (o estado viaja de volta pelo front).
 */
export function simulateBookAction(a: BotAction, state: BotState, fx: BookFixture, now: Date = new Date()): { payload: BotEventPayload | null; extra: any[] } {
  const extra: any[] = [];
  const services = servicesOf(fx);
  const svcOf = (id: string) => services.find((s) => s.id === id) || null;
  const appts = fixtureAppointments(state, fx);
  switch (a.type) {
    case 'book_services':
      return { payload: { ok: true, services }, extra };
    case 'book_resources': {
      const s = svcOf(a.product_id);
      return { payload: { ok: true, resources: s?.resources || [] }, extra };
    }
    case 'book_availability': {
      const s = svcOf(a.product_id);
      if (!s) return { payload: { ok: false, error: 'Serviço não encontrado.' }, extra };
      if (fx.no_slots) return { payload: { ok: true, days: [] }, extra: [{ type: 'info', text: 'Simulação: agenda lotada (sem horários).' }] };
      return { payload: { ok: true, days: fixtureDays(s, a.resource_id, a.from, a.days, now, appts) }, extra };
    }
    case 'book_create': {
      const s = svcOf(a.product_id);
      if (!s) return { payload: { ok: false, error: 'Serviço não encontrado.' }, extra };
      if (fx.conflict && !(state as any).__fixture_conflicted) {
        (state as any).__fixture_conflicted = true;
        return { payload: { ok: false, code: 'SLOT_TAKEN', error: 'Simulação: horário acabou de ser reservado.' }, extra };
      }
      const r = (s.resources || []).find((x) => x.id === a.resource_id) || (s.resources || [])[0] || null;
      const payment = String(s.booking?.payment || 'on_site');
      const needsPay = payment === 'on_booking' || payment === 'deposit';
      const ap = apptOf(s, a.starts_at, r, needsPay ? 'pending_payment' : 'booked', payment);
      let charge: BotCharge | null = null;
      if (needsPay) {
        const amount = payment === 'deposit' ? Number(s.booking?.deposit_cents) || Math.max(100, Math.round(s.price_cents * 0.3)) : s.price_cents;
        const id = `sim-apchg-${rid()}`;
        charge = { id, amount_cents: amount, description: `${s.name} · ${ap.date_label} ${ap.time_label}`, due_at: brtYmd(now), pix_code: `PIX-SIMULADO-${id.slice(10).toUpperCase()}`, pay_link: null };
        ap.charge = { id, status: 'PENDING', pix_code: charge.pix_code, pay_link: null, amount_cents: amount };
        extra.push({ type: 'charge', charge });
      }
      saveAppt(state, ap);
      return { payload: { ok: true, appointment: ap, charge }, extra };
    }
    case 'book_reschedule': {
      const cur = appts.find((x) => x.id === a.appointment_id);
      if (!cur) return { payload: { ok: false, error: 'Agendamento não encontrado.' }, extra };
      const s = svcOf(String(cur.product_id || '')) || { id: String(cur.product_id || ''), name: cur.service_name || '', price_cents: cur.price_cents || 0, resources: cur.resource ? [cur.resource] : [] };
      const r = (s.resources || []).find((x) => x.id === a.resource_id) || cur.resource || null;
      saveAppt(state, { ...cur, status: 'canceled' });
      const ap = { ...apptOf(s as BotService, a.starts_at, r, cur.status === 'pending_payment' ? 'pending_payment' : 'booked', String(cur.payment || 'on_site')), charge: cur.charge || null };
      saveAppt(state, ap);
      return { payload: { ok: true, appointment: ap }, extra };
    }
    case 'appt_list':
      return { payload: { ok: true, appointments: appts.filter((x) => LIVE.has(x.status)) }, extra };
    case 'appt_confirm':
    case 'appt_cancel': {
      const cur = appts.find((x) => x.id === a.id);
      if (!cur) return { payload: { ok: false, error: 'Agendamento não encontrado.' }, extra };
      const ap = { ...cur, status: a.type === 'appt_confirm' ? 'confirmed' : 'canceled' };
      saveAppt(state, ap);
      return { payload: { ok: true, appointment: ap }, extra };
    }
    case 'waitlist_join':
      return { payload: { ok: true }, extra: [{ type: 'info', text: `Simulação: entraria na lista de espera (${a.period}, ${a.date_from} → ${a.date_to}).` }] };
    default:
      return { payload: null, extra };
  }
}

/** Pagou/Expirou no simulador: o agendamento fictício com essa cobrança vira `booked` (pago) ou `expired`. */
export function settleFixtureAppointment(state: BotState | null, chargeId: string | null | undefined, paid: boolean): BotAppointment | null {
  if (!state || !chargeId) return null;
  const made: BotAppointment[] = Array.isArray((state as any).__fixture_appts) ? (state as any).__fixture_appts : [];
  const cur = made.find((x) => x.charge?.id === chargeId);
  if (!cur) return null;
  const ap: BotAppointment = { ...cur, status: paid ? 'booked' : 'expired', paid_cents: paid ? cur.charge?.amount_cents || cur.price_cents || 0 : 0, charge: cur.charge ? { ...cur.charge, status: paid ? 'PAID' : 'EXPIRED' } : null };
  saveAppt(state, ap);
  return ap;
}

/** Texto "o que o runtime faria" (log/simulador). */
export function describeBookAction(a: BotAction): string {
  switch (a.type) {
    case 'book_services':
      return 'Buscando os serviços disponíveis para agendar…';
    case 'book_resources':
      return 'Buscando os profissionais/recursos do serviço…';
    case 'book_availability':
      return `Buscando horários livres a partir de ${a.from.split('-').reverse().join('/')}…`;
    case 'book_create':
      return 'Reservando o horário…';
    case 'book_reschedule':
      return 'Remarcando o agendamento…';
    case 'appt_list':
      return 'Buscando os próximos agendamentos do contato…';
    case 'appt_confirm':
      return 'Confirmando a presença…';
    case 'appt_cancel':
      return 'Cancelando o agendamento…';
    case 'waitlist_join':
      return 'Colocando na lista de espera…';
    default:
      return `Ação ${a.type}.`;
  }
}
