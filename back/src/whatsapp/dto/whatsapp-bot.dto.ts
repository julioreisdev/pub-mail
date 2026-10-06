import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

// ---- Fluxos do bot (N por organização; cada NÚMERO aponta para 0 ou 1 fluxo)
export class CreateBotFlowDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsObject() definition?: Record<string, any>;
  @IsOptional() @IsObject() settings?: Record<string, any>;
  // copia definition/settings de outro fluxo da organização
  @IsOptional() @IsString() clone_of?: string;
}

export class UpdateBotFlowDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsObject() definition?: Record<string, any> | null;
  @IsOptional() @IsObject() settings?: Record<string, any>;
}

export class SetBotFlowActiveDto {
  @IsBoolean() active!: boolean;
}

export class AssignBotFlowSessionsDto {
  // números (whatsapp_sessions.id) que passam a usar este fluxo; os demais que o usavam ficam sem fluxo
  @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) session_ids!: string[];
}

export class SimulateBotDto {
  @IsOptional() @IsString() flow_id?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsObject() definition?: Record<string, any> | null;
  @IsOptional() @IsObject() settings?: Record<string, any>;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsObject() state?: Record<string, any> | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(4000) input?: string | null;
  @IsOptional() @IsString() @MaxLength(40) event?: string;
}

export class BotSessionsQueryDto {
  @IsOptional() @IsString() session_id?: string;
}

export class ChatBotActionDto {
  @IsIn(['start', 'stop']) action!: 'start' | 'stop';
}
