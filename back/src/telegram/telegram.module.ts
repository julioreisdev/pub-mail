import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TelegramBotsController } from './telegram-bots.controller';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramChatController } from './telegram-chat.controller';
import { TelegramFlowsController } from './telegram-flows.controller';
import { TelegramAssetsController } from './telegram-assets.controller';
import { TelegramAutomationsController } from './telegram-automations.controller';
import { TelegramBotsService } from './telegram-bots.service';
import { TelegramChatService } from './telegram-chat.service';
import { TelegramFlowsService } from './telegram-flows.service';
import { TelegramFlowRuntimeService } from './telegram-flow-runtime.service';
import { TelegramAssetsService } from './telegram-assets.service';
import { TelegramAutomationsService } from './telegram-automations.service';
import { TelegramAutomationsRunner } from './telegram-automations.runner';
import { TelegramBroadcastsController } from './telegram-broadcasts.controller';
import { TelegramBroadcastsService } from './telegram-broadcasts.service';
import { TelegramBroadcastsRunner } from './telegram-broadcasts.runner';
import { TelegramRotatorsController } from './telegram-rotators.controller';
import { TelegramRotatorsService } from './telegram-rotators.service';
import { TelegramRotatorsRunner } from './telegram-rotators.runner';
import { TelegramPaymentsController } from './telegram-payments.controller';
import { TelegramPaymentsWebhookController } from './telegram-payments-webhook.controller';
import { TelegramPaymentsService } from './telegram-payments.service';
import { TelegramPaymentsRuntimeService } from './telegram-payments.runtime';
import { TelegramPaymentsRunner } from './telegram-payments.runner';

@Module({
  imports: [PrismaModule],
  controllers: [
    TelegramBotsController,
    TelegramChatController,
    TelegramFlowsController,
    TelegramAssetsController,
    TelegramAutomationsController,
    TelegramBroadcastsController,
    TelegramRotatorsController,
    TelegramPaymentsController,
    TelegramPaymentsWebhookController,
    TelegramWebhookController,
  ],
  providers: [
    TelegramBotsService,
    TelegramChatService,
    TelegramFlowsService,
    TelegramFlowRuntimeService,
    TelegramAssetsService,
    TelegramAutomationsService,
    TelegramAutomationsRunner,
    TelegramBroadcastsService,
    TelegramBroadcastsRunner,
    TelegramRotatorsService,
    TelegramRotatorsRunner,
    TelegramPaymentsService,
    TelegramPaymentsRuntimeService,
    TelegramPaymentsRunner,
  ],
  exports: [TelegramBotsService, TelegramChatService, TelegramFlowsService, TelegramFlowRuntimeService],
})
export class TelegramModule {}
