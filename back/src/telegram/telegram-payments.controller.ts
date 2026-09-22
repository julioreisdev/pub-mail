import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TelegramPaymentsService } from './telegram-payments.service';

@ApiTags('Telegram - Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('telegram/payments')
export class TelegramPaymentsController {
  constructor(private readonly service: TelegramPaymentsService) {}

  // ---- Gateway settings ----
  @Get('settings')
  getSettings(@Req() req: any) {
    return this.service.getSettings(req.user.organizationId);
  }

  @Put('settings')
  saveSettings(@Req() req: any, @Body() dto: any) {
    return this.service.saveSettings(req.user.organizationId, dto || {});
  }

  @Post('settings/test')
  testSettings(@Req() req: any) {
    return this.service.testSettings(req.user.organizationId);
  }

  // ---- Plans ----
  @Get('plans')
  listPlans(@Req() req: any, @Query('bot_id') botId?: string) {
    return this.service.listPlans(req.user.organizationId, botId);
  }

  @Post('plans')
  createPlan(@Req() req: any, @Body() dto: any) {
    return this.service.createPlan(req.user.organizationId, dto || {});
  }

  @Put('plans/:id')
  updatePlan(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: any) {
    return this.service.updatePlan(req.user.organizationId, id, dto || {});
  }

  @Delete('plans/:id')
  removePlan(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.removePlan(req.user.organizationId, id);
  }

  // ---- Sales ----
  @Get('sales')
  sales(@Req() req: any, @Query() q: any) {
    return this.service.listPayments(req.user.organizationId, q || {});
  }

  // ---- Subscriptions ----
  @Get('subscriptions')
  subscriptions(@Req() req: any, @Query() q: any) {
    return this.service.listSubscriptions(req.user.organizationId, q || {});
  }
}
