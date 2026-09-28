import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppSessionsService } from './whatsapp-sessions.service';
import { WhatsAppChatService } from './whatsapp-chat.service';
import { WhatsAppContactsService } from './whatsapp-contacts.service';

// Ao CONECTAR (status ready), carrega o que o celular já tem: conversas (com nome),
// contatos (agenda, paginado, lid→telefone) e as últimas mensagens das conversas
// recentes. Roda 1× por pareamento (settings.bootstrapped_for = id da sessão no gateway)
// e pode ser repetido manualmente (POST /whatsapp/session/bootstrap).
@Injectable()
export class WhatsAppBootstrapService {
  private readonly logger = new Logger(WhatsAppBootstrapService.name);
  private readonly running = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: WhatsAppSessionsService,
    private readonly chat: WhatsAppChatService,
    private readonly contacts: WhatsAppContactsService,
  ) {}

  // Chamado após transição para ready (webhook/watchdog). Não bloqueia quem chamou.
  maybeRun(row: any) {
    if (!row?.openwa_session_id) return;
    const done = (row.settings as any)?.bootstrapped_for;
    if (done === row.openwa_session_id) return;
    this.run(row.organization_id, false).catch((e) => this.logger.warn(`bootstrap org=${row.organization_id}: ${e?.message || e}`));
  }

  async run(orgId: string, force: boolean) {
    if (this.running.has(orgId)) return { running: true };
    this.running.add(orgId);
    const started = Date.now();
    try {
      const row = await this.sessions.row(orgId);
      if (!row?.openwa_session_id || row.status !== 'ready') return { skipped: 'not_ready' };
      if (!force && (row.settings as any)?.bootstrapped_for === row.openwa_session_id) return { skipped: 'done' };
      const chats = await this.chat.syncChats(orgId).catch((e) => ({ error: e?.message }));
      const contacts = await this.contacts.sync(orgId).catch((e) => ({ error: e?.message }));
      const merged = await this.contacts.mergeAll(orgId).catch((e) => ({ error: e?.message }));
      const history = await this.chat.importHistory(orgId, 40, 30).catch((e) => ({ error: e?.message }));
      const fresh = await this.sessions.row(orgId);
      await this.prisma.whatsapp_sessions.update({ where: { id: row.id }, data: { settings: { ...((fresh?.settings as any) || {}), bootstrapped_for: row.openwa_session_id, bootstrapped_at: new Date().toISOString() } } });
      const result = { chats, contacts, merged, history, ms: Date.now() - started };
      this.logger.log(`bootstrap org=${orgId}: ${JSON.stringify(result)}`);
      return result;
    } finally {
      this.running.delete(orgId);
    }
  }
}
