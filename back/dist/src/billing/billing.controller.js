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
exports.BillingController = void 0;
const common_1 = require("@nestjs/common");
const billing_service_1 = require("./billing.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const create_billing_cards_dto_1 = require("./dto/create-billing-cards.dto");
const update_billing_cards_dto_1 = require("./dto/update-billing-cards.dto");
const topup_dto_1 = require("./dto/topup.dto");
const swagger_1 = require("@nestjs/swagger");
let BillingController = class BillingController {
    billingService;
    constructor(billingService) {
        this.billingService = billingService;
    }
    async setupIntent(req) {
        const orgId = req.user.organization_id || req.user.organizationId;
        return this.billingService.createSetupIntentForOrg(orgId);
    }
    async listCards(req) {
        const orgId = req.user.organization_id || req.user.organizationId;
        return this.billingService.listCards(orgId);
    }
    async createCard(req, dto) {
        const orgId = req.user.organization_id || req.user.organizationId;
        return this.billingService.createCard(orgId, dto);
    }
    async updateCard(req, id, dto) {
        const orgId = req.user.organization_id || req.user.organizationId;
        return this.billingService.updateCard(orgId, id, dto);
    }
    async setDefault(req, id) {
        const orgId = req.user.organization_id || req.user.organizationId;
        return this.billingService.setDefaultCard(orgId, id);
    }
    async deleteCard(req, id) {
        const orgId = req.user.organization_id || req.user.organizationId;
        return this.billingService.deleteCard(orgId, id);
    }
    async topup(req, dto) {
        const orgId = req.user.organization_id || req.user.organizationId;
        return this.billingService.topupTokens(orgId, dto.tokens);
    }
};
exports.BillingController = BillingController;
__decorate([
    (0, common_1.Post)('setup-intent'),
    (0, swagger_1.ApiOperation)({ summary: 'Criar Setup Intent para salvar um cartão na organização' }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'Setup Intent criado com sucesso' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "setupIntent", null);
__decorate([
    (0, common_1.Get)('cards'),
    (0, swagger_1.ApiOperation)({ summary: 'Listar cartões da organização' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Lista de cartões retornada com sucesso' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "listCards", null);
__decorate([
    (0, common_1.Post)('cards'),
    (0, swagger_1.ApiOperation)({ summary: 'Cadastrar um cartão para a organização' }),
    (0, swagger_1.ApiBody)({ type: create_billing_cards_dto_1.CreateBillingDto }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'Cartão cadastrado com sucesso' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Dados inválidos' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_billing_cards_dto_1.CreateBillingDto]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "createCard", null);
__decorate([
    (0, common_1.Patch)('cards/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Atualizar dados de um cartão' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID do cartão', type: String, format: 'uuid' }),
    (0, swagger_1.ApiBody)({ type: update_billing_cards_dto_1.UpdateBillingDto }),
    (0, swagger_1.ApiOkResponse)({ description: 'Cartão atualizado com sucesso' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Dados inválidos' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Cartão não encontrado' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_billing_cards_dto_1.UpdateBillingDto]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "updateCard", null);
__decorate([
    (0, common_1.Patch)('cards/:id/default'),
    (0, swagger_1.ApiOperation)({ summary: 'Definir um cartão como padrão' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID do cartão', type: String, format: 'uuid' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Cartão definido como padrão com sucesso' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Cartão não encontrado' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "setDefault", null);
__decorate([
    (0, common_1.Delete)('cards/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Remover um cartão da organização' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID do cartão', type: String, format: 'uuid' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Cartão removido com sucesso' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Cartão não encontrado' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "deleteCard", null);
__decorate([
    (0, common_1.Post)('topup'),
    (0, swagger_1.ApiOperation)({ summary: 'Adicionar tokens na carteira (topup)' }),
    (0, swagger_1.ApiBody)({ type: topup_dto_1.TopupDto }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'Topup realizado com sucesso' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Dados inválidos' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, topup_dto_1.TopupDto]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "topup", null);
exports.BillingController = BillingController = __decorate([
    (0, swagger_1.ApiTags)('Billing'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('billing'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [billing_service_1.BillingService])
], BillingController);
//# sourceMappingURL=billing.controller.js.map