import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateEmailProjectDto {
  @ApiPropertyOptional({
    example: 'Promoções Semanais',
    maxLength: 255,
    description: 'Novo nome do projeto/lista de e-mail',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    example: { senderName: 'Equipe Marketing', senderEmail: 'promo@pubmail.com' },
    description: 'Atualização das configurações do projeto (JSON livre)',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  settings?: any; // JSON

  @ApiPropertyOptional({
    example: true,
    description: 'Ativa ou desativa o projeto (soft toggle)',
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
