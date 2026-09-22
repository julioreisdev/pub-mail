import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RecycleDto {
  @ApiProperty({ enum: ['never', 'inactive'], description: 'never = nunca interagiu; inactive = sem interação há X dias.' })
  @IsIn(['never', 'inactive'])
  criteria: 'never' | 'inactive';

  @ApiPropertyOptional({ example: 30, description: 'Dias de inatividade (quando criteria=inactive).' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  days?: number;

  @ApiProperty({ example: 'Sentimos sua falta 👋' })
  @IsString()
  @MaxLength(255)
  subject: string;

  @ApiProperty({ description: 'HTML do e-mail (do construtor).' })
  @IsString()
  body_html: string;
}
