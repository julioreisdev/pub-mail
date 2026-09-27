import { PartialType } from '@nestjs/mapped-types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateWebchatDto } from './create-webchat.dto';

export class UpdateWebchatDto extends PartialType(CreateWebchatDto) {
  // A-66: renomear não muda o slug; só muda se vier explícito aqui.
  @ApiPropertyOptional({ description: 'Novo slug (opcional). Renomear NÃO altera o slug.' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;
}
