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
exports.AgentesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const agentes_service_1 = require("./agentes.service");
const create_agente_dto_1 = require("./dto/create-agente.dto");
const update_agente_dto_1 = require("./dto/update-agente.dto");
let AgentesController = class AgentesController {
    agentesService;
    constructor(agentesService) {
        this.agentesService = agentesService;
    }
    create(req, dto) {
        return this.agentesService.create(req.user.organizationId, dto);
    }
    list(req) {
        return this.agentesService.list(req.user.organizationId);
    }
    findOne(req, id) {
        return this.agentesService.findOne(req.user.organizationId, id);
    }
    update(req, id, dto) {
        return this.agentesService.update(req.user.organizationId, id, dto);
    }
    remove(req, id) {
        return this.agentesService.remove(req.user.organizationId, id);
    }
};
exports.AgentesController = AgentesController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Criar agente de IA' }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'Agente criado com sucesso' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_agente_dto_1.CreateAgenteDto]),
    __metadata("design:returntype", void 0)
], AgentesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Listar agentes da organização' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Lista de agentes retornada com sucesso' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AgentesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Buscar agente por ID' }),
    (0, swagger_1.ApiParam)({ name: 'id', type: String, format: 'uuid' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AgentesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Atualizar agente' }),
    (0, swagger_1.ApiParam)({ name: 'id', type: String, format: 'uuid' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_agente_dto_1.UpdateAgenteDto]),
    __metadata("design:returntype", void 0)
], AgentesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Remover agente' }),
    (0, swagger_1.ApiParam)({ name: 'id', type: String, format: 'uuid' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AgentesController.prototype, "remove", null);
exports.AgentesController = AgentesController = __decorate([
    (0, swagger_1.ApiTags)('Agentes'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('agentes'),
    __metadata("design:paramtypes", [agentes_service_1.AgentesService])
], AgentesController);
//# sourceMappingURL=agentes.controller.js.map