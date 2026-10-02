import { Global, Module } from '@nestjs/common';
import { OpenWaClient } from './openwa.client';
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
import { WhatsAppCrmController } from './whatsapp-crm.controller';
import { WhatsAppChargesService } from './whatsapp-charges.service';
import { WhatsAppPipelineService } from './whatsapp-pipeline.service';
import { WhatsAppTasksService } from './whatsapp-tasks.service';
import { WhatsAppNotesService } from './whatsapp-notes.service';
import { WhatsAppNotesController, WhatsAppPipelineController, WhatsAppTasksController } from './whatsapp-pipeline.controller';
import { WhatsAppSystemSender } from './whatsapp-system-send.service';
import { WhatsAppRatingsService } from './whatsapp-ratings.service';
import { WhatsAppOptoutService } from './whatsapp-optout.service';
import { WhatsAppMetricsService } from './whatsapp-metrics.service';
import { WhatsAppMetricsController } from './whatsapp-metrics.controller';
import { WhatsAppChargesController } from './whatsapp-charges.controller';
import { WhatsAppBroadcastsController, WhatsAppChatController, WhatsAppContactsController, WhatsAppFiltersController, WhatsAppMediaController, WhatsAppSchedulesController, WhatsAppStatusController, WhatsAppAttendanceController, WhatsAppContactStatusesController } from './whatsapp-features.controller';

// Módulo WhatsApp (via OpenWA em Docker, só loopback). @Global p/ o admin apagar a
// sessão ao remover uma organização sem importar o módulo.
@Global()
@Module({
  controllers: [WhatsAppController, WhatsAppWebhookController, PublicWhatsAppMediaController, WhatsAppChatController, WhatsAppContactsController, WhatsAppMediaController, WhatsAppStatusController, WhatsAppBroadcastsController, WhatsAppFiltersController, WhatsAppSchedulesController, WhatsAppAttendanceController, WhatsAppBotController, WhatsAppContactStatusesController, WhatsAppCrmController, WhatsAppChargesController, WhatsAppPipelineController, WhatsAppTasksController, WhatsAppNotesController, WhatsAppMetricsController],
  providers: [OpenWaClient, WhatsAppPresenter, WhatsAppChatSyncRunner, WhatsAppAttendanceService, WhatsAppHooks, WhatsAppBotService, WhatsAppContactStatusesService, WhatsAppSessionsService, WhatsAppWatchdogRunner, WhatsAppMediaService, WhatsAppContactsService, WhatsAppInboundService, WhatsAppChatService, WhatsAppPacingService, WhatsAppStatusService, WhatsAppBroadcastsService, WhatsAppBootstrapService, WhatsAppFiltersService, WhatsAppSchedulesService, WhatsAppDataService, WhatsAppCrmService, WhatsAppChargesService, WhatsAppTasksService, WhatsAppNotesService, WhatsAppPipelineService, WhatsAppSystemSender, WhatsAppRatingsService, WhatsAppOptoutService, WhatsAppMetricsService],
  exports: [OpenWaClient, WhatsAppSessionsService, WhatsAppMediaService, WhatsAppPresenter, WhatsAppAttendanceService, WhatsAppBotService, WhatsAppCrmService, WhatsAppChargesService, WhatsAppTasksService, WhatsAppPipelineService],
})
export class WhatsAppModule {}
