import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AccessService } from './access.service';
import { PlatformPaymentsService } from './platform-payments.service';

// Rede de segurança das assinaturas: reconcilia PIX a cada minuto e expira
// acessos vencidos a cada hora (o estado ao vivo já bloqueia antes disso).
@Injectable()
export class PlatformBillingRunner {
  private readonly logger = new Logger(PlatformBillingRunner.name);
  private running = false;

  constructor(private readonly payments: PlatformPaymentsService, private readonly access: AccessService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.payments.reconcilePending();
    } catch (e: any) {
      this.logger.warn(`reconcile falhou: ${e?.message || e}`);
    } finally {
      this.running = false;
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async expire() {
    try {
      await this.access.expireDue();
    } catch (e: any) {
      this.logger.warn(`expireDue falhou: ${e?.message || e}`);
    }
  }
}
