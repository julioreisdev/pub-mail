import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListTransactionsDto {
  @ApiPropertyOptional({
    example: 1,
    minimum: 1,
    description: 'Página da listagem (paginação)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    example: 20,
    minimum: 1,
    maximum: 100,
    description: 'Quantidade de itens por página (máximo 100)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100) // limite recomendado
  pageSize: number = 20;

  @ApiPropertyOptional({
    example: 'USAGE',
    maxLength: 50,
    description: 'Filtro opcional por tipo de transação (string livre: TOPUP, USAGE, PURCHASE, BONUS, etc.)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  type?: string;
}
