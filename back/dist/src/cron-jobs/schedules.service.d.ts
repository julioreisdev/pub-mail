import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
export declare class EmailSchedulesRunner {
    private prisma;
    private configService;
    private readonly systemSettings;
    private readonly logger;
    private readonly emailServiceUrl;
    constructor(prisma: PrismaService, configService: ConfigService, systemSettings: SystemSettingsService);
    private mapToDispatchPayloadSummary;
    handleCron(): Promise<void>;
    private findDueSchedules;
    private processSchedule;
    private buildPayload;
    private sendEmailToMicroservice;
    executeManualDispatch(projectId: string): Promise<{
        success: boolean;
        message: string;
        dispatchId: string;
    }>;
}
