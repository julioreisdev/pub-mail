import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { IsArray, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TelegramAutomationsService } from './telegram-automations.service';

class AutomationDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  steps?: any[];
}

@ApiTags('Telegram - Automations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('telegram')
export class TelegramAutomationsController {
  constructor(private readonly service: TelegramAutomationsService) {}

  @Get('bots/:id/automations')
  @ApiOperation({ summary: 'Lista automações do bot.' })
  list(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.list(req.user.organizationId, id);
  }

  @Post('bots/:id/automations')
  @ApiOperation({ summary: 'Cria automação.' })
  create(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: AutomationDto) {
    return this.service.create(req.user.organizationId, id, dto);
  }

  @Put('bots/:id/automations/:autoId')
  @ApiOperation({ summary: 'Atualiza automação.' })
  update(
    @Req() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('autoId', new ParseUUIDPipe()) autoId: string,
    @Body() dto: AutomationDto,
  ) {
    return this.service.update(req.user.organizationId, id, autoId, dto);
  }

  @Delete('bots/:id/automations/:autoId')
  @ApiOperation({ summary: 'Exclui automação.' })
  remove(
    @Req() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('autoId', new ParseUUIDPipe()) autoId: string,
  ) {
    return this.service.remove(req.user.organizationId, id, autoId);
  }
}
