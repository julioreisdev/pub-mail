import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WebchatDomainsController } from './webchat-domains.controller';
import { QuizDomainsController } from './quiz-domains.controller';
import { WebchatDomainsService } from './webchat-domains.service';
import { PublicAdsTxtController } from './public-ads-txt.controller';

@Module({
  imports: [PrismaModule],
  controllers: [
    WebchatDomainsController,
    QuizDomainsController,
    PublicAdsTxtController,
  ],
  providers: [WebchatDomainsService],
  exports: [WebchatDomainsService],
})
export class WebchatDomainsModule {}
