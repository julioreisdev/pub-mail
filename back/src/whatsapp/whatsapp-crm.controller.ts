import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WhatsAppCrmService } from './whatsapp-crm.service';
import { WhatsAppChatService } from './whatsapp-chat.service';
import { WaAccessService } from './wa-access.service';
import { CrmSettingsDto, CustomerDto, ProductDto, SubscriptionDto } from './dto/whatsapp-crm.dto';

// CRM do WhatsApp: produtos, clientes e assinaturas (org-scoped).
// Multi-número: clientes/produtos são da org; `customers/by-chat/:chatId` recebe o uuid da conversa
// e confere se o usuário pode ver o número dela (número alheio = 404).
@ApiTags('WhatsApp CRM')
@UseGuards(JwtAuthGuard)
@Controller('whatsapp')
export class WhatsAppCrmController {
  constructor(private readonly crm: WhatsAppCrmService, private readonly chat: WhatsAppChatService, private readonly access: WaAccessService) {}

  // ---- configurações (campos personalizados)
  @Get('crm-settings') settings(@Req() req: any) { return this.crm.settings(req.user.organizationId); }
  @Put('crm-settings') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') updateSettings(@Req() req: any, @Body() dto: CrmSettingsDto) { return this.crm.updateSettings(req.user.organizationId, dto); }

  // ---- produtos
  @Get('products') products(@Req() req: any, @Query() q: any) { return this.crm.listProducts(req.user.organizationId, q); }
  @Post('products') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') createProduct(@Req() req: any, @Body() dto: ProductDto) { return this.crm.createProduct(req.user.organizationId, dto); }
  @Put('products/:id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') updateProduct(@Req() req: any, @Param('id') id: string, @Body() dto: Partial<ProductDto>) { return this.crm.updateProduct(req.user.organizationId, id, dto); }
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
  @Get('customers/by-chat/:chatId')
  async byChat(@Req() req: any, @Param('chatId') chatId: string) {
    await this.access.assertChat(req.user, await this.chat.chatRow(req.user.organizationId, chatId));
    return this.crm.byChat(req.user.organizationId, chatId);
  }
  @Get('customers/:id') customer(@Req() req: any, @Param('id') id: string) { return this.crm.getCustomer(req.user.organizationId, id); }
  @Post('customers') createCustomer(@Req() req: any, @Body() dto: CustomerDto) { return this.crm.createCustomer(req.user.organizationId, req.user.userId, dto); }
  @Put('customers/:id') updateCustomer(@Req() req: any, @Param('id') id: string, @Body() dto: Partial<CustomerDto>) { return this.crm.updateCustomer(req.user.organizationId, id, dto); }
  @Delete('customers/:id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN') removeCustomer(@Req() req: any, @Param('id') id: string) { return this.crm.removeCustomer(req.user.organizationId, id); }

  // ---- assinaturas do cliente
  @Post('customers/:id/subscriptions') addSub(@Req() req: any, @Param('id') id: string, @Body() dto: SubscriptionDto) { return this.crm.addSubscription(req.user.organizationId, id, dto); }
  @Put('customers/:id/subscriptions/:subId') updateSub(@Req() req: any, @Param('id') id: string, @Param('subId') subId: string, @Body() dto: SubscriptionDto) { return this.crm.updateSubscription(req.user.organizationId, id, subId, dto); }
  @Delete('customers/:id/subscriptions/:subId') removeSub(@Req() req: any, @Param('id') id: string, @Param('subId') subId: string) { return this.crm.removeSubscription(req.user.organizationId, id, subId); }
}
