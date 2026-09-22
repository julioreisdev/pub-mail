import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailAnalyticsController } from './analytics.controller';
import { EmailAnalyticsService } from './analytics.service';

@Module({
  imports: [PrismaModule],
  controllers: [EmailAnalyticsController],
  providers: [EmailAnalyticsService],
})
export class EmailAnalyticsModule {}
