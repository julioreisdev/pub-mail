import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { QuizzesService } from './quizzes.service';
import { CaptureQuizLeadDto } from './dto/capture-quiz-lead.dto';

@ApiTags('Public Quiz')
@Public()
@Controller('public/quiz')
export class PublicQuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  @Get(':slug/config')
  @ApiOperation({ summary: 'Configuração pública do quiz por slug' })
  getConfig(
    @Param('slug') slug: string,
    @Query('domain') domainQuery: string | undefined,
    @Req() req: any,
  ) {
    return this.quizzesService.getPublicConfig(
      slug,
      this.resolveDomainHint(req, domainQuery),
    );
  }

  @Post(':slug/leads')
  @ApiOperation({ summary: 'Capturar lead público do quiz' })
  captureLead(
    @Param('slug') slug: string,
    @Query('domain') domainQuery: string | undefined,
    @Body() dto: CaptureQuizLeadDto,
    @Req() req: any,
  ) {
    return this.quizzesService.captureLead(
      slug,
      this.resolveDomainHint(req, domainQuery),
      dto,
    );
  }

  private resolveDomainHint(req: any, domainQuery?: string) {
    const headerDomain = req.headers?.['x-quiz-domain'];
    const host = req.headers?.host;
    return String(headerDomain || domainQuery || host || '');
  }
}
