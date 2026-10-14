import { Module } from '@nestjs/common';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { OrgWebhooksService } from './org-webhooks.service';
import { OrgWebhooksWorker } from './org-webhooks.worker';
import { OrgWebhooksBridge } from './org-webhooks.bridge';
import { OrgWebhooksController } from './org-webhooks.controller';

// Webhooks de saída da organização (Fase 5): painel `/org/webhooks`, fila de entregas e ponte dos hooks internos.
@Module({
  imports: [WhatsAppModule],
  controllers: [OrgWebhooksController],
  providers: [OrgWebhooksService, OrgWebhooksWorker, OrgWebhooksBridge],
  exports: [OrgWebhooksService],
})
export class OrgWebhooksModule {}
