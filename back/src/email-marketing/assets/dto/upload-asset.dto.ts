import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UploadEmailAssetDto {
  @ApiProperty({ description: 'Imagem em data URL base64 (data:image/...;base64,...).' })
  @IsString()
  @IsNotEmpty()
  dataUrl: string;
}
