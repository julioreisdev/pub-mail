import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { wallets_status } from 'generated/prisma/client';
export declare class TransactionsService {
    private prisma;
    constructor(prisma: PrismaService);
    createForMyWallet(organizationId: string, dto: CreateTransactionDto): Promise<{
        transaction: {
            id: string;
            created_at: Date;
            wallet_id: string;
            amount: import("@prisma/client-runtime-utils").Decimal;
            type: string;
            description: string;
            provider_transaction_id: string | null;
        };
        wallet: {
            id: string;
            status: wallets_status;
            balance: import("@prisma/client-runtime-utils").Decimal;
        } | null;
    }>;
}
