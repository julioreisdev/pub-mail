import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { QuizSplitsModule } from '../quiz-splits/quiz-splits.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { QuizLeadEmailService } from './quiz-lead-email.service';
import { QuizzesController } from './quizzes.controller';
import { PublicQuizzesController } from './public-quizzes.controller';
import { QuizzesService } from './quizzes.service';
import { QuizLeadsController } from './quiz-leads.controller';
import { QuizLeadsService } from './quiz-leads.service';
import { QuizAdsService } from './quiz-ads.service';

@Module({
  imports: [PrismaModule, QuizSplitsModule, SystemSettingsModule],
  controllers: [QuizzesController, PublicQuizzesController, QuizLeadsController],
  providers: [
    QuizzesService,
    QuizLeadsService,
    QuizAdsService,
    QuizLeadEmailService,
  ],
})
export class QuizzesModule {}
