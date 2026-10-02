import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { WpPluginService } from './wp-plugin.service';

const sendZip = (res: Response, file: { filename: string; buffer: Buffer }) => {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  res.setHeader('Content-Length', String(file.buffer.length));
  res.setHeader('Cache-Control', 'no-store');
  res.end(file.buffer);
};

// Painel: módulo "WordPress" → Tradução Invisível (o AccessInterceptor exige o módulo `wordpress`).
@ApiTags('wordpress')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wordpress')
export class WpPluginController {
  constructor(private readonly svc: WpPluginService) {}

  @Get('translator')
  info(@Req() req: any) {
    return this.svc.info(req.user.organizationId, req.user.userId);
  }

  @Get('translator/download')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async download(@Req() req: any, @Res() res: Response) {
    sendZip(res, await this.svc.download(req.user.organizationId, req.user.userId));
  }

  @Post('translator/rotate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  rotate(@Req() req: any) {
    return this.svc.rotate(req.user.organizationId, req.user.userId);
  }
}

// Chamadas do próprio plugin instalado nos sites (sem login; a chave identifica a conta).
@ApiTags('wordpress')
@Public()
@Controller('public/wp-plugin')
export class WpPluginPublicController {
  constructor(private readonly svc: WpPluginService) {}

  @Post('check')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  check(@Body() body: any) {
    return this.svc.check(body);
  }

  @Post('update')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  update(@Body() body: any) {
    return this.svc.updateInfo(body);
  }

  @Get('package')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async pkg(@Query('t') t: string, @Res() res: Response) {
    sendZip(res, await this.svc.packageByToken(String(t || '')));
  }
}
