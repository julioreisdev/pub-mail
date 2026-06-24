import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
export declare class TransactionsController {
    private readonly service;
    constructor(service: TransactionsService);
    create(req: any, dto: CreateTransactionDto): Promise<{
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
            status: import("../../generated/prisma/enums").wallets_status;
            balance: import("@prisma/client-runtime-utils").Decimal;
        } | null;
    }>;
}
