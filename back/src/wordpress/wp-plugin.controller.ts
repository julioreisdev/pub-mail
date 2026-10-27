import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { PUSH, TRANSLATOR, WpPluginService } from './wp-plugin.service';

const sendZip = (res: Response, file: { filename: string; buffer: Buffer }) => {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${file.filename}"`,
  );
  res.setHeader('Content-Length', String(file.buffer.length));
  res.setHeader('Cache-Control', 'no-store');
  res.end(file.buffer);
};

// Painel: módulo "WordPress" → Tradução Invisível e Push In Play (o AccessInterceptor exige o módulo `wordpress`).
// Os dois plugins usam a MESMA chave da conta; "gerar nova chave" em qualquer página vale para os dois.
@ApiTags('wordpress')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wordpress')
export class WpPluginController {
  constructor(private readonly svc: WpPluginService) {}

  // ---- Tradutor Invisível
  @Get('translator')
  info(@Req() req: any) {
    return this.svc.info(req.user.organizationId, req.user.userId, TRANSLATOR);
  }

  @Get('translator/download')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async download(@Req() req: any, @Res() res: Response) {
    sendZip(
      res,
      await this.svc.download(
        req.user.organizationId,
        req.user.userId,
        TRANSLATOR,
      ),
    );
  }

  @Post('translator/rotate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  rotate(@Req() req: any) {
    return this.svc.rotate(
      req.user.organizationId,
      req.user.userId,
      TRANSLATOR,
    );
  }

  // ---- Push In Play (notificações push)
  @Get('push-in-play')
  pipInfo(@Req() req: any) {
    return this.svc.info(req.user.organizationId, req.user.userId, PUSH);
  }

  @Get('push-in-play/download')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async pipDownload(@Req() req: any, @Res() res: Response) {
    sendZip(
      res,
      await this.svc.download(req.user.organizationId, req.user.userId, PUSH),
    );
  }

  /** Painel de métricas de todos os sites (ou de um): ?days=7|30|90&site=<id>. */
  @Get('push-in-play/analytics')
  pipAnalytics(
    @Req() req: any,
    @Query('days') days: string,
    @Query('site') site: string,
  ) {
    return this.svc.analytics(
      req.user.organizationId,
      days,
      site ? String(site).slice(0, 36) : undefined,
    );
  }

  /** Pede o resumo a cada site na hora (o plugin já manda sozinho a cada 15 min). */
  @Post('push-in-play/sync')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  pipSync(@Req() req: any) {
    return this.svc.syncNow(req.user.organizationId);
  }

  @Post('push-in-play/rotate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  pipRotate(@Req() req: any) {
    return this.svc.rotate(req.user.organizationId, req.user.userId, PUSH);
  }
}

// Chamadas dos próprios plugins instalados nos sites (sem login; a chave identifica a conta,
// `plugin` diz qual plugin — ausente = Tradutor, compatível com as instalações antigas).
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

  /** Plugin desativado ou apagado no site: sai da lista "Sites usando o plugin". */
  @Post('remove')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  remove(@Body() body: any) {
    return this.svc.remove(body);
  }

  /** Push In Play: resumo de métricas do site (a cada 15 min / fim de disparo). */
  @Post('stats')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  stats(@Body() body: any) {
    return this.svc.stats(body);
  }

  @Get('package')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async pkg(
    @Query('t') t: string,
    @Query('p') p: string,
    @Res() res: Response,
  ) {
    sendZip(
      res,
      await this.svc.packageByToken(String(t || ''), p ? String(p) : undefined),
    );
  }
}
