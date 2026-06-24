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
exports.PublicWebchatsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const public_decorator_1 = require("../auth/public.decorator");
const capture_webchat_lead_dto_1 = require("./dto/capture-webchat-lead.dto");
const send_webchat_message_dto_1 = require("./dto/send-webchat-message.dto");
const track_webchat_ad_events_dto_1 = require("./dto/track-webchat-ad-events.dto");
const webchat_service_1 = require("./webchat.service");
let PublicWebchatsController = class PublicWebchatsController {
    webchatsService;
    constructor(webchatsService) {
        this.webchatsService = webchatsService;
    }
    getConfig(slug, domainQuery, req) {
        const domainHint = this.resolveDomainHint(req, domainQuery);
        return this.webchatsService.getPublicConfig(slug, domainHint);
    }
    getSession(slug, sessionId, domainQuery, req) {
        const domainHint = this.resolveDomainHint(req, domainQuery);
        return this.webchatsService.getPublicSessionState(slug, domainHint, sessionId);
    }
    captureLead(slug, domainQuery, dto, req) {
        const domainHint = this.resolveDomainHint(req, domainQuery);
        return this.webchatsService.captureLead(slug, domainHint, dto);
    }
    sendMessage(slug, domainQuery, dto, req) {
        const domainHint = this.resolveDomainHint(req, domainQuery);
        return this.webchatsService.sendMessage(slug, domainHint, dto);
    }
    trackAdEvents(slug, domainQuery, dto, req) {
        const domainHint = this.resolveDomainHint(req, domainQuery);
        return this.webchatsService.trackPublicAdEvents(slug, domainHint, dto);
    }
    resolveDomainHint(req, domainQuery) {
        const headerDomain = req.headers?.['x-webchat-domain'];
        const host = req.headers?.host;
        const candidate = headerDomain || domainQuery || host || '';
        return String(candidate || '');
    }
};
exports.PublicWebchatsController = PublicWebchatsController;
__decorate([
    (0, common_1.Get)(':slug/config'),
    (0, swagger_1.ApiOperation)({ summary: 'Buscar configuração pública do webchat por slug' }),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Query)('domain')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], PublicWebchatsController.prototype, "getConfig", null);
__decorate([
    (0, common_1.Get)(':slug/session'),
    (0, swagger_1.ApiOperation)({ summary: 'Resgatar sessão pública do webchat por session_id' }),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Query)('session_id')),
    __param(2, (0, common_1.Query)('domain')),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", void 0)
], PublicWebchatsController.prototype, "getSession", null);
__decorate([
    (0, common_1.Post)(':slug/leads'),
    (0, swagger_1.ApiOperation)({
        summary: 'Capturar lead público do webchat com deduplicação manual e roteamento',
    }),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Query)('domain')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, capture_webchat_lead_dto_1.CaptureWebchatLeadDto, Object]),
    __metadata("design:returntype", void 0)
], PublicWebchatsController.prototype, "captureLead", null);
__decorate([
    (0, common_1.Post)(':slug/messages'),
    (0, swagger_1.ApiOperation)({
        summary: 'Enviar mensagem para IA do webchat (cobrança de tokens por requisição)',
    }),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Query)('domain')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, send_webchat_message_dto_1.SendWebchatMessageDto, Object]),
    __metadata("design:returntype", void 0)
], PublicWebchatsController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Post)(':slug/ad-events'),
    (0, swagger_1.ApiOperation)({
        summary: 'Registrar eventos de anúncios do webchat público',
    }),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Query)('domain')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, track_webchat_ad_events_dto_1.TrackWebchatAdEventsDto, Object]),
    __metadata("design:returntype", void 0)
], PublicWebchatsController.prototype, "trackAdEvents", null);
exports.PublicWebchatsController = PublicWebchatsController = __decorate([
    (0, swagger_1.ApiTags)('Public Webchat'),
    (0, public_decorator_1.Public)(),
    (0, common_1.Controller)('public/webchat'),
    __metadata("design:paramtypes", [webchat_service_1.WebchatsService])
], PublicWebchatsController);
//# sourceMappingURL=public-webchats.controller.js.map