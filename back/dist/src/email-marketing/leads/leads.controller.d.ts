import { EmailLeadsService } from './leads.service';
import { CreateEmailLeadDto } from './dto/create-email-lead.dto';
import { UpdateEmailLeadDto } from './dto/update-email-lead.dto';
import { PublicSubscribeDto } from './dto/public-subscribe.dto';
export declare class EmailLeadsController {
    private readonly service;
    constructor(service: EmailLeadsService);
    subscribe(organizationId: string, projectId: string, dto: PublicSubscribeDto): Promise<{
        message: string;
    }>;
    create(req: any, dto: CreateEmailLeadDto): Promise<{
        id: string;
        organization_id: string;
        name: string | null;
        email: string;
        attributes: import("@prisma/client/runtime/client").JsonValue;
        global_status: import("../../../generated/prisma/enums").email_leads_global_status;
    }>;
    list(req: any): import("../../../generated/prisma/internal/prismaNamespace").PrismaPromise<{
        id: string;
        organization_id: string;
        name: string | null;
        email: string;
        attributes: import("@prisma/client/runtime/client").JsonValue;
        global_status: import("../../../generated/prisma/enums").email_leads_global_status;
    }[]>;
    update(req: any, id: string, dto: UpdateEmailLeadDto): Promise<{
        id: string;
        organization_id: string;
        name: string | null;
        email: string;
        attributes: import("@prisma/client/runtime/client").JsonValue;
        global_status: import("../../../generated/prisma/enums").email_leads_global_status;
    }>;
    remove(req: any, id: string): Promise<{
        message: string;
    }>;
    countLeads(req: any, projectId: string): Promise<{
        inscribed_leads: number;
        unscribed_leads: number;
    }>;
    unsubscribe(projectId: string, leadEmail: string): Promise<string>;
}
