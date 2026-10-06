import { IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { MODULES } from '../modules.const';

export class BillingSettingsDto {
  @IsOptional() @IsString() provider?: string;
  @IsOptional() @IsString() access_token?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

// Preço em centavos; period_days null = vitalício.
export class UpdatePlanDto {
  @IsOptional() @IsInt() @Min(0) price_cents?: number;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(1) @Max(3650) period_days?: number | null;
  @IsOptional() @IsString() @MaxLength(255) notes?: string | null;
}

export class ExtendDto {
  @IsInt() @Min(1) @Max(3650) days: number;
}

export class UserModulesDto {
  @IsArray() @IsIn(MODULES, { each: true }) modules: string[];
}

// Novo CLIENTE = organização + usuário dono + plano + módulos, numa transação.
export class CreateClientDto {
  @IsString() @MinLength(2) name: string;
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
  @IsOptional() @IsString() @MaxLength(255) org_name?: string;
  @IsArray() @IsIn(MODULES, { each: true }) modules: string[];
  @IsInt() @Min(0) price_cents: number;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(1) @Max(3650) period_days?: number | null;
  @IsOptional() @IsIn(['OWNER', 'ADMIN', 'MEMBER']) role?: string;
  // Números do WhatsApp liberados p/ o usuário dono (`null`/ausente = todos). A org é nova
  // (ainda sem números), então um array vira `[]` = nenhum até o admin liberar.
  @IsOptional() @IsArray() @IsString({ each: true }) whatsapp_sessions?: string[] | null;
}

// Números do WhatsApp liberados p/ um usuário (`null` = todos).
export class UserWhatsAppSessionsDto {
  @IsOptional() @IsArray() @IsString({ each: true }) whatsapp_sessions?: string[] | null;
}
