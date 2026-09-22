import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateEmailTemplateDto {
  @ApiProperty({
    example: 'Boas-vindas (Default)',
    maxLength: 255,
    description: 'Nome interno do template',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    example: 'Bem-vindo(a) ao Pub Mail!',
    maxLength: 255,
    description: 'Assunto do e-mail',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  subject: string;

  @ApiPropertyOptional({
    example: '<h1>Olá {{name}}</h1><p>Seja bem-vindo(a)!</p>',
    description: 'HTML do e-mail (opcional, mas recomendado)',
  })
  @IsOptional()
  @IsString()
  body_html?: string;

  @ApiPropertyOptional({
    example: 'Olá {{name}}, seja bem-vindo(a)!',
    description: 'Versão texto do e-mail (opcional, anti-spam)',
  })
  @IsOptional()
  @IsString()
  body_text?: string;

  @ApiPropertyOptional({
    description: 'Modelo do builder visual (JSON). Presente => template feito no construtor.',
  })
  @IsOptional()
  @IsObject()
  builder_model?: Record<string, any> | null;

  @ApiPropertyOptional({
    example: false,
    description: 'true => template exclusivo de reciclagem (não aparece nos templates normais do projeto).',
  })
  @IsOptional()
  @IsBoolean()
  recycle?: boolean;
}
