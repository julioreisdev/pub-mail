import { PrismaService } from '../prisma/prisma.service';
import { UpdateScheduleSentDto } from './dto/update-schedule-sent.dto';
import { UpdateLeadMetricsDto } from './dto/update-lead-metrics.dto';
export declare class WebhooksService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    updateScheduleSent(sentId: string, dto: UpdateScheduleSentDto): Promise<{
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
        tokens_unit_cost: number;
        tokens_cost: number;
    }>;
    updateLeadMetrics(dto: UpdateLeadMetricsDto): Promise<{
        status: import("../../generated/prisma/enums").email_project_leads_status;
        created_at: Date;
        updated_at: Date;
        project_id: string;
        lead_id: string;
        metrics: import("@prisma/client/runtime/client").JsonValue | null;
    }>;
    registerOpenPixel(projectId: string, scheduleSentId: string, email: string): Promise<void>;
    registerCtaClick(projectId: string, scheduleSentId: string, email: string): Promise<void>;
}
