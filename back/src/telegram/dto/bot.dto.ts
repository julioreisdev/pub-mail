import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateBotDto {
  @ApiProperty({ description: 'Apelido do bot dentro do Pub Mail.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty({ description: 'Token do bot (obtido no @BotFather).' })
  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  @MaxLength(255)
  token: string;
}

export class UpdateBotDto {
  @ApiPropertyOptional({ description: 'Novo apelido do bot no Pub Mail.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ description: 'Novo token (substitui a credencial). Revalida no Telegram.' })
  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(255)
  token?: string;
}
