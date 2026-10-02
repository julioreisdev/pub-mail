import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { promises as fsp } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppSessionsService } from './whatsapp-sessions.service';
import { WhatsAppMediaService } from './whatsapp-media.service';
import { WhatsAppPresenter } from './whatsapp-presenter.service';
import { WhatsAppBootstrapService } from './whatsapp-bootstrap.service';
import { WhatsAppBotService } from './bot/whatsapp-bot.service';

// "Limpar todos os dados" (Configurações do WhatsApp): apaga tudo o que veio do número
// conectado — conversas, mensagens, mídias (arquivos), contatos, status, histórico de
// atendimento, agendamentos, histórico de broadcasts, filtros de conversa e o log da sessão —
// e desconecta o número se ainda houver sessão.
// Continuam (são configuração da org): etiquetas, respostas rápidas (com anexo), fluxo do bot,
// campanhas de broadcast (sem os contatos/grupos escolhidos), configuração de atendimento e
// PIX já pagos. O bot e os broadcasts ficam DESLIGADOS até alguém ligar de novo.

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
    private readonly bot: WhatsAppBotService,
  ) {}

  async summary(orgId: string) {
    const where = { organization_id: orgId };
    const keep = [...(await this.media.referencedIds([orgId]))];
    const [session, chats, messages, contacts, keepable, media, contactStatuses, statuses, schedules, runs, serviceEvents, filters, activeBroadcasts, bot] =
      await Promise.all([
        this.sessions.row(orgId),
        this.prisma.whatsapp_chats.count({ where }),
        this.prisma.whatsapp_messages.count({ where }),
        this.prisma.whatsapp_contacts.count({ where }),
        this.prisma.whatsapp_contacts.count({ where: { ...where, ...KEEPABLE_CONTACT } }),
        this.prisma.whatsapp_media.aggregate({ where: { ...where, id: { notIn: keep } }, _count: { _all: true }, _sum: { size_bytes: true } }),
        this.prisma.whatsapp_contact_statuses.count({ where }),
        this.prisma.whatsapp_statuses.count({ where }),
        this.prisma.whatsapp_schedules.count({ where }),
        this.prisma.whatsapp_broadcast_runs.count({ where }),
        this.prisma.whatsapp_service_events.count({ where }),
        this.prisma.whatsapp_chat_filters.count({ where }),
        this.prisma.whatsapp_broadcasts.count({ where: { ...where, active: true } }),
        this.prisma.whatsapp_bot_flows.findUnique({ where: { organization_id: orgId }, select: { active: true } }),
      ]);
    const total = chats + messages + contacts + media._count._all + contactStatuses + statuses + schedules + runs + serviceEvents + filters;
    return {
      has_session: Boolean(session?.openwa_session_id),
      status: session?.status || 'none',
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
      bot_active: Boolean(bot?.active),
      empty: total === 0,
    };
  }

  async purge(orgId: string, opts: { keepContacts?: boolean } = {}) {
    if (this.running.has(orgId)) throw new ConflictException('A limpeza já está em andamento.');
    if (this.bootstrap.isRunning(orgId)) throw new BadRequestException('A sincronização com o celular está rodando. Espere ela terminar e tente de novo.');
    this.running.add(orgId);
    const started = Date.now();
    try {
      const keepContacts = Boolean(opts.keepContacts);
      const wiped = await this.sessions.wipe(orgId);
      // entregas do webhook que já estavam a caminho terminam antes de apagar
      if (wiped.had_session) await new Promise((r) => setTimeout(r, 1500));

      const where = { organization_id: orgId };
      const keepMedia = [...(await this.media.referencedIds([orgId]))];
      const files = await this.prisma.whatsapp_media.findMany({ where: { ...where, id: { notIn: keepMedia } }, select: { storage_path: true } });
      const keptContactIds = keepContacts
        ? (await this.prisma.whatsapp_contacts.findMany({ where: { ...where, ...KEEPABLE_CONTACT }, select: { id: true } })).map((c) => c.id)
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
          n.filters = (await tx.whatsapp_chat_filters.deleteMany({ where })).count;
          n.broadcast_sends = (await tx.whatsapp_broadcast_sends.deleteMany({ where })).count;
          n.broadcast_runs = (await tx.whatsapp_broadcast_runs.deleteMany({ where })).count;
          n.session_events = (await tx.whatsapp_session_events.deleteMany({ where })).count;
          n.media = (await tx.whatsapp_media.deleteMany({ where: { ...where, id: { notIn: keepMedia } } })).count;
          if (keepContacts) {
            n.contacts = (await tx.whatsapp_contacts.deleteMany({ where: { ...where, id: { notIn: keptContactIds } } })).count;
            await tx.whatsapp_contacts.updateMany({
              where,
              data: { profile_pic_media_id: null, last_message_at: null, synced_at: null, is_my_contact: false, is_blocked: false },
            });
          } else {
            n.contacts = (await tx.whatsapp_contacts.deleteMany({ where })).count;
          }
          await tx.whatsapp_broadcasts.updateMany({ where: { ...where, active: true }, data: { active: false } });
          return n;
        },
        { timeout: 120_000, maxWait: 10_000 },
      );

      // campanhas: tira os grupos e contatos escolhidos que não existem mais
      const kept = new Set(keptContactIds);
      for (const b of await this.prisma.whatsapp_broadcasts.findMany({ where, select: { id: true, targets: true } })) {
        const t: any = b.targets && typeof b.targets === 'object' ? b.targets : {};
        const ids = Array.isArray(t.contact_ids) ? t.contact_ids.filter((id: string) => kept.has(id)) : [];
        await this.prisma.whatsapp_broadcasts.update({ where: { id: b.id }, data: { targets: { ...t, groups: [], contact_ids: ids } } });
      }
      // bot: desligado e sem a lista de teste (conversas do número antigo)
      const flow = await this.prisma.whatsapp_bot_flows.findUnique({ where: { organization_id: orgId } });
      if (flow) {
        const s: any = (flow.settings as any) || {};
        await this.prisma.whatsapp_bot_flows.update({ where: { id: flow.id }, data: { settings: { ...s, audience: { ...(s.audience || {}), test_chat_ids: [] } } } });
        await this.bot.setActive(orgId, false).catch(() => undefined);
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

      if (wiped.row_id) await this.sessions.logEvent({ id: wiped.row_id, organization_id: orgId }, 'local.purge', { ...counts, files: removed, kept_contacts: keptContactIds.length });
      this.presenter.session(orgId, { event: 'local.purge', status: 'none' });
      this.logger.log(`Dados do WhatsApp apagados org=${orgId} ${JSON.stringify({ ...counts, files: removed, ms: Date.now() - started })}`);
      return { ok: true, disconnected: wiped.had_session, deleted: { ...counts, files: removed }, kept_contacts: keptContactIds.length };
    } finally {
      this.running.delete(orgId);
    }
  }
}
