import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { PrismaModule } from '../prisma/prisma.module'; // Ajuste o path se necessário
import { SocialPostSchedulesController } from './social-post-schedules.controller';
import { SocialPostSchedulesService } from './social-post-schedules.service';
import { SocialPostSchedulesRunner } from './social-post-schedules.runner';
import { SocialAccountsModule } from '../social-accounts/social-accounts.module';

@Module({
  imports: [PrismaModule, SocialAccountsModule],
  controllers: [SocialPostSchedulesController, PostsController],
  providers: [
    PostsService,
    SocialPostSchedulesService,
    SocialPostSchedulesRunner,
  ],
  exports: [PostsService],
})
export class PostsModule {}
