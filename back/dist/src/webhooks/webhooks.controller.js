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
var WebhooksController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhooksController = void 0;
const common_1 = require("@nestjs/common");
const webhooks_service_1 = require("./webhooks.service");
const update_schedule_sent_dto_1 = require("./dto/update-schedule-sent.dto");
const api_key_guard_1 = require("../auth/api-key.guard");
const update_lead_metrics_dto_1 = require("./dto/update-lead-metrics.dto");
let WebhooksController = WebhooksController_1 = class WebhooksController {
    webhooksService;
    logger = new common_1.Logger(WebhooksController_1.name);
    constructor(webhooksService) {
        this.webhooksService = webhooksService;
    }
    async trackOpenPixel(projectId, scheduleSentId, email, res) {
        const pixel = Buffer.from('R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');
        this.webhooksService
            .registerOpenPixel(projectId, scheduleSentId, email)
            .catch((err) => {
            this.logger.error(`Erro no background do pixel para ${email}: ${err.message}`);
        });
        res.set({
            'Content-Type': 'image/gif',
            'Content-Length': pixel.length.toString(),
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
        });
        res.send(pixel);
    }
    async trackCtaClick(projectId, scheduleSentId, email, redirectUrl, res) {
        const targetUrl = redirectUrl ? redirectUrl : '';
        this.webhooksService
            .registerCtaClick(projectId, scheduleSentId, email)
            .catch((err) => {
            this.logger.error(`Erro no background do click CTA para ${email}: ${err.message}`);
        });
        return res.redirect(302, targetUrl);
    }
    async updateScheduleSent(sentId, dto) {
        await this.webhooksService.updateScheduleSent(sentId, dto);
        return { success: true, message: 'Status de envio atualizado.' };
    }
    async updateLeadMetrics(dto) {
        await this.webhooksService.updateLeadMetrics(dto);
        return { success: true, message: 'Métricas do lead atualizadas.' };
    }
};
exports.WebhooksController = WebhooksController;
__decorate([
    (0, common_1.Get)('schedule-sent/open-pixel/:projectId/:scheduleSentId/:email'),
    __param(0, (0, common_1.Param)('projectId', new common_1.ParseUUIDPipe())),
    __param(1, (0, common_1.Param)('scheduleSentId', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Param)('email')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], WebhooksController.prototype, "trackOpenPixel", null);
__decorate([
    (0, common_1.Get)('cta-click/:projectId/:scheduleSentId/:email'),
    __param(0, (0, common_1.Param)('projectId', new common_1.ParseUUIDPipe())),
    __param(1, (0, common_1.Param)('scheduleSentId', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Param)('email')),
    __param(3, (0, common_1.Query)('redirectUrl')),
    __param(4, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, Object]),
    __metadata("design:returntype", Promise)
], WebhooksController.prototype, "trackCtaClick", null);
__decorate([
    (0, common_1.Post)('schedule-sent/:sentId'),
    (0, common_1.UseGuards)(api_key_guard_1.ApiKeyGuard),
    __param(0, (0, common_1.Param)('sentId', new common_1.ParseUUIDPipe())),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_schedule_sent_dto_1.UpdateScheduleSentDto]),
    __metadata("design:returntype", Promise)
], WebhooksController.prototype, "updateScheduleSent", null);
__decorate([
    (0, common_1.Post)('lead-metrics'),
    (0, common_1.UseGuards)(api_key_guard_1.ApiKeyGuard),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_lead_metrics_dto_1.UpdateLeadMetricsDto]),
    __metadata("design:returntype", Promise)
], WebhooksController.prototype, "updateLeadMetrics", null);
exports.WebhooksController = WebhooksController = WebhooksController_1 = __decorate([
    (0, common_1.Controller)('webhooks/email'),
    __metadata("design:paramtypes", [webhooks_service_1.WebhooksService])
], WebhooksController);
//# sourceMappingURL=webhooks.controller.js.map