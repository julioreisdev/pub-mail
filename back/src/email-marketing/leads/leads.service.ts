import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { cleanEmailOrNull } from '../../common/email.util';
import { CreateEmailLeadDto } from './dto/create-email-lead.dto';
import { UpdateEmailLeadDto } from './dto/update-email-lead.dto';
import { PublicSubscribeDto } from './dto/public-subscribe.dto';
import { EmailSchedulesRunner } from '../../cron-jobs/schedules.service';

function isPrismaUniqueError(e: any) {
  return e?.code === 'P2002';
}

@Injectable()
export class EmailLeadsService {
  constructor(
    private prisma: PrismaService,
    private readonly schedulesRunner: EmailSchedulesRunner,
  ) { }

  private readonly leadSelect = {
    id: true,
    organization_id: true,
    email: true,
    name: true,
    attributes: true,
    tags: true,
    global_status: true,
  };

  // Normaliza tags: trim, remove vazias/duplicadas, limita tamanho.
  private normalizeTags(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const t of raw) {
      const tag = String(t ?? '').trim().slice(0, 40);
      if (!tag) continue;
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(tag);
      if (out.length >= 50) break;
    }
    return out;
  }

  /**
   * Merge simples de JSON:
   * - se newJson vier undefined: não altera
   * - se oldJson for null/undefined: usa newJson
   * - se ambos forem objetos: merge shallow
   */
  private mergeJson(
    oldJson: any,
    newJson: any,
  ): Record<string, any> | undefined {
    if (newJson === undefined) return undefined;
    if (newJson === null) return undefined; // não vamos gravar null
    if (oldJson === null || oldJson === undefined) return newJson;
    if (typeof oldJson !== 'object' || typeof newJson !== 'object')
      return newJson;
    return { ...oldJson, ...newJson };
  }

  // WEBHOOK PÚBLICO: /email/leads/subscribe/:organizationId/:projectId
  async publicSubscribe(
    organizationId: string,
    projectId: string,
    dto: PublicSubscribeDto,
  ) {
    // 0) Sanitiza (conserta ponto duplo etc.) + valida estrito. Fonte única.
    const email = cleanEmailOrNull(dto.email);
    if (!email) {
      throw new BadRequestException('Invalid email address format');
    }

    // 1) Validar org
    const org = await this.prisma.organizations.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    // 2) Validar project (tem que pertencer à org)
    const project = await this.prisma.email_projects.findFirst({
      where: { id: projectId, organization_id: organizationId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    // Holder: TypeScript no sigue asignaciones hechas dentro del callback de
    // la transaccion (con un `let` suelto inferiria `never` en el chequeo).
    const welcome: { leadId: string | null } = { leadId: null };
    await this.prisma.$transaction(async (tx) => {
      // 3) Buscar lead existente (sem depender do alias do unique composto)
      const existing = await tx.email_leads.findFirst({
        where: { organization_id: organizationId, email },
        select: { id: true, name: true, attributes: true },
      });

      let leadId: string;

      if (!existing) {
        // create sem mandar null para JSON
        const data: any = {
          organization_id: organizationId,
          email,
          name: dto.name?.trim() || null,
          global_status: 'ACTIVE',
        };
        if (dto.attributes !== undefined) data.attributes = dto.attributes;

        const created = await tx.email_leads.create({
          data,
          select: { id: true },
        });

        leadId = created.id;
      } else {
        const mergedAttrs = this.mergeJson(existing.attributes, dto.attributes);

        const data: any = {
          name: dto.name?.trim() ? dto.name.trim() : existing.name,
        };
        if (mergedAttrs !== undefined) data.attributes = mergedAttrs;

        await tx.email_leads.update({
          where: { id: existing.id },
          data,
        });

        leadId = existing.id;
      }

      // 4) Pivot (project + lead) com reativação
      const pivot = await tx.email_project_leads.findFirst({
        where: { project_id: projectId, lead_id: leadId },
        select: { status: true },
      });

      if (!pivot) {
        await tx.email_project_leads.create({
          data: {
            project_id: projectId,
            lead_id: leadId,
            status: 'SUBSCRIBED',
          },
        });
        // vinculo NUEVO -> candidato a welcome (se dispara fuera de la tx)
        welcome.leadId = leadId;
      } else if (pivot.status === 'UNSUBSCRIBED') {
        // reativação: usuário preencheu o formulário de novo
        await tx.email_project_leads.updateMany({
          where: { project_id: projectId, lead_id: leadId },
          data: { status: 'SUBSCRIBED' },
        });
      } else {
        // Já SUBSCRIBED:
        // se você adicionou updated_at @updatedAt na pivot, dá pra "tocar" updated_at com updateMany vazio
        await tx.email_project_leads.updateMany({
          where: { project_id: projectId, lead_id: leadId },
          data: {},
        });
      }
    });

    // FLUJO INICIAL: si el lead entro por primera vez al proyecto y el proyecto
    // tiene welcome activado, se envia el correo de bienvenida (best-effort,
    // fuera de la transaccion; nunca rompe el alta del lead).
    if (welcome.leadId) {
      void this.schedulesRunner.sendWelcomeToLead(projectId, welcome.leadId);
    }

    return { message: 'Lead subscribed successfully' };
  }

  // -------------------------
  // CRUD autenticado
  // -------------------------

  async create(organizationId: string, dto: CreateEmailLeadDto) {
    const email = cleanEmailOrNull(dto.email);
    if (!email) {
      throw new BadRequestException('Invalid email address format');
    }

    const data: any = {
      organization_id: organizationId,
      email,
      name: dto.name?.trim() ?? null,
      global_status: 'ACTIVE',
    };
    if (dto.attributes !== undefined) data.attributes = dto.attributes;

    try {
      return await this.prisma.email_leads.create({
        data,
        select: this.leadSelect,
      });
    } catch (e: any) {
      if (isPrismaUniqueError(e)) {
        throw new BadRequestException(
          'Email already exists in this organization',
        );
      }
      throw e;
    }
  }

  list(organizationId: string) {
    return this.prisma.email_leads.findMany({
      where: { organization_id: organizationId },
      orderBy: { email: 'asc' },
      select: this.leadSelect,
    });
  }

  // Tags distintas da org (pra alimentar filtros/autocomplete no front).
  async distinctTags(organizationId: string): Promise<string[]> {
    const rows = await this.prisma.email_leads.findMany({
      where: { organization_id: organizationId, tags: { not: Prisma.DbNull } },
      select: { tags: true },
    });
    const set = new Set<string>();
    rows.forEach((r) => {
      if (Array.isArray(r.tags)) r.tags.forEach((t) => set.add(String(t)));
    });
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }),
    );
  }

  // Adiciona tag(s) a vários leads de uma vez (append, sem duplicar).
  async bulkAddTags(
    organizationId: string,
    leadIds: string[],
    addTags: string[],
  ) {
    const tags = this.normalizeTags(addTags);
    const ids = Array.isArray(leadIds) ? leadIds.filter(Boolean) : [];
    if (ids.length === 0 || tags.length === 0) return { updated: 0 };

    const leads = await this.prisma.email_leads.findMany({
      where: { organization_id: organizationId, id: { in: ids } },
      select: { id: true, tags: true },
    });
    if (leads.length === 0) return { updated: 0 };

    await this.prisma.$transaction(
      leads.map((l) => {
        const current = Array.isArray(l.tags) ? l.tags.map(String) : [];
        const merged = this.normalizeTags([...current, ...tags]);
        return this.prisma.email_leads.update({
          where: { id: l.id },
          data: { tags: merged },
        });
      }),
    );
    return { updated: leads.length };
  }

  async update(organizationId: string, id: string, dto: UpdateEmailLeadDto) {
    const lead = await this.prisma.email_leads.findFirst({
      where: { id, organization_id: organizationId },
      select: { id: true },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name?.trim() ?? null;
    if (dto.attributes !== undefined) data.attributes = dto.attributes;
    if (dto.tags !== undefined) data.tags = this.normalizeTags(dto.tags);

    return this.prisma.email_leads.update({
      where: { id },
      data,
      select: this.leadSelect,
    });
  }

  async remove(organizationId: string, id: string) {
    const lead = await this.prisma.email_leads.findFirst({
      where: { id, organization_id: organizationId },
      select: { id: true },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    await this.prisma.email_leads.delete({ where: { id } });
    return { message: 'Lead removed' };
  }

  async countLeadsByProject(organizationId: string, projectId: string) {
    const project = await this.prisma.email_projects.findFirst({
      where: { id: projectId, organization_id: organizationId },
      select: { id: true },
    });

    if (!project) throw new NotFoundException('Project not found');

    const [inscribed_leads, unscribed_leads] = await Promise.all([
      this.prisma.email_project_leads.count({
        where: { project_id: projectId, status: 'SUBSCRIBED' },
      }),
      this.prisma.email_project_leads.count({
        where: { project_id: projectId, status: 'UNSUBSCRIBED' },
      }),
    ]);

    return { inscribed_leads, unscribed_leads };
  }

  async unsubscribe(projectId: string, leadEmail: string): Promise<string> {
    const email = decodeURIComponent(leadEmail).trim().toLowerCase();

    // 1) valida project + pega orgId + settings
    const project = await this.prisma.email_projects.findUnique({
      where: { id: projectId },
      select: { id: true, organization_id: true, settings: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    // 2) buscar lead (org + email)
    const lead = await this.prisma.email_leads.findFirst({
      where: { organization_id: project.organization_id, email },
      select: { id: true },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    // 3) garantir pivot existe + setar status UNSUBSCRIBED
    const pivot = await this.prisma.email_project_leads.findFirst({
      where: { project_id: projectId, lead_id: lead.id },
      select: { project_id: true, lead_id: true },
    });
    if (!pivot) throw new NotFoundException('Subscription not found');

    await this.prisma.email_project_leads.updateMany({
      where: { project_id: projectId, lead_id: lead.id },
      data: { status: 'UNSUBSCRIBED' },
    });

    // 4) mensagem: settings.unsubscribe_message ou fallback
    const settings: any = project.settings ?? {};
    const customMsg =
      typeof settings?.unsubscribe_message === 'string' &&
        settings.unsubscribe_message.trim()
        ? settings.unsubscribe_message.trim()
        : null;

    return customMsg ?? 'Unsubscribed!';
  }
}
