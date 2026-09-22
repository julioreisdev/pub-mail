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
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { EmailTemplatesService } from './templates.service';
import { CreateEmailTemplateDto } from './dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';

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
} from '@nestjs/swagger';

@ApiTags('Email Marketing - Templates')
@ApiBearerAuth()
@Controller('email')
@UseGuards(JwtAuthGuard)
export class EmailTemplatesController {
  constructor(private readonly service: EmailTemplatesService) {}

  @Post('projects/:projectId/templates')
  @ApiOperation({ summary: 'Criar template dentro de um projeto' })
  @ApiParam({ name: 'projectId', description: 'ID do projeto', type: String, format: 'uuid' })
  @ApiBody({
    type: CreateEmailTemplateDto,
    description: 'Informe pelo menos um: body_html ou body_text.',
  })
  @ApiCreatedResponse({ description: 'Template criado com sucesso' })
  @ApiBadRequestResponse({
    description: 'Dados inválidos (ex: body_html e body_text ausentes)',
  })
  @ApiNotFoundResponse({ description: 'Projeto não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  create(
    @Req() req: any,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateEmailTemplateDto,
  ) {
    return this.service.create(req.user.organizationId, projectId, dto);
  }

  @Get('projects/:projectId/templates')
  @ApiOperation({ summary: 'Listar templates de um projeto' })
  @ApiParam({ name: 'projectId', description: 'ID do projeto', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Lista de templates' })
  @ApiNotFoundResponse({ description: 'Projeto não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  list(
    @Req() req: any,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Query('recycle') recycle?: string,
  ) {
    const isRecycle = recycle === 'true' || recycle === '1';
    return this.service.list(req.user.organizationId, projectId, isRecycle);
  }

  @Patch('templates/:id')
  @ApiOperation({ summary: 'Atualizar template' })
  @ApiParam({ name: 'id', description: 'ID do template', type: String, format: 'uuid' })
  @ApiBody({
    type: UpdateEmailTemplateDto,
    description:
      'Você pode atualizar qualquer campo. Atenção: o template precisa continuar tendo body_html ou body_text.',
  })
  @ApiOkResponse({ description: 'Template atualizado com sucesso' })
  @ApiNotFoundResponse({ description: 'Template não encontrado' })
  @ApiBadRequestResponse({
    description: 'Dados inválidos (ex: tentativa de deixar body_html e body_text vazios)',
  })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  update(
    @Req() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEmailTemplateDto,
  ) {
    return this.service.update(req.user.organizationId, id, dto);
  }

  @Delete('templates/:id')
  @ApiOperation({ summary: 'Remover template' })
  @ApiParam({ name: 'id', description: 'ID do template', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Template removido com sucesso' })
  @ApiNotFoundResponse({ description: 'Template não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  remove(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.remove(req.user.organizationId, id);
  }
}
