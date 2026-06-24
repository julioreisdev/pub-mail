import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateAgenteDto {
  @ApiProperty({ example: 'Atendimento Comercial' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    example: 'Agente focado em qualificação de leads no webchat',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    example: {
      prompt_mestre:
        'Você é um atendente objetivo e cordial. Faça perguntas curtas.',
      modelo: 'llama-3.3-70b-versatile',
      temperatura: 0.7,
      max_tokens: 500,
    },
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  ia_config: Record<string, any>;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
