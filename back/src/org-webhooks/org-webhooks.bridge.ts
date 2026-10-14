import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppHooks } from '../whatsapp/whatsapp-hooks.service';
import { WhatsAppSubscriptionsService } from '../whatsapp/whatsapp-subscriptions.service';
import { WhatsAppChargesService } from '../whatsapp/whatsapp-charges.service';
import { WhatsAppPresenter } from '../whatsapp/whatsapp-presenter.service';
import { phoneFromJid } from '../whatsapp/wa-jid.util';
import { basicCustomer, publicCharge, publicSubscription, shapeEntitlements } from '../org-api/public-shapes';
import { OrgWebhooksService } from './org-webhooks.service';
import { anyErasing, isErasing } from './erasing.registry';

// Ponte hooks internos → eventos públicos dos webhooks (Fase 5, contrato §8.5). Cada handler primeiro pergunta
// (cache de 30 s) se algum webhook ativo da org quer aquele evento — sem assinante, não lê nada do banco.
//
//  subscription_event {orgId, subscription_id, kind, data} → subscription.<kind> (kind `canceled` com `data.scheduled`
//                     = subscription.cancel_scheduled; `deleted` e os demais kinds não viram webhook)
//  charge_created / charge_paid / charge_expired / charge_canceled {orgId, charge} → charge.*
//  customer_created / customer_updated {orgId, customer_id} → customer.*
//  entitlement_changed {orgId, entitlement, from, to} → entitlement.activated|suspended|revoked|failed
//  appointment_<booked|paid|confirmed|canceled|rescheduled|no_show|expired|done> {orgId, appointment} → appointment.* (Fase 6)
//  message (inbound) → message.received (só texto, só conversa individual, nunca de contato descadastrado; só para
//                      webhooks que marcaram o evento explicitamente — fica fora do `*`)
//  customer_erased {orgId, customer_id, erased_at, needles, …} → apaga as entregas antigas/pendentes que citam o
//                      cliente e dispara `customer.erased` (só ids, sem dados pessoais).
//
// Revisão de 14/10/2026: (A-5) os handlers entram numa FILA INTERNA com concorrência 4 (evento em massa — rotina diária,
// importação — não abre milhares de leituras ao mesmo tempo); (A-6) enquanto um cliente está sendo apagado (LGPD) e por
// 10 min depois, nenhum evento com dados dele sai (registro `erasing.registry.ts`).
const QUEUE_CONCURRENCY = 4;
const QUEUE_MAX = 20_000;
const SUB_EVENTS: Record<string, string> = {
  created: 'subscription.created', activated: 'subscription.activated', paid: 'subscription.paid', overdue: 'subscription.overdue',
  paused: 'subscription.paused', resumed: 'subscription.resumed', cancel_scheduled: 'subscription.cancel_scheduled', canceled: 'subscription.canceled',
  reactivated: 'subscription.reactivated', plan_changed: 'subscription.plan_changed',
};
const ENT_EVENTS: Record<string, string> = { active: 'entitlement.activated', suspended: 'entitlement.suspended', revoked: 'entitlement.revoked', failed: 'entitlement.failed' };
const INDIVIDUAL_RE = /@(c\.us|lid|s\.whatsapp\.net)$/;
const APPT_EVENTS = ['booked', 'paid', 'confirmed', 'canceled', 'rescheduled', 'no_show', 'expired', 'done'];

@Injectable()
export class OrgWebhooksBridge implements OnModuleInit {
  private readonly logger = new Logger(OrgWebhooksBridge.name);
  private readonly queue: Array<{ kind: string; fn: () => Promise<unknown> }> = [];
  private running = 0;
  private dropped = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly hooks: WhatsAppHooks,
    private readonly svc: OrgWebhooksService,
    private readonly subs: WhatsAppSubscriptionsService,
    private readonly charges: WhatsAppChargesService,
    private readonly presenter: WhatsAppPresenter,
  ) {}

  onModuleInit() {
    this.hooks.on('subscription_event', (e) => this.safe('subscription_event', () => this.onSubscription(e)));
    this.hooks.on('charge_created', (e) => this.safe('charge_created', () => this.onCharge('charge.created', e)));
    this.hooks.on('charge_paid', (e) => this.safe('charge_paid', () => this.onCharge('charge.paid', e)));
    this.hooks.on('charge_expired', (e) => this.safe('charge_expired', () => this.onCharge('charge.expired', e)));
    this.hooks.on('charge_canceled', (e) => this.safe('charge_canceled', () => this.onCharge('charge.canceled', e)));
    this.hooks.on('customer_created', (e) => this.safe('customer_created', () => this.onCustomer('customer.created', e)));
    this.hooks.on('customer_updated', (e) => this.safe('customer_updated', () => this.onCustomer('customer.updated', e)));
    this.hooks.on('entitlement_changed', (e) => this.safe('entitlement_changed', () => this.onEntitlement(e)));
    this.hooks.on('message', (e) => this.safe('message', () => this.onMessage(e)));
    for (const k of APPT_EVENTS) this.hooks.on(`appointment_${k}`, (e) => this.safe(`appointment_${k}`, () => this.onAppointment(`appointment.${k}`, e)));

    // Fase 6B (chamados)
    this.hooks.on('ticket_created', (e) => this.safe('ticket_created', () => this.onTicket('ticket.created', e)));
    this.hooks.on('ticket_updated', (e) => this.safe('ticket_updated', () => this.onTicket('ticket.updated', e)));
    this.hooks.on('ticket_commented', (e) => this.safe('ticket_commented', () => (e?.visibility === 'public' ? this.onTicket('ticket.commented', e) : Promise.resolve())));
    this.hooks.on('ticket_sla', (e) => this.safe('ticket_sla', () => (e?.phase === 'breached' ? this.onTicket('ticket.sla_breached', e) : Promise.resolve())));
    // Fase 7 (pedidos)
    for (const k of ['created', 'updated', 'paid']) this.hooks.on(`order_${k}`, (e) => this.safe(`order_${k}`, () => this.onOrder(`order.${k}`, e)));
    // LGPD (A-6): fora da fila (é raro e precisa limpar as entregas antes do aviso)
    this.hooks.on('customer_erased', (e) => this.onCustomerErased(e).catch((err) => this.logger.warn(`webhook (customer_erased): ${err?.message || err}`)));
  }

  /** Cliente sendo apagado agora (ou há < 10 min)? Evento com dados dele não sai. */
  private erasing(orgId: string, ...customerIds: Array<string | null | undefined>) {
    return anyErasing(orgId, customerIds);
  }

  private async onCustomerErased(e: any) {
    const orgId = e?.orgId;
    const customerId = e?.customer_id ? String(e.customer_id) : '';
    if (!orgId || !customerId) return;
    const needles = [customerId, ...(Array.isArray(e.needles) ? e.needles.map(String) : [])];
    const removed = await this.svc.purgeForCustomer(orgId, needles).catch(() => 0);
    // segunda passada: entrega que estava em voo (`sending`) e voltou para a fila
    setTimeout(() => void this.svc.purgeForCustomer(orgId, needles).then((n) => { if (n) this.logger.log(`LGPD: +${n} entrega(s) de webhook do cliente ${customerId} apagada(s)`); }).catch(() => undefined), 90_000);
    if (removed) this.logger.log(`LGPD: ${removed} entrega(s) de webhook do cliente ${customerId} apagada(s)`);
    if (!(await this.svc.hasSubscribers(orgId, 'customer.erased'))) return;
    await this.svc.dispatch(orgId, 'customer.erased', {
      id: customerId,
      erased_at: e.erased_at || new Date().toISOString(),
      delete_messages: Boolean(e.delete_messages),
      subscription_ids: Array.isArray(e.subscription_ids) ? e.subscription_ids.slice(0, 500) : [],
      entitlement_ids: Array.isArray(e.entitlement_ids) ? e.entitlement_ids.slice(0, 500) : [],
      charge_ids_canceled: Array.isArray(e.charge_ids) ? e.charge_ids.slice(0, 500) : [],
    });
  }

  /** Pedidos (Fase 7): pedido formatado, sem `created_by`. */
  private async onOrder(event: string, e: any) {
    const orgId = e?.orgId;
    const o = e?.order;
    if (!orgId || !o?.id || !(await this.svc.hasSubscribers(orgId, event))) return;
    if (this.erasing(orgId, o.customer_id)) return;
    const { created_by, ...rest } = o; // eslint-disable-line @typescript-eslint/no-unused-vars
    await this.svc.dispatch(orgId, event, { ...rest, ...(e.from ? { from_status: e.from } : {}), ...(e.by ? { by: e.by } : {}) });
  }

  /** Chamados (Fase 6B): chamado formatado, sem `custom`/`created_by` internos. */
  private async onTicket(event: string, e: any) {
    const orgId = e?.orgId;
    const t = e?.ticket;
    if (!orgId || !t?.id || !(await this.svc.hasSubscribers(orgId, event))) return;
    if (this.erasing(orgId, t.customer_id)) return;
    const { custom, created_by, ...rest } = t; // eslint-disable-line @typescript-eslint/no-unused-vars
    await this.svc.dispatch(orgId, event, { ...rest, ...(e.changes ? { changes: e.changes } : {}), ...(e.comment ? { comment: e.comment } : {}), ...(e.by ? { by: e.by } : {}) });
  }

  /** Agenda (Fase 6): o hook já traz o agendamento formatado; sai sem o `custom`/`reminders` internos. */
  private async onAppointment(event: string, e: any) {
    const orgId = e?.orgId;
    const a = e?.appointment;
    if (!orgId || !a?.id || !(await this.svc.hasSubscribers(orgId, event))) return;
    if (event === 'appointment.canceled' && a.cancel_reason === 'remarcado') return; // remarcação sai como appointment.rescheduled
    if (this.erasing(orgId, a.customer_id, a.customer?.id)) return;
    const pub = (x: any) => {
      if (!x) return null;
      const { custom, reminders, created_by, ...rest } = x; // eslint-disable-line @typescript-eslint/no-unused-vars
      return rest;
    };
    await this.svc.dispatch(orgId, event, { ...pub(a), ...(e.from ? { rescheduled_from_appointment: pub(e.from) } : {}), ...(e.by ? { by: e.by } : {}) });
  }

  /** Enfileira o handler (concorrência QUEUE_CONCURRENCY). Fila cheia = descarta com aviso (nunca trava quem emitiu). */
  private safe(kind: string, fn: () => Promise<unknown>) {
    if (this.queue.length >= QUEUE_MAX) {
      if (this.dropped++ % 1000 === 0) this.logger.warn(`webhooks: fila interna cheia (${QUEUE_MAX}) — evento ${kind} descartado (${this.dropped} no total)`);
      return;
    }
    this.queue.push({ kind, fn });
    this.pump();
  }

  private pump() {
    while (this.running < QUEUE_CONCURRENCY && this.queue.length) {
      const job = this.queue.shift()!;
      this.running++;
      Promise.resolve()
        .then(job.fn)
        .catch((e: any) => this.logger.warn(`webhook (${job.kind}): ${e?.message || e}`))
        .finally(() => { this.running--; this.pump(); });
    }
  }

  private async onSubscription(e: any) {
    const orgId = e?.orgId;
    const kind = String(e?.kind || '');
    const event = kind === 'canceled' && e?.data?.scheduled ? SUB_EVENTS.cancel_scheduled : SUB_EVENTS[kind];
    if (!orgId || !event || !(await this.svc.hasSubscribers(orgId, event))) return;
    const subId = e.subscription_id || e.subscriptionId || e.subscription?.id;
    if (!subId) return;
    const sub = await this.subs.get(orgId, String(subId)).catch(() => null);
    if (!sub || this.erasing(orgId, sub.customer_id)) return;
    const customer = await basicCustomer(this.prisma, orgId, sub.customer_id);
    await this.svc.dispatch(orgId, event, { ...publicSubscription(sub), customer, detail: e.data ?? null });
  }

  private async onCharge(event: string, e: any) {
    const orgId = e?.orgId || e?.charge?.organization_id;
    if (!orgId || !(await this.svc.hasSubscribers(orgId, event))) return;
    const id = e?.charge?.id || e?.charge_id;
    if (!id) return;
    const c: any = await this.charges.get(orgId, String(id)).catch(() => null);
    if (!c || this.erasing(orgId, c.customer_id)) return;
    const pc: any = publicCharge(c);
    // o evento chega logo depois da troca de status; se a leitura ainda vê PENDING, vale o status do evento
    const evStatus = event === 'charge.expired' ? 'EXPIRED' : event === 'charge.canceled' ? 'CANCELED' : event === 'charge.paid' ? 'PAID' : null;
    if (evStatus && pc.status === 'PENDING') pc.status = evStatus;
    const customer = await basicCustomer(this.prisma, orgId, c.customer_id);
    await this.svc.dispatch(orgId, event, { ...pc, customer, ...(e?.via ? { paid_via_event: e.via } : {}), ...(e?.reason ? { reason: e.reason } : {}) });
  }

  private async onCustomer(event: string, e: any) {
    const orgId = e?.orgId;
    if (!orgId || this.erasing(orgId, e?.customer_id || e?.customer?.id) || !(await this.svc.hasSubscribers(orgId, event))) return;
    const customer = await basicCustomer(this.prisma, orgId, e?.customer_id || e?.customer?.id);
    if (!customer) return;
    await this.svc.dispatch(orgId, event, customer);
  }

  private async onEntitlement(e: any) {
    const orgId = e?.orgId;
    const event = ENT_EVENTS[String(e?.to || '')];
    if (!orgId || !event || !(await this.svc.hasSubscribers(orgId, event))) return;
    let row = e?.entitlement;
    // o motor manda a linha JÁ formatada (session = objeto); relê a linha crua para formatar igual à API
    if (row?.id) row = (await this.prisma.whatsapp_entitlements.findUnique({ where: { id: String(row.id) } })) || row;
    if (!row?.id || this.erasing(orgId, row.customer_id)) return;
    const [shaped] = await shapeEntitlements(this.prisma, (o) => this.presenter.sessionMap(o), orgId, [row]);
    await this.svc.dispatch(orgId, event, { ...shaped, from: e.from ?? null, to: e.to });
  }

  private async onMessage(e: any) {
    const orgId = e?.orgId;
    const m = e?.message;
    const chatId = String(e?.chatId || m?.chat_id || '');
    if (!orgId || !m || m.direction !== 'IN' || m.type !== 'text' || !INDIVIDUAL_RE.test(chatId)) return;
    const text = String(m.body || '').trim();
    if (!text || !(await this.svc.hasSubscribers(orgId, 'message.received'))) return;
    const phone = phoneFromJid(chatId);
    const contact = await this.prisma.whatsapp_contacts.findFirst({ where: { organization_id: orgId, OR: [{ wa_id: chatId }, { lid: chatId }, ...(phone ? [{ phone }] : [])] }, select: { id: true, name: true, push_name: true, phone: true, opted_out_at: true } });
    if (contact?.opted_out_at) return; // descadastrado: nunca sai do Pub Mail
    const sessionId = e.sessionId || m.session_id;
    const [chat, links] = await Promise.all([
      this.prisma.whatsapp_chats.findFirst({ where: { organization_id: orgId, session_id: sessionId, chat_id: chatId }, select: { id: true } }),
      contact ? this.prisma.whatsapp_customer_contacts.findMany({ where: { contact_id: contact.id }, select: { customer_id: true } }) : Promise.resolve([] as Array<{ customer_id: string }>),
    ]);
    const customerIds = [...new Set(links.map((l) => l.customer_id))];
    if (customerIds.some((id) => isErasing(orgId, id))) return;
    await this.svc.dispatch(orgId, 'message.received', {
      message_id: m.id, wa_message_id: m.wa_message_id || null, session_id: sessionId, chat_id: chat?.id || null, jid: chatId,
      from: contact?.phone || phone || null,
      contact: contact ? { id: contact.id, name: contact.name || contact.push_name || null, phone: contact.phone || null } : null,
      customer_ids: customerIds,
      text, timestamp: m.timestamp || null,
    });
  }
}
