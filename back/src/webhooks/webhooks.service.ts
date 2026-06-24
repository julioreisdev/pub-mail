import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Ajuste o caminho
import { UpdateScheduleSentDto } from './dto/update-schedule-sent.dto';
import {
    UpdateLeadMetricsDto,
    LeadEmailEvent,
} from './dto/update-lead-metrics.dto';

@Injectable()
export class WebhooksService {
    private readonly logger = new Logger(WebhooksService.name);

    constructor(private prisma: PrismaService) { }

    async updateScheduleSent(sentId: string, dto: UpdateScheduleSentDto) {
        const sentRecord =
            await this.prisma.email_projects_schedules_sent.findUnique({
                where: { id: sentId },
                select: { id: true },
            });

        if (!sentRecord) {
            throw new NotFoundException(
                `Registro de envio (dispatchId: ${sentId}) não encontrado.`,
            );
        }

        // Atualiza o progresso no banco de dados
        return this.prisma.email_projects_schedules_sent.update({
            where: { id: sentId },
            data: {
                status: dto.status,
                sent_for_leads: dto.sent_for_leads,
                error_message: dto.error_message ?? null,
                // Se concluiu ou falhou de vez, podemos marcar o antigo campo booleano sent como true para não quebrar fluxos legados
                sent: dto.status === 'COMPLETED' || dto.status === 'PARTIAL',
            },
        });
    }

    async updateLeadMetrics(dto: UpdateLeadMetricsDto) {
        // 1. O Prisma usa essa sintaxe "project_id_lead_id" para buscar por chaves compostas (@@id)
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
            throw new NotFoundException(
                'Vínculo entre Lead e Projeto não encontrado.',
            );
        }

        // 2. Transforma o JSON do banco em um objeto manipulável (ou objeto vazio se for null)
        const currentMetrics = (link.metrics as Record<string, any>) || {};
        const eventTime = dto.timestamp || new Date().toISOString();

        // 3. Atualiza a propriedade específica baseada no evento recebido
        if (dto.event === LeadEmailEvent.OPEN) {
            currentMetrics.last_open = eventTime;
        } else if (dto.event === LeadEmailEvent.CLICK) {
            currentMetrics.last_interaction = eventTime;
        }

        // 4. Salva o JSON atualizado de volta no banco
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

    // =========================================================================
    // 🚀 SERVIÇO DE REGISTRO DE PIXEL DE ABERTURA
    // =========================================================================
    async registerOpenPixel(
        projectId: string,
        scheduleSentId: string,
        email: string,
    ) {
        try {
            // 1. Tenta criar o registro na tabela de aberturas únicas.
            // A restrição @@unique do Prisma barrará qualquer abertura duplicada do mesmo email no mesmo disparo.
            await this.prisma.email_schedules_sent_opens.create({
                data: {
                    schedule_sent_id: scheduleSentId,
                    email: email,
                },
            });

            // 2. Se passou da linha acima, é uma abertura nova e válida!
            // Incrementa o open_count no disparo principal
            await this.prisma.email_projects_schedules_sent.update({
                where: { id: scheduleSentId },
                data: { open_count: { increment: 1 } },
            });

            // 3. Atualiza o last_open na coluna de métricas do lead
            // Como precisamos do lead_id para usar a chave composta, buscamos o vínculo primeiro
            const link = await this.prisma.email_project_leads.findFirst({
                where: {
                    project_id: projectId,
                    leads: { email: email },
                },
                select: { lead_id: true, metrics: true },
            });

            if (link) {
                const currentMetrics = (link.metrics as Record<string, any>) || {};
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

            this.logger.log(
                `👁️ Pixel de Abertura: Lead ${email} abriu o envio ${scheduleSentId.slice(0, 8)}`,
            );
        } catch (error: any) {
            // P2002: Erro de chave única do Prisma.
            // Ignoramos silenciosamente pois significa que o lead apenas abriu o email novamente (idempotência).
            if (error.code === 'P2002') {
                this.logger.debug(
                    `Pixel ignorado: Lead ${email} já contabilizou abertura para o envio ${scheduleSentId.slice(0, 8)}.`,
                );
                return;
            }
            // Se for erro de conexão ou outro problema, repassa o erro pro catch do controller logar.
            throw error;
        }
    }

    // =========================================================================
    // 🖱️ NOVO: SERVIÇO DE REGISTRO DE CLIQUE NO CTA
    // =========================================================================
    async registerCtaClick(
        projectId: string,
        scheduleSentId: string,
        email: string,
    ) {
        try {
            // 1. Incrementa a nova coluna click_cta_count no disparo principal.
            // Como não criamos uma tabela de cliques únicos para o CTA (igual fizemos pro pixel),
            // todo clique somará no volume geral.
            await this.prisma.email_projects_schedules_sent.update({
                where: { id: scheduleSentId },
                data: { click_cta_count: { increment: 1 } },
            });

            // 2. Atualiza o last_click_cta na coluna de métricas do lead
            // Buscamos o vínculo para pegar o lead_id
            const link = await this.prisma.email_project_leads.findFirst({
                where: {
                    project_id: projectId,
                    leads: { email: email },
                },
                select: { lead_id: true, metrics: true },
            });

            if (link) {
                const currentMetrics = (link.metrics as Record<string, any>) || {};
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

            this.logger.log(
                `👆 Clique no CTA: Lead ${email} acessou o link do envio ${scheduleSentId.slice(0, 8)}`,
            );
        } catch (error: any) {
            this.logger.error(
                `Falha ao registrar clique do CTA para ${email}: ${error.message}`,
            );
            throw error;
        }
    }
}
