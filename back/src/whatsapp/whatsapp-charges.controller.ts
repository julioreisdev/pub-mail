import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WhatsAppChargesService } from './whatsapp-charges.service';
import { WhatsAppChatService } from './whatsapp-chat.service';
import { WaAccessService } from './wa-access.service';
import { ChargeSettingsDto, CreateChargeDto } from './dto/whatsapp-charges.dto';

// Cobranças do WhatsApp (PIX/boleto) — org-scoped.
// Multi-número: a cobrança sai por um NÚMERO (`session_id`). Listagem filtra pelos números do
// usuário; cobrança de número alheio = 404; `chat_id` no POST = uuid da conversa.
@ApiTags('WhatsApp CRM')
@UseGuards(JwtAuthGuard)
@Controller('whatsapp/charges')
export class WhatsAppChargesController {
  constructor(private readonly charges: WhatsAppChargesService, private readonly chat: WhatsAppChatService, private readonly access: WaAccessService) {}

  /** Cobrança de número alheio = 404 (cobrança antiga sem número é visível a todos). */
  private async guard(req: any, id: string) {
    const sessionId = await this.charges.sessionOf(req.user.organizationId, id);
    if (sessionId) await this.access.assertChat(req.user, { session_id: sessionId });
  }

  @Get('settings') settings(@Req() req: any) { return this.charges.settings(req.user.organizationId); }
  @Put('settings') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') updateSettings(@Req() req: any, @Body() dto: ChargeSettingsDto) { return this.charges.updateSettings(req.user.organizationId, dto); }
  @Post('run-daily') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') @Throttle({ default: { limit: 3, ttl: 60_000 } }) runDaily(@Req() req: any) { return this.charges.runDailyFor(req.user.organizationId); }

  @Get() async list(@Req() req: any, @Query() q: any) { return this.charges.list(req.user.organizationId, q, await this.access.allowedIds(req.user)); }
  @Get(':id') async get(@Req() req: any, @Param('id') id: string) { await this.guard(req, id); return this.charges.get(req.user.organizationId, id); }
  @Post() @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async create(@Req() req: any, @Body() dto: CreateChargeDto) {
    if (dto.chat_id) await this.access.assertChat(req.user, await this.chat.chatRow(req.user.organizationId, dto.chat_id));
    if (dto.session_id) await this.access.assertSession(req.user, dto.session_id);
    return this.charges.create(req.user.organizationId, req.user.userId, dto, 'manual', await this.access.allowedIds(req.user));
  }
  @Post(':id/resend') @Throttle({ default: { limit: 20, ttl: 60_000 } }) async resend(@Req() req: any, @Param('id') id: string) { await this.guard(req, id); return this.charges.resend(req.user.organizationId, id); }
  @Post(':id/check') @Throttle({ default: { limit: 30, ttl: 60_000 } }) async check(@Req() req: any, @Param('id') id: string) { await this.guard(req, id); return this.charges.check(req.user.organizationId, id); }
  @Post(':id/cancel') async cancel(@Req() req: any, @Param('id') id: string) { await this.guard(req, id); return this.charges.cancel(req.user.organizationId, id); }
  @Post(':id/mark-paid') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') async markPaid(@Req() req: any, @Param('id') id: string) { await this.guard(req, id); return this.charges.markPaid(req.user.organizationId, req.user.userId, id); }
}
