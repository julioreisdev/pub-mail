import { PrismaService } from '../prisma/prisma.service';
export declare function buildBaseSlugFromWebchatName(webchatName: string): string;
export declare function ensureUniqueSlugByDomain(prisma: PrismaService, domain: string, baseSlug: string, exceptWebchatId?: string): Promise<string>;
