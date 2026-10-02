import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WhatsAppMetricsService } from './whatsapp-metrics.service';
import { WhatsAppRatingsService } from './whatsapp-ratings.service';

// Métricas de atendimento + avaliações (fase 4 do CRM) — org-scoped.
@ApiTags('WhatsApp CRM')
@UseGuards(JwtAuthGuard)
@Controller('whatsapp')
export class WhatsAppMetricsController {
  constructor(private readonly metrics: WhatsAppMetricsService, private readonly ratings: WhatsAppRatingsService) {}

  @Get('metrics') overview(@Req() req: any, @Query() q: any) { return this.metrics.overview(req.user.organizationId, q); }
  @Get('ratings') ratingsList(@Req() req: any, @Query() q: any) { return this.ratings.list(req.user.organizationId, q); }
}
