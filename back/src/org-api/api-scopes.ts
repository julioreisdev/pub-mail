import { SetMetadata } from '@nestjs/common';
import { createHash } from 'crypto';
import { base62 } from '../org-webhooks/webhook-sign.util';

// Escopos das chaves de API da organização (Fase 5, contrato §8.4).
export const API_SCOPES = [
  'customers:read', 'customers:write',
  'subscriptions:read', 'subscriptions:write',
  'charges:read', 'charges:write',
  'messages:send', 'contacts:write',
  'entitlements:read', 'products:read',
  'appointments:read', // Fase 6 (agenda)
  'tickets:read', 'tickets:write', // Fase 6B (chamados)
  'orders:read', 'orders:write', // Fase 7 (pedidos)
] as const;
export type ApiScope = (typeof API_SCOPES)[number];
/** Padrão ao criar sem escolher: todas as leituras. */
export const DEFAULT_API_SCOPES: ApiScope[] = API_SCOPES.filter((s) => s.endsWith(':read'));
export const MAX_API_KEYS_PER_ORG = 20;

export const API_SCOPES_KEY = 'org_api_scopes';
/** Escopo(s) exigido(s) pela rota da API v1 (todos precisam estar na chave). */
export const ApiScopes = (...scopes: ApiScope[]) => SetMetadata(API_SCOPES_KEY, scopes);

export function normalizeScopes(raw: unknown): ApiScope[] {
  const list = Array.isArray(raw) ? raw.map((x) => String(x || '').trim()) : [];
  return API_SCOPES.filter((s) => list.includes(s));
}

// Formato: `pm_<prefixo 8>_<segredo 32>` (base62). Só o sha256 da chave inteira fica no banco.
export const API_KEY_RE = /^pm_[A-Za-z0-9]{8}_[A-Za-z0-9]{32}$/;
export const hashApiKey = (key: string) => createHash('sha256').update(String(key)).digest('hex');
export function newApiKey() {
  const prefix = `pm_${base62(8)}`;
  const key = `${prefix}_${base62(32)}`;
  return { key, prefix, hash: hashApiKey(key) };
}
