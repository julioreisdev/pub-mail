import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateQuizSplitDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;
}
