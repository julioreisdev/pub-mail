import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WhatsAppMetricsService } from './whatsapp-metrics.service';
import { WhatsAppRatingsService } from './whatsapp-ratings.service';
import { WaAccessService } from './wa-access.service';
import { AccessService } from '../platform-billing/access.service';

// Métricas de atendimento + avaliações (fase 4 do CRM) — org-scoped.
// Multi-número: `?session_id=` filtra um número; sem ele, todos os números permitidos ao usuário.
@ApiTags('WhatsApp CRM')
@UseGuards(JwtAuthGuard)
@Controller('whatsapp')
export class WhatsAppMetricsController {
  constructor(private readonly metrics: WhatsAppMetricsService, private readonly ratings: WhatsAppRatingsService, private readonly access: WaAccessService, private readonly platformAccess: AccessService) {}

  @Get('metrics') async overview(@Req() req: any, @Query() q: any) {
    const r: any = await this.metrics.overview(req.user.organizationId, q, await this.access.allowedIds(req.user));
    // valores de cobrança só para quem tem o financeiro (atendente sem a permissão vê o resto das métricas)
    const role = String(req.user?.role || '');
    if (r && r.charges && role !== 'OWNER' && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      const perms = await this.platformAccess.getUserPermissions(req.user.userId).catch(() => [] as string[]);
      if (!perms.includes('whatsapp:finance')) r.charges = null;
    }
    return r;
  }
  @Get('ratings') async ratingsList(@Req() req: any, @Query() q: any) { return this.ratings.list(req.user.organizationId, q, await this.access.allowedIds(req.user)); }
}
