import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { WhatsAppSchedulingService } from './whatsapp-scheduling.service';

// Agenda (Fase 6) — rotinas por minuto. Cada etapa pula org sem acesso ativo (dentro do serviço) e nunca
// derruba a seguinte. Textos ao cliente vão pela fila (`whatsapp_outbox`), com o ritmo de cada número.
//   :20 → reservas sem pagamento vencidas · lembretes D-1 (no horário da org, BRT) e H-2
//   :40 → falta automática / conclusão automática · lista de espera (ofertas vencidas, novas ofertas)
@Injectable()
export class WhatsAppSchedulingRunner {
  private readonly logger = new Logger(WhatsAppSchedulingRunner.name);
  private busyA = false;
  private busyB = false;

  constructor(private readonly svc: WhatsAppSchedulingService) {}

  @Cron('20 * * * * *')
  async tickA() {
    if (this.busyA) return;
    this.busyA = true;
    try {
      await this.svc.runExpireUnpaid().catch((e) => this.logger.warn(`agenda/expirar: ${e?.message || e}`));
      await this.svc.runReminders().catch((e) => this.logger.warn(`agenda/lembretes: ${e?.message || e}`));
    } finally { this.busyA = false; }
  }

  @Cron('40 * * * * *')
  async tickB() {
    if (this.busyB) return;
    this.busyB = true;
    try {
      await this.svc.runNoShowAndComplete().catch((e) => this.logger.warn(`agenda/falta: ${e?.message || e}`));
      await this.svc.runWaitlist().catch((e) => this.logger.warn(`agenda/espera: ${e?.message || e}`));
    } finally { this.busyB = false; }
  }
}
