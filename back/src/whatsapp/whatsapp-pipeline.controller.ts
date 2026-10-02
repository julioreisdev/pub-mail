import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WhatsAppPipelineService } from './whatsapp-pipeline.service';
import { WhatsAppTasksService } from './whatsapp-tasks.service';
import { WhatsAppNotesService } from './whatsapp-notes.service';
import { DealDto, MoveChatDto, NoteDto, ReorderStagesDto, StageDto, TaskDto } from './dto/whatsapp-pipeline.dto';

// Funil (Kanban) — etapas só dono/admin; mover conversas qualquer atendente.
@ApiTags('WhatsApp CRM')
@UseGuards(JwtAuthGuard)
@Controller('whatsapp/pipeline')
export class WhatsAppPipelineController {
  constructor(private readonly pipeline: WhatsAppPipelineService) {}

  @Get('stages') stages(@Req() req: any) { return this.pipeline.stages(req.user.organizationId); }
  @Post('stages') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') createStage(@Req() req: any, @Body() dto: StageDto) { return this.pipeline.createStage(req.user.organizationId, dto); }
  @Put('stages/reorder') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') reorder(@Req() req: any, @Body() dto: ReorderStagesDto) { return this.pipeline.reorderStages(req.user.organizationId, dto.ids); }
  @Put('stages/:id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') updateStage(@Req() req: any, @Param('id') id: string, @Body() dto: StageDto) { return this.pipeline.updateStage(req.user.organizationId, id, dto); }
  @Delete('stages/:id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') deleteStage(@Req() req: any, @Param('id') id: string, @Query('move_to') moveTo?: string) { return this.pipeline.deleteStage(req.user.organizationId, id, moveTo || null); }

  @Get('automation') automation(@Req() req: any) { return this.pipeline.automation(req.user.organizationId); }
  @Put('automation') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') updateAutomation(@Req() req: any, @Body() dto: any) { return this.pipeline.updateAutomation(req.user.organizationId, dto || {}); }
  @Get('board') board(@Req() req: any, @Query() q: any) { return this.pipeline.board(req.user.organizationId, { ...q, user_id: req.user.userId }); }
  @Get('chat/:chatId') ofChat(@Req() req: any, @Param('chatId') chatId: string) { return this.pipeline.ofChat(req.user.organizationId, chatId); }
  @Post('move') move(@Req() req: any, @Body() dto: MoveChatDto) { return this.pipeline.move(req.user.organizationId, req.user.userId, dto); }
  @Put('deal') deal(@Req() req: any, @Body() dto: DealDto) { return this.pipeline.move(req.user.organizationId, req.user.userId, { chat_id: dto.chat_id, stage_id: undefined, deal_cents: dto.deal_cents ?? null }); }
}

@ApiTags('WhatsApp CRM')
@UseGuards(JwtAuthGuard)
@Controller('whatsapp/tasks')
export class WhatsAppTasksController {
  constructor(private readonly tasks: WhatsAppTasksService) {}

  @Get() list(@Req() req: any, @Query() q: any) { return this.tasks.list(req.user.organizationId, req.user.userId, q); }
  @Get('counts') counts(@Req() req: any) { return this.tasks.counts(req.user.organizationId, req.user.userId); }
  @Post() create(@Req() req: any, @Body() dto: TaskDto) { return this.tasks.create(req.user.organizationId, req.user.userId, dto); }
  @Put(':id') update(@Req() req: any, @Param('id') id: string, @Body() dto: TaskDto) { return this.tasks.update(req.user.organizationId, req.user.userId, id, dto); }
  @Post(':id/done') done(@Req() req: any, @Param('id') id: string) { return this.tasks.setDone(req.user.organizationId, req.user.userId, id, true); }
  @Post(':id/reopen') reopen(@Req() req: any, @Param('id') id: string) { return this.tasks.setDone(req.user.organizationId, req.user.userId, id, false); }
  @Delete(':id') remove(@Req() req: any, @Param('id') id: string) { return this.tasks.remove(req.user.organizationId, id); }
}

@ApiTags('WhatsApp CRM')
@UseGuards(JwtAuthGuard)
@Controller('whatsapp/chats/:chatId/notes')
export class WhatsAppNotesController {
  constructor(private readonly notes: WhatsAppNotesService) {}

  @Get() list(@Req() req: any, @Param('chatId') chatId: string) { return this.notes.list(req.user.organizationId, chatId); }
  @Post() create(@Req() req: any, @Param('chatId') chatId: string, @Body() dto: NoteDto) { return this.notes.create(req.user.organizationId, req.user.userId, chatId, dto); }
  @Put(':id') update(@Req() req: any, @Param('chatId') chatId: string, @Param('id') id: string, @Body() dto: NoteDto) { return this.notes.update(req.user.organizationId, req.user.userId, req.user.role, chatId, id, dto); }
  @Delete(':id') remove(@Req() req: any, @Param('chatId') chatId: string, @Param('id') id: string) { return this.notes.remove(req.user.organizationId, req.user.userId, req.user.role, chatId, id); }
}
