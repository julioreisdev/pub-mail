import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { WaAccessService } from '../wa-access.service';
import { AccessService } from '../../platform-billing/access.service';
import { WhatsAppAttendanceService } from '../whatsapp-attendance.service';
import { WhatsAppOrdersService } from './whatsapp-orders.service';
import { ORDER_STATUSES } from './wa-order.util';

export class CreateOrderDto {
  @IsArray() @ArrayMaxSize(100) items: Array<{ product_id: string; qty: number; notes?: string }>;
  @IsOptional() @ValidateIf((o) => o.customer_id !== null) @IsString() customer_id?: string | null;
  @IsOptional() @ValidateIf((o) => o.contact_id !== null) @IsString() contact_id?: string | null;
  @IsOptional() @ValidateIf((o) => o.session_id !== null) @IsString() session_id?: string | null;
  @IsOptional() @ValidateIf((o) => o.chat_id !== null) @IsString() @MaxLength(64) chat_id?: string | null;
  @IsOptional() @ValidateIf((o) => o.unit_id !== null) @IsString() unit_id?: string | null;
  @IsOptional() @IsObject() delivery?: { mode?: 'delivery' | 'pickup'; address?: unknown; address_id?: string; notes?: string };
  @IsOptional() @IsIn(['pix', 'on_delivery', 'none']) payment_method?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) discount_cents?: number;
  @IsOptional() @ValidateIf((o) => o.notes !== null) @IsString() @MaxLength(2000) notes?: string | null;
  @IsOptional() @IsObject() custom?: Record<string, unknown>;
  @IsOptional() @IsBoolean() notify?: boolean;
}
export class OrderStatusDto {
  @IsIn([...ORDER_STATUSES]) status: string;
  @IsOptional() @ValidateIf((o) => o.reason !== null) @IsString() @MaxLength(255) reason?: string | null;
  @IsOptional() @IsBoolean() notify?: boolean;
}
export class PatchOrderDto {
  @IsOptional() @ValidateIf((o) => o.notes !== null) @IsString() @MaxLength(2000) notes?: string | null;
  @IsOptional() @ValidateIf((o) => o.custom !== null) @IsObject() custom?: Record<string, unknown> | null;
  @IsOptional() @ValidateIf((o) => o.unit_id !== null) @IsString() unit_id?: string | null;
}
export class OrderSettingsDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsObject() delivery?: Record<string, unknown>;
  @IsOptional() @IsObject() pickup?: Record<string, unknown>;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) min_order_cents?: number;
  @IsOptional() @IsArray() payment_methods?: string[];
  @IsOptional() @IsInt() @Min(1) @Max(100) max_items?: number;
  @IsOptional() @IsInt() @Min(5) @Max(1440) pix_minutes?: number;
  @IsOptional() @IsObject() notify_customer?: Record<string, boolean>;
  @IsOptional() @IsObject() texts?: Record<string, string>;
}

const UUID_RE = /^[0-9a-f-]{36}$/i;
const ADMIN = ['OWNER', 'ADMIN', 'SUPER_ADMIN'] as const;

// Pedidos (Fase 7, contrato §11.3). Configurações só dono/admin; pedidos: qualquer usuário com o módulo.
// Pedido de um número que o usuário não vê → 404 (sem número = todos veem). Criar só por números que o usuário usa
// (inclusive o número resolvido pelo cliente — P7-14). Dinheiro (revisão 14/10/2026, P7-5): desconto > 0 ou
// "sem pagamento" exigem a sub-permissão `whatsapp:finance`; "marcar pago" = dono/admin + `whatsapp:finance` (regra
// no `modules.const.ts`), igual à baixa manual de cobrança.
@ApiTags('WhatsApp Pedidos')
@UseGuards(JwtAuthGuard)
@Controller('whatsapp/orders')
export class WhatsAppOrdersController {
  constructor(private readonly svc: WhatsAppOrdersService, private readonly access: WaAccessService, private readonly attendance: WhatsAppAttendanceService, private readonly billing: AccessService) {}

  private org(req: any) { return req.user.organizationId as string; }
  private by(req: any) { return { by: 'staff' as const, user_id: req.user.userId as string }; }
  private async assertOrder(req: any, id: string) {
    const sid = await this.svc.sessionOf(this.org(req), id);
    if (sid && !(await this.access.canUse(req.user, sid))) throw new NotFoundException('Pedido não encontrado.');
  }
  private async assertFinance(req: any, what: string) {
    if ((ADMIN as readonly string[]).includes(req.user?.role)) return;
    const perms = await this.billing.getUserPermissions(req.user.userId);
    if (!perms.includes('whatsapp:finance')) throw new ForbiddenException({ statusCode: 403, code: 'PERMISSION_DENIED', permission: 'whatsapp:finance', message: `${what} exige a permissão "Cobranças e financeiro".` });
  }
  private async assertTarget(req: any, dto: { session_id?: string | null; chat_id?: string | null }) {
    if (dto.chat_id && UUID_RE.test(dto.chat_id) && !dto.chat_id.includes('@')) await this.access.assertChat(req.user, await this.attendance.chatRow(this.org(req), dto.chat_id));
    else if (dto.session_id) await this.access.assertSession(req.user, dto.session_id);
  }

  @Get('settings') settings(@Req() req: any) { return this.svc.settings(this.org(req)); }
  @Put('settings') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...ADMIN) updateSettings(@Req() req: any, @Body() dto: OrderSettingsDto) { return this.svc.updateSettings(this.org(req), dto); }
  @Get('catalog') catalog(@Req() req: any) { return this.svc.catalog(this.org(req)); }
  @Get('counts') async counts(@Req() req: any, @Query() q: any) { return this.svc.counts(this.org(req), await this.access.allowedIds(req.user), q); }
  @Get('board') async board(@Req() req: any, @Query() q: any) { return this.svc.board(this.org(req), q, await this.access.allowedIds(req.user)); }
  @Get('by-chat/:chatId') async byChat(@Req() req: any, @Param('chatId') chatId: string) {
    await this.access.assertChat(req.user, await this.attendance.chatRow(this.org(req), chatId));
    return this.svc.byChat(this.org(req), chatId, await this.access.allowedIds(req.user));
  }
  @Get() async list(@Req() req: any, @Query() q: any) { return this.svc.list(this.org(req), q, await this.access.allowedIds(req.user)); }
  @Post() @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async create(@Req() req: any, @Body() dto: CreateOrderDto) {
    await this.assertTarget(req, dto);
    if ((Number(dto.discount_cents) || 0) > 0) await this.assertFinance(req, 'Dar desconto');
    if (dto.payment_method === 'none') await this.assertFinance(req, 'Pedido sem pagamento');
    return this.svc.create(this.org(req), { ...dto, source: 'panel', user_id: req.user.userId, allowed: await this.access.allowedIds(req.user) } as any);
  }
  @Get(':id') async get(@Req() req: any, @Param('id') id: string) { await this.assertOrder(req, id); return this.svc.get(this.org(req), id); }
  @Patch(':id') async patch(@Req() req: any, @Param('id') id: string, @Body() dto: PatchOrderDto) { await this.assertOrder(req, id); return this.svc.update(this.org(req), id, dto, this.by(req)); }
  @Post(':id/status') async status(@Req() req: any, @Param('id') id: string, @Body() dto: OrderStatusDto) { await this.assertOrder(req, id); return this.svc.setStatus(this.org(req), id, dto, this.by(req)); }
  @Post(':id/mark-paid') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...ADMIN) async markPaid(@Req() req: any, @Param('id') id: string) { await this.assertOrder(req, id); return this.svc.markPaid(this.org(req), id, this.by(req)); }
}
