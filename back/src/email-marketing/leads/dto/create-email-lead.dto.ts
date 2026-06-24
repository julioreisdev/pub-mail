import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateEmailLeadDto {
  @ApiProperty({
    example: 'cliente@exemplo.com',
    maxLength: 255,
    description: 'E-mail do lead (único por organização)',
  })
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiPropertyOptional({
    example: 'Nome do Cliente',
    maxLength: 255,
    description: 'Nome do lead (opcional)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    example: { phone: '551199999999', origin: 'wordpress', country: 'BR' },
    description: 'Atributos livres (JSON) para enriquecer o lead',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  attributes?: Record<string, any>; // JSON
}
