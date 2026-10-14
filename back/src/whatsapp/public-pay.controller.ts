import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Public } from '../auth/public.decorator';
import { WhatsAppChargesService } from './whatsapp-charges.service';

class PayCardDto {
  @IsOptional() @IsInt() @Min(1) @Max(12) installments?: number;
}

// Link público de pagamento de uma cobrança do WhatsApp (Fase 4): https://<painel>/pay/<token>.
// O token (24 caracteres aleatórios) é a única credencial — a página mostra só valor, descrição, vencimento e
// os meios (PIX, boleto, cartão). O cartão é digitado na página segura do gateway, nunca aqui.
@ApiExcludeController()
@Public()
@Controller('public/pay')
export class PublicPayController {
  constructor(private readonly charges: WhatsAppChargesService) {}

  @Get(':token') @Throttle({ default: { limit: 60, ttl: 60_000 } })
  view(@Param('token') token: string) { return this.charges.publicView(token); }

  @Post(':token/check') @Throttle({ default: { limit: 30, ttl: 60_000 } })
  check(@Param('token') token: string) { return this.charges.publicCheck(token); }

  @Post(':token/card') @Throttle({ default: { limit: 10, ttl: 60_000 } })
  card(@Param('token') token: string, @Body() dto: PayCardDto) { return this.charges.publicCard(token, dto?.installments); }
}
