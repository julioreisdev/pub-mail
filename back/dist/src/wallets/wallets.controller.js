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
exports.WalletsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const wallets_service_1 = require("./wallets.service");
const list_transactions_dto_1 = require("./dto/list-transactions.dto");
const swagger_1 = require("@nestjs/swagger");
let WalletsController = class WalletsController {
    walletsService;
    constructor(walletsService) {
        this.walletsService = walletsService;
    }
    me(req) {
        return this.walletsService.getMyWallet(req.user.organizationId);
    }
    transactions(req, query) {
        return this.walletsService.listMyTransactions(req.user.organizationId, query);
    }
};
exports.WalletsController = WalletsController;
__decorate([
    (0, common_1.Get)('balance'),
    (0, swagger_1.ApiOperation)({ summary: 'Consultar saldo da carteira da organização logada' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Saldo e dados da carteira retornados com sucesso' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], WalletsController.prototype, "me", null);
__decorate([
    (0, common_1.Get)('transactions'),
    (0, swagger_1.ApiOperation)({ summary: 'Listar transações da carteira da organização logada' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number, description: 'Página da listagem' }),
    (0, swagger_1.ApiQuery)({ name: 'pageSize', required: false, type: Number, description: 'Itens por página (máximo 100)' }),
    (0, swagger_1.ApiQuery)({ name: 'type', required: false, type: String, description: 'Filtro por tipo (string livre: TOPUP, USAGE, etc.)' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Lista paginada de transações retornada com sucesso' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_transactions_dto_1.ListTransactionsDto]),
    __metadata("design:returntype", void 0)
], WalletsController.prototype, "transactions", null);
exports.WalletsController = WalletsController = __decorate([
    (0, swagger_1.ApiTags)('Wallet'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('wallet'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [wallets_service_1.WalletsService])
], WalletsController);
//# sourceMappingURL=wallets.controller.js.map