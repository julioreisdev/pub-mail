import { createHash } from 'crypto';

// Documento (CPF/CNPJ) — funções puras, sem dependências (usadas pelo CRM, pela identidade e pelo bot).
export const digitsOnly = (v: unknown) => String(v ?? '').replace(/\D/g, '');

/** Só dígitos, no máximo 14 (CNPJ); null quando vazio. */
export const normalizeDoc = (v: unknown): string | null => digitsOnly(v).slice(0, 14) || null;

export const cpfOk = (d: string) => {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (n: number) => { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
};
export const cnpjOk = (d: string) => {
  if (!/^\d{14}$/.test(d) || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (n: number) => { const w = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * w[i]; const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
};
/** CPF (11) ou CNPJ (14) com dígito verificador válido. */
export const isValidDoc = (doc: unknown) => { const d = digitsOnly(doc); return d.length === 11 ? cpfOk(d) : d.length === 14 ? cnpjOk(d) : false; };
export const docKind = (doc: unknown): 'cpf' | 'cnpj' | null => { const d = digitsOnly(doc); return d.length === 11 ? 'cpf' : d.length === 14 ? 'cnpj' : null; };

/** Hash para buscar o documento sem decifrar a coluna: sha256("<org>:<dígitos>") — igual ao SQL da migration. */
export const docHash = (orgId: string, doc: unknown) => { const d = digitsOnly(doc); return d ? createHash('sha256').update(`${orgId}:${d}`).digest('hex') : null; };

/** "***.456.789-**" / "12.345.678/****-**" para mostrar sem expor. */
export const maskDoc = (doc: unknown) => {
  const d = digitsOnly(doc);
  if (d.length === 11) return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/****-**`;
  return d ? `${'*'.repeat(Math.max(0, d.length - 4))}${d.slice(-4)}` : '';
};
export const formatDoc = (doc: unknown) => {
  const d = digitsOnly(doc);
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return d;
};
