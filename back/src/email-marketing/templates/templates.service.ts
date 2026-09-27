import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { encodeWebhookUrls } from '../../common/cta-url.util';
import { CreateEmailTemplateDto } from './dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';

@Injectable()
export class EmailTemplatesService {
  constructor(private prisma: PrismaService) {}

  private readonly templateSelect = {
    id: true,
    project_id: true,
    name: true,
    subject: true,
    body_html: true,
    body_text: true,
    builder_model: true,
    recycle: true,
  };

  /**
   * 🛡️ Codifica a URL de destino dos CTAs rastreados antes de salvar.
   * Implementação compartilhada em common/cta-url.util (também usada por
   * passos do fluxo inicial e reciclagem).
   */
  private encodeWebhookUrls(html: string): string {
    return encodeWebhookUrls(html);
  }

  async create(
    organizationId: string,
    projectId: string,
    dto: CreateEmailTemplateDto,
  ) {
    const project = await this.prisma.email_projects.findFirst({
      where: { id: projectId, organization_id: organizationId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const hasHtml = !!dto.body_html?.trim();
    const hasText = !!dto.body_text?.trim();

    // regra: pode enviar só um, mas não pode enviar nenhum
    if (!hasHtml && !hasText) {
      throw new BadRequestException('body_html or body_text is required');
    }

    // Processa o HTML interceptando e encodando os links de CTA antes de salvar
    const processedHtml = hasHtml
      ? this.encodeWebhookUrls(dto.body_html!.trim())
      : '';

    return this.prisma.email_templates.create({
      data: {
        project_id: projectId,
        name: dto.name.trim(),
        subject: dto.subject.trim(),
        body_html: processedHtml,
        body_text: hasText ? dto.body_text!.trim() : '',
        builder_model: (dto.builder_model as any) ?? undefined,
        recycle: Boolean(dto.recycle),
      },
      select: this.templateSelect,
    });
  }

  async list(organizationId: string, projectId: string, recycle = false) {
    const project = await this.prisma.email_projects.findFirst({
      where: { id: projectId, organization_id: organizationId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    return this.prisma.email_templates.findMany({
      where: { project_id: projectId, recycle: Boolean(recycle) },
      orderBy: { name: 'asc' },
      select: this.templateSelect,
    });
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateEmailTemplateDto,
  ) {
    // garante que o template pertence a um projeto da org
    const template = await this.prisma.email_templates.findFirst({
      where: { id, projects: { organization_id: organizationId } },
      select: {
        id: true,
        body_html: true,
        body_text: true,
      },
    });
    if (!template) throw new NotFoundException('Template not found');

    /**
     * Intercepta o update do HTML para garantir que qualquer
     * link de CTA atualizado seja devidamente encodado.
     */
    const nextHtml =
      dto.body_html !== undefined
        ? dto.body_html?.trim()
          ? this.encodeWebhookUrls(dto.body_html.trim())
          : ''
        : undefined;

    const nextText =
      dto.body_text !== undefined
        ? dto.body_text?.trim()
          ? dto.body_text.trim()
          : ''
        : undefined;

    // regra: depois do update, precisa continuar tendo pelo menos 1 (html ou text)
    const finalHtml =
      nextHtml !== undefined ? nextHtml : (template.body_html ?? '');
    const finalText =
      nextText !== undefined ? nextText : (template.body_text ?? '');

    const hasFinalHtml = !!finalHtml.trim();
    const hasFinalText = !!finalText.trim();

    if (!hasFinalHtml && !hasFinalText) {
      throw new BadRequestException('body_html or body_text is required');
    }

    return this.prisma.email_templates.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.subject !== undefined ? { subject: dto.subject.trim() } : {}),
        ...(nextHtml !== undefined ? { body_html: nextHtml } : {}),
        ...(nextText !== undefined ? { body_text: nextText } : {}),
        ...(dto.builder_model !== undefined ? { builder_model: (dto.builder_model as any) } : {}),
      },
      select: this.templateSelect,
    });
  }

  async remove(organizationId: string, id: string) {
    const template = await this.prisma.email_templates.findFirst({
      where: { id, projects: { organization_id: organizationId } },
      select: { id: true },
    });
    if (!template) throw new NotFoundException('Template not found');

    await this.prisma.email_templates.delete({ where: { id } });
    return { message: 'Template removed' };
  }
}
