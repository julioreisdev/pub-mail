import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTransactionDto {
  @ApiProperty({
    example: '10.5000',
    description: 'Valor da transação em string decimal (até 4 casas). Ex: "10", "10.5", "10.5000".',
  })
  @IsNotEmpty()
  @IsString()
  amount: string;

  @ApiProperty({
    example: 'USAGE',
    maxLength: 50,
    description: 'Tipo livre da transação (ex: TOPUP, USAGE, PURCHASE, BONUS etc.)',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  type: string;

  @ApiProperty({
    example: 'Consumo de tokens',
    maxLength: 255,
    description: 'Descrição da transação',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  description: string;

  @ApiPropertyOptional({
    example: 'stripe_tx_123',
    maxLength: 255,
    description: 'ID da transação no provedor (se existir)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  provider_transaction_id?: string;

  @ApiProperty({
    example: 'DEBIT',
    enum: ['CREDIT', 'DEBIT'],
    description: 'Indica se a transação soma (CREDIT) ou subtrai (DEBIT) do saldo',
  })
  @IsNotEmpty()
  @IsIn(['CREDIT', 'DEBIT'])
  operation: 'CREDIT' | 'DEBIT';
}
