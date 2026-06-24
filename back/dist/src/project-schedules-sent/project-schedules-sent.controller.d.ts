import { ProjectSchedulesSentService } from './project-schedules-sent.service';
import { Request } from 'express';
interface AuthRequest extends Request {
    user: {
        id: string;
        organizationId: string;
    };
}
export declare class ProjectSchedulesSentController {
    private readonly service;
    constructor(service: ProjectSchedulesSentService);
    list(req: AuthRequest, projectId: string, scheduleId?: string, sent?: string, from?: string, to?: string, take?: string, skip?: string): Promise<{
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
    getOne(req: AuthRequest, projectId: string, sentId: string): Promise<{
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
    removeOne(req: AuthRequest, projectId: string, sentId: string): Promise<{
        message: string;
    }>;
    purge(req: AuthRequest, projectId: string, from?: string, to?: string): Promise<{
        message: string;
        deleted: number;
    }>;
}
export {};
