import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { SOCIAL_NETWORK_VALUES } from './social-account-shared.dto';

export class ListSocialAccountsDto {
  @ApiPropertyOptional({
    description: 'Filtrar por rede social',
    enum: SOCIAL_NETWORK_VALUES,
    example: 'TIKTOK',
  })
  @IsOptional()
  @IsIn(SOCIAL_NETWORK_VALUES)
  social_network?: string;
}
