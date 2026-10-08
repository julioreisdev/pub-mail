import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';

// Ponto único de emissão em tempo real (Socket.IO). Os serviços de domínio chamam
// `toModule(orgId, 'whatsapp', evento, payload)` (sala do módulo na org) ou
// `toSession(orgId, 'whatsapp', sessionId, evento, payload)` (sala de UM número do WhatsApp —
// só quem tem acesso àquele número entra nela; ver RealtimeGateway).
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private server: Server | null = null;

  attach(server: Server) {
    this.server = server;
  }

  static room(orgId: string, module?: string) {
    return module ? `m:${module}:${orgId}` : `org:${orgId}`;
  }

  /** Sala de um número (sessão) de um módulo: `s:<módulo>:<org>:<sessionId>`. */
  static sessionRoom(orgId: string, module: string, sessionId: string) {
    return `s:${module}:${orgId}:${sessionId}`;
  }

  /** Sala de UM usuário (todas as conexões dele): `u:<org>:<userId>` — chat da equipe, avisos pessoais. */
  static userRoom(orgId: string, userId: string) {
    return `u:${orgId}:${userId}`;
  }

  toUser(orgId: string, userId: string, event: string, payload: unknown) {
    if (!this.server || !orgId || !userId) return;
    try {
      this.server.to(RealtimeService.userRoom(orgId, userId)).emit(event, payload);
    } catch (e: any) {
      this.logger.debug(`emit ${event} (usuário) falhou: ${e?.message || e}`);
    }
  }

  /** Quantas conexões estão ouvindo aquele módulo na org (0 = ninguém olhando). */
  watchers(orgId: string, module = 'whatsapp') {
    try {
      return this.server?.sockets?.adapter?.rooms?.get(RealtimeService.room(orgId, module))?.size || 0;
    } catch {
      return 0;
    }
  }

  /** Ids dos usuários com alguma conexão aberta naquele módulo da org (= "online" no painel). */
  onlineUserIds(orgId: string, module = 'whatsapp'): string[] {
    try {
      const ids = this.server?.sockets?.adapter?.rooms?.get(RealtimeService.room(orgId, module));
      if (!ids) return [];
      const out = new Set<string>();
      for (const sid of ids) {
        const u = this.server?.sockets?.sockets?.get(sid)?.data?.user;
        if (u?.userId) out.add(String(u.userId));
      }
      return [...out];
    } catch {
      return [];
    }
  }

  /** Hashes de endpoint de push dos aparelhos deste usuário que estão com o painel aberto (vêm no handshake). */
  onlinePushHashes(orgId: string, userId: string): Set<string> {
    const out = new Set<string>();
    try {
      const ids = this.server?.sockets?.adapter?.rooms?.get(RealtimeService.userRoom(orgId, userId));
      if (!ids) return out;
      for (const sid of ids) {
        const h = this.server?.sockets?.sockets?.get(sid)?.data?.user?.pushHash;
        if (h) out.add(String(h));
      }
    } catch {
      /* best-effort */
    }
    return out;
  }

  toModule(orgId: string, module: string, event: string, payload: unknown) {
    if (!this.server || !orgId) return;
    try {
      this.server.to(RealtimeService.room(orgId, module)).emit(event, payload);
    } catch (e: any) {
      this.logger.debug(`emit ${event} falhou: ${e?.message || e}`);
    }
  }

  toSession(orgId: string, module: string, sessionId: string, event: string, payload: unknown) {
    if (!this.server || !orgId || !sessionId) return;
    try {
      this.server.to(RealtimeService.sessionRoom(orgId, module, sessionId)).emit(event, payload);
    } catch (e: any) {
      this.logger.debug(`emit ${event} (sessão) falhou: ${e?.message || e}`);
    }
  }

  toOrg(orgId: string, event: string, payload: unknown) {
    if (!this.server || !orgId) return;
    try {
      this.server.to(RealtimeService.room(orgId)).emit(event, payload);
    } catch {
      /* best-effort */
    }
  }

  /**
   * Recoloca as conexões de um usuário nas salas de número (quando o admin muda os números
   * liberados). `sessionIds` = null → todos os números da org.
   */
  resubscribeSessions(userId: string, orgId: string, module: string, allIds: string[], allowed: Set<string> | null) {
    if (!this.server) return;
    try {
      for (const sock of this.server.sockets.sockets.values()) {
        const u = sock.data?.user;
        if (!u || String(u.userId) !== userId || String(u.orgId) !== orgId) continue;
        for (const room of [...sock.rooms]) if (room.startsWith(`s:${module}:${orgId}:`)) sock.leave(room);
        const ids = allIds.filter((id) => allowed === null || allowed.has(id));
        for (const id of ids) sock.join(RealtimeService.sessionRoom(orgId, module, id));
        // mantém o socket coerente: número criado depois entra na sala de quem vê todos (joinNewSession lê waAll)
        if (module === 'whatsapp') {
          u.waAll = allowed === null;
          u.waSessions = ids;
        }
        sock.emit('access_changed', { module, whatsapp_sessions: allowed === null ? null : ids, at: new Date().toISOString() });
      }
    } catch (e: any) {
      this.logger.debug(`resubscribe falhou: ${e?.message || e}`);
    }
  }

  /** Número novo criado na org: quem vê todos os números entra na sala dele na hora. */
  joinNewSession(orgId: string, module: string, sessionId: string) {
    if (!this.server) return;
    try {
      for (const sock of this.server.sockets.sockets.values()) {
        const u = sock.data?.user;
        if (!u || String(u.orgId) !== orgId) continue;
        if (u.waAll === true) sock.join(RealtimeService.sessionRoom(orgId, module, sessionId));
      }
    } catch {
      /* best-effort */
    }
  }
}
