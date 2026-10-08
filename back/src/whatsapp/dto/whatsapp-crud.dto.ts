import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsISO8601, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

// ---- contatos
export class PatchContactDto {
  @IsOptional() @IsBoolean() saved?: boolean;
  @IsOptional() @IsArray() tags?: string[];
  @IsOptional() @IsString() @MaxLength(255) name?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsOptional() @IsBoolean() opted_out?: boolean; // LGPD: true = descadastrar, false = reativar
}
export class BulkContactsDto {
  @IsArray() @ArrayMaxSize(2000) ids: string[];
  @IsOptional() @IsBoolean() saved?: boolean;
  @IsOptional() @IsArray() add_tags?: string[];
  @IsOptional() @IsArray() remove_tags?: string[];
}
export class CreateContactDto {
  @IsString() phone: string;
  @IsOptional() @IsString() @MaxLength(255) name?: string;
  @IsOptional() @IsArray() tags?: string[];
}

// ---- chats / mensagens
export class OpenChatDto {
  @IsOptional() @IsString() session_id?: string; // por qual NÚMERO da organização abrir a conversa (vazio = o 1º conectado que o usuário pode usar)
  @IsString() phone: string;
  @IsOptional() @IsString() name?: string; // salva o contato com esse nome (conversa nova com número que não está na agenda)
}
export class SyncChatsDto {
  @IsString() session_id: string;
}
export class ChatFlagDto {
  @IsOptional() @IsBoolean() archived?: boolean;
  @IsOptional() @IsBoolean() pinned?: boolean;
  @IsOptional() @IsBoolean() muted?: boolean;
  @IsOptional() @IsBoolean() typing?: boolean;
}
export class SendTextDto {
  @IsString() chat_id: string;
  @IsString() @MinLength(1) @MaxLength(65536) text: string;
  @IsOptional() @IsString() quoted_wa_id?: string;
  @IsOptional() @IsArray() mentions?: string[];
}
export class SendLocationDto {
  @IsString() chat_id: string;
  @IsNumber() latitude: number;
  @IsNumber() longitude: number;
  @IsOptional() @IsString() @MaxLength(255) description?: string;
}
export class SendPollDto {
  @IsString() chat_id: string;
  @IsString() @MinLength(1) @MaxLength(255) name: string;
  @IsArray() @ArrayMaxSize(12) options: string[];
  @IsOptional() @IsBoolean() multiple?: boolean;
}
export class ReactDto {
  @IsString() @MaxLength(16) emoji: string;
}
export class ForwardDto {
  @IsArray() @ArrayMaxSize(20) to: string[];
}
export class EditMessageDto {
  @IsString() @MinLength(1) @MaxLength(65536) text: string;
}

// ---- status
export class CreateStatusDto {
  // números que vão publicar (uma linha por número, mesmo lote)
  @IsArray() @ArrayMaxSize(50) session_ids: string[];
  @IsIn(['text', 'image', 'video', 'voice']) type: string;
  @IsOptional() @IsString() @MaxLength(700) body?: string;
  @IsOptional() @IsString() @MaxLength(16) bg_color?: string;
  @IsOptional() @IsInt() @Min(0) @Max(5) font?: number;
  @IsOptional() @IsString() media_id?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsISO8601() schedule_at?: string | null;
}
export class PatchStatusDto {
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsISO8601() schedule_at?: string | null;
  @IsOptional() @IsString() @MaxLength(700) body?: string;
  @IsOptional() @IsString() @MaxLength(16) bg_color?: string;
  @IsOptional() @IsInt() @Min(0) @Max(5) font?: number;
}

// ---- broadcasts
export class BroadcastDto {
  @IsString() @MinLength(1) @MaxLength(255) name: string;
  // números que disparam (1..N). Audiência "salvos/todos" é DISTRIBUÍDA entre eles; conversas/grupos escolhidos saem pelo número de cada um.
  @IsOptional() @IsArray() @ArrayMaxSize(50) session_ids?: string[];
  // com 2+ números: 'shared' = usar em conjunto (audiência somada e dividida igualmente) | 'own' = cada número dispara para seus contatos
  @IsOptional() @IsIn(['shared', 'own']) distribution?: string;
  // ritmo: { preset: 'fast'|'normal'|'safe'|'very_safe'|'custom', interval_ms, jitter_pct, daily_limit, pause_every, pause_minutes, window: { start, end } }
  @IsOptional() pacing?: any;
  @IsOptional() targets?: any;
  @IsOptional() @IsArray() @ArrayMaxSize(48) times?: number[];
  @IsOptional() @IsIn(['sequential', 'random']) mode?: string;
  @IsOptional() @IsBoolean() delete_used?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsInt() @Min(1000) @Max(120000) interval_ms?: number;
  @IsOptional() @IsBoolean() risk_ack?: boolean;
}
export class CopiesDto {
  @IsArray() @ArrayMaxSize(50) copies: any[];
}
export class AudienceDto {
  @IsOptional() targets?: any;
  @IsOptional() @IsArray() session_ids?: string[];
  @IsOptional() @IsIn(['shared', 'own']) distribution?: string;
}
export class RunsQueryDto {
  @IsOptional() @Type(() => Number) page?: number;
  @IsOptional() @Type(() => Number) page_size?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
}
