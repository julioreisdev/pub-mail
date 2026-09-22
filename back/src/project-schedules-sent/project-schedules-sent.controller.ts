import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectSchedulesSentService } from './project-schedules-sent.service';
import { Request } from 'express';

import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiQuery,
} from '@nestjs/swagger';

// ✅ Tipagem correta da request autenticada
interface AuthRequest extends Request {
  user: {
    id: string;
    organizationId: string;
  };
}

@ApiTags('Email Marketing - Schedules Sent')
@ApiBearerAuth()
@Controller('email/projects')
@UseGuards(JwtAuthGuard)
export class ProjectSchedulesSentController {
  constructor(private readonly service: ProjectSchedulesSentService) {}

  // ✅ NOVA ROTA (sem conflito):
  // GET /email/projects/:projectId/schedules-sent
  @Get(':projectId/schedules-sent')
  @ApiOperation({ summary: 'Listar logs de disparo (sent) por projeto' })
  @ApiParam({ name: 'projectId', description: 'ID do projeto', type: String, format: 'uuid' })
  @ApiQuery({
    name: 'scheduleId',
    required: false,
    description: 'Filtra por um agendamento específico (schedule_id).',
    example: '9f3d6c2a-4c3a-4f72-9b4a-0d7a2b1c3e9a',
  })
  @ApiQuery({
    name: 'sent',
    required: false,
    description: 'Filtra pelo status de envio (true/false/1/0).',
    example: 'true',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Filtra por data/hora inicial (run_at >= from). ISO string.',
    example: '2026-02-18T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'Filtra por data/hora final (run_at <= to). ISO string.',
    example: '2026-02-18T23:59:00.000Z',
  })
  @ApiQuery({
    name: 'take',
    required: false,
    description: 'Quantidade por página (1..200). Padrão: 50.',
    example: '50',
  })
  @ApiQuery({
    name: 'skip',
    required: false,
    description: 'Quantidade para pular (>=0). Padrão: 0.',
    example: '0',
  })
  @ApiOkResponse({ description: 'Lista de logs' })
  @ApiBadRequestResponse({
    description: 'Parâmetros inválidos (scheduleId/sent/from/to/take/skip)',
  })
  @ApiNotFoundResponse({ description: 'Projeto não encontrado (ou não pertence à organização)' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  list(
    @Req() req: AuthRequest,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Query('scheduleId') scheduleId?: string,
    @Query('sent') sent?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('recycle') recycle?: string,
  ) {
    return this.service.list(req.user.organizationId, projectId, {
      scheduleId,
      sent,
      from,
      to,
      take,
      skip,
      recycle,
    });
  }

  // GET /email/projects/:projectId/schedules-sent/:sentId/unopened-count
  @Get(':projectId/schedules-sent/:sentId/unopened-count')
  @ApiOperation({ summary: 'Conta inscritos ativos que NÃO abriram este disparo' })
  unopenedCount(
    @Req() req: AuthRequest,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('sentId', new ParseUUIDPipe()) sentId: string,
  ) {
    return this.service.unopenedCount(req.user.organizationId, projectId, sentId);
  }

  // ✅ NOVA ROTA (sem conflito):
  // GET /email/projects/:projectId/schedules-sent/:sentId
  @Get(':projectId/schedules-sent/:sentId')
  @ApiOperation({ summary: 'Detalhar um log de disparo (sent)' })
  @ApiParam({ name: 'projectId', description: 'ID do projeto', type: String, format: 'uuid' })
  @ApiParam({ name: 'sentId', description: 'ID do log', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Log encontrado' })
  @ApiNotFoundResponse({ description: 'Log não encontrado (ou não pertence ao projeto/org)' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  getOne(
    @Req() req: AuthRequest,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('sentId', new ParseUUIDPipe()) sentId: string,
  ) {
    return this.service.getOne(req.user.organizationId, projectId, sentId);
  }

  // ✅ NOVA ROTA (sem conflito):
  // DELETE /email/projects/:projectId/schedules-sent/:sentId
  @Delete(':projectId/schedules-sent/:sentId')
  @ApiOperation({ summary: 'Remover um log de disparo (sent)' })
  @ApiParam({ name: 'projectId', description: 'ID do projeto', type: String, format: 'uuid' })
  @ApiParam({ name: 'sentId', description: 'ID do log', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Log removido' })
  @ApiNotFoundResponse({ description: 'Log não encontrado (ou não pertence ao projeto/org)' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  removeOne(
    @Req() req: AuthRequest,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('sentId', new ParseUUIDPipe()) sentId: string,
  ) {
    return this.service.removeOne(req.user.organizationId, projectId, sentId);
  }

  // ✅ NOVA ROTA (sem conflito):
  // DELETE /email/projects/:projectId/schedules-sent?from=...&to=...
  @Delete(':projectId/schedules-sent')
  @ApiOperation({ summary: 'Limpar logs de disparo por período (opcional)' })
  @ApiParam({ name: 'projectId', description: 'ID do projeto', type: String, format: 'uuid' })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Remove registros com run_at >= from (ISO string).',
    example: '2026-02-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'Remove registros com run_at <= to (ISO string).',
    example: '2026-02-18T23:59:00.000Z',
  })
  @ApiOkResponse({ description: 'Logs removidos' })
  @ApiBadRequestResponse({ description: 'Precisa informar from e/ou to válidos' })
  @ApiNotFoundResponse({ description: 'Projeto não encontrado (ou não pertence à organização)' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  purge(
    @Req() req: AuthRequest,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.purge(req.user.organizationId, projectId, { from, to });
  }
}
