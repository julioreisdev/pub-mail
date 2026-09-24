import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSystemSettingsDto } from './dto/update-system-settings.dto';

// system_settings (id=1) guarda SÓ infraestrutura da plataforma (edge IP / certbot).
// Chaves de IA e Resend vivem em organization_settings — uma linha por organização
// (isolamento multi-tenant: nenhuma org enxerga ou usa chave de outra).
const SINGLETON_ID = 1;

// provedor de IA -> coluna de chaves
const AI_COLUMNS: Record<string, string> = {
  groq: 'groq_api_keys',
  cerebras: 'cerebras_api_keys',
  gemini: 'gemini_api_keys',
  mistral: 'mistral_api_keys',
  openrouter: 'openrouter_api_keys',
  sambanova: 'sambanova_api_keys',
};

// Visão consolidada devolvida ao front: chaves da org + infra da plataforma.
export type SystemSettingsRow = {
  organization_id: string;
  groq_api_keys: string | null;
  cerebras_api_keys: string | null;
  gemini_api_keys: string | null;
  mistral_api_keys: string | null;
  openrouter_api_keys: string | null;
  sambanova_api_keys: string | null;
  resend_api_key: string | null;
  resend_webhook_secret: string | null;
  webchat_edge_ip: string | null;
  certbot_email: string | null;
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

@Injectable()
export class SystemSettingsService {
  private readonly logger = new Logger(SystemSettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- infra (plataforma)
  private async platform() {
    const existing = await this.prisma.system_settings.findUnique({ where: { id: SINGLETON_ID } });
    if (existing) return existing;
    return this.prisma.system_settings.create({ data: { id: SINGLETON_ID } });
  }

  // ---------------------------------------------------------------- por organização
  private async orgRow(organizationId: string) {
    if (!organizationId) throw new BadRequestException('Organização não identificada.');
    const existing = await this.prisma.organization_settings.findUnique({
      where: { organization_id: organizationId },
    });
    if (existing) return existing;
    return this.prisma.organization_settings.create({ data: { organization_id: organizationId } });
  }

  async get(organizationId: string): Promise<SystemSettingsRow> {
    const [org, infra] = await Promise.all([this.orgRow(organizationId), this.platform()]);
    return {
      organization_id: organizationId,
      groq_api_keys: org.groq_api_keys,
      cerebras_api_keys: org.cerebras_api_keys,
      gemini_api_keys: org.gemini_api_keys,
      mistral_api_keys: org.mistral_api_keys,
      openrouter_api_keys: org.openrouter_api_keys,
      sambanova_api_keys: org.sambanova_api_keys,
      resend_api_key: org.resend_api_key,
      resend_webhook_secret: org.resend_webhook_secret,
      webchat_edge_ip: infra.webchat_edge_ip,
      certbot_email: infra.certbot_email,
      updated_at: org.updated_at > infra.updated_at ? org.updated_at : infra.updated_at,
    };
  }

  // canEditInfra = SUPER_ADMIN: só ele mexe em edge IP / certbot (são da plataforma).
  async update(
    organizationId: string,
    dto: UpdateSystemSettingsDto,
    canEditInfra = false,
  ): Promise<SystemSettingsRow> {
    const setIfDefined = (value: string | undefined) =>
      value !== undefined ? this.normalizeNullableString(value) : undefined;

    const orgData = {
      groq_api_keys: setIfDefined(dto.groq_api_keys),
      cerebras_api_keys: setIfDefined(dto.cerebras_api_keys),
      gemini_api_keys: setIfDefined(dto.gemini_api_keys),
      mistral_api_keys: setIfDefined(dto.mistral_api_keys),
      openrouter_api_keys: setIfDefined(dto.openrouter_api_keys),
      sambanova_api_keys: setIfDefined(dto.sambanova_api_keys),
      resend_api_key: setIfDefined(dto.resend_api_key),
      resend_webhook_secret: setIfDefined(dto.resend_webhook_secret),
    };
    await this.prisma.organization_settings.upsert({
      where: { organization_id: organizationId },
      create: { organization_id: organizationId, ...orgData },
      update: orgData,
    });

    if (canEditInfra) {
      const infra = {
        webchat_edge_ip: setIfDefined(dto.webchat_edge_ip),
        certbot_email: setIfDefined(dto.certbot_email),
      };
      await this.prisma.system_settings.upsert({
        where: { id: SINGLETON_ID },
        create: { id: SINGLETON_ID, ...infra },
        update: infra,
      });
    }

    return this.get(organizationId);
  }

  // === Groq (mantido por backward-compat: o email-template ainda usa só Groq) ===
  async getGroqApiKeysOrFail(organizationId: string): Promise<string[]> {
    const org = await this.orgRow(organizationId);
    const keys = this.parseKeys(org.groq_api_keys);
    if (keys.length === 0) {
      throw new InternalServerErrorException(
        'Nenhuma chave da Groq configurada. Defina em Configurações > Integrações.',
      );
    }
    return keys;
  }

  async getAiProviderKeysOrFail(organizationId: string): Promise<AiProviderKeysBundle> {
    const org = await this.orgRow(organizationId);
    const bundle = this.bundleOf(org);
    const totalKeys = Object.values(bundle).reduce((sum, arr) => sum + arr.length, 0);
    if (totalKeys === 0) {
      throw new InternalServerErrorException(
        'Nenhuma chave de IA configurada. Defina pelo menos um provedor em Configurações > Integrações.',
      );
    }
    return bundle;
  }

  async getResendApiKeyOrFail(organizationId: string): Promise<string> {
    const org = await this.orgRow(organizationId);
    const value = String(org.resend_api_key || '').trim();
    if (!value) {
      throw new InternalServerErrorException(
        'Chave do Resend não configurada. Defina em Configurações > Integrações.',
      );
    }
    return value;
  }

  async getResendWebhookSecret(organizationId: string): Promise<string | null> {
    const org = await this.orgRow(organizationId);
    const value = String(org.resend_webhook_secret || '').trim();
    return value || null;
  }

  // Infra da plataforma (não é por org).
  async getWebchatEdgeIpOrFail(): Promise<string> {
    const infra = await this.platform();
    const value = String(infra.webchat_edge_ip || '').trim();
    if (!value) {
      throw new InternalServerErrorException(
        'IP do edge para webchat não configurado (plataforma).',
      );
    }
    return value;
  }

  async getCertbotEmailOrFail(): Promise<string> {
    const infra = await this.platform();
    const value = String(infra.certbot_email || '').trim();
    if (!value) {
      throw new InternalServerErrorException('E-mail do Certbot não configurado (plataforma).');
    }
    return value;
  }

  // === Status runtime das chaves (proxy para o ai-micro-services), só as chaves da org ===
  async getAiKeysStatus(organizationId: string): Promise<Record<string, any>> {
    const org = await this.orgRow(organizationId);
    const providerKeys = this.bundleOf(org);

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
        headers: { 'Content-Type': 'application/json', 'x-api-key': serviceKey },
        body: JSON.stringify({ provider_keys: providerKeys }),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`ai-micro retornou ${response.status}: ${String(detail).slice(0, 300)}`);
      }
      const json = (await response.json()) as { success?: boolean; data?: any; message?: string };
      if (!json.success) throw new Error(json.message || 'Falha ao consultar status das chaves.');
      return json.data ?? {};
    } catch (err: any) {
      this.logger.error(`Falha ao consultar status das chaves de IA: ${err?.message || err}`);
      throw new InternalServerErrorException(
        'Falha ao consultar status das chaves de IA. Verifique se o serviço de IA está no ar.',
      );
    }
  }

  private bundleOf(org: any): AiProviderKeysBundle {
    return {
      groq: this.parseKeys(org.groq_api_keys),
      cerebras: this.parseKeys(org.cerebras_api_keys),
      gemini: this.parseKeys(org.gemini_api_keys),
      mistral: this.parseKeys(org.mistral_api_keys),
      openrouter: this.parseKeys(org.openrouter_api_keys),
      sambanova: this.parseKeys(org.sambanova_api_keys),
    };
  }

  parseGroqKeys(raw: string | null | undefined): string[] {
    return this.parseKeys(raw);
  }

  parseKeys(raw: string | null | undefined): string[] {
    return String(raw || '')
      .split(/[,\n]/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
  }

  maskKey(k: string): string {
    const s = String(k || '');
    if (s.length <= 8) return `${s.slice(0, 2)}••••`;
    return `${s.slice(0, 4)}••••${s.slice(-4)}`;
  }

  maskedKeys(raw: string | null | undefined): string[] {
    return this.parseKeys(raw).map((k) => this.maskKey(k));
  }

  async addAiKeys(organizationId: string, provider: string, keysCsv: string): Promise<SystemSettingsRow> {
    const col = AI_COLUMNS[provider];
    if (!col) throw new BadRequestException('Provedor inválido.');
    const incoming = this.parseKeys(keysCsv);
    if (incoming.length === 0) throw new BadRequestException('Informe ao menos uma chave.');
    const org = await this.orgRow(organizationId);
    const set = new Set(this.parseKeys((org as any)[col]));
    for (const k of incoming) set.add(k);
    await this.prisma.organization_settings.update({
      where: { organization_id: organizationId },
      data: { [col]: [...set].join(',') || null },
    });
    return this.get(organizationId);
  }

  async removeAiKey(organizationId: string, provider: string, index: number): Promise<SystemSettingsRow> {
    const col = AI_COLUMNS[provider];
    if (!col) throw new BadRequestException('Provedor inválido.');
    const org = await this.orgRow(organizationId);
    const list = this.parseKeys((org as any)[col]);
    if (!Number.isInteger(index) || index < 0 || index >= list.length) {
      throw new BadRequestException('Índice inválido.');
    }
    list.splice(index, 1);
    await this.prisma.organization_settings.update({
      where: { organization_id: organizationId },
      data: { [col]: list.join(',') || null },
    });
    return this.get(organizationId);
  }

  private normalizeNullableString(value: string | undefined | null): string | null {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    return trimmed.length === 0 ? null : trimmed;
  }
}
