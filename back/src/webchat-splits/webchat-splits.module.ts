import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WebchatSplitsController } from './webchat-splits.controller';
import { PublicWebchatSplitsController } from './public-webchat-splits.controller';
import { WebchatSplitsService } from './webchat-splits.service';

@Module({
  imports: [PrismaModule],
  controllers: [WebchatSplitsController, PublicWebchatSplitsController],
  providers: [WebchatSplitsService],
  exports: [WebchatSplitsService],
})
export class WebchatSplitsModule {}
