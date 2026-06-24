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
exports.IaIntegrationsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const ia_integrations_service_1 = require("./ia-integrations.service");
const generate_email_template_dto_1 = require("./dto/generate-email-template.dto");
const swagger_1 = require("@nestjs/swagger");
let IaIntegrationsController = class IaIntegrationsController {
    service;
    constructor(service) {
        this.service = service;
    }
    generateEmailTemplate(req, dto) {
        return this.service.generateEmailTemplate(req.user.organizationId, dto);
    }
};
exports.IaIntegrationsController = IaIntegrationsController;
__decorate([
    (0, common_1.Post)('email-template/generate'),
    (0, swagger_1.ApiOperation)({ summary: 'Gerar template de e-mail usando Inteligência Artificial' }),
    (0, swagger_1.ApiBody)({ type: generate_email_template_dto_1.GenerateEmailTemplateDto }),
    (0, swagger_1.ApiOkResponse)({ description: 'Template gerado e tokens debitados com sucesso' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Saldo insuficiente ou dados inválidos' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, generate_email_template_dto_1.GenerateEmailTemplateDto]),
    __metadata("design:returntype", void 0)
], IaIntegrationsController.prototype, "generateEmailTemplate", null);
exports.IaIntegrationsController = IaIntegrationsController = __decorate([
    (0, swagger_1.ApiTags)('IA Integrations'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('ia'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [ia_integrations_service_1.IaIntegrationsService])
], IaIntegrationsController);
//# sourceMappingURL=ia-integrations.controller.js.map