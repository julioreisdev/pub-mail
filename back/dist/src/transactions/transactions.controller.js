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
exports.TransactionsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const transactions_service_1 = require("./transactions.service");
const create_transaction_dto_1 = require("./dto/create-transaction.dto");
const swagger_1 = require("@nestjs/swagger");
let TransactionsController = class TransactionsController {
    service;
    constructor(service) {
        this.service = service;
    }
    create(req, dto) {
        return this.service.createForMyWallet(req.user.organizationId, dto);
    }
};
exports.TransactionsController = TransactionsController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Criar transação na carteira da organização logada',
        description: 'Cria uma transação (crédito ou débito) vinculada à carteira da organização do usuário autenticado e retorna a transação + carteira atualizada.',
    }),
    (0, swagger_1.ApiBody)({ type: create_transaction_dto_1.CreateTransactionDto }),
    (0, swagger_1.ApiCreatedResponse)({
        description: 'Transação criada com sucesso (retorna transação e carteira atualizada)',
    }),
    (0, swagger_1.ApiBadRequestResponse)({
        description: 'Dados inválidos (ex: amount inválido/negativo), tipo/operação não suportado, carteira inativa ou saldo insuficiente',
    }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_transaction_dto_1.CreateTransactionDto]),
    __metadata("design:returntype", void 0)
], TransactionsController.prototype, "create", null);
exports.TransactionsController = TransactionsController = __decorate([
    (0, swagger_1.ApiTags)('Transactions'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('transactions'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [transactions_service_1.TransactionsService])
], TransactionsController);
//# sourceMappingURL=transactions.controller.js.map