import { IsEnum, IsISO8601, IsOptional, IsUUID } from 'class-validator';

export enum LeadEmailEvent {
    OPEN = 'OPEN',
    CLICK = 'CLICK',
}

export class UpdateLeadMetricsDto {
    @IsUUID()
    projectId: string;

    @IsUUID()
    leadId: string;

    @IsEnum(LeadEmailEvent)
    event: LeadEmailEvent;

    // Deixamos opcional, se o micro-serviço não mandar, pegamos a hora atual
    @IsOptional()
    @IsISO8601()
    timestamp?: string;
}
