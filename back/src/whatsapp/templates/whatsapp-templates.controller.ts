import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ArrayMaxSize, IsArray, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { WhatsAppTemplatesService } from './whatsapp-templates.service';

export class ApplyTemplateDto { @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) parts?: string[]; }

// Modelos por ramo (Fase 7, contrato §11.6). Aplicar = só dono/admin.
@ApiTags('WhatsApp Modelos')
@UseGuards(JwtAuthGuard)
@Controller('whatsapp/templates')
export class WhatsAppTemplatesController {
  constructor(private readonly svc: WhatsAppTemplatesService) {}

  @Get() list() { return this.svc.list(); }
  @Get(':key') get(@Param('key') key: string) { return this.svc.full(key); }
  @Post(':key/apply') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') @Throttle({ default: { limit: 10, ttl: 60_000 } })
  apply(@Req() req: any, @Param('key') key: string, @Body() dto: ApplyTemplateDto) { return this.svc.apply(req.user.organizationId, key, dto?.parts || null); }
}
