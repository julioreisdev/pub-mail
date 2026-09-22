import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class DispatchNowDto {
  @ApiPropertyOptional({
    description:
      'ID de um template do projeto para disparar. Ausente/null = template aleatório.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  template_id?: string | null;
}
