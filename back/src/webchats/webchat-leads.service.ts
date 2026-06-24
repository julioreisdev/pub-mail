import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 200;
const EXPORT_HARD_CAP = 50000; // sanity cap pra não estourar memória/timeout

export type ListLeadsParams = {
  organizationId: string;
  webchatId?: string;
  page?: number;
  pageSize?: number;
  search?: string;
};

export type LeadRow = {
  id: string;
  webchat_id: string;
  webchat_name: string;
  webchat_slug: string;
  webchat_domain: string;
  email: string;
  name: string | null;
  phone: string | null;
  source: string | null;
  session_id: string | null;
  context: any;
  custom_fields: any;
  created_at: Date;
  updated_at: Date;
};

@Injectable()
export class WebchatLeadsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(params: ListLeadsParams) {
    const where: Record<string, any> = {
      organization_id: params.organizationId,
    };
    if (params.webchatId) where.webchat_id = params.webchatId;

    const search = String(params.search || '').trim();
    if (search) {
      where.OR = [
        { email: { contains: search } },
        { name: { contains: search } },
        { phone: { contains: search } },
      ];
    }
    return where;
  }

  private toRow(record: any): LeadRow {
    const webchat = record?.webchats || {};
    return {
      id: record.id,
      webchat_id: record.webchat_id,
      webchat_name: webchat.name || '',
      webchat_slug: webchat.slug || '',
      webchat_domain: webchat.domain || '',
      email: record.email,
      name: record.name,
      phone: record.phone,
      source: record.source,
      session_id: record.session_id,
      context: record.context ?? null,
      custom_fields: record.custom_fields ?? null,
      created_at: record.created_at,
      updated_at: record.updated_at,
    };
  }

  async list(params: ListLeadsParams) {
    const page = Math.max(1, Math.floor(Number(params.page) || 1));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.floor(Number(params.pageSize) || DEFAULT_PAGE_SIZE)),
    );
    const where = this.buildWhere(params);

    const [total, rows] = await Promise.all([
      this.prisma.webchat_leads.count({ where }),
      this.prisma.webchat_leads.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          webchats: {
            select: { id: true, name: true, slug: true, domain: true },
          },
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

  async listAllForExport(params: Omit<ListLeadsParams, 'page' | 'pageSize'>) {
    const where = this.buildWhere(params);

    const total = await this.prisma.webchat_leads.count({ where });
    if (total > EXPORT_HARD_CAP) {
      throw new BadRequestException(
        `Exportação excede o limite de ${EXPORT_HARD_CAP.toLocaleString('pt-BR')} leads. Refine o filtro (ex.: filtre por webchat).`,
      );
    }

    const rows = await this.prisma.webchat_leads.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        webchats: {
          select: { id: true, name: true, slug: true, domain: true },
        },
      },
    });

    return {
      items: rows.map((r: any) => this.toRow(r)),
      total: rows.length,
    };
  }
}
