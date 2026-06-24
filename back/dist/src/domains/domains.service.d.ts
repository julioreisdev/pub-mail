import { PrismaService } from '../prisma/prisma.service';
import { CreateDomainDto } from './dto/create-domain.dto';
import { SystemSettingsService } from '../system-settings/system-settings.service';
export declare class DomainsService {
    private prisma;
    private readonly systemSettings;
    constructor(prisma: PrismaService, systemSettings: SystemSettingsService);
    private getResend;
    create(organizationId: string, dto: CreateDomainDto): Promise<{
        id: string;
        organization_id: string;
        status: import("../../generated/prisma/enums").domain_status;
        created_at: Date;
        updated_at: Date;
        domain: string;
        provider_id: string | null;
        dns_records: import("@prisma/client/runtime/client").JsonValue | null;
    }>;
    list(organizationId: string): Promise<{
        id: string;
        organization_id: string;
        status: import("../../generated/prisma/enums").domain_status;
        created_at: Date;
        updated_at: Date;
        domain: string;
        provider_id: string | null;
        dns_records: import("@prisma/client/runtime/client").JsonValue | null;
    }[]>;
    remove(organizationId: string, domainId: string): Promise<{
        message: string;
    }>;
    verifyReal(organizationId: string, domainId: string): Promise<{
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
