import { WalletsService } from './wallets.service';
import { ListTransactionsDto } from './dto/list-transactions.dto';
export declare class WalletsController {
    private readonly walletsService;
    constructor(walletsService: WalletsService);
    me(req: any): Promise<{
        id: string;
        organization_id: string;
        status: import("../../generated/prisma/enums").wallets_status;
        balance: import("@prisma/client-runtime-utils").Decimal;
    }>;
    transactions(req: any, query: ListTransactionsDto): Promise<{
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
