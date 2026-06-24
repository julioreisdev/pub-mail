import { PrismaService } from '../prisma/prisma.service';
import { UpdateSystemSettingsDto } from './dto/update-system-settings.dto';
export type SystemSettingsRow = {
    id: number;
    groq_api_keys: string | null;
    cerebras_api_keys: string | null;
    gemini_api_keys: string | null;
    mistral_api_keys: string | null;
    openrouter_api_keys: string | null;
    sambanova_api_keys: string | null;
    resend_api_key: string | null;
    webchat_edge_ip: string | null;
    certbot_email: string | null;
    created_at: Date;
    updated_at: Date;
};
export type AiProviderKeysBundle = {
    groq: string[];
    cerebras: string[];
    gemini: string[];
    mistral: string[];
    openrouter: string[];
    sambanova: string[];
};
export declare class SystemSettingsService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    get(): Promise<SystemSettingsRow>;
    update(dto: UpdateSystemSettingsDto): Promise<SystemSettingsRow>;
    getGroqApiKeysOrFail(): Promise<string[]>;
    getAiProviderKeysOrFail(): Promise<AiProviderKeysBundle>;
    getResendApiKeyOrFail(): Promise<string>;
    getWebchatEdgeIpOrFail(): Promise<string>;
    getCertbotEmailOrFail(): Promise<string>;
    getAiKeysStatus(): Promise<Record<string, any>>;
    parseGroqKeys(raw: string | null | undefined): string[];
    parseKeys(raw: string | null | undefined): string[];
    private normalizeNullableString;
}
