import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class UpdateBillingCardDto {
  @ApiPropertyOptional({
    example: 'Mateus Pereira',
    maxLength: 255,
    description: 'Atualiza o nome do titular do cartão (opcional).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  holder_name?: string;

  @ApiPropertyOptional({
    example: '4242',
    minLength: 4,
    maxLength: 4,
    description: 'Atualiza os últimos 4 dígitos do cartão (opcional).',
  })
  @IsOptional()
  @IsString()
  @Length(4, 4)
  last_four_digits?: string;

  @ApiPropertyOptional({
    example: 'VISA',
    maxLength: 50,
    description: 'Atualiza a bandeira do cartão (opcional).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  brand?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Define/remover como cartão padrão da organização (opcional).',
  })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}
