// Helpers puros do CRM usados por vários serviços (sem Nest, sem banco) — evita import circular
// entre crm ↔ assinaturas ↔ cobranças. `whatsapp-crm.service.ts` reexporta por compatibilidade.

export const formatBRL = (cents: number) => (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Substitui `{{chave}}` (inclusive `{{cliente.x}}`) — chaves desconhecidas viram vazio só se estiverem no mapa; o resto fica. */
export function fillCrmVars(text: string, vars: Record<string, string>) {
  return String(text || '').replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (m, k: string) => {
    const key = String(k).toLowerCase();
    return key in vars ? vars[key] : m;
  });
}

export const firstName = (name?: string | null) => String(name || '').trim().split(/\s+/)[0] || '';
