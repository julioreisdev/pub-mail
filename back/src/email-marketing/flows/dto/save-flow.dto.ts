import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class FlowStepDto {
  @ApiPropertyOptional({ description: 'ID do passo existente (preserva métricas ao salvar).' })
  @IsOptional()
  @IsString()
  id?: string | null;

  @ApiProperty({ example: 10, description: 'Tempo de espera antes de enviar este e-mail.' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  delay_value: number;

  @ApiProperty({ enum: ['minutes', 'hours'], example: 'minutes' })
  @IsIn(['minutes', 'hours'])
  delay_unit: 'minutes' | 'hours';

  @ApiProperty({ example: 'Bem-vindo(a)! 🎉' })
  @IsString()
  @MaxLength(255)
  subject: string;

  @ApiPropertyOptional({ description: 'HTML do e-mail (gerado pelo construtor).' })
  @IsOptional()
  @IsString()
  body_html?: string;

  @ApiPropertyOptional({ description: 'Modelo do construtor visual (JSON).' })
  @IsOptional()
  @IsObject()
  builder_model?: Record<string, any> | null;

  @ApiPropertyOptional({
    description:
      'Condição p/ enviar este passo: { type: "always"|"opened"|"clicked", on_fail: "skip"|"stop" }. Refere-se ao e-mail anterior.',
  })
  @IsOptional()
  @IsObject()
  condition?: Record<string, any> | null;
}

export class SaveFlowDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  active: boolean;

  @ApiProperty({ type: [FlowStepDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => FlowStepDto)
  steps: FlowStepDto[];
}
