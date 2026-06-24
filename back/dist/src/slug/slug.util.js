"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildBaseSlugFromWebchatName = buildBaseSlugFromWebchatName;
exports.ensureUniqueSlugByDomain = ensureUniqueSlugByDomain;
function buildBaseSlugFromWebchatName(webchatName) {
    const normalized = String(webchatName || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || 'webchat';
}
async function ensureUniqueSlugByDomain(prisma, domain, baseSlug, exceptWebchatId) {
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
        if (!existing)
            return slug;
        slug = `${baseSlug}-${i}`;
        i += 1;
    }
}
//# sourceMappingURL=slug.util.js.map