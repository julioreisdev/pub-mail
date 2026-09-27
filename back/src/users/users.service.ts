import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

import * as bcrypt from 'bcryptjs';
import { wallets_status, users_role } from 'generated/prisma/client';

function isPrismaUniqueError(e: any) {
  return e?.code === 'P2002';
}

function prismaUniqueTargets(e: any): string[] {
  const t = e?.meta?.target;
  if (Array.isArray(t)) return t.map(String);
  if (typeof t === 'string') return [t];
  return [];
}

const userSelect = {
  id: true,
  organization_id: true,
  name: true,
  email: true,
  role: true,
  active: true,
};

// Quem chama a rota (vem do JWT via req.user).
export type Requester = { userId: string; role?: string | null };

// Papéis que podem gerenciar (papel/ativo/desativar) outros usuários da org.
const MANAGER_ROLES: string[] = [users_role.OWNER, users_role.ADMIN, users_role.SUPER_ADMIN];
// Papéis que NUNCA podem ser atribuídos pela rota do tenant (só via /admin).
const FORBIDDEN_TENANT_ROLES: string[] = [users_role.OWNER, users_role.SUPER_ADMIN];

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // usado pelo AuthService em /auth/register
  async register(dto: CreateUserDto) {
    const email = dto.email?.toLowerCase().trim();

    // document_id agora é opcional
    const documentId = dto.document_id?.trim();

    // Se vier como string vazia, rejeita (opcional)
    if (documentId === '') {
      throw new BadRequestException('document_id cannot be empty');
    }

    if (!email) throw new BadRequestException('email is required');
    if (!dto.password) throw new BadRequestException('password is required');
    if (!dto.organization_name?.trim())
      throw new BadRequestException('organization_name is required');
    if (!dto.name?.trim()) throw new BadRequestException('name is required');

    const userExists = await this.prisma.users.findUnique({ where: { email } });
    if (userExists) throw new BadRequestException('Email already registered');

    const password_hash = await bcrypt.hash(dto.password, 12);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const organization = await tx.organizations.create({
          data: {
            name: dto.organization_name.trim(),

            // só envia document_id se existir
            ...(documentId ? { document_id: documentId } : {}),
          },
        });

        const wallet = await tx.wallets.create({
          data: {
            organization_id: organization.id,
            balance: '0.0000',
            status: wallets_status.ACTIVE,
          },
        });

        const user = await tx.users.create({
          data: {
            organization_id: organization.id,
            name: dto.name.trim(),
            email,
            password_hash,
            role: users_role.OWNER,
            active: true,
            modules: [], // cadastro público não libera módulo nenhum (o superadmin libera)
          },
          select: userSelect,
        });

        return { user, organization, wallet };
      });
    } catch (e: any) {
      if (isPrismaUniqueError(e)) {
        const targets = prismaUniqueTargets(e);
        if (targets.includes('email'))
          throw new BadRequestException('Email already registered');
        if (targets.includes('document_id'))
          throw new BadRequestException('Document already registered');
        throw new BadRequestException('Email or document already registered');
      }
      throw e;
    }
  }

  //  GET /users (somente da org)
  async findAllByOrganization(organizationId: string) {
    return this.prisma.users.findMany({
      where: { organization_id: organizationId, active: true },
      select: userSelect,
      orderBy: { name: 'asc' },
    });
  }

  // GET /users/me
  async findMe(userId: string, organizationId: string) {
    const user = await this.prisma.users.findFirst({
      where: { id: userId, organization_id: organizationId },
      select: userSelect,
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  //  GET /users/:id (somente da org)
  async findOneInOrganization(organizationId: string, userId: string) {
    const user = await this.prisma.users.findFirst({
      where: { id: userId, organization_id: organizationId },
      select: userSelect,
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // Regras de quem pode mexer em quem (A-02): só OWNER/ADMIN/SUPER_ADMIN
  // gerenciam papel/ativo de OUTROS usuários; ninguém altera o próprio papel/
  // status por aqui; ADMIN não mexe em OWNER; só SUPER_ADMIN mexe em SUPER_ADMIN.
  private assertCanManage(
    requester: Requester,
    target: { id: string; role: string },
    action: string,
  ) {
    const role = String(requester?.role || '');
    if (!MANAGER_ROLES.includes(role)) {
      throw new ForbiddenException(`Sem permissão para ${action} usuários.`);
    }
    if (requester.userId === target.id) {
      throw new ForbiddenException(
        `Você não pode ${action} o próprio usuário. Peça a outro administrador.`,
      );
    }
    if (target.role === users_role.SUPER_ADMIN && role !== users_role.SUPER_ADMIN) {
      throw new ForbiddenException('Sem permissão para alterar um administrador da plataforma.');
    }
    if (target.role === users_role.OWNER && role === users_role.ADMIN) {
      throw new ForbiddenException('Somente o proprietário pode alterar o proprietário da organização.');
    }
  }

  //  PATCH /users/:id (somente da org)
  async updateInOrganization(
    organizationId: string,
    userId: string,
    dto: UpdateUserDto,
    requester: Requester,
  ) {
    const exists = await this.prisma.users.findFirst({
      where: { id: userId, organization_id: organizationId },
      select: { id: true, role: true },
    });

    if (!exists) throw new NotFoundException('User not found');

    // OWNER/SUPER_ADMIN nunca são atribuídos por esta rota (só via /admin).
    if (dto.role !== undefined && FORBIDDEN_TENANT_ROLES.includes(String(dto.role))) {
      throw new ForbiddenException('Este papel não pode ser atribuído por aqui.');
    }

    const wantsPrivileged = dto.role !== undefined || dto.active !== undefined;
    if (wantsPrivileged) {
      this.assertCanManage(requester, exists, 'alterar papel/status de');
    }

    const data: { name?: string; role?: users_role; active?: boolean } = {};
    if (dto.name !== undefined) data.name = String(dto.name).trim();
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.active !== undefined) data.active = dto.active === true;

    return this.prisma.users.update({
      where: { id: userId },
      data,
      select: userSelect,
    });
  }

  //  DELETE /users/:id (soft delete, somente da org)
  async removeInOrganization(
    organizationId: string,
    userId: string,
    requester: Requester,
  ) {
    const exists = await this.prisma.users.findFirst({
      where: { id: userId, organization_id: organizationId },
      select: { id: true, role: true },
    });

    if (!exists) throw new NotFoundException('User not found');

    this.assertCanManage(requester, exists, 'desativar');

    return this.prisma.users.update({
      where: { id: userId },
      data: { active: false, refresh_token: null },
      select: userSelect,
    });
  }
}
