export declare class CreateAvatarDto {
    name: string;
    avatar_image_url: string;
    is_realistic?: boolean;
    default_colors?: any[];
    inspiration_image_url?: string;
    user_prompt?: string;
    system_prompt?: string;
    personality?: string;
    technical_metadata?: Record<string, any>;
    status?: 'ACTIVE' | 'ARCHIVED';
}
