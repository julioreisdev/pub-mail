import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { Prisma, users_role, wallets_status } from 'generated/prisma/client';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { CreateClientDto } from '../platform-billing/dto/billing.dto';
import { AccessService, normalizeWhatsAppSessions } from '../platform-billing/access.service';
import { WhatsAppSessionsService } from '../whatsapp/whatsapp-sessions.service';
import { WaAccessService } from '../whatsapp/wa-access.service';
import { RealtimeService } from '../realtime/realtime.service';
import { ALL_MODULES, normalizeModules } from '../platform-billing/modules.const';

const userSelect = {
  id: true,
  organization_id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  modules: true,
  whatsapp_sessions: true, // números do WhatsApp liberados (ids); null = todos
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
  constructor(
    private prisma: PrismaService,
    private readonly access: AccessService,
    private readonly whatsapp: WhatsAppSessionsService,
    private readonly waAccess: WaAccessService,
    private readonly realtime: RealtimeService,
  ) {}

  // ---- Números do WhatsApp por usuário (`users.whatsapp_sessions`) ----
  // `null`/undefined = todos; array = só esses ids (filtrados aos números da MESMA org; `[]` = nenhum).
  // OWNER/ADMIN/SUPER_ADMIN ignoram a coluna (sempre todos) — gravamos mesmo assim, p/ valer se o role baixar.
  private async normalizeWaSessions(orgId: string, raw: unknown): Promise<string[] | null> {
    const ids = normalizeWhatsAppSessions(raw);
    if (ids === null) return null;
    if (!ids.length) return [];
    const valid = new Set((await this.whatsapp.rowsOf(orgId)).map((r: any) => String(r.id)));
    return ids.filter((id) => valid.has(id));
  }
  private waSessionsData(ids: string[] | null) {
    return ids === null ? Prisma.DbNull : ids;
  }
  /** Depois de gravar: zera o cache de acesso por número e recoloca os sockets do usuário nas salas certas. */
  private async afterWaSessionsSaved(userId: string, orgId: string, role: string | null | undefined, ids: string[] | null) {
    this.waAccess.invalidate(userId);
    const allIds = (await this.whatsapp.rowsOf(orgId).catch(() => [])).map((r: any) => String(r.id));
    const allowed = WaAccessService.isAdmin(role) || ids === null ? null : new Set(ids);
    this.realtime.resubscribeSessions(userId, orgId, 'whatsapp', allIds, allowed);
  }
  private shapeUser<T extends { whatsapp_sessions?: unknown }>(u: T) {
    return { ...u, whatsapp_sessions: normalizeWhatsAppSessions(u?.whatsapp_sessions) };
  }

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
    const accessRows = orgs.length ? await this.prisma.organization_access.findMany({ where: { organization_id: { in: orgs.map((o) => o.id) } } }) : [];
    const amap = new Map(accessRows.map((r) => [r.organization_id, r] as [string, any]));
    return orgs.map((o: any) => ({
      id: o.id,
      name: o.name,
      document_id: o.document_id,
      status: o.status,
      created_at: o.created_at,
      users_count: o._count?.users ?? 0,
      access: this.accessSummary(amap.get(o.id)),
    }));
  }

  // Números do WhatsApp de uma organização (p/ o formulário de usuário escolher quais liberar).
  async listOrgWhatsAppSessions(orgId: string, viewerOrgId?: string) {
    await this.assertOrgVisible(orgId, viewerOrgId, 'Organização não encontrada.');
    const org = await this.prisma.organizations.findUnique({ where: { id: orgId }, select: { id: true } });
    if (!org) throw new NotFoundException('Organização não encontrada.');
    const rows = await this.whatsapp.rowsOf(orgId);
    return rows.map((r: any) => this.whatsapp.brief(r));
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
            modules: ALL_MODULES, // fluxo legado "Nova organização": acesso completo e gratuito
          },
          select: userSelect,
        });
        await this.access.upsertPlan(organization.id, { price_cents: 0, period_days: null }, tx);
        return { organization, user: this.shapeUser(user) };
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
        // WhatsApp: desloga/apaga a sessão no OpenWA (best-effort) antes de apagar as linhas.
    await this.whatsapp.destroyForOrg(id).catch(() => undefined);
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
            'DELETE FROM email_schedules_sent_clicks WHERE schedule_sent_id IN (SELECT id FROM email_projects_schedules_sent WHERE organization_id = ?)',
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
          await tx.webchat_payments.deleteMany(where); // cobranças PIX do funil
          await tx.webchat_assets.deleteMany(where); // arquivos de produto (metadados; disco fica)
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
          await tx.organization_settings.deleteMany(where); // chaves de API da org
          await tx.whatsapp_ratings.deleteMany(where);
          await tx.whatsapp_tasks.deleteMany(where); // CRM do WhatsApp (tarefas, notas, funil, cobranças, assinaturas, clientes, produtos)
          await tx.whatsapp_chat_notes.deleteMany(where);
          await tx.whatsapp_pipeline_stages.deleteMany(where);
          await tx.whatsapp_charges.deleteMany(where);
          await tx.whatsapp_subscriptions.deleteMany(where);
          await tx.whatsapp_customers.deleteMany(where);
          await tx.whatsapp_products.deleteMany(where);
          await tx.whatsapp_crm_settings.deleteMany(where);
          await tx.whatsapp_contact_statuses.deleteMany(where);
          await tx.whatsapp_payments.deleteMany(where);
          await tx.whatsapp_bot_sessions.deleteMany(where);
          await tx.whatsapp_bot_flows.deleteMany(where);
          await tx.whatsapp_service_events.deleteMany(where);
          await tx.whatsapp_quick_replies.deleteMany(where);
          await tx.whatsapp_tags.deleteMany(where);
          await tx.whatsapp_schedules.deleteMany(where);
          await tx.whatsapp_chat_filters.deleteMany(where);
          await tx.team_messages.deleteMany(where);
          await tx.team_chats.deleteMany(where); // team_chat_members cai em cascata (FK)
          await tx.whatsapp_broadcast_sends.deleteMany(where);
          await tx.whatsapp_broadcast_runs.deleteMany(where);
          await tx.whatsapp_broadcast_copies.deleteMany(where);
          await tx.whatsapp_broadcasts.deleteMany(where);
          await tx.whatsapp_statuses.deleteMany(where);
          await tx.whatsapp_messages.deleteMany(where);
          await tx.whatsapp_chats.deleteMany(where);
          await tx.whatsapp_contacts.deleteMany(where);
          await tx.whatsapp_media.deleteMany(where); // metadados; arquivos em protected/whatsapp/<org> ficam p/ limpeza
          await tx.whatsapp_session_events.deleteMany(where);
          await tx.whatsapp_sessions.deleteMany(where); // sessão WhatsApp (gateway já limpo antes da transação)
          await tx.wp_plugin_sites.deleteMany(where); // plugin WordPress (sites e chaves)
          await tx.wp_plugin_licenses.deleteMany(where);
          await tx.platform_payments.deleteMany(where); // cobranças de assinatura
          await tx.organization_access.deleteMany(where); // plano de acesso

          // Telegram (A-33): todas as tabelas têm organization_id. Sem isso os
          // broadcasts/rotativas da org apagada continuavam rodando (runners
          // não filtram org) e bots/contatos ficavam órfãos.
          await tx.telegram_broadcast_sends.deleteMany(where);
          await tx.telegram_broadcast_runs.deleteMany(where);
          await tx.telegram_broadcast_copies.deleteMany(where);
          await tx.telegram_broadcasts.deleteMany(where);
          await tx.telegram_automation_enrollments.deleteMany(where);
          await tx.telegram_automations.deleteMany(where);
          await tx.telegram_flow_enrollments.deleteMany(where);
          await tx.telegram_flows.deleteMany(where);
          await tx.telegram_rotators.deleteMany(where);
          await tx.telegram_subscriptions.deleteMany(where);
          await tx.telegram_payments.deleteMany(where);
          await tx.telegram_plans.deleteMany(where);
          await tx.telegram_payment_settings.deleteMany(where); // gateway PIX (compartilhado c/ webchat)
          await tx.telegram_messages.deleteMany(where);
          await tx.telegram_groups.deleteMany(where);
          await tx.telegram_contacts.deleteMany(where);
          await tx.telegram_bots.deleteMany(where);

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
    const users = await this.prisma.users.findMany({
      where: showHidden ? {} : { organizations: { hidden: false } },
      orderBy: { name: 'asc' },
      select: {
        ...userSelect,
        organizations: { select: { id: true, name: true, status: true } },
      },
    });
    const orgIds = [...new Set(users.map((u) => u.organization_id))];
    const accessRows = orgIds.length ? await this.prisma.organization_access.findMany({ where: { organization_id: { in: orgIds } } }) : [];
    const amap = new Map(accessRows.map((r) => [r.organization_id, r] as [string, any]));
    return users.map((u: any) => ({ ...this.shapeUser(u), modules: normalizeModules(u.modules), access: this.accessSummary(amap.get(u.organization_id)) }));
  }

  private accessSummary(row: any) {
    const st = this.access.stateOf(row);
    return {
      status: st.status,
      needs_payment: st.needs_payment,
      price_cents: st.price_cents,
      period_days: st.period_days,
      lifetime: st.lifetime,
      access_until: st.access_until,
      days_left: st.days_left,
      last_paid_at: st.last_paid_at,
    };
  }

  // Novo CLIENTE = organização + wallet + usuário dono + plano de acesso + módulos, numa transação.
  async createClient(dto: CreateClientDto) {
    const email = String(dto.email || '').toLowerCase().trim();
    if (!email) throw new BadRequestException('E-mail é obrigatório.');
    const name = String(dto.name || '').trim();
    if (!name) throw new BadRequestException('Nome é obrigatório.');
    const orgName = String(dto.org_name || name).trim();
    const existing = await this.prisma.users.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('Já existe um usuário com esse e-mail.');
    const role = asRole(dto.role, users_role.OWNER);
    const modules = normalizeModules(dto.modules);
    // Org nova = ainda sem números: null = todos (quando conectar), array = nenhum até o admin liberar.
    const waSessions = normalizeWhatsAppSessions(dto.whatsapp_sessions) === null ? null : [];
    const password_hash = await bcrypt.hash(String(dto.password), 12);
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const organization = await tx.organizations.create({ data: { name: orgName } });
        await tx.wallets.create({ data: { organization_id: organization.id, balance: '0.0000', status: wallets_status.ACTIVE } });
        const user = await tx.users.create({
          data: { organization_id: organization.id, name, email, password_hash, role, active: true, modules, whatsapp_sessions: this.waSessionsData(waSessions) },
          select: userSelect,
        });
        const access = await this.access.upsertPlan(organization.id, { price_cents: dto.price_cents, period_days: dto.period_days ?? null }, tx);
        return { organization, user: { ...this.shapeUser(user), modules }, access };
      });
      return result;
    } catch (e) {
      if (isUniqueError(e)) throw new BadRequestException('E-mail já cadastrado.');
      throw e;
    }
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
    const waSessions = await this.normalizeWaSessions(String(dto.organization_id), dto.whatsapp_sessions);
    try {
      const created = await this.prisma.users.create({
        data: {
          organization_id: String(dto.organization_id),
          name: String(dto.name || '').trim(),
          email,
          password_hash,
          role,
          active: true,
          modules: normalizeModules(dto.modules),
          whatsapp_sessions: this.waSessionsData(waSessions),
        },
        select: userSelect,
      });
      return this.shapeUser(created);
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
    if (dto.modules !== undefined) data.modules = normalizeModules(dto.modules);
    let waSessions: string[] | null | undefined;
    if (dto.whatsapp_sessions !== undefined) {
      waSessions = await this.normalizeWaSessions(user.organization_id, dto.whatsapp_sessions);
      data.whatsapp_sessions = this.waSessionsData(waSessions);
    }
    const updated = await this.prisma.users.update({ where: { id }, data, select: userSelect });
    this.access.invalidateUser(id);
    // Mudou os números liberados OU o role (dono/admin vê todos): acesso por número + salas do socket.
    if (waSessions !== undefined || (dto.role !== undefined && updated.role !== user.role)) {
      await this.afterWaSessionsSaved(id, user.organization_id, updated.role, normalizeWhatsAppSessions(updated.whatsapp_sessions));
    }
    return this.shapeUser(updated);
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
