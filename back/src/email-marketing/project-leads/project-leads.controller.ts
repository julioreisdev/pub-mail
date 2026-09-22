import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { EmailProjectLeadsService } from './project-leads.service';

@ApiTags('Email Marketing - Project Leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('email-project-leads')
export class EmailProjectLeadsController {
  constructor(private readonly service: EmailProjectLeadsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar leads de um projeto de e-mail (paginado)' })
  @ApiQuery({ name: 'project_id', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'page_size', required: false, type: Number })
  @ApiQuery({ name: 'q', required: false })
  async list(
    @Req() req: any,
    @Query('project_id') projectId?: string,
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
    @Query('q') q?: string,
    @Query('engagement') engagement?: string,
    @Query('source') source?: string,
    @Query('tag') tag?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    return this.service.list({
      organizationId: req.user.organizationId,
      projectId: projectId || undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      search: q || undefined,
      engagement: engagement || undefined,
      source: source || undefined,
      tag: tag || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
  }

  @Get('export')
  @ApiOperation({ summary: 'Exportar leads de projeto de e-mail (até 50k)' })
  @ApiQuery({ name: 'project_id', required: false })
  @ApiQuery({ name: 'q', required: false })
  async exportAll(
    @Req() req: any,
    @Query('project_id') projectId?: string,
    @Query('q') q?: string,
    @Query('engagement') engagement?: string,
    @Query('source') source?: string,
    @Query('tag') tag?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    return this.service.listAllForExport({
      organizationId: req.user.organizationId,
      projectId: projectId || undefined,
      search: q || undefined,
      engagement: engagement || undefined,
      source: source || undefined,
      tag: tag || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
  }
}
