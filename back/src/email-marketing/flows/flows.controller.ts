import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { EmailFlowsService } from './flows.service';
import { SaveFlowDto } from './dto/save-flow.dto';

@ApiTags('Email Marketing - Flows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('email')
export class EmailFlowsController {
  constructor(private readonly service: EmailFlowsService) {}

  @Get('flows')
  @ApiOperation({ summary: 'Resumo dos fluxos por projeto (status + nº de e-mails)' })
  listFlows(@Req() req: any) {
    return this.service.listFlows(req.user.organizationId);
  }

  @Get('projects/:projectId/flow')
  @ApiOperation({ summary: 'Fluxo inicial de um projeto (com steps)' })
  getFlow(
    @Req() req: any,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    return this.service.getFlow(req.user.organizationId, projectId);
  }

  @Get('projects/:projectId/flow/metrics')
  @ApiOperation({ summary: 'Métricas por passo do fluxo inicial' })
  getFlowMetrics(
    @Req() req: any,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    return this.service.getFlowMetrics(req.user.organizationId, projectId);
  }

  @Put('projects/:projectId/flow')
  @ApiOperation({ summary: 'Salvar/atualizar o fluxo inicial de um projeto' })
  saveFlow(
    @Req() req: any,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: SaveFlowDto,
  ) {
    return this.service.saveFlow(req.user.organizationId, projectId, dto);
  }
}
