import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class QuizAdPayloadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  codigo_tag?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  codigo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gpt_slot?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gpt_div_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  gpt_sizes?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  anuncio_fixed?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  html?: string;

  @ApiPropertyOptional({ description: 'Rótulo acima do anúncio. Default: PUBLICIDADE.' })
  @IsOptional()
  @IsString()
  rotulo?: string;

  @ApiPropertyOptional({ description: 'Se false, não exibe rótulo. Default: true.' })
  @IsOptional()
  @IsBoolean()
  rotuloAtivo?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

// Por ora a UI só usa `topo`, mas rodape/intersticial já são aceitos no back
// para liberar novas posições sem mudança de schema/DTO.
export class UpdateQuizAdsDto {
  @ApiPropertyOptional({ type: () => QuizAdPayloadDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => QuizAdPayloadDto)
  topo?: QuizAdPayloadDto;

  @ApiPropertyOptional({ type: () => QuizAdPayloadDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => QuizAdPayloadDto)
  rodape?: QuizAdPayloadDto;

  @ApiPropertyOptional({ type: () => QuizAdPayloadDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => QuizAdPayloadDto)
  intersticial?: QuizAdPayloadDto;
}
