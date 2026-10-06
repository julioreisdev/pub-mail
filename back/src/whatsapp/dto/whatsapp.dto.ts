import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min, ValidateIf } from 'class-validator';

export class PairingCodeDto {
  // Internacional, só dígitos (ex.: 5511999999999)
  @IsString() @Matches(/^[0-9]{8,15}$/, { message: 'Informe o número com DDI e DDD, só dígitos (ex.: 5511999999999).' })
  phone: string;
}

export class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(25) name?: string;
  @IsOptional() @IsString() @MaxLength(139) status?: string;
}

export class TestMessageDto {
  @IsOptional() @IsString() @MaxLength(500) text?: string;
}

export class PacingDto {
  @IsBoolean() enabled: boolean;
}

export class SwitchEngineDto {
  @IsIn(['wwjs', 'baileys']) engine!: string;
}

export class PurgeDataDto {
  @IsString() @Matches(/^\s*apagar\s*$/i, { message: 'Digite APAGAR para confirmar.' }) confirm!: string;
  @IsOptional() @IsBoolean() keep_contacts?: boolean;
}

// ---- números (whatsapp_sessions N por org)
export class CreateSessionDto {
  @IsOptional() @IsString() @MaxLength(80) label?: string; // nome interno ("Vendas", "Suporte")
  @IsOptional() @IsString() @Matches(/^#[0-9a-fA-F]{6}$/) color?: string;
  @IsOptional() @IsIn(['wwjs', 'baileys']) engine?: string;
}
export class UpdateSessionDto {
  @IsOptional() @IsString() @MaxLength(80) label?: string;
  @IsOptional() @IsString() @Matches(/^#[0-9a-fA-F]{6}$/) color?: string;
  @IsOptional() @IsInt() @Min(0) position?: number;
  // fluxo do bot usado por este número (null = sem bot neste número)
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() bot_flow_id?: string | null;
}
export class ReorderSessionsDto {
  @IsArray() ids!: string[];
}
