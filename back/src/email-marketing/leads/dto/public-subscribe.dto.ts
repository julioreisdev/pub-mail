import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class PublicSubscribeDto {
  @ApiProperty({
    example: 'cliente@exemplo.com',
    maxLength: 255,
    description: 'E-mail do lead (obrigatório)',
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
    description: 'Atributos livres (JSON) enviados por formulários externos',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;
}
