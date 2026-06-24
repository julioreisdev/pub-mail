import { CreateSocialPostScheduleDto } from './dto/create-social-post-schedule.dto';
import { ListSocialPostSchedulesDto } from './dto/list-social-post-schedules.dto';
import { ListSocialPostScheduleRunsDto } from './dto/list-social-post-schedule-runs.dto';
import { SocialPostSchedulesService } from './social-post-schedules.service';
export declare class SocialPostSchedulesController {
    private readonly socialPostSchedulesService;
    constructor(socialPostSchedulesService: SocialPostSchedulesService);
    getMeta(): {
        timezone: string;
        tokens_cost_per_dispatch: number;
        allowed_networks: ("TIKTOK" | "YOUTUBE" | "INSTAGRAM")[];
        allowed_schedule_status: ("FAILED" | "PROCESSING" | "SCHEDULED" | "SENT" | "CANCELED")[];
        allowed_run_status: ("FAILED" | "PROCESSING" | "COMPLETED" | "CANCELED")[];
        full_hour_only: boolean;
        tiktok_daily_post_limit: number;
        tiktok_daily_reset_timezone: string;
    };
    getDailyLimits(req: any, socialNetwork?: string): Promise<{
        social_network: string;
        daily_limit: null;
        reset_timezone: string;
        items: never[];
        window_start_utc?: undefined;
        window_end_utc?: undefined;
        next_reset_at_utc?: undefined;
    } | {
        social_network: string;
        daily_limit: number;
        reset_timezone: string;
        window_start_utc: string;
        window_end_utc: string;
        next_reset_at_utc: string;
        items: {
            social_account_id: string;
            social_network: import("../../generated/prisma/enums").social_network;
            status: import("../../generated/prisma/enums").social_account_status;
            is_default: boolean;
            display_name: string | null;
            username: string | null;
            used: number;
            remaining: number;
            is_limited: boolean;
        }[];
    }>;
    getTikTokCreatorInfo(req: any, socialAccountId: string): Promise<{
        privacy_level_options: any;
        comment_disabled: boolean;
        duet_disabled: boolean;
        stitch_disabled: boolean;
        max_video_post_duration_sec: number | null;
        social_account_id: string;
        social_network: string;
    }>;
    create(req: any, dto: CreateSocialPostScheduleDto): Promise<{
        id: string;
        organization_id: string;
        status: import("../../generated/prisma/enums").social_schedule_status;
        created_at: Date;
        updated_at: Date;
        error_message: string | null;
        tokens_unit_cost: number;
        tokens_cost: number;
        post_id: string;
        social_account_id: string | null;
        social_network: import("../../generated/prisma/enums").social_network;
        ai_content: boolean;
        scheduled_at: Date;
        platform_payload: import("@prisma/client/runtime/client").JsonValue;
        post_snapshot: import("@prisma/client/runtime/client").JsonValue;
        social_account: {
            id: string;
            status: import("../../generated/prisma/enums").social_account_status;
            social_network: import("../../generated/prisma/enums").social_network;
            provider_user_id: string;
            username: string | null;
            display_name: string | null;
            profile_image_url: string | null;
        } | null;
    }>;
    replace(req: any, id: string, dto: CreateSocialPostScheduleDto): Promise<{
        message: string;
        replaced_schedule_id: string;
        schedule: {
            id: string;
            organization_id: string;
            status: import("../../generated/prisma/enums").social_schedule_status;
            created_at: Date;
            updated_at: Date;
            error_message: string | null;
            tokens_unit_cost: number;
            tokens_cost: number;
            post_id: string;
            social_account_id: string | null;
            social_network: import("../../generated/prisma/enums").social_network;
            ai_content: boolean;
            scheduled_at: Date;
            platform_payload: import("@prisma/client/runtime/client").JsonValue;
            post_snapshot: import("@prisma/client/runtime/client").JsonValue;
            social_account: {
                id: string;
                status: import("../../generated/prisma/enums").social_account_status;
                social_network: import("../../generated/prisma/enums").social_network;
                provider_user_id: string;
                username: string | null;
                display_name: string | null;
                profile_image_url: string | null;
            } | null;
        };
    }>;
    remove(req: any, id: string): Promise<{
        message: string;
    }>;
    dispatchNow(req: any, id: string): Promise<{
        message: string;
        run?: undefined;
    } | {
        message: string;
        run: {
            id: string;
            organization_id: string;
            status: import("../../generated/prisma/enums").social_schedule_run_status;
            created_at: Date;
            schedule_id: string | null;
            run_at: Date;
            error_message: string | null;
            tokens_unit_cost: number;
            tokens_cost: number;
            post_id: string;
            social_account_id: string | null;
            social_network: import("../../generated/prisma/enums").social_network;
            ai_content: boolean;
            platform_payload: import("@prisma/client/runtime/client").JsonValue;
            post_snapshot: import("@prisma/client/runtime/client").JsonValue;
            sent_at: Date | null;
            external_post_id: string | null;
            social_account: {
                id: string;
                status: import("../../generated/prisma/enums").social_account_status;
                social_network: import("../../generated/prisma/enums").social_network;
                provider_user_id: string;
                username: string | null;
                display_name: string | null;
                profile_image_url: string | null;
            } | null;
        };
    }>;
    list(req: any, query: ListSocialPostSchedulesDto): Promise<{
        items: {
            id: string;
            organization_id: string;
            status: import("../../generated/prisma/enums").social_schedule_status;
            created_at: Date;
            updated_at: Date;
            error_message: string | null;
            tokens_unit_cost: number;
            tokens_cost: number;
            post_id: string;
            social_account_id: string | null;
            social_network: import("../../generated/prisma/enums").social_network;
            ai_content: boolean;
            scheduled_at: Date;
            platform_payload: import("@prisma/client/runtime/client").JsonValue;
            post_snapshot: import("@prisma/client/runtime/client").JsonValue;
            social_account: {
                id: string;
                status: import("../../generated/prisma/enums").social_account_status;
                social_network: import("../../generated/prisma/enums").social_network;
                provider_user_id: string;
                username: string | null;
                display_name: string | null;
                profile_image_url: string | null;
            } | null;
        }[];
        meta: {
            timezone: string;
            tokens_cost_per_dispatch: number;
            allowed_networks: ("TIKTOK" | "YOUTUBE" | "INSTAGRAM")[];
            allowed_schedule_status: ("FAILED" | "PROCESSING" | "SCHEDULED" | "SENT" | "CANCELED")[];
            allowed_run_status: ("FAILED" | "PROCESSING" | "COMPLETED" | "CANCELED")[];
            full_hour_only: boolean;
            tiktok_daily_post_limit: number;
            tiktok_daily_reset_timezone: string;
        };
    }>;
    listHistory(req: any, query: ListSocialPostScheduleRunsDto): Promise<{
        items: {
            id: string;
            organization_id: string;
            status: import("../../generated/prisma/enums").social_schedule_run_status;
            created_at: Date;
            schedule_id: string | null;
            run_at: Date;
            error_message: string | null;
            tokens_unit_cost: number;
            tokens_cost: number;
            post_id: string;
            social_account_id: string | null;
            social_network: import("../../generated/prisma/enums").social_network;
            ai_content: boolean;
            platform_payload: import("@prisma/client/runtime/client").JsonValue;
            post_snapshot: import("@prisma/client/runtime/client").JsonValue;
            sent_at: Date | null;
            external_post_id: string | null;
            social_account: {
                id: string;
                status: import("../../generated/prisma/enums").social_account_status;
                social_network: import("../../generated/prisma/enums").social_network;
                provider_user_id: string;
                username: string | null;
                display_name: string | null;
                profile_image_url: string | null;
            } | null;
        }[];
        meta: {
            timezone: string;
            tokens_cost_per_dispatch: number;
            allowed_networks: ("TIKTOK" | "YOUTUBE" | "INSTAGRAM")[];
            allowed_schedule_status: ("FAILED" | "PROCESSING" | "SCHEDULED" | "SENT" | "CANCELED")[];
            allowed_run_status: ("FAILED" | "PROCESSING" | "COMPLETED" | "CANCELED")[];
            full_hour_only: boolean;
            tiktok_daily_post_limit: number;
            tiktok_daily_reset_timezone: string;
        };
    }>;
}
