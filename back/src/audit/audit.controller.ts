import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OrgAuditService } from './org-audit.service';

// Auditoria da organização (Fase 8, §12.4) — só dono/admin/superadmin (MEMBER = 403 no RolesGuard).
// Duas portas para o mesmo serviço (revisão de 14/10/2026, A-10):
//  - `/org/audit` — tela Configurações → Auditoria (o mapa de módulos põe `/org` no módulo Configurações, não no WhatsApp);
//  - `/whatsapp/audit` — histórico dentro do diálogo do cliente (módulo WhatsApp) e quem só tem o WhatsApp.
@ApiTags('Auditoria')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
@Controller('whatsapp/audit')
export class AuditController {
  constructor(private readonly audit: OrgAuditService) {}

  /** ?entity&entity_id&user_id&action&actor&q&from&to (YYYY-MM-DD, BRT)&page&page_size */
  @Get() list(@Req() req: any, @Query() q: any) { return this.audit.list(req.user.organizationId, q); }

  /** Usuários da org e entidades com registro (opções dos filtros). */
  @Get('meta') meta(@Req() req: any) { return this.audit.meta(req.user.organizationId); }
}

@ApiTags('Auditoria')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
@Controller('org/audit')
export class OrgAuditController {
  constructor(private readonly audit: OrgAuditService) {}

  /** Mesmos filtros de `GET /whatsapp/audit`. */
  @Get() list(@Req() req: any, @Query() q: any) { return this.audit.list(req.user.organizationId, q); }

  @Get('meta') meta(@Req() req: any) { return this.audit.meta(req.user.organizationId); }
}
