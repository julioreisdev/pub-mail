import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccessService } from './access.service';
import { PlatformPaymentsService } from './platform-payments.service';

// Lado do CLIENTE: estado do acesso + fluxo do PIX de assinatura. Rota aberta
// pelo AccessInterceptor (é por aqui que a conta bloqueada paga).
@ApiTags('Acesso / assinatura')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('access')
export class AccessController {
  constructor(private readonly access: AccessService, private readonly payments: PlatformPaymentsService) {}

  @Get('me')
  async me(@Req() req: any) {
    const access = await this.access.forMe(req.user.userId, req.user.organizationId, req.user.role);
    const pending = access.is_super ? null : await this.payments.currentPending(req.user.organizationId);
    return { access, pending_charge: pending };
  }

  @Post('charge')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  charge(@Req() req: any) {
    return this.payments.createCharge(req.user.userId, req.user.organizationId);
  }

  @Get('charge/:id')
  status(@Req() req: any, @Param('id') id: string) {
    return this.payments.getStatus(req.user.organizationId, id, false);
  }

  @Post('charge/:id/check')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  check(@Req() req: any, @Param('id') id: string) {
    return this.payments.getStatus(req.user.organizationId, id, true);
  }

  @Post('welcome-seen')
  welcomeSeen(@Req() req: any) {
    return this.access.markWelcomed(req.user.userId);
  }
}
