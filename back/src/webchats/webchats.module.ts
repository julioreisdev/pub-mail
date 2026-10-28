import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WebchatsService } from './webchat.service';
import { WebchatsController } from './webchats.controller';
import { PublicWebchatsController } from './public-webchats.controller';
import { WebchatLeadsService } from './webchat-leads.service';
import { WebchatLeadsController } from './webchat-leads.controller';
import { WebchatSplitsModule } from '../webchat-splits/webchat-splits.module';
import { WebchatMediaService } from './webchat-media.service';
import { WebchatMediaController } from './webchat-media.controller';
import { PublicWebchatPageController } from './public-webchat-page.controller';

@Module({
  imports: [PrismaModule, WebchatSplitsModule],
  controllers: [WebchatsController, PublicWebchatsController, WebchatLeadsController, WebchatMediaController, PublicWebchatPageController],
  providers: [WebchatsService, WebchatLeadsService, WebchatMediaService],
  exports: [WebchatsService],
})
export class WebchatsModule {}
