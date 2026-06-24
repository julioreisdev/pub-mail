import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSystemSettingsDto } from './dto/update-system-settings.dto';

const SINGLETON_ID = 1;

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

// Bundle de chaves de IA passado adiante para o ai-micro-services. As chaves
// estão sempre como array de strings (vazio = provider desabilitado).
export type AiProviderKeysBundle = {
  groq: string[];
  cerebras: string[];
  gemini: string[];
  mistral: string[];
  openrouter: string[];
  sambanova: string[];
};

@Injectable()
export class SystemSettingsService {
  private readonly logger = new Logger(SystemSettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<SystemSettingsRow> {
    const existing = await this.prisma.system_settings.findUnique({
      where: { id: SINGLETON_ID },
    });
    if (existing) return existing as SystemSettingsRow;

    return (await this.prisma.system_settings.create({
      data: { id: SINGLETON_ID },
    })) as SystemSettingsRow;
  }

  async update(dto: UpdateSystemSettingsDto): Promise<SystemSettingsRow> {
    const setIfDefined = (value: string | undefined) =>
      value !== undefined ? this.normalizeNullableString(value) : undefined;

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

    return updated as SystemSettingsRow;
  }

  // === Groq (mantido por backward-compat: o email-template ainda usa só Groq) ===
  async getGroqApiKeysOrFail(): Promise<string[]> {
    const settings = await this.get();
    const keys = this.parseKeys(settings.groq_api_keys);
    if (keys.length === 0) {
      throw new InternalServerErrorException(
        'Nenhuma chave da Groq configurada. Defina em Conta & Domínios > Integrações.',
      );
    }
    return keys;
  }

  // === Webchat usa o bundle completo de providers ===
  async getAiProviderKeysOrFail(): Promise<AiProviderKeysBundle> {
    const settings = await this.get();
    const bundle: AiProviderKeysBundle = {
      groq: this.parseKeys(settings.groq_api_keys),
      cerebras: this.parseKeys(settings.cerebras_api_keys),
      gemini: this.parseKeys(settings.gemini_api_keys),
      mistral: this.parseKeys(settings.mistral_api_keys),
      openrouter: this.parseKeys(settings.openrouter_api_keys),
      sambanova: this.parseKeys(settings.sambanova_api_keys),
    };

    const totalKeys = Object.values(bundle).reduce((sum, arr) => sum + arr.length, 0);
    if (totalKeys === 0) {
      throw new InternalServerErrorException(
        'Nenhuma chave de IA configurada. Defina pelo menos um provedor em Conta & Domínios > Integrações.',
      );
    }
    return bundle;
  }

  async getResendApiKeyOrFail(): Promise<string> {
    const settings = await this.get();
    const value = String(settings.resend_api_key || '').trim();
    if (!value) {
      throw new InternalServerErrorException(
        'Chave do Resend não configurada. Defina em Conta & Domínios > Integrações.',
      );
    }
    return value;
  }

  async getWebchatEdgeIpOrFail(): Promise<string> {
    const settings = await this.get();
    const value = String(settings.webchat_edge_ip || '').trim();
    if (!value) {
      throw new InternalServerErrorException(
        'IP do edge para webchat não configurado. Defina em Conta & Domínios > Integrações.',
      );
    }
    return value;
  }

  async getCertbotEmailOrFail(): Promise<string> {
    const settings = await this.get();
    const value = String(settings.certbot_email || '').trim();
    if (!value) {
      throw new InternalServerErrorException(
        'E-mail do Certbot não configurado. Defina em Conta & Domínios > Integrações.',
      );
    }
    return value;
  }

  // === Status runtime das chaves (proxy para o ai-micro-services) ===
  // Lê o bundle do DB e pergunta pro ai-micro o estado consolidado em Redis.
  // Não exige nenhuma chave configurada — se vazio, retorna estrutura vazia.
  async getAiKeysStatus(): Promise<Record<string, any>> {
    const settings = await this.get();
    const providerKeys: AiProviderKeysBundle = {
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
      throw new InternalServerErrorException(
        'Integração de IA não configurada (IA_SERVICE_URL/IA_SERVICE_KEY).',
      );
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
        throw new Error(
          `ai-micro retornou ${response.status}: ${String(detail).slice(0, 300)}`,
        );
      }

      const json = (await response.json()) as { success?: boolean; data?: any; message?: string };
      if (!json.success) {
        throw new Error(json.message || 'Falha ao consultar status das chaves.');
      }
      return json.data ?? {};
    } catch (err: any) {
      this.logger.error(
        `Falha ao consultar status das chaves de IA: ${err?.message || err}`,
      );
      throw new InternalServerErrorException(
        'Falha ao consultar status das chaves de IA. Verifique se o serviço de IA está no ar.',
      );
    }
  }

  // Compat — algumas partes do código antigo chamavam parseGroqKeys diretamente.
  parseGroqKeys(raw: string | null | undefined): string[] {
    return this.parseKeys(raw);
  }

  parseKeys(raw: string | null | undefined): string[] {
    return String(raw || '')
      .split(/[,\n]/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
  }

  private normalizeNullableString(value: string | undefined | null): string | null {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    return trimmed.length === 0 ? null : trimmed;
  }
}
