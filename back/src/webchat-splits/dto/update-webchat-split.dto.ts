import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateWebchatSplitDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;
}
