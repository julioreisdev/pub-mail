import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TelegramRotatorsService } from './telegram-rotators.service';

@ApiTags('Telegram - Rotators')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('telegram/rotators')
export class TelegramRotatorsController {
  constructor(private readonly service: TelegramRotatorsService) {}

  @Get()
  list(@Req() req: any) {
    return this.service.list(req.user.organizationId);
  }

  @Post()
  create(@Req() req: any, @Body() dto: any) {
    return this.service.create(req.user.organizationId, dto || {});
  }

  @Put(':id')
  update(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: any) {
    return this.service.update(req.user.organizationId, id, dto || {});
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.remove(req.user.organizationId, id);
  }
}
