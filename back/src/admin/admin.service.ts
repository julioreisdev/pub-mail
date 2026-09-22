import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { users_role, wallets_status } from 'generated/prisma/client';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';

const userSelect = {
  id: true,
  organization_id: true,
  name: true,
  email: true,
  role: true,
  active: true,
};

function isUniqueError(e: any) {
  return e?.code === 'P2002';
}

function asRole(value: any, fallback: users_role): users_role {
  return value && Object.values(users_role).includes(value)
    ? (value as users_role)
    : fallback;
}

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // ---- Organização OCULTA (conta do desenvolvedor) ----
  // Org com hidden=true (e seus usuários) é tratada como INEXISTENTE pela API admin para
  // qualquer um de fora dela: some das listagens e dá 404 em editar/senha/apagar/criar usuário.
  private async seesHidden(viewerOrgId?: string): Promise<boolean> {
    if (!viewerOrgId) return false;
    const o = await this.prisma.organizations.findUnique({ where: { id: viewerOrgId }, select: { hidden: true } });
    return o?.hidden === true;
  }
  private async assertOrgVisible(orgId: string, viewerOrgId: string | undefined, msg: string) {
    const o = await this.prisma.organizations.findUnique({ where: { id: orgId }, select: { hidden: true } });
    if (o?.hidden && !(await this.seesHidden(viewerOrgId))) throw new NotFoundException(msg);
  }

  // ===== Organizações =====

  async listOrganizations(viewerOrgId?: string) {
    const showHidden = await this.seesHidden(viewerOrgId);
    const orgs = await this.prisma.organizations.findMany({
      where: showHidden ? {} : { hidden: false },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        document_id: true,
        status: true,
        created_at: true,
        _count: { select: { users: true } },
      },
    });
    return orgs.map((o: any) => ({
      id: o.id,
      name: o.name,
      document_id: o.document_id,
      status: o.status,
      created_at: o.created_at,
      users_count: o._count?.users ?? 0,
    }));
  }

  // Cria organização + wallet + usuário admin, atomicamente (mesmo fluxo do
  // /auth/register, mas com role configurável — default ADMIN).
  async createOrganization(dto: CreateOrganizationDto) {
    const name = String(dto.name || '').trim();
    if (!name) throw new BadRequestException('Nome da organização é obrigatório.');
    const email = String(dto.admin_email || '').toLowerCase().trim();
    if (!email) throw new BadRequestException('E-mail do admin é obrigatório.');
    if (!dto.admin_password || String(dto.admin_password).length < 6) {
      throw new BadRequestException('Senha deve ter ao menos 6 caracteres.');
    }
    const existing = await this.prisma.users.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('Já existe um usuário com esse e-mail.');
    }
    const documentId = dto.document_id ? String(dto.document_id).trim() : null;
    const role = asRole(dto.admin_role, users_role.ADMIN);
    const password_hash = await bcrypt.hash(String(dto.admin_password), 12);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const organization = await tx.organizations.create({
          data: { name, ...(documentId ? { document_id: documentId } : {}) },
        });
        await tx.wallets.create({
          data: {
            organization_id: organization.id,
            balance: '0.0000',
            status: wallets_status.ACTIVE,
          },
        });
        const user = await tx.users.create({
          data: {
            organization_id: organization.id,
            name: String(dto.admin_name || name).trim(),
            email,
            password_hash,
            role,
            active: true,
          },
          select: userSelect,
        });
        return { organization, user };
      });
    } catch (e) {
      if (isUniqueError(e)) {
        throw new BadRequestException('E-mail ou documento já cadastrado.');
      }
      throw e;
    }
  }

  async updateOrganization(id: string, dto: UpdateOrganizationDto, viewerOrgId?: string) {
    await this.assertOrgVisible(id, viewerOrgId, 'Organização não encontrada.');
    const org = await this.prisma.organizations.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organização não encontrada.');
    const data: any = {};
    if (dto.name !== undefined) data.name = String(dto.name).trim();
    if (dto.status !== undefined) data.status = dto.status === true;
    return this.prisma.organizations.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        document_id: true,
        status: true,
        created_at: true,
      },
    });
  }

  // Hard-delete: apaga a organização e TODO o seu conteúdo (webchats, leads,
  // projetos, wallets/transações, posts, agentes, etc.). Como os FKs são
  // mistos (Cascade + NoAction), desabilitamos FOREIGN_KEY_CHECKS dentro da
  // transação e apagamos cada tabela do tenant. O try/finally garante que o
  // FK check volta a ON mesmo em erro (não vaza estado na conexão do pool).
  async removeOrganization(id: string, viewerOrgId?: string) {
    await this.assertOrgVisible(id, viewerOrgId, 'Organização não encontrada.');
    const org = await this.prisma.organizations.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organização não encontrada.');

    await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=0');
        try {
          // Netas (sem organization_id) — via subquery no pai.
          await tx.$executeRawUnsafe(
            'DELETE FROM transactions WHERE wallet_id IN (SELECT id FROM wallets WHERE organization_id = ?)',
            id,
          );
          await tx.$executeRawUnsafe(
            'DELETE FROM post_media WHERE post_id IN (SELECT id FROM posts WHERE organization_id = ?)',
            id,
          );
          await tx.$executeRawUnsafe(
            'DELETE FROM email_templates WHERE project_id IN (SELECT id FROM email_projects WHERE organization_id = ?)',
            id,
          );
          await tx.$executeRawUnsafe(
            'DELETE FROM email_project_leads WHERE project_id IN (SELECT id FROM email_projects WHERE organization_id = ?)',
            id,
          );
          await tx.$executeRawUnsafe(
            'DELETE FROM email_projects_schedules WHERE project_id IN (SELECT id FROM email_projects WHERE organization_id = ?)',
            id,
          );
          await tx.$executeRawUnsafe(
            'DELETE FROM email_schedules_sent_opens WHERE schedule_sent_id IN (SELECT id FROM email_projects_schedules_sent WHERE organization_id = ?)',
            id,
          );
          await tx.$executeRawUnsafe(
            'DELETE FROM email_behavior_trigger_fires WHERE trigger_id IN (SELECT id FROM email_behavior_triggers WHERE organization_id = ?)',
            id,
          );
          await tx.$executeRawUnsafe(
            'DELETE FROM email_behavior_triggers WHERE organization_id = ?',
            id,
          );
          await tx.$executeRawUnsafe(
            'DELETE FROM email_ab_variants WHERE ab_test_id IN (SELECT id FROM email_ab_tests WHERE organization_id = ?)',
            id,
          );
          await tx.$executeRawUnsafe(
            'DELETE FROM email_ab_tests WHERE organization_id = ?',
            id,
          );

          // Diretas (têm organization_id).
          const where = { where: { organization_id: id } };
          await tx.webchat_ad_events.deleteMany(where);
          await tx.webchat_ads.deleteMany(where);
          await tx.webchat_leads.deleteMany(where);
          await tx.webchat_sessions.deleteMany(where);
          await tx.webchat_domains.deleteMany(where);
          await tx.webchats.deleteMany(where);
          await tx.quiz_leads.deleteMany(where);
          await tx.quiz_ads.deleteMany(where);
          await tx.quizzes.deleteMany(where);
          await tx.quiz_splits.deleteMany(where);
          await tx.webchat_splits.deleteMany(where);
          await tx.agentes_ia.deleteMany(where);
          await tx.avatar_generations.deleteMany(where);
          await tx.avatars.deleteMany(where);
          await tx.social_post_schedule_runs.deleteMany(where);
          await tx.social_post_schedules.deleteMany(where);
          await tx.social_accounts.deleteMany(where);
          await tx.organization_social_app_credentials.deleteMany(where);
          await tx.posts.deleteMany(where);
          await tx.email_projects_schedules_sent.deleteMany(where);
          await tx.email_flow_enrollments.deleteMany(where);
          await tx.email_flow_steps.deleteMany({ where: { flow: { organization_id: id } } });
          await tx.email_flows.deleteMany(where);
          await tx.email_projects.deleteMany(where);
          await tx.email_leads.deleteMany(where);
          await tx.organization_domains.deleteMany(where);
          await tx.billing_cards.deleteMany(where);
          await tx.wallets.deleteMany(where);
          await tx.users.deleteMany(where);

          await tx.organizations.delete({ where: { id } });
        } finally {
          await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=1');
        }
      },
      { timeout: 30000 },
    );

    return { id, deleted: true };
  }

  // ===== Usuários =====

  async listUsers(viewerOrgId?: string) {
    const showHidden = await this.seesHidden(viewerOrgId);
    return this.prisma.users.findMany({
      where: showHidden ? {} : { organizations: { hidden: false } },
      orderBy: { name: 'asc' },
      select: {
        ...userSelect,
        organizations: { select: { id: true, name: true, status: true } },
      },
    });
  }

  async createUser(dto: CreateAdminUserDto, viewerOrgId?: string) {
    if (dto.organization_id) await this.assertOrgVisible(String(dto.organization_id), viewerOrgId, 'Organização não encontrada.');
    const email = String(dto.email || '').toLowerCase().trim();
    if (!email) throw new BadRequestException('E-mail é obrigatório.');
    if (!dto.organization_id) {
      throw new BadRequestException('Organização é obrigatória.');
    }
    if (!dto.password || String(dto.password).length < 6) {
      throw new BadRequestException('Senha deve ter ao menos 6 caracteres.');
    }
    const org = await this.prisma.organizations.findUnique({
      where: { id: String(dto.organization_id) },
    });
    if (!org) throw new NotFoundException('Organização não encontrada.');
    const existing = await this.prisma.users.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('Já existe um usuário com esse e-mail.');
    }
    const role = asRole(dto.role, users_role.MEMBER);
    const password_hash = await bcrypt.hash(String(dto.password), 12);
    try {
      return await this.prisma.users.create({
        data: {
          organization_id: String(dto.organization_id),
          name: String(dto.name || '').trim(),
          email,
          password_hash,
          role,
          active: true,
        },
        select: userSelect,
      });
    } catch (e) {
      if (isUniqueError(e)) {
        throw new BadRequestException('E-mail já cadastrado.');
      }
      throw e;
    }
  }

  async updateUser(id: string, dto: UpdateAdminUserDto, viewerOrgId?: string) {
    const user = await this.prisma.users.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    await this.assertOrgVisible(user.organization_id, viewerOrgId, 'Usuário não encontrado.');
    const data: any = {};
    if (dto.name !== undefined) data.name = String(dto.name).trim();
    if (dto.role !== undefined) data.role = asRole(dto.role, user.role);
    if (dto.active !== undefined) data.active = dto.active === true;
    return this.prisma.users.update({ where: { id }, data, select: userSelect });
  }

  async changePassword(id: string, password: string, viewerOrgId?: string) {
    if (!password || String(password).length < 6) {
      throw new BadRequestException('Senha deve ter ao menos 6 caracteres.');
    }
    const user = await this.prisma.users.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    await this.assertOrgVisible(user.organization_id, viewerOrgId, 'Usuário não encontrado.');
    const password_hash = await bcrypt.hash(String(password), 12);
    // Invalida sessões existentes ao trocar a senha.
    await this.prisma.users.update({
      where: { id },
      data: { password_hash, refresh_token: null },
    });
    return { id, ok: true };
  }

  // Hard-delete do usuário (nenhuma tabela referencia users.id por FK).
  async removeUser(id: string, currentUserId: string, viewerOrgId?: string) {
    const user = await this.prisma.users.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    await this.assertOrgVisible(user.organization_id, viewerOrgId, 'Usuário não encontrado.');
    if (id === currentUserId) {
      throw new BadRequestException('Você não pode remover a si mesmo.');
    }
    await this.prisma.users.delete({ where: { id } });
    return { id, deleted: true };
  }
}
