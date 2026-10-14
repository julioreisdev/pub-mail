import { PartialType } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsObject, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { RESOURCE_KINDS, WAIT_PERIODS } from '../wa-schedule.util';

// Agenda (Fase 6) — DTOs do painel. Datas: ISO (`2026-10-15T14:30:00-03:00`) ou, onde indicado, YYYY-MM-DD (BRT).

export class ResourceDto {
  @IsString() @MaxLength(120) name: string;
  @IsOptional() @IsIn([...RESOURCE_KINDS]) kind?: string;
  @IsOptional() @ValidateIf((o) => o.color !== null) @IsString() @MaxLength(7) color?: string | null;
  @IsOptional() @ValidateIf((o) => o.photo_media_id !== null) @IsString() photo_media_id?: string | null;
  @IsOptional() @ValidateIf((o) => o.session_id !== null) @IsString() session_id?: string | null; // número preferido para avisos
  @IsOptional() @ValidateIf((o) => o.user_id !== null) @IsString() user_id?: string | null; // profissional = usuário do painel
  @IsOptional() @IsArray() @ArrayMaxSize(200) services?: string[]; // vazio = todos os serviços
  @IsOptional() @IsObject() availability?: Record<string, unknown>; // { weekly: {'0'..'6': [{start,end}]}, slot_minutes }
  @IsOptional() @IsBoolean() active?: boolean;
}
/** PUT parcial validado (ex.: só `{active}`). */
export class UpdateResourceDto extends PartialType(ResourceDto) {}

export class ReorderResourcesDto {
  @IsArray() @ArrayMaxSize(200) ids: string[];
}

export class BlockDto {
  @IsString() starts_at: string; // ISO ou YYYY-MM-DD (00:00 BRT)
  @IsString() ends_at: string; // ISO ou YYYY-MM-DD (fim do dia BRT)
  @IsOptional() @ValidateIf((o) => o.reason !== null) @IsString() @MaxLength(120) reason?: string | null;
}

export class BookAppointmentDto {
  @IsString() product_id: string;
  @IsOptional() @ValidateIf((o) => o.resource_id !== null) @IsString() resource_id?: string | null;
  @IsISO8601() starts_at: string;
  @IsOptional() @ValidateIf((o) => o.customer_id !== null) @IsString() customer_id?: string | null;
  @IsOptional() @ValidateIf((o) => o.contact_id !== null) @IsString() contact_id?: string | null;
  @IsOptional() @ValidateIf((o) => o.session_id !== null) @IsString() session_id?: string | null;
  @IsOptional() @ValidateIf((o) => o.chat_id !== null) @IsString() @MaxLength(64) chat_id?: string | null; // uuid da conversa ou jid (+ session_id)
  @IsOptional() @IsIn(['auto', 'on_site', 'charge']) payment?: 'auto' | 'on_site' | 'charge';
  @IsOptional() @ValidateIf((o) => o.notes !== null) @IsString() @MaxLength(5000) notes?: string | null;
  @IsOptional() @IsBoolean() notify?: boolean; // avisar o cliente (padrão sim)
  @IsOptional() @IsBoolean() ignore_notice?: boolean; // encaixe: ignora antecedência mínima e limite de dias
  @IsOptional() @IsObject() custom?: Record<string, unknown>; // Fase 7: campos personalizados do agendamento
}

export class PatchAppointmentDto {
  @IsOptional() @ValidateIf((o) => o.notes !== null) @IsString() @MaxLength(5000) notes?: string | null;
  @IsOptional() @ValidateIf((o) => o.custom !== null) @IsObject() custom?: Record<string, unknown> | null;
}

export class AppointmentActionDto {
  @IsOptional() @IsBoolean() notify?: boolean;
}

export class CancelAppointmentDto {
  @IsOptional() @ValidateIf((o) => o.reason !== null) @IsString() @MaxLength(255) reason?: string | null;
  @IsOptional() @IsIn(['credit', 'refund', 'keep', 'free']) policy_override?: string;
  @IsOptional() @IsBoolean() notify?: boolean;
}

export class RescheduleAppointmentDto {
  @IsISO8601() starts_at: string;
  @IsOptional() @ValidateIf((o) => o.resource_id !== null) @IsString() resource_id?: string | null;
  @IsOptional() @IsBoolean() notify?: boolean;
}

export class WaitlistDto {
  @IsString() product_id: string;
  @IsOptional() @ValidateIf((o) => o.resource_id !== null) @IsString() resource_id?: string | null;
  @IsOptional() @ValidateIf((o) => o.date_from !== null) @IsString() date_from?: string | null; // YYYY-MM-DD
  @IsOptional() @ValidateIf((o) => o.date_to !== null) @IsString() date_to?: string | null;
  @IsOptional() @IsIn([...WAIT_PERIODS]) period?: string;
  @IsOptional() @ValidateIf((o) => o.customer_id !== null) @IsString() customer_id?: string | null;
  @IsOptional() @ValidateIf((o) => o.contact_id !== null) @IsString() contact_id?: string | null;
  @IsOptional() @ValidateIf((o) => o.session_id !== null) @IsString() session_id?: string | null;
  @IsOptional() @ValidateIf((o) => o.chat_id !== null) @IsString() @MaxLength(64) chat_id?: string | null;
}

export class WaitlistOfferDto {
  @IsOptional() @ValidateIf((o) => o.starts_at !== null) @IsISO8601() starts_at?: string | null; // ausente = 1ª vaga compatível
  @IsOptional() @ValidateIf((o) => o.resource_id !== null) @IsString() resource_id?: string | null;
}

export class SchedulingSettingsDto {
  @IsOptional() @IsObject() texts?: Record<string, string>;
  @IsOptional() @IsString() @MaxLength(5) reminder_d1_hour?: string; // HH:MM (BRT)
  @IsOptional() @IsBoolean() reminder_h2?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(1440) no_show_after_minutes?: number; // 0 = sem falta automática
  @IsOptional() @IsBoolean() auto_complete?: boolean;
  @IsOptional() @IsInt() @Min(5) @Max(1440) waitlist_offer_minutes?: number;
  @IsOptional() @IsBoolean() staff_notify?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(20) no_show_deposit_after?: number;
}
