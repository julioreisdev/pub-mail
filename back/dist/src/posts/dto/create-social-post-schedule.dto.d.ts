export declare class CreateSocialPostScheduleDto {
    social_account_id: string;
    post_id: string;
    social_network: string;
    ai_content: boolean;
    scheduled_at: string;
    platform_payload?: Record<string, any>;
}
