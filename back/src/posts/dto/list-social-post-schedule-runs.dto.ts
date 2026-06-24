import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsIn,
  IsOptional,
  IsUUID,
} from 'class-validator';
import {
  SOCIAL_NETWORK_VALUES,
  SOCIAL_SCHEDULE_RUN_STATUS_VALUES,
} from './social-schedule-shared.dto';

export class ListSocialPostScheduleRunsDto {
  @ApiPropertyOptional({
    description: 'Filtrar por rede social',
    enum: SOCIAL_NETWORK_VALUES,
    example: 'TIKTOK',
  })
  @IsOptional()
  @IsIn(SOCIAL_NETWORK_VALUES)
  social_network?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por status do disparo',
    enum: SOCIAL_SCHEDULE_RUN_STATUS_VALUES,
    example: 'COMPLETED',
  })
  @IsOptional()
  @IsIn(SOCIAL_SCHEDULE_RUN_STATUS_VALUES)
  status?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por conta social específica',
    example: '0f7f6b94-2a0c-11f1-854f-3ab4c9681ff2',
  })
  @IsOptional()
  @IsUUID()
  social_account_id?: string;

  @ApiPropertyOptional({
    description: 'Início do período (ISO) usando run_at',
    example: '2026-03-26T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    description: 'Fim do período (ISO) usando run_at',
    example: '2026-03-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
