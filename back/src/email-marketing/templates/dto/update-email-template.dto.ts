import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateEmailTemplateDto {
  @ApiPropertyOptional({
    example: 'Promoção (Versão 2)',
    maxLength: 255,
    description: 'Nome interno do template (opcional)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    example: '🔥 Promoção liberada por tempo limitado!',
    maxLength: 255,
    description: 'Assunto do e-mail (opcional)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  subject?: string;

  @ApiPropertyOptional({
    example: '<h1>Olá {{name}}</h1><p>Confira a promoção...</p>',
    description: 'HTML do e-mail (opcional)',
  })
  @IsOptional()
  @IsString()
  body_html?: string;

  @ApiPropertyOptional({
    example: 'Olá {{name}}, confira a promoção...',
    description: 'Versão texto do e-mail (opcional)',
  })
  @IsOptional()
  @IsString()
  body_text?: string;

  @ApiPropertyOptional({ description: 'Modelo do builder visual (JSON).' })
  @IsOptional()
  @IsObject()
  builder_model?: Record<string, any> | null;
}
