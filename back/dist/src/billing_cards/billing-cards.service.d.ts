import { PrismaService } from '../prisma/prisma.service';
import { CreateBillingCardDto } from './dto/create-billing-card.dto';
import { UpdateBillingCardDto } from './dto/update-billing-card.dto';
export declare class BillingCardsService {
    private prisma;
    constructor(prisma: PrismaService);
    private readonly cardPublicSelect;
    listMyCards(organizationId: string): Promise<{
        id: string;
        organization_id: string;
        last_four_digits: string | null;
        brand: string | null;
        holder_name: string;
        is_default: boolean;
    }[]>;
    createMyCard(organizationId: string, dto: CreateBillingCardDto): Promise<{
        id: string;
        organization_id: string;
        last_four_digits: string | null;
        brand: string | null;
        holder_name: string;
        is_default: boolean;
    }>;
    updateMyCard(organizationId: string, cardId: string, dto: UpdateBillingCardDto): Promise<{
        id: string;
        organization_id: string;
        last_four_digits: string | null;
        brand: string | null;
        holder_name: string;
        is_default: boolean;
    }>;
    setDefault(organizationId: string, cardId: string): Promise<{
        id: string;
        organization_id: string;
        last_four_digits: string | null;
        brand: string | null;
        holder_name: string;
        is_default: boolean;
    }>;
    removeMyCard(organizationId: string, cardId: string): Promise<{
        message: string;
    }>;
}
