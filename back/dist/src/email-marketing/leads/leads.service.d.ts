import { PrismaService } from '../../prisma/prisma.service';
import { CreateEmailLeadDto } from './dto/create-email-lead.dto';
import { UpdateEmailLeadDto } from './dto/update-email-lead.dto';
import { PublicSubscribeDto } from './dto/public-subscribe.dto';
export declare class EmailLeadsService {
    private prisma;
    constructor(prisma: PrismaService);
    private readonly leadSelect;
    private mergeJson;
    publicSubscribe(organizationId: string, projectId: string, dto: PublicSubscribeDto): Promise<{
        message: string;
    }>;
    create(organizationId: string, dto: CreateEmailLeadDto): Promise<{
        id: string;
        organization_id: string;
        name: string | null;
        email: string;
        attributes: import("@prisma/client/runtime/client").JsonValue;
        global_status: import("../../../generated/prisma/enums").email_leads_global_status;
    }>;
    list(organizationId: string): import("../../../generated/prisma/internal/prismaNamespace").PrismaPromise<{
        id: string;
        organization_id: string;
        name: string | null;
        email: string;
        attributes: import("@prisma/client/runtime/client").JsonValue;
        global_status: import("../../../generated/prisma/enums").email_leads_global_status;
    }[]>;
    update(organizationId: string, id: string, dto: UpdateEmailLeadDto): Promise<{
        id: string;
        organization_id: string;
        name: string | null;
        email: string;
        attributes: import("@prisma/client/runtime/client").JsonValue;
        global_status: import("../../../generated/prisma/enums").email_leads_global_status;
    }>;
    remove(organizationId: string, id: string): Promise<{
        message: string;
    }>;
    countLeadsByProject(organizationId: string, projectId: string): Promise<{
        inscribed_leads: number;
        unscribed_leads: number;
    }>;
    unsubscribe(projectId: string, leadEmail: string): Promise<string>;
}
