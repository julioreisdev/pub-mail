import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WhatsAppCrmService } from './whatsapp-crm.service';
import { WhatsAppChatService } from './whatsapp-chat.service';
import { WaAccessService } from './wa-access.service';
import { ContactRoleDto, CrmSettingsDto, CustomerDto, LinkContactDto, ProductDto, SubscriptionDto, UpdateCustomerDto, UpdateProductDto } from './dto/whatsapp-crm.dto';
import { WhatsAppIdentityService } from './whatsapp-identity.service';
import { WhatsAppSubscriptionsService } from './whatsapp-subscriptions.service';

// CRM do WhatsApp: produtos, clientes e assinaturas (org-scoped).
// Multi-número: clientes/produtos são da org; `customers/by-chat/:chatId` recebe o uuid da conversa
// e confere se o usuário pode ver o número dela (número alheio = 404).
@ApiTags('WhatsApp CRM')
@UseGuards(JwtAuthGuard)
@Controller('whatsapp')
export class WhatsAppCrmController {
  constructor(private readonly crm: WhatsAppCrmService, private readonly chat: WhatsAppChatService, private readonly access: WaAccessService, private readonly identity: WhatsAppIdentityService, private readonly subs: WhatsAppSubscriptionsService) {}

  // ---- configurações (campos personalizados)
  @Get('crm-settings') settings(@Req() req: any) { return this.crm.settings(req.user.organizationId); }
  @Put('crm-settings') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') updateSettings(@Req() req: any, @Body() dto: CrmSettingsDto) { return this.crm.updateSettings(req.user.organizationId, dto); }

  // ---- produtos
  @Get('products') products(@Req() req: any, @Query() q: any) { return this.crm.listProducts(req.user.organizationId, q); }
  @Post('products') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') createProduct(@Req() req: any, @Body() dto: ProductDto) { return this.crm.createProduct(req.user.organizationId, dto); }
  @Put('products/:id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') updateProduct(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateProductDto) { return this.crm.updateProduct(req.user.organizationId, id, dto); } // PUT parcial validado
  @Delete('products/:id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') removeProduct(@Req() req: any, @Param('id') id: string) { return this.crm.removeProduct(req.user.organizationId, id); }

  // ---- clientes
  @Get('customers/export')
  async exportCustomers(@Req() req: any, @Res() res: Response) {
    const csv = await this.crm.exportCsv(req.user.organizationId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="clientes-whatsapp.csv"');
    res.send(csv);
  }
  @Post('customers/import') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  importCustomers(@Req() req: any, @UploadedFile() file: any) { return this.crm.importCsv(req.user.organizationId, req.user.userId, file?.buffer || Buffer.alloc(0)); }
  @Get('customers') customers(@Req() req: any, @Query() q: any) { return this.crm.listCustomers(req.user.organizationId, q); }
  // identidade: acha o cliente por documento (hash), código ou telefone — resposta mínima (não vaza dados de quem não achou)
  @Get('customers/lookup') lookupCustomer(@Req() req: any, @Query() q: any) { return this.crm.lookupCustomer(req.user.organizationId, q); }
  @Get('customers/by-chat/:chatId')
  async byChat(@Req() req: any, @Param('chatId') chatId: string, @Query('customer_id') customerId?: string) {
    await this.access.assertChat(req.user, await this.chat.chatRow(req.user.organizationId, chatId));
    return this.crm.byChat(req.user.organizationId, chatId, customerId || null); // `customers` lista todos os clientes do número; `customer_id` escolhe
  }
  @Get('customers/:id') customer(@Req() req: any, @Param('id') id: string) { return this.crm.getCustomer(req.user.organizationId, id); }
  @Post('customers') createCustomer(@Req() req: any, @Body() dto: CustomerDto) { return this.crm.createCustomer(req.user.organizationId, req.user.userId, dto); }
  @Put('customers/:id') updateCustomer(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateCustomerDto) { return this.crm.updateCustomer(req.user.organizationId, id, dto); }
  @Delete('customers/:id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') removeCustomer(@Req() req: any, @Param('id') id: string) { return this.crm.removeCustomer(req.user.organizationId, id); }

  // ---- números (contatos) do cliente
  @Post('customers/:id/contacts') linkContact(@Req() req: any, @Param('id') id: string, @Body() dto: LinkContactDto) { return this.crm.linkContact(req.user.organizationId, id, dto); }
  @Patch('customers/:id/contacts/:contactId') contactRole(@Req() req: any, @Param('id') id: string, @Param('contactId') contactId: string, @Body() dto: ContactRoleDto) { return this.crm.setContactRole(req.user.organizationId, id, contactId, dto.role); }
  @Delete('customers/:id/contacts/:contactId') unlinkContact(@Req() req: any, @Param('id') id: string, @Param('contactId') contactId: string) { return this.crm.unlinkContact(req.user.organizationId, id, contactId); }

  // ---- assinaturas do cliente
  /** Prévia (nada é gravado): 1ª cobrança, 1º vencimento, fim do teste, cupom — para a tela mostrar antes de confirmar. */
  @Post('customers/:id/subscriptions/preview') previewSub(@Req() req: any, @Param('id') id: string, @Body() dto: SubscriptionDto) { return this.subs.preview(req.user.organizationId, id, dto); }
  @Post('customers/:id/subscriptions') addSub(@Req() req: any, @Param('id') id: string, @Body() dto: SubscriptionDto) { return this.crm.addSubscription(req.user.organizationId, id, dto, { source: 'panel', user_id: req.user.userId, auto_charge: dto.charge_now === true }); }
  // edição manual (dados cadastrais); `status` diferente do atual / troca de produto → 400 (use as ações / trocar plano)
  @Put('customers/:id/subscriptions/:subId') updateSub(@Req() req: any, @Param('id') id: string, @Param('subId') subId: string, @Body() dto: SubscriptionDto) { return this.crm.updateSubscription(req.user.organizationId, id, subId, dto, { source: 'panel', user_id: req.user.userId }); }
  @Delete('customers/:id/subscriptions/:subId') removeSub(@Req() req: any, @Param('id') id: string, @Param('subId') subId: string) { return this.crm.removeSubscription(req.user.organizationId, id, subId); }
}
