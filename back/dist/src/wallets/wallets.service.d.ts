import { PrismaService } from '../prisma/prisma.service';
import { ListTransactionsDto } from './dto/list-transactions.dto';
export declare class WalletsService {
    private prisma;
    constructor(prisma: PrismaService);
    getMyWallet(organizationId: string): Promise<{
        id: string;
        organization_id: string;
        status: import("../../generated/prisma/enums").wallets_status;
        balance: import("@prisma/client-runtime-utils").Decimal;
    }>;
    listMyTransactions(organizationId: string, query: ListTransactionsDto): Promise<{
        page: number;
        pageSize: number;
        total: number;
        items: {
            id: string;
            created_at: Date;
            wallet_id: string;
            amount: import("@prisma/client-runtime-utils").Decimal;
            type: string;
            description: string;
            provider_transaction_id: string | null;
        }[];
    }>;
}
