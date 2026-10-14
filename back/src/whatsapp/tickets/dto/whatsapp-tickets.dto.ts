import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { TICKET_PRIORITIES, TICKET_STATUSES } from '../wa-ticket.util';

// Chamados (Fase 6B, contrato §10) — DTOs do painel e da API pública.

export class CreateTicketDto {
  @IsString() @MaxLength(60) category: string;
  @IsOptional() @ValidateIf((o) => o.subject !== null) @IsString() @MaxLength(160) subject?: string | null;
  @IsString() @MaxLength(5000) description: string;
  @IsOptional() @IsIn([...TICKET_PRIORITIES]) priority?: string;
  @IsOptional() @ValidateIf((o) => o.customer_id !== null) @IsString() customer_id?: string | null;
  @IsOptional() @ValidateIf((o) => o.contact_id !== null) @IsString() contact_id?: string | null;
  @IsOptional() @ValidateIf((o) => o.session_id !== null) @IsString() session_id?: string | null;
  @IsOptional() @ValidateIf((o) => o.chat_id !== null) @IsString() @MaxLength(64) chat_id?: string | null; // uuid da conversa ou jid (+ session_id)
  @IsOptional() @IsArray() @ArrayMaxSize(5) media_ids?: string[];
  @IsOptional() @ValidateIf((o) => o.assigned_user_id !== null) @IsString() assigned_user_id?: string | null;
  @IsOptional() @IsObject() custom?: Record<string, unknown>;
  @IsOptional() @IsBoolean() notify?: boolean; // avisar o cliente (padrão: configuração)
}

export class PatchTicketDto {
  @IsOptional() @IsIn([...TICKET_STATUSES]) status?: string;
  @IsOptional() @IsIn([...TICKET_PRIORITIES]) priority?: string;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsString() @MaxLength(160) subject?: string;
  @IsOptional() @ValidateIf((o) => o.assigned_user_id !== null) @IsString() assigned_user_id?: string | null;
  @IsOptional() @IsBoolean() notify?: boolean;
  @IsOptional() @IsObject() custom?: Record<string, unknown>; // Fase 7: campos personalizados de chamado
}

export class TicketCommentDto {
  @IsOptional() @IsString() @MaxLength(4000) body?: string;
  @IsOptional() @IsIn(['internal', 'public']) visibility?: string;
  @IsOptional() @ValidateIf((o) => o.media_id !== null) @IsString() media_id?: string | null;
  @IsOptional() @IsIn([...TICKET_STATUSES]) status?: string; // muda junto (ex.: responder e "aguardar cliente")
  @IsOptional() @IsBoolean() notify?: boolean;
}

export class AssignTicketDto {
  @IsOptional() @ValidateIf((o) => o.user_id !== null) @IsString() user_id?: string | null;
}

export class TicketSettingsDto {
  @IsOptional() @IsString() @MaxLength(6) prefix?: string;
  @IsOptional() @IsBoolean() reset_yearly?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(40) categories?: Record<string, unknown>[];
  @IsOptional() @IsObject() sla_hours?: Record<string, number>;
  @IsOptional() @IsObject() first_response_hours?: Record<string, number>;
  @IsOptional() @IsInt() @Min(5) @Max(10080) warn_before_minutes?: number;
  @IsOptional() @IsInt() @Min(0) @Max(365) auto_close_days?: number;
  @IsOptional() @IsInt() @Min(0) @Max(365) reopen_days?: number;
  @IsOptional() @IsBoolean() customer_reply_reopens?: boolean;
  @IsOptional() @IsObject() notify_customer?: Record<string, boolean>;
  @IsOptional() @IsObject() texts?: Record<string, string>;
}
