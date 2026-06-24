import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateOrganiztionDto } from './dto/update-organiztion.dto';
export declare class OrganiztionsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findMyOrganization(organizationId: string): Promise<{
        id: string;
        name: string;
        document_id: string | null;
        status: boolean;
        stripe_customer_id: string | null;
        created_at: Date;
        updated_at: Date;
    }>;
    updateMyOrganization(organizationId: string, dto: UpdateOrganiztionDto): Promise<{
        id: string;
        name: string;
        document_id: string | null;
        status: boolean;
        stripe_customer_id: string | null;
        created_at: Date;
        updated_at: Date;
    }>;
    disableMyOrganization(organizationId: string): Promise<{
        id: string;
        name: string;
        document_id: string | null;
        status: boolean;
        stripe_customer_id: string | null;
        created_at: Date;
        updated_at: Date;
    }>;
}
