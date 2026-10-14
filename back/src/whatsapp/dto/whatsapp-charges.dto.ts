import { IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

// ---- cobranças do WhatsApp (fase 2)
export const CHARGE_KINDS = ['pix', 'boleto', 'both', 'card'] as const;
export const DEFAULT_KINDS = ['pix', 'boleto', 'both'] as const; // padrão das cobranças (cartão vem da assinatura)

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
  // Fase 3: cobrança gerada por um bloco do bot (entrega tardia volta pelo `charge_paid` com estes ids)
  @IsOptional() @IsObject() bot?: { flow_id: string; node_id: string };
  // Fase 4: cartão — cartão salvo do cliente (cobra sozinho) e parcelas (só produto avulso)
  @IsOptional() @IsString() @MaxLength(36) payment_method_id?: string;
  @IsOptional() @IsInt() @Min(1) @Max(12) installments?: number;
  // Fase 7: campos personalizados de cobrança
  @IsOptional() @IsObject() custom?: Record<string, unknown>;
}

export class ResendChargeDto {
  @IsOptional() @IsIn([...CHARGE_KINDS]) kind?: string; // 2ª via por outro meio (padrão: o da cobrança)
}

export class ChargeSettingsDto {
  @IsOptional() @IsInt() @Min(1) @Max(30) pix_days?: number;
  @IsOptional() @IsInt() @Min(3) @Max(60) boleto_days?: number;
  @IsOptional() @IsIn([...DEFAULT_KINDS]) default_kind?: string;
  @IsOptional() @IsInt() @Min(0) @Max(30) days_before_due?: number;
  @IsOptional() @IsBoolean() auto_recurring?: boolean;
  @IsOptional() @IsBoolean() send_qr?: boolean;
  @IsOptional() @IsBoolean() overdue_tag?: boolean;
  @IsOptional() @IsObject() reminders?: Record<string, unknown>;
  @IsOptional() @IsObject() texts?: Record<string, unknown>;
  // Fase 3 (assinaturas)
  @IsOptional() @IsNumber() @Min(0) @Max(20) late_fee_percent?: number; // multa na 2ª via (%)
  @IsOptional() @IsNumber() @Min(0) @Max(20) interest_month_percent?: number; // juros ao mês (%), pro rata die
  @IsOptional() @IsInt() @Min(0) @Max(90) grace_days_default?: number; // carência antes de marcar em atraso
  @IsOptional() @IsArray() cancel_reasons?: string[];
  @IsOptional() @IsObject() readjust?: { enabled?: boolean; percent?: number; month?: number; notify?: boolean };
  @IsOptional() @IsInt() @Min(1) @Max(60) outbox_per_minute?: number; // ritmo da fila de envio por número (o mesmo teto do ritmo próprio do número)
}
