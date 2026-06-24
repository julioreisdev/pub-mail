"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailSchedule = void 0;
class EmailSchedule {
    props;
    constructor(props) {
        this.props = props;
        this.assertInvariants();
    }
    static fromPersistence(raw) {
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
    decide(now) {
        const hourNow = now.getHours();
        if (this.isInterval())
            return this.decideInterval(now, hourNow);
        if (this.props.daily)
            return this.decideDaily(hourNow);
        return this.decideOneOff(now, hourNow);
    }
    afterSuccessfulRun(now) {
        if (this.isInterval())
            return { type: 'KEEP', update: { lastRun: now } };
        if (this.props.daily)
            return { type: 'KEEP', update: {} };
        return { type: 'DELETE' };
    }
    toHistorySnapshot() {
        return {
            schedule_daily: this.props.daily,
            schedule_time: this.props.time ?? null,
            schedule_date: this.props.date ?? null,
        };
    }
    isInterval() {
        return typeof this.props.forXDays === 'number' && this.props.forXDays > 0;
    }
    decideDaily(hourNow) {
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
    decideOneOff(now, hourNow) {
        if (!this.props.date)
            return { shouldRun: false, reason: 'one-off schedule has no date' };
        const hourOfSchedule = this.hourFromLegacyTime(this.props.time);
        if (hourOfSchedule === null) {
            return {
                shouldRun: false,
                reason: 'one-off schedule has no/invalid time',
            };
        }
        const todayDateOnly = this.localDateOnlyKey(now, false);
        const scheduleDateOnly = this.localDateOnlyKey(this.props.date, true);
        const ok = scheduleDateOnly === todayDateOnly && hourOfSchedule === hourNow;
        return {
            shouldRun: ok,
            reason: ok ? 'one-off: date+hour match' : 'one-off: date/hour mismatch',
        };
    }
    decideInterval(now, hourNow) {
        const hourOfSchedule = this.hourFromLegacyTime(this.props.time);
        if (hourOfSchedule === null) {
            return { shouldRun: false, reason: 'interval: time is required/invalid' };
        }
        if (hourOfSchedule !== hourNow)
            return { shouldRun: false, reason: 'interval: hour mismatch' };
        if (!this.props.lastRun)
            return { shouldRun: true, reason: 'interval: first run (no last_run)' };
        const forDays = this.props.forXDays ?? 0;
        const today0 = new Date(now);
        today0.setHours(0, 0, 0, 0);
        const last0 = new Date(this.props.lastRun);
        last0.setHours(0, 0, 0, 0);
        const diffMs = today0.getTime() - last0.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        const ok = diffDays >= forDays;
        return {
            shouldRun: ok,
            reason: ok
                ? `interval: diffDays=${diffDays} >= ${forDays}`
                : `interval: diffDays=${diffDays} < ${forDays}`,
        };
    }
    hourFromLegacyTime(time) {
        if (time === null || time === undefined)
            return null;
        if (!Number.isFinite(time))
            return null;
        if (time >= 0 && time <= 23)
            return Math.trunc(time);
        if (time === 1440)
            return 0;
        if (time < 0 || time > 1439)
            return null;
        return Math.floor(time / 60);
    }
    localDateOnlyKey(d, isFromDatabase = false) {
        if (isFromDatabase) {
            return d.toISOString().split('T')[0];
        }
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
    assertInvariants() {
        if (this.isInterval()) {
            if (this.props.daily !== false)
                throw new Error('Invalid interval schedule: daily must be false');
            if (this.props.date !== null)
                throw new Error('Invalid interval schedule: date must be null');
            if (this.props.time === null)
                throw new Error('Invalid interval schedule: time is required');
            if (this.hourFromLegacyTime(this.props.time) === null) {
                throw new Error('Invalid interval schedule: time is invalid');
            }
        }
    }
}
exports.EmailSchedule = EmailSchedule;
//# sourceMappingURL=email_schedules_domain.js.map