import { PrismaService } from '../prisma/prisma.service';
import { CreateSocialAccountDto } from './dto/create-social-account.dto';
import { ListSocialAccountsDto } from './dto/list-social-accounts.dto';
import { UpsertTikTokAppCredentialsDto } from './dto/upsert-tiktok-app-credentials.dto';
import { UpdateSocialAccountDto } from './dto/update-social-account.dto';
import { SocialAccountsCryptoService } from './social-accounts-crypto.service';
type OAuthCallbackInput = {
    network: string;
    code?: string;
    state?: string;
    error?: string;
    errorDescription?: string;
};
type TikTokClientCredentials = {
    source: 'ORGANIZATION' | 'ENV' | 'NONE';
    clientKey: string | null;
    clientSecret: string | null;
};
export declare class SocialAccountsService {
    private readonly prisma;
    private readonly crypto;
    private readonly logger;
    constructor(prisma: PrismaService, crypto: SocialAccountsCryptoService);
    private readonly selectSafeFields;
    getMeta(): {
        allowed_networks: ("TIKTOK" | "YOUTUBE" | "INSTAGRAM")[];
        allowed_status: ("ACTIVE" | "DISCONNECTED")[];
    };
    private normalizeNetworkOrThrow;
    private normalizeOrigin;
    private sanitizeReturnTo;
    private getOAuthStateSecret;
    private signOAuthState;
    private verifyOAuthState;
    private buildReturnToUrl;
    private getMaskedSecret;
    resolveTikTokClientCredentialsForOrganization(organizationId: string): Promise<TikTokClientCredentials>;
    private getTikTokOAuthConfig;
    getTikTokAppCredentialsSettings(organizationId: string): Promise<{
        social_network: string;
        has_custom_credentials: boolean;
        using_fallback: boolean;
        client_key: string;
        has_client_secret: boolean;
        client_secret_masked: string | null;
        updated_at: Date | null;
    }>;
    upsertTikTokAppCredentials(organizationId: string, dto: UpsertTikTokAppCredentialsDto): Promise<{
        social_network: string;
        has_custom_credentials: boolean;
        using_fallback: boolean;
        client_key: string;
        has_client_secret: boolean;
        client_secret_masked: string | null;
        updated_at: Date | null;
    }>;
    getOAuthAuthorizationUrl(organizationId: string, userId: string, networkRaw: string, returnToRaw?: string, requestOriginRaw?: string): Promise<{
        network: "TIKTOK";
        authorization_url: string;
        callback_url: string;
    }>;
    handleOAuthCallback(input: OAuthCallbackInput): Promise<string>;
    private extractTikTokPayload;
    private extractTikTokErrorMessage;
    private extractTikTokErrorCode;
    private extractTikTokErrorLogId;
    private buildTikTokErrorLogContext;
    private normalizeScope;
    private hasTikTokUserInfoScope;
    private buildTikTokProfileExtra;
    private exchangeTikTokRefreshToken;
    private fetchTikTokProfile;
    private completeTikTokOAuth;
    syncTikTokProfile(organizationId: string, socialAccountId: string): Promise<{
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
    list(organizationId: string, query: ListSocialAccountsDto): Promise<{
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
    create(organizationId: string, dto: CreateSocialAccountDto): Promise<{
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
    update(organizationId: string, socialAccountId: string, dto: UpdateSocialAccountDto): Promise<{
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
    remove(organizationId: string, socialAccountId: string): Promise<{
        message: string;
    }>;
}
export {};
