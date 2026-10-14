import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WhatsAppUnitsService } from './whatsapp-units.service';

export class UnitDto {
  @IsString() @MaxLength(120) name: string;
  @IsOptional() @ValidateIf((o) => o.code !== null) @IsString() @MaxLength(32) code?: string | null;
  @IsOptional() @ValidateIf((o) => o.address !== null) @IsObject() address?: Record<string, unknown> | null;
  @IsOptional() @ValidateIf((o) => o.phone !== null) @IsString() @MaxLength(32) phone?: string | null;
  @IsOptional() @ValidateIf((o) => o.session_id !== null) @IsString() session_id?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(10_000) position?: number;
  @IsOptional() @ValidateIf((o) => o.custom !== null) @IsObject() custom?: Record<string, unknown> | null;
}
export class UpdateUnitDto extends PartialType(UnitDto) {}
export class ReorderUnitsDto { @IsArray() @ArrayMaxSize(200) @IsString({ each: true }) ids: string[]; }

const ADMIN = ['OWNER', 'ADMIN', 'SUPER_ADMIN'] as const;

// Unidades / filiais (Fase 7, contrato §11.2). Leitura: todos com o módulo; escrita: dono/admin.
@ApiTags('WhatsApp Unidades')
@UseGuards(JwtAuthGuard)
@Controller('whatsapp/units')
export class WhatsAppUnitsController {
  constructor(private readonly svc: WhatsAppUnitsService) {}
  private org(req: any) { return req.user.organizationId as string; }

  @Get() list(@Req() req: any) { return this.svc.list(this.org(req)); }
  @Post() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...ADMIN) create(@Req() req: any, @Body() dto: UnitDto) { return this.svc.create(this.org(req), dto); }
  @Put('reorder') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...ADMIN) reorder(@Req() req: any, @Body() dto: ReorderUnitsDto) { return this.svc.reorder(this.org(req), dto.ids); }
  @Put(':id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...ADMIN) update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateUnitDto) { return this.svc.update(this.org(req), id, dto); }
  @Delete(':id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...ADMIN) remove(@Req() req: any, @Param('id') id: string) { return this.svc.remove(this.org(req), id); }
}
