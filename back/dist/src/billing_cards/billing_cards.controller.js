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
exports.BillingCardsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const billing_cards_service_1 = require("./billing-cards.service");
const create_billing_card_dto_1 = require("./dto/create-billing-card.dto");
const update_billing_card_dto_1 = require("./dto/update-billing-card.dto");
const swagger_1 = require("@nestjs/swagger");
let BillingCardsController = class BillingCardsController {
    service;
    constructor(service) {
        this.service = service;
    }
    list(req) {
        return this.service.listMyCards(req.user.organizationId);
    }
    create(req, dto) {
        return this.service.createMyCard(req.user.organizationId, dto);
    }
    update(req, id, dto) {
        return this.service.updateMyCard(req.user.organizationId, id, dto);
    }
    setDefault(req, id) {
        return this.service.setDefault(req.user.organizationId, id);
    }
    remove(req, id) {
        return this.service.removeMyCard(req.user.organizationId, id);
    }
};
exports.BillingCardsController = BillingCardsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Listar cartões cadastrados da organização' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Lista de cartões retornada com sucesso' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BillingCardsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Cadastrar um novo cartão para a organização' }),
    (0, swagger_1.ApiBody)({ type: create_billing_card_dto_1.CreateBillingCardDto }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'Cartão cadastrado com sucesso' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Dados inválidos' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_billing_card_dto_1.CreateBillingCardDto]),
    __metadata("design:returntype", void 0)
], BillingCardsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Atualizar dados de um cartão' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID do cartão', type: String, format: 'uuid' }),
    (0, swagger_1.ApiBody)({ type: update_billing_card_dto_1.UpdateBillingCardDto }),
    (0, swagger_1.ApiOkResponse)({ description: 'Cartão atualizado com sucesso' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Dados inválidos' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Cartão não encontrado' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_billing_card_dto_1.UpdateBillingCardDto]),
    __metadata("design:returntype", void 0)
], BillingCardsController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/default'),
    (0, swagger_1.ApiOperation)({ summary: 'Definir um cartão como padrão (default)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID do cartão', type: String, format: 'uuid' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Cartão definido como padrão com sucesso' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Cartão não encontrado' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BillingCardsController.prototype, "setDefault", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Remover um cartão' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID do cartão', type: String, format: 'uuid' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Cartão removido com sucesso' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Cartão não encontrado' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BillingCardsController.prototype, "remove", null);
exports.BillingCardsController = BillingCardsController = __decorate([
    (0, swagger_1.ApiTags)('Billing - Cards'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('billing/cards'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [billing_cards_service_1.BillingCardsService])
], BillingCardsController);
//# sourceMappingURL=billing_cards.controller.js.map