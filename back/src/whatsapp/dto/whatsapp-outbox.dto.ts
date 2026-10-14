import { IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

// Fila de envios (Fase 8, contrato §12.1) — ações do painel.

export class OutboxPauseDto {
  @IsOptional() @ValidateIf((o) => o.reason !== null) @IsString() @MaxLength(255) reason?: string | null;
}

/** Ritmo do número: 1–60 por minuto; `null` = volta ao ritmo da organização. */
export class OutboxSessionRateDto {
  @IsOptional() @ValidateIf((o) => o.per_minute !== null) @IsInt() @Min(1) @Max(60) per_minute?: number | null;
}

/** Ritmo da organização (`charge.outbox_per_minute`), por número. */
export class OutboxOrgRateDto {
  @IsInt() @Min(1) @Max(60) per_minute: number;
}

export class OutboxRetryFailedDto {
  @IsOptional() @ValidateIf((o) => o.session_id !== null) @IsString() @MaxLength(36) session_id?: string | null;
}

export class OutboxCancelPendingDto {
  @IsOptional() @ValidateIf((o) => o.session_id !== null) @IsString() @MaxLength(36) session_id?: string | null;
  @IsOptional() @ValidateIf((o) => o.kind !== null) @IsString() @MaxLength(32) kind?: string | null; // tipo exato ou grupo (charge, subscription, appt, ticket, order, entitlement, api)
}
