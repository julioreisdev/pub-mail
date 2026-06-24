import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';

import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // GET /users -> lista só da própria org
  @Get()
  @ApiOperation({ summary: 'Listar usuários da organização do usuário logado' })
  @ApiOkResponse({ description: 'Lista de usuários retornada com sucesso' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  findAll(@Req() req: any) {
    return this.usersService.findAllByOrganization(req.user.organizationId);
  }

  // GET /users/me
  @Get('me')
  @ApiOperation({ summary: 'Obter meu perfil (usuário logado) dentro da organização' })
  @ApiOkResponse({ description: 'Dados do usuário logado retornados com sucesso' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  @ApiNotFoundResponse({ description: 'Usuário não encontrado' })
  me(@Req() req: any) {
    return this.usersService.findMe(req.user.userId, req.user.organizationId);
  }

  // GET /users/:id -> só se for da mesma org
  @Get(':id')
  @ApiOperation({ summary: 'Buscar um usuário por ID (somente dentro da mesma organização)' })
  @ApiParam({ name: 'id', description: 'ID do usuário', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Usuário encontrado com sucesso' })
  @ApiNotFoundResponse({ description: 'Usuário não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  findOne(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.usersService.findOneInOrganization(req.user.organizationId, id);
  }

  // PATCH /users/:id -> só se for da mesma org
  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar um usuário por ID (somente dentro da mesma organização)' })
  @ApiParam({ name: 'id', description: 'ID do usuário', type: String, format: 'uuid' })
  @ApiBody({ type: UpdateUserDto })
  @ApiOkResponse({ description: 'Usuário atualizado com sucesso' })
  @ApiBadRequestResponse({ description: 'Dados inválidos' })
  @ApiNotFoundResponse({ description: 'Usuário não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  update(
    @Req() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateInOrganization(req.user.organizationId, id, dto);
  }

  // DELETE /users/:id (soft) -> só se for da mesma org
  @Delete(':id')
  @ApiOperation({ summary: 'Desativar (soft delete) um usuário por ID (somente dentro da mesma organização)' })
  @ApiParam({ name: 'id', description: 'ID do usuário', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Usuário desativado com sucesso' })
  @ApiNotFoundResponse({ description: 'Usuário não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  remove(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.usersService.removeInOrganization(req.user.organizationId, id);
  }
}
