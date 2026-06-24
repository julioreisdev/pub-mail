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
exports.OrganiztionsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const organiztions_service_1 = require("./organiztions.service");
const update_organiztion_dto_1 = require("./dto/update-organiztion.dto");
const swagger_1 = require("@nestjs/swagger");
let OrganiztionsController = class OrganiztionsController {
    organiztionsService;
    constructor(organiztionsService) {
        this.organiztionsService = organiztionsService;
    }
    me(req) {
        return this.organiztionsService.findMyOrganization(req.user.organizationId);
    }
    updateMe(req, dto) {
        return this.organiztionsService.updateMyOrganization(req.user.organizationId, dto);
    }
    removeMe(req) {
        return this.organiztionsService.disableMyOrganization(req.user.organizationId);
    }
};
exports.OrganiztionsController = OrganiztionsController;
__decorate([
    (0, common_1.Get)('me'),
    (0, swagger_1.ApiOperation)({ summary: 'Buscar minha organização (tenant) via token' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Organização retornada com sucesso' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Organização não encontrada' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OrganiztionsController.prototype, "me", null);
__decorate([
    (0, common_1.Patch)('me'),
    (0, swagger_1.ApiOperation)({ summary: 'Atualizar minha organização (tenant) via token' }),
    (0, swagger_1.ApiBody)({ type: update_organiztion_dto_1.UpdateOrganiztionDto }),
    (0, swagger_1.ApiOkResponse)({ description: 'Organização atualizada com sucesso' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Dados inválidos / violação de unicidade' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Organização não encontrada' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_organiztion_dto_1.UpdateOrganiztionDto]),
    __metadata("design:returntype", void 0)
], OrganiztionsController.prototype, "updateMe", null);
__decorate([
    (0, common_1.Delete)('me'),
    (0, swagger_1.ApiOperation)({ summary: 'Desativar minha organização (soft delete)' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Organização desativada com sucesso' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Organização não encontrada' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OrganiztionsController.prototype, "removeMe", null);
exports.OrganiztionsController = OrganiztionsController = __decorate([
    (0, swagger_1.ApiTags)('Organizations'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('organizations'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [organiztions_service_1.OrganiztionsService])
], OrganiztionsController);
//# sourceMappingURL=organiztions.controller.js.map