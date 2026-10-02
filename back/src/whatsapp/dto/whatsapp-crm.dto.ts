import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

// ---- CRM do WhatsApp: produtos, clientes, assinaturas (fase 1)
export const BILLINGS = ['once', 'monthly', 'quarterly', 'yearly'] as const;
export const CUSTOMER_STATUSES = ['active', 'inactive'] as const;
export const SUBSCRIPTION_STATUSES = ['active', 'overdue', 'paused', 'canceled'] as const;

export class ProductDto {
  @IsString() @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsInt() @Min(0) @Max(99_999_999) price_cents: number;
  @IsOptional() @IsIn([...BILLINGS]) billing?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsInt() @Min(0) position?: number;
}

export class AddressDto {
  @IsOptional() @IsString() @MaxLength(9) zip?: string;
  @IsOptional() @IsString() @MaxLength(120) street?: string;
  @IsOptional() @IsString() @MaxLength(20) number?: string;
  @IsOptional() @IsString() @MaxLength(60) complement?: string;
  @IsOptional() @IsString() @MaxLength(80) district?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(2) state?: string;
}

export class CustomerDto {
  // promover um contato existente OU criar pelo telefone (DDI+DDD+número)
  @ValidateIf((o) => !o.phone) @IsString() contact_id?: string;
  @ValidateIf((o) => !o.contact_id) @IsString() phone?: string;
  @IsOptional() @IsString() @MaxLength(255) name?: string;
  @IsOptional() @IsString() @MaxLength(20) doc?: string;
  @IsOptional() @IsString() @MaxLength(255) email?: string;
  @IsOptional() @IsObject() address?: AddressDto;
  @IsOptional() @IsString() @MaxLength(20000) notes?: string;
  @IsOptional() @IsObject() custom?: Record<string, unknown>;
  @IsOptional() @IsIn([...CUSTOMER_STATUSES]) status?: string;
  @IsOptional() @IsString() since?: string;
}

export class SubscriptionDto {
  @IsOptional() @IsString() product_id?: string | null;
  @IsOptional() @IsString() @MaxLength(120) product_name?: string;
  @IsOptional() @IsInt() @Min(0) @Max(99_999_999) price_cents?: number;
  @IsOptional() @IsIn([...BILLINGS]) billing?: string;
  @IsOptional() @IsInt() @Min(1) @Max(28) due_day?: number | null;
  @IsOptional() @IsIn([...SUBSCRIPTION_STATUSES]) status?: string;
  @IsOptional() @IsString() started_at?: string | null;
  @IsOptional() @IsString() next_due_at?: string | null;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class CustomFieldDto {
  @IsString() @MaxLength(40) key: string;
  @IsString() @MaxLength(60) label: string;
  @IsOptional() @IsIn(['text', 'number', 'date', 'select']) type?: string;
  @IsOptional() @IsArray() options?: string[];
}
export class CrmSettingsDto {
  @IsOptional() @IsArray() @Type(() => CustomFieldDto) custom_fields?: CustomFieldDto[];
}
