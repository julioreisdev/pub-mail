import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AccessService } from './access.service';
import { AccessInterceptor } from './access.interceptor';
import { AccessController } from './access.controller';
import { AdminBillingController } from './admin-billing.controller';
import { PlatformBillingSettingsService } from './platform-billing-settings.service';
import { PlatformPaymentsService } from './platform-payments.service';
import { PlatformBillingRunner } from './platform-billing.runner';
import { SubscriptionsService } from './subscriptions.service';

// Assinaturas do Pub Mail (acesso vendido pelo superadmin) + módulos por usuário.
// @Global: AccessService é consumido por auth (/me), admin, webhook único, runners
// e rotas públicas (webchat/quiz) sem precisar importar o módulo em cada um.
@Global()
@Module({
  controllers: [AccessController, AdminBillingController],
  providers: [
    AccessService,
    PlatformBillingSettingsService,
    PlatformPaymentsService,
    SubscriptionsService,
    PlatformBillingRunner,
    { provide: APP_INTERCEPTOR, useClass: AccessInterceptor },
  ],
  exports: [AccessService, PlatformPaymentsService, PlatformBillingSettingsService],
})
export class PlatformBillingModule {}
