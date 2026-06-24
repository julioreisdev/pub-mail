import { PrismaService } from '../prisma/prisma.service';
export type ListLeadsParams = {
    organizationId: string;
    webchatId?: string;
    page?: number;
    pageSize?: number;
    search?: string;
};
export type LeadRow = {
    id: string;
    webchat_id: string;
    webchat_name: string;
    webchat_slug: string;
    webchat_domain: string;
    email: string;
    name: string | null;
    phone: string | null;
    source: string | null;
    session_id: string | null;
    context: any;
    custom_fields: any;
    created_at: Date;
    updated_at: Date;
};
export declare class WebchatLeadsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private buildWhere;
    private toRow;
    list(params: ListLeadsParams): Promise<{
        items: LeadRow[];
        total: number;
        page: number;
        page_size: number;
        total_pages: number;
    }>;
    listAllForExport(params: Omit<ListLeadsParams, 'page' | 'pageSize'>): Promise<{
        items: LeadRow[];
        total: number;
    }>;
}
