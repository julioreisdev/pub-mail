import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateWebchatDomainDto {
  @ApiProperty({ example: 'chat.suaempresa.com.br' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  domain: string;
}
