import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// DTO do TENANT: só nome/documento. `status` e `stripe_customer_id` NÃO são
// aceitos por aqui (A-08) — status é gerenciado pelo /admin e o customer do
// Stripe pelo próprio BillingService.
export class CreateOrganiztionDto {
  @ApiProperty({
    example: 'Pub Mail',
    description: 'Nome da organização (tenant/empresa).',
    maxLength: 255,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    example: '12345678000199',
    description: 'Documento da organização (ex: CNPJ/CPF).',
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  document_id?: string;
}
