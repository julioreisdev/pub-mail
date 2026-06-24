import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SendWebchatMessageDto {
  @ApiProperty({ example: 'Quero entender como funciona o plano premium.' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ example: 'session-abc-123' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  session_id?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Estado dinâmico de captura de lead no front',
  })
  @IsOptional()
  @IsObject()
  lead_state?: Record<string, any>;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Contexto da mensagem pública (URL, user-agent, etc.)',
  })
  @IsOptional()
  @IsObject()
  context?: Record<string, any>;

  @ApiPropertyOptional({
    type: 'array',
    description:
      'Histórico recente da conversa para manter contexto no micro-serviço de IA',
    example: [
      { role: 'assistant', content: 'Olá! Seja bem-vindo(a).' },
      { role: 'user', content: 'Oi' },
    ],
  })
  @IsOptional()
  @IsArray()
  conversation_history?: Record<string, any>[];
}
