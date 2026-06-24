import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AgentesService } from './agentes.service';
import { CreateAgenteDto } from './dto/create-agente.dto';
import { UpdateAgenteDto } from './dto/update-agente.dto';

@ApiTags('Agentes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('agentes')
export class AgentesController {
  constructor(private readonly agentesService: AgentesService) {}

  @Post()
  @ApiOperation({ summary: 'Criar agente de IA' })
  @ApiCreatedResponse({ description: 'Agente criado com sucesso' })
  create(@Req() req: any, @Body() dto: CreateAgenteDto) {
    return this.agentesService.create(req.user.organizationId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar agentes da organização' })
  @ApiOkResponse({ description: 'Lista de agentes retornada com sucesso' })
  list(@Req() req: any) {
    return this.agentesService.list(req.user.organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar agente por ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  findOne(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.agentesService.findOne(req.user.organizationId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar agente' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  update(
    @Req() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAgenteDto,
  ) {
    return this.agentesService.update(req.user.organizationId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover agente' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  remove(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.agentesService.remove(req.user.organizationId, id);
  }
}
