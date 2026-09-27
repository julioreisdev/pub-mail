import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KNOWN_PROVIDERS, testProvider } from '../payments/pix-providers';
import { maskToken } from '../payments/payments-settings.service';

// Gateway PIX do SUPERADMIN — recebe as ASSINATURAS do Pub Mail. Vive no
// singleton `system_settings` (infra da plataforma), separado do gateway de
// cada organização (`telegram_payment_settings`).
const cleanToken = (t: string) => String(t || '').replace(/[\u0000- \u007f]/g, '');

@Injectable()
export class PlatformBillingSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  baseUrl() {
    return (process.env.PUBLIC_API_URL || 'https://api.reveleonline.com').replace(/\/+$/, '');
  }
  webhookUrl(provider?: string | null) {
    return `${this.baseUrl()}/payments/webhook/${provider || 'mercadopago'}`;
  }

  private row() {
    return this.prisma.system_settings.findUnique({ where: { id: 1 } });
  }

  async get() {
    const s = await this.row();
    const provider = s?.billing_provider || 'mercadopago';
    return {
      provider,
      active: s?.billing_active ?? false,
      has_token: !!s?.billing_access_token,
      token_masked: maskToken(s?.billing_access_token),
      ready: Boolean(s?.billing_active && s?.billing_access_token),
      webhook_url: this.webhookUrl(provider),
      providers: KNOWN_PROVIDERS,
    };
  }

  // Update PARCIAL; token mascarado (••) é ignorado.
  async save(dto: any) {
    const data: any = {};
    if (dto.provider !== undefined) {
      const p = String(dto.provider || '').trim().toLowerCase();
      data.billing_provider = KNOWN_PROVIDERS.includes(p) ? p : 'mercadopago';
    }
    if (dto.active !== undefined) data.billing_active = Boolean(dto.active);
    if (typeof dto.access_token === 'string') {
      const t = cleanToken(dto.access_token);
      if (t && !t.includes('••')) data.billing_access_token = t;
    }
    await this.prisma.system_settings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
    return this.get();
  }

  async test() {
    const s = await this.row();
    if (!s?.billing_access_token) throw new BadRequestException('Cadastre o token do gateway antes de testar.');
    const r = await testProvider(s.billing_provider, s.billing_access_token);
    return { ...r, provider: s.billing_provider };
  }

  // Só quando pronto pra cobrar (ativo + token). Senão null.
  async require() {
    const s = await this.row();
    if (!s?.billing_active || !s.billing_access_token) return null;
    return { provider: s.billing_provider, access_token: s.billing_access_token };
  }
}
