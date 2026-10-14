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
const FINANCE = 'whatsapp:finance'; // sub-permissão que vê valores (P7-18)
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
    this.hooks.on('broadcast_paused', (e) => this.onBroadcastPaused(e));
    // Fase 6 (agenda)
    this.hooks.on('appointment_booked', (e) => this.onAppointment('appointment_booked', e));
    this.hooks.on('appointment_canceled', (e) => this.onAppointment('appointment_canceled', e));
    this.hooks.on('appointment_no_show', (e) => this.onAppointment('appointment_no_show', e));
    // Fase 6B (chamados)
    this.hooks.on('ticket_created', (e) => this.onTicket('ticket_created', e));
    this.hooks.on('ticket_assigned', (e) => this.onTicket('ticket_assigned', e));
    this.hooks.on('ticket_sla', (e) => this.onTicket('ticket_sla', e));
    // Fase 7 (pedidos)
    this.hooks.on('order_created', (e) => this.onOrder('order_created', e));
    this.hooks.on('order_paid', (e) => this.onOrder('order_paid', e));
  }

  // ---------------------------------------------------------------- pedidos
  private async onOrder(kind: 'order_created' | 'order_paid', e: { orgId: string; order: any; user_id?: string | null; manual?: boolean }) {
    const o = e?.order;
    if (!o?.id || (kind === 'order_paid' && e.manual)) return;
    const who = o.customer?.name || o.contact?.name || (o.jid ? fmtPhone(o.jid) : 'Cliente');
    const title = kind === 'order_created' ? `Novo pedido ${o.code} · ${o.total_label}` : `Pedido ${o.code} pago · ${o.total_label}`;
    const body = `${who} · ${o.items_count} ${o.items_count === 1 ? 'item' : 'itens'} · ${o.delivery?.mode === 'delivery' ? 'entrega' : 'retirada'} · ${o.payment_method_label}.`;
    // P7-18: quem não tem `whatsapp:finance` recebe o aviso sem o valor
    const restricted = { permission: FINANCE, title: kind === 'order_created' ? `Novo pedido ${o.code}` : `Pedido ${o.code} pago`, body };
    await this.notifications.notify(e.orgId, { kind, title, body, url: `/whatsapp/orders?order=${encodeURIComponent(o.id)}`, tag: `order:${o.id}:${kind}`, sessionId: o.session_id || null, data: { order_id: o.id, chat_id: o.chat_id || null }, to: null, exclude: e.user_id ? [e.user_id] : null, restricted });
  }

  // ---------------------------------------------------------------- chamados
  /** Novo: responsável (se houver) ou todos com o módulo. Atribuído: só quem recebeu. Prazo: responsável ou todos. */
  private async onTicket(kind: 'ticket_created' | 'ticket_assigned' | 'ticket_sla', e: { orgId: string; ticket: any; by?: string | null; user_id?: string | null; phase?: string }) {
    const t = e?.ticket;
    if (!t?.id) return;
    const actor = e.user_id || null;
    const who = t.customer?.name || t.contact?.name || (t.jid ? fmtPhone(t.jid) : 'Cliente');
    let to: string[] | null = t.assigned_user_id ? [t.assigned_user_id] : null;
    let title: string;
    let body: string;
    if (kind === 'ticket_assigned') {
      if (!t.assigned_user_id || t.assigned_user_id === actor) return; // pegou para si: não avisa a si mesmo
      to = [t.assigned_user_id];
      title = `Chamado ${t.protocol} atribuído a você`;
      body = `${t.category_label} · ${t.subject} — ${who}.`;
    } else if (kind === 'ticket_created') {
      title = `Novo chamado ${t.protocol} · ${t.category_label}`;
      body = `${who}: ${t.subject}${t.priority === 'urgent' ? ' · URGENTE' : t.priority === 'high' ? ' · prioridade alta' : ''}.`;
    } else {
      const late = e.phase === 'breached';
      title = late ? `Prazo estourado: chamado ${t.protocol}` : `Chamado ${t.protocol} vence ${t.sla_relative || 'em breve'}`;
      body = `${t.category_label} · ${t.subject} — ${who}${t.assigned?.name ? ` · com ${t.assigned.name}` : ' · sem responsável'}.`;
    }
    await this.notifications.notify(e.orgId, { kind, title, body, url: `/whatsapp/tickets?ticket=${encodeURIComponent(t.id)}`, tag: `ticket:${t.id}:${kind}`, sessionId: t.session_id || null, data: { ticket_id: t.id, chat_id: t.chat_id || null }, to, exclude: actor && kind !== 'ticket_sla' ? [actor] : null });
  }

  // ---------------------------------------------------------------- agenda
  /** Para o profissional do recurso (`resource.user_id`) ou, sem profissional, para todos com o módulo. */
  private async onAppointment(kind: 'appointment_booked' | 'appointment_canceled' | 'appointment_no_show', e: { orgId: string; appointment: any; by?: string | null; user_id?: string | null; notify_staff?: boolean; credit_cents?: number }) {
    const a = e?.appointment;
    if (!a?.id || e.notify_staff === false) return;
    if (kind === 'appointment_canceled' && a.cancel_reason === 'remarcado') return; // remarcação não é cancelamento
    const who = a.customer?.name || a.contact?.name || (a.jid ? fmtPhone(a.jid) : 'Cliente');
    const when = `${a.date_label} ${a.time_label}`;
    const actor = e.user_id || (typeof e.by === 'string' && /^[0-9a-f-]{36}$/i.test(e.by) ? e.by : null);
    const to = a.resource?.user_id ? [a.resource.user_id] : null;
    const title = kind === 'appointment_booked' ? `Novo agendamento: ${a.service_name} · ${when}` : kind === 'appointment_canceled' ? `Agendamento cancelado: ${a.service_name} · ${when}` : `Falta: ${who} · ${when}`;
    const body =
      kind === 'appointment_booked' ? `${who} com ${a.resource?.name || '—'}${a.status === 'pending_payment' ? ' · aguardando pagamento' : ''}.`
      : kind === 'appointment_canceled' ? `${who} · ${e.by === 'customer' ? 'cancelado pelo cliente' : e.by === 'system' ? 'cancelado automaticamente' : 'cancelado pela equipe'}${e.credit_cents ? ` · crédito de ${money(e.credit_cents)}` : ''}.`
      : `${a.service_name} com ${a.resource?.name || '—'}${e.by === 'system' ? ' · marcado automaticamente — corrija na Agenda se o cliente veio' : ''}.`;
    await this.notifications.notify(e.orgId, { kind, title, body, url: `/whatsapp/agenda?appointment=${encodeURIComponent(a.id)}`, tag: `appt:${a.id}`, sessionId: a.session_id || null, data: { appointment_id: a.id, chat_id: a.chat_id || null }, to, exclude: actor ? [actor] : null });
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
    const body = `${who} pagou ${c.description ? `"${c.description}"` : 'a cobrança'} (${e.via === 'manual' ? 'marcado como pago' : String(e.via || '').toUpperCase()}).`;
    // P7-18: sem `whatsapp:finance` = sem o valor e com o link da conversa (a tela de cobranças é bloqueada para ele)
    const restricted = { permission: FINANCE, title: 'Pagamento confirmado', body, url: chat?.id ? this.chatUrl(chat.id) : '/whatsapp/chat' };
    await this.notifications.notify(e.orgId, { kind: 'charge_paid', title: `Pagamento confirmado: ${money(c.amount_cents)}`, body, url: '/whatsapp/charges', tag: `charge:${c.id}`, sessionId: c.session_id || null, chat: chat ? this.chatCtx(chat, c.chat_id) : null, data: { charge_id: c.id, chat_id: chat?.id || null }, restricted });
  }

  private async onChargeOverdue(e: { orgId: string; charge: any }) {
    const c = e.charge;
    const customer = c.customer_id ? await this.prisma.whatsapp_customers.findUnique({ where: { id: c.customer_id } }).catch(() => null) : null;
    const chat = c.session_id && c.chat_id ? await this.chatRow(e.orgId, c.session_id, c.chat_id) : null;
    const who = customer?.name || chat?.name || fmtPhone(c.chat_id);
    const body = `${who} não pagou ${c.description ? `"${c.description}"` : 'a cobrança'} até o vencimento.`;
    const restricted = { permission: FINANCE, title: 'Cobrança vencida', body, url: chat?.id ? this.chatUrl(chat.id) : '/whatsapp/chat' };
    await this.notifications.notify(e.orgId, { kind: 'charge_overdue', title: `Cobrança vencida: ${money(c.amount_cents)}`, body, url: '/whatsapp/charges?status=overdue', tag: `charge:${c.id}`, sessionId: c.session_id || null, chat: chat ? this.chatCtx(chat, c.chat_id) : null, data: { charge_id: c.id, chat_id: chat?.id || null }, restricted });
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
  private async onBroadcastPaused(e: { orgId: string; broadcast: any; run: any; reason: string }) {
    await this.notifications.notify(e.orgId, { kind: 'broadcast_paused', title: `Broadcast pausado: ${e.broadcast?.name || 'campanha'}`, body: `${e.reason}. Abra Broadcasts para retomar ou enviar mesmo assim.`, url: '/whatsapp/broadcasts', tag: `broadcast:${e.run?.id}`, important: true, data: { broadcast_id: e.broadcast?.id, run_id: e.run?.id } });
  }

  private async onBroadcastDone(e: { orgId: string; broadcast: any; run: any; stats: { total: number; sent: number; failed: number; blocked: number } }) {
    const s = e.stats;
    await this.notifications.notify(e.orgId, { kind: 'broadcast_done', title: `Broadcast concluído: ${e.broadcast?.name || 'campanha'}`, body: `${s.sent} de ${s.total} enviados${s.failed ? ` · ${s.failed} falhas` : ''}${s.blocked ? ` · ${s.blocked} bloqueados` : ''}.`, url: '/whatsapp/broadcasts', tag: `broadcast:${e.run?.id}`, data: { broadcast_id: e.broadcast?.id, run_id: e.run?.id } });
  }
}
