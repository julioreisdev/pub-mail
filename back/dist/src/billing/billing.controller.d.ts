import { BillingService } from './billing.service';
import { CreateBillingDto } from "./dto/create-billing-cards.dto";
import { UpdateBillingDto } from "./dto/update-billing-cards.dto";
import { TopupDto } from "./dto/topup.dto";
export declare class BillingController {
    private readonly billingService;
    constructor(billingService: BillingService);
    setupIntent(req: any): Promise<{
        client_secret: string | null;
    }>;
    listCards(req: any): Promise<{
        id: string;
        organization_id: string;
        last_four_digits: string | null;
        brand: string | null;
        holder_name: string;
        is_default: boolean;
    }[]>;
    createCard(req: any, dto: CreateBillingDto): Promise<{
        id: string;
        last_four_digits: string | null;
        brand: string | null;
        holder_name: string;
        is_default: boolean;
    }>;
    updateCard(req: any, id: string, dto: UpdateBillingDto): Promise<{
        id: string;
        last_four_digits: string | null;
        brand: string | null;
        holder_name: string;
        is_default: boolean;
    }>;
    setDefault(req: any, id: string): Promise<{
        id: string;
        last_four_digits: string | null;
        brand: string | null;
        holder_name: string;
        is_default: boolean;
    }>;
    deleteCard(req: any, id: string): Promise<{
        ok: boolean;
    }>;
    topup(req: any, dto: TopupDto): Promise<{
        ok: boolean;
        tokens: number;
        wallet_id: string;
        provider_transaction_id: string;
        new_balance: number;
    }>;
}
