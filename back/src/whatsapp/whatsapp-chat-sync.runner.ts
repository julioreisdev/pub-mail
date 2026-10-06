import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../platform-billing/access.service';
import { OpenWaClient } from './openwa.client';
import { WhatsAppPresenter } from './whatsapp-presenter.service';
import { WhatsAppInboundService } from './whatsapp-inbound.service';
import { WhatsAppContactsService } from './whatsapp-contacts.service';
import { normJid, phoneFromJid } from './wa-jid.util';

// Sincroniza "lidas/não lidas" e as marcações (arquivada, fixada, silenciada) com o celular,
// NÚMERO A NÚMERO. O OpenWA não avisa quando o usuário lê uma conversa no celular, então
// conferimos a lista de conversas do gateway (unreadCount é a verdade dele no whatsapp-web.js):
//   - a cada 20 s quando alguém da org está com o painel aberto (WebSocket conectado);
//   - a cada 3 min quando ninguém está olhando.
// Só grava e emite o que mudou. Conversa individual é casada pelo id canônico do motor.
const FAST_MS = 20_000;
const SLOW_MS = 180_000;

@Injectable()
export class WhatsAppChatSyncRunner implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppChatSyncRunner.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly lastRun = new Map<string, number>(); // por número

  constructor(
    private readonly prisma: PrismaService,
    private readonly openwa: OpenWaClient,
    private readonly access: AccessService,
    private readonly presenter: WhatsAppPresenter,
    private readonly inbound: WhatsAppInboundService,
    private readonly contacts: WhatsAppContactsService,
  ) {}
  private readonly lastResolve = new Map<string, number>();

  // Baileys: as não lidas do gateway não servem (ver inbound.recomputeUnread). Na 1ª passada
  // de cada número neste processo, recalcula as conversas que estão marcadas com não lidas.
  private readonly recomputed = new Set<string>();
  private async recomputeAll(orgId: string, sessionId: string) {
    if (this.recomputed.has(sessionId)) return;
    this.recomputed.add(sessionId);
    const chats = await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, session_id: sessionId, unread_count: { gt: 0 } }, select: { chat_id: true } });
    let fixed = 0;
    for (const c of chats) {
      const n = await this.inbound.recomputeUnread(orgId, sessionId, c.chat_id).catch(() => -1);
      if (n === 0) fixed++;
    }
    if (chats.length) this.logger.log(`não lidas recalculadas número=${sessionId}: ${chats.length} conversas, ${fixed} zeradas`);
  }

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), 10_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running || !this.openwa.configured) return;
    this.running = true;
    try {
      const rows = await this.prisma.whatsapp_sessions.findMany({ where: { openwa_session_id: { not: null }, status: 'ready' } });
      const now = Date.now();
      for (const row of rows) {
        const every = this.presenter.watching(row.organization_id) ? FAST_MS : SLOW_MS;
        if (now - (this.lastRun.get(row.id) || 0) < every) continue;
        this.lastRun.set(row.id, now);
        if (!(await this.access.isOrgActive(row.organization_id).catch(() => false))) continue;
        await this.syncRow(row).catch((e) => this.logger.debug(`chat-sync número=${row.id}: ${e?.message || e}`));
      }
    } finally {
      this.running = false;
    }
  }

  async syncRow(row: any) {
    const orgId = row.organization_id as string;
    const sessionId = row.id as string;
    const localUnread = row.engine === 'baileys';
    if (localUnread) await this.recomputeAll(orgId, sessionId);
    this.openwa.remember(row.openwa_session_id, row.engine);
    const list: any[] = await this.openwa.listChats(row.openwa_session_id, 1000, 0);
    if (!Array.isArray(list) || !list.length) return { changed: 0 };
    // Baileys: @lid soltos (histórico antigo) são unificados com a conversa do telefone (1ª passada e a cada 10 min)
    if (localUnread && Date.now() - (this.lastResolve.get(sessionId) || 0) > 10 * 60_000) {
      this.lastResolve.set(sessionId, Date.now());
      const r = await this.contacts.resolveLids(orgId, row).catch(() => ({ merged: 0, pending: 0 }));
      if (r.merged) this.presenter.sync(orgId, { session_id: sessionId, kind: 'chats' });
    }
    // telefone → @lid só no whatsapp-web.js (lá as conversas individuais ficam pelo @lid); no Baileys o canônico é o telefone
    const lids = localUnread ? [] : await this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, lid: { not: null }, phone: { not: null } }, select: { phone: true, lid: true } });
    const lidByPhone = new Map(lids.map((c) => [String(c.phone), String(c.lid)] as [string, string]));
    const wanted = new Map<string, { unread: number; archived: boolean; pinned: boolean; muted: boolean }>();
    for (const c of list) {
      const raw = normJid(String(c?.id || ''));
      if (!raw || raw === 'status@broadcast') continue;
      const phone = phoneFromJid(raw);
      const id = phone && lidByPhone.get(phone) ? lidByPhone.get(phone)! : raw.replace(/@s\.whatsapp\.net$/, '@c.us');
      const prev = wanted.get(id);
      const unread = Math.max(0, Number(c?.unreadCount || 0));
      wanted.set(id, {
        unread: prev ? Math.max(prev.unread, unread) : unread,
        archived: Boolean(c?.archived),
        pinned: Boolean(c?.pinned),
        muted: Boolean(c?.muted),
      });
    }
    const ours = await this.prisma.whatsapp_chats.findMany({
      where: { organization_id: orgId, session_id: sessionId, chat_id: { in: [...wanted.keys()] } },
      select: { id: true, chat_id: true, unread_count: true, archived: true, pinned: true, muted: true, last_message_at: true, flag_overrides: true },
    });
    let changed = 0;
    for (const c of ours) {
      const w = wanted.get(c.chat_id)!;
      const data: any = {};
      // não lidas: o gateway manda. Exceção: mensagem que acabou de chegar (< 15 s) e o
      // gateway ainda não contou → não zera por engano.
      const fresh = c.last_message_at && Date.now() - new Date(c.last_message_at).getTime() < 15_000;
      if (!localUnread && w.unread !== c.unread_count && !(fresh && w.unread < c.unread_count)) data.unread_count = w.unread;
      // marcações: vale o que o usuário decidiu no painel enquanto o gateway continuar no valor
      // que tinha antes (gw); quando o gateway chega no valor pedido, ou muda pelo celular, volta a mandar
      const ov: Record<string, { value: boolean; gw: boolean }> = { ...((c.flag_overrides as any) || {}) };
      let ovChanged = false;
      for (const flag of ['archived', 'pinned', 'muted'] as const) {
        const o = ov[flag];
        if (o && w[flag] === Boolean(o.gw) && w[flag] !== Boolean(o.value)) continue; // gateway parado no valor antigo
        if (o) {
          delete ov[flag];
          ovChanged = true;
        }
        if (w[flag] !== c[flag]) data[flag] = w[flag];
      }
      if (ovChanged) data.flag_overrides = ov;
      if (Object.keys(data).length) {
        await this.prisma.whatsapp_chats.update({ where: { id: c.id }, data });
        this.presenter.chat(orgId, sessionId, c.chat_id);
        changed++;
      }
    }
    return { changed };
  }
}
