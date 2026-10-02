import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';

// Ponto único de emissão em tempo real (Socket.IO). Os serviços de domínio chamam
// `toModule(orgId, 'whatsapp', evento, payload)`; só recebe quem está na sala daquele
// módulo naquela org (entrada controlada no handshake, ver RealtimeGateway).
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

  toModule(orgId: string, module: string, event: string, payload: unknown) {
    if (!this.server || !orgId) return;
    try {
      this.server.to(RealtimeService.room(orgId, module)).emit(event, payload);
    } catch (e: any) {
      this.logger.debug(`emit ${event} falhou: ${e?.message || e}`);
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
}
