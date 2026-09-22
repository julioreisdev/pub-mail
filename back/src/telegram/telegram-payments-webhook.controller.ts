import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { TelegramPaymentsService } from './telegram-payments.service';
import { extractWebhookChargeId } from './telegram-payment-providers';

// Webhook público do gateway de pagamento: /telegram/payments/webhook/:provider
// ACK 200 sempre; extrai o id da cobrança e reconfirma o status no gateway antes de entregar.
@ApiExcludeController()
@Controller('telegram/payments/webhook')
export class TelegramPaymentsWebhookController {
  constructor(private readonly service: TelegramPaymentsService) {}

  @Post(':provider')
  @HttpCode(200)
  async receive(@Param('provider') provider: string, @Query() query: any, @Body() body: any) {
    try {
      const chargeId = extractWebhookChargeId(provider, query || {}, body || {});
      if (chargeId) await this.service.handleWebhookCharge(provider, chargeId);
    } catch {
      /* nunca falha o ACK */
    }
    return { ok: true };
  }

  @Get(':provider')
  @HttpCode(200)
  async ping() {
    return { ok: true };
  }
}
