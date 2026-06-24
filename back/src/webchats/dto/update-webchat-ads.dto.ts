import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class WebchatAdPayloadDto {
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

  @ApiPropertyOptional({
    description:
      'Rótulo exibido acima do anúncio (ex.: "PUBLICIDADE"). Default: PUBLICIDADE.',
  })
  @IsOptional()
  @IsString()
  rotulo?: string;

  @ApiPropertyOptional({
    description:
      'Se false, nenhum rótulo é exibido acima do anúncio. Default: true.',
  })
  @IsOptional()
  @IsBoolean()
  rotuloAtivo?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

class WebchatBetweenMessagesPayloadDto extends WebchatAdPayloadDto {
  @ApiPropertyOptional({
    description: 'Intervalo (N) para disparo de anúncios entre mensagens.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  intervalo_mensagens?: number;

  @ApiPropertyOptional({ type: () => [WebchatAdPayloadDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WebchatAdPayloadDto)
  sequence_ads?: WebchatAdPayloadDto[];
}

export class UpdateWebchatAdsDto {
  @ApiPropertyOptional({
    description:
      'Configuração de anúncios por posição. Ex.: topo, rodape, intersticial e entre_mensagens',
    type: () => WebchatAdPayloadDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => WebchatAdPayloadDto)
  topo?: WebchatAdPayloadDto;

  @ApiPropertyOptional({
    type: () => WebchatAdPayloadDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => WebchatAdPayloadDto)
  rodape?: WebchatAdPayloadDto;

  @ApiPropertyOptional({
    type: () => WebchatAdPayloadDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => WebchatAdPayloadDto)
  intersticial?: WebchatAdPayloadDto;

  @ApiPropertyOptional({
    type: () => WebchatBetweenMessagesPayloadDto,
    description:
      'Configuração entre mensagens, com intervalo_mensagens e sequence_ads',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => WebchatBetweenMessagesPayloadDto)
  entre_mensagens?: WebchatBetweenMessagesPayloadDto;
}

