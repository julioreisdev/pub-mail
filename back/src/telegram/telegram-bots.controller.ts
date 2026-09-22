import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateBotDto, UpdateBotDto } from './dto/bot.dto';
import { UpdateBotProfileDto } from './dto/bot-profile.dto';
import { TelegramBotsService } from './telegram-bots.service';

@ApiTags('Telegram - Bots')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('telegram/bots')
export class TelegramBotsController {
  constructor(private readonly service: TelegramBotsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista os bots do Telegram da organização.' })
  list(@Req() req: any) {
    return this.service.list(req.user.organizationId);
  }

  @Post()
  @ApiOperation({ summary: 'Cadastra um bot (valida o token no Telegram e seta o webhook).' })
  create(@Req() req: any, @Body() dto: CreateBotDto) {
    return this.service.create(req.user.organizationId, dto.name, dto.token);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza o apelido e/ou o token do bot.' })
  update(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateBotDto) {
    return this.service.update(req.user.organizationId, id, dto);
  }

  @Post(':id/revalidate')
  @ApiOperation({ summary: 'Reconsulta o Telegram (getMe), atualiza status/info e re-seta o webhook.' })
  revalidate(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.revalidate(req.user.organizationId, id);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Envia uma mensagem de teste ao chat do dono (quem deu /start no bot).' })
  test(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.sendTest(req.user.organizationId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Exclui o bot (e tudo vinculado a ele).' })
  remove(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.remove(req.user.organizationId, id);
  }

  @Get(':id/photo')
  @ApiOperation({ summary: 'Proxy da foto de perfil do bot.' })
  async photo(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string, @Res() res: Response) {
    const r = await this.service.getBotPhoto(req.user.organizationId, id).catch(() => null);
    if (!r) {
      res.status(404).end();
      return;
    }
    res.setHeader('Content-Type', r.contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.end(r.buffer);
  }

  @Get(':id/profile')
  @ApiOperation({ summary: 'Lê o perfil do bot (nome/descrição/sobre/comandos/privacidade).' })
  getProfile(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.getProfile(req.user.organizationId, id);
  }

  @Patch(':id/profile')
  @ApiOperation({ summary: 'Atualiza o perfil do bot via Bot API.' })
  updateProfile(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateBotProfileDto) {
    return this.service.updateProfile(req.user.organizationId, id, dto);
  }
}
