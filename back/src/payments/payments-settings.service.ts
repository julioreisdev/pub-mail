import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CRM_PROVIDERS, KNOWN_PROVIDERS, PROVIDER_LABEL, providerSupports, testProvider } from './pix-providers';
import { crmProvidersOf, publicApiUrl, resolveGateways, tokenFor, webhookUrlFor } from './gateways.util';
import { asaasDeleteWebhook, asaasRegisterWebhook, asaasWebhookToken, isAsaasSandbox } from './providers/asaas';

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
    return publicApiUrl();
  }

  webhookUrl(provider?: string | null, orgId?: string | null) {
    return webhookUrlFor(provider || 'mercadopago', orgId);
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
      crm: this.crmView(s, orgId),
    };
  }

  /**
   * Cobranças do WhatsApp: gateway por finalidade (Fase 4). O token nunca volta cru (só mascarado).
   * `effective` = quem cobra cada meio hoje (null = indisponível).
   */
  private crmView(s: any, orgId?: string) {
    const p = crmProvidersOf(s);
    const g = resolveGateways(s);
    const asaasToken = p.tokens?.asaas || null;
    return {
      pix: p.pix || null,
      boleto: p.boleto || null,
      card: p.card || null,
      effective: { pix: g.pix?.provider || null, boleto: g.boleto?.provider || null, card: g.card?.provider || null },
      options: CRM_PROVIDERS.map((id) => ({ id, label: PROVIDER_LABEL[id] || id, supports: providerSupports(id), has_token: Boolean(tokenFor(s, id)) })),
      asaas: {
        has_token: Boolean(asaasToken),
        token_masked: maskToken(asaasToken),
        sandbox: asaasToken ? isAsaasSandbox(asaasToken) : false,
        webhook_url: this.webhookUrl('asaas', orgId || s?.organization_id),
        webhook_ok: Boolean(p.asaas_webhook_ok),
        webhook_error: p.asaas_webhook_error || null,
        webhook_at: p.asaas_webhook_at || null,
      },
    };
  }

  /** E-mail de contato do webhook do Asaas (dono da org; senão o 1º usuário ativo). */
  private async contactEmail(orgId: string) {
    const u = (await this.prisma.users.findFirst({ where: { organization_id: orgId, role: 'OWNER' }, select: { email: true } })) || (await this.prisma.users.findFirst({ where: { organization_id: orgId }, select: { email: true } }));
    return u?.email || 'contato@pubmail.app';
  }

  /** Cadastra (ou refaz) o webhook do Asaas na conta da org e guarda o resultado. */
  private async registerAsaasWebhook(orgId: string, token: string, providers: any) {
    const authToken = providers.asaas_webhook_token || asaasWebhookToken();
    const r = await asaasRegisterWebhook(token, this.webhookUrl('asaas', orgId), authToken, await this.contactEmail(orgId));
    return { ...providers, asaas_webhook_token: authToken, asaas_webhook_ok: r.ok, asaas_webhook_error: r.ok ? null : String(r.error || 'falhou').slice(0, 200), asaas_webhook_at: new Date().toISOString() };
  }

  /**
   * Update PARCIAL da parte das Cobranças do WhatsApp: `{ pix, boleto, card, asaas_token, remove_asaas }`.
   * Token do Asaas novo é TESTADO antes de gravar e o webhook é cadastrado na conta dele.
   */
  private async saveCrm(orgId: string, cur: any, dto: any) {
    const p: any = { ...crmProvidersOf(cur), tokens: { ...(crmProvidersOf(cur).tokens || {}) } };
    if (dto.remove_asaas === true) {
      // com cobrança em aberto ou cartão salvo no Asaas, remover a chave deixaria PIX/boleto pagáveis lá sem o Pub Mail
      // conseguir confirmar nem cancelar, e os cartões ficariam inúteis → recusa com o motivo
      const [open, cards] = await Promise.all([
        this.prisma.whatsapp_charges.count({ where: { organization_id: orgId, status: 'PENDING', OR: [{ pix_provider: 'asaas' }, { boleto_provider: 'asaas' }, { card_provider: 'asaas' }] } }),
        this.prisma.whatsapp_payment_methods.count({ where: { organization_id: orgId, provider: 'asaas', status: 'active' } }),
      ]);
      if (open || cards) throw new BadRequestException(`Não dá para remover o Asaas agora: ${open ? `${open} cobrança(s) em aberto` : ''}${open && cards ? ' e ' : ''}${cards ? `${cards} cartão(ões) salvo(s)` : ''} nele. Cancele/quite as cobranças e remova os cartões antes.`);
      if (p.tokens.asaas) await asaasDeleteWebhook(p.tokens.asaas, this.webhookUrl('asaas', orgId)); // o webhook da org sai da conta do Asaas
      delete p.tokens.asaas; delete p.asaas_webhook_token; delete p.asaas_webhook_ok; delete p.asaas_webhook_error; delete p.asaas_webhook_at;
      for (const k of ['pix', 'boleto', 'card']) if (p[k] === 'asaas') p[k] = null;
      for (const k of ['pix', 'boleto', 'card']) if (dto[k] === 'asaas') dto[k] = null; // o front pode mandar as escolhas atuais junto
    }
    if (typeof dto.asaas_token === 'string') {
      const t = cleanToken(dto.asaas_token);
      if (t && !t.includes('••')) {
        const test = await testProvider('asaas', t);
        if (!test.ok) throw new BadRequestException(`Chave do Asaas recusada: ${test.detail || 'inválida'}`);
        const changed = p.tokens.asaas !== t;
        p.tokens.asaas = t;
        if (changed || !p.asaas_webhook_ok) Object.assign(p, await this.registerAsaasWebhook(orgId, t, p));
      }
    }
    for (const purpose of ['pix', 'boleto', 'card'] as const) {
      if (dto[purpose] === undefined) continue;
      const v = dto[purpose] ? String(dto[purpose]).trim().toLowerCase() : null;
      if (v === null || v === '') { p[purpose] = null; continue; }
      if (!CRM_PROVIDERS.includes(v)) throw new BadRequestException(`Gateway inválido para ${purpose}.`);
      if (!providerSupports(v)[purpose]) throw new BadRequestException(`${PROVIDER_LABEL[v] || v} não faz ${purpose === 'card' ? 'cartão' : purpose === 'boleto' ? 'boleto' : 'PIX'}.`);
      if (!tokenFor({ ...cur, providers: p }, v)) throw new BadRequestException(`Cadastre a chave do ${PROVIDER_LABEL[v] || v} antes de usá-lo.`);
      p[purpose] = v;
    }
    return p;
  }

  // Update PARCIAL: só grava o que veio definido. Token mascarado (com ••) é ignorado.
  async save(orgId: string, dto: any) {
    const data: any = {};
    if (dto.provider !== undefined) {
      const p = String(dto.provider || '').trim().toLowerCase();
      if (!KNOWN_PROVIDERS.includes(p)) throw new BadRequestException(`Gateway principal inválido (${p || 'vazio'}). O Asaas entra só nas Cobranças do WhatsApp.`);
      data.provider = p;
    }
    if (dto.active !== undefined) data.active = Boolean(dto.active);
    if (typeof dto.access_token === 'string') {
      const t = cleanToken(dto.access_token);
      if (t && !t.includes('••')) data.access_token = t;
    }
    if (dto.crm && typeof dto.crm === 'object') {
      const cur = await this.prisma.telegram_payment_settings.findUnique({ where: { organization_id: orgId } });
      data.providers = await this.saveCrm(orgId, { ...(cur || {}), ...data }, dto.crm);
    }
    await this.prisma.telegram_payment_settings.upsert({
      where: { organization_id: orgId },
      create: { organization_id: orgId, provider: data.provider || 'mercadopago', active: data.active ?? true, access_token: data.access_token || null, ...(data.providers ? { providers: data.providers } : {}) },
      update: data,
    });
    return this.get(orgId);
  }

  /** Testa o gateway principal ou, com `provider`, um gateway por finalidade (ex.: `asaas`). */
  async test(orgId: string, provider?: string | null) {
    const s = await this.prisma.telegram_payment_settings.findUnique({ where: { organization_id: orgId } });
    const which = provider ? String(provider).toLowerCase() : s?.provider || 'mercadopago';
    if (!CRM_PROVIDERS.includes(which)) throw new BadRequestException('Gateway desconhecido.');
    const token = s ? tokenFor(s, which) : null;
    if (!token) throw new BadRequestException('Cadastre o token do gateway antes de testar.');
    const r = await testProvider(which, token);
    // Asaas: aproveita o teste para refazer o webhook se ele não estava ok
    if (which === 'asaas' && r.ok && s && !crmProvidersOf(s).asaas_webhook_ok) {
      const providers = await this.registerAsaasWebhook(orgId, token, crmProvidersOf(s));
      await this.prisma.telegram_payment_settings.update({ where: { organization_id: orgId }, data: { providers: providers as any } });
    }
    return { ...r, provider: which };
  }

  // Só devolve quando está pronto pra cobrar (ativo + token). Senão null.
  async require(orgId: string) {
    const s = await this.prisma.telegram_payment_settings.findUnique({ where: { organization_id: orgId } });
    if (!s || !s.active || !s.access_token) return null;
    return s;
  }
}
