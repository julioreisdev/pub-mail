export type EmailScheduleProps = {
  id: string;
  projectId: string;
  daily: boolean;
  date: Date | null;
  /** legado: time armazenado como minutos-do-dia */
  time: number | null;
  forXDays: number | null;
  lastRun: Date | null;
};

export type ScheduleRunDecision = {
  shouldRun: boolean;
  reason?: string;
};

export type ScheduleAfterRunEffect =
  | { type: 'KEEP'; update: { lastRun?: Date } }
  | { type: 'DELETE' };

// Fuso de referência dos agendamentos. O servidor/banco rodam em UTC, mas o
// usuário escolhe a hora no horário de Brasília. Avaliamos hora/dia neste fuso
// (independente da TZ do processo) pra "17h" significar 17h BRT.
const SCHEDULE_TZ = 'America/Sao_Paulo';

// Extrai hora (0..23) e a chave de data YYYY-MM-DD no fuso SCHEDULE_TZ.
function tzParts(date: Date): { dateKey: string; hour: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: SCHEDULE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  let hour = parseInt(map.hour, 10);
  if (!Number.isFinite(hour) || hour === 24) hour = 0; // '24' => 00
  return { dateKey: `${map.year}-${map.month}-${map.day}`, hour };
}

// Converte YYYY-MM-DD em "dias absolutos" para diferença de dias estável.
function dateKeyToDays(key: string): number {
  const [y, m, d] = key.split('-').map((v) => Number(v));
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/**
 * Entidade de domínio rica: contém TODA regra de negócio de recorrência.
 * Runner/Service apenas orquestram.
 */
export class EmailSchedule {
  private constructor(private readonly props: EmailScheduleProps) {
    this.assertInvariants();
  }

  static fromPersistence(raw: {
    id: string;
    project_id: string;
    daily: boolean;
    time: number | null;
    date: Date | null;
    for_x_days?: number | null;
    last_run?: Date | null;
  }): EmailSchedule {
    return new EmailSchedule({
      id: raw.id,
      projectId: raw.project_id,
      daily: raw.daily,
      time: raw.time,
      date: raw.date,
      forXDays: raw.for_x_days ?? null,
      lastRun: raw.last_run ?? null,
    });
  }

  get id() {
    return this.props.id;
  }

  get projectId() {
    return this.props.projectId;
  }

  /**
   * Decide se deve rodar nesse instante.
   * Mantém o comportamento legado: comparação por HORA (topo da hora).
   */
  decide(now: Date): ScheduleRunDecision {
    // hora "agora" no fuso de Brasília (não na TZ do servidor, que é UTC).
    const hourNow = tzParts(now).hour;

    if (this.isInterval()) return this.decideInterval(now, hourNow);
    if (this.props.daily) return this.decideDaily(hourNow);

    return this.decideOneOff(now, hourNow);
  }

  afterSuccessfulRun(now: Date): ScheduleAfterRunEffect {
    if (this.isInterval()) return { type: 'KEEP', update: { lastRun: now } };
    if (this.props.daily) return { type: 'KEEP', update: {} };
    return { type: 'DELETE' }; // one-off
  }

  toHistorySnapshot() {
    return {
      schedule_daily: this.props.daily,
      schedule_time: this.props.time ?? null,
      schedule_date: this.props.date ?? null,
    };
  }

  // ----------------------
  // Regras internas
  // ----------------------

  private isInterval(): boolean {
    return typeof this.props.forXDays === 'number' && this.props.forXDays > 0;
  }

  private decideDaily(hourNow: number): ScheduleRunDecision {
    const hourOfSchedule = this.hourFromLegacyTime(this.props.time);
    if (hourOfSchedule === null) {
      return { shouldRun: false, reason: 'daily schedule has no/invalid time' };
    }

    const ok = hourOfSchedule === hourNow;
    return {
      shouldRun: ok,
      reason: ok ? 'daily: hour match' : 'daily: hour mismatch',
    };
  }

  private decideOneOff(now: Date, hourNow: number): ScheduleRunDecision {
    if (!this.props.date)
      return { shouldRun: false, reason: 'one-off schedule has no date' };

    const hourOfSchedule = this.hourFromLegacyTime(this.props.time);
    if (hourOfSchedule === null) {
      return {
        shouldRun: false,
        reason: 'one-off schedule has no/invalid time',
      };
    }

    // 'hoje' avaliado em Brasília; 'props.date' é o dia-calendário salvo
    // (meia-noite UTC), então sua chave YYYY-MM-DD vem direto do ISO.
    const todayDateOnly = tzParts(now).dateKey;
    const scheduleDateOnly = this.localDateOnlyKey(this.props.date, true);

    const ok = scheduleDateOnly === todayDateOnly && hourOfSchedule === hourNow;
    return {
      shouldRun: ok,
      reason: ok ? 'one-off: date+hour match' : 'one-off: date/hour mismatch',
    };
  }

  private decideInterval(now: Date, hourNow: number): ScheduleRunDecision {
    // invariantes garantem daily=false, date=null, time!=null
    const hourOfSchedule = this.hourFromLegacyTime(this.props.time);
    if (hourOfSchedule === null) {
      return { shouldRun: false, reason: 'interval: time is required/invalid' };
    }

    if (hourOfSchedule !== hourNow)
      return { shouldRun: false, reason: 'interval: hour mismatch' };

    // primeira execução
    if (!this.props.lastRun)
      return { shouldRun: true, reason: 'interval: first run (no last_run)' };

    const forDays = this.props.forXDays ?? 0;

    // diferença de dias-calendário em Brasília (estável e independente da TZ
    // do servidor).
    const diffDays =
      dateKeyToDays(tzParts(now).dateKey) -
      dateKeyToDays(tzParts(this.props.lastRun).dateKey);

    const ok = diffDays >= forDays;

    return {
      shouldRun: ok,
      reason: ok
        ? `interval: diffDays=${diffDays} >= ${forDays}`
        : `interval: diffDays=${diffDays} < ${forDays}`,
    };
  }

  /**
   * Converte o valor salvo em `time` para "hora do dia" (0..23).
   *
   * Aceita:
   * - hora direta: 0..23
   * - minutos do dia: 0..1439
   *
   * Corrige:
   * - 1440 (24:00) => 0 (00:00)
   */
  private hourFromLegacyTime(time: number | null): number | null {
    if (time === null || time === undefined) return null;
    if (!Number.isFinite(time)) return null;

    // frontend manda só a hora (0..23)
    if (time >= 0 && time <= 23) return Math.trunc(time);

    // ✅ correção do bug: 24:00 (1440) deve ser 00:00 (0)
    if (time === 1440) return 0;

    // minutos do dia válidos: 0..1439
    if (time < 0 || time > 1439) return null;

    return Math.floor(time / 60);
  }

  // Helper: chave YYYY-MM-DD
  private localDateOnlyKey(d: Date, isFromDatabase = false): string {
    if (isFromDatabase) {
      // Extrai direto a string YYYY-MM-DD preservando o dia exato salvo no banco (UTC)
      return d.toISOString().split('T')[0];
    }

    // Para o 'now' local, continua usando o fuso do servidor para saber o dia exato "aqui"
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private assertInvariants() {
    if (this.isInterval()) {
      if (this.props.daily !== false)
        throw new Error('Invalid interval schedule: daily must be false');
      if (this.props.date !== null)
        throw new Error('Invalid interval schedule: date must be null');
      if (this.props.time === null)
        throw new Error('Invalid interval schedule: time is required');

      // garante que o time é interpretável (evita hour mismatch eterno por time inválido)
      if (this.hourFromLegacyTime(this.props.time) === null) {
        throw new Error('Invalid interval schedule: time is invalid');
      }
    }
  }
}
