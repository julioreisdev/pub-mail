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
exports.DomainsController = void 0;
const common_1 = require("@nestjs/common");
const domains_service_1 = require("./domains.service");
const create_domain_dto_1 = require("./dto/create-domain.dto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const swagger_1 = require("@nestjs/swagger");
let DomainsController = class DomainsController {
    domainsService;
    constructor(domainsService) {
        this.domainsService = domainsService;
    }
    create(req, createDomainDto) {
        return this.domainsService.create(req.user.organizationId, createDomainDto);
    }
    list(req) {
        return this.domainsService.list(req.user.organizationId);
    }
    remove(req, id) {
        return this.domainsService.remove(req.user.organizationId, id);
    }
    verifyReal(req, id) {
        return this.domainsService.verifyReal(req.user.organizationId, id);
    }
};
exports.DomainsController = DomainsController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Cadastrar um novo domínio' }),
    (0, swagger_1.ApiCreatedResponse)({
        description: 'Domínio criado com sucesso (Status: PENDING)',
    }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_domain_dto_1.CreateDomainDto]),
    __metadata("design:returntype", void 0)
], DomainsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Listar todos os domínios da organização' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Retorna a lista de domínios cadastrados' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DomainsController.prototype, "list", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Remover um domínio' }),
    (0, swagger_1.ApiParam)({
        name: 'id',
        description: 'ID do domínio',
        type: String,
        format: 'uuid',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'Domínio removido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], DomainsController.prototype, "remove", null);
__decorate([
    (0, common_1.Patch)(':id/verify'),
    (0, swagger_1.ApiOperation)({ summary: 'Verificar status do DNS oficial no provedor' }),
    (0, swagger_1.ApiParam)({
        name: 'id',
        description: 'ID do domínio no SEU banco',
        type: String,
        format: 'uuid',
    }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], DomainsController.prototype, "verifyReal", null);
exports.DomainsController = DomainsController = __decorate([
    (0, swagger_1.ApiTags)('Organization - Domains'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('domains'),
    __metadata("design:paramtypes", [domains_service_1.DomainsService])
], DomainsController);
//# sourceMappingURL=domains.controller.js.map