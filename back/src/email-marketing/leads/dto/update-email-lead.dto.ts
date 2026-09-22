import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateEmailLeadDto {
  @ApiPropertyOptional({
    example: 'Nome Atualizado do Lead',
    maxLength: 255,
    description: 'Nome do lead (opcional)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    example: {
      phone: '551199999999',
      origin: 'elementor',
      country: 'BR',
    },
    description: 'Atributos dinâmicos do lead (JSON livre)',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  attributes?: any; // JSON

  @ApiPropertyOptional({
    type: [String],
    example: ['vip', 'quente'],
    description: 'Tags (rótulos) do lead.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  tags?: string[];
}
