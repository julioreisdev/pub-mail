import { Body, Controller, Get, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PaymentsSettingsService } from './payments-settings.service';
import { PaymentsSalesService } from './payments-sales.service';

// Configurações → Pagamentos (gateway da organização + vendas de todos os canais).
@ApiTags('Pagamentos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly settings: PaymentsSettingsService, private readonly sales: PaymentsSalesService) {}

  @Get('settings')
  getSettings(@Req() req: any) {
    return this.settings.get(req.user.organizationId);
  }

  // Token do gateway: só OWNER/ADMIN (A-07).
  @Put('settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  saveSettings(@Req() req: any, @Body() dto: any) {
    return this.settings.save(req.user.organizationId, dto || {});
  }

  @Post('settings/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  test(@Req() req: any, @Body() dto: any) {
    return this.settings.test(req.user.organizationId, dto?.provider || null);
  }

  @Get('sales')
  listSales(@Req() req: any, @Query() q: any) {
    return this.sales.list(req.user.organizationId, q || {});
  }
}
