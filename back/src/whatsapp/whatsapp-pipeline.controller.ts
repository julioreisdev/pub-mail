import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WhatsAppPipelineService } from './whatsapp-pipeline.service';
import { WhatsAppTasksService } from './whatsapp-tasks.service';
import { WhatsAppNotesService } from './whatsapp-notes.service';
import { WhatsAppChatService } from './whatsapp-chat.service';
import { WaAccessService } from './wa-access.service';
import { DealDto, DeleteTaskListDto, MoveChatDto, MoveTaskDto, NoteDto, ReorderStagesDto, StageDto, TaskDto, TaskLabelDto, TaskListDto } from './dto/whatsapp-pipeline.dto';

// Funil (Kanban) — etapas só dono/admin; mover conversas qualquer atendente.
// Multi-número: `chat_id`/`:chatId` = uuid da conversa; toda rota por conversa confere se o usuário
// pode ver o NÚMERO dela (WaAccessService): número alheio = 404. Listagens filtram pelos números permitidos.
@ApiTags('WhatsApp CRM')
@UseGuards(JwtAuthGuard)
@Controller('whatsapp/pipeline')
export class WhatsAppPipelineController {
  constructor(private readonly pipeline: WhatsAppPipelineService, private readonly chat: WhatsAppChatService, private readonly access: WaAccessService) {}

  private async guardChat(req: any, chatUuid: string) {
    const chat = await this.chat.chatRow(req.user.organizationId, String(chatUuid || ''));
    await this.access.assertChat(req.user, chat);
    return chat;
  }

  @Get('stages') stages(@Req() req: any) { return this.pipeline.stages(req.user.organizationId); }
  @Post('stages') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') createStage(@Req() req: any, @Body() dto: StageDto) { return this.pipeline.createStage(req.user.organizationId, dto); }
  @Put('stages/reorder') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') reorder(@Req() req: any, @Body() dto: ReorderStagesDto) { return this.pipeline.reorderStages(req.user.organizationId, dto.ids); }
  @Put('stages/:id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') updateStage(@Req() req: any, @Param('id') id: string, @Body() dto: StageDto) { return this.pipeline.updateStage(req.user.organizationId, id, dto); }
  @Delete('stages/:id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') deleteStage(@Req() req: any, @Param('id') id: string, @Query('move_to') moveTo?: string) { return this.pipeline.deleteStage(req.user.organizationId, id, moveTo || null); }

  @Get('automation') automation(@Req() req: any) { return this.pipeline.automation(req.user.organizationId); }
  @Put('automation') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') updateAutomation(@Req() req: any, @Body() dto: any) { return this.pipeline.updateAutomation(req.user.organizationId, dto || {}); }
  @Get('board') async board(@Req() req: any, @Query() q: any) { return this.pipeline.board(req.user.organizationId, { ...q, user_id: req.user.userId }, await this.access.allowedIds(req.user)); }
  @Get('chat/:chatId') async ofChat(@Req() req: any, @Param('chatId') chatId: string) { await this.guardChat(req, chatId); return this.pipeline.ofChat(req.user.organizationId, chatId); }
  @Post('move') async move(@Req() req: any, @Body() dto: MoveChatDto) { await this.guardChat(req, dto.chat_id); return this.pipeline.move(req.user.organizationId, req.user.userId, dto); }
  @Put('deal') async deal(@Req() req: any, @Body() dto: DealDto) { await this.guardChat(req, dto.chat_id); return this.pipeline.move(req.user.organizationId, req.user.userId, { chat_id: dto.chat_id, stage_id: undefined, deal_cents: dto.deal_cents ?? null }); }
}

@ApiTags('WhatsApp CRM')
@UseGuards(JwtAuthGuard)
@Controller('whatsapp/tasks')
export class WhatsAppTasksController {
  constructor(private readonly tasks: WhatsAppTasksService, private readonly chat: WhatsAppChatService, private readonly access: WaAccessService) {}

  /** Tarefa ligada a uma conversa de número alheio = 404 (tarefa sem conversa é de todos). */
  private async guardTask(req: any, id: string) {
    const sessionId = await this.tasks.sessionOf(req.user.organizationId, id);
    if (sessionId) await this.access.assertChat(req.user, { session_id: sessionId });
  }
  private async guardChatId(req: any, chatUuid?: string | null) {
    if (!chatUuid) return;
    await this.access.assertChat(req.user, await this.chat.chatRow(req.user.organizationId, String(chatUuid)));
  }

  // quadro (Trello) — rotas fixas antes das com :id
  @Get('board') async board(@Req() req: any, @Query() q: any) { return this.tasks.board(req.user.organizationId, req.user.userId, q, await this.access.allowedIds(req.user)); }
  @Get('lists') lists(@Req() req: any) { return this.tasks.lists(req.user.organizationId); }
  @Post('lists') createList(@Req() req: any, @Body() dto: TaskListDto) { return this.tasks.createList(req.user.organizationId, dto, req.user.userId); }
  @Put('lists/reorder') reorderLists(@Req() req: any, @Body() dto: ReorderStagesDto) { return this.tasks.reorderLists(req.user.organizationId, dto.ids, req.user.userId); }
  @Put('lists/:listId') updateList(@Req() req: any, @Param('listId') listId: string, @Body() dto: TaskListDto) { return this.tasks.updateList(req.user.organizationId, listId, dto, req.user.userId); }
  @Post('lists/:listId/delete') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') deleteList(@Req() req: any, @Param('listId') listId: string, @Body() dto: DeleteTaskListDto) { return this.tasks.deleteList(req.user.organizationId, listId, dto || {}, req.user.userId); }
  @Post('lists/:listId/clear') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') clearList(@Req() req: any, @Param('listId') listId: string) { return this.tasks.clearList(req.user.organizationId, listId, req.user.userId); }
  @Get('labels') labels(@Req() req: any) { return this.tasks.labels(req.user.organizationId); }
  @Post('labels') createLabel(@Req() req: any, @Body() dto: TaskLabelDto) { return this.tasks.createLabel(req.user.organizationId, dto, req.user.userId); }
  @Put('labels/:labelId') updateLabel(@Req() req: any, @Param('labelId') labelId: string, @Body() dto: TaskLabelDto) { return this.tasks.updateLabel(req.user.organizationId, labelId, dto, req.user.userId); }
  @Delete('labels/:labelId') deleteLabel(@Req() req: any, @Param('labelId') labelId: string) { return this.tasks.deleteLabel(req.user.organizationId, labelId, req.user.userId); }

  @Get() async list(@Req() req: any, @Query() q: any) { return this.tasks.list(req.user.organizationId, req.user.userId, q, await this.access.allowedIds(req.user)); }
  @Get('counts') async counts(@Req() req: any, @Query('session_id') sessionId?: string) { return this.tasks.counts(req.user.organizationId, req.user.userId, await this.access.allowedIds(req.user), sessionId || null); }
  @Post() async create(@Req() req: any, @Body() dto: TaskDto) { await this.guardChatId(req, dto.chat_id); return this.tasks.create(req.user.organizationId, req.user.userId, dto); }
  @Put(':id') async update(@Req() req: any, @Param('id') id: string, @Body() dto: TaskDto) { await this.guardTask(req, id); await this.guardChatId(req, dto.chat_id); return this.tasks.update(req.user.organizationId, req.user.userId, id, dto); }
  @Post(':id/move') async move(@Req() req: any, @Param('id') id: string, @Body() dto: MoveTaskDto) { await this.guardTask(req, id); return this.tasks.move(req.user.organizationId, req.user.userId, id, dto); }
  @Post(':id/done') async done(@Req() req: any, @Param('id') id: string) { await this.guardTask(req, id); return this.tasks.setDone(req.user.organizationId, req.user.userId, id, true); }
  @Post(':id/reopen') async reopen(@Req() req: any, @Param('id') id: string) { await this.guardTask(req, id); return this.tasks.setDone(req.user.organizationId, req.user.userId, id, false); }
  @Delete(':id') async remove(@Req() req: any, @Param('id') id: string) { await this.guardTask(req, id); return this.tasks.remove(req.user.organizationId, id); }
}

@ApiTags('WhatsApp CRM')
@UseGuards(JwtAuthGuard)
@Controller('whatsapp/chats/:chatId/notes')
export class WhatsAppNotesController {
  constructor(private readonly notes: WhatsAppNotesService, private readonly chat: WhatsAppChatService, private readonly access: WaAccessService) {}

  private async guard(req: any, chatUuid: string) {
    await this.access.assertChat(req.user, await this.chat.chatRow(req.user.organizationId, String(chatUuid || '')));
  }

  @Get() async list(@Req() req: any, @Param('chatId') chatId: string) { await this.guard(req, chatId); return this.notes.list(req.user.organizationId, chatId); }
  @Post() async create(@Req() req: any, @Param('chatId') chatId: string, @Body() dto: NoteDto) { await this.guard(req, chatId); return this.notes.create(req.user.organizationId, req.user.userId, chatId, dto); }
  @Put(':id') async update(@Req() req: any, @Param('chatId') chatId: string, @Param('id') id: string, @Body() dto: NoteDto) { await this.guard(req, chatId); return this.notes.update(req.user.organizationId, req.user.userId, req.user.role, chatId, id, dto); }
  @Delete(':id') async remove(@Req() req: any, @Param('chatId') chatId: string, @Param('id') id: string) { await this.guard(req, chatId); return this.notes.remove(req.user.organizationId, req.user.userId, req.user.role, chatId, id); }
}
