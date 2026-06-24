import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BillingCardsService } from './billing-cards.service';
import { CreateBillingCardDto } from './dto/create-billing-card.dto';
import { UpdateBillingCardDto } from './dto/update-billing-card.dto';

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

@ApiTags('Billing - Cards')
@ApiBearerAuth()
@Controller('billing/cards')
@UseGuards(JwtAuthGuard)
export class BillingCardsController {
  constructor(private readonly service: BillingCardsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar cartões cadastrados da organização' })
  @ApiOkResponse({ description: 'Lista de cartões retornada com sucesso' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  list(@Req() req: any) {
    return this.service.listMyCards(req.user.organizationId);
  }

  @Post()
  @ApiOperation({ summary: 'Cadastrar um novo cartão para a organização' })
  @ApiBody({ type: CreateBillingCardDto })
  @ApiCreatedResponse({ description: 'Cartão cadastrado com sucesso' })
  @ApiBadRequestResponse({ description: 'Dados inválidos' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  create(@Req() req: any, @Body() dto: CreateBillingCardDto) {
    return this.service.createMyCard(req.user.organizationId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar dados de um cartão' })
  @ApiParam({ name: 'id', description: 'ID do cartão', type: String, format: 'uuid' })
  @ApiBody({ type: UpdateBillingCardDto })
  @ApiOkResponse({ description: 'Cartão atualizado com sucesso' })
  @ApiBadRequestResponse({ description: 'Dados inválidos' })
  @ApiNotFoundResponse({ description: 'Cartão não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  update(
    @Req() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateBillingCardDto,
  ) {
    return this.service.updateMyCard(req.user.organizationId, id, dto);
  }

  @Post(':id/default')
  @ApiOperation({ summary: 'Definir um cartão como padrão (default)' })
  @ApiParam({ name: 'id', description: 'ID do cartão', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Cartão definido como padrão com sucesso' })
  @ApiNotFoundResponse({ description: 'Cartão não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  setDefault(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.setDefault(req.user.organizationId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover um cartão' })
  @ApiParam({ name: 'id', description: 'ID do cartão', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Cartão removido com sucesso' })
  @ApiNotFoundResponse({ description: 'Cartão não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  remove(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.removeMyCard(req.user.organizationId, id);
  }
}
