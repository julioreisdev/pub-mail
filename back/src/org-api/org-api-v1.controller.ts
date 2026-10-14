import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { OrgApiKeyGuard } from './api-key.guard';
import { ApiScopes } from './api-scopes';
import { OrgApiV1Service } from './org-api-v1.service';
import { WhatsAppSchedulingService } from '../whatsapp/scheduling/whatsapp-scheduling.service';
import { WhatsAppTicketsService } from '../whatsapp/tickets/whatsapp-tickets.service';
import { WhatsAppOrdersService } from '../whatsapp/orders/whatsapp-orders.service';
import { CreateOrderDto, OrderStatusDto } from '../whatsapp/orders/whatsapp-orders.controller';
import { CreateTicketDto, PatchTicketDto, TicketCommentDto } from '../whatsapp/tickets/dto/whatsapp-tickets.dto';
import {
  ApiCancelSubscriptionDto, ApiChangePlanDto, ApiCreateChargeDto, ApiCreateCustomerDto, ApiCreateSubscriptionDto, ApiOptOutDto,
  ApiPauseSubscriptionDto, ApiResendChargeDto, ApiSendMessageDto, ApiUpdateCustomerDto,
} from './dto/org-api.dto';

// API pública v1 (Fase 5, contrato §8.4) — autenticação por chave da organização (`Authorization: Bearer pm_…`
// ou `X-Api-Key`), sem JWT; o limite é por CHAVE (600/min, no guard), então o throttler global por IP fica de fora.
// Erros: { statusCode, message, code? }.
@ApiTags('API pública v1')
@SkipThrottle()
@UseGuards(OrgApiKeyGuard)
@Controller('api/v1/whatsapp')
export class OrgApiV1Controller {
  constructor(private readonly api: OrgApiV1Service, private readonly scheduling: WhatsAppSchedulingService, private readonly tickets: WhatsAppTicketsService, private readonly orders: WhatsAppOrdersService) {}

  // ---- produtos
  @Get('products') @ApiScopes('products:read') products(@Req() req: any, @Query() q: any) { return this.api.products(req.apiKey.orgId, q); }

  // ---- clientes
  @Get('customers') @ApiScopes('customers:read') customers(@Req() req: any, @Query() q: any) { return this.api.customers(req.apiKey.orgId, q); }
  @Get('customers/:id') @ApiScopes('customers:read') customer(@Req() req: any, @Param('id') id: string) { return this.api.customer(req.apiKey.orgId, id); }
  @Post('customers') @ApiScopes('customers:write') createCustomer(@Req() req: any, @Body() dto: ApiCreateCustomerDto) { return this.api.createCustomer(req.apiKey.orgId, dto); }
  @Put('customers/:id') @ApiScopes('customers:write') updateCustomer(@Req() req: any, @Param('id') id: string, @Body() dto: ApiUpdateCustomerDto) { return this.api.updateCustomer(req.apiKey.orgId, id, dto); }

  // ---- assinaturas
  @Get('subscriptions') @ApiScopes('subscriptions:read') subscriptions(@Req() req: any, @Query() q: any) { return this.api.subscriptions(req.apiKey.orgId, q); }
  @Get('subscriptions/:id') @ApiScopes('subscriptions:read') subscription(@Req() req: any, @Param('id') id: string) { return this.api.subscription(req.apiKey.orgId, id); }
  @Post('customers/:id/subscriptions') @ApiScopes('subscriptions:write') createSubscription(@Req() req: any, @Param('id') id: string, @Body() dto: ApiCreateSubscriptionDto) { return this.api.createSubscription(req.apiKey.orgId, id, dto); }
  @Post('subscriptions/:id/cancel') @ApiScopes('subscriptions:write') cancel(@Req() req: any, @Param('id') id: string, @Body() dto: ApiCancelSubscriptionDto) { return this.api.cancel(req.apiKey.orgId, id, dto); }
  @Post('subscriptions/:id/pause') @ApiScopes('subscriptions:write') pause(@Req() req: any, @Param('id') id: string, @Body() dto: ApiPauseSubscriptionDto) { return this.api.pause(req.apiKey.orgId, id, dto); }
  @Post('subscriptions/:id/resume') @ApiScopes('subscriptions:write') resume(@Req() req: any, @Param('id') id: string) { return this.api.resume(req.apiKey.orgId, id); }
  @Post('subscriptions/:id/reactivate') @ApiScopes('subscriptions:write') reactivate(@Req() req: any, @Param('id') id: string) { return this.api.reactivate(req.apiKey.orgId, id); }
  @Post('subscriptions/:id/change-plan') @ApiScopes('subscriptions:write') changePlan(@Req() req: any, @Param('id') id: string, @Body() dto: ApiChangePlanDto) { return this.api.changePlan(req.apiKey.orgId, id, dto.product_id); }

  // ---- cobranças
  @Get('charges') @ApiScopes('charges:read') charges(@Req() req: any, @Query() q: any) { return this.api.chargeList(req.apiKey.orgId, q); }
  @Get('charges/:id') @ApiScopes('charges:read') charge(@Req() req: any, @Param('id') id: string) { return this.api.charge(req.apiKey.orgId, id); }
  @Post('charges') @ApiScopes('charges:write') createCharge(@Req() req: any, @Body() dto: ApiCreateChargeDto) { return this.api.createCharge(req.apiKey.orgId, dto); }
  @Post('charges/:id/resend') @ApiScopes('charges:write') resendCharge(@Req() req: any, @Param('id') id: string, @Body() dto: ApiResendChargeDto) { return this.api.resendCharge(req.apiKey.orgId, id, dto.kind); }
  @Post('charges/:id/cancel') @ApiScopes('charges:write') cancelCharge(@Req() req: any, @Param('id') id: string) { return this.api.cancelCharge(req.apiKey.orgId, id); }

  // ---- mensagens (fila com ritmo) e descadastro
  @Post('messages') @ApiScopes('messages:send') send(@Req() req: any, @Body() dto: ApiSendMessageDto) { return this.api.sendMessage(req.apiKey.orgId, req.apiKey, dto); }
  @Get('messages/:id') @ApiScopes('messages:send') message(@Req() req: any, @Param('id') id: string) { return this.api.message(req.apiKey.orgId, id); }
  @Post('contacts/opt-out') @ApiScopes('contacts:write') optOut(@Req() req: any, @Body() dto: ApiOptOutDto) { return this.api.optOut(req.apiKey.orgId, dto); }

  // ---- direitos de acesso
  @Get('entitlements') @ApiScopes('entitlements:read') entitlements(@Req() req: any, @Query() q: any) { return this.api.entitlementList(req.apiKey.orgId, q); }

  // ---- agenda (Fase 6): mesmos filtros da lista do painel (from, to, status, resource_id, customer_id, product_id, q, page, page_size)
  @Get('appointments') @ApiScopes('appointments:read') appointments(@Req() req: any, @Query() q: any) {
    const allowedKeys = ['from', 'to', 'status', 'resource_id', 'customer_id', 'contact_id', 'product_id', 'session_id', 'q', 'page', 'page_size', 'order'];
    return this.scheduling.list(req.apiKey.orgId, Object.fromEntries(Object.entries(q || {}).filter(([k]) => allowedKeys.includes(k))), null);
  }

  // ---- chamados (Fase 6B, contrato §10.4): sem `assigned=me` (a chave não é um usuário)
  @Get('tickets') @ApiScopes('tickets:read') ticketList(@Req() req: any, @Query() q: any) {
    const allowedKeys = ['status', 'category', 'priority', 'assigned', 'sla', 'customer_id', 'contact_id', 'session_id', 'source', 'from', 'to', 'q', 'page', 'page_size', 'order'];
    const clean = Object.fromEntries(Object.entries(q || {}).filter(([k]) => allowedKeys.includes(k)));
    if (clean.assigned === 'me') delete clean.assigned;
    return this.tickets.list(req.apiKey.orgId, clean, null, null);
  }
  @Get('tickets/:id') @ApiScopes('tickets:read') ticket(@Req() req: any, @Param('id') id: string) { return this.tickets.get(req.apiKey.orgId, id); }
  @Post('tickets') @ApiScopes('tickets:write') createTicket(@Req() req: any, @Body() dto: CreateTicketDto) { return this.tickets.create(req.apiKey.orgId, { ...dto, source: 'api', user_id: null }); }
  @Patch('tickets/:id') @ApiScopes('tickets:write') patchTicket(@Req() req: any, @Param('id') id: string, @Body() dto: PatchTicketDto) { return this.tickets.update(req.apiKey.orgId, id, dto, { by: 'api' }); }
  @Post('tickets/:id/comments') @ApiScopes('tickets:write') commentTicket(@Req() req: any, @Param('id') id: string, @Body() dto: TicketCommentDto) { return this.tickets.comment(req.apiKey.orgId, id, dto, { by: 'api' }); }

  // ---- pedidos (Fase 7, contrato §11.3)
  @Get('orders/catalog') @ApiScopes('orders:read') orderCatalog(@Req() req: any) { return this.orders.catalog(req.apiKey.orgId); }
  @Get('orders') @ApiScopes('orders:read') orderList(@Req() req: any, @Query() q: any) {
    const allowedKeys = ['status', 'payment_status', 'unit_id', 'customer_id', 'contact_id', 'session_id', 'source', 'from', 'to', 'q', 'page', 'page_size', 'order'];
    return this.orders.list(req.apiKey.orgId, Object.fromEntries(Object.entries(q || {}).filter(([k]) => allowedKeys.includes(k))), null);
  }
  @Get('orders/:id') @ApiScopes('orders:read') order(@Req() req: any, @Param('id') id: string) { return this.orders.get(req.apiKey.orgId, id); }
  @Post('orders') @ApiScopes('orders:write') createOrder(@Req() req: any, @Body() dto: CreateOrderDto) { return this.orders.create(req.apiKey.orgId, { ...dto, source: 'api', user_id: null } as any); }
  @Post('orders/:id/status') @ApiScopes('orders:write') orderStatus(@Req() req: any, @Param('id') id: string, @Body() dto: OrderStatusDto) { return this.orders.setStatus(req.apiKey.orgId, id, dto, { by: 'api' }); }
}
