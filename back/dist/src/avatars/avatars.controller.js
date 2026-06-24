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
exports.AvatarsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const avatars_service_1 = require("./avatars.service");
const create_avatar_dto_1 = require("./dto/create-avatar.dto");
const update_avatar_dto_1 = require("./dto/update-avatar.dto");
let AvatarsController = class AvatarsController {
    avatarsService;
    constructor(avatarsService) {
        this.avatarsService = avatarsService;
    }
    create(req, createAvatarDto) {
        return this.avatarsService.create(req.user.organizationId, createAvatarDto);
    }
    findAll(req) {
        return this.avatarsService.findAll(req.user.organizationId);
    }
    findOne(req, id) {
        return this.avatarsService.findOne(req.user.organizationId, id);
    }
    update(req, id, updateAvatarDto) {
        return this.avatarsService.update(req.user.organizationId, id, updateAvatarDto);
    }
    remove(req, id) {
        return this.avatarsService.remove(req.user.organizationId, id);
    }
};
exports.AvatarsController = AvatarsController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Salvar um novo avatar definitivo' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_avatar_dto_1.CreateAvatarDto]),
    __metadata("design:returntype", void 0)
], AvatarsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Listar todos os avatares da organização' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AvatarsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Buscar detalhes de um avatar específico' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AvatarsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Atualizar dados de um avatar' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_avatar_dto_1.UpdateAvatarDto]),
    __metadata("design:returntype", void 0)
], AvatarsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Deletar um avatar' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AvatarsController.prototype, "remove", null);
exports.AvatarsController = AvatarsController = __decorate([
    (0, swagger_1.ApiTags)('Avatars'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('avatars'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [avatars_service_1.AvatarsService])
], AvatarsController);
//# sourceMappingURL=avatars.controller.js.map