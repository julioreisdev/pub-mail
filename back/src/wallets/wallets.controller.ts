import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WalletsService } from './wallets.service';
import { ListTransactionsDto } from './dto/list-transactions.dto';

import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Wallet')
@ApiBearerAuth()
@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get('balance')
  @ApiOperation({ summary: 'Consultar saldo da carteira da organização logada' })
  @ApiOkResponse({ description: 'Saldo e dados da carteira retornados com sucesso' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  me(@Req() req: any) {
    return this.walletsService.getMyWallet(req.user.organizationId);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Listar transações da carteira da organização logada' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Página da listagem' })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Itens por página (máximo 100)' })
  @ApiQuery({ name: 'type', required: false, type: String, description: 'Filtro por tipo (string livre: TOPUP, USAGE, etc.)' })
  @ApiOkResponse({ description: 'Lista paginada de transações retornada com sucesso' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  transactions(@Req() req: any, @Query() query: ListTransactionsDto) {
    return this.walletsService.listMyTransactions(req.user.organizationId, query);
  }
}
