// Gateway por FINALIDADE (Fase 4) — só as Cobranças do WhatsApp usam; Telegram, Webchat e o PIX do Fluxo do
// Bot continuam no gateway principal (`provider` + `access_token` de `telegram_payment_settings`).
// Puro (sem Nest/Prisma): recebe a linha de `telegram_payment_settings` e devolve quem cobra cada meio.
//
// `providers` (JSON) = { pix, boleto, card, tokens: { asaas?, mercadopago?, pushinpay? }, asaas_webhook_token?,
//   asaas_webhook_ok?, asaas_webhook_error?, asaas_webhook_at? }. Sem `providers.<meio>` = o principal faz.
import { cancelCharge, providerSupports } from './pix-providers';

export type Gateway = { provider: string; token: string };

/** URL pública da API (uma só para webhooks dos gateways, pixel, links). */
export const publicApiUrl = () => String(process.env.PUBLIC_API_URL || 'https://api.reveleonline.com').replace(/\/+$/, '');
/** URL do webhook de um provedor; o Asaas leva a org na query (uma conta do Asaas pode servir várias orgs do Pub Mail). */
export const webhookUrlFor = (provider: string, orgId?: string | null) => `${publicApiUrl()}/payments/webhook/${provider || 'mercadopago'}${provider === 'asaas' && orgId ? `?o=${orgId}` : ''}`;
export type Purpose = 'pix' | 'boleto' | 'card';
export type CrmProviders = {
  pix?: string | null;
  boleto?: string | null;
  card?: string | null;
  tokens?: Record<string, string>;
  asaas_webhook_token?: string | null;
  asaas_webhook_ok?: boolean;
  asaas_webhook_error?: string | null;
  asaas_webhook_at?: string | null;
};

export const crmProvidersOf = (row: any): CrmProviders => (row?.providers && typeof row.providers === 'object' ? (row.providers as CrmProviders) : {});

/** Token de um provedor: o próprio em `providers.tokens` ou, se for o principal, o `access_token`. */
export function tokenFor(row: any, provider: string): string | null {
  const p = crmProvidersOf(row);
  const own = p.tokens?.[provider];
  if (own) return String(own);
  if (row?.provider === provider && row?.access_token) return String(row.access_token);
  return null;
}

/** Quem cobra cada meio. `null` = meio indisponível (sem gateway ou sem token). Tudo exige `active`. */
export function resolveGateways(row: any): { principal: Gateway | null; pix: Gateway | null; boleto: Gateway | null; card: Gateway | null } {
  if (!row || !row.active) return { principal: null, pix: null, boleto: null, card: null };
  const principal = row.access_token && row.provider ? { provider: String(row.provider), token: String(row.access_token) } : null;
  const p = crmProvidersOf(row);
  const pick = (purpose: Purpose): Gateway | null => {
    const chosen = p[purpose] ? String(p[purpose]) : null;
    if (chosen) {
      const token = tokenFor(row, chosen);
      return token && providerSupports(chosen)[purpose] ? { provider: chosen, token } : null;
    }
    if (purpose === 'card') return null; // cartão só quando escolhido (Asaas)
    return principal && providerSupports(principal.provider)[purpose] ? principal : null;
  };
  return { principal, pix: pick('pix'), boleto: pick('boleto'), card: pick('card') };
}

/** Gateway de um provedor qualquer (para consultar/cancelar uma cobrança já criada por ele). */
export function gatewayFor(row: any, provider: string | null | undefined): Gateway | null {
  if (!row || !provider) return null;
  const token = tokenFor(row, provider);
  return token ? { provider, token } : null;
}

/**
 * Cancela no gateway os meios de uma cobrança (PIX, boleto, cartão), cada um no provedor que o criou
 * (`<meio>_provider`; cobrança antiga = `provider` da cobrança ou o principal). `except` = o meio que pagou.
 * Best-effort: nunca lança.
 */
export async function cancelChargeRemote(row: any, c: any, except?: 'pix' | 'boleto' | 'card' | 'manual' | null) {
  const means: Array<['pix' | 'boleto' | 'card', string | null, string | null]> = [
    ['pix', c?.pix_charge_id || null, c?.pix_provider || c?.provider || row?.provider || null],
    ['boleto', c?.boleto_charge_id || null, c?.boleto_provider || c?.provider || row?.provider || null],
    ['card', c?.card_charge_id || null, c?.card_provider || null],
  ];
  for (const [via, id, provider] of means) {
    if (!id || via === except) continue;
    const g = gatewayFor(row, provider);
    if (g) await cancelCharge(g.provider, g.token, id).catch(() => undefined);
  }
}
