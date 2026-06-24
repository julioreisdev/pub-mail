import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateEmailProjectDto {
  @ApiProperty({
    example: 'Newsletter Diária',
    maxLength: 255,
    description: 'Nome do projeto/lista de e-mail',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    example: { senderName: 'Pub Mail', senderEmail: 'news@pubmail.com' },
    description: 'Configurações livres do projeto (JSON), para uso futuro',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  settings?: any; // JSON
}
