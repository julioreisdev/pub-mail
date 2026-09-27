import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    Query,
    UseGuards,
    ParseUUIDPipe,
    Res,
    Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { WebhooksService } from './webhooks.service';
import { UpdateScheduleSentDto } from './dto/update-schedule-sent.dto';
import { ApiKeyGuard } from '../auth/api-key.guard'; // Ajuste o caminho se necessário
import { UpdateLeadMetricsDto } from './dto/update-lead-metrics.dto';

// GIF 1x1 transparente
const PIXEL = Buffer.from(
    'R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
    'base64',
);

// Pixel/clique/callback do micro: sem rate limit (A-13) — tráfego legítimo em rajada.
@SkipThrottle()
@Controller('webhooks/email')
export class WebhooksController {
    private readonly logger = new Logger(WebhooksController.name);

    constructor(private readonly webhooksService: WebhooksService) { }

    // =========================================================================
    // 🚀 ROTA DO PIXEL DE ABERTURA (Invisível)
    // ?s=<assinatura> (HMAC sentId|email). Sem `s` só vale para envios
    // anteriores ao TRACKING_SIGNATURE_CUTOFF (links legados).
    // =========================================================================
    @Get('schedule-sent/open-pixel/:projectId/:scheduleSentId/:email')
    async trackOpenPixel(
        @Param('projectId', new ParseUUIDPipe()) projectId: string,
        @Param('scheduleSentId', new ParseUUIDPipe()) scheduleSentId: string,
        @Param('email') email: string,
        @Query('s') sig: string | undefined,
        @Res() res: Response,
    ) {
        // 1. Valida (pertence ao projeto + assinatura/legado). Inválido => 204 sem registrar.
        const check = await this.webhooksService.validateTracking(
            projectId,
            scheduleSentId,
            email,
            sig,
        );
        if (!check.ok) {
            this.logger.debug(
                `Pixel rejeitado (${check.reason}) sent=${scheduleSentId.slice(0, 8)} email=${email}`,
            );
            return res.status(204).end();
        }

        // 2. Dispara a atualização do banco em BACKGROUND (sem usar await de propósito)
        // Isso permite que a imagem carregue instantaneamente para o cliente
        this.webhooksService
            .registerOpenPixel(projectId, scheduleSentId, email)
            .catch((err) => {
                this.logger.error(
                    `Erro no background do pixel para ${email}: ${err.message}`,
                );
            });

        // 3. Força o provedor de e-mail a não usar cache da imagem (garante rastreio real)
        res.set({
            'Content-Type': 'image/gif',
            'Content-Length': PIXEL.length.toString(),
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
        });

        // 4. Retorna os bytes do GIF instantaneamente
        res.send(PIXEL);
    }

    // =========================================================================
    // 🖱️ RASTREAMENTO DE CLIQUE NO CTA (Redirect 302)
    // Rota ASSINADA: /cta-click/:projectId/:sentId/:email/:s?redirectUrl=...
    // (a assinatura vai no path porque o template concatena `?redirectUrl=`
    // depois de {{base_webhook_cta_click}}).
    // =========================================================================
    @Get('cta-click/:projectId/:scheduleSentId/:email/:s')
    async trackCtaClickSigned(
        @Param('projectId', new ParseUUIDPipe()) projectId: string,
        @Param('scheduleSentId', new ParseUUIDPipe()) scheduleSentId: string,
        @Param('email') email: string,
        @Param('s') sig: string,
        @Query('redirectUrl') redirectUrl: string,
        @Res() res: Response,
    ) {
        return this.handleCtaClick(projectId, scheduleSentId, email, sig, redirectUrl, res);
    }

    // Rota LEGADA (sem assinatura): só aceita envios anteriores ao cutoff.
    @Get('cta-click/:projectId/:scheduleSentId/:email')
    async trackCtaClick(
        @Param('projectId', new ParseUUIDPipe()) projectId: string,
        @Param('scheduleSentId', new ParseUUIDPipe()) scheduleSentId: string,
        @Param('email') email: string,
        @Query('redirectUrl') redirectUrl: string,
        @Res() res: Response,
    ) {
        return this.handleCtaClick(projectId, scheduleSentId, email, undefined, redirectUrl, res);
    }

    private async handleCtaClick(
        projectId: string,
        scheduleSentId: string,
        email: string,
        sig: string | undefined,
        redirectUrl: string,
        res: Response,
    ) {
        // 1. Valida assinatura/legado, pertencimento ao projeto e o destino
        // (precisa ser http/https E constar nos CTAs do HTML enviado — anti open redirect, A-11).
        const check = await this.webhooksService.validateCtaClick(
            projectId,
            scheduleSentId,
            email,
            sig,
            redirectUrl,
        );
        if (!check.ok) {
            this.logger.warn(
                `Clique rejeitado (${check.reason}) sent=${scheduleSentId.slice(0, 8)} email=${email}`,
            );
            return res.status(check.status).send(check.message);
        }

        // 2. Dispara a atualização do banco em BACKGROUND (garante o clique mais rápido possível)
        this.webhooksService
            .registerCtaClick(projectId, scheduleSentId, email)
            .catch((err) => {
                this.logger.error(
                    `Erro no background do click CTA para ${email}: ${err.message}`,
                );
            });

        // 3. Redireciona o usuário imediatamente para o link final
        return res.redirect(302, check.target);
    }

    // =========================================================================
    // ROTAS DE ATUALIZAÇÃO DO MICRO-SERVIÇO (PROTEGIDAS)
    // =========================================================================

    // Rota: POST /webhooks/email/schedule-sent/:sentId
    @Post('schedule-sent/:sentId')
    @UseGuards(ApiKeyGuard) // 🛡️ Protege a rota com a chave do micro-serviço
    async updateScheduleSent(
        @Param('sentId', new ParseUUIDPipe()) sentId: string,
        @Body() dto: UpdateScheduleSentDto,
    ) {
        await this.webhooksService.updateScheduleSent(sentId, dto);
        return { success: true, message: 'Status de envio atualizado.' };
    }

    @Post('lead-metrics')
    @UseGuards(ApiKeyGuard)
    async updateLeadMetrics(@Body() dto: UpdateLeadMetricsDto) {
        await this.webhooksService.updateLeadMetrics(dto);
        return { success: true, message: 'Métricas do lead atualizadas.' };
    }
}
