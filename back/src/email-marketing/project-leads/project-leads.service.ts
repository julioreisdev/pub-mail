import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 200;
const EXPORT_HARD_CAP = 50000;

export type ListProjectLeadsParams = {
  organizationId: string;
  projectId?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  engagement?: string; // clicked | opened | none
  source?: string;
  tag?: string;
  dateFrom?: string;
  dateTo?: string;
};

// Lista os leads de um PROJETO de e-mail (tabela pivô email_project_leads +
// email_leads). Inclui tanto os leads captados pelo formulário/API nativos
// quanto os que vieram de quizzes/webchats vinculados ao projeto (que são
// roteados pra cá no momento da captação).
@Injectable()
export class EmailProjectLeadsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(params: ListProjectLeadsParams) {
    const where: Record<string, any> = {
      projects: { organization_id: params.organizationId },
    };
    if (params.projectId) where.project_id = params.projectId;

    // filtros no lead (busca + source + tag)
    const leadWhere: Record<string, any> = {};
    const search = String(params.search || '').trim();
    if (search) {
      leadWhere.OR = [
        { email: { contains: search } },
        { name: { contains: search } },
      ];
    }
    const source = String(params.source || '').trim();
    if (source) {
      leadWhere.attributes = { path: '$.source', equals: source };
    }
    const tag = String(params.tag || '').trim();
    if (tag) {
      leadWhere.tags = { array_contains: tag };
    }
    if (Object.keys(leadWhere).length > 0) where.leads = leadWhere;

    // engajamento (na pivô metrics)
    const eng = String(params.engagement || '').trim();
    if (eng === 'clicked') {
      where.metrics = { path: '$.last_click_cta', not: Prisma.DbNull };
    } else if (eng === 'opened') {
      where.AND = [
        { metrics: { path: '$.last_open', not: Prisma.DbNull } },
        { metrics: { path: '$.last_click_cta', equals: Prisma.DbNull } },
      ];
    } else if (eng === 'none') {
      where.AND = [
        { metrics: { path: '$.last_open', equals: Prisma.DbNull } },
        { metrics: { path: '$.last_click_cta', equals: Prisma.DbNull } },
      ];
    }

    // período de captação (created_at da pivô)
    const range: Record<string, any> = {};
    if (params.dateFrom) {
      const d = new Date(params.dateFrom);
      if (!isNaN(d.getTime())) range.gte = d;
    }
    if (params.dateTo) {
      const d = new Date(params.dateTo);
      if (!isNaN(d.getTime())) range.lte = d;
    }
    if (Object.keys(range).length > 0) where.created_at = range;

    return where;
  }

  private toRow(record: any) {
    const lead = record?.leads || {};
    const attrs =
      lead.attributes && typeof lead.attributes === 'object'
        ? lead.attributes
        : {};
    const metrics =
      record.metrics && typeof record.metrics === 'object' ? record.metrics : {};

    const lastOpen = metrics.last_open || null;
    const lastClick = metrics.last_click_cta || null;
    // maior timestamp entre abertura e clique
    const lastInteraction =
      lastOpen && lastClick
        ? lastOpen > lastClick
          ? lastOpen
          : lastClick
        : lastOpen || lastClick || null;
    // clicou > abriu > nunca interagiu
    const engagement = lastClick ? 'clicked' : lastOpen ? 'opened' : 'none';

    return {
      // id composto (a pivô é project+lead), útil como key no front
      id: `${record.project_id}:${record.lead_id}`,
      lead_id: lead.id,
      email: lead.email,
      name: lead.name,
      phone: attrs.phone || null,
      source: attrs.source || 'formulário',
      status: record.status,
      global_status: lead.global_status || 'ACTIVE',
      suppressed: lead.global_status === 'BOUNCED' || lead.global_status === 'COMPLAINED',
      project_id: record.project_id,
      project_name: record.projects?.name || '',
      tags: Array.isArray(lead.tags) ? lead.tags : [],
      last_open: lastOpen,
      last_click_cta: lastClick,
      last_interaction: lastInteraction,
      engagement,
      created_at: record.created_at,
      updated_at: record.updated_at,
    };
  }

  async list(params: ListProjectLeadsParams) {
    const page = Math.max(1, Math.floor(Number(params.page) || 1));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.floor(Number(params.pageSize) || DEFAULT_PAGE_SIZE)),
    );
    const where = this.buildWhere(params);

    const [total, rows] = await Promise.all([
      this.prisma.email_project_leads.count({ where }),
      this.prisma.email_project_leads.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          leads: true,
          projects: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      items: rows.map((r: any) => this.toRow(r)),
      total,
      page,
      page_size: pageSize,
      total_pages: pageSize > 0 ? Math.ceil(total / pageSize) : 1,
    };
  }

  async listAllForExport(params: Omit<ListProjectLeadsParams, 'page' | 'pageSize'>) {
    const where = this.buildWhere(params);
    const total = await this.prisma.email_project_leads.count({ where });
    if (total > EXPORT_HARD_CAP) {
      throw new BadRequestException(
        `Exportação excede o limite de ${EXPORT_HARD_CAP.toLocaleString('pt-BR')} leads. Refine o filtro (ex.: filtre por projeto).`,
      );
    }
    const rows = await this.prisma.email_project_leads.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        leads: true,
        projects: { select: { id: true, name: true } },
      },
    });
    return { items: rows.map((r: any) => this.toRow(r)), total: rows.length };
  }
}
