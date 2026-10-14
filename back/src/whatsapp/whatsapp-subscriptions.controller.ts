import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WaAccessService } from './wa-access.service';
import { WhatsAppSubscriptionsService, SubMeta } from './whatsapp-subscriptions.service';
import { CancelSubscriptionDto, ChangePlanDto, CouponDto, PauseSubscriptionDto, UpdateCouponDto, ValidateCouponDto } from './dto/whatsapp-subscriptions.dto';

// Assinaturas (lista cruzada + transições) e cupons — Fase 3. Assinaturas são da ORG (cliente é da org);
// `session_id` na listagem só filtra clientes com conversa naquele número (número alheio = vazio).
@ApiTags('WhatsApp CRM')
@UseGuards(JwtAuthGuard)
@Controller('whatsapp/subscriptions')
export class WhatsAppSubscriptionsController {
  constructor(private readonly subs: WhatsAppSubscriptionsService, private readonly access: WaAccessService) {}
  private meta(req: any): SubMeta { return { source: 'panel', user_id: req.user.userId }; }

  @Get() async list(@Req() req: any, @Query() q: any) { return this.subs.list(req.user.organizationId, q, await this.access.allowedIds(req.user)); }
  @Get(':id') get(@Req() req: any, @Param('id') id: string) { return this.subs.get(req.user.organizationId, id); }
  @Get(':id/events') events(@Req() req: any, @Param('id') id: string) { return this.subs.events(req.user.organizationId, id); }
  @Post(':id/cancel') @Throttle({ default: { limit: 30, ttl: 60_000 } }) cancel(@Req() req: any, @Param('id') id: string, @Body() dto: CancelSubscriptionDto) { return this.subs.cancel(req.user.organizationId, id, { policy: (dto.policy as any) || 'product', reason: dto.reason || null, ...this.meta(req) }); }
  @Post(':id/pause') @Throttle({ default: { limit: 30, ttl: 60_000 } }) pause(@Req() req: any, @Param('id') id: string, @Body() dto: PauseSubscriptionDto) { return this.subs.pause(req.user.organizationId, id, { until: dto.until || null, days: dto.days || null, ...this.meta(req) }); }
  @Post(':id/resume') @Throttle({ default: { limit: 30, ttl: 60_000 } }) resume(@Req() req: any, @Param('id') id: string) { return this.subs.resume(req.user.organizationId, id, this.meta(req)); }
  @Post(':id/change-plan') @Throttle({ default: { limit: 30, ttl: 60_000 } }) changePlan(@Req() req: any, @Param('id') id: string, @Body() dto: ChangePlanDto) { return this.subs.changePlan(req.user.organizationId, id, dto.product_id, this.meta(req)); }
  @Post(':id/reactivate') @Throttle({ default: { limit: 30, ttl: 60_000 } }) reactivate(@Req() req: any, @Param('id') id: string) { return this.subs.reactivate(req.user.organizationId, id, this.meta(req)); }
}

@ApiTags('WhatsApp CRM')
@UseGuards(JwtAuthGuard)
@Controller('whatsapp/coupons')
export class WhatsAppCouponsController {
  constructor(private readonly subs: WhatsAppSubscriptionsService) {}

  @Get() list(@Req() req: any, @Query() q: any) { return this.subs.listCoupons(req.user.organizationId, q); }
  @Post('validate') @Throttle({ default: { limit: 60, ttl: 60_000 } }) validate(@Req() req: any, @Body() dto: ValidateCouponDto) { return this.subs.validateCoupon(req.user.organizationId, dto.code, dto.product_id || null); }
  @Post() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') create(@Req() req: any, @Body() dto: CouponDto) { return this.subs.createCoupon(req.user.organizationId, dto); }
  @Put(':id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateCouponDto) { return this.subs.updateCoupon(req.user.organizationId, id, dto); } // PUT parcial validado
  @Delete(':id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') remove(@Req() req: any, @Param('id') id: string) { return this.subs.removeCoupon(req.user.organizationId, id); }
}
