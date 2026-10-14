import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WaAccessService } from './wa-access.service';
import { WhatsAppOutboxService } from './whatsapp-outbox.service';
import { OutboxCancelPendingDto, OutboxOrgRateDto, OutboxPauseDto, OutboxRetryFailedDto, OutboxSessionRateDto } from './dto/whatsapp-outbox.dto';

const ADMIN = ['OWNER', 'ADMIN', 'SUPER_ADMIN'] as const;

// Fila de envios com ritmo (Fase 8, contrato §12.1). Leitura: qualquer usuário com o módulo WhatsApp (só os números
// que ele vê); escrita: dono/admin. Envio/número fora do acesso do usuário → 404/403 (WaAccessService).
@ApiTags('WhatsApp Fila de envios')
@UseGuards(JwtAuthGuard)
@Controller('whatsapp/outbox')
export class WhatsAppOutboxController {
  constructor(private readonly svc: WhatsAppOutboxService, private readonly access: WaAccessService) {}

  private org(req: any) { return req.user.organizationId as string; }
  private allowed(req: any) { return this.access.allowedIds(req.user); }

  // ---------------------------------------------------------------- leitura
  @Get('summary') async summary(@Req() req: any) { return this.svc.summary(this.org(req), await this.allowed(req)); }

  @Get() async list(@Req() req: any, @Query() q: any) {
    if (q?.session_id) await this.access.assertSession(req.user, String(q.session_id));
    return this.svc.list(this.org(req), await this.allowed(req), { status: q?.status, session_id: q?.session_id, kind: q?.kind, q: q?.q, page: q?.page, page_size: q?.page_size });
  }

  // ---------------------------------------------------------------- por número
  @Post('sessions/:id/pause') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...ADMIN)
  async pause(@Req() req: any, @Param('id') id: string, @Body() dto: OutboxPauseDto) {
    await this.access.assertSession(req.user, id);
    return this.svc.pauseSession(this.org(req), id, dto?.reason ?? null);
  }

  @Post('sessions/:id/resume') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...ADMIN)
  async resume(@Req() req: any, @Param('id') id: string) {
    await this.access.assertSession(req.user, id);
    return this.svc.resumeSession(this.org(req), id);
  }

  @Put('sessions/:id/rate') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...ADMIN)
  async sessionRate(@Req() req: any, @Param('id') id: string, @Body() dto: OutboxSessionRateDto) {
    await this.access.assertSession(req.user, id);
    return this.svc.setSessionRate(this.org(req), id, dto?.per_minute ?? null);
  }

  // ---------------------------------------------------------------- organização
  @Put('rate') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...ADMIN)
  orgRate(@Req() req: any, @Body() dto: OutboxOrgRateDto) { return this.svc.setOrgRate(this.org(req), dto.per_minute); }

  // ---------------------------------------------------------------- em massa (antes das rotas `:id/...`)
  @Post('retry-failed') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...ADMIN) @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async retryFailed(@Req() req: any, @Body() dto: OutboxRetryFailedDto) {
    if (dto?.session_id) await this.access.assertSession(req.user, dto.session_id);
    return this.svc.retryFailed(this.org(req), await this.allowed(req), dto?.session_id || null);
  }

  @Post('cancel-pending') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...ADMIN) @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async cancelPending(@Req() req: any, @Body() dto: OutboxCancelPendingDto) {
    if (dto?.session_id) await this.access.assertSession(req.user, dto.session_id);
    return this.svc.cancelPendingBulk(this.org(req), await this.allowed(req), { session_id: dto?.session_id || null, kind: dto?.kind || null });
  }

  // ---------------------------------------------------------------- por envio
  @Post(':id/retry') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...ADMIN)
  async retry(@Req() req: any, @Param('id') id: string) { return this.svc.retry(this.org(req), id, await this.allowed(req)); }

  @Post(':id/cancel') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...ADMIN)
  async cancel(@Req() req: any, @Param('id') id: string) { return this.svc.cancel(this.org(req), id, await this.allowed(req)); }
}
