import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

// Usa os mesmos status que criamos na migração do Prisma
export enum ScheduleSentStatus {
    PROCESSING = 'PROCESSING',
    COMPLETED = 'COMPLETED',
    PARTIAL = 'PARTIAL',
    FAILED = 'FAILED',
}

export class UpdateScheduleSentDto {
    @IsEnum(ScheduleSentStatus)
    status: ScheduleSentStatus;

    @IsInt()
    @Min(0)
    sent_for_leads: number;

    @IsOptional()
    @IsString()
    error_message?: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    invalid_count?: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    failed_count?: number;
}
