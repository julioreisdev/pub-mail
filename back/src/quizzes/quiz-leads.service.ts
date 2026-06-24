import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 200;
const EXPORT_HARD_CAP = 50000;

export type ListQuizLeadsParams = {
  organizationId: string;
  quizId?: string;
  page?: number;
  pageSize?: number;
  search?: string;
};

@Injectable()
export class QuizLeadsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(params: ListQuizLeadsParams) {
    const where: Record<string, any> = {
      organization_id: params.organizationId,
    };
    if (params.quizId) where.quiz_id = params.quizId;
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

  private toRow(record: any) {
    const quiz = record?.quizzes || {};
    return {
      id: record.id,
      quiz_id: record.quiz_id,
      quiz_name: quiz.name || '',
      quiz_slug: quiz.slug || '',
      quiz_domain: quiz.domain || '',
      email: record.email,
      name: record.name,
      phone: record.phone,
      source: record.source,
      context: record.context ?? null,
      custom_fields: record.custom_fields ?? null,
      created_at: record.created_at,
      updated_at: record.updated_at,
    };
  }

  async list(params: ListQuizLeadsParams) {
    const page = Math.max(1, Math.floor(Number(params.page) || 1));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.floor(Number(params.pageSize) || DEFAULT_PAGE_SIZE)),
    );
    const where = this.buildWhere(params);

    const [total, rows] = await Promise.all([
      this.prisma.quiz_leads.count({ where }),
      this.prisma.quiz_leads.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          quizzes: { select: { id: true, name: true, slug: true, domain: true } },
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

  async listAllForExport(params: Omit<ListQuizLeadsParams, 'page' | 'pageSize'>) {
    const where = this.buildWhere(params);
    const total = await this.prisma.quiz_leads.count({ where });
    if (total > EXPORT_HARD_CAP) {
      throw new BadRequestException(
        `Exportação excede o limite de ${EXPORT_HARD_CAP.toLocaleString('pt-BR')} leads. Refine o filtro.`,
      );
    }
    const rows = await this.prisma.quiz_leads.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        quizzes: { select: { id: true, name: true, slug: true, domain: true } },
      },
    });
    return { items: rows.map((r: any) => this.toRow(r)), total: rows.length };
  }
}
