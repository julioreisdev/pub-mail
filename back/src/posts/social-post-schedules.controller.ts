import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateSocialPostScheduleDto } from './dto/create-social-post-schedule.dto';
import { ListSocialPostSchedulesDto } from './dto/list-social-post-schedules.dto';
import { ListSocialPostScheduleRunsDto } from './dto/list-social-post-schedule-runs.dto';
import { SocialPostSchedulesService } from './social-post-schedules.service';

@ApiTags('Posts - Agendamentos Sociais')
@ApiBearerAuth()
@Controller('posts/schedules')
@UseGuards(JwtAuthGuard)
export class SocialPostSchedulesController {
  constructor(
    private readonly socialPostSchedulesService: SocialPostSchedulesService,
  ) {}

  @Get('meta')
  @ApiOperation({
    summary:
      'Metadados do módulo de agendamento social (timezone, custo por disparo, enums)',
  })
  getMeta() {
    return this.socialPostSchedulesService.getMeta();
  }

  @Get('daily-limits')
  @ApiOperation({
    summary:
      'Retorna consumo diário por conta social para a rede informada (reset 00:00 UTC)',
  })
  getDailyLimits(@Req() req: any, @Query('social_network') socialNetwork?: string) {
    return this.socialPostSchedulesService.getDailyAccountLimits(
      req.user.organizationId,
      socialNetwork,
    );
  }

  @Get('tiktok/creator-info/:socialAccountId')
  @ApiOperation({
    summary:
      'Consulta creator_info do TikTok para a conta informada (privacidade, interações e limite de duração)',
  })
  getTikTokCreatorInfo(
    @Req() req: any,
    @Param('socialAccountId') socialAccountId: string,
  ) {
    return this.socialPostSchedulesService.getTikTokCreatorInfoForSchedule(
      req.user.organizationId,
      socialAccountId,
    );
  }

  @Post()
  @ApiOperation({
    summary: 'Criar agendamento social para um post da Galeria',
  })
  create(@Req() req: any, @Body() dto: CreateSocialPostScheduleDto) {
    return this.socialPostSchedulesService.create(req.user.organizationId, dto);
  }

  @Put(':id')
  @ApiOperation({
    summary:
      'Editar agendamento social recriando o agendamento com os novos dados',
  })
  replace(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: CreateSocialPostScheduleDto,
  ) {
    return this.socialPostSchedulesService.replace(
      req.user.organizationId,
      id,
      dto,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Excluir agendamento social',
  })
  remove(@Req() req: any, @Param('id') id: string) {
    return this.socialPostSchedulesService.remove(req.user.organizationId, id);
  }

  @Post(':id/dispatch-now')
  @ApiOperation({
    summary: 'Disparar imediatamente um agendamento social já criado',
  })
  dispatchNow(@Req() req: any, @Param('id') id: string) {
    return this.socialPostSchedulesService.dispatchNow(
      req.user.organizationId,
      id,
    );
  }

  @Get()
  @ApiOperation({
    summary:
      'Listar agendamentos sociais da organização com filtros de rede/status/período',
  })
  list(@Req() req: any, @Query() query: ListSocialPostSchedulesDto) {
    return this.socialPostSchedulesService.list(req.user.organizationId, query);
  }

  @Get('history')
  @ApiOperation({
    summary:
      'Listar histórico de disparos sociais com filtros de rede/status/período',
  })
  listHistory(
    @Req() req: any,
    @Query() query: ListSocialPostScheduleRunsDto,
  ) {
    return this.socialPostSchedulesService.listRuns(
      req.user.organizationId,
      query,
    );
  }
}
