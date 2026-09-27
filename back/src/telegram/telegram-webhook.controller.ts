import { Body, Controller, Headers, HttpCode, Logger, Param, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { TelegramBotsService } from './telegram-bots.service';
import { TelegramChatService } from './telegram-chat.service';
import { TelegramFlowRuntimeService } from './telegram-flow-runtime.service';
import { TelegramPaymentsRuntimeService } from './telegram-payments.runtime';
import { AccessService } from '../platform-billing/access.service';

// Dedupe de updates: o Telegram reentrega o mesmo update_id quando não recebe o ACK a tempo
// (ou em falha de rede) — sem isso um /start repetido reinicia o drip e um pay: gera outra
// cobrança. LRU simples em memória (Map preserva ordem de inserção), chave bot:update_id.
const SEEN_MAX = 5000;

// Receptor público dos updates do Telegram (um endpoint por bot: /telegram/webhook/:botId).
// Confere o secret, deduplica por update_id, ACKa 200 na hora e processa em background
// (captura de chat + fluxo inicial + pagamentos) — o Telegram só precisa do ACK rápido; os
// handlers têm sleeps (typing/delay) que não podem segurar a resposta.
@ApiExcludeController()
@SkipThrottle() // updates do Telegram — sem rate limit (A-13)
@Controller('telegram/webhook')
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);
  private readonly seen = new Map<string, true>();

  constructor(
    private readonly service: TelegramBotsService,
    private readonly chat: TelegramChatService,
    private readonly flow: TelegramFlowRuntimeService,
    private readonly payments: TelegramPaymentsRuntimeService,
    private readonly access: AccessService,
  ) {}

  // true = já vimos este update (reentrega) → ignorar.
  private markSeen(botId: string, updateId: any): boolean {
    if (updateId === undefined || updateId === null) return false; // sem id → não dá pra dedupar
    const key = `${botId}:${updateId}`;
    if (this.seen.has(key)) return true;
    this.seen.set(key, true);
    if (this.seen.size > SEEN_MAX) {
      // remove o mais antigo (primeira chave inserida)
      const oldest = this.seen.keys().next().value;
      if (oldest !== undefined) this.seen.delete(oldest);
    }
    return false;
  }

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
    if (this.markSeen(bot.id, update?.update_id)) return { ok: true }; // reentrega → já processado

    const ctx = { id: bot.id, organization_id: bot.organization_id };
    // ACK imediato; processamento em background (cada handler é best-effort e não lança).
    setImmediate(() => {
      this.process(ctx, update).catch((e) => this.logger.warn(`webhook ${bot.id} falhou: ${e?.message || e}`));
    });
    return { ok: true };
  }

  private async process(bot: { id: string; organization_id: string }, update: any) {
    // Grava DMs/mensagens de grupo + descobre grupos + mantém o chat de teste.
    await this.chat.captureUpdate(bot, update);
    // Assinatura da org vencida/pendente/bloqueada → só registra a mensagem; bot não responde.
    if (!(await this.access.isOrgActive(bot.organization_id))) {
      this.logger.debug(`pulando org=${bot.organization_id}: acesso inativo`);
      return;
    }
    // Executa o fluxo inicial (se ativo): /start, botões, respostas por texto.
    await this.flow.handleUpdate(bot, update);
    // Pagamentos: comando /vip|/planos + botões pay:/paycheck:/paycancel:
    await this.payments.handleUpdate(bot, update);
  }
}
