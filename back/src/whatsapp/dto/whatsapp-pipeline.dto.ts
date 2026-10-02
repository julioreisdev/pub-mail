import { IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

// ---- funil (Kanban), tarefas e notas internas (fase 3)
export const STAGE_KINDS = ['open', 'won', 'lost'] as const;

export class StageDto {
  @IsOptional() @IsString() @MaxLength(60) name?: string;
  @IsOptional() @IsString() @MaxLength(16) color?: string;
  @IsOptional() @IsIn([...STAGE_KINDS]) kind?: string;
  // { send_text?: string, add_tags?: string[], remove_tags?: string[], task?: { title: string, days?: number } }
  @IsOptional() @IsObject() actions?: Record<string, unknown> | null;
}
export class ReorderStagesDto { @IsArray() ids!: string[]; }
export class DeleteStageQuery { @IsOptional() @IsString() move_to?: string; }

export class MoveChatDto {
  @IsString() chat_id!: string;
  @IsOptional() @IsString() stage_id?: string | null; // null/'' = tira do funil
  @IsOptional() @IsInt() @Min(0) @Max(999_999_999) deal_cents?: number | null;
}
export class DealDto {
  @IsString() chat_id!: string;
  @IsOptional() @IsInt() @Min(0) @Max(999_999_999) deal_cents?: number | null;
}

export class TaskDto {
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string | null;
  @IsOptional() @IsString() due_at?: string | null; // ISO
  @IsOptional() @IsString() assigned_user_id?: string | null;
  @IsOptional() @IsString() chat_id?: string | null;
  @IsOptional() @IsString() customer_id?: string | null;
}

export class NoteDto {
  @IsOptional() @IsString() @MaxLength(4000) text?: string;
  @IsOptional() @IsBoolean() pinned?: boolean;
}
