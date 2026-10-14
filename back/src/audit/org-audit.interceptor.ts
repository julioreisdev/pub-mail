import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { auditRouteFor } from './audit-routes.util';
import { normalizeApiPath } from '../platform-billing/modules.const';
import { OrgAuditService, hasRowModel } from './org-audit.service';

// ============================================================================
// Interceptor GLOBAL da auditoria (Fase 8, §12.4). Roda depois dos guards (`req.user` / `req.apiKey` já existem).
// - só escritas auditáveis (mapa puro `auditRouteFor`); o resto passa direto, sem custo;
// - antes do handler, SÓ para entidades com linha própria e rota com id: 1 leitura por id (teto 250 ms);
// - depois de uma resposta 2xx, grava fora do caminho da resposta (`setImmediate`), best-effort;
// - erro/exceção do handler = nada gravado; qualquer falha da auditoria é engolida.
// ============================================================================

const BEFORE_TIMEOUT_MS = 250;

@Injectable()
export class OrgAuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: OrgAuditService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    if (context.getType() !== 'http') return next.handle();
    let req: any, res: any, route: ReturnType<typeof auditRouteFor> = null, orgId: string | null = null, path = '', method = '';
    let before: Record<string, any> | null = null;
    try {
      req = context.switchToHttp().getRequest();
      res = context.switchToHttp().getResponse();
      method = String(req?.method || '').toUpperCase();
      path = normalizeApiPath(String(req?.originalUrl || req?.url || '')); // mesmo caminho canônico da checagem de acesso
      route = auditRouteFor(method, path);
      if (!route) return next.handle();
      orgId = req?.user?.organizationId || req?.apiKey?.orgId || null;
      if (!orgId) return next.handle();
      if (route.entityId && hasRowModel(route.entity) && route.verb !== 'create') {
        before = await Promise.race([
          this.audit.fetchRow(orgId, route.entity, route.entityId),
          new Promise<null>((r) => setTimeout(() => r(null), BEFORE_TIMEOUT_MS)),
        ]).catch(() => null);
      }
    } catch {
      return next.handle();
    }
    const r = route!;
    const org = orgId!;
    return next.handle().pipe(
      tap({
        next: (response) => {
          try {
            // copia o que precisa AGORA (o objeto da requisição pode ser reaproveitado depois)
            const userId = req?.user?.userId || null;
            const apiKeyId = req?.apiKey?.id || null;
            const apiKeyName = req?.apiKey?.name || null;
            const ip = String(req?.ip || req?.socket?.remoteAddress || '') || null;
            const body = req?.body;
            setImmediate(() => {
              const status = res?.headersSent ? Number(res.statusCode) : method === 'POST' ? 201 : Number(res?.statusCode) || 200;
              void this.audit
                .capture({ route: r, orgId: org, userId, apiKeyId, apiKeyName, method, path, status, ip, body, response, before })
                .catch(() => undefined);
            });
          } catch {
            /* auditoria nunca derruba a resposta */
          }
        },
      }),
    );
  }
}
