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
exports.ProjectSchedulesController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const project_schedules_service_1 = require("./project_schedules.service");
const create_project_schedule_dto_1 = require("./dto/create-project_schedule.dto");
const update_project_schedule_dto_1 = require("./dto/update-project_schedule.dto");
const swagger_1 = require("@nestjs/swagger");
const schedules_service_1 = require("../cron-jobs/schedules.service");
let ProjectSchedulesController = class ProjectSchedulesController {
    service;
    emailSchedulesRunner;
    constructor(service, emailSchedulesRunner) {
        this.service = service;
        this.emailSchedulesRunner = emailSchedulesRunner;
    }
    async dispatchNow(req, projectId) {
        try {
            const result = await this.emailSchedulesRunner.executeManualDispatch(projectId);
            return result;
        }
        catch (error) {
            throw new common_1.HttpException(error.message, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    create(req, projectId, dto) {
        return this.service.create(req.user.organizationId, projectId, dto);
    }
    getOne(req, projectId, scheduleId) {
        return this.service.getOne(req.user.organizationId, projectId, scheduleId);
    }
    list(req, projectId) {
        return this.service.list(req.user.organizationId, projectId);
    }
    update(req, projectId, scheduleId, dto) {
        return this.service.update(req.user.organizationId, projectId, scheduleId, dto);
    }
    remove(req, projectId, scheduleId) {
        return this.service.remove(req.user.organizationId, projectId, scheduleId);
    }
};
exports.ProjectSchedulesController = ProjectSchedulesController;
__decorate([
    (0, common_1.Post)(':projectId/dispatch-now'),
    (0, swagger_1.ApiOperation)({
        summary: 'Disparo manual imediato de um template aleatório para um projeto',
    }),
    (0, swagger_1.ApiParam)({
        name: 'projectId',
        description: 'ID do projeto',
        type: String,
        format: 'uuid',
    }),
    (0, swagger_1.ApiCreatedResponse)({
        description: 'Disparo iniciado com sucesso e tokens debitados.',
    }),
    (0, swagger_1.ApiBadRequestResponse)({
        description: 'Saldo insuficiente ou nenhum template/lead encontrado.',
    }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('projectId', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ProjectSchedulesController.prototype, "dispatchNow", null);
__decorate([
    (0, common_1.Post)(':projectId/schedules'),
    (0, swagger_1.ApiOperation)({ summary: 'Criar agendamento de disparo para um projeto' }),
    (0, swagger_1.ApiParam)({
        name: 'projectId',
        description: 'ID do projeto',
        type: String,
        format: 'uuid',
    }),
    (0, swagger_1.ApiExtraModels)(create_project_schedule_dto_1.CreateEmailProjectScheduleDto),
    (0, swagger_1.ApiBody)({
        description: 'Criação de agendamento. Existem 3 modos: DAILY, ONE-OFF e INTERVAL. ' +
            '**Importante:** o campo `time` aceita HORA (0..23) ou MINUTO DO DIA (0..1439). ' +
            'Ex.: 17 => 17:00 (hora); 1020 => 17:00 (minuto do dia).',
        schema: {
            oneOf: [
                { $ref: (0, swagger_1.getSchemaPath)(create_project_schedule_dto_1.CreateEmailProjectScheduleDto) },
                { $ref: (0, swagger_1.getSchemaPath)(create_project_schedule_dto_1.CreateEmailProjectScheduleDto) },
                { $ref: (0, swagger_1.getSchemaPath)(create_project_schedule_dto_1.CreateEmailProjectScheduleDto) },
            ],
        },
        examples: {
            DAILY_HOUR: {
                summary: 'DAILY (diário) — hora (frontend)',
                description: 'daily=true, time pode ser HORA (0..23) ou MINUTO DO DIA (0..1439). ' +
                    'date e for_x_days devem ser omitidos ou null.',
                value: { daily: true, time: 17 },
            },
            DAILY_MINUTES: {
                summary: 'DAILY (diário) — minuto do dia (legado)',
                description: 'daily=true, time em MINUTO DO DIA (0..1439). ' +
                    'date e for_x_days devem ser omitidos ou null.',
                value: { daily: true, time: 1020 },
            },
            ONE_OFF_HOUR: {
                summary: 'ONE-OFF (dia específico) — hora (frontend)',
                description: 'daily=false, date obrigatório (date-only ISO), time pode ser HORA (0..23) ou MINUTO DO DIA (0..1439). ' +
                    'for_x_days deve ser omitido/null.',
                value: { daily: false, date: '2026-02-20T00:00:00.000Z', time: 17 },
            },
            ONE_OFF_MINUTES: {
                summary: 'ONE-OFF (dia específico) — minuto do dia (legado)',
                description: 'daily=false, date obrigatório (date-only ISO), time em MINUTO DO DIA (0..1439). ' +
                    'for_x_days deve ser omitido/null.',
                value: { daily: false, date: '2026-02-20T00:00:00.000Z', time: 1020 },
            },
            INTERVAL_HOUR: {
                summary: 'INTERVAL (a cada N dias) — hora (frontend)',
                description: 'daily=false, date=null, time pode ser HORA (0..23) ou MINUTO DO DIA (0..1439), for_x_days obrigatório (>0). ' +
                    'last_run é controlado pelo cron.',
                value: { daily: false, date: null, time: 17, for_x_days: 10 },
            },
            INTERVAL_MINUTES: {
                summary: 'INTERVAL (a cada N dias) — minuto do dia (legado)',
                description: 'daily=false, date=null, time em MINUTO DO DIA (0..1439), for_x_days obrigatório (>0). ' +
                    'last_run é controlado pelo cron.',
                value: { daily: false, date: null, time: 1020, for_x_days: 10 },
            },
        },
    }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'Agendamento criado com sucesso' }),
    (0, swagger_1.ApiBadRequestResponse)({
        description: 'Dados inválidos (ex: combinações daily/date/time/for_x_days)',
    }),
    (0, swagger_1.ApiNotFoundResponse)({
        description: 'Projeto não encontrado (ou não pertence à organização)',
    }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('projectId', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, create_project_schedule_dto_1.CreateEmailProjectScheduleDto]),
    __metadata("design:returntype", void 0)
], ProjectSchedulesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':projectId/schedules/:scheduleId'),
    (0, swagger_1.ApiOperation)({ summary: 'Buscar um agendamento específico' }),
    (0, swagger_1.ApiParam)({
        name: 'projectId',
        description: 'ID do projeto',
        type: String,
        format: 'uuid',
    }),
    (0, swagger_1.ApiParam)({
        name: 'scheduleId',
        description: 'ID do agendamento',
        type: String,
        format: 'uuid',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'Agendamento' }),
    (0, swagger_1.ApiNotFoundResponse)({
        description: 'Agendamento não encontrado (ou não pertence à organização)',
    }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('projectId', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Param)('scheduleId', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], ProjectSchedulesController.prototype, "getOne", null);
__decorate([
    (0, common_1.Get)(':projectId/schedules'),
    (0, swagger_1.ApiOperation)({ summary: 'Listar agendamentos de um projeto' }),
    (0, swagger_1.ApiParam)({
        name: 'projectId',
        description: 'ID do projeto',
        type: String,
        format: 'uuid',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'Lista de agendamentos' }),
    (0, swagger_1.ApiNotFoundResponse)({
        description: 'Projeto não encontrado (ou não pertence à organização)',
    }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('projectId', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ProjectSchedulesController.prototype, "list", null);
__decorate([
    (0, common_1.Patch)(':projectId/schedules/:scheduleId'),
    (0, swagger_1.ApiOperation)({ summary: 'Atualizar agendamento' }),
    (0, swagger_1.ApiParam)({
        name: 'projectId',
        description: 'ID do projeto',
        type: String,
        format: 'uuid',
    }),
    (0, swagger_1.ApiParam)({
        name: 'scheduleId',
        description: 'ID do agendamento',
        type: String,
        format: 'uuid',
    }),
    (0, swagger_1.ApiExtraModels)(update_project_schedule_dto_1.UpdateEmailProjectScheduleDto),
    (0, swagger_1.ApiBody)({
        description: 'Atualização parcial. O estado final precisa respeitar DAILY / ONE-OFF / INTERVAL. ' +
            '**Importante:** o campo `time` aceita HORA (0..23) ou MINUTO DO DIA (0..1439).',
        schema: {
            oneOf: [
                { $ref: (0, swagger_1.getSchemaPath)(update_project_schedule_dto_1.UpdateEmailProjectScheduleDto) },
                { $ref: (0, swagger_1.getSchemaPath)(update_project_schedule_dto_1.UpdateEmailProjectScheduleDto) },
                { $ref: (0, swagger_1.getSchemaPath)(update_project_schedule_dto_1.UpdateEmailProjectScheduleDto) },
                { $ref: (0, swagger_1.getSchemaPath)(update_project_schedule_dto_1.UpdateEmailProjectScheduleDto) },
            ],
        },
        examples: {
            CHANGE_TIME_ONLY_HOUR: {
                summary: 'Mudar somente horário — hora (frontend)',
                description: 'Mantém o modo atual, desde que continue válido.',
                value: { time: 17 },
            },
            CHANGE_TIME_ONLY_MINUTES: {
                summary: 'Mudar somente horário — minuto do dia (legado)',
                description: 'Mantém o modo atual, desde que continue válido.',
                value: { time: 1020 },
            },
            TO_DAILY: {
                summary: 'Converter para DAILY',
                description: 'daily=true exige date=null e for_x_days=null.',
                value: { daily: true, time: 17, date: null, for_x_days: null },
            },
            TO_ONE_OFF: {
                summary: 'Converter para ONE-OFF',
                description: 'daily=false exige date != null e for_x_days=null.',
                value: {
                    daily: false,
                    date: '2026-02-21T00:00:00.000Z',
                    time: 17,
                    for_x_days: null,
                },
            },
            TO_INTERVAL: {
                summary: 'Converter para INTERVAL',
                description: 'for_x_days > 0 exige daily=false e date=null.',
                value: { daily: false, date: null, time: 17, for_x_days: 10 },
            },
        },
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'Agendamento atualizado com sucesso' }),
    (0, swagger_1.ApiBadRequestResponse)({
        description: 'Dados inválidos (ex: combinações daily/date/time/for_x_days)',
    }),
    (0, swagger_1.ApiNotFoundResponse)({
        description: 'Agendamento não encontrado (ou não pertence à organização)',
    }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('projectId', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Param)('scheduleId', new common_1.ParseUUIDPipe())),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, update_project_schedule_dto_1.UpdateEmailProjectScheduleDto]),
    __metadata("design:returntype", void 0)
], ProjectSchedulesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':projectId/schedules/:scheduleId'),
    (0, swagger_1.ApiOperation)({ summary: 'Remover agendamento' }),
    (0, swagger_1.ApiParam)({
        name: 'projectId',
        description: 'ID do projeto',
        type: String,
        format: 'uuid',
    }),
    (0, swagger_1.ApiParam)({
        name: 'scheduleId',
        description: 'ID do agendamento',
        type: String,
        format: 'uuid',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'Agendamento removido com sucesso' }),
    (0, swagger_1.ApiNotFoundResponse)({
        description: 'Agendamento não encontrado (ou não pertence à organização)',
    }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('projectId', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Param)('scheduleId', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], ProjectSchedulesController.prototype, "remove", null);
exports.ProjectSchedulesController = ProjectSchedulesController = __decorate([
    (0, swagger_1.ApiTags)('Email Marketing - Schedules'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('email/projects'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [project_schedules_service_1.ProjectSchedulesService,
        schedules_service_1.EmailSchedulesRunner])
], ProjectSchedulesController);
//# sourceMappingURL=project_schedules.controller.js.map