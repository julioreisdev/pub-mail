import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsISO8601, IsOptional, Max, Min, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEmailProjectScheduleDto {
  @ApiProperty({
    example: true,
    description:
      'Se true: dispara diariamente no minuto do dia (time). Se false: dispara conforme date/time (one-off) OU conforme intervalo (for_x_days).',
  })
  @IsBoolean()
  daily: boolean;

  @ApiPropertyOptional({
    example: '2026-02-15T10:23:00.000Z',
    description:
      'Obrigatório quando daily=false e for_x_days NÃO for informado (one-off). Deve ser null quando for_x_days for informado (intervalo).',
  })
  @IsOptional()
  @ValidateIf((o) => o.date !== null && o.date !== undefined)
  @IsISO8601()
  date?: string | null;

   @ApiPropertyOptional({
    examples: {
      hourOnly: {
        summary: 'Hora (0..23) — compatibilidade com frontend',
        value: 17,
      },
      minutesOfDay: {
        summary: 'Minuto do dia (0..1439) — formato legado',
        value: 1020,
      },
    },
    minimum: 0,
    maximum: 1439,
    description:
      'Horário do agendamento. Aceita **hora (0..23)** (ex: 17 => 17:00) OU **minuto do dia (0..1439)** (ex: 17:00 => 17*60 = 1020). ' +
      'Obrigatório para daily=true e também para interval (for_x_days).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1439)
  time?: number;

  @ApiPropertyOptional({
    example: 10,
    minimum: 1,
    description:
      'Intervalo de dias. Se informado: daily deve ser false e date deve ser null. O agendamento executa e só volta a executar após N dias (controlado por last_run).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  for_x_days?: number;
}
