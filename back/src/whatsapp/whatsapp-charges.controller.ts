import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WhatsAppChargesService } from './whatsapp-charges.service';
import { ChargeSettingsDto, CreateChargeDto } from './dto/whatsapp-charges.dto';

// Cobranças do WhatsApp (PIX/boleto) — org-scoped.
@ApiTags('WhatsApp CRM')
@UseGuards(JwtAuthGuard)
@Controller('whatsapp/charges')
export class WhatsAppChargesController {
  constructor(private readonly charges: WhatsAppChargesService) {}

  @Get('settings') settings(@Req() req: any) { return this.charges.settings(req.user.organizationId); }
  @Put('settings') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') updateSettings(@Req() req: any, @Body() dto: ChargeSettingsDto) { return this.charges.updateSettings(req.user.organizationId, dto); }
  @Post('run-daily') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') @Throttle({ default: { limit: 3, ttl: 60_000 } }) runDaily(@Req() req: any) { return this.charges.runDailyFor(req.user.organizationId); }

  @Get() list(@Req() req: any, @Query() q: any) { return this.charges.list(req.user.organizationId, q); }
  @Get(':id') get(@Req() req: any, @Param('id') id: string) { return this.charges.get(req.user.organizationId, id); }
  @Post() @Throttle({ default: { limit: 20, ttl: 60_000 } }) create(@Req() req: any, @Body() dto: CreateChargeDto) { return this.charges.create(req.user.organizationId, req.user.userId, dto, 'manual'); }
  @Post(':id/resend') @Throttle({ default: { limit: 20, ttl: 60_000 } }) resend(@Req() req: any, @Param('id') id: string) { return this.charges.resend(req.user.organizationId, id); }
  @Post(':id/check') @Throttle({ default: { limit: 30, ttl: 60_000 } }) check(@Req() req: any, @Param('id') id: string) { return this.charges.check(req.user.organizationId, id); }
  @Post(':id/cancel') cancel(@Req() req: any, @Param('id') id: string) { return this.charges.cancel(req.user.organizationId, id); }
  @Post(':id/mark-paid') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') markPaid(@Req() req: any, @Param('id') id: string) { return this.charges.markPaid(req.user.organizationId, req.user.userId, id); }
}
