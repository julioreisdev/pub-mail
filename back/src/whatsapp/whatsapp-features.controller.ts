import { NotFoundException, BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WhatsAppChatService } from './whatsapp-chat.service';
import { WhatsAppContactsService } from './whatsapp-contacts.service';
import { WhatsAppMediaService, kindOfMime } from './whatsapp-media.service';
import { WhatsAppStatusService } from './whatsapp-status.service';
import { WhatsAppBroadcastsService } from './whatsapp-broadcasts.service';
import { WhatsAppFiltersService } from './whatsapp-filters.service';
import { WhatsAppSchedulesService } from './whatsapp-schedules.service';
import { WhatsAppAttendanceService } from './whatsapp-attendance.service';
import { WhatsAppContactStatusesService } from './whatsapp-contact-statuses.service';
import { WaAccessService } from './wa-access.service';
import { WhatsAppPresenter } from './whatsapp-presenter.service';
import { WhatsAppSessionsService } from './whatsapp-sessions.service';
import { AudienceDto, BroadcastDto, BulkContactsDto, ChatFlagDto, CopiesDto, CreateContactDto, CreateStatusDto, EditMessageDto, ForwardDto, OpenChatDto, PatchContactDto, PatchStatusDto, ReactDto, RefreshPhotoDto, RunsQueryDto, SendLocationDto, SendPollDto, SendTextDto, SyncChatsDto, RunActionDto, RepliesQueryDto } from './dto/whatsapp-crud.dto';
import { serveWaFile } from './crypto/wa-file-serve';

const MB = 1024 * 1024;

// ---------------------------------------------------------------- chats + mensagens
// A conversa é identificada pelo uuid da linha (`chat_id` público). Toda rota confere se o usuário
// pode ver o NÚMERO da conversa (WaAccessService): número alheio = 404.
@ApiTags('WhatsApp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('whatsapp')
export class WhatsAppChatController {
  constructor(private readonly chat: WhatsAppChatService, private readonly contactsSvc: WhatsAppContactsService, private readonly attendance: WhatsAppAttendanceService, private readonly access: WaAccessService, private readonly sessions: WhatsAppSessionsService, private readonly presenter: WhatsAppPresenter) {}

  private async guardChat(req: any, chatUuid: string) {
    const chat = await this.chat.chatRow(req.user.organizationId, chatUuid);
    await this.access.assertChat(req.user, chat);
    return chat;
  }
  private async guardMessage(req: any, msgId: string) {
    const sessionId = await this.chat.messageSession(req.user.organizationId, msgId);
    await this.access.assertChat(req.user, { session_id: sessionId });
  }

  @Get('chats') async list(@Req() req: any, @Query() q: any) { return this.chat.listChats(req.user.organizationId, q, req.user.userId, await this.access.sessionWhere(req.user, q?.session_id)); }
  @Get('chats/counts') async counts(@Req() req: any, @Query('session_id') sessionId?: string) { return this.chat.counts(req.user.organizationId, req.user.userId, await this.access.sessionWhere(req.user, sessionId)); }
  @Post('chats/open') async open(@Req() req: any, @Body() dto: OpenChatDto) {
    let sessionId = dto.session_id || '';
    if (sessionId) await this.access.assertSession(req.user, sessionId);
    else {
      // sem número informado: o 1º conectado que o usuário pode usar
      const allowed = await this.access.allowedIds(req.user);
      const ready = (await this.sessions.readyRows(req.user.organizationId)).filter((r) => !allowed || allowed.has(r.id));
      if (!ready.length) throw new BadRequestException('Nenhum número conectado disponível para abrir a conversa.');
      sessionId = ready[0].id;
    }
    return this.chat.openByPhone(req.user.organizationId, sessionId, dto.phone, dto.name);
  }
  @Post('chats/sync') async sync(@Req() req: any, @Body() dto: SyncChatsDto) { await this.access.assertSession(req.user, dto.session_id); return this.chat.syncChats(req.user.organizationId, dto.session_id); }
  @Get('groups') async groups(@Req() req: any, @Query('session_id') sessionId?: string) { return this.chat.groups(req.user.organizationId, await this.access.sessionWhere(req.user, sessionId)); }

  // foto de qualquer jid (participante de grupo, pessoa sem conversa) — usa o número informado ou qualquer um conectado
  @Get('photo')
  async anyPhoto(@Req() req: any, @Query('jid') jid: string, @Query('session_id') sessionId: string, @Res() res: Response) {
    if (sessionId && !(await this.access.canUse(req.user, sessionId))) return res.status(404).end();
    const p = await this.contactsSvc.photo(req.user.organizationId, { jid: String(jid || ''), sessionId: sessionId || null });
    if (!p) return res.status(404).end();
    res.setHeader('Content-Type', p.mime); res.setHeader('Cache-Control', 'private, max-age=86400');
    return serveWaFile(p.path, req, res);
  }
  // "Atualizar foto": força a releitura no gateway (a pessoa trocou a foto agora) e devolve a versão nova
  @Post('photo/refresh')
  async refreshPhoto(@Req() req: any, @Body() dto: RefreshPhotoDto) {
    const orgId = req.user.organizationId;
    let target: any;
    if (dto.chat_id) {
      const chat = await this.chat.chatRow(orgId, dto.chat_id);
      if (!(await this.access.canUse(req.user, chat.session_id))) throw new NotFoundException('Conversa não encontrada.');
      target = { chatUuid: chat.id };
    } else {
      if (dto.session_id && !(await this.access.canUse(req.user, dto.session_id))) throw new NotFoundException('Número não encontrado.');
      target = { jid: String(dto.jid || ''), sessionId: dto.session_id || null };
    }
    const p = await this.contactsSvc.photo(orgId, target, { force: true });
    if (dto.chat_id) { const chat = await this.chat.chatRow(orgId, dto.chat_id); this.presenter.chat(orgId, chat.session_id, chat.chat_id); }
    return { ok: true, has_photo: Boolean(p), photo_v: p?.id ? String(p.id).slice(0, 8) : null };
  }
  @Get('chats/:chatId/photo')
  async chatPhoto(@Req() req: any, @Param('chatId') chatId: string, @Res() res: Response) {
    const chat = await this.chat.chatRow(req.user.organizationId, chatId).catch(() => null);
    if (!chat || !(await this.access.canUse(req.user, chat.session_id))) return res.status(404).end();
    const p = await this.contactsSvc.photo(req.user.organizationId, { chatUuid: chat.id });
    if (!p) return res.status(404).end();
    res.setHeader('Content-Type', p.mime); res.setHeader('Cache-Control', 'private, max-age=86400');
    return serveWaFile(p.path, req, res);
  }
  @Get('chats/:chatId') async get(@Req() req: any, @Param('chatId') chatId: string) { await this.guardChat(req, chatId); return this.chat.getChat(req.user.organizationId, chatId); }
  // etiquetas da conversa e atendimento (assumir / transferir / liberar / encerrar / reabrir)
  @Put('chats/:chatId/tags') async setTags(@Req() req: any, @Param('chatId') chatId: string, @Body() dto: any) { await this.guardChat(req, chatId); return this.attendance.setChatTags(req.user.organizationId, chatId, dto?.tag_ids, req.user.userId); }
  @Post('chats/:chatId/service') async service(@Req() req: any, @Param('chatId') chatId: string, @Body() dto: any) { await this.guardChat(req, chatId); return this.attendance.action(req.user.organizationId, req.user.userId, chatId, String(dto?.action || ''), dto?.user_id ? String(dto.user_id) : null); }
  @Get('chats/:chatId/service/events') async serviceEvents(@Req() req: any, @Param('chatId') chatId: string) { await this.guardChat(req, chatId); return this.attendance.events(req.user.organizationId, chatId); }
  @Get('chats/:chatId/messages') async messages(@Req() req: any, @Param('chatId') chatId: string, @Query() q: any) { await this.guardChat(req, chatId); return this.chat.messages(req.user.organizationId, chatId, q); }
  @Post('chats/:chatId/read') async read(@Req() req: any, @Param('chatId') chatId: string) { await this.guardChat(req, chatId); return this.chat.markRead(req.user.organizationId, chatId); }
  @Post('chats/:chatId/typing') async typing(@Req() req: any, @Param('chatId') chatId: string, @Body() dto: ChatFlagDto) { await this.guardChat(req, chatId); return this.chat.typing(req.user.organizationId, chatId, dto.typing !== false); }
  @Post('chats/:chatId/archive') async archive(@Req() req: any, @Param('chatId') chatId: string, @Body() dto: ChatFlagDto) { await this.guardChat(req, chatId); return this.chat.setFlag(req.user.organizationId, chatId, 'archived', dto.archived !== false); }
  @Post('chats/:chatId/pin') async pin(@Req() req: any, @Param('chatId') chatId: string, @Body() dto: ChatFlagDto) { await this.guardChat(req, chatId); return this.chat.setFlag(req.user.organizationId, chatId, 'pinned', dto.pinned !== false); }
  @Post('chats/:chatId/mute') async mute(@Req() req: any, @Param('chatId') chatId: string, @Body() dto: ChatFlagDto) { await this.guardChat(req, chatId); return this.chat.setFlag(req.user.organizationId, chatId, 'muted', dto.muted !== false); }

  @Post('messages/send')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async send(@Req() req: any, @Body() dto: SendTextDto) { await this.guardChat(req, dto.chat_id); return this.chat.sendText(req.user.organizationId, req.user.userId, dto); }

  @Post('messages/send-media')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 64 * MB } }))
  async sendMedia(@Req() req: any, @UploadedFile() file: any, @Body() body: any) {
    const flag = (v: any) => v === true || v === '1' || v === 'true';
    const dto = { chat_id: String(body?.chat_id || ''), caption: body?.caption, as_voice: flag(body?.as_voice), as_document: flag(body?.as_document), quoted_wa_id: body?.quoted_wa_id || undefined };
    await this.guardChat(req, dto.chat_id);
    // sem arquivo + media_id = reenviar uma mídia já guardada (ex.: resposta rápida com anexo)
    if (!file && body?.media_id) return this.chat.sendStoredMedia(req.user.organizationId, req.user.userId, { ...dto, media_id: String(body.media_id) });
    return this.chat.sendMedia(req.user.organizationId, req.user.userId, dto, file);
  }

  @Post('messages/send-location') async sendLocation(@Req() req: any, @Body() dto: SendLocationDto) { await this.guardChat(req, dto.chat_id); return this.chat.sendLocation(req.user.organizationId, req.user.userId, dto); }
  @Post('messages/send-poll') async sendPoll(@Req() req: any, @Body() dto: SendPollDto) { await this.guardChat(req, dto.chat_id); return this.chat.sendPoll(req.user.organizationId, req.user.userId, dto); }
  @Post('messages/:id/media/retry') @Throttle({ default: { limit: 30, ttl: 60_000 } }) async retryMedia(@Req() req: any, @Param('id') id: string) { await this.guardMessage(req, id); return this.chat.retryMedia(req.user.organizationId, id); }
  @Post('messages/:id/react') async react(@Req() req: any, @Param('id') id: string, @Body() dto: ReactDto) { await this.guardMessage(req, id); return this.chat.react(req.user.organizationId, id, dto.emoji); }
  @Post('messages/:id/forward') async forward(@Req() req: any, @Param('id') id: string, @Body() dto: ForwardDto) { await this.guardMessage(req, id); return this.chat.forward(req.user.organizationId, req.user.userId, id, dto.to, await this.access.allowedIds(req.user)); }
  @Put('messages/:id') async edit(@Req() req: any, @Param('id') id: string, @Body() dto: EditMessageDto) { await this.guardMessage(req, id); return this.chat.edit(req.user.organizationId, id, dto.text); }
  @Delete('messages/:id') async del(@Req() req: any, @Param('id') id: string, @Query('everyone') everyone?: string) { await this.guardMessage(req, id); return this.chat.delete(req.user.organizationId, id, everyone === '1' || everyone === 'true'); }
}

// ---------------------------------------------------------------- filtros do chat + agendamentos
@ApiTags('WhatsApp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('whatsapp/chat-filters')
export class WhatsAppFiltersController {
  constructor(private readonly filters: WhatsAppFiltersService) {}
  @Get() list(@Req() req: any) { return this.filters.list(req.user.organizationId); }
  @Post() create(@Req() req: any, @Body() dto: any) { return this.filters.create(req.user.organizationId, dto || {}); }
  @Put(':id') update(@Req() req: any, @Param('id') id: string, @Body() dto: any) { return this.filters.update(req.user.organizationId, id, dto || {}); }
  @Delete(':id') remove(@Req() req: any, @Param('id') id: string) { return this.filters.remove(req.user.organizationId, id); }
}

// Agendamentos: `session_ids` (1..N números) + `mode` all|split + alvos (uuid de conversa ou telefone).
@ApiTags('WhatsApp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('whatsapp/schedules')
export class WhatsAppSchedulesController {
  constructor(private readonly schedules: WhatsAppSchedulesService, private readonly access: WaAccessService) {}
  @Get() async list(@Req() req: any, @Query() q: any) { return this.schedules.list(req.user.organizationId, q, await this.access.allowedIds(req.user)); }
  @Post() async create(@Req() req: any, @Body() dto: any) { return this.schedules.create(req.user.organizationId, req.user.userId, dto || {}, await this.access.allowedIds(req.user)); }
  @Patch(':id') async patch(@Req() req: any, @Param('id') id: string, @Body() dto: any) { return this.schedules.patch(req.user.organizationId, id, dto || {}, await this.access.allowedIds(req.user)); }
  @Delete(':id') async remove(@Req() req: any, @Param('id') id: string) { return this.schedules.remove(req.user.organizationId, id, await this.access.allowedIds(req.user)); }
  @Post(':id/send-now') @Throttle({ default: { limit: 10, ttl: 60_000 } }) async sendNow(@Req() req: any, @Param('id') id: string) { return this.schedules.sendNow(req.user.organizationId, id, await this.access.allowedIds(req.user)); }
}

// ---------------------------------------------------------------- contatos (da organização; filtro por número = quem tem conversa nele)
@ApiTags('WhatsApp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('whatsapp/contacts')
export class WhatsAppContactsController {
  constructor(private readonly contacts: WhatsAppContactsService, private readonly access: WaAccessService, private readonly presenter: WhatsAppPresenter) {}

  @Get() async list(@Req() req: any, @Query() q: any) { return this.contacts.list(req.user.organizationId, q, await this.access.allowedIds(req.user)); }
  @Get('tags') tags(@Req() req: any) { return this.contacts.tags(req.user.organizationId); }
  @Get('lookup') async lookup(@Req() req: any, @Query('jid') jid: string, @Query('session_id') sessionId?: string, @Query('chat_id') chatId?: string) {
    if (sessionId) await this.access.assertSession(req.user, sessionId);
    return this.contacts.lookup(req.user.organizationId, String(jid || ''), { sessionId: sessionId || null, chatId: chatId || null, allowed: await this.access.allowedIds(req.user) });
  }
  @Get('export')
  async exportCsv(@Req() req: any, @Query('saved') saved: string, @Res() res: Response) {
    const csv = await this.contacts.exportCsv(req.user.organizationId, saved === '1' || saved === 'true');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="contatos-whatsapp.csv"');
    res.send(csv);
  }
  // agenda de UM número → contatos da org
  @Post('sync') @Throttle({ default: { limit: 3, ttl: 60_000 } }) async sync(@Req() req: any, @Body() dto: SyncChatsDto) { await this.access.assertSession(req.user, dto.session_id); return this.contacts.sync(req.user.organizationId, dto.session_id); }
  @Post() create(@Req() req: any, @Body() dto: CreateContactDto) { return this.contacts.createManual(req.user.organizationId, dto); }
  @Post('bulk') bulk(@Req() req: any, @Body() dto: BulkContactsDto) { return this.contacts.bulk(req.user.organizationId, dto); }
  @Post('import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * MB } }))
  importCsv(@Req() req: any, @UploadedFile() file: any) { return this.contacts.importCsv(req.user.organizationId, file?.buffer || Buffer.alloc(0)); }
  @Get(':id/check') async check(@Req() req: any, @Param('id') id: string, @Query('session_id') sessionId?: string) { if (sessionId) await this.access.assertSession(req.user, sessionId); return this.contacts.check(req.user.organizationId, id, sessionId || null); }
  @Get(':id/photo')
  async photo(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const p = await this.contacts.photo(req.user.organizationId, { contactId: id });
    if (!p) return res.status(404).end();
    res.setHeader('Content-Type', p.mime); res.setHeader('Cache-Control', 'private, max-age=86400');
    return serveWaFile(p.path, req, res);
  }
  @Patch(':id') async patch(@Req() req: any, @Param('id') id: string, @Body() dto: PatchContactDto) {
    const r = await this.contacts.patch(req.user.organizationId, id, dto);
    for (const c of r.renamed_chats || []) this.presenter.chat(req.user.organizationId, c.session_id, c.chat_id);
    return r;
  }
  @Delete(':id') remove(@Req() req: any, @Param('id') id: string) { return this.contacts.remove(req.user.organizationId, id); }
}

// ---------------------------------------------------------------- mídia (upload p/ status/broadcast)
@ApiTags('WhatsApp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('whatsapp/media')
export class WhatsAppMediaController {
  constructor(private readonly media: WhatsAppMediaService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 64 * MB } }))
  async upload(@Req() req: any, @UploadedFile() file: any, @Body() body: any) {
    if (!file?.buffer?.length) return { error: 'Arquivo vazio.' };
    const name = file.originalname ? Buffer.from(file.originalname, 'latin1').toString('utf8') : null;
    const m = await this.media.store(req.user.organizationId, file.buffer, String(file.mimetype || 'application/octet-stream'), name, body?.as_voice === '1' ? 'voice' : kindOfMime(file.mimetype));
    return this.media.toPublic(m);
  }
}

// ---------------------------------------------------------------- status (nossos): `session_ids` → uma linha por número (lote)
@ApiTags('WhatsApp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('whatsapp/statuses')
export class WhatsAppStatusController {
  constructor(private readonly status: WhatsAppStatusService, private readonly access: WaAccessService) {}

  @Get() async list(@Req() req: any, @Query() q: any) { return this.status.list(req.user.organizationId, q, await this.access.allowedIds(req.user)); }
  @Post() async create(@Req() req: any, @Body() dto: CreateStatusDto) { return this.status.create(req.user.organizationId, req.user.userId, dto, await this.access.allowedIds(req.user)); }
  @Patch(':id') async patch(@Req() req: any, @Param('id') id: string, @Body() dto: PatchStatusDto) { return this.status.patch(req.user.organizationId, id, dto, await this.access.allowedIds(req.user)); }
  @Delete(':id') async remove(@Req() req: any, @Param('id') id: string) { return this.status.remove(req.user.organizationId, id, await this.access.allowedIds(req.user)); }
}

// ---------------------------------------------------------------- broadcasts: `session_ids` (1..N) + ritmo
@ApiTags('WhatsApp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('whatsapp/broadcasts')
export class WhatsAppBroadcastsController {
  constructor(private readonly bc: WhatsAppBroadcastsService, private readonly access: WaAccessService) {}

  @Get() async list(@Req() req: any) { return this.bc.list(req.user.organizationId, await this.access.allowedIds(req.user)); }
  @Get('presets') presets() { return this.bc.presets(); }
  @Post() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') create(@Req() req: any, @Body() dto: BroadcastDto) { return this.bc.create(req.user.organizationId, dto); }
  @Put(':id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') update(@Req() req: any, @Param('id') id: string, @Body() dto: BroadcastDto) { return this.bc.update(req.user.organizationId, id, dto); }
  @Delete(':id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') remove(@Req() req: any, @Param('id') id: string) { return this.bc.remove(req.user.organizationId, id); }
  @Post('audience-estimate') audience(@Req() req: any, @Body() dto: AudienceDto) { return this.bc.audience(req.user.organizationId, dto.targets, dto.session_ids, dto.distribution, dto.exclude_inactive_days ?? null); }
  @Get(':id/copies') copies(@Req() req: any, @Param('id') id: string) { return this.bc.getCopies(req.user.organizationId, id); }
  @Put(':id/copies') setCopies(@Req() req: any, @Param('id') id: string, @Body() dto: CopiesDto) { return this.bc.setCopies(req.user.organizationId, id, dto.copies); }
  @Post(':id/fire') @Throttle({ default: { limit: 5, ttl: 60_000 } }) fire(@Req() req: any, @Param('id') id: string) { return this.bc.fire(req.user.organizationId, id); }
  @Get(':id/runs') runs(@Req() req: any, @Param('id') id: string, @Query() q: RunsQueryDto) { return this.bc.runs(req.user.organizationId, id, q); }
  @Post(':id/runs/:runId/pause') pauseRun(@Req() req: any, @Param('id') id: string, @Param('runId') runId: string) { return this.bc.pauseRunManual(req.user.organizationId, id, runId); }
  @Post(':id/runs/:runId/resume') resumeRun(@Req() req: any, @Param('id') id: string, @Param('runId') runId: string, @Body() dto: RunActionDto) { return this.bc.resumeRun(req.user.organizationId, id, runId, Boolean(dto?.force)); }
  @Get(':id/replies') replies(@Req() req: any, @Param('id') id: string, @Query() q: RepliesQueryDto) { return this.bc.replies(req.user.organizationId, id, q); }
  @Get(':id/runs/:runId/sends') sends(@Req() req: any, @Param('id') id: string, @Param('runId') runId: string, @Query() q: any) { return this.bc.sends(req.user.organizationId, id, runId, q); }
}

// ---------------------------------------------------------------- atendimento: etiquetas, respostas rápidas, atendentes, configurações (da org)
@ApiTags('WhatsApp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('whatsapp')
export class WhatsAppAttendanceController {
  constructor(private readonly attendance: WhatsAppAttendanceService) {}

  @Get('tags') tags(@Req() req: any) { return this.attendance.listTags(req.user.organizationId); }
  @Post('tags') createTag(@Req() req: any, @Body() dto: any) { return this.attendance.createTag(req.user.organizationId, dto || {}); }
  @Put('tags/:id') updateTag(@Req() req: any, @Param('id') id: string, @Body() dto: any) { return this.attendance.updateTag(req.user.organizationId, id, dto || {}); }
  @Delete('tags/:id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') removeTag(@Req() req: any, @Param('id') id: string) { return this.attendance.removeTag(req.user.organizationId, id); }

  // `session_id` → só quem pode atender aquele número (para transferir)
  @Get('attendants') attendants(@Req() req: any, @Query('session_id') sessionId?: string) { return this.attendance.attendants(req.user.organizationId, sessionId || null); }

  @Get('quick-replies') quickReplies(@Req() req: any) { return this.attendance.listQuickReplies(req.user.organizationId); }
  @Post('quick-replies') createQuickReply(@Req() req: any, @Body() dto: any) { return this.attendance.createQuickReply(req.user.organizationId, dto || {}); }
  @Put('quick-replies/:id') updateQuickReply(@Req() req: any, @Param('id') id: string, @Body() dto: any) { return this.attendance.updateQuickReply(req.user.organizationId, id, dto || {}); }
  @Delete('quick-replies/:id') removeQuickReply(@Req() req: any, @Param('id') id: string) { return this.attendance.removeQuickReply(req.user.organizationId, id); }

  @Get('service-settings') serviceSettings(@Req() req: any) { return this.attendance.settings(req.user.organizationId); }
  @Put('service-settings') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') updateServiceSettings(@Req() req: any, @Body() dto: any) { return this.attendance.updateSettings(req.user.organizationId, dto || {}); }
}

// ---------------------------------------------------------------- status (stories) dos contatos — por número
@ApiTags('WhatsApp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('whatsapp/contact-statuses')
export class WhatsAppContactStatusesController {
  constructor(private readonly svc: WhatsAppContactStatusesService, private readonly access: WaAccessService) {}

  @Get() async list(@Req() req: any, @Query('session_id') sessionId?: string) { return this.svc.list(req.user.organizationId, await this.access.allowedIds(req.user), sessionId || null); }
  @Post('sync') @Throttle({ default: { limit: 6, ttl: 60_000 } }) async sync(@Req() req: any, @Body() dto: any) {
    const sessionId = dto?.session_id ? String(dto.session_id) : null;
    if (sessionId) await this.access.assertSession(req.user, sessionId);
    return this.svc.syncMany(req.user.organizationId, await this.access.allowedIds(req.user), sessionId);
  }
  @Post(':id/view') async view(@Req() req: any, @Param('id') id: string) { return this.svc.view(req.user.organizationId, id, await this.access.allowedIds(req.user)); }
  @Post(':id/reply') @Throttle({ default: { limit: 30, ttl: 60_000 } }) async reply(@Req() req: any, @Param('id') id: string, @Body() dto: any) { return this.svc.reply(req.user.organizationId, req.user.userId, id, String(dto?.text || ''), await this.access.allowedIds(req.user)); }
  @Post(':id/react') @Throttle({ default: { limit: 30, ttl: 60_000 } }) async react(@Req() req: any, @Param('id') id: string, @Body() dto: any) { return this.svc.react(req.user.organizationId, id, String(dto?.emoji || ''), await this.access.allowedIds(req.user)); }
}
