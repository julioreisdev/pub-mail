import { SocialPostSchedulesService } from './social-post-schedules.service';
export declare class SocialPostSchedulesRunner {
    private readonly socialPostSchedulesService;
    private readonly logger;
    constructor(socialPostSchedulesService: SocialPostSchedulesService);
    handleCron(): Promise<void>;
    handleTikTokStatusPollingCron(): Promise<void>;
}
