import type { Response } from 'express';
import { WebhooksService } from './webhooks.service';
import { UpdateScheduleSentDto } from './dto/update-schedule-sent.dto';
import { UpdateLeadMetricsDto } from './dto/update-lead-metrics.dto';
export declare class WebhooksController {
    private readonly webhooksService;
    private readonly logger;
    constructor(webhooksService: WebhooksService);
    trackOpenPixel(projectId: string, scheduleSentId: string, email: string, res: Response): Promise<void>;
    trackCtaClick(projectId: string, scheduleSentId: string, email: string, redirectUrl: string, res: Response): Promise<void>;
    updateScheduleSent(sentId: string, dto: UpdateScheduleSentDto): Promise<{
        success: boolean;
        message: string;
    }>;
    updateLeadMetrics(dto: UpdateLeadMetricsDto): Promise<{
        success: boolean;
        message: string;
    }>;
}
