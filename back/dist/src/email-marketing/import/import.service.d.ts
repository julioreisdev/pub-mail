import { PrismaService } from '../../prisma/prisma.service';
export declare class EmailImportService {
    private prisma;
    constructor(prisma: PrismaService);
    importLeads(organizationId: string, projectId: string, file: Express.Multer.File): Promise<{
        totalRows: number;
        processed: number;
        created: number;
        updated: number;
        linked: number;
        skippedAlreadyLinked: number;
        skippedUnsubscribed: number;
        invalidRows: number;
    }>;
    exportAllLeads(organizationId: string): Promise<Buffer>;
    exportProjectLeads(organizationId: string, projectId: string): Promise<Buffer>;
    shareLeads(organizationId: string, fromProjectId: string, toProjectId: string): Promise<{
        shared: number;
        message: string;
    }>;
    private normalizeRow;
    private mergeJson;
    private parseFile;
    private formatLeadForExport;
    private generateXlsxBuffer;
}
