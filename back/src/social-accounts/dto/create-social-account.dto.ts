import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  SOCIAL_ACCOUNT_STATUS_VALUES,
  SOCIAL_NETWORK_VALUES,
} from './social-account-shared.dto';

export class CreateSocialAccountDto {
  @ApiProperty({
    description: 'Rede social da conta conectada',
    enum: SOCIAL_NETWORK_VALUES,
    example: 'TIKTOK',
  })
  @IsIn(SOCIAL_NETWORK_VALUES)
  social_network: string;

  @ApiProperty({
    description: 'ID único da conta no provedor',
    example: '7123456789012345678',
  })
  @IsString()
  @MaxLength(191)
  provider_user_id: string;

  @ApiPropertyOptional({
    description: 'Username da conta (ex: @minha_marca)',
    example: 'minha_marca',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  username?: string;

  @ApiPropertyOptional({
    description: 'Nome de exibição da conta',
    example: 'Minha Marca Oficial',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  display_name?: string;

  @ApiPropertyOptional({
    description: 'URL da imagem de perfil da conta',
    example: 'https://example.com/avatar.jpg',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  profile_image_url?: string;

  @ApiPropertyOptional({
    description: 'Status atual da conexão',
    enum: SOCIAL_ACCOUNT_STATUS_VALUES,
    example: 'ACTIVE',
  })
  @IsOptional()
  @IsIn(SOCIAL_ACCOUNT_STATUS_VALUES)
  status?: string;

  @ApiPropertyOptional({
    description: 'Define como conta padrão para a rede social',
    example: false,
  })
  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @ApiPropertyOptional({
    description: 'Data/hora de expiração do token (ISO)',
    example: '2026-03-30T20:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  token_expires_at?: string;

  @ApiPropertyOptional({
    description: 'Escopos aprovados pela conta',
    type: [String],
    example: ['user.info.basic', 'video.upload'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scope?: string[];

  @ApiPropertyOptional({
    description: 'Metadados livres da integração',
    example: { app_mode: 'PUBMAIL_DEFAULT' },
  })
  @IsOptional()
  @IsObject()
  extra?: Record<string, any>;

  @ApiPropertyOptional({
    description:
      'Token de acesso (será armazenado criptografado e nunca retornado)',
  })
  @IsOptional()
  @IsString()
  access_token?: string;

  @ApiPropertyOptional({
    description:
      'Token de renovação (será armazenado criptografado e nunca retornado)',
  })
  @IsOptional()
  @IsString()
  refresh_token?: string;
}
