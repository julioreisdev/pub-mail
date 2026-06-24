import { PrismaService } from '../../prisma/prisma.service';
import { CreateEmailTemplateDto } from './dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';
export declare class EmailTemplatesService {
    private prisma;
    constructor(prisma: PrismaService);
    private readonly templateSelect;
    private encodeWebhookUrls;
    create(organizationId: string, projectId: string, dto: CreateEmailTemplateDto): Promise<{
        id: string;
        name: string;
        project_id: string;
        subject: string;
        body_html: string | null;
        body_text: string | null;
    }>;
    list(organizationId: string, projectId: string): Promise<{
        id: string;
        name: string;
        project_id: string;
        subject: string;
        body_html: string | null;
        body_text: string | null;
    }[]>;
    update(organizationId: string, id: string, dto: UpdateEmailTemplateDto): Promise<{
        id: string;
        name: string;
        project_id: string;
        subject: string;
        body_html: string | null;
        body_text: string | null;
    }>;
    remove(organizationId: string, id: string): Promise<{
        message: string;
    }>;
}
