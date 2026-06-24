import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

// import { AppController } from './app.controller';
// import { AppService } from './app.service';
import { UsersModule } from '../users/users.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganiztionsModule } from 'src/organiztions/organiztions.module';
import { AuthModule } from '../auth/auth.module';
import { BillingCardsModule } from 'src/billing_cards/billing_cards.module';
import { TransactionsModule } from 'src/transactions/transactions.module';
import { WalletsModule } from 'src/wallets/wallets.module';
import { ProfileModule } from 'src/profile/profile.module';
import { BillingModule } from 'src/billing/billing.module';
import { EmailMarketingModule } from 'src/email-marketing/email-marketing.module';
import { ProjectSchedulesModule } from 'src/project_schedules/project_schedules.module';
import { SchedulesModule } from 'src/cron-jobs/schedules.module';
import { ProjectSchedulesSentModule } from 'src/project-schedules-sent/project-schedules-sent.module';
import { DomainsModule } from 'src/domains/domains.module';
import { WebhooksModule } from 'src/webhooks/webhooks.module';
import { IaIntegrationsModule } from 'src/ia-integrations/ia-integrations.module';
import { AgentesModule } from 'src/agentes/agentes.module';
import { WebchatsModule } from 'src/webchats/webchats.module';
import { WebchatDomainsModule } from 'src/webchat-domains/webchat-domains.module';
import { PostsModule } from 'src/posts/posts.module';
import { SocialAccountsModule } from 'src/social-accounts/social-accounts.module';
import { AvatarGenerationsModule } from 'src/avatar-generations/avatar-generations.module';
import { AvatarsModule } from 'src/avatars/avatars.module';
import { SystemSettingsModule } from 'src/system-settings/system-settings.module';
import { AdminModule } from 'src/admin/admin.module';
import { WebchatSplitsModule } from 'src/webchat-splits/webchat-splits.module';
import { QuizSplitsModule } from 'src/quiz-splits/quiz-splits.module';
import { QuizzesModule } from 'src/quizzes/quizzes.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    UsersModule,
    PrismaModule,
    OrganiztionsModule,
    AuthModule,
    BillingCardsModule,
    TransactionsModule,
    WalletsModule,
    ProfileModule,
    BillingModule,
    EmailMarketingModule,
    ProjectSchedulesModule,
    SchedulesModule,
    ProjectSchedulesSentModule,
    DomainsModule,
    WebhooksModule,
    IaIntegrationsModule,
    AgentesModule,
    WebchatsModule,
    WebchatDomainsModule,
    PostsModule,
    SocialAccountsModule,
    AvatarGenerationsModule,
    AvatarsModule,
    SystemSettingsModule,
    AdminModule,
    WebchatSplitsModule,
    QuizSplitsModule,
    QuizzesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
