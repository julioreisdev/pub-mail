"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SocialPostSchedulesRunner_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialPostSchedulesRunner = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const social_post_schedules_service_1 = require("./social-post-schedules.service");
let SocialPostSchedulesRunner = SocialPostSchedulesRunner_1 = class SocialPostSchedulesRunner {
    socialPostSchedulesService;
    logger = new common_1.Logger(SocialPostSchedulesRunner_1.name);
    constructor(socialPostSchedulesService) {
        this.socialPostSchedulesService = socialPostSchedulesService;
    }
    async handleCron() {
        const now = new Date();
        const runAtHour = new Date(now);
        runAtHour.setMinutes(0, 0, 0);
        this.logger.debug(`[tick-social] runAtHour=${runAtHour.toISOString()}`);
        await this.socialPostSchedulesService.processDueSchedules(runAtHour);
    }
    async handleTikTokStatusPollingCron() {
        await this.socialPostSchedulesService.processTikTokPendingRunsStatus();
    }
};
exports.SocialPostSchedulesRunner = SocialPostSchedulesRunner;
__decorate([
    (0, schedule_1.Cron)('0 0 * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SocialPostSchedulesRunner.prototype, "handleCron", null);
__decorate([
    (0, schedule_1.Cron)('30 * * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SocialPostSchedulesRunner.prototype, "handleTikTokStatusPollingCron", null);
exports.SocialPostSchedulesRunner = SocialPostSchedulesRunner = SocialPostSchedulesRunner_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [social_post_schedules_service_1.SocialPostSchedulesService])
], SocialPostSchedulesRunner);
//# sourceMappingURL=social-post-schedules.runner.js.map