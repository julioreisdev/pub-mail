import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateTriggerDto {
  @ApiProperty({ enum: ['OPEN', 'CLICK'], description: 'Evento que dispara o gatilho.' })
  @IsIn(['OPEN', 'CLICK'])
  event: 'OPEN' | 'CLICK';

  @ApiProperty({ enum: ['ADD_TAG', 'SEND_TEMPLATE'], description: 'Ação executada.' })
  @IsIn(['ADD_TAG', 'SEND_TEMPLATE'])
  action: 'ADD_TAG' | 'SEND_TEMPLATE';

  @ApiPropertyOptional({ type: [String], description: 'Tags a adicionar (action=ADD_TAG).' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Template a enviar (action=SEND_TEMPLATE).' })
  @IsOptional()
  @IsUUID()
  template_id?: string | null;

  @ApiPropertyOptional({
    description:
      'Frequência: { type:"once"|"unlimited"|"cooldown", value?, unit?:"minutes"|"hours"|"days" }.',
  })
  @IsOptional()
  @IsObject()
  frequency?: Record<string, any> | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateTriggerDto {
  @ApiPropertyOptional({ enum: ['OPEN', 'CLICK'] })
  @IsOptional()
  @IsIn(['OPEN', 'CLICK'])
  event?: 'OPEN' | 'CLICK';

  @ApiPropertyOptional({ enum: ['ADD_TAG', 'SEND_TEMPLATE'] })
  @IsOptional()
  @IsIn(['ADD_TAG', 'SEND_TEMPLATE'])
  action?: 'ADD_TAG' | 'SEND_TEMPLATE';

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  template_id?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  frequency?: Record<string, any> | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
