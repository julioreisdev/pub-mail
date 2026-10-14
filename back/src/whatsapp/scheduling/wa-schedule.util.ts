// ============================================================================
// Agenda (Fase 6) — helpers PUROS (sem Nest, sem banco; testável em Node: docs/tools/wa_schedule_util_test.mjs).
//
//  - Fuso: Brasil sem horário de verão → BRT fixo −03:00. Disponibilidade em "HH:MM" local; tudo gravado em UTC.
//  - Um agendamento OCUPA o recurso de `starts_at` até `ends_at` (= serviço + intervalo de limpeza/buffer);
//    `service_ends_at` = fim do serviço (o que o cliente vê). A disponibilidade e os bloqueios valem para o
//    tempo de SERVIÇO; o buffer só conta contra os outros agendamentos.
//  - Capacidade (`capacity` do serviço): nº máximo de agendamentos SIMULTÂNEOS do MESMO serviço no recurso
//    (aula em grupo, box com 2 vagas). Agendamento de OUTRO serviço sobreposto = recurso ocupado (vaga 0).
//    A carga é o máximo de sobreposições em qualquer instante do intervalo (não a soma bruta).
// ============================================================================

export const BRT_OFFSET_MS = -3 * 3600_000;
export const DAY_MS = 86_400_000;
export const BOOKING_PAYMENTS = ['on_booking', 'deposit', 'on_site', 'included'] as const;
export const BOOKING_CANCEL_POLICIES = ['credit', 'keep', 'refund'] as const;
export const CONFIRM_MODES = ['none', 'ask_d1'] as const;
export const RESOURCE_KINDS = ['person', 'room', 'bay', 'equipment', 'other'] as const;
export const SLOT_MINUTES = [5, 10, 15, 20, 30, 60] as const;
export const WAIT_PERIODS = ['any', 'morning', 'afternoon', 'evening'] as const;
/** Status que ocupam o horário. */
export const OCCUPYING = ['pending_payment', 'booked', 'confirmed', 'in_progress'] as const;
export const APPT_STATUSES = ['pending_payment', 'booked', 'confirmed', 'in_progress', 'done', 'no_show', 'canceled', 'expired'] as const;
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const num = (v: unknown, d: number, min: number, max: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};
const pick = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(String(v) as T) ? (String(v) as T) : d);

// ---------------------------------------------------------------- datas (BRT fixo)
/** "YYYY-MM-DD" em Brasília. */
export function brtDateStr(d: Date | number = new Date()): string {
  return new Date(new Date(d).getTime() + BRT_OFFSET_MS).toISOString().slice(0, 10);
}
export const isDay = (s: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === String(s);
export const isHHMM = (s: unknown) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || '')) || String(s) === '24:00';
export const hhmmToMin = (s: string) => { const [h, m] = String(s).split(':').map(Number); return h * 60 + m; };
export const minToHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
/** Dia (BRT) + "HH:MM" (BRT) → Date UTC. "24:00" = meia-noite do dia seguinte. */
export function brtToUtc(day: string, hhmm: string): Date {
  const [y, mo, d] = day.split('-').map(Number);
  const min = hhmmToMin(hhmm);
  return new Date(Date.UTC(y, mo - 1, d, 0, min) - BRT_OFFSET_MS);
}
export function addDaysStr(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}
export const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();
/** Minuto do dia em BRT (0..1439). */
export const brtMinuteOf = (d: Date | number) => { const t = new Date(new Date(d).getTime() + BRT_OFFSET_MS); return t.getUTCHours() * 60 + t.getUTCMinutes(); };
/** "qua 15/10" (BRT). */
export function fmtDay(d: Date | string | number): string {
  const t = new Date(typeof d === 'string' && isDay(d) ? `${d}T12:00:00Z` : d);
  const b = new Date(t.getTime() + (typeof d === 'string' && isDay(d) ? 0 : BRT_OFFSET_MS));
  return `${WEEKDAYS[b.getUTCDay()]} ${String(b.getUTCDate()).padStart(2, '0')}/${String(b.getUTCMonth() + 1).padStart(2, '0')}`;
}
/** "14:30" (BRT). */
export const fmtTime = (d: Date | string | number) => minToHHMM(brtMinuteOf(new Date(d)));
/** "45 min", "1h", "1h30". */
export function fmtDuration(min: number): string {
  const m = Math.max(0, Math.round(Number(min) || 0));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h${String(r).padStart(2, '0')}` : `${h}h`;
}
/** Intervalos semiabertos [a, b) se cruzam. */
export function overlaps(aStart: Date | number, aEnd: Date | number, bStart: Date | number, bEnd: Date | number): boolean {
  return +aStart < +bEnd && +bStart < +aEnd;
}
/** Até quando dá para cancelar sem custo. */
export const cancelDeadline = (startsAt: Date | string | number, cancelFreeHours: number) => new Date(+new Date(startsAt) - Math.max(0, Number(cancelFreeHours) || 0) * 3600_000);
/** Período do dia (lista de espera): manhã < 12h, tarde < 18h, noite. */
export function periodOf(d: Date | number): 'morning' | 'afternoon' | 'evening' {
  const m = brtMinuteOf(d);
  return m < 12 * 60 ? 'morning' : m < 18 * 60 ? 'afternoon' : 'evening';
}

// ---------------------------------------------------------------- normalização
export type Booking = {
  payment: (typeof BOOKING_PAYMENTS)[number];
  deposit_cents: number;
  pay_within_minutes: number;
  min_notice_hours: number;
  max_days_ahead: number;
  cancel_free_hours: number;
  cancel_policy: (typeof BOOKING_CANCEL_POLICIES)[number];
  reschedule_limit: number;
  confirm: (typeof CONFIRM_MODES)[number];
  requires_customer: boolean;
  address: string | null;
};
export const DEFAULT_BOOKING: Booking = { payment: 'on_site', deposit_cents: 0, pay_within_minutes: 30, min_notice_hours: 2, max_days_ahead: 60, cancel_free_hours: 24, cancel_policy: 'credit', reschedule_limit: 2, confirm: 'ask_d1', requires_customer: false, address: null };

/** Regras de reserva do serviço (`whatsapp_products.booking`). Nunca lança. */
export function normalizeBooking(raw: unknown): Booking {
  const r: any = raw && typeof raw === 'object' ? raw : {};
  const d = DEFAULT_BOOKING;
  const address = typeof r.address === 'string' ? r.address.trim().slice(0, 255) : '';
  return {
    payment: pick(r.payment, BOOKING_PAYMENTS, d.payment),
    deposit_cents: num(r.deposit_cents, d.deposit_cents, 0, 99_999_999),
    pay_within_minutes: num(r.pay_within_minutes, d.pay_within_minutes, 5, 1440),
    min_notice_hours: num(r.min_notice_hours, d.min_notice_hours, 0, 720),
    max_days_ahead: num(r.max_days_ahead, d.max_days_ahead, 1, 365),
    cancel_free_hours: num(r.cancel_free_hours, d.cancel_free_hours, 0, 720),
    cancel_policy: pick(r.cancel_policy, BOOKING_CANCEL_POLICIES, d.cancel_policy),
    reschedule_limit: num(r.reschedule_limit, d.reschedule_limit, 0, 10),
    confirm: pick(r.confirm, CONFIRM_MODES, d.confirm),
    requires_customer: r.requires_customer === true,
    address: address || null,
  };
}

/** Planos que incluem o serviço: `[{plan_id, uses_per_cycle 1..100}]` (até 20, sem repetir plano). */
export function normalizeIncludedPlans(raw: unknown): Array<{ plan_id: string; uses_per_cycle: number }> {
  const list = Array.isArray(raw) ? raw : [];
  const out: Array<{ plan_id: string; uses_per_cycle: number }> = [];
  for (const x of list) {
    const id = String((x as any)?.plan_id || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(id) || out.some((o) => o.plan_id === id)) continue;
    out.push({ plan_id: id, uses_per_cycle: num((x as any)?.uses_per_cycle, 1, 1, 100) });
    if (out.length >= 20) break;
  }
  return out;
}

export type Interval = { start: string; end: string };
export type Availability = { weekly: Record<string, Interval[]>; slot_minutes: number };
export const DEFAULT_AVAILABILITY: Availability = {
  weekly: { '0': [], '1': [{ start: '09:00', end: '18:00' }], '2': [{ start: '09:00', end: '18:00' }], '3': [{ start: '09:00', end: '18:00' }], '4': [{ start: '09:00', end: '18:00' }], '5': [{ start: '09:00', end: '18:00' }], '6': [{ start: '09:00', end: '13:00' }] },
  slot_minutes: 15,
};

/**
 * Grade semanal do recurso. Intervalos inválidos saem; sobrepostos são unidos; até 8 por dia.
 * Sem `weekly` no JSON = padrão (seg–sex 9–18, sáb 9–13). `weekly: {}` explícito = sem horários.
 */
export function normalizeAvailability(raw: unknown): Availability {
  const r: any = raw && typeof raw === 'object' ? raw : null;
  if (!r || !r.weekly || typeof r.weekly !== 'object') return JSON.parse(JSON.stringify({ ...DEFAULT_AVAILABILITY, slot_minutes: r ? num(r.slot_minutes, 15, 5, 60) : 15 }));
  const weekly: Record<string, Interval[]> = {};
  for (let wd = 0; wd < 7; wd++) {
    const list = Array.isArray(r.weekly[String(wd)]) ? r.weekly[String(wd)] : [];
    const ivs = list
      .filter((x: any) => x && isHHMM(x.start) && isHHMM(x.end) && hhmmToMin(x.start) < hhmmToMin(x.end))
      .map((x: any) => [hhmmToMin(x.start), hhmmToMin(x.end)] as [number, number])
      .sort((a: [number, number], b: [number, number]) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const iv of ivs) {
      const last = merged[merged.length - 1];
      if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
      else merged.push([iv[0], iv[1]]);
    }
    weekly[String(wd)] = merged.slice(0, 8).map(([a, b]) => ({ start: minToHHMM(a), end: minToHHMM(b) }));
  }
  const sm = Number(r.slot_minutes);
  return { weekly, slot_minutes: (SLOT_MINUTES as readonly number[]).includes(sm) ? sm : 15 };
}

/** Minutos de disponibilidade da semana (relatório de ocupação). */
export const weeklyMinutes = (a: Availability, weekday: number) => (a.weekly[String(weekday)] || []).reduce((s, iv) => s + hhmmToMin(iv.end) - hhmmToMin(iv.start), 0);

// ---------------------------------------------------------------- vagas
export type Busy = { start: Date | number | string; end: Date | number | string; foreign?: boolean };
type Span = { start: number; end: number; foreign?: boolean };
const toSpan = (b: Busy): Span => ({ start: +new Date(b.start), end: +new Date(b.end), foreign: Boolean(b.foreign) });

/**
 * Carga máxima (agendamentos simultâneos) dentro de [start, end). `foreign` sobreposto = Infinity
 * (recurso ocupado por outro serviço). Varre o início do intervalo e cada início de agendamento dentro dele.
 */
export function maxLoad(busy: Busy[], start: Date | number, end: Date | number): number {
  const s = +start, e = +end;
  const inside = busy.map(toSpan).filter((b) => b.start < e && s < b.end);
  if (inside.some((b) => b.foreign)) return Infinity;
  let max = 0;
  const points = [s, ...inside.map((b) => b.start).filter((p) => p > s && p < e)];
  for (const p of points) {
    const n = inside.filter((b) => b.start <= p && p < b.end).length;
    if (n > max) max = n;
  }
  return max;
}

/** O tempo de serviço [start, serviceEnd) cabe inteiro num intervalo da grade daquele dia (BRT)? */
export function withinAvailability(a: Availability, start: Date | number, serviceEnd: Date | number): boolean {
  const day = brtDateStr(start);
  const ivs = a.weekly[String(weekdayOf(day))] || [];
  return ivs.some((iv) => +brtToUtc(day, iv.start) <= +start && +serviceEnd <= +brtToUtc(day, iv.end));
}

/** O início cai na grade `slot_minutes` de algum intervalo do dia (contada do início do intervalo, como `slotsForDay`)? */
export function isOnGrid(a: Availability, start: Date | number): boolean {
  const day = brtDateStr(start);
  const step = Math.max(5, a.slot_minutes || 15) * 60_000;
  const t = +new Date(start);
  return (a.weekly[String(weekdayOf(day))] || []).some((iv) => {
    const s = +brtToUtc(day, iv.start), e = +brtToUtc(day, iv.end);
    return t >= s && t < e && (t - s) % step === 0;
  });
}

export type SlotsParams = {
  availability: Availability;
  blocks: Array<{ start: Date | number | string; end: Date | number | string }>;
  busy: Busy[];
  capacity: number;
  duration: number; // minutos de serviço
  buffer: number; // minutos de intervalo depois
  day: string; // YYYY-MM-DD (BRT)
  now?: Date | number;
  minNoticeHours?: number;
  maxDaysAhead?: number;
};
export type Slot = { starts_at: string; ends_at: string; service_ends_at: string; left: number };

/** Vagas de UM recurso num dia. Só horários com vaga (`left > 0`), na grade `slot_minutes` a partir do início de cada intervalo. */
export function slotsForDay(p: SlotsParams): Slot[] {
  const now = +new Date(p.now ?? Date.now());
  const today = brtDateStr(now);
  if (!isDay(p.day) || p.day < today) return [];
  if (p.maxDaysAhead !== undefined && p.day > addDaysStr(today, p.maxDaysAhead)) return [];
  const dur = Math.max(1, Math.round(p.duration)), buf = Math.max(0, Math.round(p.buffer || 0));
  const cap = Math.max(1, Math.round(p.capacity || 1));
  const step = Math.max(5, p.availability.slot_minutes || 15);
  const earliest = now + Math.max(0, p.minNoticeHours || 0) * 3600_000;
  const blocks = p.blocks.map((b) => ({ start: +new Date(b.start), end: +new Date(b.end) }));
  const out: Slot[] = [];
  for (const iv of p.availability.weekly[String(weekdayOf(p.day))] || []) {
    const ivStart = +brtToUtc(p.day, iv.start), ivEnd = +brtToUtc(p.day, iv.end);
    for (let t = ivStart; t + dur * 60_000 <= ivEnd; t += step * 60_000) {
      if (t < earliest) continue;
      const svcEnd = t + dur * 60_000, end = svcEnd + buf * 60_000;
      if (blocks.some((b) => overlaps(t, svcEnd, b.start, b.end))) continue;
      const load = maxLoad(p.busy, t, end);
      const left = cap - load;
      if (left > 0) out.push({ starts_at: new Date(t).toISOString(), ends_at: new Date(end).toISOString(), service_ends_at: new Date(svcEnd).toISOString(), left });
    }
  }
  return out;
}

// ---------------------------------------------------------------- configurações da org
export const SCHEDULING_TEXTS = {
  booked: '✅ Prontinho, {{cliente.primeiro_nome}}! Seu horário está agendado.\n\n*{{agendamento.servico}}*\n👤 {{agendamento.profissional}}\n📅 {{agendamento.data}} às {{agendamento.hora}}\n📍 {{agendamento.endereco}}',
  pending_payment: '⏳ Reservei *{{agendamento.servico}}* para {{agendamento.data}} às {{agendamento.hora}}.\nPara garantir o horário, pague {{agendamento.valor}} até as {{agendamento.pagar_ate}}:\n{{agendamento.link_pagamento}}',
  paid: '✅ Pagamento recebido! Seu horário de *{{agendamento.servico}}* em {{agendamento.data}} às {{agendamento.hora}} está garantido.',
  reminder_d1: '📅 Lembrete: amanhã, {{agendamento.data}} às {{agendamento.hora}}, você tem *{{agendamento.servico}}* com {{agendamento.profissional}}.\n📍 {{agendamento.endereco}}',
  reminder_d1_confirm: '📅 Lembrete: amanhã, {{agendamento.data}} às {{agendamento.hora}}, você tem *{{agendamento.servico}}* com {{agendamento.profissional}}.\n\nResponda *1* para confirmar ou *2* para remarcar/cancelar.',
  reminder_h2: '⏰ Daqui a pouco, às {{agendamento.hora}}: *{{agendamento.servico}}* com {{agendamento.profissional}}. Te esperamos!\n📍 {{agendamento.endereco}}',
  confirmed: '👍 Presença confirmada! Até {{agendamento.data}} às {{agendamento.hora}}.',
  canceled: 'Seu agendamento de *{{agendamento.servico}}* ({{agendamento.data}} às {{agendamento.hora}}) foi cancelado.\n💳 {{agendamento.credito}}',
  canceled_late: 'Seu agendamento de *{{agendamento.servico}}* ({{agendamento.data}} às {{agendamento.hora}}) foi cancelado fora do prazo de cancelamento gratuito.\n💳 {{agendamento.credito}}',
  rescheduled: '🔁 Remarcado! *{{agendamento.servico}}* agora é {{agendamento.data}} às {{agendamento.hora}} com {{agendamento.profissional}}.',
  no_show: 'Sentimos sua falta hoje às {{agendamento.hora}} 😕 Se quiser remarcar, é só mandar uma mensagem.',
  expired: '⌛ O prazo para pagar a reserva de {{agendamento.data}} às {{agendamento.hora}} acabou e o horário foi liberado. Se ainda quiser, é só agendar de novo.',
  waitlist_offer: '🎉 Abriu uma vaga: *{{agendamento.servico}}* em {{agendamento.data}} às {{agendamento.hora}} com {{agendamento.profissional}}.\nResponda *1* para ficar com o horário (vale por {{agendamento.oferta_minutos}} min) ou *2* para recusar.',
  waitlist_booked: '✅ Horário garantido: *{{agendamento.servico}}* em {{agendamento.data}} às {{agendamento.hora}} com {{agendamento.profissional}}.',
  // extras (respostas automáticas sem o bot)
  reschedule_help: 'Sem problema! Para remarcar ou cancelar, mande *menu* e escolha a opção de agendamentos — ou aguarde que alguém da equipe fala com você.',
  waitlist_declined: 'Tudo bem! Liberei a vaga para a próxima pessoa.',
  waitlist_failed: 'Poxa, essa vaga acabou de ser preenchida 😕 Continuo de olho e te aviso se abrir outra.',
} as const;
export type SchedulingTexts = Record<keyof typeof SCHEDULING_TEXTS, string>;
export type SchedulingSettings = {
  texts: SchedulingTexts;
  reminder_d1_hour: string;
  reminder_h2: boolean;
  no_show_after_minutes: number; // 0 = sem falta automática
  auto_complete: boolean;
  waitlist_offer_minutes: number;
  staff_notify: boolean;
  no_show_deposit_after: number; // 0 = desligado; N faltas → exige sinal
};
export const DEFAULT_SCHEDULING: SchedulingSettings = { texts: { ...SCHEDULING_TEXTS }, reminder_d1_hour: '18:00', reminder_h2: true, no_show_after_minutes: 30, auto_complete: true, waitlist_offer_minutes: 30, staff_notify: true, no_show_deposit_after: 0 };

/** Mescla o JSON guardado (ou parcial do PUT) com os padrões. Texto vazio = padrão. Nunca lança. */
export function normalizeSchedulingSettings(raw: unknown, base: SchedulingSettings = DEFAULT_SCHEDULING): SchedulingSettings {
  const r: any = raw && typeof raw === 'object' ? raw : {};
  const t: any = r.texts && typeof r.texts === 'object' ? r.texts : {};
  const texts = {} as SchedulingTexts;
  for (const k of Object.keys(SCHEDULING_TEXTS) as (keyof typeof SCHEDULING_TEXTS)[]) {
    const v = typeof t[k] === 'string' ? t[k].slice(0, 1500) : '';
    texts[k] = v.trim() ? v : base.texts[k] || SCHEDULING_TEXTS[k];
  }
  return {
    texts,
    reminder_d1_hour: isHHMM(r.reminder_d1_hour) && r.reminder_d1_hour !== '24:00' ? String(r.reminder_d1_hour) : base.reminder_d1_hour,
    reminder_h2: r.reminder_h2 === undefined ? base.reminder_h2 : Boolean(r.reminder_h2),
    no_show_after_minutes: r.no_show_after_minutes === undefined ? base.no_show_after_minutes : num(r.no_show_after_minutes, base.no_show_after_minutes, 0, 1440),
    auto_complete: r.auto_complete === undefined ? base.auto_complete : Boolean(r.auto_complete),
    waitlist_offer_minutes: r.waitlist_offer_minutes === undefined ? base.waitlist_offer_minutes : num(r.waitlist_offer_minutes, base.waitlist_offer_minutes, 5, 1440),
    staff_notify: r.staff_notify === undefined ? base.staff_notify : Boolean(r.staff_notify),
    no_show_deposit_after: r.no_show_deposit_after === undefined ? base.no_show_deposit_after : num(r.no_show_deposit_after, base.no_show_deposit_after, 0, 20),
  };
}

/**
 * Preenche `{{chave}}` e REMOVE as linhas cujas variáveis ficaram todas vazias e que não têm outro texto
 * (ex.: "📍 {{agendamento.endereco}}" sem endereço some inteira). Chave desconhecida fica como está.
 */
export function fillScheduleText(text: string, vars: Record<string, string>): string {
  const RE = /\{\{\s*([\w.-]+)\s*\}\}/g;
  const lines = String(text || '').split('\n').filter((line) => {
    const keys = [...line.matchAll(RE)].map((m) => m[1].toLowerCase());
    if (!keys.length) return true;
    const allEmpty = keys.every((k) => k in vars && !String(vars[k] || '').trim());
    if (!allEmpty) return true;
    const rest = line.replace(RE, '').replace(/[\s\p{P}\p{S}\p{M}]/gu, '');
    return rest.length > 0;
  });
  return lines.join('\n').replace(RE, (m, k: string) => { const key = String(k).toLowerCase(); return key in vars ? vars[key] : m; }).replace(/\n{3,}/g, '\n\n').trim();
}

// ---------------------------------------------------------------- calendário (.ics)
/** Escapa texto de propriedade iCalendar (RFC 5545 §3.3.11). */
export const icsEscape = (s: unknown) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
/** Data UTC no formato iCalendar: 20261015T173000Z. */
export const icsDate = (d: Date | string | number) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
/** Dobra linhas em 75 octetos (UTF-8), continuação com espaço; sem quebrar um caractere no meio. */
export function icsFold(line: string): string {
  const out: string[] = [];
  let cur = '', bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch, 'utf8');
    const limit = out.length ? 74 : 75; // a continuação começa com um espaço
    if (bytes + b > limit) { out.push(cur); cur = ''; bytes = 0; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}
export type IcsEvent = { uid: string; start: Date | string; end: Date | string; summary: string; description?: string; location?: string; status?: 'CONFIRMED' | 'TENTATIVE'; stamp?: Date | string };
export function buildIcs(calName: string, events: IcsEvent[], now: Date = new Date()): string {
  const L: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Pub Mail//Agenda//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${icsEscape(calName)}`, 'X-WR-TIMEZONE:America/Sao_Paulo'];
  for (const e of events) {
    L.push('BEGIN:VEVENT', `UID:${icsEscape(e.uid)}`, `DTSTAMP:${icsDate(e.stamp || now)}`, `DTSTART:${icsDate(e.start)}`, `DTEND:${icsDate(e.end)}`, `SUMMARY:${icsEscape(e.summary)}`);
    if (e.description) L.push(`DESCRIPTION:${icsEscape(e.description)}`);
    if (e.location) L.push(`LOCATION:${icsEscape(e.location)}`);
    L.push(`STATUS:${e.status || 'CONFIRMED'}`, 'END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.map(icsFold).join('\r\n') + '\r\n';
}
