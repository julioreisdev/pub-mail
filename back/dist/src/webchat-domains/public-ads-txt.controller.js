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
exports.PublicAdsTxtController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const public_decorator_1 = require("../auth/public.decorator");
const webchat_domains_service_1 = require("./webchat-domains.service");
let PublicAdsTxtController = class PublicAdsTxtController {
    service;
    constructor(service) {
        this.service = service;
    }
    async serveAdsTxt(req, res, hostHeader) {
        const host = String(req.hostname || hostHeader || '');
        const content = await this.service.getAdsTxtByHost(host);
        if (content === null) {
            res
                .status(404)
                .type('text/plain; charset=utf-8')
                .set('Cache-Control', 'public, max-age=60')
                .send('# domain not registered\n');
            return;
        }
        res
            .status(200)
            .type('text/plain; charset=utf-8')
            .set('Cache-Control', 'public, max-age=300')
            .send(content);
    }
};
exports.PublicAdsTxtController = PublicAdsTxtController;
__decorate([
    (0, common_1.Get)('ads.txt'),
    (0, swagger_1.ApiOperation)({
        summary: 'Serve o ads.txt do domínio (resolvido pelo Host header). Rota pública.',
    }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Headers)('host')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], PublicAdsTxtController.prototype, "serveAdsTxt", null);
exports.PublicAdsTxtController = PublicAdsTxtController = __decorate([
    (0, swagger_1.ApiTags)('Public ads.txt'),
    (0, public_decorator_1.Public)(),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [webchat_domains_service_1.WebchatDomainsService])
], PublicAdsTxtController);
//# sourceMappingURL=public-ads-txt.controller.js.map