import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class AbVariantDto {
  @ApiProperty({ format: 'uuid', description: 'Template desta variante.' })
  @IsUUID()
  template_id: string;

  @ApiPropertyOptional({ description: 'Assunto (sobrescreve o do template).' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  subject?: string;
}

export class CreateAbTestDto {
  @ApiProperty({ example: 'Assunto A vs B — Black Friday' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 30, description: '% da base usada no teste (5..90).' })
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(90)
  test_percent: number;

  @ApiProperty({ enum: ['open', 'click'] })
  @IsIn(['open', 'click'])
  winner_metric: 'open' | 'click';

  @ApiProperty({ example: 4, description: 'Horas até decidir o vencedor (1..168).' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  decision_hours: number;

  @ApiProperty({ type: [AbVariantDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => AbVariantDto)
  variants: AbVariantDto[];
}
