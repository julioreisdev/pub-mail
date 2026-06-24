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
var WebhooksService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhooksService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const update_lead_metrics_dto_1 = require("./dto/update-lead-metrics.dto");
let WebhooksService = WebhooksService_1 = class WebhooksService {
    prisma;
    logger = new common_1.Logger(WebhooksService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async updateScheduleSent(sentId, dto) {
        const sentRecord = await this.prisma.email_projects_schedules_sent.findUnique({
            where: { id: sentId },
            select: { id: true },
        });
        if (!sentRecord) {
            throw new common_1.NotFoundException(`Registro de envio (dispatchId: ${sentId}) não encontrado.`);
        }
        return this.prisma.email_projects_schedules_sent.update({
            where: { id: sentId },
            data: {
                status: dto.status,
                sent_for_leads: dto.sent_for_leads,
                error_message: dto.error_message ?? null,
                sent: dto.status === 'COMPLETED' || dto.status === 'PARTIAL',
            },
        });
    }
    async updateLeadMetrics(dto) {
        const link = await this.prisma.email_project_leads.findUnique({
            where: {
                project_id_lead_id: {
                    project_id: dto.projectId,
                    lead_id: dto.leadId,
                },
            },
            select: { metrics: true },
        });
        if (!link) {
            throw new common_1.NotFoundException('Vínculo entre Lead e Projeto não encontrado.');
        }
        const currentMetrics = link.metrics || {};
        const eventTime = dto.timestamp || new Date().toISOString();
        if (dto.event === update_lead_metrics_dto_1.LeadEmailEvent.OPEN) {
            currentMetrics.last_open = eventTime;
        }
        else if (dto.event === update_lead_metrics_dto_1.LeadEmailEvent.CLICK) {
            currentMetrics.last_interaction = eventTime;
        }
        return this.prisma.email_project_leads.update({
            where: {
                project_id_lead_id: {
                    project_id: dto.projectId,
                    lead_id: dto.leadId,
                },
            },
            data: {
                metrics: currentMetrics,
            },
        });
    }
    async registerOpenPixel(projectId, scheduleSentId, email) {
        try {
            await this.prisma.email_schedules_sent_opens.create({
                data: {
                    schedule_sent_id: scheduleSentId,
                    email: email,
                },
            });
            await this.prisma.email_projects_schedules_sent.update({
                where: { id: scheduleSentId },
                data: { open_count: { increment: 1 } },
            });
            const link = await this.prisma.email_project_leads.findFirst({
                where: {
                    project_id: projectId,
                    leads: { email: email },
                },
                select: { lead_id: true, metrics: true },
            });
            if (link) {
                const currentMetrics = link.metrics || {};
                const eventTime = new Date().toISOString();
                currentMetrics.last_open = eventTime;
                await this.prisma.email_project_leads.update({
                    where: {
                        project_id_lead_id: {
                            project_id: projectId,
                            lead_id: link.lead_id,
                        },
                    },
                    data: {
                        metrics: currentMetrics,
                    },
                });
            }
            this.logger.log(`👁️ Pixel de Abertura: Lead ${email} abriu o envio ${scheduleSentId.slice(0, 8)}`);
        }
        catch (error) {
            if (error.code === 'P2002') {
                this.logger.debug(`Pixel ignorado: Lead ${email} já contabilizou abertura para o envio ${scheduleSentId.slice(0, 8)}.`);
                return;
            }
            throw error;
        }
    }
    async registerCtaClick(projectId, scheduleSentId, email) {
        try {
            await this.prisma.email_projects_schedules_sent.update({
                where: { id: scheduleSentId },
                data: { click_cta_count: { increment: 1 } },
            });
            const link = await this.prisma.email_project_leads.findFirst({
                where: {
                    project_id: projectId,
                    leads: { email: email },
                },
                select: { lead_id: true, metrics: true },
            });
            if (link) {
                const currentMetrics = link.metrics || {};
                const eventTime = new Date().toISOString();
                currentMetrics.last_click_cta = eventTime;
                await this.prisma.email_project_leads.update({
                    where: {
                        project_id_lead_id: {
                            project_id: projectId,
                            lead_id: link.lead_id,
                        },
                    },
                    data: {
                        metrics: currentMetrics,
                    },
                });
            }
            this.logger.log(`👆 Clique no CTA: Lead ${email} acessou o link do envio ${scheduleSentId.slice(0, 8)}`);
        }
        catch (error) {
            this.logger.error(`Falha ao registrar clique do CTA para ${email}: ${error.message}`);
            throw error;
        }
    }
};
exports.WebhooksService = WebhooksService;
exports.WebhooksService = WebhooksService = WebhooksService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WebhooksService);
//# sourceMappingURL=webhooks.service.js.map