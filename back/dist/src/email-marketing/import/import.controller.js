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
exports.EmailImportController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const jwt_auth_guard_1 = require("../../auth/jwt-auth.guard");
const import_service_1 = require("./import.service");
const swagger_1 = require("@nestjs/swagger");
let EmailImportController = class EmailImportController {
    service;
    constructor(service) {
        this.service = service;
    }
    async importLeads(req, projectId, file) {
        if (!file)
            throw new common_1.BadRequestException('file is required');
        const ext = (file.originalname || '').toLowerCase();
        const ok = ext.endsWith('.csv') || ext.endsWith('.xlsx');
        if (!ok)
            throw new common_1.BadRequestException('Only .csv or .xlsx files are supported');
        return this.service.importLeads(req.user.organizationId, projectId, file);
    }
    async exportAllLeads(req, res) {
        const buffer = await this.service.exportAllLeads(req.user.organizationId);
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="all_leads.xlsx"',
        });
        res.send(buffer);
    }
    async exportProjectLeads(req, projectId, res) {
        const buffer = await this.service.exportProjectLeads(req.user.organizationId, projectId);
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="project_${projectId}_leads.xlsx"`,
        });
        res.send(buffer);
    }
    async shareLeads(req, fromProjectId, toProjectId) {
        if (fromProjectId === toProjectId) {
            throw new common_1.BadRequestException('Source and destination projects cannot be the same');
        }
        return this.service.shareLeads(req.user.organizationId, fromProjectId, toProjectId);
    }
};
exports.EmailImportController = EmailImportController;
__decorate([
    (0, common_1.Post)('projects/:projectId/import'),
    (0, swagger_1.ApiOperation)({ summary: 'Importar leads para um projeto via CSV/XLSX' }),
    (0, swagger_1.ApiParam)({ name: 'projectId', type: String, format: 'uuid' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                    description: 'Arquivo .csv ou .xlsx',
                },
            },
            required: ['file'],
        },
    }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'Importação processada com sucesso' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Arquivo ausente ou formato inválido' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Projeto não encontrado' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: 10 * 1024 * 1024 },
    })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('projectId', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], EmailImportController.prototype, "importLeads", null);
__decorate([
    (0, common_1.Get)('leads/export'),
    (0, swagger_1.ApiOperation)({ summary: 'Exportar todos os leads da organização em XLSX' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Arquivo XLSX com todos os leads' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], EmailImportController.prototype, "exportAllLeads", null);
__decorate([
    (0, common_1.Get)('projects/:projectId/export'),
    (0, swagger_1.ApiOperation)({
        summary: 'Exportar todos os leads de um projeto específico em XLSX',
    }),
    (0, swagger_1.ApiParam)({ name: 'projectId', type: String, format: 'uuid' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Arquivo XLSX com os leads do projeto' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('projectId', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], EmailImportController.prototype, "exportProjectLeads", null);
__decorate([
    (0, common_1.Get)('leads/share/:fromProjectId/:toProjectId'),
    (0, swagger_1.ApiOperation)({
        summary: 'Copia os leads de um projeto de origem para um projeto de destino',
    }),
    (0, swagger_1.ApiParam)({ name: 'fromProjectId', type: String, format: 'uuid' }),
    (0, swagger_1.ApiParam)({ name: 'toProjectId', type: String, format: 'uuid' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Leads compartilhados com sucesso' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('fromProjectId', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Param)('toProjectId', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], EmailImportController.prototype, "shareLeads", null);
exports.EmailImportController = EmailImportController = __decorate([
    (0, swagger_1.ApiTags)('Email Marketing - Leads & Import'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('email'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [import_service_1.EmailImportService])
], EmailImportController);
//# sourceMappingURL=import.controller.js.map