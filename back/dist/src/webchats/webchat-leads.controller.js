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
exports.WebchatLeadsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const webchat_leads_service_1 = require("./webchat-leads.service");
let WebchatLeadsController = class WebchatLeadsController {
    service;
    constructor(service) {
        this.service = service;
    }
    async list(req, webchatId, page, pageSize, q) {
        return this.service.list({
            organizationId: req.user.organizationId,
            webchatId: webchatId || undefined,
            page: page ? Number(page) : undefined,
            pageSize: pageSize ? Number(pageSize) : undefined,
            search: q || undefined,
        });
    }
    async exportAll(req, webchatId, q) {
        return this.service.listAllForExport({
            organizationId: req.user.organizationId,
            webchatId: webchatId || undefined,
            search: q || undefined,
        });
    }
};
exports.WebchatLeadsController = WebchatLeadsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Listar leads dos webchats da organização (paginado)' }),
    (0, swagger_1.ApiQuery)({ name: 'webchat_id', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'page_size', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'q', required: false, description: 'Busca por nome/e-mail/telefone' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Lista paginada de leads' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('webchat_id')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('page_size')),
    __param(4, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], WebchatLeadsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('export'),
    (0, swagger_1.ApiOperation)({ summary: 'Exportar leads (até 50k registros) — uso para gerar Excel no front' }),
    (0, swagger_1.ApiQuery)({ name: 'webchat_id', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'q', required: false }),
    (0, swagger_1.ApiOkResponse)({ description: 'Lista completa (sem paginação)' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('webchat_id')),
    __param(2, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], WebchatLeadsController.prototype, "exportAll", null);
exports.WebchatLeadsController = WebchatLeadsController = __decorate([
    (0, swagger_1.ApiTags)('Webchat Leads'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('webchat-leads'),
    __metadata("design:paramtypes", [webchat_leads_service_1.WebchatLeadsService])
], WebchatLeadsController);
//# sourceMappingURL=webchat-leads.controller.js.map