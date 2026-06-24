import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateWebchatSplitDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;
}
