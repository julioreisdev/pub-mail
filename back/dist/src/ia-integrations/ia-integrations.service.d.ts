import { PrismaService } from '../prisma/prisma.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { GenerateEmailTemplateDto } from './dto/generate-email-template.dto';
export interface GeneratedEmailTemplate {
    subject: string;
    html: string;
}
export declare class IaIntegrationsService {
    private readonly prisma;
    private readonly systemSettings;
    constructor(prisma: PrismaService, systemSettings: SystemSettingsService);
    private isRecord;
    private parseTemplateCandidate;
    private normalizeTemplatePayload;
    generateEmailTemplate(organizationId: string, dto: GenerateEmailTemplateDto): Promise<{
        success: boolean;
        message: string;
        data: {
            subject: string;
            body_html: string;
            html: GeneratedEmailTemplate;
        };
        template: GeneratedEmailTemplate;
    }>;
}
