import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { EmailAbService } from './ab.service';
import { CreateAbTestDto } from './dto/ab.dto';

@ApiTags('Email Marketing - A/B Tests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('email/projects')
export class EmailAbController {
  constructor(private readonly service: EmailAbService) {}

  @Get(':projectId/ab-tests')
  @ApiOperation({ summary: 'Listar testes A/B do projeto (com métricas)' })
  list(@Req() req: any, @Param('projectId', new ParseUUIDPipe()) projectId: string) {
    return this.service.list(req.user.organizationId, projectId);
  }

  @Post(':projectId/ab-tests')
  @ApiOperation({ summary: 'Criar e iniciar um teste A/B' })
  async create(
    @Req() req: any,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateAbTestDto,
  ) {
    try {
      return await this.service.create(req.user.organizationId, projectId, dto);
    } catch (e: any) {
      throw new HttpException(e.message, e.status || HttpStatus.BAD_REQUEST);
    }
  }

  @Delete(':projectId/ab-tests/:id')
  @ApiOperation({ summary: 'Cancelar um teste A/B em andamento' })
  cancel(
    @Req() req: any,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.cancel(req.user.organizationId, projectId, id);
  }
}
