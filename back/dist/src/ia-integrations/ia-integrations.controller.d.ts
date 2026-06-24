import { IaIntegrationsService } from './ia-integrations.service';
import { GenerateEmailTemplateDto } from './dto/generate-email-template.dto';
export declare class IaIntegrationsController {
    private readonly service;
    constructor(service: IaIntegrationsService);
    generateEmailTemplate(req: any, dto: GenerateEmailTemplateDto): Promise<{
        success: boolean;
        message: string;
        data: {
            subject: string;
            body_html: string;
            html: import("./ia-integrations.service").GeneratedEmailTemplate;
        };
        template: import("./ia-integrations.service").GeneratedEmailTemplate;
    }>;
}
