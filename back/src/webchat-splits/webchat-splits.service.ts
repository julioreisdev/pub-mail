import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function slugify(value: string): string {
  // Remove acentos (marcas combinantes U+0300–U+036F) sem usar literal no regex.
  const stripped = String(value || '')
    .normalize('NFD')
    .split('')
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code < 0x300 || code > 0x36f;
    })
    .join('');
  return (
    stripped
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120) || 'split'
  );
}

@Injectable()
export class WebchatSplitsService {
  constructor(private prisma: PrismaService) {}

  // Slug é único GLOBAL (o link do split fica na plataforma).
  private async uniqueSlug(base: string, excludeId?: string): Promise<string> {
    let slug = base;
    let i = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await this.prisma.webchat_splits.findUnique({
        where: { slug },
      });
      if (!existing || existing.id === excludeId) return slug;
      i += 1;
      slug = `${base}-${i}`;
    }
  }

  async ensureDefaultSplit(organizationId: string) {
    const existing = await this.prisma.webchat_splits.findFirst({
      where: { organization_id: organizationId, is_default: true },
    });
    if (existing) return existing;
    const slug = await this.uniqueSlug('padrao');
    return this.prisma.webchat_splits.create({
      data: {
        organization_id: organizationId,
        name: 'Padrão',
        slug,
        is_default: true,
      },
    });
  }

  async list(organizationId: string) {
    await this.ensureDefaultSplit(organizationId);
    const splits = await this.prisma.webchat_splits.findMany({
      where: { organization_id: organizationId },
      orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        is_default: true,
        _count: { select: { webchats: true } },
      },
    });
    return splits.map((s: any) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      is_default: s.is_default,
      webchats_count: s._count?.webchats ?? 0,
    }));
  }

  async create(organizationId: string, name: string) {
    const clean = String(name || '').trim();
    if (!clean) throw new BadRequestException('Nome do split é obrigatório.');
    const slug = await this.uniqueSlug(slugify(clean));
    return this.prisma.webchat_splits.create({
      data: {
        organization_id: organizationId,
        name: clean,
        slug,
        is_default: false,
      },
    });
  }

  // Renomeia E re-gera o slug a partir do novo nome (mantém único global).
  async update(organizationId: string, id: string, name: string) {
    const split = await this.prisma.webchat_splits.findFirst({
      where: { id, organization_id: organizationId },
    });
    if (!split) throw new NotFoundException('Split não encontrado.');
    const clean = String(name || '').trim();
    if (!clean) throw new BadRequestException('Nome do split é obrigatório.');
    const slug = await this.uniqueSlug(slugify(clean), id);
    return this.prisma.webchat_splits.update({
      where: { id },
      data: { name: clean, slug },
    });
  }

  async remove(organizationId: string, id: string) {
    const split = await this.prisma.webchat_splits.findFirst({
      where: { id, organization_id: organizationId },
      include: { _count: { select: { webchats: true } } },
    });
    if (!split) throw new NotFoundException('Split não encontrado.');
    if (split.is_default) {
      throw new BadRequestException('O split padrão não pode ser apagado.');
    }
    if (((split as any)._count?.webchats ?? 0) > 0) {
      throw new BadRequestException(
        'Mova ou apague os webchats deste split antes de apagá-lo.',
      );
    }
    await this.prisma.webchat_splits.delete({ where: { id } });
    return { id, deleted: true };
  }

  // Usado pelo create/update de webchat: valida o split solicitado (mesma org)
  // ou cai no split padrão.
  async resolveSplitIdForOrg(
    organizationId: string,
    requestedSplitId?: string | null,
  ): Promise<string> {
    if (requestedSplitId) {
      const s = await this.prisma.webchat_splits.findFirst({
        where: { id: requestedSplitId, organization_id: organizationId },
      });
      if (!s) throw new BadRequestException('Split inválido.');
      return s.id;
    }
    const def = await this.ensureDefaultSplit(organizationId);
    return def.id;
  }

  // Público: resolve por slug global e devolve os membros ativos do split.
  async getPublicSplitBySlug(slug: string) {
    const normalized = String(slug || '')
      .trim()
      .toLowerCase();
    const split = await this.prisma.webchat_splits.findUnique({
      where: { slug: normalized },
    });
    if (!split) throw new NotFoundException('Split não encontrado.');
    const webchats = await this.prisma.webchats.findMany({
      where: { split_id: split.id, active: true },
      select: { name: true, slug: true, domain: true, split_weight: true },
    });
    return {
      name: split.name,
      slug: split.slug,
      members: webchats.map((w) => ({
        name: w.name,
        slug: w.slug,
        domain: w.domain,
        weight: w.split_weight ?? 0,
      })),
    };
  }
}
