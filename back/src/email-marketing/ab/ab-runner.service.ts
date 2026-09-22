import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmailAbService } from './ab.service';

// A cada minuto decide os testes A/B cuja janela terminou (envia o vencedor
// para o restante da base).
@Injectable()
export class EmailAbRunner {
  private readonly logger = new Logger(EmailAbRunner.name);
  private running = false;

  constructor(private readonly ab: EmailAbService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.ab.decidePending();
    } catch (e: any) {
      this.logger.error(`A/B tick error: ${String(e?.message ?? e)}`);
    } finally {
      this.running = false;
    }
  }
}
