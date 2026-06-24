import { BillingCardsService } from './billing-cards.service';
import { CreateBillingCardDto } from './dto/create-billing-card.dto';
import { UpdateBillingCardDto } from './dto/update-billing-card.dto';
export declare class BillingCardsController {
    private readonly service;
    constructor(service: BillingCardsService);
    list(req: any): Promise<{
        id: string;
        organization_id: string;
        last_four_digits: string | null;
        brand: string | null;
        holder_name: string;
        is_default: boolean;
    }[]>;
    create(req: any, dto: CreateBillingCardDto): Promise<{
        id: string;
        organization_id: string;
        last_four_digits: string | null;
        brand: string | null;
        holder_name: string;
        is_default: boolean;
    }>;
    update(req: any, id: string, dto: UpdateBillingCardDto): Promise<{
        id: string;
        organization_id: string;
        last_four_digits: string | null;
        brand: string | null;
        holder_name: string;
        is_default: boolean;
    }>;
    setDefault(req: any, id: string): Promise<{
        id: string;
        organization_id: string;
        last_four_digits: string | null;
        brand: string | null;
        holder_name: string;
        is_default: boolean;
    }>;
    remove(req: any, id: string): Promise<{
        message: string;
    }>;
}
