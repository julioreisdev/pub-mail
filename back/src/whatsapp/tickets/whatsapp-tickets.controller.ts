import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { WaAccessService } from '../wa-access.service';
import { WhatsAppAttendanceService } from '../whatsapp-attendance.service';
import { WhatsAppTicketsService } from './whatsapp-tickets.service';
import { AssignTicketDto, CreateTicketDto, PatchTicketDto, TicketCommentDto, TicketSettingsDto } from './dto/whatsapp-tickets.dto';

const UUID_RE = /^[0-9a-f-]{36}$/i;
const ADMIN = ['OWNER', 'ADMIN', 'SUPER_ADMIN'] as const;

// Chamados / protocolos (Fase 6B, contrato §10.4). Configurações só dono/admin; chamados: qualquer usuário com o
// módulo WhatsApp. Chamado de um número que o usuário não vê → 404 (sem número = todos veem).
@ApiTags('WhatsApp Chamados')
@UseGuards(JwtAuthGuard)
@Controller('whatsapp/tickets')
export class WhatsAppTicketsController {
  constructor(private readonly svc: WhatsAppTicketsService, private readonly access: WaAccessService, private readonly attendance: WhatsAppAttendanceService) {}

  private org(req: any) { return req.user.organizationId as string; }
  private by(req: any) { return { by: 'staff' as const, user_id: req.user.userId as string }; }
  private async assertTicket(req: any, id: string) {
    const sid = await this.svc.sessionOf(this.org(req), id);
    if (sid && !(await this.access.canUse(req.user, sid))) throw new NotFoundException('Chamado não encontrado.');
  }
  private async assertTarget(req: any, dto: { session_id?: string | null; chat_id?: string | null }) {
    if (dto.chat_id && UUID_RE.test(dto.chat_id) && !dto.chat_id.includes('@')) await this.access.assertChat(req.user, await this.attendance.chatRow(this.org(req), dto.chat_id));
    else if (dto.session_id) await this.access.assertSession(req.user, dto.session_id);
  }

  // ---------------------------------------------------------------- configurações
  @Get('settings') settings(@Req() req: any) { return this.svc.settings(this.org(req)); }
  @Put('settings') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...ADMIN) updateSettings(@Req() req: any, @Body() dto: TicketSettingsDto) { return this.svc.updateSettings(this.org(req), dto); }
  @Get('assignees') assignees(@Req() req: any) { return this.svc.assignees(this.org(req)); }

  // ---------------------------------------------------------------- lista
  @Get() async list(@Req() req: any, @Query() q: any) { return this.svc.list(this.org(req), q, await this.access.allowedIds(req.user), req.user.userId); }
  @Get('counts') async counts(@Req() req: any) { return this.svc.counts(this.org(req), await this.access.allowedIds(req.user), req.user.userId); }
  @Get('by-chat/:chatId') async byChat(@Req() req: any, @Param('chatId') chatId: string) {
    await this.access.assertChat(req.user, await this.attendance.chatRow(this.org(req), chatId));
    return this.svc.byChat(this.org(req), chatId, await this.access.allowedIds(req.user));
  }

  // ---------------------------------------------------------------- chamado
  @Post() @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async create(@Req() req: any, @Body() dto: CreateTicketDto) {
    await this.assertTarget(req, dto);
    return this.svc.create(this.org(req), { ...dto, source: 'panel', user_id: req.user.userId });
  }
  @Get(':id') async get(@Req() req: any, @Param('id') id: string) { await this.assertTicket(req, id); return this.svc.get(this.org(req), id); }
  @Get(':id/events') async events(@Req() req: any, @Param('id') id: string) { await this.assertTicket(req, id); return this.svc.events(this.org(req), id); }
  @Patch(':id') async patch(@Req() req: any, @Param('id') id: string, @Body() dto: PatchTicketDto) { await this.assertTicket(req, id); return this.svc.update(this.org(req), id, dto, this.by(req)); }
  @Post(':id/assign') async assign(@Req() req: any, @Param('id') id: string, @Body() dto: AssignTicketDto) {
    await this.assertTicket(req, id);
    return this.svc.update(this.org(req), id, { assigned_user_id: dto.user_id ?? null }, this.by(req));
  }
  @Post(':id/comments') @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async comment(@Req() req: any, @Param('id') id: string, @Body() dto: TicketCommentDto) {
    await this.assertTicket(req, id);
    return this.svc.comment(this.org(req), id, dto, this.by(req));
  }
}
