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
import { WhatsAppFiltersService } from './whatsapp-filters.service';
import { WhatsAppSchedulesService } from './whatsapp-schedules.service';
import { WhatsAppBroadcastsController, WhatsAppChatController, WhatsAppContactsController, WhatsAppFiltersController, WhatsAppMediaController, WhatsAppSchedulesController, WhatsAppStatusController } from './whatsapp-features.controller';

// Módulo WhatsApp (via OpenWA em Docker, só loopback). @Global p/ o admin apagar a
// sessão ao remover uma organização sem importar o módulo.
@Global()
@Module({
  controllers: [WhatsAppController, WhatsAppWebhookController, PublicWhatsAppMediaController, WhatsAppChatController, WhatsAppContactsController, WhatsAppMediaController, WhatsAppStatusController, WhatsAppBroadcastsController, WhatsAppFiltersController, WhatsAppSchedulesController],
  providers: [OpenWaClient, WhatsAppSessionsService, WhatsAppWatchdogRunner, WhatsAppMediaService, WhatsAppContactsService, WhatsAppInboundService, WhatsAppChatService, WhatsAppPacingService, WhatsAppStatusService, WhatsAppBroadcastsService, WhatsAppBootstrapService, WhatsAppFiltersService, WhatsAppSchedulesService],
  exports: [OpenWaClient, WhatsAppSessionsService, WhatsAppMediaService],
})
export class WhatsAppModule {}
