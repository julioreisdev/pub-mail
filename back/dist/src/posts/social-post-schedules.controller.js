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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialPostSchedulesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const create_social_post_schedule_dto_1 = require("./dto/create-social-post-schedule.dto");
const list_social_post_schedules_dto_1 = require("./dto/list-social-post-schedules.dto");
const list_social_post_schedule_runs_dto_1 = require("./dto/list-social-post-schedule-runs.dto");
const social_post_schedules_service_1 = require("./social-post-schedules.service");
let SocialPostSchedulesController = class SocialPostSchedulesController {
    socialPostSchedulesService;
    constructor(socialPostSchedulesService) {
        this.socialPostSchedulesService = socialPostSchedulesService;
    }
    getMeta() {
        return this.socialPostSchedulesService.getMeta();
    }
    getDailyLimits(req, socialNetwork) {
        return this.socialPostSchedulesService.getDailyAccountLimits(req.user.organizationId, socialNetwork);
    }
    getTikTokCreatorInfo(req, socialAccountId) {
        return this.socialPostSchedulesService.getTikTokCreatorInfoForSchedule(req.user.organizationId, socialAccountId);
    }
    create(req, dto) {
        return this.socialPostSchedulesService.create(req.user.organizationId, dto);
    }
    replace(req, id, dto) {
        return this.socialPostSchedulesService.replace(req.user.organizationId, id, dto);
    }
    remove(req, id) {
        return this.socialPostSchedulesService.remove(req.user.organizationId, id);
    }
    dispatchNow(req, id) {
        return this.socialPostSchedulesService.dispatchNow(req.user.organizationId, id);
    }
    list(req, query) {
        return this.socialPostSchedulesService.list(req.user.organizationId, query);
    }
    listHistory(req, query) {
        return this.socialPostSchedulesService.listRuns(req.user.organizationId, query);
    }
};
exports.SocialPostSchedulesController = SocialPostSchedulesController;
__decorate([
    (0, common_1.Get)('meta'),
    (0, swagger_1.ApiOperation)({
        summary: 'Metadados do módulo de agendamento social (timezone, custo por disparo, enums)',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SocialPostSchedulesController.prototype, "getMeta", null);
__decorate([
    (0, common_1.Get)('daily-limits'),
    (0, swagger_1.ApiOperation)({
        summary: 'Retorna consumo diário por conta social para a rede informada (reset 00:00 UTC)',
    }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('social_network')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SocialPostSchedulesController.prototype, "getDailyLimits", null);
__decorate([
    (0, common_1.Get)('tiktok/creator-info/:socialAccountId'),
    (0, swagger_1.ApiOperation)({
        summary: 'Consulta creator_info do TikTok para a conta informada (privacidade, interações e limite de duração)',
    }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('socialAccountId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SocialPostSchedulesController.prototype, "getTikTokCreatorInfo", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Criar agendamento social para um post da Galeria',
    }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_social_post_schedule_dto_1.CreateSocialPostScheduleDto]),
    __metadata("design:returntype", void 0)
], SocialPostSchedulesController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, swagger_1.ApiOperation)({
        summary: 'Editar agendamento social recriando o agendamento com os novos dados',
    }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, create_social_post_schedule_dto_1.CreateSocialPostScheduleDto]),
    __metadata("design:returntype", void 0)
], SocialPostSchedulesController.prototype, "replace", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({
        summary: 'Excluir agendamento social',
    }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SocialPostSchedulesController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/dispatch-now'),
    (0, swagger_1.ApiOperation)({
        summary: 'Disparar imediatamente um agendamento social já criado',
    }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SocialPostSchedulesController.prototype, "dispatchNow", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Listar agendamentos sociais da organização com filtros de rede/status/período',
    }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_social_post_schedules_dto_1.ListSocialPostSchedulesDto]),
    __metadata("design:returntype", void 0)
], SocialPostSchedulesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('history'),
    (0, swagger_1.ApiOperation)({
        summary: 'Listar histórico de disparos sociais com filtros de rede/status/período',
    }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_social_post_schedule_runs_dto_1.ListSocialPostScheduleRunsDto]),
    __metadata("design:returntype", void 0)
], SocialPostSchedulesController.prototype, "listHistory", null);
exports.SocialPostSchedulesController = SocialPostSchedulesController = __decorate([
    (0, swagger_1.ApiTags)('Posts - Agendamentos Sociais'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('posts/schedules'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [social_post_schedules_service_1.SocialPostSchedulesService])
], SocialPostSchedulesController);
//# sourceMappingURL=social-post-schedules.controller.js.map