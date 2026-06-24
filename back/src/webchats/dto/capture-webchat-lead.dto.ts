import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CaptureWebchatLeadDto {
  // Quando o agente captura só nome+telefone (toggle "Captar E-mail" off),
  // o lead é salvo sem email. Pelo menos email OU telefone precisam vir
  // — a validação cruzada é feita em upsertLeadForWebchat.
  @ApiPropertyOptional({ example: 'lead@exemplo.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Maria Silva' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: '5511999999999' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: 'webchat' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string;

  @ApiPropertyOptional({ example: 'session-abc-123' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  session_id?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Contexto de navegação (URL, UTM, user-agent, etc.)',
  })
  @IsOptional()
  @IsObject()
  context?: Record<string, any>;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Campos customizados de lead',
  })
  @IsOptional()
  @IsObject()
  custom_fields?: Record<string, any>;
}
