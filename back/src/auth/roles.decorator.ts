import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

// Restringe a rota/controller aos roles informados (ex.: @Roles('SUPER_ADMIN')).
// O RolesGuard lê req.user.role (vindo do JWT) e bloqueia se não bater.
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
