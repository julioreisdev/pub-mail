"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SystemSettingsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemSettingsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const SINGLETON_ID = 1;
let SystemSettingsService = SystemSettingsService_1 = class SystemSettingsService {
    prisma;
    logger = new common_1.Logger(SystemSettingsService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async get() {
        const existing = await this.prisma.system_settings.findUnique({
            where: { id: SINGLETON_ID },
        });
        if (existing)
            return existing;
        return (await this.prisma.system_settings.create({
            data: { id: SINGLETON_ID },
        }));
    }
    async update(dto) {
        const setIfDefined = (value) => value !== undefined ? this.normalizeNullableString(value) : undefined;
        const data = {
            groq_api_keys: setIfDefined(dto.groq_api_keys),
            cerebras_api_keys: setIfDefined(dto.cerebras_api_keys),
            gemini_api_keys: setIfDefined(dto.gemini_api_keys),
            mistral_api_keys: setIfDefined(dto.mistral_api_keys),
            openrouter_api_keys: setIfDefined(dto.openrouter_api_keys),
            sambanova_api_keys: setIfDefined(dto.sambanova_api_keys),
            resend_api_key: setIfDefined(dto.resend_api_key),
            webchat_edge_ip: setIfDefined(dto.webchat_edge_ip),
            certbot_email: setIfDefined(dto.certbot_email),
        };
        const updated = await this.prisma.system_settings.upsert({
            where: { id: SINGLETON_ID },
            create: { id: SINGLETON_ID, ...data },
            update: data,
        });
        return updated;
    }
    async getGroqApiKeysOrFail() {
        const settings = await this.get();
        const keys = this.parseKeys(settings.groq_api_keys);
        if (keys.length === 0) {
            throw new common_1.InternalServerErrorException('Nenhuma chave da Groq configurada. Defina em Conta & Domínios > Integrações.');
        }
        return keys;
    }
    async getAiProviderKeysOrFail() {
        const settings = await this.get();
        const bundle = {
            groq: this.parseKeys(settings.groq_api_keys),
            cerebras: this.parseKeys(settings.cerebras_api_keys),
            gemini: this.parseKeys(settings.gemini_api_keys),
            mistral: this.parseKeys(settings.mistral_api_keys),
            openrouter: this.parseKeys(settings.openrouter_api_keys),
            sambanova: this.parseKeys(settings.sambanova_api_keys),
        };
        const totalKeys = Object.values(bundle).reduce((sum, arr) => sum + arr.length, 0);
        if (totalKeys === 0) {
            throw new common_1.InternalServerErrorException('Nenhuma chave de IA configurada. Defina pelo menos um provedor em Conta & Domínios > Integrações.');
        }
        return bundle;
    }
    async getResendApiKeyOrFail() {
        const settings = await this.get();
        const value = String(settings.resend_api_key || '').trim();
        if (!value) {
            throw new common_1.InternalServerErrorException('Chave do Resend não configurada. Defina em Conta & Domínios > Integrações.');
        }
        return value;
    }
    async getWebchatEdgeIpOrFail() {
        const settings = await this.get();
        const value = String(settings.webchat_edge_ip || '').trim();
        if (!value) {
            throw new common_1.InternalServerErrorException('IP do edge para webchat não configurado. Defina em Conta & Domínios > Integrações.');
        }
        return value;
    }
    async getCertbotEmailOrFail() {
        const settings = await this.get();
        const value = String(settings.certbot_email || '').trim();
        if (!value) {
            throw new common_1.InternalServerErrorException('E-mail do Certbot não configurado. Defina em Conta & Domínios > Integrações.');
        }
        return value;
    }
    async getAiKeysStatus() {
        const settings = await this.get();
        const providerKeys = {
            groq: this.parseKeys(settings.groq_api_keys),
            cerebras: this.parseKeys(settings.cerebras_api_keys),
            gemini: this.parseKeys(settings.gemini_api_keys),
            mistral: this.parseKeys(settings.mistral_api_keys),
            openrouter: this.parseKeys(settings.openrouter_api_keys),
            sambanova: this.parseKeys(settings.sambanova_api_keys),
        };
        const serviceUrl = process.env.IA_SERVICE_URL;
        const serviceKey = process.env.IA_SERVICE_KEY;
        if (!serviceUrl || !serviceKey) {
            throw new common_1.InternalServerErrorException('Integração de IA não configurada (IA_SERVICE_URL/IA_SERVICE_KEY).');
        }
        try {
            const response = await fetch(`${serviceUrl}/api/ia-keys-status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': serviceKey,
                },
                body: JSON.stringify({ provider_keys: providerKeys }),
            });
            if (!response.ok) {
                const detail = await response.text().catch(() => '');
                throw new Error(`ai-micro retornou ${response.status}: ${String(detail).slice(0, 300)}`);
            }
            const json = (await response.json());
            if (!json.success) {
                throw new Error(json.message || 'Falha ao consultar status das chaves.');
            }
            return json.data ?? {};
        }
        catch (err) {
            this.logger.error(`Falha ao consultar status das chaves de IA: ${err?.message || err}`);
            throw new common_1.InternalServerErrorException('Falha ao consultar status das chaves de IA. Verifique se o serviço de IA está no ar.');
        }
    }
    parseGroqKeys(raw) {
        return this.parseKeys(raw);
    }
    parseKeys(raw) {
        return String(raw || '')
            .split(/[,\n]/)
            .map((k) => k.trim())
            .filter((k) => k.length > 0);
    }
    normalizeNullableString(value) {
        if (value === undefined || value === null)
            return null;
        const trimmed = String(value).trim();
        return trimmed.length === 0 ? null : trimmed;
    }
};
exports.SystemSettingsService = SystemSettingsService;
exports.SystemSettingsService = SystemSettingsService = SystemSettingsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SystemSettingsService);
//# sourceMappingURL=system-settings.service.js.map