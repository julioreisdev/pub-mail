import { Body, Controller, Headers, HttpCode, Param, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { TelegramBotsService } from './telegram-bots.service';
import { TelegramChatService } from './telegram-chat.service';
import { TelegramFlowRuntimeService } from './telegram-flow-runtime.service';
import { TelegramPaymentsRuntimeService } from './telegram-payments.runtime';

// Receptor público dos updates do Telegram (um endpoint por bot: /telegram/webhook/:botId).
// Nesta fase (Configurações) apenas ACK 200 com verificação do secret — o processamento de
// chat_join_request / mensagens / broadcasts pluga aqui nas próximas fases do módulo.
@ApiExcludeController()
@Controller('telegram/webhook')
export class TelegramWebhookController {
  constructor(
    private readonly service: TelegramBotsService,
    private readonly chat: TelegramChatService,
    private readonly flow: TelegramFlowRuntimeService,
    private readonly payments: TelegramPaymentsRuntimeService,
  ) {}

  @Post(':botId')
  @HttpCode(200)
  async receive(
    @Param('botId') botId: string,
    @Headers('x-telegram-bot-api-secret-token') secret: string,
    @Body() update: any,
  ) {
    // Nunca vaza detalhe: responde 200 sempre (o Telegram só precisa do ACK).
    const bot = await this.service.findByIdForWebhook(botId).catch(() => null);
    if (!bot || !bot.webhook_secret || bot.webhook_secret !== secret) {
      return { ok: true }; // secret inválido → ignora silenciosamente
    }
    // Grava DMs/mensagens de grupo + descobre grupos + mantém o chat de teste.
    await this.chat.captureUpdate({ id: bot.id, organization_id: bot.organization_id }, update);
    // Executa o fluxo inicial (se ativo): /start, botões, respostas por texto.
    await this.flow.handleUpdate({ id: bot.id, organization_id: bot.organization_id }, update);
    // Pagamentos: comando /vip|/planos + botões pay:/paycheck:/paycancel:
    await this.payments.handleUpdate({ id: bot.id, organization_id: bot.organization_id }, update);
    return { ok: true };
  }
}
