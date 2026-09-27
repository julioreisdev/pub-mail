import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Ajuste o caminho
import { UpdateScheduleSentDto } from './dto/update-schedule-sent.dto';
import {
    UpdateLeadMetricsDto,
    LeadEmailEvent,
} from './dto/update-lead-metrics.dto';
import { TriggersService } from '../email-marketing/triggers/triggers.service';
import {
    redirectAllowedByHtml,
    safeRedirectUrl,
    trackingSignatureCutoff,
    verifyTracking,
} from '../common/tracking-sign.util';

const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED', 'PARTIAL']);

type TrackingCheck =
    | { ok: true; sent: { id: string; body_html: string | null } }
    | { ok: false; reason: string };

type CtaCheck =
    | { ok: true; target: string }
    | { ok: false; status: number; reason: string; message: string };

@Injectable()
export class WebhooksService {
    private readonly logger = new Logger(WebhooksService.name);

    constructor(
        private prisma: PrismaService,
        private readonly triggers: TriggersService,
    ) { }

    async updateScheduleSent(sentId: string, dto: UpdateScheduleSentDto) {
        const sentRecord =
            await this.prisma.email_projects_schedules_sent.findUnique({
                where: { id: sentId },
                select: {
                    id: true,
                    organization_id: true,
                    tokens_cost: true,
                    status: true,
                    sent_for_leads: true,
                },
            });

        if (!sentRecord) {
            throw new NotFoundException(
                `Registro de envio (dispatchId: ${sentId}) não encontrado.`,
            );
        }

        // Nunca REGRIDE o status (A-60): um PROCESSING atrasado (callback de
        // lote chegando depois do COMPLETED) não pode sobrescrever o terminal.
        if (
            dto.status === 'PROCESSING' &&
            TERMINAL_STATUSES.has(String(sentRecord.status))
        ) {
            this.logger.debug(
                `Callback PROCESSING ignorado: ${sentId.slice(0, 8)} já está ${sentRecord.status}.`,
            );
            return sentRecord;
        }

        // Observação: invalid_count/failed_count vêm no DTO mas a tabela não tem
        // essas colunas — por ora ficam só no log/diagnóstico do micro.
        const errorMessage =
            dto.error_message != null
                ? String(dto.error_message).slice(0, 255)
                : null;

        // Atualiza o progresso no banco de dados
        const updated =
            await this.prisma.email_projects_schedules_sent.update({
                where: { id: sentId },
                data: {
                    status: dto.status,
                    // contador nunca diminui (checkpoint/retomada do micro)
                    sent_for_leads: Math.max(
                        Number(sentRecord.sent_for_leads) || 0,
                        Number(dto.sent_for_leads) || 0,
                    ),
                    error_message: errorMessage,
                    // Se concluiu ou falhou de vez, podemos marcar o antigo campo booleano sent como true para não quebrar fluxos legados
                    sent: dto.status === 'COMPLETED' || dto.status === 'PARTIAL',
                },
            });

        // Estorno: se o disparo TERMINOU sem enviar NENHUM e-mail (ex.: todos os
        // endereços inválidos / rejeitados pela Resend), devolve os tokens que
        // foram cobrados adiantado. Idempotente (não estorna 2x o mesmo disparo).
        const terminal =
            dto.status === 'COMPLETED' || dto.status === 'FAILED';
        if (
            terminal &&
            (dto.sent_for_leads ?? 0) === 0 &&
            Number(sentRecord.tokens_cost) > 0
        ) {
            await this.refundDispatchTokens(
                sentId,
                sentRecord.organization_id,
                Number(sentRecord.tokens_cost),
            );
        }

        return updated;
    }

    // Devolve os tokens de um disparo que não enviou nada. Idempotente: usa uma
    // descrição determinística por disparo pra não creditar duas vezes.
    private async refundDispatchTokens(
        sentId: string,
        organizationId: string,
        amount: number,
    ) {
        const desc = `ESTORNO DISPARO (0 enviados) | Sent: ${sentId.slice(0, 8)}`;
        const wallet = await this.prisma.wallets.findFirst({
            where: { organization_id: organizationId, status: 'ACTIVE' },
            select: { id: true },
        });
        if (!wallet) return;

        const already = await this.prisma.transactions.findFirst({
            where: {
                wallet_id: wallet.id,
                type: 'TOKEN_REFUND',
                description: desc,
            },
            select: { id: true },
        });
        if (already) return;

        await this.prisma.$transaction([
            this.prisma.wallets.update({
                where: { id: wallet.id },
                data: { balance: { increment: amount } },
            }),
            this.prisma.transactions.create({
                data: {
                    wallet_id: wallet.id,
                    amount,
                    description: desc,
                    type: 'TOKEN_REFUND',
                },
            }),
            // zera o custo cobrado no registro (reflete o estorno)
            this.prisma.email_projects_schedules_sent.update({
                where: { id: sentId },
                data: { tokens_cost: 0 },
            }),
        ]);
        this.logger.log(
            `Estornado ${amount} tokens do disparo ${sentId} (0 enviados).`,
        );
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
    // 🔐 VALIDAÇÃO DAS URLs DE RASTREIO (A-10 / A-11)
    // - o sent row PRECISA pertencer ao projectId da URL;
    // - `s` = HMAC(sentId|email) válido; OU, sem `s`, o envio precisa ser
    //   anterior ao TRACKING_SIGNATURE_CUTOFF (links legados já enviados).
    // =========================================================================
    async validateTracking(
        projectId: string,
        scheduleSentId: string,
        email: string,
        sig: string | undefined | null,
    ): Promise<TrackingCheck> {
        const sent = await this.prisma.email_projects_schedules_sent.findFirst({
            where: { id: scheduleSentId, project_id: projectId },
            select: { id: true, created_at: true, body_html: true },
        });
        if (!sent) return { ok: false, reason: 'sent_not_in_project' };

        const given = String(sig ?? '').trim();
        if (given) {
            if (!verifyTracking(scheduleSentId, email, given)) {
                return { ok: false, reason: 'bad_signature' };
            }
            return { ok: true, sent: { id: sent.id, body_html: sent.body_html } };
        }

        // Legado (sem assinatura): só envios anteriores ao cutoff.
        const created = new Date(sent.created_at as any);
        if (created.getTime() < trackingSignatureCutoff().getTime()) {
            return { ok: true, sent: { id: sent.id, body_html: sent.body_html } };
        }
        return { ok: false, reason: 'signature_required' };
    }

    // Clique: além do acima, o destino precisa ser http/https e constar nos CTAs
    // do HTML enviado (a assinatura cobre sentId|email; o redirect é validado
    // contra o body_html do disparo — anti open redirect).
    async validateCtaClick(
        projectId: string,
        scheduleSentId: string,
        email: string,
        sig: string | undefined | null,
        redirectUrl: string | undefined | null,
    ): Promise<CtaCheck> {
        const target = safeRedirectUrl(redirectUrl);
        if (!target) {
            return {
                ok: false,
                status: 400,
                reason: 'bad_redirect',
                message: 'redirectUrl ausente ou inválida (só http/https).',
            };
        }

        const base = await this.validateTracking(projectId, scheduleSentId, email, sig);
        if (!base.ok) {
            const notFound = base.reason === 'sent_not_in_project';
            return {
                ok: false,
                status: notFound ? 404 : 403,
                reason: base.reason,
                message: notFound ? 'Envio não encontrado.' : 'Link de rastreio inválido ou expirado.',
            };
        }

        // Destino precisa constar no HTML do disparo. Sem HTML salvo (envio
        // antigo/falho) só o legado passa — nunca um link assinado sem base.
        const html = base.sent.body_html;
        const hasHtml = !!String(html ?? '').trim();
        if (hasHtml) {
            if (!redirectAllowedByHtml(target, html)) {
                return {
                    ok: false,
                    status: 403,
                    reason: 'redirect_not_in_email',
                    message: 'Destino não pertence a este e-mail.',
                };
            }
        } else if (String(sig ?? '').trim()) {
            return {
                ok: false,
                status: 403,
                reason: 'no_html_to_validate',
                message: 'Destino não pôde ser validado.',
            };
        }

        return { ok: true, target };
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
            // Incrementa o open_count no disparo principal (e descobre se é do fluxo)
            const sentRow = await this.prisma.email_projects_schedules_sent.update({
                where: { id: scheduleSentId },
                data: { open_count: { increment: 1 } },
                select: { flow_step_id: true },
            });
            const isFlow = Boolean(sentRow?.flow_step_id);

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
                // interagiu no fluxo inicial (abriu um e-mail de um passo do fluxo)
                if (isFlow) currentMetrics.flow_interacted = true;

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

            // Gatilhos por comportamento (best-effort, nunca quebra o pixel)
            void this.triggers.fire(projectId, email, 'OPEN');

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
            // 1. Registra o clique ÚNICO por (disparo, lead). Se for a 1ª vez,
            // conta em click_unique_count (espelho do pixel de abertura).
            let isUniqueClick = false;
            try {
                await this.prisma.email_schedules_sent_clicks.create({
                    data: { schedule_sent_id: scheduleSentId, email: email },
                });
                isUniqueClick = true;
            } catch (e: any) {
                if (e?.code !== 'P2002') {
                    this.logger.warn(`Falha ao registrar clique único de ${email}: ${e?.message}`);
                }
            }

            // click_cta_count = TOTAL de cliques; click_unique_count = únicos.
            const sentRow = await this.prisma.email_projects_schedules_sent.update({
                where: { id: scheduleSentId },
                data: {
                    click_cta_count: { increment: 1 },
                    ...(isUniqueClick ? { click_unique_count: { increment: 1 } } : {}),
                },
                select: { flow_step_id: true },
            });
            const isFlow = Boolean(sentRow?.flow_step_id);

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
                // interagiu no fluxo inicial (clicou num e-mail de um passo do fluxo)
                if (isFlow) currentMetrics.flow_interacted = true;

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

            // Gatilhos por comportamento (best-effort, nunca quebra o clique)
            void this.triggers.fire(projectId, email, 'CLICK');

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
