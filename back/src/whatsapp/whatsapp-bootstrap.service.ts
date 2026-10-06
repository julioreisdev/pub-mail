import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppSessionsService } from './whatsapp-sessions.service';
import { WhatsAppChatService } from './whatsapp-chat.service';
import { WhatsAppContactsService } from './whatsapp-contacts.service';
import { WhatsAppPresenter } from './whatsapp-presenter.service';
import { WhatsAppContactStatusesService } from './whatsapp-contact-statuses.service';

// Ao CONECTAR um número (status ready), carrega o que o celular já tem: conversas (com nome),
// contatos (agenda, paginado, lid→telefone) e as últimas mensagens das conversas
// recentes. Roda 1× por pareamento (settings.bootstrapped_for = id da sessão no gateway)
// e pode ser repetido manualmente (POST /whatsapp/sessions/:id/bootstrap).
//
// No Baileys a sincronização inicial do WhatsApp chega AOS POUCOS depois de conectar
// (lotes de histórico, nomes, mapeamento @lid). Por isso, além da carga imediata, há
// repasses automáticos em +45 s e +3 min (conversas + contatos + histórico; idempotentes).
// O progresso vai ao vivo para a tela (WebSocket `wa:sync` do número) e fica em settings.sync.
const BAILEYS_REPASSES_MS = [45_000, 180_000];

@Injectable()
export class WhatsAppBootstrapService {
  private readonly logger = new Logger(WhatsAppBootstrapService.name);
  private readonly running = new Set<string>(); // por número (session id)
  private readonly scheduled = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: WhatsAppSessionsService,
    private readonly chat: WhatsAppChatService,
    private readonly contacts: WhatsAppContactsService,
    private readonly presenter: WhatsAppPresenter,
    private readonly contactStatuses: WhatsAppContactStatusesService,
  ) {}

  isRunning(sessionId: string) {
    return this.running.has(sessionId);
  }

  isRunningForOrg(orgId: string, rows: any[]) {
    return rows.some((r) => r.organization_id === orgId && this.running.has(r.id));
  }

  // Chamado após transição para ready (webhook/watchdog). Não bloqueia quem chamou.
  maybeRun(row: any) {
    if (!row?.openwa_session_id) return;
    const done = (row.settings as any)?.bootstrapped_for;
    if (done === row.openwa_session_id) return;
    this.run(row.organization_id, row.id, false).catch((e) => this.logger.warn(`bootstrap número=${row.id}: ${e?.message || e}`));
  }

  private async saveSync(orgId: string, sessionId: string, patch: any) {
    const row = await this.sessions.rowById(orgId, sessionId);
    if (!row) return;
    const settings: any = { ...((row.settings as any) || {}) };
    settings.sync = { ...(settings.sync || {}), ...patch, updated_at: new Date().toISOString() };
    await this.prisma.whatsapp_sessions.update({ where: { id: row.id }, data: { settings } }).catch(() => undefined);
    this.presenter.sync(orgId, { session_id: sessionId, ...settings.sync });
  }

  async run(orgId: string, sessionId: string, force: boolean, opts: { chats?: number; perChat?: number; repass?: boolean } = {}) {
    if (this.running.has(sessionId)) return { running: true };
    this.running.add(sessionId);
    const started = Date.now();
    const chatsLimit = Math.min(200, Math.max(10, opts.chats || 60));
    const perChat = Math.min(100, Math.max(10, opts.perChat || 40));
    try {
      const row = await this.sessions.rowById(orgId, sessionId);
      if (!row?.openwa_session_id || row.status !== 'ready') return { skipped: 'not_ready' };
      if (!force && !opts.repass && (row.settings as any)?.bootstrapped_for === row.openwa_session_id) return { skipped: 'done' };

      await this.saveSync(orgId, sessionId, { phase: 'chats', running: true, started_at: new Date(started).toISOString(), engine: row.engine, repass: Boolean(opts.repass) });
      const chats: any = await this.chat.syncChats(orgId, row).catch((e) => ({ error: e?.message }));
      await this.saveSync(orgId, sessionId, { phase: 'contacts', chats: chats?.synced ?? null });
      const contacts: any = await this.contacts.sync(orgId, row).catch((e) => ({ error: e?.message }));
      await this.saveSync(orgId, sessionId, { phase: 'merge', contacts: contacts?.synced ?? contacts?.total ?? null });
      const merged = await this.contacts.mergeAll(orgId, row).catch((e) => ({ error: e?.message }));
      await this.saveSync(orgId, sessionId, { phase: 'history' });
      const history: any = await this.chat.importHistory(orgId, row, chatsLimit, perChat).catch((e) => ({ error: e?.message }));
      await this.contactStatuses.sync(orgId, row.id).catch(() => undefined); // status dos contatos das últimas 24 h
      const fresh = await this.sessions.rowById(orgId, sessionId);
      await this.prisma.whatsapp_sessions.update({ where: { id: row.id }, data: { settings: { ...((fresh?.settings as any) || {}), bootstrapped_for: row.openwa_session_id, bootstrapped_at: new Date().toISOString() } } });
      const result = { chats, contacts, merged, history, ms: Date.now() - started };
      await this.saveSync(orgId, sessionId, { phase: 'done', running: false, finished_at: new Date().toISOString(), messages: history?.imported ?? null, ms: result.ms });
      this.logger.log(`bootstrap org=${orgId} número=${sessionId}${opts.repass ? ' (repasse)' : ''}: ${JSON.stringify(result)}`);

      // Baileys: a sincronização do WhatsApp continua chegando → repasses automáticos
      if (row.engine === 'baileys' && !opts.repass && !this.scheduled.has(sessionId)) {
        this.scheduled.add(sessionId);
        BAILEYS_REPASSES_MS.forEach((ms, i) =>
          setTimeout(() => {
            if (i === BAILEYS_REPASSES_MS.length - 1) this.scheduled.delete(sessionId);
            this.run(orgId, sessionId, false, { chats: chatsLimit, perChat, repass: true }).catch(() => undefined);
          }, ms),
        );
      }
      return result;
    } catch (e: any) {
      await this.saveSync(orgId, sessionId, { phase: 'error', running: false, error: String(e?.message || e).slice(0, 200) });
      throw e;
    } finally {
      this.running.delete(sessionId);
    }
  }
}
