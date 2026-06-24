"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectSchedule = void 0;
const common_1 = require("@nestjs/common");
class ProjectSchedule {
    props;
    constructor(props) {
        this.props = props;
        this.assertInvariants();
    }
    static create(input) {
        const dateNormalized = input.date === undefined || input.date === null
            ? null
            : this.parseAndNormalizeDateOnly(input.date);
        return new ProjectSchedule({
            projectId: input.projectId,
            daily: input.daily,
            date: dateNormalized,
            time: input.time ?? null,
            forXDays: input.forXDays ?? null,
            lastRun: null,
        });
    }
    static rehydrate(raw) {
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
    update(input) {
        const nextDaily = input.daily ?? this.props.daily;
        const nextForXDays = input.forXDays === undefined ? this.props.forXDays : (input.forXDays ?? null);
        const nextTime = input.time === undefined ? this.props.time : (input.time ?? null);
        let nextDate;
        if (input.date === undefined) {
            nextDate = this.props.date;
        }
        else if (input.date === null) {
            nextDate = null;
        }
        else {
            nextDate = ProjectSchedule.parseAndNormalizeDateOnly(input.date);
        }
        return new ProjectSchedule({
            ...this.props,
            daily: nextDaily,
            time: nextTime,
            date: nextDate,
            forXDays: nextForXDays,
            lastRun: this.props.lastRun,
        });
    }
    mode() {
        if (this.isInterval())
            return 'INTERVAL';
        return this.props.daily ? 'DAILY' : 'ONE_OFF';
    }
    isInterval() {
        return typeof this.props.forXDays === 'number' && this.props.forXDays > 0;
    }
    assertInvariants() {
        if (this.props.time === null || this.props.time === undefined) {
            throw new common_1.BadRequestException('time is required');
        }
        this.assertLegacyTimeRange(this.props.time);
        if (this.isInterval()) {
            if (!Number.isInteger(this.props.forXDays) || (this.props.forXDays ?? 0) <= 0) {
                throw new common_1.BadRequestException('for_x_days must be an integer greater than 0');
            }
            if (this.props.daily !== false) {
                throw new common_1.BadRequestException('when for_x_days is provided, daily must be false');
            }
            if (this.props.date !== null) {
                throw new common_1.BadRequestException('when for_x_days is provided, date must be null');
            }
            return;
        }
        if (this.props.daily === true) {
            if (this.props.date !== null) {
                throw new common_1.BadRequestException('date must be null when daily is true');
            }
            if (this.props.forXDays !== null && this.props.forXDays !== undefined) {
                throw new common_1.BadRequestException('for_x_days must be null when daily is true');
            }
            return;
        }
        if (this.props.daily === false) {
            if (this.props.forXDays !== null && this.props.forXDays !== undefined) {
                throw new common_1.BadRequestException('for_x_days must be null for one-off schedules');
            }
            if (this.props.date === null) {
                throw new common_1.BadRequestException('date is required when daily is false');
            }
            return;
        }
    }
    assertLegacyTimeRange(time) {
        if (!Number.isInteger(time) || time < 0 || time > 1439) {
            throw new common_1.BadRequestException('time must be an integer between 0 and 1439');
        }
    }
    toPersistenceForCreate() {
        return {
            project_id: this.props.projectId,
            daily: this.props.daily,
            date: this.props.date,
            time: this.props.time,
            for_x_days: this.props.forXDays,
            last_run: null,
        };
    }
    toPersistenceForUpdate() {
        return {
            daily: this.props.daily,
            date: this.props.date,
            time: this.props.time,
            for_x_days: this.props.forXDays,
        };
    }
    static normalizeDateOnly(date) {
        const d = new Date(date);
        d.setUTCHours(0, 0, 0, 0);
        return d;
    }
    static parseAndNormalizeDateOnly(input) {
        const parsed = new Date(input);
        if (Number.isNaN(parsed.getTime())) {
            throw new common_1.BadRequestException('date must be a valid ISO datetime');
        }
        return this.normalizeDateOnly(parsed);
    }
}
exports.ProjectSchedule = ProjectSchedule;
//# sourceMappingURL=project_schedule.entity.js.map