import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { API_SCOPES_KEY, ApiScope } from './api-scopes';
import { ApiKeyCtx, OrgApiKeysService } from './org-api-keys.service';

// Guard da API pública v1 (`/api/v1/...`): `Authorization: Bearer pm_…` ou `X-Api-Key: pm_…`.
// Põe `req.apiKey = { id, orgId, scopes, name }`; escopo faltando → 403 { code: 'SCOPE_MISSING', scope }.
// (Nome diferente do `ApiKeyGuard` de `auth/`, que protege as chamadas internas do micro de e-mail.)
@Injectable()
export class OrgApiKeyGuard implements CanActivate {
  constructor(private readonly keys: OrgApiKeysService, private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const res = ctx.switchToHttp().getResponse();
    const auth = String(req.headers?.authorization || '');
    const header = req.headers?.['x-api-key'];
    const raw = /^Bearer\s+/i.test(auth) ? auth.replace(/^Bearer\s+/i, '') : Array.isArray(header) ? header[0] : header || '';
    let key: ApiKeyCtx;
    try {
      key = await this.keys.authenticate(String(raw), String(req.ip || req.socket?.remoteAddress || '') || null);
    } catch (e: any) {
      const retry = e?.getResponse?.()?.retry_after;
      if (retry) try { res?.setHeader?.('Retry-After', String(retry)); } catch { /* idem */ }
      throw e;
    }
    req.apiKey = key;
    try { res?.setHeader?.('X-RateLimit-Limit', '600'); res?.setHeader?.('X-RateLimit-Remaining', String(this.keys.remaining(key.id))); } catch { /* cabeçalho é cortesia */ }
    const need = this.reflector.getAllAndOverride<ApiScope[]>(API_SCOPES_KEY, [ctx.getHandler(), ctx.getClass()]) || [];
    for (const s of need) if (!key.scopes.includes(s)) throw new ForbiddenException({ statusCode: 403, code: 'SCOPE_MISSING', scope: s, message: `Esta chave não tem o escopo "${s}".` });
    return true;
  }
}
