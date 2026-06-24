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
exports.UsersController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const users_service_1 = require("./users.service");
const update_user_dto_1 = require("./dto/update-user.dto");
const swagger_1 = require("@nestjs/swagger");
let UsersController = class UsersController {
    usersService;
    constructor(usersService) {
        this.usersService = usersService;
    }
    findAll(req) {
        return this.usersService.findAllByOrganization(req.user.organizationId);
    }
    me(req) {
        return this.usersService.findMe(req.user.userId, req.user.organizationId);
    }
    findOne(req, id) {
        return this.usersService.findOneInOrganization(req.user.organizationId, id);
    }
    update(req, id, dto) {
        return this.usersService.updateInOrganization(req.user.organizationId, id, dto);
    }
    remove(req, id) {
        return this.usersService.removeInOrganization(req.user.organizationId, id);
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Listar usuários da organização do usuário logado' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Lista de usuários retornada com sucesso' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, swagger_1.ApiOperation)({ summary: 'Obter meu perfil (usuário logado) dentro da organização' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Dados do usuário logado retornados com sucesso' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Usuário não encontrado' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "me", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Buscar um usuário por ID (somente dentro da mesma organização)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID do usuário', type: String, format: 'uuid' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Usuário encontrado com sucesso' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Usuário não encontrado' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Atualizar um usuário por ID (somente dentro da mesma organização)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID do usuário', type: String, format: 'uuid' }),
    (0, swagger_1.ApiBody)({ type: update_user_dto_1.UpdateUserDto }),
    (0, swagger_1.ApiOkResponse)({ description: 'Usuário atualizado com sucesso' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Dados inválidos' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Usuário não encontrado' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_user_dto_1.UpdateUserDto]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Desativar (soft delete) um usuário por ID (somente dentro da mesma organização)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID do usuário', type: String, format: 'uuid' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Usuário desativado com sucesso' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Usuário não encontrado' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "remove", null);
exports.UsersController = UsersController = __decorate([
    (0, swagger_1.ApiTags)('Users'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('users'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [users_service_1.UsersService])
], UsersController);
//# sourceMappingURL=users.controller.js.map