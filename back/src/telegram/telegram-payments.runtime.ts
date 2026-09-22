import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramPaymentsService } from './telegram-payments.service';
import * as tg from './telegram-api.util';

type Bot = { id: string; organization_id: string };

// Chamado pelo webhook. Best-effort, nunca lança.
// Trata: comando /vip|/planos|/comprar (lista planos) e callbacks pay:/paycheck:/paycancel:
@Injectable()
export class TelegramPaymentsRuntimeService {
  private readonly logger = new Logger(TelegramPaymentsRuntimeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly service: TelegramPaymentsService,
  ) {}

  private async token(botId: string): Promise<string | null> {
    const bot = await this.prisma.telegram_bots.findUnique({ where: { id: botId }, select: { token: true, status: true } });
    return bot && bot.status !== 'BANNED' ? bot.token : null;
  }

  async handleUpdate(bot: Bot, update: any): Promise<void> {
    try {
      const m = update.message;
      if (m && m.chat?.type === 'private') {
        const text = String(m.text || '').trim().toLowerCase();
        if (/^\/(vip|planos|comprar)(@\w+)?(\s|$)/.test(text)) {
          await this.service.sendPlanList(bot, m.chat.id);
          return;
        }
      }

      const cq = update.callback_query;
      if (cq && typeof cq.data === 'string') {
        const data = cq.data as string;
        const chatId = cq.message?.chat?.id ?? cq.from?.id;
        if (!data.startsWith('pay:') && !data.startsWith('paycheck:') && !data.startsWith('paycancel:')) return;

        const token = await this.token(bot.id);

        if (data.startsWith('pay:')) {
          // o PIX SEMPRE vai pro privado do usuário (funciona mesmo se o botão está num grupo/canal)
          const inGroup = cq.message?.chat?.type && cq.message.chat.type !== 'private';
          if (token) await tg.answerCallbackQuery(token, cq.id, inGroup ? '💎 Te enviei o PIX no privado do bot.' : undefined).catch(() => undefined);
          await this.service.startCharge(bot, data.slice(4), cq.from.id, cq.from.id);
        } else if (data.startsWith('paycheck:')) {
          const pid = data.slice(9);
          const status = await this.service.checkPayment(pid);
          if (status === 'PAID') {
            if (token) await tg.answerCallbackQuery(token, cq.id, '✅ Pagamento confirmado! Acesso liberado 🎉').catch(() => undefined);
          } else {
            // toast curto + mensagem completa avisando que não caiu (com botão de verificar/gerar de novo)
            if (token) await tg.answerCallbackQuery(token, cq.id, status === 'EXPIRED' ? '⌛ Cobrança expirada.' : '⏳ Ainda não caiu — veja a mensagem abaixo.').catch(() => undefined);
            await this.service.sendNotPaidNudge(pid, status === 'EXPIRED').catch(() => undefined);
          }
        } else if (data.startsWith('paycancel:')) {
          if (token) await tg.answerCallbackQuery(token, cq.id, 'Cobrança cancelada.').catch(() => undefined);
          await this.service.cancelPayment(data.slice(10));
        }
      }
    } catch (e: any) {
      this.logger.warn(`payments handleUpdate falhou: ${e?.message || e}`);
    }
  }
}
