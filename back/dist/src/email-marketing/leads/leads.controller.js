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
exports.EmailLeadsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../../auth/jwt-auth.guard");
const public_decorator_1 = require("../../auth/public.decorator");
const leads_service_1 = require("./leads.service");
const create_email_lead_dto_1 = require("./dto/create-email-lead.dto");
const update_email_lead_dto_1 = require("./dto/update-email-lead.dto");
const public_subscribe_dto_1 = require("./dto/public-subscribe.dto");
const swagger_1 = require("@nestjs/swagger");
let EmailLeadsController = class EmailLeadsController {
    service;
    constructor(service) {
        this.service = service;
    }
    subscribe(organizationId, projectId, dto) {
        return this.service.publicSubscribe(organizationId, projectId, dto);
    }
    create(req, dto) {
        return this.service.create(req.user.organizationId, dto);
    }
    list(req) {
        return this.service.list(req.user.organizationId);
    }
    update(req, id, dto) {
        return this.service.update(req.user.organizationId, id, dto);
    }
    remove(req, id) {
        return this.service.remove(req.user.organizationId, id);
    }
    countLeads(req, projectId) {
        return this.service.countLeadsByProject(req.user.organizationId, projectId);
    }
    unsubscribe(projectId, leadEmail) {
        return this.service.unsubscribe(projectId, leadEmail);
    }
};
exports.EmailLeadsController = EmailLeadsController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('subscribe/:organizationId/:projectId'),
    (0, swagger_1.ApiOperation)({ summary: 'Webhook público: inscrever/reativar lead em um projeto (sem autenticação)' }),
    (0, swagger_1.ApiParam)({ name: 'organizationId', description: 'ID da organização (tenant)', type: String, format: 'uuid' }),
    (0, swagger_1.ApiParam)({ name: 'projectId', description: 'ID do projeto de e-mail', type: String, format: 'uuid' }),
    (0, swagger_1.ApiBody)({ type: public_subscribe_dto_1.PublicSubscribeDto }),
    (0, swagger_1.ApiOkResponse)({ description: 'Lead inscrito/reativado com sucesso' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Organization ou Project não encontrado' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Payload inválido' }),
    __param(0, (0, common_1.Param)('organizationId', new common_1.ParseUUIDPipe())),
    __param(1, (0, common_1.Param)('projectId', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, public_subscribe_dto_1.PublicSubscribeDto]),
    __metadata("design:returntype", void 0)
], EmailLeadsController.prototype, "subscribe", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Criar lead manualmente (autenticado)' }),
    (0, swagger_1.ApiBody)({ type: create_email_lead_dto_1.CreateEmailLeadDto }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'Lead criado com sucesso' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Email duplicado ou dados inválidos' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_email_lead_dto_1.CreateEmailLeadDto]),
    __metadata("design:returntype", void 0)
], EmailLeadsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Listar leads da organização (autenticado)' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Lista de leads' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EmailLeadsController.prototype, "list", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Atualizar lead (autenticado)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID do lead', type: String, format: 'uuid' }),
    (0, swagger_1.ApiBody)({ type: update_email_lead_dto_1.UpdateEmailLeadDto }),
    (0, swagger_1.ApiOkResponse)({ description: 'Lead atualizado com sucesso' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Lead não encontrado' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_email_lead_dto_1.UpdateEmailLeadDto]),
    __metadata("design:returntype", void 0)
], EmailLeadsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Remover lead (autenticado)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID do lead', type: String, format: 'uuid' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Lead removido com sucesso' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Lead não encontrado' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], EmailLeadsController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)('leads-count/:projectId'),
    (0, swagger_1.ApiOperation)({ summary: 'Contar leads inscritos e desinscritos em um projeto (autenticado)' }),
    (0, swagger_1.ApiParam)({ name: 'projectId', description: 'ID do projeto de e-mail', type: String, format: 'uuid' }),
    (0, swagger_1.ApiOkResponse)({
        description: 'Contagem retornada com sucesso',
        schema: {
            type: 'object',
            properties: {
                inscribed_leads: { type: 'number', example: 10 },
                unscribed_leads: { type: 'number', example: 2 },
            },
        },
    }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Projeto não encontrado' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('projectId', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], EmailLeadsController.prototype, "countLeads", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)("unsubscribe/:projectId/:leadEmail"),
    (0, swagger_1.ApiOperation)({ summary: 'Desinscrever lead de um projeto (público, sem autenticação)' }),
    (0, swagger_1.ApiParam)({ name: 'projectId', description: 'ID do projeto de e-mail', type: String, format: 'uuid' }),
    (0, swagger_1.ApiParam)({
        name: 'leadEmail',
        description: 'Email do lead (use URL encoded, ex: cliente%40exemplo.com)',
        type: String,
        example: 'cliente%40exemplo.com',
    }),
    (0, swagger_1.ApiProduces)('text/plain'),
    (0, swagger_1.ApiOkResponse)({
        description: 'Texto simples com mensagem de confirmação. Vem de settings.unsubscribe_message ou fallback "Unsubscribed!"',
        schema: {
            type: 'string',
            example: 'Unsubscribed!',
        },
    }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Project, Lead ou vínculo não encontrado' }),
    __param(0, (0, common_1.Param)("projectId")),
    __param(1, (0, common_1.Param)("leadEmail")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], EmailLeadsController.prototype, "unsubscribe", null);
exports.EmailLeadsController = EmailLeadsController = __decorate([
    (0, swagger_1.ApiTags)('Email Marketing - Leads'),
    (0, common_1.Controller)('email/leads'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [leads_service_1.EmailLeadsService])
], EmailLeadsController);
//# sourceMappingURL=leads.controller.js.map