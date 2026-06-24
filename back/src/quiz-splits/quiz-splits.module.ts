import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { QuizSplitsController } from './quiz-splits.controller';
import { PublicQuizSplitsController } from './public-quiz-splits.controller';
import { QuizSplitsService } from './quiz-splits.service';

@Module({
  imports: [PrismaModule],
  controllers: [QuizSplitsController, PublicQuizSplitsController],
  providers: [QuizSplitsService],
  exports: [QuizSplitsService],
})
export class QuizSplitsModule {}
