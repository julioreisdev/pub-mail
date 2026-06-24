import type { Response } from 'express';
import { EmailImportService } from './import.service';
export declare class EmailImportController {
    private readonly service;
    constructor(service: EmailImportService);
    importLeads(req: any, projectId: string, file?: Express.Multer.File): Promise<{
        totalRows: number;
        processed: number;
        created: number;
        updated: number;
        linked: number;
        skippedAlreadyLinked: number;
        skippedUnsubscribed: number;
        invalidRows: number;
    }>;
    exportAllLeads(req: any, res: Response): Promise<void>;
    exportProjectLeads(req: any, projectId: string, res: Response): Promise<void>;
    shareLeads(req: any, fromProjectId: string, toProjectId: string): Promise<{
        shared: number;
        message: string;
    }>;
}
