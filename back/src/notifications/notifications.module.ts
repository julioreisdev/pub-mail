import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';

// Global: qualquer módulo (WhatsApp, equipe…) injeta o NotificationsService sem importar nada.
// Este módulo NÃO importa o WhatsApp — a ponte com os eventos dele fica dentro do WhatsAppModule.
@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, PushService],
  exports: [NotificationsService, PushService],
})
export class NotificationsModule {}
