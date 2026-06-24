import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, IsEnum, MaxLength } from 'class-validator';
import { users_role } from 'generated/prisma/client';

export class UpdateUserDto {
  @ApiPropertyOptional({
    example: 'Mateus Pereira',
    description: 'Nome do usuário',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    example: 'ADMIN',
    description: 'Papel do usuário dentro da organização',
    enum: users_role,
  })
  @IsOptional()
  @IsEnum(users_role)
  role?: users_role;

  @ApiPropertyOptional({
    example: true,
    description: 'Ativa ou desativa o usuário (soft disable)',
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
