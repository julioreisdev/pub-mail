import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const AD_EVENT_NAMES = [
  'requested',
  'rendered',
  'empty',
  'viewable',
  'clicked',
  'closed',
  'error',
] as const;

const AD_POSITIONS = [
  'topo',
  'rodape',
  'intersticial',
  'entre-mensagens',
] as const;

export class TrackWebchatAdEventDto {
  @ApiProperty({ enum: AD_EVENT_NAMES })
  @IsString()
  @IsIn(AD_EVENT_NAMES)
  event_name!: (typeof AD_EVENT_NAMES)[number];

  @ApiProperty({ enum: AD_POSITIONS })
  @IsString()
  @IsIn(AD_POSITIONS)
  ad_position!: (typeof AD_POSITIONS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  ad_key?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  payload?: Record<string, any>;
}

export class TrackWebchatAdEventsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  session_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  domain?: string;

  @ApiProperty({ type: () => [TrackWebchatAdEventDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TrackWebchatAdEventDto)
  events!: TrackWebchatAdEventDto[];
}
