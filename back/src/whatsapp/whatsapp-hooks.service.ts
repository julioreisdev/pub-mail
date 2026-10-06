import { Injectable, Logger } from '@nestjs/common';

// Barramento simples de eventos internos do WhatsApp. O pipeline de entrada avisa
// "chegou mensagem do cliente" e quem se interessa (o bot, o funil…) assina — sem que o
// pipeline dependa deles (evita dependência circular entre serviços).
//
// Filtros de entrada (`onInboundFilter`) rodam ANTES dos assinantes, de forma síncrona:
// se algum devolve true a mensagem foi "consumida" (ex.: resposta de avaliação,
// palavra de descadastro) e o bot não a vê.
//
// Multi-número: todo evento carrega a sessão (linha de whatsapp_sessions) e `sessionId`;
// `chatId` é o jid (id do WhatsApp) da conversa DENTRO daquele número.
export type InboundEvent = { orgId: string; session: any; sessionId: string; chatId: string; message: any };
export type ServiceClosedEvent = { orgId: string; sessionId: string; chatId: string; userId: string | null; assignedUserId: string | null };

@Injectable()
export class WhatsAppHooks {
  private readonly logger = new Logger(WhatsAppHooks.name);
  private readonly inboundHandlers: ((e: InboundEvent) => void | Promise<void>)[] = [];
  private readonly inboundFilters: ((e: InboundEvent) => boolean)[] = [];
  private readonly closedHandlers: ((e: ServiceClosedEvent) => void | Promise<void>)[] = [];

  onInbound(fn: (e: InboundEvent) => void | Promise<void>) {
    this.inboundHandlers.push(fn);
  }

  onInboundFilter(fn: (e: InboundEvent) => boolean) {
    this.inboundFilters.push(fn);
  }

  onServiceClosed(fn: (e: ServiceClosedEvent) => void | Promise<void>) {
    this.closedHandlers.push(fn);
  }

  emitInbound(e: InboundEvent) {
    for (const f of this.inboundFilters) {
      try {
        if (f(e)) return; // consumida
      } catch (err: any) {
        this.logger.warn(`filtro inbound falhou: ${err?.message || err}`);
      }
    }
    for (const fn of this.inboundHandlers) {
      Promise.resolve()
        .then(() => fn(e))
        .catch((err) => this.logger.warn(`hook inbound falhou: ${err?.message || err}`));
    }
  }

  emitServiceClosed(e: ServiceClosedEvent) {
    for (const fn of this.closedHandlers) {
      Promise.resolve()
        .then(() => fn(e))
        .catch((err) => this.logger.warn(`hook closed falhou: ${err?.message || err}`));
    }
  }
}
