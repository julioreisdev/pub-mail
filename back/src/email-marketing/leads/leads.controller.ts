import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Public } from '../../auth/public.decorator';
import { EmailLeadsService } from './leads.service';

import { CreateEmailLeadDto } from './dto/create-email-lead.dto';
import { UpdateEmailLeadDto } from './dto/update-email-lead.dto';
import { PublicSubscribeDto } from './dto/public-subscribe.dto';
import { BulkTagsDto } from './dto/bulk-tags.dto';

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
  ApiProduces
} from '@nestjs/swagger';

@ApiTags('Email Marketing - Leads')
@Controller('email/leads')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EmailLeadsController {
  constructor(private readonly service: EmailLeadsService) {}

  @Public()
  @Post('subscribe/:organizationId/:projectId')
  @ApiOperation({ summary: 'Webhook público: inscrever/reativar lead em um projeto (sem autenticação)' })
  @ApiParam({ name: 'organizationId', description: 'ID da organização (tenant)', type: String, format: 'uuid' })
  @ApiParam({ name: 'projectId', description: 'ID do projeto de e-mail', type: String, format: 'uuid' })
  @ApiBody({ type: PublicSubscribeDto })
  @ApiOkResponse({ description: 'Lead inscrito/reativado com sucesso' })
  @ApiNotFoundResponse({ description: 'Organization ou Project não encontrado' })
  @ApiBadRequestResponse({ description: 'Payload inválido' })
  subscribe(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: PublicSubscribeDto,
  ) {
    return this.service.publicSubscribe(organizationId, projectId, dto);
  }

  @Post()
  @ApiOperation({ summary: 'Criar lead manualmente (autenticado)' })
  @ApiBody({ type: CreateEmailLeadDto })
  @ApiCreatedResponse({ description: 'Lead criado com sucesso' })
  @ApiBadRequestResponse({ description: 'Email duplicado ou dados inválidos' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  create(@Req() req: any, @Body() dto: CreateEmailLeadDto) {
    return this.service.create(req.user.organizationId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar leads da organização (autenticado)' })
  @ApiOkResponse({ description: 'Lista de leads' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  list(@Req() req: any) {
    return this.service.list(req.user.organizationId);
  }

  @Get('tags')
  @ApiOperation({ summary: 'Listar tags distintas da organização' })
  distinctTags(@Req() req: any) {
    return this.service.distinctTags(req.user.organizationId);
  }

  @Post('tags/bulk')
  @ApiOperation({ summary: 'Adicionar tag(s) a vários leads' })
  @ApiBody({ type: BulkTagsDto })
  bulkTags(@Req() req: any, @Body() dto: BulkTagsDto) {
    return this.service.bulkAddTags(req.user.organizationId, dto.lead_ids, dto.add);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar lead (autenticado)' })
  @ApiParam({ name: 'id', description: 'ID do lead', type: String, format: 'uuid' })
  @ApiBody({ type: UpdateEmailLeadDto })
  @ApiOkResponse({ description: 'Lead atualizado com sucesso' })
  @ApiNotFoundResponse({ description: 'Lead não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  update(
    @Req() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEmailLeadDto,
  ) {
    return this.service.update(req.user.organizationId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover lead (autenticado)' })
  @ApiParam({ name: 'id', description: 'ID do lead', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Lead removido com sucesso' })
  @ApiNotFoundResponse({ description: 'Lead não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  remove(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.remove(req.user.organizationId, id);
  }

   // NOVO ENDPOINT: Contagem de inscritos e desinscritos no projeto
  @Get('leads-count/:projectId')
  @ApiOperation({ summary: 'Contar leads inscritos e desinscritos em um projeto (autenticado)' })
  @ApiParam({ name: 'projectId', description: 'ID do projeto de e-mail', type: String, format: 'uuid' })
  @ApiOkResponse({
    description: 'Contagem retornada com sucesso',
    schema: {
      type: 'object',
      properties: {
        inscribed_leads: { type: 'number', example: 10 },
        unscribed_leads: { type: 'number', example: 2 },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Projeto não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  countLeads(@Req() req: any, @Param('projectId', new ParseUUIDPipe()) projectId: string) {
    return this.service.countLeadsByProject(req.user.organizationId, projectId);
  }
  
  @Public()
  @Get("unsubscribe/:projectId/:leadEmail")
  @ApiOperation({ summary: 'Desinscrever lead de um projeto (público, sem autenticação)' })
  @ApiParam({ name: 'projectId', description: 'ID do projeto de e-mail', type: String, format: 'uuid' })
  @ApiParam({
    name: 'leadEmail',
    description: 'Email do lead (use URL encoded, ex: cliente%40exemplo.com)',
    type: String,
    example: 'cliente%40exemplo.com',
  })
  @ApiProduces('text/plain')
  @ApiOkResponse({
    description:
      'Texto simples com mensagem de confirmação. Vem de settings.unsubscribe_message ou fallback "Unsubscribed!"',
    schema: {
      type: 'string',
      example: 'Unsubscribed!',
    },
  })
  @ApiNotFoundResponse({ description: 'Project, Lead ou vínculo não encontrado' })
  unsubscribe(
    @Param("projectId") projectId: string,
    @Param("leadEmail") leadEmail: string
  ) {
    return this.service.unsubscribe(projectId, leadEmail);
  }

}
