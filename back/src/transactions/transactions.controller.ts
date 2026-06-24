import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiBody,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiTags('Transactions')
@ApiBearerAuth()
@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly service: TransactionsService) {}

  @Post()
  @ApiOperation({
    summary: 'Criar transação na carteira da organização logada',
    description:
      'Cria uma transação (crédito ou débito) vinculada à carteira da organização do usuário autenticado e retorna a transação + carteira atualizada.',
  })
  @ApiBody({ type: CreateTransactionDto })
  @ApiCreatedResponse({
    description: 'Transação criada com sucesso (retorna transação e carteira atualizada)',
  })
  @ApiBadRequestResponse({
    description:
      'Dados inválidos (ex: amount inválido/negativo), tipo/operação não suportado, carteira inativa ou saldo insuficiente',
  })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  create(@Req() req: any, @Body() dto: CreateTransactionDto) {
    return this.service.createForMyWallet(req.user.organizationId, dto);
  }
}
