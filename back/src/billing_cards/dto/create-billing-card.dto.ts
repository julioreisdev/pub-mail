import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateBillingCardDto {
  @ApiProperty({
    example: 'pm_1PabcDEFghIJkLmNoPqRstUv',
    maxLength: 255,
    description: 'Token do provedor (ex: Stripe PaymentMethod). Salvo no banco, não deve ser retornado na API.',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  provider_token: string;

  @ApiPropertyOptional({
    example: '4242',
    minLength: 4,
    maxLength: 4,
    description: 'Últimos 4 dígitos do cartão (opcional).',
  })
  @IsOptional()
  @IsString()
  @Length(4, 4)
  last_four_digits?: string;

  @ApiPropertyOptional({
    example: 'VISA',
    maxLength: 50,
    description: 'Bandeira do cartão (opcional). Ex: VISA, MASTERCARD, AMEX.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  brand?: string;

  @ApiProperty({
    example: 'Mateus Pereira',
    maxLength: 255,
    description: 'Nome do titular do cartão.',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  holder_name: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'Define se este cartão será o padrão da organização. Se omitido, o service decide (ex: primeiro cartão vira padrão).',
  })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}
