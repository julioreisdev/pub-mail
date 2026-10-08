import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WhatsAppLinkPreviewService } from './whatsapp-link-preview.service';

// Prévia de link para os balões do chat: GET /whatsapp/link-preview?url=<link ou domínio>
@ApiTags('WhatsApp')
@UseGuards(JwtAuthGuard)
@Controller('whatsapp')
export class WhatsAppLinkPreviewController {
  constructor(private readonly previews: WhatsAppLinkPreviewService) {}

  @Get('link-preview')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  get(@Query('url') url: string) {
    return this.previews.get(url);
  }
}
