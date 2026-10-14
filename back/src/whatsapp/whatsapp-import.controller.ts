import { Body, Controller, Get, Param, Post, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WhatsAppImportService } from './whatsapp-import.service';

// Importação de clientes em segundo plano (Fase 8, contrato §12.3). Tudo só dono/admin (a lista de jobs mostra
// telefones/nomes das linhas com erro). A permissão `whatsapp:crm` vem do mapa do AccessInterceptor (`/whatsapp/imports`).
// `template.csv` fica ANTES de `:id` (senão vira um id).
@ApiTags('WhatsApp CRM')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
@Controller('whatsapp/imports')
export class WhatsAppImportController {
  constructor(private readonly imports: WhatsAppImportService) {}

  @Get('template.csv')
  async template(@Req() req: any, @Res() res: Response) {
    const csv = await this.imports.template(req.user.organizationId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="modelo-importacao-clientes.csv"');
    res.send(csv);
  }

  @Get()
  list(@Req() req: any) {
    return this.imports.list(req.user.organizationId);
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024, files: 1 } }))
  create(@Req() req: any, @UploadedFile() file: any, @Body() body: any) {
    return this.imports.create(req.user.organizationId, req.user.userId || null, file, body || {});
  }

  @Get(':id/errors.csv')
  async errors(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const { csv, filename } = await this.imports.errorsReport(req.user.organizationId, id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.imports.get(req.user.organizationId, id);
  }

  @Post(':id/cancel')
  cancel(@Req() req: any, @Param('id') id: string) {
    return this.imports.cancel(req.user.organizationId, id);
  }
}
