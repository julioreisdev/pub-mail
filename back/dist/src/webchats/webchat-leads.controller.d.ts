import { WebchatLeadsService } from './webchat-leads.service';
export declare class WebchatLeadsController {
    private readonly service;
    constructor(service: WebchatLeadsService);
    list(req: any, webchatId?: string, page?: string, pageSize?: string, q?: string): Promise<{
        items: import("./webchat-leads.service").LeadRow[];
        total: number;
        page: number;
        page_size: number;
        total_pages: number;
    }>;
    exportAll(req: any, webchatId?: string, q?: string): Promise<{
        items: import("./webchat-leads.service").LeadRow[];
        total: number;
    }>;
}
