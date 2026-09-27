import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WebchatPaymentsService } from './webchat-payments.service';

// Rede de segurança: expira PIX vencidos e reconfere pendentes a cada minuto.
@Injectable()
export class WebchatPaymentsRunner {
  private readonly logger = new Logger(WebchatPaymentsRunner.name);
  private running = false;

  constructor(private readonly service: WebchatPaymentsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.service.reconcilePending();
    } catch (e: any) {
      this.logger.warn(`reconcile falhou: ${e?.message || e}`);
    } finally {
      this.running = false;
    }
  }
}
