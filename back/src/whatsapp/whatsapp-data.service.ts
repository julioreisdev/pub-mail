import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { promises as fsp } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppSessionsService } from './whatsapp-sessions.service';
import { WhatsAppMediaService } from './whatsapp-media.service';
import { WhatsAppPresenter } from './whatsapp-presenter.service';
import { WhatsAppBootstrapService } from './whatsapp-bootstrap.service';

// "Limpar os dados" (Configurações do WhatsApp):
//  - DE UM NÚMERO (sessionId): apaga o que veio daquele número — conversas, mensagens, mídias das
//    mensagens, status (seus e dos contatos), histórico de atendimento, agendamentos, envios de
//    broadcast, estado do bot, log da sessão — e desconecta o número. A linha do número fica
//    (nome interno, cor, fluxo do bot) para reconectar depois. Contatos são da organização: ficam.
//  - DE TUDO (sem sessionId): o mesmo para todos os números + contatos (opcionalmente mantendo
//    os salvos/manuais/importados) + filtros de conversa. Bot e broadcasts ficam DESLIGADOS.
// Continuam sempre: etiquetas, respostas rápidas (com anexo), fluxos do bot, campanhas (sem os
// grupos/contatos escolhidos), configuração de atendimento e PIX já pagos.

const KEEPABLE_CONTACT = { OR: [{ saved: true }, { source: { in: ['manual', 'import'] } }] };

@Injectable()
export class WhatsAppDataService {
  private readonly logger = new Logger(WhatsAppDataService.name);
  private readonly running = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: WhatsAppSessionsService,
    private readonly media: WhatsAppMediaService,
    private readonly presenter: WhatsAppPresenter,
    private readonly bootstrap: WhatsAppBootstrapService,
  ) {}

  async summary(orgId: string, sessionId?: string | null) {
    const sess = sessionId ? { session_id: String(sessionId) } : {};
    const where = { organization_id: orgId, ...sess };
    const keep = [...(await this.media.referencedIds([orgId]))];
    const mediaWhere = sessionId
      ? { organization_id: orgId, id: { notIn: keep, in: (await this.prisma.whatsapp_messages.findMany({ where: { organization_id: orgId, session_id: String(sessionId), media_id: { not: null } }, select: { media_id: true }, take: 50_000 })).map((m) => m.media_id as string) } }
      : { organization_id: orgId, id: { notIn: keep } };
    const [rows, chats, messages, contacts, keepable, media, contactStatuses, statuses, schedules, runs, serviceEvents, filters, activeBroadcasts, botSessions] =
      await Promise.all([
        this.sessions.rowsOf(orgId),
        this.prisma.whatsapp_chats.count({ where }),
        this.prisma.whatsapp_messages.count({ where }),
        this.prisma.whatsapp_contacts.count({ where: { organization_id: orgId } }),
        this.prisma.whatsapp_contacts.count({ where: { organization_id: orgId, ...KEEPABLE_CONTACT } }),
        this.prisma.whatsapp_media.aggregate({ where: mediaWhere, _count: { _all: true }, _sum: { size_bytes: true } }),
        this.prisma.whatsapp_contact_statuses.count({ where }),
        this.prisma.whatsapp_statuses.count({ where }),
        this.prisma.whatsapp_schedules.count({ where }),
        sessionId ? this.prisma.whatsapp_broadcast_sends.count({ where }) : this.prisma.whatsapp_broadcast_runs.count({ where: { organization_id: orgId } }),
        this.prisma.whatsapp_service_events.count({ where }),
        sessionId ? Promise.resolve(0) : this.prisma.whatsapp_chat_filters.count({ where: { organization_id: orgId } }),
        this.prisma.whatsapp_broadcasts.count({ where: { organization_id: orgId, active: true } }),
        this.prisma.whatsapp_bot_sessions.count({ where: { ...where, status: { in: ['active', 'waiting'] } } }),
      ]);
    const target = sessionId ? rows.find((r) => r.id === sessionId) : null;
    const total = chats + messages + (sessionId ? 0 : contacts) + media._count._all + contactStatuses + statuses + schedules + runs + serviceEvents + filters;
    return {
      session_id: sessionId || null,
      has_session: sessionId ? Boolean(target?.openwa_session_id) : rows.some((r) => r.openwa_session_id),
      status: target ? target.status : rows.some((r) => r.status === 'ready') ? 'ready' : 'none',
      numbers: rows.length,
      chats,
      messages,
      contacts,
      contacts_keepable: keepable,
      media_files: media._count._all,
      media_bytes: Number(media._sum.size_bytes || 0),
      contact_statuses: contactStatuses,
      statuses,
      schedules,
      broadcast_runs: runs,
      service_events: serviceEvents,
      filters,
      active_broadcasts: activeBroadcasts,
      bot_active: botSessions > 0 || rows.some((r) => r.bot_flow_id),
      empty: total === 0,
    };
  }

  /** `sessionId` = só aquele número; sem = tudo da org. */
  async purge(orgId: string, opts: { sessionId?: string | null; keepContacts?: boolean } = {}) {
    const lock = opts.sessionId ? `${orgId}:${opts.sessionId}` : orgId;
    if (this.running.has(lock) || this.running.has(orgId)) throw new ConflictException('A limpeza já está em andamento.');
    const rows = await this.sessions.rowsOf(orgId);
    const targets = opts.sessionId ? rows.filter((r) => r.id === opts.sessionId) : rows;
    if (opts.sessionId && !targets.length) throw new BadRequestException('Número não encontrado.');
    if (this.bootstrap.isRunningForOrg(orgId, targets)) throw new BadRequestException('A sincronização com o celular está rodando. Espere ela terminar e tente de novo.');
    this.running.add(lock);
    const started = Date.now();
    try {
      const keepContacts = Boolean(opts.keepContacts);
      let disconnected = 0;
      for (const t of targets) {
        const w = await this.sessions.wipe(orgId, t.id);
        if (w.had_session) disconnected++;
      }
      // entregas do webhook que já estavam a caminho terminam antes de apagar
      if (disconnected) await new Promise((r) => setTimeout(r, 1500));

      const sessionIds = targets.map((t) => t.id);
      const where = { organization_id: orgId, session_id: { in: sessionIds } };
      const keepMedia = [...(await this.media.referencedIds([orgId]))];
      // mídia das mensagens desses números (status do número e dos contatos idem)
      const mediaIds = new Set<string>();
      for (const m of await this.prisma.whatsapp_messages.findMany({ where: { ...where, media_id: { not: null } }, select: { media_id: true } })) mediaIds.add(m.media_id!);
      for (const s of await this.prisma.whatsapp_statuses.findMany({ where: { ...where, media_id: { not: null } }, select: { media_id: true } })) mediaIds.add(s.media_id!);
      for (const s of await this.prisma.whatsapp_contact_statuses.findMany({ where: { ...where, media_id: { not: null } }, select: { media_id: true } })) mediaIds.add(s.media_id!);
      const mediaWhere = opts.sessionId ? { organization_id: orgId, id: { in: [...mediaIds], notIn: keepMedia } } : { organization_id: orgId, id: { notIn: keepMedia } };
      const files = await this.prisma.whatsapp_media.findMany({ where: mediaWhere, select: { storage_path: true } });
      const keptContactIds = !opts.sessionId && keepContacts
        ? (await this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, ...KEEPABLE_CONTACT }, select: { id: true } })).map((c) => c.id)
        : [];

      const counts = await this.prisma.$transaction(
        async (tx) => {
          const n: Record<string, number> = {};
          n.messages = (await tx.whatsapp_messages.deleteMany({ where })).count;
          n.chats = (await tx.whatsapp_chats.deleteMany({ where })).count;
          n.contact_statuses = (await tx.whatsapp_contact_statuses.deleteMany({ where })).count;
          n.statuses = (await tx.whatsapp_statuses.deleteMany({ where })).count;
          n.service_events = (await tx.whatsapp_service_events.deleteMany({ where })).count;
          n.bot_sessions = (await tx.whatsapp_bot_sessions.deleteMany({ where })).count;
          n.payments = (await tx.whatsapp_payments.deleteMany({ where: { ...where, status: { not: 'PAID' } } })).count;
          n.schedules = (await tx.whatsapp_schedules.deleteMany({ where })).count;
          n.broadcast_sends = (await tx.whatsapp_broadcast_sends.deleteMany({ where })).count;
          // o número deixa de "conhecer" os contatos (os contatos em si são da organização)
          await tx.whatsapp_contact_sessions.deleteMany({ where });
          n.session_events = (await tx.whatsapp_session_events.deleteMany({ where: { session_id: { in: sessionIds } } })).count;
          n.media = (await tx.whatsapp_media.deleteMany({ where: mediaWhere })).count;
          if (!opts.sessionId) {
            n.filters = (await tx.whatsapp_chat_filters.deleteMany({ where: { organization_id: orgId } })).count;
            n.broadcast_runs = (await tx.whatsapp_broadcast_runs.deleteMany({ where: { organization_id: orgId } })).count;
            if (keepContacts) {
              n.contacts = (await tx.whatsapp_contacts.deleteMany({ where: { organization_id: orgId, id: { notIn: keptContactIds } } })).count;
              await tx.whatsapp_contacts.updateMany({ where: { organization_id: orgId }, data: { profile_pic_media_id: null, last_message_at: null, synced_at: null, is_my_contact: false, is_blocked: false } });
            } else {
              n.contacts = (await tx.whatsapp_contacts.deleteMany({ where: { organization_id: orgId } })).count;
            }
            await tx.whatsapp_broadcasts.updateMany({ where: { organization_id: orgId, active: true }, data: { active: false } });
          } else {
            // filtros: tiram as conversas apagadas (uuids não existem mais)
            n.broadcast_runs = 0;
            n.contacts = 0;
            await tx.whatsapp_contacts.updateMany({ where: { organization_id: orgId, profile_pic_media_id: { in: [...mediaIds] } }, data: { profile_pic_media_id: null } });
          }
          // o número deixa de ter fluxo do bot até alguém atribuir de novo
          await tx.whatsapp_sessions.updateMany({ where: { id: { in: sessionIds } }, data: { bot_flow_id: null } });
          return n;
        },
        { timeout: 120_000, maxWait: 10_000 },
      );

      if (!opts.sessionId) {
        // campanhas: tira os grupos e contatos escolhidos que não existem mais
        const kept = new Set(keptContactIds);
        for (const b of await this.prisma.whatsapp_broadcasts.findMany({ where: { organization_id: orgId }, select: { id: true, targets: true } })) {
          const t: any = b.targets && typeof b.targets === 'object' ? b.targets : {};
          const ids = Array.isArray(t.contact_ids) ? t.contact_ids.filter((id: string) => kept.has(id)) : [];
          await this.prisma.whatsapp_broadcasts.update({ where: { id: b.id }, data: { targets: { ...t, groups: [], contact_ids: ids } } });
        }
        // lista de teste do bot (conversas do número antigo)
        for (const flow of await this.prisma.whatsapp_bot_flows.findMany({ where: { organization_id: orgId } })) {
          const s: any = (flow.settings as any) || {};
          await this.prisma.whatsapp_bot_flows.update({ where: { id: flow.id }, data: { settings: { ...s, audience: { ...(s.audience || {}), test_chat_ids: [] } } } });
        }
      } else {
        // filtros de conversa perdem só as conversas desse número
        const existing = new Set((await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId }, select: { id: true } })).map((c) => c.id));
        for (const f of await this.prisma.whatsapp_chat_filters.findMany({ where: { organization_id: orgId } })) {
          const ids = (Array.isArray(f.chat_ids) ? (f.chat_ids as any[]) : []).map(String).filter((id) => existing.has(id));
          await this.prisma.whatsapp_chat_filters.update({ where: { id: f.id }, data: { chat_ids: ids } }).catch(() => undefined);
        }
      }

      // arquivos (depois do commit)
      let removed = 0;
      for (const f of files) {
        try {
          await fsp.unlink(this.media.absPath(f));
          removed++;
        } catch {
          /* já não existe */
        }
      }

      for (const t of targets) {
        await this.sessions.logEvent({ id: t.id, organization_id: orgId }, 'local.purge', { ...counts, files: removed, scope: opts.sessionId ? 'number' : 'all' });
        this.presenter.session(orgId, t.id, { event: 'local.purge', status: 'none' });
      }
      this.presenter.invalidateSessions(orgId);
      this.presenter.emit(orgId, 'wa:sessions', { event: 'local.purge', session_id: opts.sessionId || null });
      this.logger.log(`Dados do WhatsApp apagados org=${orgId} ${opts.sessionId ? `número=${opts.sessionId}` : '(tudo)'} ${JSON.stringify({ ...counts, files: removed, ms: Date.now() - started })}`);
      return { ok: true, disconnected: disconnected > 0, deleted: { ...counts, files: removed }, kept_contacts: keptContactIds.length };
    } finally {
      this.running.delete(lock);
    }
  }
}
