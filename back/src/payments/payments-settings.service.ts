import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KNOWN_PROVIDERS, testProvider } from './pix-providers';

// Gateway de pagamento da ORGANIZAÇÃO (um por org, compartilhado por Telegram e
// Webchat). A tabela continua sendo `telegram_payment_settings` (histórico) —
// este service só cuida dos campos genéricos (provider/token/active); o
// `checkout_config` (mensagens do checkout do Telegram) segue no módulo Telegram.
export const maskToken = (t?: string | null) => {
  const s = String(t || '');
  if (!s) return '';
  if (s.length <= 8) return '••••';
  return `${s.slice(0, 4)}••••${s.slice(-4)}`;
};
const cleanToken = (t: string) => String(t || '').replace(/[\u0000- \u007f]/g, '');

@Injectable()
export class PaymentsSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  baseUrl() {
    return (process.env.PUBLIC_API_URL || 'https://api.bluewebchat.online').replace(/\/+$/, '');
  }

  webhookUrl(provider?: string | null) {
    return `${this.baseUrl()}/payments/webhook/${provider || 'mercadopago'}`;
  }

  async get(orgId: string) {
    const s = await this.prisma.telegram_payment_settings.findUnique({ where: { organization_id: orgId } });
    const provider = s?.provider || 'mercadopago';
    return {
      provider,
      active: s?.active ?? false,
      has_token: !!s?.access_token,
      token_masked: maskToken(s?.access_token),
      ready: Boolean(s?.active && s?.access_token),
      webhook_url: this.webhookUrl(provider),
      providers: KNOWN_PROVIDERS,
    };
  }

  // Update PARCIAL: só grava o que veio definido. Token mascarado (com ••) é ignorado.
  async save(orgId: string, dto: any) {
    const data: any = {};
    if (dto.provider !== undefined) {
      const p = String(dto.provider || '').trim().toLowerCase();
      data.provider = KNOWN_PROVIDERS.includes(p) ? p : 'mercadopago';
    }
    if (dto.active !== undefined) data.active = Boolean(dto.active);
    if (typeof dto.access_token === 'string') {
      const t = cleanToken(dto.access_token);
      if (t && !t.includes('••')) data.access_token = t;
    }
    await this.prisma.telegram_payment_settings.upsert({
      where: { organization_id: orgId },
      create: { organization_id: orgId, provider: data.provider || 'mercadopago', active: data.active ?? true, access_token: data.access_token || null },
      update: data,
    });
    return this.get(orgId);
  }

  async test(orgId: string) {
    const s = await this.prisma.telegram_payment_settings.findUnique({ where: { organization_id: orgId } });
    if (!s?.access_token) throw new BadRequestException('Cadastre o token do gateway antes de testar.');
    const r = await testProvider(s.provider, s.access_token);
    return { ...r, provider: s.provider };
  }

  // Só devolve quando está pronto pra cobrar (ativo + token). Senão null.
  async require(orgId: string) {
    const s = await this.prisma.telegram_payment_settings.findUnique({ where: { organization_id: orgId } });
    if (!s || !s.active || !s.access_token) return null;
    return s;
  }
}
