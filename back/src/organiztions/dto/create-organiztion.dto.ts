import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateOrganiztionDto {
  @ApiProperty({
    example: 'Pub Mail',
    description: 'Nome da organização (tenant/empresa).',
    maxLength: 255,
  })
  @IsNotEmpty()
  @IsString()
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

  @ApiPropertyOptional({
    example: true,
    description: 'Status da organização. Se omitido, usa o default do banco/prisma.',
  })
  @IsOptional()
  @IsBoolean()
  status?: boolean; // pode omitir e deixar o default do banco/prisma

  @ApiPropertyOptional({
    example: 'cus_ABC123xyz',
    description: 'ID do cliente no Stripe (geralmente não vem do cliente final).',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  stripe_customer_id?: string; // geralmente não vem do cliente
}
