import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AccessService } from './access.service';
import { PlatformBillingSettingsService } from './platform-billing-settings.service';
import { PlatformPaymentsService } from './platform-payments.service';
import { SubscriptionsService } from './subscriptions.service';
import { BillingSettingsDto, ExtendDto, UpdatePlanDto } from './dto/billing.dto';

// Administração → Pagamentos (SUPER_ADMIN): gateway do superadmin, assinaturas, cobranças, KPIs.
@ApiTags('Admin · Pagamentos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller('admin/billing')
export class AdminBillingController {
  constructor(
    private readonly settings: PlatformBillingSettingsService,
    private readonly payments: PlatformPaymentsService,
    private readonly access: AccessService,
    private readonly subs: SubscriptionsService,
  ) {}

  @Get('settings') getSettings() { return this.settings.get(); }
  @Put('settings') saveSettings(@Body() dto: BillingSettingsDto) { return this.settings.save(dto); }
  @Post('settings/test') test() { return this.settings.test(); }

  @Get('overview') overview(@Query() q: any) { return this.payments.overview(q); }
  @Get('payments') listPayments(@Query() q: any) { return this.payments.listPayments(q); }

  @Get('subscriptions') listSubscriptions(@Query() q: any, @Req() req: any) { return this.subs.list(q, req.user.organizationId); }
  @Get('subscriptions/:orgId') getSubscription(@Param('orgId') orgId: string, @Req() req: any) { return this.subs.get(orgId, req.user.organizationId); }

  @Patch('subscriptions/:orgId')
  async updatePlan(@Param('orgId') orgId: string, @Body() dto: UpdatePlanDto, @Req() req: any) {
    await this.subs.assertVisible(orgId, req.user.organizationId);
    await this.access.upsertPlan(orgId, dto);
    return this.subs.get(orgId, req.user.organizationId);
  }
  @Post('subscriptions/:orgId/extend')
  async extend(@Param('orgId') orgId: string, @Body() dto: ExtendDto, @Req() req: any) {
    await this.subs.assertVisible(orgId, req.user.organizationId);
    await this.access.extend(orgId, dto.days);
    return this.subs.get(orgId, req.user.organizationId);
  }
  @Post('subscriptions/:orgId/mark-paid')
  async markPaid(@Param('orgId') orgId: string, @Req() req: any) {
    await this.subs.assertVisible(orgId, req.user.organizationId);
    await this.payments.markManualPaid(orgId, req.user.userId);
    return this.subs.get(orgId, req.user.organizationId);
  }
  @Post('subscriptions/:orgId/block')
  async block(@Param('orgId') orgId: string, @Req() req: any) {
    await this.subs.assertVisible(orgId, req.user.organizationId);
    await this.payments.cancelOpenCharges(orgId); // PIX já aberto não pode reativar a conta depois
    await this.access.block(orgId);
    return this.subs.get(orgId, req.user.organizationId);
  }
  @Post('subscriptions/:orgId/unblock')
  async unblock(@Param('orgId') orgId: string, @Req() req: any) {
    await this.subs.assertVisible(orgId, req.user.organizationId);
    await this.access.unblock(orgId);
    return this.subs.get(orgId, req.user.organizationId);
  }
}
