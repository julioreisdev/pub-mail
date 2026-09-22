import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { EmailAnalyticsService } from './analytics.service';

@ApiTags('Email Marketing - Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('email/analytics')
export class EmailAnalyticsController {
  constructor(private readonly service: EmailAnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Visão geral de analytics de e-mail (org/projeto).' })
  overview(
    @Req() req: any,
    @Query('project_id') projectId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.overview(req.user.organizationId, {
      projectId: projectId || undefined,
      from,
      to,
    });
  }
}
