import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class UpsertTikTokAppCredentialsDto {
  @ApiProperty({
    description: 'Client Key do app TikTok da organização',
    example: '<SECRET>',
  })
  @IsString()
  @MaxLength(255)
  client_key: string;

  @ApiProperty({
    description:
      'Client Secret do app TikTok da organização (armazenado criptografado)',
    example: '<SECRET>',
  })
  @IsString()
  @MaxLength(2000)
  client_secret: string;
}

