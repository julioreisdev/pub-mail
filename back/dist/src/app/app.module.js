"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const users_module_1 = require("../users/users.module");
const prisma_module_1 = require("../prisma/prisma.module");
const organiztions_module_1 = require("../organiztions/organiztions.module");
const auth_module_1 = require("../auth/auth.module");
const billing_cards_module_1 = require("../billing_cards/billing_cards.module");
const transactions_module_1 = require("../transactions/transactions.module");
const wallets_module_1 = require("../wallets/wallets.module");
const profile_module_1 = require("../profile/profile.module");
const billing_module_1 = require("../billing/billing.module");
const email_marketing_module_1 = require("../email-marketing/email-marketing.module");
const project_schedules_module_1 = require("../project_schedules/project_schedules.module");
const schedules_module_1 = require("../cron-jobs/schedules.module");
const project_schedules_sent_module_1 = require("../project-schedules-sent/project-schedules-sent.module");
const domains_module_1 = require("../domains/domains.module");
const webhooks_module_1 = require("../webhooks/webhooks.module");
const ia_integrations_module_1 = require("../ia-integrations/ia-integrations.module");
const agentes_module_1 = require("../agentes/agentes.module");
const webchats_module_1 = require("../webchats/webchats.module");
const webchat_domains_module_1 = require("../webchat-domains/webchat-domains.module");
const posts_module_1 = require("../posts/posts.module");
const social_accounts_module_1 = require("../social-accounts/social-accounts.module");
const avatar_generations_module_1 = require("../avatar-generations/avatar-generations.module");
const avatars_module_1 = require("../avatars/avatars.module");
const system_settings_module_1 = require("../system-settings/system-settings.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            schedule_1.ScheduleModule.forRoot(),
            config_1.ConfigModule.forRoot({
                isGlobal: true,
            }),
            users_module_1.UsersModule,
            prisma_module_1.PrismaModule,
            organiztions_module_1.OrganiztionsModule,
            auth_module_1.AuthModule,
            billing_cards_module_1.BillingCardsModule,
            transactions_module_1.TransactionsModule,
            wallets_module_1.WalletsModule,
            profile_module_1.ProfileModule,
            billing_module_1.BillingModule,
            email_marketing_module_1.EmailMarketingModule,
            project_schedules_module_1.ProjectSchedulesModule,
            schedules_module_1.SchedulesModule,
            project_schedules_sent_module_1.ProjectSchedulesSentModule,
            domains_module_1.DomainsModule,
            webhooks_module_1.WebhooksModule,
            ia_integrations_module_1.IaIntegrationsModule,
            agentes_module_1.AgentesModule,
            webchats_module_1.WebchatsModule,
            webchat_domains_module_1.WebchatDomainsModule,
            posts_module_1.PostsModule,
            social_accounts_module_1.SocialAccountsModule,
            avatar_generations_module_1.AvatarGenerationsModule,
            avatars_module_1.AvatarsModule,
            system_settings_module_1.SystemSettingsModule,
        ],
        controllers: [],
        providers: [],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map