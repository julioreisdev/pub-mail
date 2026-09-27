import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { WebchatPaymentsService } from './webchat-payments.service';

// Rotas PÚBLICAS usadas pelo chat (mesmo padrão de /public/webchat/:slug/*: domínio
// vem de ?domain= / x-webchat-domain / Host).
@ApiExcludeController()
@Public()
@Controller('public/webchat/:slug/payments')
export class PublicWebchatPaymentsController {
  constructor(private readonly service: WebchatPaymentsService) {}

  private domainHint(req: any, q?: string) {
    const h = req?.headers?.['x-webchat-domain'];
    if (typeof h === 'string' && h.trim()) return h.trim();
    if (typeof q === 'string' && q.trim()) return q.trim();
    const host = req?.headers?.host;
    return typeof host === 'string' ? host.split(':')[0] : undefined;
  }

  // IP real vem do Express com `trust proxy` (main.ts) — NUNCA ler o
  // X-Forwarded-For na mão (o cliente controla o 1º valor) (A-24).
  private ip(req: any) {
    return String(req?.ip || req?.socket?.remoteAddress || 'unknown');
  }

  // A-13: 10 PIX/min por IP.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  create(@Param('slug') slug: string, @Query('domain') domain: string | undefined, @Body() body: any, @Req() req: any) {
    return this.service.createCharge(slug, this.domainHint(req, domain), body || {}, this.ip(req));
  }

  @Get(':paymentId')
  status(
    @Param('slug') slug: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Query('domain') domain: string | undefined,
    @Query('session_id') sessionId: string,
    @Req() req: any,
  ) {
    return this.service.getStatus(slug, this.domainHint(req, domain), paymentId, sessionId, false);
  }

  // Botão "Validar pagamento": reconfere no gateway agora. A-13: 30/min por IP.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post(':paymentId/check')
  check(
    @Param('slug') slug: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Query('domain') domain: string | undefined,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.service.getStatus(slug, this.domainHint(req, domain), paymentId, body?.session_id, true);
  }
}
