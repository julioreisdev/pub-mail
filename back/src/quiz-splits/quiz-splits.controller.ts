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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QuizSplitsService } from './quiz-splits.service';
import { CreateQuizSplitDto } from './dto/create-quiz-split.dto';
import { UpdateQuizSplitDto } from './dto/update-quiz-split.dto';

@ApiTags('Quiz Splits')
@ApiBearerAuth()
@Controller('quiz-splits')
@UseGuards(JwtAuthGuard)
export class QuizSplitsController {
  constructor(private readonly service: QuizSplitsService) {}

  @Get()
  list(@Req() req: any) {
    return this.service.list(req.user.organizationId);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateQuizSplitDto) {
    return this.service.create(req.user.organizationId, dto.name);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateQuizSplitDto,
  ) {
    return this.service.update(req.user.organizationId, id, dto.name);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.service.remove(req.user.organizationId, id);
  }
}
