import { UpdateSystemSettingsDto } from './dto/update-system-settings.dto';
import { SystemSettingsService } from './system-settings.service';
type SettingsResponse = {
    groq_api_keys: string;
    groq_api_keys_count: number;
    cerebras_api_keys: string;
    cerebras_api_keys_count: number;
    gemini_api_keys: string;
    gemini_api_keys_count: number;
    mistral_api_keys: string;
    mistral_api_keys_count: number;
    openrouter_api_keys: string;
    openrouter_api_keys_count: number;
    sambanova_api_keys: string;
    sambanova_api_keys_count: number;
    resend_api_key: string;
    webchat_edge_ip: string;
    certbot_email: string;
    updated_at: Date;
};
export declare class SystemSettingsController {
    private readonly service;
    constructor(service: SystemSettingsService);
    read(): Promise<SettingsResponse>;
    update(dto: UpdateSystemSettingsDto): Promise<SettingsResponse>;
    aiKeysStatus(): Promise<Record<string, any>>;
    private toResponse;
}
export {};
