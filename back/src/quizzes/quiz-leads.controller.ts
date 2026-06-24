import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QuizLeadsService } from './quiz-leads.service';

@ApiTags('Quiz Leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('quiz-leads')
export class QuizLeadsController {
  constructor(private readonly service: QuizLeadsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar leads dos quizzes da organização (paginado)' })
  @ApiQuery({ name: 'quiz_id', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'page_size', required: false, type: Number })
  @ApiQuery({ name: 'q', required: false })
  async list(
    @Req() req: any,
    @Query('quiz_id') quizId?: string,
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
    @Query('q') q?: string,
  ) {
    return this.service.list({
      organizationId: req.user.organizationId,
      quizId: quizId || undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      search: q || undefined,
    });
  }

  @Get('export')
  @ApiOperation({ summary: 'Exportar leads de quizzes (até 50k)' })
  @ApiQuery({ name: 'quiz_id', required: false })
  @ApiQuery({ name: 'q', required: false })
  async exportAll(
    @Req() req: any,
    @Query('quiz_id') quizId?: string,
    @Query('q') q?: string,
  ) {
    return this.service.listAllForExport({
      organizationId: req.user.organizationId,
      quizId: quizId || undefined,
      search: q || undefined,
    });
  }
}
