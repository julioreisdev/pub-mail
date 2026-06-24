import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

// Deve rodar DEPOIS do JwtAuthGuard (que popula req.user a partir do token).
// Uso: @UseGuards(JwtAuthGuard, RolesGuard) + @Roles('SUPER_ADMIN').
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const role = req?.user?.role;
    if (!role || !required.includes(role)) {
      throw new ForbiddenException('Acesso restrito a administradores.');
    }
    return true;
  }
}
