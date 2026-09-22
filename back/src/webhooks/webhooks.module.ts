import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { ResendWebhooksController } from './resend-webhooks.controller';
import { ResendWebhooksService } from './resend-webhooks.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TriggersModule } from '../email-marketing/triggers/triggers.module';

@Module({
    imports: [PrismaModule, TriggersModule],
    controllers: [WebhooksController, ResendWebhooksController],
    providers: [WebhooksService, ResendWebhooksService],
})
export class WebhooksModule { }