// Tipos comuns dos gateways de pagamento (sem Nest/Prisma). Status normalizado: PENDING|PAID|EXPIRED|FAILED.
export type NormStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED';

export type PixResult = {
  ok: boolean;
  chargeId?: string;
  pixCode?: string; // copia e cola
  qrBase64?: string; // imagem do QR (base64 puro, sem prefixo data:)
  error?: string;
};
export type StatusResult = { ok: boolean; status?: NormStatus; error?: string };
export type BoletoResult = {
  ok: boolean;
  chargeId?: string;
  url?: string; // link do boleto (PDF/página do MP)
  barcode?: string; // código de barras
  digitable?: string; // linha digitável (quando o gateway devolve)
  error?: string;
};
export type BoletoPayer = { name: string; email: string; doc: string; address: { zip: string; street: string; number: string; district: string; city: string; state: string } };
export type TestResult = { ok: boolean; detail?: string };
export type CancelResult = { ok: boolean; error?: string };

export type CardInfo = { token: string; brand: string | null; last4: string | null };
export type CardResult = {
  ok: boolean;
  chargeId?: string;
  status?: NormStatus;
  invoiceUrl?: string; // página segura do gateway para o cliente pagar (cartão digitado lá, nunca no Pub Mail)
  card?: CardInfo | null; // quando aprovado: token reutilizável + bandeira + final
  declined?: boolean; // recusado pelo emissor (tentar de novo depois / outro meio)
  unknown?: boolean; // rede/timeout/5xx: não se sabe se o gateway cobrou (procurar pela referência antes de repetir)
  customerId?: string;
  error?: string;
};
export type ProviderPayer = { ref: string; name: string; doc?: string | null; email?: string | null; phone?: string | null; customerId?: string | null };
export type PaymentDetails = { ok: boolean; status?: NormStatus; raw?: string; card?: CardInfo | null; paidAt?: string | null; value_cents?: number; error?: string };
export type ListedPayment = { id: string; status: NormStatus; raw: string; value_cents: number; paid_at: string | null; external_reference: string | null; billing_type: string; installment?: string | null; installment_number?: number | null };

/** O que cada gateway sabe fazer (interface da Fase 4). */
export interface PaymentProvider {
  name: string;
  supports: { pix: boolean; boleto: boolean; card: boolean; installments: boolean; list: boolean };
  test(token: string): Promise<TestResult>;
  status(token: string, chargeId: string): Promise<StatusResult>;
  cancel(token: string, chargeId: string): Promise<CancelResult>;
}
