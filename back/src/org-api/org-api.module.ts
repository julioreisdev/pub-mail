import { Module } from '@nestjs/common';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { OrgApiKeysService } from './org-api-keys.service';
import { OrgApiV1Service } from './org-api-v1.service';
import { OrgApiKeyGuard } from './api-key.guard';
import { OrgApiKeysController } from './org-api-keys.controller';
import { OrgApiV1Controller } from './org-api-v1.controller';

// API pública da organização (Fase 5): chaves (painel `/org/api-keys`) + rotas `/api/v1/whatsapp/...`.
// PrismaModule e PlatformBillingModule (AccessService) são globais.
@Module({
  imports: [WhatsAppModule],
  controllers: [OrgApiKeysController, OrgApiV1Controller],
  providers: [OrgApiKeysService, OrgApiV1Service, OrgApiKeyGuard],
  exports: [OrgApiKeysService],
})
export class OrgApiModule {}
