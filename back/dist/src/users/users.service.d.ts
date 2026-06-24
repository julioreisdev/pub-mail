import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { wallets_status, users_role } from 'generated/prisma/client';
export declare class UsersService {
    private prisma;
    constructor(prisma: PrismaService);
    register(dto: CreateUserDto): Promise<{
        user: {
            id: string;
            organization_id: string;
            name: string;
            email: string;
            role: users_role;
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
        wallet: {
            id: string;
            organization_id: string;
            status: wallets_status;
            balance: import("@prisma/client-runtime-utils").Decimal;
        };
    }>;
    findAllByOrganization(organizationId: string): Promise<{
        id: string;
        organization_id: string;
        name: string;
        email: string;
        role: users_role;
        active: boolean;
    }[]>;
    findMe(userId: string, organizationId: string): Promise<{
        id: string;
        organization_id: string;
        name: string;
        email: string;
        role: users_role;
        active: boolean;
    }>;
    findOneInOrganization(organizationId: string, userId: string): Promise<{
        id: string;
        organization_id: string;
        name: string;
        email: string;
        role: users_role;
        active: boolean;
    }>;
    updateInOrganization(organizationId: string, userId: string, dto: UpdateUserDto): Promise<{
        id: string;
        organization_id: string;
        name: string;
        email: string;
        role: users_role;
        active: boolean;
    }>;
    removeInOrganization(organizationId: string, userId: string): Promise<{
        id: string;
        organization_id: string;
        name: string;
        email: string;
        role: users_role;
        active: boolean;
    }>;
}
