import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { EraseCustomerDto } from './dto/whatsapp-privacy.dto';
import { WhatsAppPrivacyService } from './whatsapp-privacy.service';

// LGPD do cliente (Fase 8, §12.4) — exportar e apagar dados pessoais. Só dono/admin/superadmin.
// Caminhos mais fundos que `customers/:id` do CRM (sem conflito de rota). A auditoria é gravada pelo serviço
// (o interceptor global pula estas rotas para não duplicar).
@ApiTags('WhatsApp CRM')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
@Controller('whatsapp/customers')
export class WhatsAppPrivacyController {
  constructor(private readonly privacy: WhatsAppPrivacyService) {}

  private actor(req: any) {
    return { userId: req.user?.userId || null, ip: String(req.ip || req.socket?.remoteAddress || '') || null, method: String(req.method || ''), path: String(req.originalUrl || req.url || '').split('?')[0] };
  }

  @Get(':id/export') @Throttle({ default: { limit: 10, ttl: 60_000 } })
  export(@Req() req: any, @Param('id') id: string) { return this.privacy.export(req.user.organizationId, id, this.actor(req)); }

  @Post(':id/erase') @Throttle({ default: { limit: 5, ttl: 60_000 } })
  erase(@Req() req: any, @Param('id') id: string, @Body() dto: EraseCustomerDto) { return this.privacy.erase(req.user.organizationId, id, dto, this.actor(req)); }
}
