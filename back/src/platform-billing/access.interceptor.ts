import { CallHandler, ExecutionContext, ForbiddenException, HttpException, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AccessService } from './access.service';
import { MODULE_LABELS, isOpenPath, moduleForPath } from './modules.const';

// Trava REAL do acesso (o front só melhora a experiência). Interceptor global
// (roda DEPOIS de todos os guards, então `req.user` já existe nas rotas com JWT):
//  - sem `req.user` (rota pública) → passa;
//  - SUPER_ADMIN → passa;
//  - rota aberta (/auth, /access, /admin, /dashboard…) → passa;
//  - conta precisa pagar → 402 { code: 'PAYMENT_REQUIRED' } (trocar URL não adianta: nenhuma API responde);
//  - rota de módulo que o usuário não tem → 403 { code: 'MODULE_DISABLED', module }.
@Injectable()
export class AccessInterceptor implements NestInterceptor {
  constructor(private readonly access: AccessService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest();
    const user = req?.user;
    if (!user?.userId || !user?.organizationId) return next.handle();
    if (user.role === 'SUPER_ADMIN') return next.handle();

    const path = String(req.originalUrl || req.url || '').split('?')[0];
    if (isOpenPath(path)) return next.handle();

    const st = await this.access.getOrgState(user.organizationId);
    if (st.needs_payment) {
      throw new HttpException(
        { statusCode: 402, code: 'PAYMENT_REQUIRED', status: st.status, message: 'Seu acesso está pendente de pagamento.' },
        402,
      );
    }
    const mod = moduleForPath(path, String(req.method || 'GET'));
    if (mod) {
      const mods = await this.access.getUserModules(user.userId);
      if (!mods.includes(mod)) {
        throw new ForbiddenException({ statusCode: 403, code: 'MODULE_DISABLED', module: mod, message: `O módulo ${MODULE_LABELS[mod]} não está incluído no seu acesso.` });
      }
    }
    return next.handle();
  }
}
