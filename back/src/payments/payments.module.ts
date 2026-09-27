import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TelegramModule } from '../telegram/telegram.module';
import { WebchatsModule } from '../webchats/webchats.module';
import { PaymentsSettingsService } from './payments-settings.service';
import { PaymentsSalesService } from './payments-sales.service';
import { PaymentsController } from './payments.controller';
import { PaymentsWebhookController } from './payments-webhook.controller';
import { WebchatAssetsService } from './webchat-assets.service';
import { PublicWebchatAssetsController, WebchatAssetsController } from './webchat-assets.controller';
import { WebchatPaymentsService } from './webchat-payments.service';
import { PublicWebchatPaymentsController } from './public-webchat-payments.controller';
import { WebchatPaymentsRunner } from './webchat-payments.runner';

// Pagamentos da plataforma: gateway por org (compartilhado Telegram/Webchat),
// cobranças PIX do funil do webchat, arquivos protegidos de produto, webhook
// único e vendas unificadas.
@Module({
  imports: [PrismaModule, WebchatsModule, TelegramModule],
  controllers: [
    PaymentsController,
    PaymentsWebhookController,
    WebchatAssetsController,
    PublicWebchatAssetsController,
    PublicWebchatPaymentsController,
  ],
  providers: [PaymentsSettingsService, PaymentsSalesService, WebchatAssetsService, WebchatPaymentsService, WebchatPaymentsRunner],
  exports: [PaymentsSettingsService, WebchatAssetsService],
})
export class PaymentsModule {}
