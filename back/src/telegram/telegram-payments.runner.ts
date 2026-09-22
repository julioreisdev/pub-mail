import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TelegramPaymentsService } from './telegram-payments.service';

// Rede de segurança do webhook: 1x/min reconfere as cobranças PENDING no gateway
// (entrega se pagou) e expira as vencidas.
@Injectable()
export class TelegramPaymentsRunner {
  private readonly logger = new Logger(TelegramPaymentsRunner.name);
  private running = false;

  constructor(private readonly service: TelegramPaymentsService) {}

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

  private runningSubs = false;

  // Assinaturas: lembra renovação e expira (remove do VIP) a cada 10 min.
  @Cron(CronExpression.EVERY_10_MINUTES)
  async subs() {
    if (this.runningSubs) return;
    this.runningSubs = true;
    try {
      await this.service.processSubscriptions();
    } catch (e: any) {
      this.logger.warn(`subscriptions falhou: ${e?.message || e}`);
    } finally {
      this.runningSubs = false;
    }
  }
}
