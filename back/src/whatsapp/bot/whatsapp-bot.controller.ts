import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { WhatsAppBotService } from './whatsapp-bot.service';

// WhatsApp → Fluxo do Bot: construtor (salvar/ativar), simulador e ações por conversa.
@ApiTags('WhatsApp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('whatsapp')
export class WhatsAppBotController {
  constructor(private readonly bot: WhatsAppBotService) {}

  @Get('bot') get(@Req() req: any) { return this.bot.get(req.user.organizationId); }
  @Put('bot') save(@Req() req: any, @Body() dto: any) { return this.bot.save(req.user.organizationId, dto || {}); }

  @Post('bot/active')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  active(@Req() req: any, @Body() dto: any) { return this.bot.setActive(req.user.organizationId, dto?.active === true || dto?.active === 'true'); }

  @Post('bot/simulate')
  @Throttle({ default: { limit: 180, ttl: 60_000 } })
  simulate(@Req() req: any, @Body() dto: any) { return this.bot.simulate(req.user.organizationId, dto || {}); }

  @Get('bot/sessions') sessions(@Req() req: any) { return this.bot.sessions(req.user.organizationId); }

  // "Enviar para o bot" / "Tirar do bot" a partir do chat
  @Post('chats/:chatId/bot')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  chatBot(@Req() req: any, @Param('chatId') chatId: string, @Body() dto: any) {
    return dto?.action === 'stop'
      ? this.bot.stopForChat(req.user.organizationId, req.user.userId, chatId)
      : this.bot.startForChat(req.user.organizationId, req.user.userId, chatId);
  }
}
