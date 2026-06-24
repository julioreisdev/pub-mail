import { ApiPropertyOptional } from '@nestjs/swagger';
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
import { SOCIAL_ACCOUNT_STATUS_VALUES } from './social-account-shared.dto';

export class UpdateSocialAccountDto {
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
    example: 'DISCONNECTED',
  })
  @IsOptional()
  @IsIn(SOCIAL_ACCOUNT_STATUS_VALUES)
  status?: string;

  @ApiPropertyOptional({
    description: 'Define como conta padrão para a rede social',
    example: true,
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
    example: ['user.info.basic', 'video.publish'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scope?: string[];

  @ApiPropertyOptional({
    description: 'Metadados livres da integração',
    example: { oauth_state: 'READY' },
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
