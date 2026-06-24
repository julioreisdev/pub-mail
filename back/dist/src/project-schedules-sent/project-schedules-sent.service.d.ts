import { PrismaService } from '../prisma/prisma.service';
export declare class ProjectSchedulesSentService {
    private prisma;
    constructor(prisma: PrismaService);
    private readonly sentSelect;
    private assertProjectFromOrg;
    private normalizeMinute;
    private parseDateOrThrow;
    private parseBooleanOrThrow;
    private parsePaginationOrThrow;
    list(organizationId: string, projectId: string, query?: {
        sent?: string;
        from?: string;
        to?: string;
        take?: string;
        skip?: string;
        scheduleId?: string;
    }): Promise<{
        id: string;
        organization_id: string;
        status: import("../../generated/prisma/enums").schedule_sent_status;
        created_at: Date;
        project_id: string;
        subject: string | null;
        body_html: string | null;
        body_text: string | null;
        schedule_id: string | null;
        open_count: number;
        click_cta_count: number;
        schedule_time: number | null;
        schedule_date: Date | null;
        schedule_daily: boolean;
        run_at: Date;
        sent: boolean;
        total_leads: number;
        sent_for_leads: number;
        error_message: string | null;
    }[]>;
    getOne(organizationId: string, projectId: string, sentId: string): Promise<{
        id: string;
        organization_id: string;
        status: import("../../generated/prisma/enums").schedule_sent_status;
        created_at: Date;
        project_id: string;
        subject: string | null;
        body_html: string | null;
        body_text: string | null;
        schedule_id: string | null;
        open_count: number;
        click_cta_count: number;
        schedule_time: number | null;
        schedule_date: Date | null;
        schedule_daily: boolean;
        run_at: Date;
        sent: boolean;
        total_leads: number;
        sent_for_leads: number;
        error_message: string | null;
    }>;
    removeOne(organizationId: string, projectId: string, sentId: string): Promise<{
        message: string;
    }>;
    purge(organizationId: string, projectId: string, query?: {
        from?: string;
        to?: string;
    }): Promise<{
        message: string;
        deleted: number;
    }>;
}
