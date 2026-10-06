import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

// ---- cobranças do WhatsApp (fase 2)
export const CHARGE_KINDS = ['pix', 'boleto', 'both'] as const;

export class CreateChargeDto {
  // cliente OU conversa (o cliente é achado pela conversa). `chat_id` = uuid da conversa (a cobrança
  // sai pelo número dessa conversa). Com `customer_id`, o número é `session_id` (opcional); sem ele,
  // a conversa mais recente do contato num número permitido ou qualquer número conectado.
  @ValidateIf((o) => !o.chat_id) @IsString() customer_id?: string;
  @ValidateIf((o) => !o.customer_id) @IsString() chat_id?: string;
  @IsOptional() @IsString() session_id?: string;
  @IsOptional() @IsString() subscription_id?: string;
  @IsOptional() @IsString() product_id?: string;
  @IsOptional() @IsInt() @Min(100) @Max(99_999_999) amount_cents?: number;
  @IsOptional() @IsString() @MaxLength(255) description?: string;
  @IsOptional() @IsIn([...CHARGE_KINDS]) kind?: string;
  @IsOptional() @IsString() due_at?: string; // YYYY-MM-DD
  @IsOptional() @IsBoolean() send?: boolean; // envia na hora (padrão sim)
}

export class ChargeSettingsDto {
  @IsOptional() @IsInt() @Min(1) @Max(30) pix_days?: number;
  @IsOptional() @IsInt() @Min(3) @Max(60) boleto_days?: number;
  @IsOptional() @IsIn([...CHARGE_KINDS]) default_kind?: string;
  @IsOptional() @IsInt() @Min(0) @Max(30) days_before_due?: number;
  @IsOptional() @IsBoolean() auto_recurring?: boolean;
  @IsOptional() @IsBoolean() send_qr?: boolean;
  @IsOptional() @IsBoolean() overdue_tag?: boolean;
  @IsOptional() @IsObject() reminders?: Record<string, unknown>;
  @IsOptional() @IsObject() texts?: Record<string, unknown>;
}
