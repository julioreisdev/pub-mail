import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateQuizSplitDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;
}
