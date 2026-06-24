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
exports.EmailTemplatesController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../../auth/jwt-auth.guard");
const templates_service_1 = require("./templates.service");
const create_email_template_dto_1 = require("./dto/create-email-template.dto");
const update_email_template_dto_1 = require("./dto/update-email-template.dto");
const swagger_1 = require("@nestjs/swagger");
let EmailTemplatesController = class EmailTemplatesController {
    service;
    constructor(service) {
        this.service = service;
    }
    create(req, projectId, dto) {
        return this.service.create(req.user.organizationId, projectId, dto);
    }
    list(req, projectId) {
        return this.service.list(req.user.organizationId, projectId);
    }
    update(req, id, dto) {
        return this.service.update(req.user.organizationId, id, dto);
    }
    remove(req, id) {
        return this.service.remove(req.user.organizationId, id);
    }
};
exports.EmailTemplatesController = EmailTemplatesController;
__decorate([
    (0, common_1.Post)('projects/:projectId/templates'),
    (0, swagger_1.ApiOperation)({ summary: 'Criar template dentro de um projeto' }),
    (0, swagger_1.ApiParam)({ name: 'projectId', description: 'ID do projeto', type: String, format: 'uuid' }),
    (0, swagger_1.ApiBody)({
        type: create_email_template_dto_1.CreateEmailTemplateDto,
        description: 'Informe pelo menos um: body_html ou body_text.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'Template criado com sucesso' }),
    (0, swagger_1.ApiBadRequestResponse)({
        description: 'Dados inválidos (ex: body_html e body_text ausentes)',
    }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Projeto não encontrado' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('projectId', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, create_email_template_dto_1.CreateEmailTemplateDto]),
    __metadata("design:returntype", void 0)
], EmailTemplatesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('projects/:projectId/templates'),
    (0, swagger_1.ApiOperation)({ summary: 'Listar templates de um projeto' }),
    (0, swagger_1.ApiParam)({ name: 'projectId', description: 'ID do projeto', type: String, format: 'uuid' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Lista de templates' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Projeto não encontrado' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('projectId', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], EmailTemplatesController.prototype, "list", null);
__decorate([
    (0, common_1.Patch)('templates/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Atualizar template' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID do template', type: String, format: 'uuid' }),
    (0, swagger_1.ApiBody)({
        type: update_email_template_dto_1.UpdateEmailTemplateDto,
        description: 'Você pode atualizar qualquer campo. Atenção: o template precisa continuar tendo body_html ou body_text.',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'Template atualizado com sucesso' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Template não encontrado' }),
    (0, swagger_1.ApiBadRequestResponse)({
        description: 'Dados inválidos (ex: tentativa de deixar body_html e body_text vazios)',
    }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_email_template_dto_1.UpdateEmailTemplateDto]),
    __metadata("design:returntype", void 0)
], EmailTemplatesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)('templates/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Remover template' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID do template', type: String, format: 'uuid' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Template removido com sucesso' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Template não encontrado' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], EmailTemplatesController.prototype, "remove", null);
exports.EmailTemplatesController = EmailTemplatesController = __decorate([
    (0, swagger_1.ApiTags)('Email Marketing - Templates'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('email'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [templates_service_1.EmailTemplatesService])
], EmailTemplatesController);
//# sourceMappingURL=templates.controller.js.map