import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateWebchatDto {
  @ApiProperty({ example: 'Site de Relacionamento' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'chat.giraldifreitas.com.br' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  domain: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  agent_id: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  email_project_id?: string | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Configurações de personalização do webchat',
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Scripts externos para header do webchat',
  })
  @IsOptional()
  @IsString()
  header_scripts?: string | null;

  @ApiPropertyOptional({
    description:
      'Scripts/HTML para o rodapé do webchat (tracking, pixels, analytics).',
  })
  @IsOptional()
  @IsString()
  footer_scripts?: string | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Configuração de anúncios do webchat',
  })
  @IsOptional()
  @IsObject()
  ads_config?: Record<string, any>;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ format: 'uuid', description: 'Split (pasta) do webchat' })
  @IsOptional()
  @IsUUID()
  split_id?: string | null;

  @ApiPropertyOptional({ description: 'Peso relativo do webchat no split (%).' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  split_weight?: number;
}
