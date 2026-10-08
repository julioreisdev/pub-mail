import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WhatsAppHooks } from './whatsapp-hooks.service';
import { previewOf } from './wa-preview.util';
import { isGroupJid, phoneFromJid } from './wa-jid.util';
import { sessionLabel } from './whatsapp-sessions.service';
import { WhatsAppContactsService } from './whatsapp-contacts.service';

// =============================================================================
// Ponte entre os eventos internos do WhatsApp (WhatsAppHooks.emit) e as notificações.
// Os serviços de domínio só emitem o evento cru; aqui vira título/texto/link e vai para o
// NotificationsService, que aplica as preferências de cada usuário. Tudo best-effort.
// =============================================================================

const fmtPhone = (jid?: string | null) => {
  const d = phoneFromJid(jid || '') || '';
  if (!d) return 'Contato';
  if (d.startsWith('55') && d.length >= 12) return `+55 (${d.slice(2, 4)}) ${d.slice(4, -4)}-${d.slice(-4)}`;
  return `+${d}`;
};
const money = (cents: unknown) => (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

@Injectable()
export class WhatsAppNotifyBridge implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppNotifyBridge.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hooks: WhatsAppHooks,
    private readonly notifications: NotificationsService,
    private readonly contacts: WhatsAppContactsService,
  ) {}

  onModuleInit() {
    this.hooks.on('message', (e) => this.onMessage(e));
    this.hooks.on('service', (e) => this.onService(e));
    this.hooks.on('task_due', (e) => this.onTaskDue(e));
    this.hooks.on('task_assigned', (e) => this.onTaskAssigned(e));
    this.hooks.on('charge_paid', (e) => this.onChargePaid(e));
    this.hooks.on('charge_overdue', (e) => this.onChargeOverdue(e));
    this.hooks.on('pipeline_moved', (e) => this.onPipeline(e));
    this.hooks.on('session_connected', (e) => this.onSession(e, true));
    this.hooks.on('session_disconnected', (e) => this.onSession(e, false));
    this.hooks.on('rating', (e) => this.onRating(e));
    this.hooks.on('broadcast_done', (e) => this.onBroadcastDone(e));
  }

  private chatRow(orgId: string, sessionId: string, jid: string) {
    return this.prisma.whatsapp_chats.findFirst({ where: { organization_id: orgId, session_id: sessionId, chat_id: jid } });
  }

  private sessionRow(id: string) {
    return this.prisma.whatsapp_sessions.findUnique({ where: { id } });
  }

  /** Foto do contato/grupo como ícone (URL assinada pública); best-effort e rápido (cache do próprio serviço). */
  private photoIcon(orgId: string, sessionId: string, jid: string) {
    return Promise.race([this.contacts.photoUrl(orgId, { jid, sessionId }), new Promise<null>((r) => setTimeout(() => r(null), 2500))]).catch(() => null);
  }

  private chatUrl(uuid?: string | null) {
    return uuid ? `/whatsapp/chat?chat=${encodeURIComponent(uuid)}` : '/whatsapp/chat';
  }

  private chatCtx(chat: any, jid: string) {
    return { uuid: chat?.id || null, jid, group: isGroupJid(jid), assigned_user_id: chat?.assigned_user_id || null, name: chat?.name || null };
  }

  private numberSuffix(session: any, n: number) {
    return n > 1 && session ? ` · ${sessionLabel(session)}` : '';
  }

  private async numbersCount(orgId: string) {
    return this.prisma.whatsapp_sessions.count({ where: { organization_id: orgId } }).catch(() => 1);
  }

  // ---------------------------------------------------------------- mensagens
  private async onMessage(e: { orgId: string; sessionId: string; chatId: string; message: any; session: any }) {
    const { orgId, sessionId, chatId, message } = e;
    const chat = await this.chatRow(orgId, sessionId, chatId);
    const group = isGroupJid(chatId);
    const n = await this.numbersCount(orgId);
    const name = chat?.name || (group ? 'Grupo' : fmtPhone(chatId));
    const preview = previewOf(message.type, message.body) || 'Nova mensagem';
    const body = group && message.sender_name ? `${message.sender_name}: ${preview}` : preview;
    const data = { chat_id: chat?.id || null, session_id: sessionId, jid: chatId, message_id: message.id };
    const icon = await this.photoIcon(orgId, sessionId, group && message.from_jid ? message.from_jid : chatId);
    // menção ao próprio número dentro de um grupo → aviso próprio (mesmo com "mensagens em grupo" desligado)
    let mentioned = false;
    if (group) {
      const own = String(e.session?.phone || '').replace(/\D/g, '');
      const mentions: string[] = Array.isArray(message.extra?.mentions) ? message.extra.mentions.map(String) : [];
      mentioned = Boolean(own) && mentions.some((m) => m.replace(/\D/g, '').startsWith(own));
    }
    if (mentioned) {
      await this.notifications.notify(orgId, { kind: 'mention', title: `${message.sender_name || 'Alguém'} mencionou você em ${name}${this.numberSuffix(e.session, n)}`, body: preview, url: this.chatUrl(chat?.id), tag: `chat:${chat?.id || chatId}`, sessionId, chat: this.chatCtx(chat, chatId), data, icon });
    }
    await this.notifications.notify(orgId, { kind: group ? 'message_group' : 'message', title: `${name}${this.numberSuffix(e.session, n)}`, body, url: this.chatUrl(chat?.id), tag: `chat:${chat?.id || chatId}`, sessionId, chat: this.chatCtx(chat, chatId), data, icon });
  }

  // ---------------------------------------------------------------- atendimento
  private async onService(e: { orgId: string; sessionId: string; chatId: string; chatUuid: string; status: string; prev: string; prevAssigned: string | null; assigned: string | null; event?: string; actor?: string | null; meta?: any }) {
    const { orgId, sessionId, chatId } = e;
    const chat = await this.chatRow(orgId, sessionId, chatId);
    const name = chat?.name || fmtPhone(chatId);
    const session = await this.sessionRow(sessionId);
    const n = await this.numbersCount(orgId);
    const suffix = this.numberSuffix(session, n);
    const url = this.chatUrl(chat?.id || e.chatUuid);
    const ctx = this.chatCtx(chat, chatId);
    const data = { chat_id: chat?.id || e.chatUuid, session_id: sessionId, jid: chatId };
    const icon = await this.photoIcon(orgId, sessionId, chatId);
    const actorName = e.actor ? await this.notifications.userName(e.actor) : null;

    // entrou na fila (liberada, bot encaminhou, cliente pediu) — para todos que atendem o número
    if (e.status === 'waiting' && e.prev !== 'waiting' && !e.assigned) {
      const handoff = e.event === 'handoff';
      await this.notifications.notify(orgId, { kind: handoff ? 'handoff' : 'queue', title: handoff ? `Bot encaminhou ${name} para atendimento${suffix}` : `${name} está esperando atendimento${suffix}`, body: handoff ? 'O fluxo do bot pediu um humano. Assuma a conversa no Chat.' : actorName ? `Liberada por ${actorName}.` : 'Ninguém assumiu ainda.', url, tag: `queue:${chat?.id || chatId}`, sessionId, chat: ctx, data, icon, exclude: e.actor ? [e.actor] : null });
      return;
    }
    // atribuída a alguém (distribuição, assumir por outro, transferência, bot com responsável)
    if (e.status === 'human' && e.assigned && e.assigned !== e.prevAssigned) {
      const to = e.assigned;
      const byMe = e.actor === to; // assumiu sozinho: não avisa
      if (!byMe) {
        const how = e.event === 'auto_assigned' ? 'Distribuição automática' : e.event === 'transferred' && actorName ? `Transferida por ${actorName}` : e.event === 'handoff' ? 'Encaminhada pelo bot' : actorName ? `Por ${actorName}` : 'Atribuída a você';
        await this.notifications.notify(orgId, { kind: 'assigned', title: `${name} agora é com você${suffix}`, body: how, url, tag: `assigned:${chat?.id || chatId}`, sessionId, chat: ctx, data, icon, to: [to] });
      }
      // quem perdeu a conversa (transferência feita por outra pessoa)
      if (e.event === 'transferred' && e.prevAssigned && e.prevAssigned !== to && e.prevAssigned !== e.actor) {
        const toName = await this.notifications.userName(to);
        await this.notifications.notify(orgId, { kind: 'transferred', title: `${name} foi transferida${suffix}`, body: `${actorName || 'Alguém'} passou a conversa para ${toName || 'outra pessoa'}.`, url, tag: `transferred:${chat?.id || chatId}`, sessionId, chat: ctx, data, icon, to: [e.prevAssigned] });
      }
    }
  }

  // ---------------------------------------------------------------- tarefas
  private async onTaskDue(e: { orgId: string; tasks: any[] }) {
    for (const t of e.tasks || []) {
      const to = t.assigned_user?.id ? [t.assigned_user.id] : null;
      await this.notifications.notify(e.orgId, { kind: 'task_due', title: `Tarefa no prazo: ${t.title}`, body: t.chat?.name ? `Conversa: ${t.chat.name}` : t.description || 'Toque para abrir.', url: t.chat?.chat_id ? this.chatUrl(t.chat.chat_id) : '/whatsapp/tasks', tag: `task:${t.id}`, sessionId: t.chat?.session?.id || t.session_id || null, data: { task_id: t.id }, to });
    }
  }

  private async onTaskAssigned(e: { orgId: string; task: any; by: string | null }) {
    const t = e.task;
    const to = t?.assigned_user?.id;
    if (!to || to === e.by) return;
    const byName = e.by ? await this.notifications.userName(e.by) : null;
    const when = t.due_at ? ` · prazo ${new Date(t.due_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : '';
    await this.notifications.notify(e.orgId, { kind: 'task_assigned', title: `Nova tarefa para você: ${t.title}`, body: `${byName ? `Por ${byName}` : 'Atribuída a você'}${when}`, url: t.chat?.chat_id ? this.chatUrl(t.chat.chat_id) : '/whatsapp/tasks', tag: `task:${t.id}`, data: { task_id: t.id }, to: [to] });
  }

  // ---------------------------------------------------------------- cobranças
  private async onChargePaid(e: { orgId: string; charge: any; customer: any; via: string }) {
    const c = e.charge;
    const chat = c.session_id && c.chat_id ? await this.chatRow(e.orgId, c.session_id, c.chat_id) : null;
    const who = e.customer?.name || chat?.name || fmtPhone(c.chat_id);
    await this.notifications.notify(e.orgId, { kind: 'charge_paid', title: `Pagamento confirmado: ${money(c.amount_cents)}`, body: `${who} pagou ${c.description ? `"${c.description}"` : 'a cobrança'} (${e.via === 'manual' ? 'marcado como pago' : e.via.toUpperCase()}).`, url: '/whatsapp/charges', tag: `charge:${c.id}`, sessionId: c.session_id || null, chat: chat ? this.chatCtx(chat, c.chat_id) : null, data: { charge_id: c.id, chat_id: chat?.id || null } });
  }

  private async onChargeOverdue(e: { orgId: string; charge: any }) {
    const c = e.charge;
    const customer = c.customer_id ? await this.prisma.whatsapp_customers.findUnique({ where: { id: c.customer_id } }).catch(() => null) : null;
    const chat = c.session_id && c.chat_id ? await this.chatRow(e.orgId, c.session_id, c.chat_id) : null;
    const who = customer?.name || chat?.name || fmtPhone(c.chat_id);
    await this.notifications.notify(e.orgId, { kind: 'charge_overdue', title: `Cobrança vencida: ${money(c.amount_cents)}`, body: `${who} não pagou ${c.description ? `"${c.description}"` : 'a cobrança'} até o vencimento.`, url: '/whatsapp/charges?status=overdue', tag: `charge:${c.id}`, sessionId: c.session_id || null, chat: chat ? this.chatCtx(chat, c.chat_id) : null, data: { charge_id: c.id, chat_id: chat?.id || null } });
  }

  // ---------------------------------------------------------------- funil
  private async onPipeline(e: { orgId: string; chat: any; from: any; to: any; by: string | null }) {
    const chat = e.chat;
    const name = chat?.name || fmtPhone(chat?.chat_id);
    const byName = e.by ? await this.notifications.userName(e.by) : null;
    const won = e.to?.kind === 'won';
    const ctx = { uuid: chat?.id, jid: chat?.chat_id, group: false, assigned_user_id: chat?.assigned_user_id || null };
    const data = { chat_id: chat?.id, session_id: chat?.session_id, stage_id: e.to?.id || null };
    if (won) {
      const value = chat?.deal_cents ? ` · ${money(chat.deal_cents)}` : '';
      await this.notifications.notify(e.orgId, { kind: 'pipeline_won', title: `Negócio ganho: ${name}${value}`, body: `${byName ? `${byName} moveu` : 'Movida'} para "${e.to?.name}".`, url: '/whatsapp/pipeline', tag: `stage:${chat?.id}`, sessionId: chat?.session_id, chat: ctx, stageId: e.to?.id || null, data, exclude: e.by ? [e.by] : null });
    }
    if (e.to) {
      await this.notifications.notify(e.orgId, { kind: 'pipeline_moved', title: `${name} → ${e.to.name}`, body: `${byName ? `${byName} moveu` : 'Movida automaticamente'}${e.from?.name ? ` de "${e.from.name}"` : ''} para "${e.to.name}".`, url: '/whatsapp/pipeline', tag: `stage:${chat?.id}`, sessionId: chat?.session_id, chat: ctx, stageId: e.to.id, data, exclude: e.by ? [e.by] : null });
    }
  }

  // ---------------------------------------------------------------- conexão
  private async onSession(e: { orgId: string; row: any; reason?: string | null }, up: boolean) {
    const label = sessionLabel(e.row);
    await this.notifications.notify(e.orgId, { kind: up ? 'session_connected' : 'session_disconnected', title: up ? `${label} conectou` : `${label} desconectou`, body: up ? 'O número voltou a ficar pronto para enviar e receber.' : `${e.reason ? `${e.reason}. ` : ''}Abra Configurações para reconectar.`, url: `/whatsapp/settings?number=${encodeURIComponent(e.row.id)}`, tag: `session:${e.row.id}`, sessionId: e.row.id, data: { session_id: e.row.id } });
  }

  // ---------------------------------------------------------------- avaliação
  private async onRating(e: { orgId: string; sessionId: string; chatId: string; chatUuid?: string | null; score: number; comment?: string | null; userId?: string | null }) {
    const chat = await this.chatRow(e.orgId, e.sessionId, e.chatId);
    const name = chat?.name || fmtPhone(e.chatId);
    const stars = '★'.repeat(Math.max(0, Math.min(5, e.score))) + '☆'.repeat(Math.max(0, 5 - e.score));
    await this.notifications.notify(e.orgId, { kind: 'rating', title: `${name} avaliou o atendimento: ${stars}`, body: e.comment ? `"${e.comment}"` : `Nota ${e.score} de 5.`, url: this.chatUrl(chat?.id || e.chatUuid), tag: `rating:${chat?.id || e.chatId}`, sessionId: e.sessionId, chat: this.chatCtx(chat, e.chatId), data: { chat_id: chat?.id || null, score: e.score }, to: e.userId ? [e.userId] : null });
  }

  // ---------------------------------------------------------------- broadcasts
  private async onBroadcastDone(e: { orgId: string; broadcast: any; run: any; stats: { total: number; sent: number; failed: number; blocked: number } }) {
    const s = e.stats;
    await this.notifications.notify(e.orgId, { kind: 'broadcast_done', title: `Broadcast concluído: ${e.broadcast?.name || 'campanha'}`, body: `${s.sent} de ${s.total} enviados${s.failed ? ` · ${s.failed} falhas` : ''}${s.blocked ? ` · ${s.blocked} bloqueados` : ''}.`, url: '/whatsapp/broadcasts', tag: `broadcast:${e.run?.id}`, data: { broadcast_id: e.broadcast?.id, run_id: e.run?.id } });
  }
}
