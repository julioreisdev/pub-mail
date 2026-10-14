import { PartialType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

// ---- Fase 3 das assinaturas: cupons + transições de assinatura
export const COUPON_KINDS = ['percent', 'fixed'] as const;
export const COUPON_DURATIONS = ['once', 'months', 'forever'] as const;
export const CANCEL_POLICIES = ['product', 'immediate', 'end_of_cycle'] as const;

export class CouponDto {
  @IsString() @MaxLength(32) code: string;
  @IsOptional() @IsIn([...COUPON_KINDS]) kind?: string;
  @IsInt() @Min(1) @Max(99_999_999) value: number; // percent: 1..100 · fixed: centavos
  @IsOptional() @IsIn([...COUPON_DURATIONS]) duration?: string;
  @IsOptional() @IsInt() @Min(1) @Max(36) months?: number | null;
  @IsOptional() @ValidateIf((o) => o.max_uses !== null) @IsInt() @Min(1) max_uses?: number | null;
  @IsOptional() @IsArray() product_ids?: string[];
  @IsOptional() @ValidateIf((o) => o.expires_at !== null) @IsString() expires_at?: string | null; // YYYY-MM-DD
  @IsOptional() @IsBoolean() active?: boolean;
}
/** PUT parcial validado (ver `UpdateProductDto`). */
export class UpdateCouponDto extends PartialType(CouponDto) {}

export class ValidateCouponDto {
  @IsString() @MaxLength(32) code: string;
  @IsOptional() @IsString() product_id?: string | null;
}

export class CancelSubscriptionDto {
  @IsOptional() @IsIn([...CANCEL_POLICIES]) policy?: string; // padrão: a do produto
  @IsOptional() @IsString() @MaxLength(255) reason?: string | null;
}

export class PauseSubscriptionDto {
  @IsOptional() @IsString() until?: string | null; // YYYY-MM-DD
  @IsOptional() @IsInt() @Min(1) @Max(365) days?: number | null; // alternativa a `until` (padrão 30)
}

export class ChangePlanDto {
  @IsString() product_id: string;
}
