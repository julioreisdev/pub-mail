import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TelegramBroadcastsService } from './telegram-broadcasts.service';
import { TelegramBroadcastsRunner } from './telegram-broadcasts.runner';

@ApiTags('Telegram - Broadcasts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('telegram/broadcasts')
export class TelegramBroadcastsController {
  constructor(
    private readonly service: TelegramBroadcastsService,
    private readonly runner: TelegramBroadcastsRunner,
  ) {}

  @Get()
  list(@Req() req: any) {
    return this.service.list(req.user.organizationId);
  }

  @Post('audience-estimate')
  @ApiOperation({ summary: 'Estima a audiência (DMs + grupos + canais).' })
  estimate(@Req() req: any, @Body() dto: any) {
    return this.service.audienceEstimate(req.user.organizationId, dto || {});
  }

  @Post()
  create(@Req() req: any, @Body() dto: any) {
    return this.service.create(req.user.organizationId, dto || {});
  }

  @Get(':id')
  get(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.get(req.user.organizationId, id);
  }

  @Put(':id')
  update(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: any) {
    return this.service.update(req.user.organizationId, id, dto || {});
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.remove(req.user.organizationId, id);
  }

  @Get(':id/copies')
  listCopies(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.listCopies(req.user.organizationId, id);
  }

  @Put(':id/copies')
  saveCopies(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: any) {
    return this.service.saveCopies(req.user.organizationId, id, dto?.copies || []);
  }

  @Get(':id/runs')
  runs(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string, @Query() q: any) {
    return this.service.listRuns(req.user.organizationId, id, q || {});
  }

  @Post(':id/fire')
  @ApiOperation({ summary: 'Disparar agora (manual).' })
  fire(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.runner.fireNow(req.user.organizationId, id);
  }
}
