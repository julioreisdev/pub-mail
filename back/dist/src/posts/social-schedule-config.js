"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SOCIAL_POST_SCHEDULES_TIMEZONE = exports.DEFAULT_SOCIAL_POST_SCHEDULE_TOKENS_COST = exports.SOCIAL_POST_SCHEDULE_TOKENS_COST_ENV = void 0;
exports.getSocialPostScheduleTokensCost = getSocialPostScheduleTokensCost;
exports.SOCIAL_POST_SCHEDULE_TOKENS_COST_ENV = 'SOCIAL_POST_SCHEDULE_TOKENS_COST';
exports.DEFAULT_SOCIAL_POST_SCHEDULE_TOKENS_COST = 1000;
exports.SOCIAL_POST_SCHEDULES_TIMEZONE = 'America/Sao_Paulo';
function getSocialPostScheduleTokensCost() {
    const rawValue = process.env[exports.SOCIAL_POST_SCHEDULE_TOKENS_COST_ENV];
    const parsed = Number(rawValue);
    if (Number.isFinite(parsed) && parsed >= 0) {
        return Math.floor(parsed);
    }
    return exports.DEFAULT_SOCIAL_POST_SCHEDULE_TOKENS_COST;
}
//# sourceMappingURL=social-schedule-config.js.map