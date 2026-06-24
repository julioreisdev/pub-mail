import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateBillingDto} from "./dto/create-billing-cards.dto";
import {UpdateBillingDto} from "./dto/update-billing-cards.dto";
import {TopupDto} from "./dto/topup.dto";

import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiTags('Billing')
@ApiBearerAuth()
@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('setup-intent')
  @ApiOperation({ summary: 'Criar Setup Intent para salvar um cartão na organização' })
  @ApiCreatedResponse({ description: 'Setup Intent criado com sucesso' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  async setupIntent(@Req() req: any) {
    const orgId = req.user.organization_id || req.user.organizationId;
    return this.billingService.createSetupIntentForOrg(orgId);
  }

  @Get('cards')
  @ApiOperation({ summary: 'Listar cartões da organização' })
  @ApiOkResponse({ description: 'Lista de cartões retornada com sucesso' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  async listCards(@Req() req: any) {
    const orgId = req.user.organization_id || req.user.organizationId;
    return this.billingService.listCards(orgId);
  }

  @Post('cards')
  @ApiOperation({ summary: 'Cadastrar um cartão para a organização' })
  @ApiBody({ type: CreateBillingDto })
  @ApiCreatedResponse({ description: 'Cartão cadastrado com sucesso' })
  @ApiBadRequestResponse({ description: 'Dados inválidos' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  async createCard(@Req() req: any, @Body() dto: CreateBillingDto) {
    const orgId = req.user.organization_id || req.user.organizationId;
    return this.billingService.createCard(orgId, dto);
  }

  @Patch('cards/:id')
  @ApiOperation({ summary: 'Atualizar dados de um cartão' })
  @ApiParam({ name: 'id', description: 'ID do cartão', type: String, format: 'uuid' })
  @ApiBody({ type: UpdateBillingDto })
  @ApiOkResponse({ description: 'Cartão atualizado com sucesso' })
  @ApiBadRequestResponse({ description: 'Dados inválidos' })
  @ApiNotFoundResponse({ description: 'Cartão não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  async updateCard(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateBillingDto) {
    const orgId = req.user.organization_id || req.user.organizationId;
    return this.billingService.updateCard(orgId, id, dto);
  }

  @Patch('cards/:id/default')
  @ApiOperation({ summary: 'Definir um cartão como padrão' })
  @ApiParam({ name: 'id', description: 'ID do cartão', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Cartão definido como padrão com sucesso' })
  @ApiNotFoundResponse({ description: 'Cartão não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  async setDefault(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user.organization_id || req.user.organizationId;
    return this.billingService.setDefaultCard(orgId, id);
  }

  @Delete('cards/:id')
  @ApiOperation({ summary: 'Remover um cartão da organização' })
  @ApiParam({ name: 'id', description: 'ID do cartão', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Cartão removido com sucesso' })
  @ApiNotFoundResponse({ description: 'Cartão não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  async deleteCard(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user.organization_id || req.user.organizationId;
    return this.billingService.deleteCard(orgId, id);
  }

  @Post('topup')
  @ApiOperation({ summary: 'Adicionar tokens na carteira (topup)' })
  @ApiBody({ type: TopupDto })
  @ApiCreatedResponse({ description: 'Topup realizado com sucesso' })
  @ApiBadRequestResponse({ description: 'Dados inválidos' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  async topup(@Req() req: any, @Body() dto: TopupDto) {
    const orgId = req.user.organization_id || req.user.organizationId;
    return this.billingService.topupTokens(orgId, dto.tokens);
  }
}
