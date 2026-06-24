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
exports.WebchatsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const create_webchat_dto_1 = require("./dto/create-webchat.dto");
const update_webchat_ads_dto_1 = require("./dto/update-webchat-ads.dto");
const update_webchat_dto_1 = require("./dto/update-webchat.dto");
const webchat_service_1 = require("./webchat.service");
let WebchatsController = class WebchatsController {
    webchatsService;
    constructor(webchatsService) {
        this.webchatsService = webchatsService;
    }
    create(req, dto) {
        return this.webchatsService.create({
            organization_id: req.user.organizationId,
            ...dto,
        });
    }
    list(req) {
        return this.webchatsService.list(req.user.organizationId);
    }
    findOne(req, id) {
        return this.webchatsService.findOne(req.user.organizationId, id);
    }
    update(req, id, dto) {
        return this.webchatsService.update(req.user.organizationId, id, dto);
    }
    listAds(req, id) {
        return this.webchatsService.getAdsConfig(req.user.organizationId, id);
    }
    saveAds(req, id, dto) {
        return this.webchatsService.updateAdsConfig(req.user.organizationId, id, dto);
    }
    remove(req, id) {
        return this.webchatsService.remove(req.user.organizationId, id);
    }
};
exports.WebchatsController = WebchatsController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Criar webchat' }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'Webchat criado com sucesso' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_webchat_dto_1.CreateWebchatDto]),
    __metadata("design:returntype", void 0)
], WebchatsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Listar webchats da organização' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Lista de webchats retornada com sucesso' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], WebchatsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Buscar webchat por ID' }),
    (0, swagger_1.ApiParam)({ name: 'id', type: String, format: 'uuid' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WebchatsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Atualizar webchat' }),
    (0, swagger_1.ApiParam)({ name: 'id', type: String, format: 'uuid' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_webchat_dto_1.UpdateWebchatDto]),
    __metadata("design:returntype", void 0)
], WebchatsController.prototype, "update", null);
__decorate([
    (0, common_1.Get)(':id/ads'),
    (0, swagger_1.ApiOperation)({ summary: 'Listar anúncios configurados do webchat' }),
    (0, swagger_1.ApiParam)({ name: 'id', type: String, format: 'uuid' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WebchatsController.prototype, "listAds", null);
__decorate([
    (0, common_1.Patch)(':id/ads'),
    (0, swagger_1.ApiOperation)({ summary: 'Salvar anúncios do webchat' }),
    (0, swagger_1.ApiParam)({ name: 'id', type: String, format: 'uuid' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_webchat_ads_dto_1.UpdateWebchatAdsDto]),
    __metadata("design:returntype", void 0)
], WebchatsController.prototype, "saveAds", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Remover webchat' }),
    (0, swagger_1.ApiParam)({ name: 'id', type: String, format: 'uuid' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WebchatsController.prototype, "remove", null);
exports.WebchatsController = WebchatsController = __decorate([
    (0, swagger_1.ApiTags)('Webchats'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('webchats'),
    __metadata("design:paramtypes", [webchat_service_1.WebchatsService])
], WebchatsController);
//# sourceMappingURL=webchats.controller.js.map