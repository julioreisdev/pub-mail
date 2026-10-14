import { WhatsAppNotifyBridge } from './whatsapp-notify.bridge';
import { Global, Module } from '@nestjs/common';
import { OpenWaClient } from './openwa.client';
import { WaAccessService } from './wa-access.service';
import { WhatsAppSessionsService } from './whatsapp-sessions.service';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { WhatsAppWatchdogRunner } from './whatsapp-watchdog.runner';
import { WhatsAppMediaService } from './whatsapp-media.service';
import { PublicWhatsAppMediaController } from './public-whatsapp-media.controller';
import { WhatsAppContactsService } from './whatsapp-contacts.service';
import { WhatsAppInboundService } from './whatsapp-inbound.service';
import { WhatsAppChatService } from './whatsapp-chat.service';
import { WhatsAppPacingService } from './whatsapp-pacing.service';
import { WhatsAppStatusService } from './whatsapp-status.service';
import { WhatsAppBroadcastsService } from './whatsapp-broadcasts.service';
import { WhatsAppBootstrapService } from './whatsapp-bootstrap.service';
import { WhatsAppDataService } from './whatsapp-data.service';
import { WhatsAppFiltersService } from './whatsapp-filters.service';
import { WhatsAppSchedulesService } from './whatsapp-schedules.service';
import { WhatsAppPresenter } from './whatsapp-presenter.service';
import { WhatsAppChatSyncRunner } from './whatsapp-chat-sync.runner';
import { WhatsAppAttendanceService } from './whatsapp-attendance.service';
import { WhatsAppHooks } from './whatsapp-hooks.service';
import { WhatsAppContactStatusesService } from './whatsapp-contact-statuses.service';
import { WhatsAppBotService } from './bot/whatsapp-bot.service';
import { WhatsAppBotController } from './bot/whatsapp-bot.controller';
import { WhatsAppCrmService } from './whatsapp-crm.service';
import { WhatsAppIdentityService } from './whatsapp-identity.service';
import { WhatsAppCrmController } from './whatsapp-crm.controller';
import { WhatsAppChargesService } from './whatsapp-charges.service';
import { WhatsAppSubscriptionsService } from './whatsapp-subscriptions.service';
import { WhatsAppOutboxService } from './whatsapp-outbox.service';
import { WhatsAppCouponsController, WhatsAppSubscriptionsController } from './whatsapp-subscriptions.controller';
import { WhatsAppPipelineService } from './whatsapp-pipeline.service';
import { WhatsAppTasksService } from './whatsapp-tasks.service';
import { WhatsAppNotesService } from './whatsapp-notes.service';
import { WhatsAppNotesController, WhatsAppPipelineController, WhatsAppTasksController } from './whatsapp-pipeline.controller';
import { WhatsAppSystemSender } from './whatsapp-system-send.service';
import { WhatsAppRatingsService } from './whatsapp-ratings.service';
import { WhatsAppOptoutService } from './whatsapp-optout.service';
import { WhatsAppMetricsService } from './whatsapp-metrics.service';
import { WhatsAppMetricsController } from './whatsapp-metrics.controller';
import { WhatsAppChargesController, WhatsAppPaymentMethodsController } from './whatsapp-charges.controller';
import { PublicPayController } from './public-pay.controller';
import { WhatsAppBroadcastsController, WhatsAppChatController, WhatsAppContactsController, WhatsAppFiltersController, WhatsAppMediaController, WhatsAppSchedulesController, WhatsAppStatusController, WhatsAppAttendanceController, WhatsAppContactStatusesController } from './whatsapp-features.controller';
import { WhatsAppLinkPreviewController } from './whatsapp-link-preview.controller';
import { WhatsAppLinkPreviewService } from './whatsapp-link-preview.service';
import { WaEncryptionMigrator } from './crypto/wa-encryption.migrator';
import { WhatsAppEntitlementsService } from './whatsapp-entitlements.service';
import { WhatsAppEntitlementsController, WhatsAppGroupAdminController } from './whatsapp-entitlements.controller';
import { WhatsAppSchedulingService } from './scheduling/whatsapp-scheduling.service';
import { WhatsAppSchedulingRunner } from './scheduling/whatsapp-scheduling.runner';
import { WhatsAppSchedulingController } from './scheduling/whatsapp-scheduling.controller';
import { PublicCalendarController } from './scheduling/public-calendar.controller';
import { WhatsAppTicketsService } from './tickets/whatsapp-tickets.service';
import { WhatsAppCustomFieldsService } from './whatsapp-custom-fields.service';
import { WhatsAppUnitsService } from './whatsapp-units.service';
import { WhatsAppUnitsController } from './whatsapp-units.controller';
import { WhatsAppOutboxController } from './whatsapp-outbox.controller';
import { WhatsAppImportService } from './whatsapp-import.service';
import { WhatsAppImportController } from './whatsapp-import.controller';
import { WhatsAppPrivacyService } from './whatsapp-privacy.service';
import { WhatsAppPrivacyController } from './whatsapp-privacy.controller';
import { WhatsAppCustomerPickController } from './whatsapp-customer-pick.controller';
import { WhatsAppOrdersService } from './orders/whatsapp-orders.service';
import { WhatsAppOrdersController } from './orders/whatsapp-orders.controller';
import { WhatsAppFinanceService } from './finance/whatsapp-finance.service';
import { WhatsAppFinanceController } from './finance/whatsapp-finance.controller';
import { WhatsAppTemplatesService } from './templates/whatsapp-templates.service';
import { WhatsAppTemplatesController } from './templates/whatsapp-templates.controller';
import { WhatsAppTicketsRunner } from './tickets/whatsapp-tickets.runner';
import { WhatsAppTicketsController } from './tickets/whatsapp-tickets.controller';

// Módulo WhatsApp (via OpenWA em Docker, só loopback). @Global p/ o admin apagar a
// sessão ao remover uma organização sem importar o módulo.
@Global()
@Module({
  controllers: [WhatsAppController, WhatsAppWebhookController, PublicWhatsAppMediaController, WhatsAppChatController, WhatsAppContactsController, WhatsAppMediaController, WhatsAppStatusController, WhatsAppBroadcastsController, WhatsAppFiltersController, WhatsAppSchedulesController, WhatsAppAttendanceController, WhatsAppBotController, WhatsAppContactStatusesController, WhatsAppCrmController, WhatsAppChargesController, WhatsAppPaymentMethodsController, PublicPayController, WhatsAppSubscriptionsController, WhatsAppCouponsController, WhatsAppPipelineController, WhatsAppTasksController, WhatsAppNotesController, WhatsAppMetricsController, WhatsAppLinkPreviewController, WhatsAppEntitlementsController, WhatsAppGroupAdminController, WhatsAppSchedulingController, PublicCalendarController, WhatsAppTicketsController, WhatsAppUnitsController, WhatsAppOrdersController, WhatsAppFinanceController, WhatsAppTemplatesController, WhatsAppOutboxController, WhatsAppImportController, WhatsAppPrivacyController, WhatsAppCustomerPickController],
  providers: [OpenWaClient, WaAccessService, WhatsAppPresenter, WhatsAppChatSyncRunner, WhatsAppAttendanceService, WhatsAppHooks, WhatsAppBotService, WhatsAppContactStatusesService, WhatsAppSessionsService, WhatsAppWatchdogRunner, WhatsAppMediaService, WhatsAppContactsService, WhatsAppInboundService, WhatsAppChatService, WhatsAppPacingService, WhatsAppStatusService, WhatsAppBroadcastsService, WhatsAppBootstrapService, WhatsAppFiltersService, WhatsAppSchedulesService, WhatsAppDataService, WhatsAppIdentityService, WhatsAppCrmService, WhatsAppOutboxService, WhatsAppSubscriptionsService, WhatsAppChargesService, WhatsAppTasksService, WhatsAppNotesService, WhatsAppPipelineService, WhatsAppSystemSender, WhatsAppRatingsService, WhatsAppOptoutService, WhatsAppMetricsService, WhatsAppLinkPreviewService, WaEncryptionMigrator, WhatsAppNotifyBridge, WhatsAppEntitlementsService, WhatsAppSchedulingService, WhatsAppSchedulingRunner, WhatsAppTicketsService, WhatsAppTicketsRunner, WhatsAppCustomFieldsService, WhatsAppUnitsService, WhatsAppOrdersService, WhatsAppFinanceService, WhatsAppTemplatesService, WhatsAppImportService, WhatsAppPrivacyService],
  // Fase 5: org-api e org-webhooks usam hooks, CRM, assinaturas, cobranças, fila, contatos e o motor de acesso
  exports: [OpenWaClient, WaAccessService, WhatsAppSessionsService, WhatsAppMediaService, WhatsAppPresenter, WhatsAppAttendanceService, WhatsAppBotService, WhatsAppIdentityService, WhatsAppCrmService, WhatsAppOutboxService, WhatsAppSubscriptionsService, WhatsAppChargesService, WhatsAppTasksService, WhatsAppPipelineService, WhatsAppHooks, WhatsAppContactsService, WhatsAppEntitlementsService, WhatsAppChatService, WhatsAppOptoutService, WhatsAppSchedulingService, WhatsAppTicketsService, WhatsAppCustomFieldsService, WhatsAppUnitsService, WhatsAppOrdersService],
})
export class WhatsAppModule {}
