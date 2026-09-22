import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { cleanEmailOrNull } from '../common/email.util';
import { QuizSplitsService } from '../quiz-splits/quiz-splits.service';
import { QuizAdsService } from './quiz-ads.service';
import { QuizLeadEmailService } from './quiz-lead-email.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';

function normalizeDomain(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:.*$/, '');
}

function slugifyName(name: string): string {
  const stripped = String(name || '')
    .normalize('NFD')
    .split('')
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code < 0x300 || code > 0x36f;
    })
    .join('');
  const base = stripped
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'quiz';
}

const quizInclude = {
  email_projects: { select: { id: true, name: true, active: true } },
};

// Sanitiza (conserta ponto duplo etc.) + valida de forma estrita. Fonte única:
// `common/email.util`. E-mail inválido/insanável -> null (não entra no sistema).
function normalizeEmail(v?: string | null): string | null {
  return cleanEmailOrNull(v);
}
function normalizePhone(v?: string | null): string | null {
  const s = String(v || '').replace(/[^\d+]/g, '');
  return s.length >= 6 ? s.slice(0, 30) : null;
}
function normalizeName(v?: string | null): string | null {
  const s = String(v || '').trim();
  return s ? s.slice(0, 255) : null;
}

@Injectable()
export class QuizzesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly splits: QuizSplitsService,
    private readonly ads: QuizAdsService,
    private readonly leadEmail: QuizLeadEmailService,
  ) {}

  // Garante que o domínio é um domínio de QUIZ cadastrado E verificado.
  private async ensureQuizDomainVerified(
    organizationId: string,
    domain: string,
  ) {
    const row = await this.prisma.webchat_domains.findFirst({
      where: { organization_id: organizationId, domain, kind: 'quiz' },
      select: { id: true, status: true },
    });
    if (!row) {
      throw new BadRequestException(
        'Domínio de quiz não cadastrado. Acesse Configurações > Conta & Domínios > Quizzes.',
      );
    }
    if (row.status !== 'VERIFIED') {
      throw new BadRequestException(
        'Domínio de quiz ainda não verificado. Verifique o DNS antes de criar o quiz.',
      );
    }
  }

  private async ensureProjectBelongsToOrg(
    organizationId: string,
    projectId: string,
  ) {
    const p = await this.prisma.email_projects.findFirst({
      where: { id: projectId, organization_id: organizationId },
      select: { id: true },
    });
    if (!p) {
      throw new BadRequestException('Projeto de e-mail inválido.');
    }
  }

  private async uniqueSlugByDomain(
    domain: string,
    base: string,
    exceptId?: string,
  ): Promise<string> {
    let slug = base;
    let i = 2;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await this.prisma.quizzes.findFirst({
        where: {
          domain,
          slug,
          ...(exceptId ? { id: { not: exceptId } } : {}),
        },
        select: { id: true },
      });
      if (!existing) return slug;
      slug = `${base}-${i}`;
      i += 1;
    }
  }

  async create(organizationId: string, dto: CreateQuizDto) {
    const domain = normalizeDomain(dto.domain);
    if (!domain) throw new BadRequestException('Domínio inválido.');
    await this.ensureQuizDomainVerified(organizationId, domain);

    if (dto.email_project_id) {
      await this.ensureProjectBelongsToOrg(organizationId, dto.email_project_id);
    }

    const slug = await this.uniqueSlugByDomain(domain, slugifyName(dto.name));
    const splitId = await this.splits.resolveSplitIdForOrg(
      organizationId,
      dto.split_id ?? null,
    );

    return this.prisma.quizzes.create({
      data: {
        organization_id: organizationId,
        name: dto.name,
        slug,
        domain,
        email_project_id: dto.email_project_id ?? null,
        active: dto.active ?? true,
        settings: (dto.settings as any) ?? undefined,
        header_scripts: dto.header_scripts ?? null,
        footer_scripts: dto.footer_scripts ?? null,
        lead_email_html: dto.lead_email_html ?? null,
        lead_email_subject: dto.lead_email_subject ?? null,
        lead_email_model: (dto.lead_email_model as any) ?? undefined,
        split_id: splitId,
        split_weight:
          typeof dto.split_weight === 'number' ? dto.split_weight : 100,
      },
      include: quizInclude,
    });
  }

  async list(organizationId: string) {
    return this.prisma.quizzes.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
      include: quizInclude,
    });
  }

  async findOne(organizationId: string, id: string) {
    const quiz = await this.prisma.quizzes.findFirst({
      where: { id, organization_id: organizationId },
      include: quizInclude,
    });
    if (!quiz) throw new NotFoundException('Quiz não encontrado.');
    return quiz;
  }

  async update(organizationId: string, id: string, dto: UpdateQuizDto) {
    const current = await this.prisma.quizzes.findFirst({
      where: { id, organization_id: organizationId },
    });
    if (!current) throw new NotFoundException('Quiz não encontrado.');

    const nextName = dto.name ?? current.name;
    const nextDomain =
      dto.domain !== undefined ? normalizeDomain(dto.domain) : current.domain;
    if (!nextDomain) throw new BadRequestException('Domínio inválido.');

    const domainChanged = nextDomain !== current.domain;
    const nameChanged = nextName !== current.name;
    if (domainChanged) {
      await this.ensureQuizDomainVerified(organizationId, nextDomain);
    }
    if (dto.email_project_id) {
      await this.ensureProjectBelongsToOrg(organizationId, dto.email_project_id);
    }

    let nextSlug = current.slug;
    if (nameChanged || domainChanged) {
      nextSlug = await this.uniqueSlugByDomain(
        nextDomain,
        slugifyName(nextName),
        current.id,
      );
    }

    let nextSplitId: string | undefined;
    if (dto.split_id !== undefined) {
      nextSplitId = await this.splits.resolveSplitIdForOrg(
        organizationId,
        dto.split_id ?? null,
      );
    }

    return this.prisma.quizzes.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.domain !== undefined ? { domain: nextDomain } : {}),
        ...(dto.email_project_id !== undefined
          ? { email_project_id: dto.email_project_id }
          : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.settings !== undefined
          ? { settings: dto.settings as any }
          : {}),
        ...(dto.header_scripts !== undefined
          ? { header_scripts: dto.header_scripts }
          : {}),
        ...(dto.footer_scripts !== undefined
          ? { footer_scripts: dto.footer_scripts }
          : {}),
        ...(dto.lead_email_html !== undefined
          ? { lead_email_html: dto.lead_email_html }
          : {}),
        ...(dto.lead_email_subject !== undefined
          ? { lead_email_subject: dto.lead_email_subject }
          : {}),
        ...(dto.lead_email_model !== undefined
          ? { lead_email_model: (dto.lead_email_model as any) }
          : {}),
        ...(nextSplitId !== undefined ? { split_id: nextSplitId } : {}),
        ...(dto.split_weight !== undefined
          ? { split_weight: dto.split_weight }
          : {}),
        ...(nameChanged || domainChanged ? { slug: nextSlug } : {}),
      },
      include: quizInclude,
    });
  }

  async remove(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    await this.prisma.quizzes.delete({ where: { id } });
    return { success: true, message: 'Quiz removido com sucesso.' };
  }

  // ===================== PÚBLICO =====================

  private async resolvePublicQuiz(slug: string, domainHint?: string) {
    const normSlug = String(slug || '').trim().toLowerCase();
    const normDomain = domainHint ? normalizeDomain(domainHint) : '';
    let quiz: any = null;
    if (normDomain) {
      quiz = await this.prisma.quizzes.findFirst({
        where: { slug: normSlug, domain: normDomain },
      });
    }
    if (!quiz) {
      quiz = await this.prisma.quizzes.findFirst({
        where: { slug: normSlug },
        orderBy: { created_at: 'asc' },
      });
    }
    if (!quiz) throw new NotFoundException('Quiz não encontrado.');
    return quiz;
  }

  // Split público: slug + membros ativos (domínio/slug/peso) p/ o front
  // re-sortear e redirecionar na entrada direta.
  private async buildPublicSplit(quiz: any) {
    const splitId = quiz?.split_id;
    if (!splitId) return null;
    const sp = await this.prisma.quiz_splits.findUnique({
      where: { id: splitId },
      select: { slug: true },
    });
    if (!sp) return null;
    const members = await this.prisma.quizzes.findMany({
      where: { split_id: splitId, active: true },
      select: { name: true, slug: true, domain: true, split_weight: true },
    });
    return {
      slug: sp.slug,
      members: members.map((m) => ({
        name: m.name,
        slug: m.slug,
        domain: m.domain,
        weight: m.split_weight ?? 0,
      })),
    };
  }

  async getPublicConfig(slug: string, domainHint?: string) {
    const quiz = await this.resolvePublicQuiz(slug, domainHint);
    const split = await this.buildPublicSplit(quiz);
    // publicOnly=true => não traz posições inativas pro front.
    const ads_config = await this.ads.readAdsConfig(
      quiz.organization_id,
      quiz.id,
      true,
    );
    return {
      id: quiz.id,
      name: quiz.name,
      slug: quiz.slug,
      domain: quiz.domain,
      active: quiz.active,
      settings: quiz.settings ?? null,
      header_scripts: quiz.header_scripts ?? null,
      footer_scripts: quiz.footer_scripts ?? null,
      has_email_project: Boolean(quiz.email_project_id),
      split,
      ads_config,
    };
  }

  async captureLead(
    slug: string,
    domainHint: string | undefined,
    dto: {
      name?: string;
      email?: string;
      phone?: string;
      source?: string;
      context?: any;
      custom_fields?: any;
    },
  ) {
    const quiz = await this.resolvePublicQuiz(slug, domainHint);
    const email = normalizeEmail(dto.email);
    const phone = normalizePhone(dto.phone);
    const name = normalizeName(dto.name);
    if (!email && !phone) {
      throw new BadRequestException(
        'Informe ao menos um e-mail ou telefone para captar o lead.',
      );
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        // Registra em quiz_leads (aparece em "Leads"), SEM duplicar: dedupe por
        // (quiz_id, e-mail) — ou (quiz_id, telefone) quando não há e-mail. Se já
        // existe, atualiza ao invés de criar uma nova linha.
        const dedupeWhere = email
          ? { quiz_id: quiz.id, email }
          : { quiz_id: quiz.id, phone };
        const existingLead = await tx.quiz_leads.findFirst({
          where: { organization_id: quiz.organization_id, ...dedupeWhere },
        });

        const lead = existingLead
          ? await tx.quiz_leads.update({
              where: { id: existingLead.id },
              data: {
                name: name ?? existingLead.name,
                email: email ?? existingLead.email,
                phone: phone ?? existingLead.phone,
                source: dto.source ?? existingLead.source ?? 'quiz',
                context: dto.context ?? existingLead.context ?? undefined,
                custom_fields:
                  dto.custom_fields ?? existingLead.custom_fields ?? undefined,
              },
            })
          : await tx.quiz_leads.create({
              data: {
                organization_id: quiz.organization_id,
                quiz_id: quiz.id,
                email,
                name,
                phone,
                source: dto.source ?? 'quiz',
                context: dto.context ?? null,
                custom_fields: dto.custom_fields ?? null,
              },
            });

        let routedTo = 'quiz_leads';

        // Se o quiz tem projeto de e-mail vinculado E temos e-mail -> roteia
        // pro email marketing (email_leads é NOT NULL/UNIQUE em email).
        if (quiz.email_project_id && email) {
          let emailLead = await tx.email_leads.findFirst({
            where: { organization_id: quiz.organization_id, email },
          });
          const attrs = {
            phone,
            source: dto.source ?? 'quiz',
            quiz_id: quiz.id,
            quiz_slug: quiz.slug,
            quiz_domain: quiz.domain,
            context: dto.context ?? null,
          };
          if (!emailLead) {
            emailLead = await tx.email_leads.create({
              data: {
                organization_id: quiz.organization_id,
                email,
                name: name ?? null,
                attributes: attrs as any,
              },
            });
          } else {
            await tx.email_leads.update({
              where: { id: emailLead.id },
              data: {
                ...(name ? { name } : {}),
                attributes: {
                  ...((emailLead.attributes as Record<string, any>) || {}),
                  ...attrs,
                } as any,
              },
            });
          }
          const rel = await tx.email_project_leads.findFirst({
            where: {
              project_id: quiz.email_project_id,
              lead_id: emailLead.id,
            },
          });
          if (!rel) {
            await tx.email_project_leads.create({
              data: {
                project_id: quiz.email_project_id,
                lead_id: emailLead.id,
                status: 'SUBSCRIBED',
              } as any,
            });
          }
          routedTo = 'email_project';
        }

        return { success: true, routed_to: routedTo, lead_id: lead.id };
      },
      { maxWait: 30_000, timeout: 30_000 },
    );

    // E-mail imediato ao lead (best-effort, fora da transação). Só dispara se
    // o quiz tem lead_email_html + projeto vinculado + e-mail do lead.
    await this.leadEmail.maybeSend(quiz, {
      email,
      name,
      attributes: {
        phone,
        source: dto.source ?? 'quiz',
        ...(dto.custom_fields && typeof dto.custom_fields === 'object'
          ? dto.custom_fields
          : {}),
      },
    });

    return result;
  }
}
