import { PrismaService } from 'src/prisma/prisma.service';
import { CreateBillingDto } from "./dto/create-billing-cards.dto";
import { UpdateBillingDto } from "./dto/update-billing-cards.dto";
export declare class BillingService {
    private prisma;
    private stripe;
    constructor(prisma: PrismaService);
    getOrCreateCustomerForOrg(organizationId: string): Promise<string>;
    createSetupIntentForOrg(organizationId: string): Promise<{
        client_secret: string | null;
    }>;
    listCards(organizationId: string): Promise<{
        id: string;
        organization_id: string;
        last_four_digits: string | null;
        brand: string | null;
        holder_name: string;
        is_default: boolean;
    }[]>;
    private unsetDefaultForOrg;
    createCard(organizationId: string, dto: CreateBillingDto): Promise<{
        id: string;
        last_four_digits: string | null;
        brand: string | null;
        holder_name: string;
        is_default: boolean;
    }>;
    setDefaultCard(organizationId: string, cardId: string): Promise<{
        id: string;
        last_four_digits: string | null;
        brand: string | null;
        holder_name: string;
        is_default: boolean;
    }>;
    updateCard(organizationId: string, cardId: string, dto: UpdateBillingDto): Promise<{
        id: string;
        last_four_digits: string | null;
        brand: string | null;
        holder_name: string;
        is_default: boolean;
    }>;
    deleteCard(organizationId: string, cardId: string): Promise<{
        ok: boolean;
    }>;
    private tokenPriceCents;
    topupTokens(organizationId: string, tokens: number): Promise<{
        ok: boolean;
        tokens: number;
        wallet_id: string;
        provider_transaction_id: string;
        new_balance: number;
    }>;
}
