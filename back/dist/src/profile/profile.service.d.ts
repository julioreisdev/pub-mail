import { PrismaService } from '../prisma/prisma.service';
export declare class ProfileService {
    private prisma;
    constructor(prisma: PrismaService);
    getMe(userId: string, organizationId: string): Promise<{
        user: {
            id: string;
            organization_id: string;
            name: string;
            email: string;
            role: import("../../generated/prisma/enums").users_role;
            active: boolean;
        };
        organization: {
            id: string;
            name: string;
            document_id: string | null;
            status: boolean;
            stripe_customer_id: string | null;
            created_at: Date;
            updated_at: Date;
        };
    }>;
}
