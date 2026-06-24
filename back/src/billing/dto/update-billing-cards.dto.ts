import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class UpdateBillingDto {
  @ApiPropertyOptional({
    example: 'Maria da Silva',
    description: 'Atualiza o nome do titular do cartão',
  })
  @IsOptional()
  @IsString()
  holder_name?: string;

  @ApiPropertyOptional({
    example: '4242',
    description: 'Últimos 4 dígitos do cartão (opcional)',
    minLength: 4,
    maxLength: 4,
  })
  @IsOptional()
  @IsString()
  @Length(4, 4)
  last_four_digits?: string;

  @ApiPropertyOptional({
    example: 'VISA',
    description: 'Bandeira do cartão (opcional)',
  })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Marca este cartão como padrão',
  })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}