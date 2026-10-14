import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

// ---- CRM do WhatsApp: produtos, clientes, assinaturas (fase 1)
export const BILLINGS = ['once', 'monthly', 'quarterly', 'semiannual', 'yearly'] as const;
export const CANCEL_POLICIES = ['end_of_cycle', 'immediate'] as const;
export const CUSTOMER_STATUSES = ['active', 'inactive'] as const;
export const SUBSCRIPTION_STATUSES = ['active', 'overdue', 'paused', 'canceled'] as const;

export class ProductDto {
  @IsString() @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsInt() @Min(0) @Max(99_999_999) price_cents: number;
  @IsOptional() @IsIn([...BILLINGS]) billing?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsInt() @Min(0) position?: number;
  // Fase 3 (motor de assinatura)
  @IsOptional() @IsInt() @Min(0) @Max(365) trial_days?: number;
  @IsOptional() @IsInt() @Min(0) @Max(90) grace_days?: number;
  @IsOptional() @IsBoolean() prorate?: boolean;
  @IsOptional() @IsIn([...CANCEL_POLICIES]) cancel_policy?: string;
  @IsOptional() @ValidateIf((o) => o.billing_interval_months !== null) @IsIn([1, 3, 6, 12]) billing_interval_months?: number | null;
  @IsOptional() @ValidateIf((o) => o.charge_days_before !== null) @IsInt() @Min(0) @Max(30) charge_days_before?: number | null;
  @IsOptional() @ValidateIf((o) => o.reminder_rules !== null) @IsObject() reminder_rules?: Record<string, unknown> | null; // régua própria; null = a da org
  @IsOptional() @Allow() entitlement?: Record<string, unknown> | unknown[] | null; // Fase 5: {rules:[…]} ou array legado — a validação de verdade é `normalizeRules` (wa-entitlement.util)
  @IsOptional() @ValidateIf((o) => o.custom !== null) @IsObject() custom?: Record<string, unknown> | null;
  @IsOptional() @ValidateIf((o) => o.category !== null) @IsString() @MaxLength(64) category?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(12) installments_max?: number; // Fase 4: parcelas no cartão (produto avulso)
  // Fase 6 (agenda): serviço agendável (sempre avulso). `kind` ausente = mantém (serviço) / deduz da cobrança (produto/plano)
  @IsOptional() @IsIn(['product', 'plan', 'service']) kind?: string;
  @IsOptional() @ValidateIf((o) => o.duration_minutes !== null) @IsInt() @Min(5) @Max(720) duration_minutes?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(240) buffer_after_minutes?: number;
  @IsOptional() @IsInt() @Min(1) @Max(200) capacity?: number;
  @IsOptional() @ValidateIf((o) => o.booking !== null) @IsObject() booking?: Record<string, unknown> | null; // normalizado por `normalizeBooking`
  @IsOptional() @ValidateIf((o) => o.included_in_plans !== null) @IsArray() included_in_plans?: Array<{ plan_id: string; uses_per_cycle: number }> | null;
}
/** PUT parcial: todos opcionais, mas VALIDADOS (um `Partial<ProductDto>` em TS não tem metadados → o ValidationPipe pulava tudo). */
export class UpdateProductDto extends PartialType(ProductDto) {}

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
  // Fase 1 (identidade)
  @IsOptional() @IsString() @MaxLength(32) code?: string | null; // código/matrícula/contrato (único por org)
  @IsOptional() @IsIn(['person', 'company']) kind?: string;
  @IsOptional() @IsString() parent_customer_id?: string | null; // dependente/filial de outro cliente
  @IsOptional() @IsBoolean() another?: boolean; // cadastrar OUTRO cliente num número que já é cliente
  @IsOptional() @IsArray() phones?: string[]; // números extras a vincular na criação (papel "user")
  // Fase 7: unidade, id no sistema externo (ERP/loja), endereços de atendimento/entrega (o `address` é o de cobrança)
  @IsOptional() @ValidateIf((o) => o.unit_id !== null) @IsString() unit_id?: string | null;
  @IsOptional() @ValidateIf((o) => o.external_id !== null) @IsString() @MaxLength(64) external_id?: string | null;
  @IsOptional() @ValidateIf((o) => o.addresses !== null) @IsArray() @ArrayMaxSize(10) addresses?: Record<string, unknown>[] | null;
}
export class UpdateCustomerDto extends PartialType(CustomerDto) {}

export class LinkContactDto {
  @ValidateIf((o) => !o.phone) @IsString() contact_id?: string;
  @ValidateIf((o) => !o.contact_id) @IsString() phone?: string;
  @IsOptional() @IsIn(['owner', 'financial', 'user', 'dependent']) role?: string;
}
export class ContactRoleDto {
  @IsIn(['owner', 'financial', 'user', 'dependent']) role: string;
}
export class IdentityDto {
  @IsOptional() @IsBoolean() require_doc?: boolean;
  @IsOptional() @IsArray() doc_kinds?: string[];
  @IsOptional() @IsString() @MaxLength(500) ask_doc_text?: string;
  @IsOptional() @IsString() @MaxLength(500) doc_not_found_text?: string;
  @IsOptional() @IsString() @MaxLength(500) doc_invalid_text?: string;
  @IsOptional() @IsBoolean() use_code?: boolean;
  @IsOptional() @IsString() @MaxLength(40) code_label?: string;
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
  // Fase 3 (criação via motor: cupom, data de início, trial; ids externos)
  @IsOptional() @IsString() @MaxLength(32) coupon?: string;
  @IsOptional() @IsString() start_date?: string; // YYYY-MM-DD (padrão hoje)
  @IsOptional() @IsBoolean() trial?: boolean; // false = pula o trial do produto
  @IsOptional() @ValidateIf((o) => o.external_id !== null) @IsString() @MaxLength(64) external_id?: string | null;
  @IsOptional() @ValidateIf((o) => o.contract_number !== null) @IsString() @MaxLength(64) contract_number?: string | null;
  @IsOptional() @ValidateIf((o) => o.custom !== null) @IsObject() custom?: Record<string, unknown> | null;
  @IsOptional() @IsBoolean() charge_now?: boolean; // cria e envia a 1ª cobrança (pró-rata/avulsa) agora; padrão: não cobra
  // Fase 4: meio de pagamento da assinatura (null = padrão das cobranças) e o cartão salvo usado no cartão
  @IsOptional() @ValidateIf((o) => o.payment_method !== null) @IsIn(['pix', 'boleto', 'both', 'card']) payment_method?: string | null;
  @IsOptional() @ValidateIf((o) => o.payment_method_id !== null) @IsString() @MaxLength(36) payment_method_id?: string | null;
}

export class CrmSettingsDto {
  // Fase 7: mapa por entidade {customer, product, subscription, charge, ticket, appointment, order} (array = só clientes, formato antigo)
  @IsOptional() @Allow() custom_fields?: Record<string, unknown> | unknown[];
  @IsOptional() @IsObject() identity?: IdentityDto;
}
