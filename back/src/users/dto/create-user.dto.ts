import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MinLength, IsString, MaxLength, IsOptional } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    example: 'Mateus Pereira',
    description: 'Nome do usuário',
  })
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'mateus@exemplo.com',
    description: 'E-mail do usuário (usado para login)',
    maxLength: 255,
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'Senha@123',
    description: 'Senha do usuário (mínimo 6 caracteres)',
    minLength: 6,
  })
  @MinLength(6)
  password: string;

  // Organization data
  @ApiProperty({
    example: 'Pub Mail',
    description: 'Nome da organização/empresa do usuário (criada no registro)',
    maxLength: 255,
  })
  @IsNotEmpty()
  organization_name: string;

  @ApiPropertyOptional({
    example: '12345678000199',
    description: 'Documento da organização (ex: CNPJ/CPF). Opcional, máx 20 caracteres',
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  document_id?: string;
}
