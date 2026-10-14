// Fachada dos gateways de pagamento — COMPARTILHADA (Telegram, Webchat, Fluxo do Bot, Cobranças do WhatsApp,
// assinaturas da plataforma). Sem Nest/Prisma. As implementações ficam em `providers/` (Fase 4):
// `mercadopago.ts` (PIX + boleto), `pushinpay.ts` (só PIX) e `asaas.ts` (PIX, boleto e cartão; exige CPF/CNPJ
// do cliente → só nas Cobranças do WhatsApp, que têm o documento). As assinaturas exportadas aqui NÃO mudaram.
// Status normalizado: PENDING|PAID|EXPIRED|FAILED. `opts.payerRef` identifica o pagador (MP/PushinPay);
// `opts.payer` ({ref, name, doc, email, phone, customerId}) é o cliente para o Asaas.
import { BoletoPayer, BoletoResult, CancelResult, CardResult, PixResult, ProviderPayer, StatusResult, TestResult } from './providers/types';
import { cleanToken } from './providers/http';
import { mpCancel, mpCreate, mpCreateBoleto, mpStatus, mpTest } from './providers/mercadopago';
import { ppCreate, ppStatus, ppTest } from './providers/pushinpay';
import { asaasCancel, asaasCreateBoleto, asaasCreateCard, asaasCreatePix, asaasStatus, asaasTest, asaasWebhookChargeId } from './providers/asaas';
export { asaasFindByReference } from './providers/asaas';

export type { NormStatus, PixResult, StatusResult, BoletoResult, BoletoPayer, TestResult, CancelResult, CardResult, ProviderPayer } from './providers/types';

/** Gateway "principal" (Telegram, Webchat, PIX do bot): só quem cobra sem CPF do pagador. */
export const KNOWN_PROVIDERS = ['mercadopago', 'pushinpay'];
/** Gateways aceitos nas Cobranças do WhatsApp (CRM), por finalidade. */
export const CRM_PROVIDERS = ['mercadopago', 'pushinpay', 'asaas'];
export const PROVIDER_LABEL: Record<string, string> = { mercadopago: 'Mercado Pago', pushinpay: 'PushinPay', asaas: 'Asaas' };
export const providerSupports = (provider: string) => ({
  pix: ['mercadopago', 'pushinpay', 'asaas'].includes(provider),
  boleto: provider === 'mercadopago' || provider === 'asaas',
  card: provider === 'asaas',
  installments: provider === 'asaas',
  list: provider === 'asaas',
});

export function createPixCharge(provider: string, token: string, amountCents: number, description: string, opts: any = {}): Promise<PixResult & { customerId?: string; invoiceUrl?: string }> {
  const tk = cleanToken(token);
  if (provider === 'pushinpay') return ppCreate(tk, amountCents, description, opts);
  if (provider === 'asaas') return asaasCreatePix(tk, amountCents, description, opts);
  return mpCreate(tk, amountCents, description, opts);
}

/** Boleto: Mercado Pago (exige CPF, e-mail e endereço) ou Asaas (exige CPF/CNPJ). PushinPay é só PIX. */
export function createBoletoCharge(provider: string, token: string, amountCents: number, description: string, payer: BoletoPayer, opts: any = {}): Promise<BoletoResult & { customerId?: string; invoiceUrl?: string }> {
  if (provider === 'asaas') return asaasCreateBoleto(cleanToken(token), amountCents, description, opts);
  if (provider !== 'mercadopago') return Promise.resolve({ ok: false, error: 'Este gateway não emite boleto (só PIX).' });
  return mpCreateBoleto(cleanToken(token), amountCents, description, payer, opts);
}
export const providerSupportsBoleto = (provider: string) => providerSupports(provider).boleto;

/** Cartão (só Asaas): com token cobra na hora; sem token devolve a página segura do Asaas. */
export function createCardCharge(provider: string, token: string, amountCents: number, description: string, opts: { payer: ProviderPayer; dueAt?: Date | string | null; cardToken?: string | null; installments?: number | null; remoteIp?: string | null; externalReference?: string | null }): Promise<CardResult> {
  if (provider !== 'asaas') return Promise.resolve({ ok: false, error: 'Cartão só pelo Asaas. Configure o Asaas em Configurações → Pagamentos.' });
  return asaasCreateCard(cleanToken(token), amountCents, description, opts);
}

export function getChargeStatus(provider: string, token: string, chargeId: string): Promise<StatusResult> {
  const tk = cleanToken(token);
  if (provider === 'pushinpay') return ppStatus(tk, chargeId);
  if (provider === 'asaas') return asaasStatus(tk, chargeId);
  return mpStatus(tk, chargeId);
}

// Cancelamento no gateway (A-22). PushinPay não expõe cancelamento na API
// pública → no-op ok (a cobrança expira sozinha lá).
export function cancelCharge(provider: string, token: string, chargeId: string): Promise<CancelResult> {
  const tk = cleanToken(token);
  if (!tk || !chargeId) return Promise.resolve({ ok: false, error: 'token/chargeId vazio' });
  if (provider === 'pushinpay') return Promise.resolve({ ok: true });
  if (provider === 'asaas') return asaasCancel(tk, chargeId);
  return mpCancel(tk, chargeId);
}

export function testProvider(provider: string, token: string): Promise<TestResult> {
  const tk = cleanToken(token);
  if (!tk) return Promise.resolve({ ok: false, detail: 'Token vazio.' });
  if (provider === 'pushinpay') return ppTest(tk);
  if (provider === 'asaas') return asaasTest(tk);
  return mpTest(tk);
}

// Extrai o id da cobrança de um webhook (o status é reconfirmado via getChargeStatus).
export function extractWebhookChargeId(provider: string, query: any, body: any): string | null {
  if (provider === 'pushinpay') {
    return body?.id ? String(body.id) : null;
  }
  if (provider === 'asaas') return asaasWebhookChargeId(body);
  // Mercado Pago: id vem em data.id (body) ou em query (id / data.id / resource)
  const fromBody = body?.data?.id || body?.resource;
  const fromQuery = query?.['data.id'] || query?.id;
  const v = fromBody || fromQuery;
  if (!v) return null;
  const s = String(v);
  // resource pode ser uma URL terminando no id
  const m = s.match(/(\d+)\s*$/);
  return m ? m[1] : s;
}
