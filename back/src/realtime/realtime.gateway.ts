import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../platform-billing/access.service';
import { MODULES } from '../platform-billing/modules.const';
import { RealtimeService } from './realtime.service';

// WebSocket do painel (Socket.IO em /realtime). O navegador conecta com o access token
// (`auth.token`); o token é validado no handshake e a conexão entra nas salas:
//   org:<org>                     — avisos da organização
//   m:<módulo>:<org>              — um por módulo liberado ao usuário (SUPER_ADMIN: todos)
//   s:whatsapp:<org>:<sessionId>  — um por NÚMERO do WhatsApp que o usuário pode ver
//                                   (users.whatsapp_sessions; null/dono/admin = todos)
// Só o servidor emite; o cliente não manda comandos (por isso não há guards de mensagem).
// Token expirado → o cliente reconecta com o token novo (renovado pelo api.js).
@WebSocketGateway({
  path: '/realtime',
  cors: { origin: true, credentials: false },
  transports: ['websocket', 'polling'],
  pingInterval: 25_000,
  pingTimeout: 20_000,
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly jwt = new JwtService({});
  @WebSocketServer() server!: Server;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(server: Server) {
    this.realtime.attach(server);
    server.use((socket, next) => {
      this.authenticate(socket)
        .then((ok) => (ok ? next() : next(new Error('unauthorized'))))
        .catch(() => next(new Error('unauthorized')));
    });
    this.logger.log('WebSocket /realtime pronto');
  }

  private async authenticate(socket: Socket) {
    const raw = String((socket.handshake.auth as any)?.token || '').replace(/^Bearer\s+/i, '').trim();
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!raw || !secret) return false;
    let payload: any;
    try {
      payload = this.jwt.verify(raw, { secret });
    } catch {
      return false;
    }
    if (!payload?.sub || !payload?.org) return false;
    const user = await this.prisma.users.findFirst({
      where: { id: String(payload.sub), organization_id: String(payload.org) },
      select: { active: true, role: true, whatsapp_sessions: true, organizations: { select: { status: true } } },
    });
    if (!user?.active || user.organizations?.status === false) return false;
    const role = String(user.role || payload.role || '');
    let modules: string[] = [];
    if (role === 'SUPER_ADMIN') modules = [...MODULES];
    else {
      const active = await this.access.isOrgActive(String(payload.org)).catch(() => false);
      modules = active ? ((await this.access.getUserModules(String(payload.sub)).catch(() => [])) as string[]) : [];
    }
    // números do WhatsApp que esta conexão pode ouvir
    let waSessions: string[] = [];
    let waAll = false;
    if (modules.includes('whatsapp')) {
      const admin = ['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(role);
      const allowed = admin || !Array.isArray(user.whatsapp_sessions) ? null : new Set((user.whatsapp_sessions as any[]).map(String));
      const rows = await this.prisma.whatsapp_sessions.findMany({ where: { organization_id: String(payload.org) }, select: { id: true } }).catch(() => []);
      waAll = allowed === null;
      waSessions = rows.map((r) => r.id).filter((id) => allowed === null || allowed.has(id));
    }
    socket.data.user = { userId: String(payload.sub), orgId: String(payload.org), role, modules, waSessions, waAll };
    return true;
  }

  handleConnection(socket: Socket) {
    const u = socket.data?.user;
    if (!u) {
      socket.disconnect(true);
      return;
    }
    socket.join(RealtimeService.room(u.orgId));
    socket.join(RealtimeService.userRoom(u.orgId, u.userId)); // chat da equipe / avisos pessoais
    socket.join(RealtimeService.room(u.orgId, 'team')); // presença (online) no chat da equipe
    for (const m of u.modules || []) socket.join(RealtimeService.room(u.orgId, m));
    for (const sid of u.waSessions || []) socket.join(RealtimeService.sessionRoom(u.orgId, 'whatsapp', sid));
    socket.emit('ready', { modules: u.modules, whatsapp_sessions: u.waAll ? null : u.waSessions, at: new Date().toISOString() });
  }

  handleDisconnect() {
    /* salas são limpas pelo próprio Socket.IO */
  }
}
