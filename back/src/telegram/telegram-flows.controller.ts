import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TelegramFlowsService } from './telegram-flows.service';

class SaveFlowDto {
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsObject()
  definition?: Record<string, any>;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  start_node_id?: string;
}

@ApiTags('Telegram - Flows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('telegram')
export class TelegramFlowsController {
  constructor(private readonly service: TelegramFlowsService) {}

  @Get('bots/:id/flow')
  @ApiOperation({ summary: 'Lê o fluxo inicial do bot.' })
  getFlow(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.getFlow(req.user.organizationId, id);
  }

  @Put('bots/:id/flow')
  @ApiOperation({ summary: 'Salva o fluxo inicial do bot.' })
  saveFlow(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: SaveFlowDto) {
    return this.service.saveFlow(req.user.organizationId, id, dto);
  }
}
