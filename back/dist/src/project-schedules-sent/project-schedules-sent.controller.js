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
exports.ProjectSchedulesSentController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const project_schedules_sent_service_1 = require("./project-schedules-sent.service");
const swagger_1 = require("@nestjs/swagger");
let ProjectSchedulesSentController = class ProjectSchedulesSentController {
    service;
    constructor(service) {
        this.service = service;
    }
    list(req, projectId, scheduleId, sent, from, to, take, skip) {
        return this.service.list(req.user.organizationId, projectId, {
            scheduleId,
            sent,
            from,
            to,
            take,
            skip,
        });
    }
    getOne(req, projectId, sentId) {
        return this.service.getOne(req.user.organizationId, projectId, sentId);
    }
    removeOne(req, projectId, sentId) {
        return this.service.removeOne(req.user.organizationId, projectId, sentId);
    }
    purge(req, projectId, from, to) {
        return this.service.purge(req.user.organizationId, projectId, { from, to });
    }
};
exports.ProjectSchedulesSentController = ProjectSchedulesSentController;
__decorate([
    (0, common_1.Get)(':projectId/schedules-sent'),
    (0, swagger_1.ApiOperation)({ summary: 'Listar logs de disparo (sent) por projeto' }),
    (0, swagger_1.ApiParam)({ name: 'projectId', description: 'ID do projeto', type: String, format: 'uuid' }),
    (0, swagger_1.ApiQuery)({
        name: 'scheduleId',
        required: false,
        description: 'Filtra por um agendamento específico (schedule_id).',
        example: '9f3d6c2a-4c3a-4f72-9b4a-0d7a2b1c3e9a',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'sent',
        required: false,
        description: 'Filtra pelo status de envio (true/false/1/0).',
        example: 'true',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'from',
        required: false,
        description: 'Filtra por data/hora inicial (run_at >= from). ISO string.',
        example: '2026-02-18T00:00:00.000Z',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'to',
        required: false,
        description: 'Filtra por data/hora final (run_at <= to). ISO string.',
        example: '2026-02-18T23:59:00.000Z',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'take',
        required: false,
        description: 'Quantidade por página (1..200). Padrão: 50.',
        example: '50',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'skip',
        required: false,
        description: 'Quantidade para pular (>=0). Padrão: 0.',
        example: '0',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'Lista de logs' }),
    (0, swagger_1.ApiBadRequestResponse)({
        description: 'Parâmetros inválidos (scheduleId/sent/from/to/take/skip)',
    }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Projeto não encontrado (ou não pertence à organização)' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('projectId', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Query)('scheduleId')),
    __param(3, (0, common_1.Query)('sent')),
    __param(4, (0, common_1.Query)('from')),
    __param(5, (0, common_1.Query)('to')),
    __param(6, (0, common_1.Query)('take')),
    __param(7, (0, common_1.Query)('skip')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], ProjectSchedulesSentController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':projectId/schedules-sent/:sentId'),
    (0, swagger_1.ApiOperation)({ summary: 'Detalhar um log de disparo (sent)' }),
    (0, swagger_1.ApiParam)({ name: 'projectId', description: 'ID do projeto', type: String, format: 'uuid' }),
    (0, swagger_1.ApiParam)({ name: 'sentId', description: 'ID do log', type: String, format: 'uuid' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Log encontrado' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Log não encontrado (ou não pertence ao projeto/org)' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('projectId', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Param)('sentId', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], ProjectSchedulesSentController.prototype, "getOne", null);
__decorate([
    (0, common_1.Delete)(':projectId/schedules-sent/:sentId'),
    (0, swagger_1.ApiOperation)({ summary: 'Remover um log de disparo (sent)' }),
    (0, swagger_1.ApiParam)({ name: 'projectId', description: 'ID do projeto', type: String, format: 'uuid' }),
    (0, swagger_1.ApiParam)({ name: 'sentId', description: 'ID do log', type: String, format: 'uuid' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Log removido' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Log não encontrado (ou não pertence ao projeto/org)' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('projectId', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Param)('sentId', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], ProjectSchedulesSentController.prototype, "removeOne", null);
__decorate([
    (0, common_1.Delete)(':projectId/schedules-sent'),
    (0, swagger_1.ApiOperation)({ summary: 'Limpar logs de disparo por período (opcional)' }),
    (0, swagger_1.ApiParam)({ name: 'projectId', description: 'ID do projeto', type: String, format: 'uuid' }),
    (0, swagger_1.ApiQuery)({
        name: 'from',
        required: false,
        description: 'Remove registros com run_at >= from (ISO string).',
        example: '2026-02-01T00:00:00.000Z',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'to',
        required: false,
        description: 'Remove registros com run_at <= to (ISO string).',
        example: '2026-02-18T23:59:00.000Z',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'Logs removidos' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Precisa informar from e/ou to válidos' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Projeto não encontrado (ou não pertence à organização)' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('projectId', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Query)('from')),
    __param(3, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], ProjectSchedulesSentController.prototype, "purge", null);
exports.ProjectSchedulesSentController = ProjectSchedulesSentController = __decorate([
    (0, swagger_1.ApiTags)('Email Marketing - Schedules Sent'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('email/projects'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [project_schedules_sent_service_1.ProjectSchedulesSentService])
], ProjectSchedulesSentController);
//# sourceMappingURL=project-schedules-sent.controller.js.map