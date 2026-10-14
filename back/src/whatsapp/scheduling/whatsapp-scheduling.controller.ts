import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { WaAccessService } from '../wa-access.service';
import { WhatsAppAttendanceService } from '../whatsapp-attendance.service';
import { WhatsAppSchedulingService } from './whatsapp-scheduling.service';
import {
  AppointmentActionDto, BlockDto, BookAppointmentDto, CancelAppointmentDto, PatchAppointmentDto, ReorderResourcesDto, RescheduleAppointmentDto,
  ResourceDto, SchedulingSettingsDto, UpdateResourceDto, WaitlistDto, WaitlistOfferDto,
} from './dto/whatsapp-scheduling.dto';

const UUID_RE = /^[0-9a-f-]{36}$/i;
const ADMIN = ['OWNER', 'ADMIN', 'SUPER_ADMIN'] as const;

// Agenda (Fase 6, contrato §9.3). Configuração (recursos, bloqueios, link ICS, configurações) só dono/admin;
// agendamentos e lista de espera: qualquer usuário com o módulo WhatsApp. Agendamento de número alheio = 404.
@ApiTags('WhatsApp Agenda')
@UseGuards(JwtAuthGuard)
@Controller('whatsapp/scheduling')
export class WhatsAppSchedulingController {
  constructor(private readonly svc: WhatsAppSchedulingService, private readonly access: WaAccessService, private readonly attendance: WhatsAppAttendanceService) {}

  private org(req: any) { return req.user.organizationId as string; }
  /** Agendamento com número que o usuário não vê → 404. Sem número (sem conversa) = todos veem. */
  private async assertAppt(req: any, id: string) {
    const sid = await this.svc.sessionOf(this.org(req), id);
    if (sid && !(await this.access.canUse(req.user, sid))) throw new NotFoundException('Agendamento não encontrado.');
  }
  /** Entrada da lista de espera de número que o usuário não vê → 404. */
  private async assertWaitlist(req: any, id: string) {
    const sid = await this.svc.waitlistSessionOf(this.org(req), id);
    if (sid && !(await this.access.canUse(req.user, sid))) throw new NotFoundException('Entrada da lista de espera não encontrada.');
  }
  /** Conversa/número escolhidos num formulário precisam ser do usuário. */
  private async assertTarget(req: any, dto: { session_id?: string | null; chat_id?: string | null }) {
    if (dto.chat_id && UUID_RE.test(dto.chat_id) && !dto.chat_id.includes('@')) await this.access.assertChat(req.user, await this.attendance.chatRow(this.org(req), dto.chat_id));
    else if (dto.session_id) await this.access.assertSession(req.user, dto.session_id);
  }

  // ---------------------------------------------------------------- configurações
  @Get('settings') settings(@Req() req: any) { return this.svc.settings(this.org(req)); }
  @Put('settings') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...ADMIN) updateSettings(@Req() req: any, @Body() dto: SchedulingSettingsDto) { return this.svc.updateSettings(this.org(req), dto); }

  // ---------------------------------------------------------------- recursos
  @Get('resources') resources(@Req() req: any, @Query() q: any) { return this.svc.listResources(this.org(req), q); }
  @Put('resources/reorder') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...ADMIN) reorder(@Req() req: any, @Body() dto: ReorderResourcesDto) { return this.svc.reorderResources(this.org(req), dto.ids); }
  @Get('resources/:id') resource(@Req() req: any, @Param('id') id: string) { return this.svc.getResource(this.org(req), id); }
  @Post('resources') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...ADMIN) createResource(@Req() req: any, @Body() dto: ResourceDto) { return this.svc.createResource(this.org(req), dto); }
  @Put('resources/:id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...ADMIN) updateResource(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateResourceDto) { return this.svc.updateResource(this.org(req), id, dto); }
  @Delete('resources/:id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...ADMIN) removeResource(@Req() req: any, @Param('id') id: string) { return this.svc.removeResource(this.org(req), id); }

  @Get('resources/:id/blocks') resourceBlocks(@Req() req: any, @Param('id') id: string, @Query() q: any) { return this.svc.listBlocks(this.org(req), id, q); }
  @Post('resources/:id/blocks') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...ADMIN) addResourceBlock(@Req() req: any, @Param('id') id: string, @Body() dto: BlockDto) { return this.svc.createBlock(this.org(req), id, dto, req.user.userId); }
  @Delete('resources/:id/blocks/:blockId') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...ADMIN) removeResourceBlock(@Req() req: any, @Param('blockId') blockId: string) { return this.svc.removeBlock(this.org(req), blockId); }
  @Get('resources/:id/ics-link') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...ADMIN) icsLink(@Req() req: any, @Param('id') id: string) { return this.svc.icsLink(this.org(req), id); }
  @Post('resources/:id/ics-link/rotate') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...ADMIN) icsRotate(@Req() req: any, @Param('id') id: string) { return this.svc.icsLink(this.org(req), id, true); }

  // bloqueios gerais (feriados): GET devolve os gerais E os de cada recurso (`resource_id` null = geral)
  @Get('blocks') blocks(@Req() req: any, @Query() q: any) { return this.svc.listBlocks(this.org(req), null, q); }
  @Post('blocks') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...ADMIN) addBlock(@Req() req: any, @Body() dto: BlockDto) { return this.svc.createBlock(this.org(req), null, dto, req.user.userId); }
  @Delete('blocks/:id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...ADMIN) removeBlock(@Req() req: any, @Param('id') id: string) { return this.svc.removeBlock(this.org(req), id); }

  // ---------------------------------------------------------------- serviços e vagas
  @Get('services') services(@Req() req: any) { return this.svc.services(this.org(req)); }
  @Get('availability') availability(@Req() req: any, @Query() q: any) {
    return this.svc.availability(this.org(req), { product_id: String(q.product_id || ''), resource_id: q.resource_id || null, from: q.from || null, to: q.to || null, days: q.days ? Number(q.days) : null, limit_per_day: q.limit_per_day ? Number(q.limit_per_day) : null, ignore_notice: q.ignore_notice === '1' || q.ignore_notice === 'true', exclude_appointment_id: q.exclude_appointment_id || null });
  }

  // ---------------------------------------------------------------- agendamentos
  @Get('appointments') async list(@Req() req: any, @Query() q: any) { return this.svc.list(this.org(req), q, await this.access.allowedIds(req.user)); }
  @Get('appointments/counts') async counts(@Req() req: any, @Query('date') date: string) { return this.svc.counts(this.org(req), date, await this.access.allowedIds(req.user)); }
  @Get('appointments/:id') async get(@Req() req: any, @Param('id') id: string) { await this.assertAppt(req, id); return this.svc.get(this.org(req), id); }
  @Post('appointments') @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async book(@Req() req: any, @Body() dto: BookAppointmentDto) {
    await this.assertTarget(req, dto);
    return this.svc.book(this.org(req), { ...dto, source: 'panel', user_id: req.user.userId });
  }
  @Patch('appointments/:id') async patch(@Req() req: any, @Param('id') id: string, @Body() dto: PatchAppointmentDto) { await this.assertAppt(req, id); return this.svc.update(this.org(req), id, dto); }
  @Post('appointments/:id/confirm') async confirm(@Req() req: any, @Param('id') id: string, @Body() dto: AppointmentActionDto) { await this.assertAppt(req, id); return this.svc.confirm(this.org(req), id, { by: 'staff', notify: dto?.notify === true }); }
  @Post('appointments/:id/start') async start(@Req() req: any, @Param('id') id: string) { await this.assertAppt(req, id); return this.svc.start(this.org(req), id); }
  @Post('appointments/:id/done') async done(@Req() req: any, @Param('id') id: string) { await this.assertAppt(req, id); return this.svc.done(this.org(req), id); }
  @Post('appointments/:id/no-show') async noShow(@Req() req: any, @Param('id') id: string, @Body() dto: AppointmentActionDto) { await this.assertAppt(req, id); return this.svc.noShow(this.org(req), id, { by: 'staff', notify: dto?.notify !== false }); }
  @Post('appointments/:id/cancel') async cancel(@Req() req: any, @Param('id') id: string, @Body() dto: CancelAppointmentDto) {
    await this.assertAppt(req, id);
    return this.svc.cancel(this.org(req), id, { by: 'staff', reason: dto.reason || null, policy_override: dto.policy_override || null, notify: dto.notify !== false, user_id: req.user.userId });
  }
  @Post('appointments/:id/reschedule') async reschedule(@Req() req: any, @Param('id') id: string, @Body() dto: RescheduleAppointmentDto) {
    await this.assertAppt(req, id);
    return this.svc.reschedule(this.org(req), id, { starts_at: dto.starts_at, resource_id: dto.resource_id === undefined ? undefined : dto.resource_id, by: 'staff', notify: dto.notify !== false, user_id: req.user.userId });
  }
  @Post('appointments/:id/charge') @Throttle({ default: { limit: 20, ttl: 60_000 } }) async charge(@Req() req: any, @Param('id') id: string) {
    await this.assertAppt(req, id);
    return (await this.svc.charge(this.org(req), id, req.user.userId)).appointment;
  }

  // ---------------------------------------------------------------- créditos do cliente
  @Get('customers/:id/credits') credits(@Req() req: any, @Param('id') id: string) { return this.svc.listCredits(this.org(req), id); }

  // ---------------------------------------------------------------- lista de espera
  @Get('waitlist') async waitlist(@Req() req: any, @Query() q: any) { return this.svc.waitlistList(this.org(req), q, await this.access.allowedIds(req.user)); }
  @Post('waitlist') async joinWaitlist(@Req() req: any, @Body() dto: WaitlistDto) { await this.assertTarget(req, dto); return this.svc.waitlistJoin(this.org(req), dto); }
  @Delete('waitlist/:id') async removeWaitlist(@Req() req: any, @Param('id') id: string) { await this.assertWaitlist(req, id); return this.svc.waitlistRemove(this.org(req), id); }
  @Post('waitlist/:id/offer') @Throttle({ default: { limit: 30, ttl: 60_000 } }) async offer(@Req() req: any, @Param('id') id: string, @Body() dto: WaitlistOfferDto) { await this.assertWaitlist(req, id); return this.svc.waitlistOffer(this.org(req), id, dto || {}); }

  // ---------------------------------------------------------------- relatório
  // relatório: só agendamentos dos números do usuário (e os sem número); a ocupação disponível é da grade dos recursos
  @Get('report') async report(@Req() req: any, @Query() q: any) { return this.svc.report(this.org(req), { from: q.from, to: q.to }, await this.access.allowedIds(req.user)); }
}
