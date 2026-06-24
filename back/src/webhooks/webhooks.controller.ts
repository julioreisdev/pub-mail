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
import { WebhooksService } from './webhooks.service';
import { UpdateScheduleSentDto } from './dto/update-schedule-sent.dto';
import { ApiKeyGuard } from '../auth/api-key.guard'; // Ajuste o caminho se necessário
import { UpdateLeadMetricsDto } from './dto/update-lead-metrics.dto';

@Controller('webhooks/email')
export class WebhooksController {
    private readonly logger = new Logger(WebhooksController.name);

    constructor(private readonly webhooksService: WebhooksService) { }

    // =========================================================================
    // 🚀 ROTA DO PIXEL DE ABERTURA (Invisível)
    // =========================================================================
    @Get('schedule-sent/open-pixel/:projectId/:scheduleSentId/:email')
    async trackOpenPixel(
        @Param('projectId', new ParseUUIDPipe()) projectId: string,
        @Param('scheduleSentId', new ParseUUIDPipe()) scheduleSentId: string,
        @Param('email') email: string,
        @Res() res: Response,
    ) {
        // 1. O GIF 1x1 Transparente em Base64
        const pixel = Buffer.from(
            'R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
            'base64',
        );

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
            'Content-Length': pixel.length.toString(),
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
        });

        // 4. Retorna os bytes do GIF instantaneamente
        res.send(pixel);
    }

    // =========================================================================
    // 🖱️ NOVO: ROTA DE RASTREAMENTO DE CLIQUE NO CTA (Redirect 302)
    // =========================================================================
    @Get('cta-click/:projectId/:scheduleSentId/:email')
    async trackCtaClick(
        @Param('projectId', new ParseUUIDPipe()) projectId: string,
        @Param('scheduleSentId', new ParseUUIDPipe()) scheduleSentId: string,
        @Param('email') email: string,
        @Query('redirectUrl') redirectUrl: string,
        @Res() res: Response,
    ) {
        // 1. Define para onde o lead vai (fallback de segurança caso falte a URL)
        const targetUrl = redirectUrl ? redirectUrl : '';

        // 2. Dispara a atualização do banco em BACKGROUND (garante o clique mais rápido possível)
        this.webhooksService
            .registerCtaClick(projectId, scheduleSentId, email)
            .catch((err) => {
                this.logger.error(
                    `Erro no background do click CTA para ${email}: ${err.message}`,
                );
            });

        // 3. Redireciona o usuário imediatamente para o link final
        return res.redirect(302, targetUrl);
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
