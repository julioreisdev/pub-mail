import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { API_SCOPES } from '../api-scopes';

// DTOs da API pública v1 e do painel de chaves (Fase 5). ValidationPipe global (whitelist + forbidNonWhitelisted):
// campo fora daqui = 400.

// ---- painel: chaves
export class CreateApiKeyDto {
  @IsString() @MinLength(1) @MaxLength(80) name: string;
  @IsOptional() @IsArray() @ArrayMaxSize(API_SCOPES.length) @IsIn([...API_SCOPES], { each: true }) scopes?: string[];
}
export class UpdateApiKeyDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(API_SCOPES.length) @IsIn([...API_SCOPES], { each: true }) scopes?: string[];
}

// ---- clientes
export class ApiCreateCustomerDto {
  @IsString() @MinLength(1) @MaxLength(255) name: string;
  @IsString() @Matches(/^\+?[\d\s().-]{8,24}$/, { message: 'Telefone: DDI+DDD+número (ex.: 5511999999999).' }) phone: string;
  @IsOptional() @IsString() @MaxLength(32) doc?: string;
  @IsOptional() @IsString() @MaxLength(255) email?: string;
  @IsOptional() @IsString() @MaxLength(32) code?: string;
  @IsOptional() @IsIn(['person', 'company']) kind?: string;
  @IsOptional() @IsObject() custom?: Record<string, unknown>;
  @IsOptional() @IsObject() address?: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(20000) notes?: string;
  @IsOptional() @IsBoolean() another?: boolean; // outro cliente num número que já é de um cliente
  // Fase 7: unidade, id no sistema externo, endereços de atendimento/entrega
  @IsOptional() @ValidateIf((o) => o.unit_id !== null) @IsString() unit_id?: string | null;
  @IsOptional() @ValidateIf((o) => o.external_id !== null) @IsString() @MaxLength(64) external_id?: string | null;
  @IsOptional() @ValidateIf((o) => o.addresses !== null) @IsArray() addresses?: Record<string, unknown>[] | null;
}
export class ApiUpdateCustomerDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) name?: string;
  @IsOptional() @ValidateIf((o) => o.doc !== null) @IsString() @MaxLength(32) doc?: string | null;
  @IsOptional() @ValidateIf((o) => o.email !== null) @IsString() @MaxLength(255) email?: string | null;
  @IsOptional() @ValidateIf((o) => o.code !== null) @IsString() @MaxLength(32) code?: string | null;
  @IsOptional() @IsIn(['person', 'company']) kind?: string;
  @IsOptional() @IsObject() custom?: Record<string, unknown>;
  @IsOptional() @ValidateIf((o) => o.address !== null) @IsObject() address?: Record<string, unknown> | null;
  @IsOptional() @ValidateIf((o) => o.notes !== null) @IsString() @MaxLength(20000) notes?: string | null;
  @IsOptional() @IsIn(['active', 'inactive']) status?: string;
  // Fase 7: unidade, id no sistema externo, endereços de atendimento/entrega
  @IsOptional() @ValidateIf((o) => o.unit_id !== null) @IsString() unit_id?: string | null;
  @IsOptional() @ValidateIf((o) => o.external_id !== null) @IsString() @MaxLength(64) external_id?: string | null;
  @IsOptional() @ValidateIf((o) => o.addresses !== null) @IsArray() addresses?: Record<string, unknown>[] | null;
}

// ---- assinaturas
export class ApiCreateSubscriptionDto {
  @IsString() @MaxLength(36) product_id: string;
  @IsOptional() @IsInt() @Min(1) @Max(28) due_day?: number;
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'start_date: YYYY-MM-DD.' }) start_date?: string;
  @IsOptional() @IsString() @MaxLength(32) coupon?: string;
  @IsOptional() @IsBoolean() trial?: boolean; // false = pula o teste grátis do produto
  @IsOptional() @IsBoolean() charge_now?: boolean; // cria e envia a 1ª cobrança agora (padrão: não cobra)
  @IsOptional() @IsIn(['pix', 'boleto', 'both', 'card']) payment_method?: string;
  @IsOptional() @IsString() @MaxLength(64) external_id?: string;
  @IsOptional() @IsString() @MaxLength(64) contract_number?: string;
  @IsOptional() @IsObject() custom?: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
export class ApiCancelSubscriptionDto {
  @IsOptional() @IsIn(['product', 'immediate', 'end_of_cycle']) policy?: string;
  @IsOptional() @IsString() @MaxLength(255) reason?: string;
}
export class ApiPauseSubscriptionDto {
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'until: YYYY-MM-DD.' }) until?: string;
  @IsOptional() @IsInt() @Min(1) @Max(365) days?: number;
}
export class ApiChangePlanDto {
  @IsString() @MaxLength(36) product_id: string;
}

// ---- cobranças (sem `payment_method_id` pela API: debitar cartão salvo só pelo painel)
export class ApiCreateChargeDto {
  @IsString() @MaxLength(36) customer_id: string;
  @IsOptional() @IsInt() @Min(100) @Max(99_999_999) amount_cents?: number;
  @IsOptional() @IsString() @MaxLength(255) description?: string;
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'due_at: YYYY-MM-DD.' }) due_at?: string;
  @IsOptional() @IsIn(['pix', 'boleto', 'both', 'card']) kind?: string;
  @IsOptional() @IsString() @MaxLength(36) subscription_id?: string;
  @IsOptional() @IsString() @MaxLength(36) product_id?: string;
  @IsOptional() @IsBoolean() send?: boolean; // false = só gera (não manda no WhatsApp)
}
export class ApiResendChargeDto {
  @IsOptional() @IsIn(['pix', 'boleto', 'both', 'card']) kind?: string;
}

// ---- mensagens / contatos
export class ApiSendMessageDto {
  @IsString() @Matches(/^\+?[\d\s().-]{8,24}$/, { message: 'to: telefone com DDI+DDD+número (ex.: 5511999999999).' }) to: string;
  @IsOptional() @IsString() @MaxLength(36) session_id?: string;
  @IsOptional() @IsString() @MaxLength(4000) text?: string;
  @IsOptional() @IsString() @MaxLength(36) media_id?: string;
  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9_.:-]{1,64}$/, { message: 'idempotency_key: até 64 caracteres [A-Za-z0-9_.:-].' }) idempotency_key?: string;
}
export class ApiOptOutDto {
  @IsString() @Matches(/^\+?[\d\s().-]{8,24}$/, { message: 'phone: DDI+DDD+número.' }) phone: string;
  @IsBoolean() opted_out: boolean;
}
