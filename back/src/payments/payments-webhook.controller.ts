import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { TelegramPaymentsService } from '../telegram/telegram-payments.service';
import { WebchatPaymentsService } from './webchat-payments.service';
import { extractWebhookChargeId } from './pix-providers';
import { PlatformPaymentsService } from '../platform-billing/platform-payments.service';
import { WhatsAppBotService } from '../whatsapp/bot/whatsapp-bot.service';
import { WhatsAppChargesService } from '../whatsapp/whatsapp-charges.service';

// Webhook ÚNICO da plataforma (o Mercado Pago só aceita uma URL por aplicação):
// procura a cobrança no Webchat e no Telegram e reconfere o status na API do
// gateway antes de entregar — webhook forjado não fura. ACK 200 sempre.
// Também recebe as ASSINATURAS do Pub Mail (gateway do superadmin): mesma URL,
// a cobrança é achada pelo charge id em `platform_payments`.
@ApiExcludeController()
@Public()
@SkipThrottle() // webhook do gateway — sem rate limit (A-13)
@Controller('payments/webhook')
export class PaymentsWebhookController {
  constructor(
    private readonly webchat: WebchatPaymentsService,
    private readonly telegram: TelegramPaymentsService,
    private readonly platform: PlatformPaymentsService,
    private readonly whatsappBot: WhatsAppBotService,
    private readonly whatsappCharges: WhatsAppChargesService,
  ) {}

  @Post(':provider')
  @HttpCode(200)
  async receive(@Param('provider') provider: string, @Query() query: any, @Body() body: any, @Headers('asaas-access-token') asaasToken?: string) {
    try {
      const chargeId = extractWebhookChargeId(provider, query || {}, body || {});
      // Asaas (Fase 4): só as Cobranças do WhatsApp usam; o token do webhook é conferido por organização
      if (provider === 'asaas') {
        if (chargeId) await this.whatsappCharges.handleAsaasWebhook(chargeId, asaasToken, query?.o ? String(query.o) : null).catch(() => false);
        return { ok: true };
      }
      if (chargeId) {
        // Ordem: webchat → telegram → bot do WhatsApp → cobranças do WhatsApp (CRM) → assinaturas da plataforma (gateway do superadmin).
        const found =
          (await this.webchat.handleWebhookCharge(provider, chargeId)) ||
          (await this.telegram.handleWebhookCharge(provider, chargeId)) ||
          (await this.whatsappBot.handleWebhookCharge(provider, chargeId).catch(() => false)) ||
          (await this.whatsappCharges.handleWebhookCharge(provider, chargeId).catch(() => false));
        if (!found) await this.platform.handleWebhookCharge(provider, chargeId);
      }
    } catch {
      /* nunca falha o ACK */
    }
    return { ok: true };
  }

  @Get(':provider')
  ping() {
    return { ok: true };
  }
}
