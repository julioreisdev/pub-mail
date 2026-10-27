import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

class PushKeysDto {
  @IsString() @MaxLength(255) p256dh!: string;
  @IsString() @MaxLength(64) auth!: string;
}
class SubscribeDto {
  @IsString() @MaxLength(4000) endpoint!: string;
  @ValidateNested() @Type(() => PushKeysDto) keys!: PushKeysDto;
  @IsOptional() @IsString() @MaxLength(255) user_agent?: string;
  @IsOptional() @IsString() @MaxLength(80) device_label?: string;
  @IsOptional() @IsString() @MaxLength(64) device_id?: string;
}
class UnsubscribeDto {
  @IsOptional() @IsString() id?: string;
  @IsOptional() @IsString() @MaxLength(4000) endpoint?: string;
}
class TouchDto {
  @IsString() @MaxLength(4000) endpoint!: string;
}
class PrefsDto {
  @IsObject() prefs!: Record<string, unknown>;
}
class TestDto {
  @IsOptional() @IsIn(['push', 'inapp', 'both']) channel?: 'push' | 'inapp' | 'both';
}
class ReadDto {
  @IsOptional() @IsArray() ids?: string[];
}
class CustomDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(500) body?: string | null;
  @IsOptional() @IsString() @MaxLength(500) url?: string | null;
  @IsOptional() @IsString() @MaxLength(16) emoji?: string | null;
  @IsOptional() @IsString() @MaxLength(500) icon_url?: string | null;
  @IsOptional() @IsString() sound?: string;
  @IsOptional() @IsString() vibrate?: string;
  @IsOptional() @IsBoolean() important?: boolean;
  @IsOptional() @IsObject() recipients?: Record<string, unknown>;
  @IsOptional() schedule_at?: string | null;
}
class FireDto {
  @IsOptional() @IsBoolean() only_me?: boolean;
}

// Qualquer usuário logado (sem módulo): a tela fica no grupo WhatsApp, mas o chat da equipe e os
// avisos personalizados valem para todos. `/notifications` não está no mapa de módulos.
@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get('catalog') catalog() { return this.svc.catalog(); }
  @Get('people') people(@Req() req: any) { return this.svc.people(req.user.organizationId); }

  @Get('prefs') prefs(@Req() req: any) { return this.svc.getPrefs(req.user.organizationId, req.user.userId); }
  @Put('prefs') setPrefs(@Req() req: any, @Body() dto: PrefsDto) { return this.svc.setPrefs(req.user.organizationId, req.user.userId, dto.prefs); }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('icon')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  icon(@Req() req: any, @UploadedFile() file: any, @Query('slot') slot?: string) { return this.svc.saveIcon(req.user.organizationId, req.user.userId, file, slot); }

  @Get('subscriptions') subs(@Req() req: any) { return this.svc.listSubscriptions(req.user.organizationId, req.user.userId); }
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('subscriptions') subscribe(@Req() req: any, @Body() dto: SubscribeDto) { return this.svc.subscribe(req.user.organizationId, req.user.userId, { ...dto, user_agent: dto.user_agent || req.headers['user-agent'] }); }
  @Post('subscriptions/touch') touch(@Req() req: any, @Body() dto: TouchDto) { return this.svc.touchSubscription(req.user.organizationId, req.user.userId, dto.endpoint).then(() => ({ ok: true })); }
  @Delete('subscriptions') unsubscribe(@Req() req: any, @Body() dto: UnsubscribeDto) { return this.svc.unsubscribe(req.user.organizationId, req.user.userId, dto); }
  @Delete('subscriptions/:id') unsubscribeById(@Req() req: any, @Param('id') id: string) { return this.svc.unsubscribe(req.user.organizationId, req.user.userId, { id }); }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('test') test(@Req() req: any, @Body() dto: TestDto) { return this.svc.sendTest(req.user.organizationId, req.user.userId, dto?.channel || 'both'); }

  @Get('history') history(@Req() req: any, @Query('page') page?: string, @Query('size') size?: string) { return this.svc.history(req.user.organizationId, req.user.userId, Number(page) || 1, Number(size) || 50); }
  @Post('history/read') read(@Req() req: any, @Body() dto: ReadDto) { return this.svc.markRead(req.user.organizationId, req.user.userId, dto?.ids); }
  @Delete('history') clear(@Req() req: any) { return this.svc.clearHistory(req.user.organizationId, req.user.userId); }

  @Get('custom') listCustom(@Req() req: any) { return this.svc.listCustom(req.user.organizationId, req.user.userId, req.user.role); }
  @Post('custom') createCustom(@Req() req: any, @Body() dto: CustomDto) { return this.svc.createCustom(req.user.organizationId, req.user.userId, req.user.role, dto); }
  @Put('custom/:id') updateCustom(@Req() req: any, @Param('id') id: string, @Body() dto: CustomDto) { return this.svc.updateCustom(req.user.organizationId, req.user.userId, req.user.role, id, dto); }
  @Delete('custom/:id') deleteCustom(@Req() req: any, @Param('id') id: string) { return this.svc.deleteCustom(req.user.organizationId, req.user.userId, req.user.role, id); }
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('custom/:id/fire') fire(@Req() req: any, @Param('id') id: string, @Body() dto: FireDto) { return this.svc.fireCustom(req.user.organizationId, req.user.userId, req.user.role, id, { onlyMe: Boolean(dto?.only_me) }); }
}
