import { IsArray, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { MODULES, SUB_PERMISSIONS } from '../../platform-billing/modules.const';

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
  @IsIn([...MODULES, ...SUB_PERMISSIONS, 'whatsapp:basic'], { each: true })
  modules?: string[];

  // Números do WhatsApp liberados p/ este usuário (ids de `whatsapp_sessions` da MESMA org).
  // `null`/ausente = todos; `[]` = nenhum. Ignorado p/ OWNER/ADMIN/SUPER_ADMIN (sempre todos).
  // (@IsOptional deixa null passar sem validar o array.)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  whatsapp_sessions?: string[] | null;
}
