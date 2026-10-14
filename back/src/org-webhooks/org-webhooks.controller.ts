import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OrgWebhooksService } from './org-webhooks.service';
import { CreateOrgWebhookDto, UpdateOrgWebhookDto } from './dto/org-webhooks.dto';

// Painel: webhooks de saída da organização (dono/admin). `/org/*` exige o módulo `settings` (modules.const.ts).
@ApiTags('API da organização')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
@Controller('org/webhooks')
export class OrgWebhooksController {
  constructor(private readonly svc: OrgWebhooksService) {}

  @Get() list(@Req() req: any) { return this.svc.list(req.user.organizationId); }
  @Post() @Throttle({ default: { limit: 20, ttl: 60_000 } }) create(@Req() req: any, @Body() dto: CreateOrgWebhookDto) { return this.svc.create(req.user.organizationId, dto); }

  // entregas (antes de `:id` para não confundir as rotas)
  @Get('deliveries/:id') delivery(@Req() req: any, @Param('id') id: string) { return this.svc.delivery(req.user.organizationId, id); }
  @Post('deliveries/:id/retry') @Throttle({ default: { limit: 60, ttl: 60_000 } }) retry(@Req() req: any, @Param('id') id: string) { return this.svc.retry(req.user.organizationId, id); }

  @Put(':id') update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateOrgWebhookDto) { return this.svc.update(req.user.organizationId, id, dto); }
  @Delete(':id') remove(@Req() req: any, @Param('id') id: string) { return this.svc.remove(req.user.organizationId, id); }
  @Post(':id/rotate-secret') @Throttle({ default: { limit: 10, ttl: 60_000 } }) rotate(@Req() req: any, @Param('id') id: string) { return this.svc.rotateSecret(req.user.organizationId, id); }
  @Post(':id/test') @Throttle({ default: { limit: 10, ttl: 60_000 } }) test(@Req() req: any, @Param('id') id: string) { return this.svc.test(req.user.organizationId, id); }
  @Get(':id/deliveries') deliveries(@Req() req: any, @Param('id') id: string, @Query() q: any) { return this.svc.deliveries(req.user.organizationId, id, q); }
}
