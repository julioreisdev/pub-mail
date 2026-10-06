import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ============================================================================
// Acesso por NÚMERO (sessão) dentro do módulo WhatsApp.
//  - `users.whatsapp_sessions` = ids dos números liberados para o usuário; `null` = todos.
//  - OWNER / ADMIN / SUPER_ADMIN sempre veem todos os números da organização.
//  - Toda rota por conversa/número confere aqui (403 quando o número não é do usuário;
//    conversa de número alheio responde 404 — não revela que existe).
// Cache de 60 s por usuário (invalidado pelo admin ao salvar o usuário).
// ============================================================================

export type WaUser = { userId: string; organizationId: string; role?: string };
const TTL_MS = 60_000;

@Injectable()
export class WaAccessService {
  private readonly logger = new Logger(WaAccessService.name);
  private readonly cache = new Map<string, { at: number; ids: Set<string> | null }>();

  constructor(private readonly prisma: PrismaService) {}

  invalidate(userId: string) {
    this.cache.delete(userId);
  }

  static isAdmin(role?: string | null) {
    return role === 'OWNER' || role === 'ADMIN' || role === 'SUPER_ADMIN';
  }

  /** Ids permitidos ao usuário (null = todos os números da organização). */
  async allowedIds(user: WaUser): Promise<Set<string> | null> {
    if (!user?.userId) return new Set();
    if (WaAccessService.isAdmin(user.role)) return null;
    const c = this.cache.get(user.userId);
    if (c && Date.now() - c.at < TTL_MS) return c.ids;
    let ids: Set<string> | null = null;
    try {
      const u = await this.prisma.users.findUnique({ where: { id: user.userId }, select: { role: true, whatsapp_sessions: true } });
      if (WaAccessService.isAdmin(u?.role)) ids = null;
      else if (Array.isArray(u?.whatsapp_sessions)) ids = new Set((u!.whatsapp_sessions as any[]).map(String));
      else ids = null; // sem restrição cadastrada = todos
    } catch (e: any) {
      this.logger.warn(`users.whatsapp_sessions read falhou user=${user.userId}: ${e?.message || e}`);
      return c ? c.ids : new Set();
    }
    this.cache.set(user.userId, { at: Date.now(), ids });
    return ids;
  }

  async canUse(user: WaUser, sessionId: string | null | undefined) {
    if (!sessionId) return false;
    const ids = await this.allowedIds(user);
    return ids === null || ids.has(String(sessionId));
  }

  /** 403 quando o número não está liberado para o usuário. */
  async assertSession(user: WaUser, sessionId: string | null | undefined) {
    if (!(await this.canUse(user, sessionId))) throw new ForbiddenException('Você não tem acesso a esse número do WhatsApp.');
  }

  /** Conversa de número alheio: 404 (igual a conversa inexistente). */
  async assertChat(user: WaUser, chat: { session_id: string } | null | undefined) {
    if (!chat) throw new NotFoundException('Conversa não encontrada.');
    if (!(await this.canUse(user, chat.session_id))) throw new NotFoundException('Conversa não encontrada.');
  }

  /** Filtra uma lista de ids de sessão pelo que o usuário pode ver. */
  async filterIds(user: WaUser, ids: string[]) {
    const allowed = await this.allowedIds(user);
    return allowed === null ? ids : ids.filter((id) => allowed.has(id));
  }

  /** Cláusula Prisma `session_id` para listagens (undefined = sem restrição). */
  async sessionWhere(user: WaUser, sessionId?: string | null): Promise<{ session_id?: any } | null> {
    const allowed = await this.allowedIds(user);
    if (sessionId) {
      if (allowed !== null && !allowed.has(String(sessionId))) return null; // número alheio → vazio
      return { session_id: String(sessionId) };
    }
    if (allowed === null) return {};
    if (!allowed.size) return null;
    return { session_id: { in: [...allowed] } };
  }
}
