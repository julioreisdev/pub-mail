import { EmailTemplatesService } from './templates.service';
import { CreateEmailTemplateDto } from './dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';
export declare class EmailTemplatesController {
    private readonly service;
    constructor(service: EmailTemplatesService);
    create(req: any, projectId: string, dto: CreateEmailTemplateDto): Promise<{
        id: string;
        name: string;
        project_id: string;
        subject: string;
        body_html: string | null;
        body_text: string | null;
    }>;
    list(req: any, projectId: string): Promise<{
        id: string;
        name: string;
        project_id: string;
        subject: string;
        body_html: string | null;
        body_text: string | null;
    }[]>;
    update(req: any, id: string, dto: UpdateEmailTemplateDto): Promise<{
        id: string;
        name: string;
        project_id: string;
        subject: string;
        body_html: string | null;
        body_text: string | null;
    }>;
    remove(req: any, id: string): Promise<{
        message: string;
    }>;
}
