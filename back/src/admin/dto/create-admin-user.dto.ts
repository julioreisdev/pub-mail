import { IsArray, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { MODULES } from '../../platform-billing/modules.const';

export class CreateAdminUserDto {
  @IsString()
  organization_id: string;

  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsIn(['OWNER', 'ADMIN', 'MEMBER', 'SUPER_ADMIN'])
  role?: string;

  // Módulos liberados p/ ESTE usuário (herda nada da org — é por usuário).
  @IsOptional()
  @IsArray()
  @IsIn(MODULES, { each: true })
  modules?: string[];
}
