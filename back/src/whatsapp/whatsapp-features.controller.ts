import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
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
import { AudienceDto, BroadcastDto, BulkContactsDto, ChatFlagDto, CopiesDto, CreateContactDto, CreateStatusDto, EditMessageDto, ForwardDto, OpenChatDto, PatchContactDto, PatchStatusDto, ReactDto, RunsQueryDto, SendLocationDto, SendPollDto, SendTextDto } from './dto/whatsapp-crud.dto';

const MB = 1024 * 1024;

// ---------------------------------------------------------------- chats + mensagens
@ApiTags('WhatsApp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('whatsapp')
export class WhatsAppChatController {
  constructor(private readonly chat: WhatsAppChatService, private readonly contactsSvc: WhatsAppContactsService) {}

  @Get('chats') list(@Req() req: any, @Query() q: any) { return this.chat.listChats(req.user.organizationId, q); }
  @Post('chats/open') open(@Req() req: any, @Body() dto: OpenChatDto) { return this.chat.openByPhone(req.user.organizationId, dto.phone); }
  @Post('chats/sync') sync(@Req() req: any) { return this.chat.syncChats(req.user.organizationId); }
  @Get('groups') groups(@Req() req: any) { return this.chat.groups(req.user.organizationId); }
  @Get('chats/:chatId/photo')
  async chatPhoto(@Req() req: any, @Param('chatId') chatId: string, @Res() res: Response) {
    const p = await this.contactsSvc.photo(req.user.organizationId, { chatId });
    if (!p) return res.status(404).end();
    res.setHeader('Content-Type', p.mime); res.setHeader('Cache-Control', 'private, max-age=86400');
    return res.sendFile(p.path);
  }
  @Get('chats/:chatId') get(@Req() req: any, @Param('chatId') chatId: string) { return this.chat.getChat(req.user.organizationId, chatId); }
  @Get('chats/:chatId/messages') messages(@Req() req: any, @Param('chatId') chatId: string, @Query() q: any) { return this.chat.messages(req.user.organizationId, chatId, q); }
  @Post('chats/:chatId/read') read(@Req() req: any, @Param('chatId') chatId: string) { return this.chat.markRead(req.user.organizationId, chatId); }
  @Post('chats/:chatId/typing') typing(@Req() req: any, @Param('chatId') chatId: string, @Body() dto: ChatFlagDto) { return this.chat.typing(req.user.organizationId, chatId, dto.typing !== false); }
  @Post('chats/:chatId/archive') archive(@Req() req: any, @Param('chatId') chatId: string, @Body() dto: ChatFlagDto) { return this.chat.setFlag(req.user.organizationId, chatId, 'archived', dto.archived !== false); }
  @Post('chats/:chatId/pin') pin(@Req() req: any, @Param('chatId') chatId: string, @Body() dto: ChatFlagDto) { return this.chat.setFlag(req.user.organizationId, chatId, 'pinned', dto.pinned !== false); }
  @Post('chats/:chatId/mute') mute(@Req() req: any, @Param('chatId') chatId: string, @Body() dto: ChatFlagDto) { return this.chat.setFlag(req.user.organizationId, chatId, 'muted', dto.muted !== false); }

  @Post('messages/send')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  send(@Req() req: any, @Body() dto: SendTextDto) { return this.chat.sendText(req.user.organizationId, req.user.userId, dto); }

  @Post('messages/send-media')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 64 * MB } }))
  sendMedia(@Req() req: any, @UploadedFile() file: any, @Body() body: any) {
    return this.chat.sendMedia(req.user.organizationId, req.user.userId, { chat_id: String(body?.chat_id || ''), caption: body?.caption, as_voice: body?.as_voice === '1' || body?.as_voice === 'true', as_document: body?.as_document === '1' || body?.as_document === 'true', quoted_wa_id: body?.quoted_wa_id || undefined }, file);
  }

  @Post('messages/send-location') sendLocation(@Req() req: any, @Body() dto: SendLocationDto) { return this.chat.sendLocation(req.user.organizationId, req.user.userId, dto); }
  @Post('messages/send-poll') sendPoll(@Req() req: any, @Body() dto: SendPollDto) { return this.chat.sendPoll(req.user.organizationId, req.user.userId, dto); }
  @Post('messages/:id/react') react(@Req() req: any, @Param('id') id: string, @Body() dto: ReactDto) { return this.chat.react(req.user.organizationId, id, dto.emoji); }
  @Post('messages/:id/forward') forward(@Req() req: any, @Param('id') id: string, @Body() dto: ForwardDto) { return this.chat.forward(req.user.organizationId, req.user.userId, id, dto.to); }
  @Put('messages/:id') edit(@Req() req: any, @Param('id') id: string, @Body() dto: EditMessageDto) { return this.chat.edit(req.user.organizationId, id, dto.text); }
  @Delete('messages/:id') del(@Req() req: any, @Param('id') id: string, @Query('everyone') everyone?: string) { return this.chat.delete(req.user.organizationId, id, everyone === '1' || everyone === 'true'); }
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

@ApiTags('WhatsApp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('whatsapp/schedules')
export class WhatsAppSchedulesController {
  constructor(private readonly schedules: WhatsAppSchedulesService) {}
  @Get() list(@Req() req: any, @Query() q: any) { return this.schedules.list(req.user.organizationId, q); }
  @Post() create(@Req() req: any, @Body() dto: any) { return this.schedules.create(req.user.organizationId, req.user.userId, dto || {}); }
  @Patch(':id') patch(@Req() req: any, @Param('id') id: string, @Body() dto: any) { return this.schedules.patch(req.user.organizationId, id, dto || {}); }
  @Delete(':id') remove(@Req() req: any, @Param('id') id: string) { return this.schedules.remove(req.user.organizationId, id); }
  @Post(':id/send-now') @Throttle({ default: { limit: 10, ttl: 60_000 } }) sendNow(@Req() req: any, @Param('id') id: string) { return this.schedules.sendNow(req.user.organizationId, id); }
}

// ---------------------------------------------------------------- contatos
@ApiTags('WhatsApp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('whatsapp/contacts')
export class WhatsAppContactsController {
  constructor(private readonly contacts: WhatsAppContactsService) {}

  @Get() list(@Req() req: any, @Query() q: any) { return this.contacts.list(req.user.organizationId, q); }
  @Get('tags') tags(@Req() req: any) { return this.contacts.tags(req.user.organizationId); }
  @Get('export')
  async exportCsv(@Req() req: any, @Query('saved') saved: string, @Res() res: Response) {
    const csv = await this.contacts.exportCsv(req.user.organizationId, saved === '1' || saved === 'true');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="contatos-whatsapp.csv"');
    res.send(csv);
  }
  @Post('sync') @Throttle({ default: { limit: 3, ttl: 60_000 } }) sync(@Req() req: any) { return this.contacts.sync(req.user.organizationId); }
  @Post() create(@Req() req: any, @Body() dto: CreateContactDto) { return this.contacts.createManual(req.user.organizationId, dto); }
  @Post('bulk') bulk(@Req() req: any, @Body() dto: BulkContactsDto) { return this.contacts.bulk(req.user.organizationId, dto); }
  @Post('import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * MB } }))
  importCsv(@Req() req: any, @UploadedFile() file: any) { return this.contacts.importCsv(req.user.organizationId, file?.buffer || Buffer.alloc(0)); }
  @Get(':id/check') check(@Req() req: any, @Param('id') id: string) { return this.contacts.check(req.user.organizationId, id); }
  @Get(':id/photo')
  async photo(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const p = await this.contacts.photo(req.user.organizationId, { contactId: id });
    if (!p) return res.status(404).end();
    res.setHeader('Content-Type', p.mime); res.setHeader('Cache-Control', 'private, max-age=86400');
    return res.sendFile(p.path);
  }
  @Patch(':id') patch(@Req() req: any, @Param('id') id: string, @Body() dto: PatchContactDto) { return this.contacts.patch(req.user.organizationId, id, dto); }
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

// ---------------------------------------------------------------- status
@ApiTags('WhatsApp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('whatsapp/statuses')
export class WhatsAppStatusController {
  constructor(private readonly status: WhatsAppStatusService) {}

  @Get() list(@Req() req: any, @Query() q: any) { return this.status.list(req.user.organizationId, q); }
  @Post() create(@Req() req: any, @Body() dto: CreateStatusDto) { return this.status.create(req.user.organizationId, req.user.userId, dto); }
  @Patch(':id') patch(@Req() req: any, @Param('id') id: string, @Body() dto: PatchStatusDto) { return this.status.patch(req.user.organizationId, id, dto); }
  @Delete(':id') remove(@Req() req: any, @Param('id') id: string) { return this.status.remove(req.user.organizationId, id); }
}

// ---------------------------------------------------------------- broadcasts
@ApiTags('WhatsApp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('whatsapp/broadcasts')
export class WhatsAppBroadcastsController {
  constructor(private readonly bc: WhatsAppBroadcastsService) {}

  @Get() list(@Req() req: any) { return this.bc.list(req.user.organizationId); }
  @Post() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') create(@Req() req: any, @Body() dto: BroadcastDto) { return this.bc.create(req.user.organizationId, dto); }
  @Put(':id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') update(@Req() req: any, @Param('id') id: string, @Body() dto: BroadcastDto) { return this.bc.update(req.user.organizationId, id, dto); }
  @Delete(':id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') remove(@Req() req: any, @Param('id') id: string) { return this.bc.remove(req.user.organizationId, id); }
  @Post('audience-estimate') audience(@Req() req: any, @Body() dto: AudienceDto) { return this.bc.audience(req.user.organizationId, dto.targets); }
  @Get(':id/copies') copies(@Req() req: any, @Param('id') id: string) { return this.bc.getCopies(req.user.organizationId, id); }
  @Put(':id/copies') setCopies(@Req() req: any, @Param('id') id: string, @Body() dto: CopiesDto) { return this.bc.setCopies(req.user.organizationId, id, dto.copies); }
  @Post(':id/fire') @Throttle({ default: { limit: 5, ttl: 60_000 } }) fire(@Req() req: any, @Param('id') id: string) { return this.bc.fire(req.user.organizationId, id); }
  @Get(':id/runs') runs(@Req() req: any, @Param('id') id: string, @Query() q: RunsQueryDto) { return this.bc.runs(req.user.organizationId, id, q); }
  @Get(':id/runs/:runId/sends') sends(@Req() req: any, @Param('id') id: string, @Param('runId') runId: string, @Query() q: any) { return this.bc.sends(req.user.organizationId, id, runId, q); }
}
