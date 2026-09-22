import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  ParseUUIDPipe,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectSchedulesService } from './project_schedules.service';
import { CreateEmailProjectScheduleDto } from './dto/create-project_schedule.dto';
import { UpdateEmailProjectScheduleDto } from './dto/update-project_schedule.dto';
import { DispatchNowDto } from './dto/dispatch-now.dto';

import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { EmailSchedulesRunner } from 'src/cron-jobs/schedules.service';

@ApiTags('Email Marketing - Schedules')
@ApiBearerAuth()
@Controller('email/projects')
@UseGuards(JwtAuthGuard)
export class ProjectSchedulesController {
  constructor(
    private readonly service: ProjectSchedulesService,
    // 👇 Injetamos o nosso Runner aqui para usar no botão de "Disparar Agora"
    private readonly emailSchedulesRunner: EmailSchedulesRunner,
  ) { }

  // =========================================================
  // 🚀 NOVO: DISPARO MANUAL (DISPARAR AGORA)
  // POST /email/projects/:projectId/dispatch-now
  // =========================================================
  @Post(':projectId/dispatch-now')
  @ApiOperation({
    summary: 'Disparo manual imediato de um template aleatório para um projeto',
  })
  @ApiParam({
    name: 'projectId',
    description: 'ID do projeto',
    type: String,
    format: 'uuid',
  })
  @ApiCreatedResponse({
    description: 'Disparo iniciado com sucesso e tokens debitados.',
  })
  @ApiBadRequestResponse({
    description: 'Saldo insuficiente ou nenhum template/lead encontrado.',
  })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  async dispatchNow(
    @Req() req: any,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: DispatchNowDto,
  ) {
    try {
      // template_id opcional: específico OU aleatório (ausente/null)
      const result = await this.emailSchedulesRunner.executeManualDispatch(
        projectId,
        dto?.template_id ?? null,
      );
      return result;
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  // -------------------------
  // REENVIO PARA NÃO-ABRIDORES
  // POST /email/projects/:projectId/schedules-sent/:sentId/resend-unopened
  // -------------------------
  @Post(':projectId/schedules-sent/:sentId/resend-unopened')
  @ApiOperation({ summary: 'Reenvia um disparo só para quem não abriu' })
  async resendUnopened(
    @Req() req: any,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('sentId', new ParseUUIDPipe()) sentId: string,
    @Body() body: { subject?: string },
  ) {
    try {
      return await this.emailSchedulesRunner.resendToUnopeners(
        req.user.organizationId,
        projectId,
        sentId,
        body?.subject ?? null,
      );
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  // -------------------------
  // PREVIEW SEGMENTO (conta leads que casam)
  // POST /email/projects/:projectId/segment-preview
  // -------------------------
  @Post(':projectId/segment-preview')
  @ApiOperation({ summary: 'Conta quantos leads casam com um segmento' })
  @ApiParam({ name: 'projectId', type: String, format: 'uuid' })
  segmentPreview(
    @Req() req: any,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() body: { segment?: any },
  ) {
    return this.service.previewSegment(
      req.user.organizationId,
      projectId,
      body?.segment ?? null,
    );
  }

  // -------------------------
  // CREATE
  // POST /email/projects/:projectId/schedules
  // -------------------------
  @Post(':projectId/schedules')
  @ApiOperation({ summary: 'Criar agendamento de disparo para um projeto' })
  @ApiParam({
    name: 'projectId',
    description: 'ID do projeto',
    type: String,
    format: 'uuid',
  })
  @ApiExtraModels(CreateEmailProjectScheduleDto)
  @ApiBody({
    description:
      'Criação de agendamento. Existem 3 modos: DAILY, ONE-OFF e INTERVAL. ' +
      '**Importante:** o campo `time` aceita HORA (0..23) ou MINUTO DO DIA (0..1439). ' +
      'Ex.: 17 => 17:00 (hora); 1020 => 17:00 (minuto do dia).',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(CreateEmailProjectScheduleDto) },
        { $ref: getSchemaPath(CreateEmailProjectScheduleDto) },
        { $ref: getSchemaPath(CreateEmailProjectScheduleDto) },
      ],
    },
    examples: {
      DAILY_HOUR: {
        summary: 'DAILY (diário) — hora (frontend)',
        description:
          'daily=true, time pode ser HORA (0..23) ou MINUTO DO DIA (0..1439). ' +
          'date e for_x_days devem ser omitidos ou null.',
        value: { daily: true, time: 17 },
      },
      DAILY_MINUTES: {
        summary: 'DAILY (diário) — minuto do dia (legado)',
        description:
          'daily=true, time em MINUTO DO DIA (0..1439). ' +
          'date e for_x_days devem ser omitidos ou null.',
        value: { daily: true, time: 1020 }, // 17:00 => 1020
      },
      ONE_OFF_HOUR: {
        summary: 'ONE-OFF (dia específico) — hora (frontend)',
        description:
          'daily=false, date obrigatório (date-only ISO), time pode ser HORA (0..23) ou MINUTO DO DIA (0..1439). ' +
          'for_x_days deve ser omitido/null.',
        value: { daily: false, date: '2026-02-20T00:00:00.000Z', time: 17 },
      },
      ONE_OFF_MINUTES: {
        summary: 'ONE-OFF (dia específico) — minuto do dia (legado)',
        description:
          'daily=false, date obrigatório (date-only ISO), time em MINUTO DO DIA (0..1439). ' +
          'for_x_days deve ser omitido/null.',
        value: { daily: false, date: '2026-02-20T00:00:00.000Z', time: 1020 },
      },
      INTERVAL_HOUR: {
        summary: 'INTERVAL (a cada N dias) — hora (frontend)',
        description:
          'daily=false, date=null, time pode ser HORA (0..23) ou MINUTO DO DIA (0..1439), for_x_days obrigatório (>0). ' +
          'last_run é controlado pelo cron.',
        value: { daily: false, date: null, time: 17, for_x_days: 10 },
      },
      INTERVAL_MINUTES: {
        summary: 'INTERVAL (a cada N dias) — minuto do dia (legado)',
        description:
          'daily=false, date=null, time em MINUTO DO DIA (0..1439), for_x_days obrigatório (>0). ' +
          'last_run é controlado pelo cron.',
        value: { daily: false, date: null, time: 1020, for_x_days: 10 },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Agendamento criado com sucesso' })
  @ApiBadRequestResponse({
    description: 'Dados inválidos (ex: combinações daily/date/time/for_x_days)',
  })
  @ApiNotFoundResponse({
    description: 'Projeto não encontrado (ou não pertence à organização)',
  })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  create(
    @Req() req: any,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateEmailProjectScheduleDto,
  ) {
    return this.service.create(req.user.organizationId, projectId, dto);
  }

  // -------------------------
  // GET ONE
  // GET /email/projects/:projectId/schedules/:scheduleId
  // -------------------------
  @Get(':projectId/schedules/:scheduleId')
  @ApiOperation({ summary: 'Buscar um agendamento específico' })
  @ApiParam({
    name: 'projectId',
    description: 'ID do projeto',
    type: String,
    format: 'uuid',
  })
  @ApiParam({
    name: 'scheduleId',
    description: 'ID do agendamento',
    type: String,
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Agendamento' })
  @ApiNotFoundResponse({
    description: 'Agendamento não encontrado (ou não pertence à organização)',
  })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  getOne(
    @Req() req: any,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('scheduleId', new ParseUUIDPipe()) scheduleId: string,
  ) {
    return this.service.getOne(req.user.organizationId, projectId, scheduleId);
  }

  // -------------------------
  // LIST
  // GET /email/projects/:projectId/schedules
  // -------------------------
  @Get(':projectId/schedules')
  @ApiOperation({ summary: 'Listar agendamentos de um projeto' })
  @ApiParam({
    name: 'projectId',
    description: 'ID do projeto',
    type: String,
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Lista de agendamentos' })
  @ApiNotFoundResponse({
    description: 'Projeto não encontrado (ou não pertence à organização)',
  })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  list(
    @Req() req: any,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Query('recycle') recycle?: string,
  ) {
    const isRecycle = recycle === 'true' || recycle === '1';
    return this.service.list(req.user.organizationId, projectId, isRecycle);
  }

  // -------------------------
  // UPDATE
  // PATCH /email/projects/:projectId/schedules/:scheduleId
  // -------------------------
  @Patch(':projectId/schedules/:scheduleId')
  @ApiOperation({ summary: 'Atualizar agendamento' })
  @ApiParam({
    name: 'projectId',
    description: 'ID do projeto',
    type: String,
    format: 'uuid',
  })
  @ApiParam({
    name: 'scheduleId',
    description: 'ID do agendamento',
    type: String,
    format: 'uuid',
  })
  @ApiExtraModels(UpdateEmailProjectScheduleDto)
  @ApiBody({
    description:
      'Atualização parcial. O estado final precisa respeitar DAILY / ONE-OFF / INTERVAL. ' +
      '**Importante:** o campo `time` aceita HORA (0..23) ou MINUTO DO DIA (0..1439).',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(UpdateEmailProjectScheduleDto) },
        { $ref: getSchemaPath(UpdateEmailProjectScheduleDto) },
        { $ref: getSchemaPath(UpdateEmailProjectScheduleDto) },
        { $ref: getSchemaPath(UpdateEmailProjectScheduleDto) },
      ],
    },
    examples: {
      CHANGE_TIME_ONLY_HOUR: {
        summary: 'Mudar somente horário — hora (frontend)',
        description: 'Mantém o modo atual, desde que continue válido.',
        value: { time: 17 }, // 17:00
      },
      CHANGE_TIME_ONLY_MINUTES: {
        summary: 'Mudar somente horário — minuto do dia (legado)',
        description: 'Mantém o modo atual, desde que continue válido.',
        value: { time: 1020 }, // 17:00
      },
      TO_DAILY: {
        summary: 'Converter para DAILY',
        description: 'daily=true exige date=null e for_x_days=null.',
        value: { daily: true, time: 17, date: null, for_x_days: null },
      },
      TO_ONE_OFF: {
        summary: 'Converter para ONE-OFF',
        description: 'daily=false exige date != null e for_x_days=null.',
        value: {
          daily: false,
          date: '2026-02-21T00:00:00.000Z',
          time: 17,
          for_x_days: null,
        },
      },
      TO_INTERVAL: {
        summary: 'Converter para INTERVAL',
        description: 'for_x_days > 0 exige daily=false e date=null.',
        value: { daily: false, date: null, time: 17, for_x_days: 10 },
      },
    },
  })
  @ApiOkResponse({ description: 'Agendamento atualizado com sucesso' })
  @ApiBadRequestResponse({
    description: 'Dados inválidos (ex: combinações daily/date/time/for_x_days)',
  })
  @ApiNotFoundResponse({
    description: 'Agendamento não encontrado (ou não pertence à organização)',
  })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  update(
    @Req() req: any,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('scheduleId', new ParseUUIDPipe()) scheduleId: string,
    @Body() dto: UpdateEmailProjectScheduleDto,
  ) {
    return this.service.update(
      req.user.organizationId,
      projectId,
      scheduleId,
      dto,
    );
  }

  // -------------------------
  // DELETE
  // DELETE /email/projects/:projectId/schedules/:scheduleId
  // -------------------------
  @Delete(':projectId/schedules/:scheduleId')
  @ApiOperation({ summary: 'Remover agendamento' })
  @ApiParam({
    name: 'projectId',
    description: 'ID do projeto',
    type: String,
    format: 'uuid',
  })
  @ApiParam({
    name: 'scheduleId',
    description: 'ID do agendamento',
    type: String,
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Agendamento removido com sucesso' })
  @ApiNotFoundResponse({
    description: 'Agendamento não encontrado (ou não pertence à organização)',
  })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  remove(
    @Req() req: any,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('scheduleId', new ParseUUIDPipe()) scheduleId: string,
  ) {
    return this.service.remove(req.user.organizationId, projectId, scheduleId);
  }
}
