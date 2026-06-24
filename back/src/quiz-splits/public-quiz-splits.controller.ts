import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { QuizSplitsService } from './quiz-splits.service';

@ApiTags('Public Quiz Splits')
@Public()
@Controller('public/quiz-splits')
export class PublicQuizSplitsController {
  constructor(private readonly service: QuizSplitsService) {}

  @Get(':slug')
  @ApiOperation({ summary: 'Resolver split de quiz por slug (membros + pesos)' })
  resolve(@Param('slug') slug: string) {
    return this.service.getPublicSplitBySlug(slug);
  }
}
