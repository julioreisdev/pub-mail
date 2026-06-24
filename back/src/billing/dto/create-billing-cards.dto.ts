import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateBillingDto {
  @ApiProperty({
    example: 'João da Silva',
    description: 'Nome do titular do cartão',
  })
  @IsString()
  holder_name: string;

  @ApiProperty({
    example: 'pm_1Pxxxxxxx',
    description: 'Token do provedor (ex: Stripe PaymentMethod token)',
  })
  @IsString()
  provider_token: string; // pm_...

  @ApiPropertyOptional({
    example: true,
    description: 'Define este cartão como padrão (se omitido, segue regra do serviço)',
  })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}





