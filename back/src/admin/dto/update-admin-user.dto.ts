import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { MODULES } from '../../platform-billing/modules.const';

export class UpdateAdminUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['OWNER', 'ADMIN', 'MEMBER', 'SUPER_ADMIN'])
  role?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @IsIn(MODULES, { each: true })
  modules?: string[];

  // Números do WhatsApp liberados (ids de `whatsapp_sessions` da org do usuário).
  // `null` = todos; `[]` = nenhum; ausente = não mexe.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  whatsapp_sessions?: string[] | null;
}
