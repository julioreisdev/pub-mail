import { CreateSocialAccountDto } from './dto/create-social-account.dto';
import { ListSocialAccountsDto } from './dto/list-social-accounts.dto';
import { UpsertTikTokAppCredentialsDto } from './dto/upsert-tiktok-app-credentials.dto';
import { UpdateSocialAccountDto } from './dto/update-social-account.dto';
import { SocialAccountsService } from './social-accounts.service';
export declare class SocialAccountsController {
    private readonly socialAccountsService;
    constructor(socialAccountsService: SocialAccountsService);
    getMeta(): {
        allowed_networks: ("TIKTOK" | "YOUTUBE" | "INSTAGRAM")[];
        allowed_status: ("ACTIVE" | "DISCONNECTED")[];
    };
    getOAuthUrl(req: any, network: string, returnTo?: string): Promise<{
        network: "TIKTOK";
        authorization_url: string;
        callback_url: string;
    }>;
    getTikTokAppCredentials(req: any): Promise<{
        social_network: string;
        has_custom_credentials: boolean;
        using_fallback: boolean;
        client_key: string;
        has_client_secret: boolean;
        client_secret_masked: string | null;
        updated_at: Date | null;
    }>;
    upsertTikTokAppCredentials(req: any, dto: UpsertTikTokAppCredentialsDto): Promise<{
        social_network: string;
        has_custom_credentials: boolean;
        using_fallback: boolean;
        client_key: string;
        has_client_secret: boolean;
        client_secret_masked: string | null;
        updated_at: Date | null;
    }>;
    oauthCallback(network: string, code: string | undefined, state: string | undefined, error: string | undefined, errorDescription: string | undefined, res: any): Promise<any>;
    list(req: any, query: ListSocialAccountsDto): Promise<{
        items: {
            username: string | null | undefined;
            display_name: string | null | undefined;
            id: string;
            organization_id: string;
            is_default: boolean;
            status: import("../../generated/prisma/enums").social_account_status;
            created_at: Date;
            updated_at: Date;
            social_network: import("../../generated/prisma/enums").social_network;
            provider_user_id: string;
            profile_image_url: string | null;
            token_expires_at: Date | null;
            scope: import("@prisma/client/runtime/client").JsonValue;
            extra: import("@prisma/client/runtime/client").JsonValue;
        }[];
        meta: {
            allowed_networks: ("TIKTOK" | "YOUTUBE" | "INSTAGRAM")[];
            allowed_status: ("ACTIVE" | "DISCONNECTED")[];
        };
    }>;
    create(req: any, dto: CreateSocialAccountDto): Promise<{
        id: string;
        organization_id: string;
        is_default: boolean;
        status: import("../../generated/prisma/enums").social_account_status;
        created_at: Date;
        updated_at: Date;
        social_network: import("../../generated/prisma/enums").social_network;
        provider_user_id: string;
        username: string | null;
        display_name: string | null;
        profile_image_url: string | null;
        token_expires_at: Date | null;
        scope: import("@prisma/client/runtime/client").JsonValue;
        extra: import("@prisma/client/runtime/client").JsonValue;
    }>;
    update(req: any, id: string, dto: UpdateSocialAccountDto): Promise<{
        id: string;
        organization_id: string;
        is_default: boolean;
        status: import("../../generated/prisma/enums").social_account_status;
        created_at: Date;
        updated_at: Date;
        social_network: import("../../generated/prisma/enums").social_network;
        provider_user_id: string;
        username: string | null;
        display_name: string | null;
        profile_image_url: string | null;
        token_expires_at: Date | null;
        scope: import("@prisma/client/runtime/client").JsonValue;
        extra: import("@prisma/client/runtime/client").JsonValue;
    }>;
    syncProfile(req: any, id: string): Promise<{
        profile_sync_ok: boolean;
        profile_sync_error: string | null;
        id: string;
        organization_id: string;
        is_default: boolean;
        status: import("../../generated/prisma/enums").social_account_status;
        created_at: Date;
        updated_at: Date;
        social_network: import("../../generated/prisma/enums").social_network;
        provider_user_id: string;
        username: string | null;
        display_name: string | null;
        profile_image_url: string | null;
        token_expires_at: Date | null;
        scope: import("@prisma/client/runtime/client").JsonValue;
        extra: import("@prisma/client/runtime/client").JsonValue;
    }>;
    remove(req: any, id: string): Promise<{
        message: string;
    }>;
}
