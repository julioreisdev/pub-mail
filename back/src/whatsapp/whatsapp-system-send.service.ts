import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenWaClient } from './openwa.client';
import { WhatsAppSessionsService } from './whatsapp-sessions.service';
import { WhatsAppInboundService } from './whatsapp-inbound.service';
import { WhatsAppPresenter } from './whatsapp-presenter.service';

// ============================================================================
// Mensagens "do sistema" (pesquisa de satisfação, confirmação de descadastro):
// texto simples, sem assinatura de atendente, marcadas com `extra.system` para
// o pipeline de entrada não confundir com resposta pelo celular.
// ============================================================================

@Injectable()
export class WhatsAppSystemSender {
  private readonly logger = new Logger(WhatsAppSystemSender.name);
  constructor(private readonly prisma: PrismaService, private readonly openwa: OpenWaClient, private readonly sessions: WhatsAppSessionsService, private readonly inbound: WhatsAppInboundService, private readonly presenter: WhatsAppPresenter) {}

  /** Envia texto; devolve false se não há sessão pronta ou o gateway falhou (nunca lança). */
  async text(orgId: string, chatId: string, text: string, mark: Record<string, unknown>): Promise<boolean> {
    const body = String(text || '').trim();
    if (!body) return false;
    try {
      const row = await this.sessions.row(orgId);
      if (!row?.openwa_session_id || row.status !== 'ready') return false;
      const r: any = await this.openwa.sendText(row.openwa_session_id, chatId, body);
      const at = r?.timestamp ? new Date(Number(r.timestamp) * 1000) : new Date();
      const waId = String(r?.messageId || `sys_${Date.now()}_${Math.random().toString(36).slice(2)}`);
      const extra = { system: true, ...mark };
      await this.prisma.whatsapp_messages
        .create({ data: { organization_id: orgId, chat_id: chatId, wa_message_id: waId, direction: 'OUT', type: 'text', body, ack: 1, timestamp: at, extra } })
        .catch(async (e: any) => {
          if (e?.code === 'P2002') await this.prisma.whatsapp_messages.update({ where: { organization_id_wa_message_id: { organization_id: orgId, wa_message_id: waId } }, data: { extra } }).catch(() => undefined);
        });
      await this.inbound.bumpChat(orgId, chatId, { type: 'text', body, direction: 'OUT', at });
      this.presenter.message(orgId, { waId });
      return true;
    } catch (e: any) {
      this.logger.warn(`mensagem de sistema não enviada (${chatId}): ${e?.message || e}`);
      return false;
    }
  }
}
