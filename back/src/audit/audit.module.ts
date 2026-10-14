import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditController, OrgAuditController } from './audit.controller';
import { OrgAuditInterceptor } from './org-audit.interceptor';
import { OrgAuditService } from './org-audit.service';

// Auditoria da organização (Fase 8, contrato §12.4). @Global: o serviço de privacidade (LGPD) e quem mais
// precisar gravar um registro explícito injeta o `OrgAuditService` sem importar o módulo.
// O interceptor global só grava DEPOIS de uma resposta 2xx — a ordem em relação ao AccessInterceptor não importa.
@Global()
@Module({
  controllers: [AuditController, OrgAuditController],
  providers: [OrgAuditService, { provide: APP_INTERCEPTOR, useClass: OrgAuditInterceptor }],
  exports: [OrgAuditService],
})
export class AuditModule {}
