import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WaAccessService } from './wa-access.service';
import { WhatsAppEntitlementsService } from './whatsapp-entitlements.service';

export class SyncEntitlementsDto {
  @IsString() @MaxLength(36) subscription_id!: string;
}

// Direito de acesso (Fase 5): o que cada assinatura libera (grupo, etiqueta, arquivo, externo) e o estado aplicado.
// Leitura: MEMBER precisa da sub-permissão `whatsapp:crm` (A-12 — mapa `SUB_ANY` em platform-billing/modules.const.ts,
// prefixo `/whatsapp/entitlements`); retry/sync só dono/admin.
@ApiTags('WhatsApp CRM')
@UseGuards(JwtAuthGuard)
@Controller('whatsapp/entitlements')
export class WhatsAppEntitlementsController {
  constructor(private readonly ent: WhatsAppEntitlementsService) {}

  /** `?customer_id&subscription_id&product_id&kind&status(csv)&page&page_size` → `{items, total, page, page_size, pages, counts}`. */
  @Get() list(@Req() req: any, @Query() q: any) { return this.ent.list(req.user.organizationId, q); }
  @Get(':id') get(@Req() req: any, @Param('id') id: string) { return this.ent.get(req.user.organizationId, id); }
  @Post('sync') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') @Throttle({ default: { limit: 30, ttl: 60_000 } })
  sync(@Req() req: any, @Body() dto: SyncEntitlementsDto) { return this.ent.syncNow(req.user.organizationId, dto.subscription_id); }
  @Post(':id/retry') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') @Throttle({ default: { limit: 60, ttl: 60_000 } })
  retry(@Req() req: any, @Param('id') id: string) { return this.ent.retry(req.user.organizationId, id); }
}

// O número é administrador do grupo? (editor de regras do produto avisa antes de salvar)
@ApiTags('WhatsApp CRM')
@UseGuards(JwtAuthGuard)
@Controller('whatsapp/groups')
export class WhatsAppGroupAdminController {
  constructor(private readonly ent: WhatsAppEntitlementsService, private readonly access: WaAccessService) {}

  @Get(':jid/admin-check') @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async adminCheck(@Req() req: any, @Param('jid') jid: string, @Query('session_id') sessionId?: string) {
    if (!sessionId) throw new BadRequestException('Informe o número (session_id).');
    await this.access.assertSession(req.user, sessionId);
    return this.ent.adminCheck(req.user.organizationId, String(sessionId), decodeURIComponent(String(jid || '')));
  }
}
