// project_schedule.entity.ts
import { BadRequestException } from '@nestjs/common';

export type ProjectScheduleMode = 'DAILY' | 'ONE_OFF' | 'INTERVAL';

export type ProjectScheduleProps = {
  id?: string;
  projectId: string;
  daily: boolean;
  date: Date | null;            // para ONE-OFF (dia)
  time: number | null;          // 0..1439 (minuto do dia)
  forXDays: number | null;      // para INTERVAL
  lastRun: Date | null;         // cron controla
};

export class ProjectSchedule {
  private constructor(private props: ProjectScheduleProps) {
    // ✅ NÃO normaliza automaticamente (senão payload inválido “passa”)
    this.assertInvariants();
  }

  // -------------------------
  // Factories
  // -------------------------

  static create(input: {
    projectId: string;
    daily: boolean;
    date?: string | Date | null;
    time?: number | null;
    forXDays?: number | null;
  }): ProjectSchedule {
    const dateNormalized =
      input.date === undefined || input.date === null
        ? null
        : this.parseAndNormalizeDateOnly(input.date);

    return new ProjectSchedule({
      projectId: input.projectId,
      daily: input.daily,
      date: dateNormalized,
      time: input.time ?? null,
      forXDays: input.forXDays ?? null,
      lastRun: null, // CRUD não define last_run
    });
  }

  static rehydrate(raw: {
    id: string;
    project_id: string;
    daily: boolean;
    date: Date | null;
    time: number | null;
    for_x_days: number | null;
    last_run: Date | null;
  }): ProjectSchedule {
    return new ProjectSchedule({
      id: raw.id,
      projectId: raw.project_id,
      daily: raw.daily,
      date: raw.date ? this.normalizeDateOnly(raw.date) : null,
      time: raw.time,
      forXDays: raw.for_x_days ?? null,
      lastRun: raw.last_run ?? null,
    });
  }

  update(input: {
    daily?: boolean;
    date?: string | Date | null;
    time?: number | null;
    forXDays?: number | null;
  }): ProjectSchedule {
    const nextDaily = input.daily ?? this.props.daily;

    const nextForXDays =
      input.forXDays === undefined ? this.props.forXDays : (input.forXDays ?? null);

    const nextTime = input.time === undefined ? this.props.time : (input.time ?? null);

    let nextDate: Date | null;
    if (input.date === undefined) {
      nextDate = this.props.date;
    } else if (input.date === null) {
      nextDate = null;
    } else {
      nextDate = ProjectSchedule.parseAndNormalizeDateOnly(input.date);
    }

    return new ProjectSchedule({
      ...this.props,
      daily: nextDaily,
      time: nextTime,
      date: nextDate,
      forXDays: nextForXDays,
      // ✅ lastRun: NÃO mexe aqui. Cron controla.
      lastRun: this.props.lastRun,
    });
  }

  // -------------------------
  // Behavior / Rules
  // -------------------------

  mode(): ProjectScheduleMode {
    if (this.isInterval()) return 'INTERVAL';
    return this.props.daily ? 'DAILY' : 'ONE_OFF';
  }

  private isInterval(): boolean {
    return typeof this.props.forXDays === 'number' && this.props.forXDays > 0;
  }

  private assertInvariants() {
    // ✅ time obrigatório em TODOS os modelos (como você definiu)
    if (this.props.time === null || this.props.time === undefined) {
      throw new BadRequestException('time is required');
    }
    this.assertLegacyTimeRange(this.props.time);

    // -------------------------
    // INTERVAL (for_x_days)
    // daily=false, date=null, forXDays>0
    // -------------------------
    if (this.isInterval()) {
      if (!Number.isInteger(this.props.forXDays) || (this.props.forXDays ?? 0) <= 0) {
        throw new BadRequestException('for_x_days must be an integer greater than 0');
      }
      if (this.props.daily !== false) {
        throw new BadRequestException('when for_x_days is provided, daily must be false');
      }
      if (this.props.date !== null) {
        throw new BadRequestException('when for_x_days is provided, date must be null');
      }
      return;
    }

    // -------------------------
    // DAILY
    // daily=true, date=null, forXDays=null
    // -------------------------
    if (this.props.daily === true) {
      if (this.props.date !== null) {
        throw new BadRequestException('date must be null when daily is true');
      }
      if (this.props.forXDays !== null && this.props.forXDays !== undefined) {
        throw new BadRequestException('for_x_days must be null when daily is true');
      }
      return;
    }

    // -------------------------
    // ONE-OFF
    // daily=false, forXDays=null, date obrigatório
    // -------------------------
    if (this.props.daily === false) {
      if (this.props.forXDays !== null && this.props.forXDays !== undefined) {
        throw new BadRequestException('for_x_days must be null for one-off schedules');
      }
      if (this.props.date === null) {
        throw new BadRequestException('date is required when daily is false');
      }
      return;
    }
  }

  private assertLegacyTimeRange(time: number) {
    if (!Number.isInteger(time) || time < 0 || time > 1439) {
      throw new BadRequestException('time must be an integer between 0 and 1439');
    }
  }

  // -------------------------
  // Persistence mapping
  // -------------------------

  toPersistenceForCreate() {
    return {
      project_id: this.props.projectId,
      daily: this.props.daily,
      date: this.props.date,
      time: this.props.time,
      for_x_days: this.props.forXDays,
      last_run: null, // sempre null no create
    };
  }

  toPersistenceForUpdate() {
    return {
      daily: this.props.daily,
      date: this.props.date,
      time: this.props.time,
      for_x_days: this.props.forXDays,
      // last_run não mexe
    };
  }

  // -------------------------
  // Date helpers
  // -------------------------

  private static normalizeDateOnly(date: Date) {
    const d = new Date(date);
    // Mantém “date-only” em UTC pra persistência consistente (dia)
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  private static parseAndNormalizeDateOnly(input: string | Date) {
    const parsed = new Date(input as any);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('date must be a valid ISO datetime');
    }
    return this.normalizeDateOnly(parsed);
  }
}
