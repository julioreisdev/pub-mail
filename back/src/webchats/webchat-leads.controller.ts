import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WebchatLeadsService } from './webchat-leads.service';

@ApiTags('Webchat Leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('webchat-leads')
export class WebchatLeadsController {
  constructor(private readonly service: WebchatLeadsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar leads dos webchats da organização (paginado)' })
  @ApiQuery({ name: 'webchat_id', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'page_size', required: false, type: Number })
  @ApiQuery({ name: 'q', required: false, description: 'Busca por nome/e-mail/telefone' })
  @ApiOkResponse({ description: 'Lista paginada de leads' })
  async list(
    @Req() req: any,
    @Query('webchat_id') webchatId?: string,
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
    @Query('q') q?: string,
  ) {
    return this.service.list({
      organizationId: req.user.organizationId,
      webchatId: webchatId || undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      search: q || undefined,
    });
  }

  @Get('export')
  @ApiOperation({ summary: 'Exportar leads (até 50k registros) — uso para gerar Excel no front' })
  @ApiQuery({ name: 'webchat_id', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiOkResponse({ description: 'Lista completa (sem paginação)' })
  async exportAll(
    @Req() req: any,
    @Query('webchat_id') webchatId?: string,
    @Query('q') q?: string,
  ) {
    return this.service.listAllForExport({
      organizationId: req.user.organizationId,
      webchatId: webchatId || undefined,
      search: q || undefined,
    });
  }
}
