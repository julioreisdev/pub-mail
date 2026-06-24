import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { SOCIAL_NETWORK_VALUES } from './social-schedule-shared.dto';

export class CreateSocialPostScheduleDto {
  @ApiProperty({
    description:
      'ID da conta social conectada que será usada no disparo do agendamento',
    example: 'd8fe859c-58d8-4a4d-b4be-7fe8d915fa7c',
    format: 'uuid',
  })
  @IsUUID()
  social_account_id: string;

  @ApiProperty({
    description: 'ID do post salvo na Galeria',
    example: '0f87c84f-c56d-42f8-8a8e-1f9466fe71cb',
    format: 'uuid',
  })
  @IsUUID()
  post_id: string;

  @ApiProperty({
    description: 'Rede social alvo do agendamento',
    enum: SOCIAL_NETWORK_VALUES,
    example: 'TIKTOK',
  })
  @IsIn(SOCIAL_NETWORK_VALUES)
  social_network: string;

  @ApiProperty({
    description: 'Indica se o conteúdo foi gerado/alterado por IA',
    example: true,
  })
  @Type(() => Boolean)
  @IsBoolean()
  ai_content: boolean;

  @ApiProperty({
    description:
      'Data/hora do agendamento em ISO (deve ser sempre horário cheio: mm=00, ss=00)',
    example: '2026-03-30T20:00:00.000Z',
  })
  @IsISO8601()
  scheduled_at: string;

  @ApiPropertyOptional({
    description:
      'Payload específico da rede social (ex.: privacidade, legenda, título, etc.)',
    example: {
      privacy_level: 'PUBLIC_TO_EVERYONE',
      caption: 'Meu post agendado #tiktok',
      allow_comment: true,
      allow_duet: false,
      allow_stitch: false,
      commercial_content_enabled: true,
      brand_organic_toggle: true,
      brand_content_toggle: false,
    },
  })
  @IsOptional()
  @IsObject()
  platform_payload?: Record<string, any>;
}
