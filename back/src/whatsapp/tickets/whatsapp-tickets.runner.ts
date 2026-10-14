import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { WhatsAppTicketsService } from './whatsapp-tickets.service';

// Chamados (Fase 6B) — a cada minuto (:50): aviso de prazo, prazo estourado e encerramento automático dos resolvidos.
@Injectable()
export class WhatsAppTicketsRunner {
  private readonly logger = new Logger(WhatsAppTicketsRunner.name);
  private busy = false;

  constructor(private readonly svc: WhatsAppTicketsService) {}

  @Cron('50 * * * * *')
  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.svc.runSla().catch((e) => this.logger.warn(`chamados/prazo: ${e?.message || e}`));
    } finally { this.busy = false; }
  }
}
