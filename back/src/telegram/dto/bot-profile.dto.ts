import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateBotProfileDto {
  @ApiPropertyOptional({ description: 'Nome de exibição do bot.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string;

  @ApiPropertyOptional({ description: 'Descrição (tela de abertura, antes do /start).' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string;

  @ApiPropertyOptional({ description: 'Texto curto do perfil (aba Sobre).' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  short_description?: string;

  @ApiPropertyOptional({ description: 'Comandos: [{command, description}]. Vazio limpa.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  commands?: { command: string; description: string }[];
}
