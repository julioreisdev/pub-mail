import { DomainsService } from './domains.service';
import { CreateDomainDto } from './dto/create-domain.dto';
export declare class DomainsController {
    private readonly domainsService;
    constructor(domainsService: DomainsService);
    create(req: any, createDomainDto: CreateDomainDto): Promise<{
        id: string;
        organization_id: string;
        status: import("../../generated/prisma/enums").domain_status;
        created_at: Date;
        updated_at: Date;
        domain: string;
        provider_id: string | null;
        dns_records: import("@prisma/client/runtime/client").JsonValue | null;
    }>;
    list(req: any): Promise<{
        id: string;
        organization_id: string;
        status: import("../../generated/prisma/enums").domain_status;
        created_at: Date;
        updated_at: Date;
        domain: string;
        provider_id: string | null;
        dns_records: import("@prisma/client/runtime/client").JsonValue | null;
    }[]>;
    remove(req: any, id: string): Promise<{
        message: string;
    }>;
    verifyReal(req: any, id: string): Promise<{
        id: string;
        organization_id: string;
        status: import("../../generated/prisma/enums").domain_status;
        created_at: Date;
        updated_at: Date;
        domain: string;
        provider_id: string | null;
        dns_records: import("@prisma/client/runtime/client").JsonValue | null;
    }>;
}
