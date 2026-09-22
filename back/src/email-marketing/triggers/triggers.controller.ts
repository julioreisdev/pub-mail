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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { TriggersService } from './triggers.service';
import { CreateTriggerDto, UpdateTriggerDto } from './dto/trigger.dto';

@ApiTags('Email Marketing - Behavior Triggers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('email/projects')
export class TriggersController {
  constructor(private readonly service: TriggersService) {}

  @Get(':projectId/triggers')
  @ApiOperation({ summary: 'Listar gatilhos de comportamento do projeto' })
  list(
    @Req() req: any,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    return this.service.list(req.user.organizationId, projectId);
  }

  @Post(':projectId/triggers')
  @ApiOperation({ summary: 'Criar gatilho' })
  create(
    @Req() req: any,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateTriggerDto,
  ) {
    return this.service.create(req.user.organizationId, projectId, dto);
  }

  @Patch(':projectId/triggers/:id')
  @ApiOperation({ summary: 'Atualizar gatilho' })
  update(
    @Req() req: any,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTriggerDto,
  ) {
    return this.service.update(req.user.organizationId, projectId, id, dto);
  }

  @Delete(':projectId/triggers/:id')
  @ApiOperation({ summary: 'Remover gatilho' })
  remove(
    @Req() req: any,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.remove(req.user.organizationId, projectId, id);
  }
}
