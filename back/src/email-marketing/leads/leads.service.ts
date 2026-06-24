import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEmailLeadDto } from './dto/create-email-lead.dto';
import { UpdateEmailLeadDto } from './dto/update-email-lead.dto';
import { PublicSubscribeDto } from './dto/public-subscribe.dto';

function isPrismaUniqueError(e: any) {
  return e?.code === 'P2002';
}

@Injectable()
export class EmailLeadsService {
  constructor(private prisma: PrismaService) { }

  private readonly leadSelect = {
    id: true,
    organization_id: true,
    email: true,
    name: true,
    attributes: true,
    global_status: true,
  };

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
    const email = dto.email.toLowerCase().trim();

    // 0) Validar formato do e-mail
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!isValidEmail) {
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

    return { message: 'Lead subscribed successfully' };
  }

  // -------------------------
  // CRUD autenticado
  // -------------------------

  async create(organizationId: string, dto: CreateEmailLeadDto) {
    const email = dto.email.toLowerCase().trim();

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

  async update(organizationId: string, id: string, dto: UpdateEmailLeadDto) {
    const lead = await this.prisma.email_leads.findFirst({
      where: { id, organization_id: organizationId },
      select: { id: true },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name?.trim() ?? null;
    if (dto.attributes !== undefined) data.attributes = dto.attributes;

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
