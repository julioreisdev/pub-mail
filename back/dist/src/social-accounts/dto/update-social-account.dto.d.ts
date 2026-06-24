export declare class UpdateSocialAccountDto {
    username?: string;
    display_name?: string;
    profile_image_url?: string;
    status?: string;
    is_default?: boolean;
    token_expires_at?: string;
    scope?: string[];
    extra?: Record<string, any>;
    access_token?: string;
    refresh_token?: string;
}
