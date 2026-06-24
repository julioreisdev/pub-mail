import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAdsTxtDto {
  @ApiProperty({
    description: 'Conteúdo do ads.txt (texto puro, formato IAB). Vazio limpa.',
    example:
      'sendwebpush.com, 69af34985522c, DIRECT\ngoogle.com, pub-9597097359230576, RESELLER, f08c47fec0942fa0',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(65536)
  ads_txt?: string;
}
