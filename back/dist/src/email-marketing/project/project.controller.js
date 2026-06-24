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
exports.EmailProjectsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../../auth/jwt-auth.guard");
const project_service_1 = require("./project.service");
const create_email_project_dto_1 = require("./dto/create-email-project.dto");
const update_email_project_dto_1 = require("./dto/update-email-project.dto");
const swagger_1 = require("@nestjs/swagger");
let EmailProjectsController = class EmailProjectsController {
    service;
    constructor(service) {
        this.service = service;
    }
    create(req, dto) {
        return this.service.create(req.user.organizationId, dto);
    }
    list(req) {
        return this.service.findAll(req.user.organizationId);
    }
    get(req, id) {
        return this.service.findOne(req.user.organizationId, id);
    }
    update(req, id, dto) {
        return this.service.update(req.user.organizationId, id, dto);
    }
    remove(req, id) {
        return this.service.remove(req.user.organizationId, id);
    }
};
exports.EmailProjectsController = EmailProjectsController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Criar projeto de e-mail (lista/estratégia)' }),
    (0, swagger_1.ApiBody)({ type: create_email_project_dto_1.CreateEmailProjectDto }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'Projeto criado com sucesso' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Dados inválidos' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_email_project_dto_1.CreateEmailProjectDto]),
    __metadata("design:returntype", void 0)
], EmailProjectsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Listar projetos ativos da organização' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Lista de projetos' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EmailProjectsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Buscar projeto ativo por ID' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID do projeto', type: String, format: 'uuid' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Projeto encontrado' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Projeto não encontrado' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], EmailProjectsController.prototype, "get", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Atualizar projeto (nome/settings/active)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID do projeto', type: String, format: 'uuid' }),
    (0, swagger_1.ApiBody)({ type: update_email_project_dto_1.UpdateEmailProjectDto }),
    (0, swagger_1.ApiOkResponse)({ description: 'Projeto atualizado com sucesso' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Projeto não encontrado' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Dados inválidos' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_email_project_dto_1.UpdateEmailProjectDto]),
    __metadata("design:returntype", void 0)
], EmailProjectsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Desativar projeto (soft delete)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID do projeto', type: String, format: 'uuid' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Projeto desativado com sucesso' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Projeto não encontrado' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], EmailProjectsController.prototype, "remove", null);
exports.EmailProjectsController = EmailProjectsController = __decorate([
    (0, swagger_1.ApiTags)('Email Marketing - Projects'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('email/projects'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [project_service_1.EmailProjectsService])
], EmailProjectsController);
//# sourceMappingURL=project.controller.js.map