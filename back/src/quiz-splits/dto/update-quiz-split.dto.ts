import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateQuizSplitDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  // A-66: renomear NÃO altera o slug (links publicados continuam valendo).
  // Só muda se vier explícito aqui.
  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;
}
