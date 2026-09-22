import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SendMessageDto } from './dto/send-message.dto';
import { TelegramChatService } from './telegram-chat.service';

@ApiTags('Telegram - Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('telegram')
export class TelegramChatController {
  constructor(private readonly service: TelegramChatService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'Lista conversas (contatos) de um bot, paginado 30/vez, com busca server-side.' })
  conversations(
    @Req() req: any,
    @Query('bot_id') botId: string,
    @Query('q') q: string,
    @Query('page') page: string,
  ) {
    if (!botId) throw new BadRequestException('Informe o bot_id.');
    return this.service.listConversations(req.user.organizationId, botId, q, Number(page) || 1);
  }

  @Get('groups')
  @ApiOperation({ summary: 'Lista grupos onde o bot está.' })
  groups(@Req() req: any, @Query('bot_id') botId: string) {
    if (!botId) throw new BadRequestException('Informe o bot_id.');
    return this.service.listGroups(req.user.organizationId, botId);
  }

  @Get('channels')
  @ApiOperation({ summary: 'Lista canais onde o bot é admin.' })
  channels(@Req() req: any, @Query('bot_id') botId: string) {
    if (!botId) throw new BadRequestException('Informe o bot_id.');
    return this.service.listChannels(req.user.organizationId, botId);
  }

  @Get('messages')
  @ApiOperation({ summary: 'Mensagens de um chat (kind=CONTACT|GROUP, id). since=ISO p/ polling incremental.' })
  messages(
    @Req() req: any,
    @Query('kind') kind: string,
    @Query('id') id: string,
    @Query('since') since?: string,
  ) {
    if (!kind || !id) throw new BadRequestException('Informe kind e id.');
    return this.service.getMessages(req.user.organizationId, kind, id, since);
  }

  @Post('messages')
  @UseInterceptors(
    FileInterceptor('photo', { storage: memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } }),
  )
  @ApiOperation({ summary: 'Envia mensagem (texto e/ou foto) para um contato ou grupo.' })
  send(@Req() req: any, @Body() dto: SendMessageDto, @UploadedFile() photo?: Express.Multer.File) {
    const file = photo ? { buffer: photo.buffer, originalname: photo.originalname } : undefined;
    return this.service.send(req.user.organizationId, dto.kind, dto.id, dto.text, file);
  }

  @Get('contacts/:id/photo')
  @ApiOperation({ summary: 'Proxy da foto de perfil do contato (token fica no server).' })
  async contactPhoto(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string, @Res() res: Response) {
    const r = await this.service.getContactPhoto(req.user.organizationId, id).catch(() => null);
    if (!r) {
      res.status(404).end();
      return;
    }
    res.setHeader('Content-Type', r.contentType);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.end(r.buffer);
  }

  @Post('groups/:id/leave')
  @ApiOperation({ summary: 'O bot sai do grupo (e remove o grupo).' })
  leaveGroup(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.leaveGroup(req.user.organizationId, id);
  }

  @Get('groups/:id/invite-link')
  @ApiOperation({ summary: 'Link de convite do grupo (público=t.me/@; privado=gera via bot admin).' })
  inviteLink(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.getGroupInviteLink(req.user.organizationId, id);
  }

  @Get('groups/:id/photo')
  @ApiOperation({ summary: 'Proxy da foto do grupo.' })
  async groupPhoto(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string, @Res() res: Response) {
    const r = await this.service.getGroupPhoto(req.user.organizationId, id).catch(() => null);
    if (!r) {
      res.status(404).end();
      return;
    }
    res.setHeader('Content-Type', r.contentType);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.end(r.buffer);
  }

  @Get('messages/:id/media')
  @ApiOperation({ summary: 'Proxy da mídia (foto/sticker) de uma mensagem.' })
  async messageMedia(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string, @Res() res: Response) {
    const r = await this.service.getMessageMedia(req.user.organizationId, id).catch(() => null);
    if (!r) {
      res.status(404).end();
      return;
    }
    res.setHeader('Content-Type', r.contentType);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.end(r.buffer);
  }
}
