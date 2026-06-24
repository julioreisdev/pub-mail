import { PrismaService } from '../prisma/prisma.service';

export function buildBaseSlugFromWebchatName(webchatName: string) {
  const normalized = String(webchatName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'webchat';
}

export async function ensureUniqueSlugByDomain(
  prisma: PrismaService,
  domain: string,
  baseSlug: string,
  exceptWebchatId?: string,
) {
  let slug = baseSlug;
  let i = 2;

  while (true) {
    const existing = await prisma.webchats.findFirst({
      where: {
        domain,
        slug,
        ...(exceptWebchatId ? { id: { not: exceptWebchatId } } : {}),
      },
      select: { id: true },
    });

    if (!existing) return slug;
    slug = `${baseSlug}-${i}`;
    i += 1;
  }
}
