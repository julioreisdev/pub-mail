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
import { EmailProjectsService } from './project.service';
import { CreateEmailProjectDto } from './dto/create-email-project.dto';
import { UpdateEmailProjectDto } from './dto/update-email-project.dto';

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

@ApiTags('Email Marketing - Projects')
@ApiBearerAuth()
@Controller('email/projects')
@UseGuards(JwtAuthGuard)
export class EmailProjectsController {
  constructor(private readonly service: EmailProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar projeto de e-mail (lista/estratégia)' })
  @ApiBody({ type: CreateEmailProjectDto })
  @ApiCreatedResponse({ description: 'Projeto criado com sucesso' })
  @ApiBadRequestResponse({ description: 'Dados inválidos' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  create(@Req() req: any, @Body() dto: CreateEmailProjectDto) {
    return this.service.create(req.user.organizationId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar projetos ativos da organização' })
  @ApiOkResponse({ description: 'Lista de projetos' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  list(@Req() req: any) {
    return this.service.findAll(req.user.organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar projeto ativo por ID' })
  @ApiParam({ name: 'id', description: 'ID do projeto', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Projeto encontrado' })
  @ApiNotFoundResponse({ description: 'Projeto não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  get(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(req.user.organizationId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar projeto (nome/settings/active)' })
  @ApiParam({ name: 'id', description: 'ID do projeto', type: String, format: 'uuid' })
  @ApiBody({ type: UpdateEmailProjectDto })
  @ApiOkResponse({ description: 'Projeto atualizado com sucesso' })
  @ApiNotFoundResponse({ description: 'Projeto não encontrado' })
  @ApiBadRequestResponse({ description: 'Dados inválidos' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  update(
    @Req() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEmailProjectDto,
  ) {
    return this.service.update(req.user.organizationId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Desativar projeto (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID do projeto', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Projeto desativado com sucesso' })
  @ApiNotFoundResponse({ description: 'Projeto não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  remove(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.remove(req.user.organizationId, id);
  }
}
