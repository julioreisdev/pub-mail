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

export class CreateQuizDto {
  @ApiProperty({ example: 'Quiz de captação' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'quizz.dominio.com' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  domain: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  email_project_id?: string | null;

  @ApiPropertyOptional({ description: 'Scripts/HTML para o header do quiz.' })
  @IsOptional()
  @IsString()
  header_scripts?: string | null;

  @ApiPropertyOptional({ description: 'Scripts/HTML para o rodapé do quiz.' })
  @IsOptional()
  @IsString()
  footer_scripts?: string | null;

  @ApiPropertyOptional({
    description:
      'HTML do e-mail enviado imediatamente ao lead após a captação (requer projeto vinculado). Vazio = não envia.',
  })
  @IsOptional()
  @IsString()
  lead_email_html?: string | null;

  @ApiPropertyOptional({ description: 'Assunto do e-mail enviado ao lead.' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  lead_email_subject?: string | null;

  @ApiPropertyOptional({ description: 'Modelo do builder visual do e-mail do lead (JSON).' })
  @IsOptional()
  @IsObject()
  lead_email_model?: Record<string, any> | null;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ format: 'uuid', description: 'Split (pasta) do quiz' })
  @IsOptional()
  @IsUUID()
  split_id?: string | null;

  @ApiPropertyOptional({ description: 'Peso relativo do quiz no split (%).' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  split_weight?: number;
}
