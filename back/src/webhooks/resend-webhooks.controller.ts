import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { ResendWebhooksService } from './resend-webhooks.service';

// Endpoint público que recebe os eventos do Resend (entrega/bounce/reclamação).
// A autenticidade é garantida pela assinatura Svix (não usa JWT).
@Controller('webhooks')
export class ResendWebhooksController {
  constructor(private readonly service: ResendWebhooksService) {}

  @Post('resend')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async handle(@Req() req: any, @Body() body: any) {
    const rawBody =
      req?.rawBody instanceof Buffer
        ? req.rawBody.toString('utf8')
        : JSON.stringify(body ?? {});
    return this.service.handle(req.headers || {}, rawBody, body);
  }
}
