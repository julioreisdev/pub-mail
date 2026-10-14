import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { WhatsAppBotService } from './whatsapp-bot.service';
import { AssignBotFlowSessionsDto, BotSessionsQueryDto, ChatBotActionDto, CreateBotFlowDto, SetBotFlowActiveDto, SimulateBotDto, UpdateBotFlowDto } from '../dto/whatsapp-bot.dto';

// WhatsApp → Fluxo do Bot (multi-número): N fluxos por organização; cada número usa 0 ou 1 fluxo.
//  - construtor: criar/duplicar/salvar/apagar fluxos; ligar/desligar (dono/admin); atribuir a números (dono/admin);
//  - simulador (mesmo interpretador, sem enviar nada);
//  - monitor das conversas conduzidas pelo bot e ações por conversa (uuid) a partir do chat.
@ApiTags('WhatsApp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('whatsapp')
export class WhatsAppBotController {
  constructor(private readonly bot: WhatsAppBotService) {}

  // compat: { flows, sessions }
  @Get('bot') get(@Req() req: any) { return this.bot.get(req.user.organizationId); }

  // ---- fluxos
  @Get('bot/flows') list(@Req() req: any) { return this.bot.listFlows(req.user.organizationId); }
  @Post('bot/flows') create(@Req() req: any, @Body() dto: CreateBotFlowDto) { return this.bot.createFlow(req.user.organizationId, dto || {}); }
  @Get('bot/flows/:id') getFlow(@Req() req: any, @Param('id') id: string) { return this.bot.getFlow(req.user.organizationId, id); }
  // fluxo ATIVO só dono/admin altera (a regra depende da linha do fluxo → fica no serviço, ForbiddenException)
  @Put('bot/flows/:id') update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateBotFlowDto) { return this.bot.updateFlow(req.user.organizationId, id, dto || {}, req.user); }

  @Delete('bot/flows/:id')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  remove(@Req() req: any, @Param('id') id: string) { return this.bot.removeFlow(req.user.organizationId, id); }

  @Post('bot/flows/:id/active')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  active(@Req() req: any, @Param('id') id: string, @Body() dto: SetBotFlowActiveDto) { return this.bot.setActive(req.user.organizationId, id, dto?.active === true); }

  @Put('bot/flows/:id/sessions')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  assign(@Req() req: any, @Param('id') id: string, @Body() dto: AssignBotFlowSessionsDto) { return this.bot.assignSessions(req.user.organizationId, req.user, id, dto?.session_ids || []); }

  // ---- simulador
  @Post('bot/simulate')
  @Throttle({ default: { limit: 180, ttl: 60_000 } })
  simulate(@Req() req: any, @Body() dto: SimulateBotDto) { return this.bot.simulate(req.user.organizationId, dto || {}); }

  // ---- monitor (conversas em que o bot está conduzindo; só números liberados ao usuário)
  @Get('bot/sessions') sessions(@Req() req: any, @Query() q: BotSessionsQueryDto) { return this.bot.monitor(req.user.organizationId, req.user, q?.session_id || null); }

  // "Enviar para o bot" / "Tirar do bot" a partir do chat (:chatId = uuid da conversa)
  @Post('chats/:chatId/bot')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  chatBot(@Req() req: any, @Param('chatId') chatId: string, @Body() dto: ChatBotActionDto) {
    return dto?.action === 'stop'
      ? this.bot.stopForChat(req.user.organizationId, req.user, chatId)
      : this.bot.startForChat(req.user.organizationId, req.user, chatId);
  }
}
