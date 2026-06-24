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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QuizzesService } from './quizzes.service';
import { QuizAdsService } from './quiz-ads.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { UpdateQuizAdsDto } from './dto/update-quiz-ads.dto';

@ApiTags('Quizzes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('quizzes')
export class QuizzesController {
  constructor(
    private readonly quizzesService: QuizzesService,
    private readonly quizAdsService: QuizAdsService,
  ) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateQuizDto) {
    return this.quizzesService.create(req.user.organizationId, dto);
  }

  @Get()
  list(@Req() req: any) {
    return this.quizzesService.list(req.user.organizationId);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.quizzesService.findOne(req.user.organizationId, id);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateQuizDto,
  ) {
    return this.quizzesService.update(req.user.organizationId, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.quizzesService.remove(req.user.organizationId, id);
  }

  @Get(':id/ads')
  listAds(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.quizAdsService.getAdsConfig(req.user.organizationId, id);
  }

  @Patch(':id/ads')
  saveAds(
    @Req() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateQuizAdsDto,
  ) {
    return this.quizAdsService.updateAdsConfig(req.user.organizationId, id, dto);
  }
}
