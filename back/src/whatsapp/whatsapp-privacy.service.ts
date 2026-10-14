import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { promises as fsp } from 'fs';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrgAuditService } from '../audit/org-audit.service';
import { WhatsAppSubscriptionsService } from './whatsapp-subscriptions.service';
import { WhatsAppChargesService } from './whatsapp-charges.service';
import { WhatsAppEntitlementsService } from './whatsapp-entitlements.service';
import { WhatsAppSchedulingService } from './scheduling/whatsapp-scheduling.service';
import { WhatsAppMediaService } from './whatsapp-media.service';
import { WhatsAppOutboxService } from './whatsapp-outbox.service';
import { WhatsAppHooks } from './whatsapp-hooks.service';
import { digitsOf } from './wa-jid.util';
import { finishErasing, markErasing } from '../org-webhooks/erasing.registry';

// ============================================================================
// LGPD do cliente (Fase 8, contrato §12.4).
//  - export(): JSON com tudo que a organização guarda sobre o cliente (conversas = metadados + mensagens
//    decifradas, sem arquivos de mídia; cartões só mascarados).
//  - erase(): cancela assinaturas (imediato, revoga acessos), cobranças pendentes (no gateway), remove cartões,
//    cancela agendamentos/chamados/pedidos em aberto, apaga textos livres e ANONIMIZA o cliente e os contatos
//    que não são de outro cliente. Cobranças PAGAS ficam (obrigação legal), só sem dados pessoais.
//    `delete_messages` também apaga conversas, mensagens e mídias desses contatos (arquivo + linha).
// Ninguém depende deste serviço (sem ciclo de DI). Grava a auditoria `customers.erase` / `customers.export`.
// ============================================================================

const REASON = 'Dados apagados a pedido do titular (LGPD)';
const ERASED_NAME = 'Cliente removido';
const MSG_PER_CHAT = 5_000;
const MSG_TOTAL = 20_000;
const OPEN_APPT = ['pending_payment', 'booked', 'confirmed'];
const OPEN_ORDER = ['new', 'confirmed', 'preparing', 'out_for_delivery'];
const OPEN_TICKET = ['open', 'pending'];

export type PrivacyActor = { userId: string | null; ip?: string | null; method?: string; path?: string };

const jidsOf = (ct: { wa_id?: string | null; lid?: string | null; phone?: string | null }) => {
  const out = new Set<string>();
  if (ct.wa_id) out.add(ct.wa_id);
  if (ct.lid) out.add(ct.lid);
  const d = digitsOf(ct.phone || '');
  if (d) { out.add(`${d}@c.us`); out.add(`${d}@s.whatsapp.net`); }
  return [...out];
};

@Injectable()
export class WhatsAppPrivacyService {
  private readonly logger = new Logger(WhatsAppPrivacyService.name);
  private readonly running = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: WhatsAppSubscriptionsService,
    private readonly charges: WhatsAppChargesService,
    private readonly entitlements: WhatsAppEntitlementsService,
    private readonly scheduling: WhatsAppSchedulingService,
    private readonly media: WhatsAppMediaService,
    private readonly audit: OrgAuditService,
    private readonly outbox: WhatsAppOutboxService,
    private readonly hooks: WhatsAppHooks,
  ) {}

  private async customer(orgId: string, id: string) {
    const c = await this.prisma.whatsapp_customers.findFirst({ where: { id: String(id), organization_id: orgId } });
    if (!c) throw new NotFoundException('Cliente não encontrado.');
    return c;
  }

  /** Contatos do cliente: todos, os que são SÓ dele (sem outro cliente) e os compartilhados. */
  private async contactsOf(orgId: string, c: { id: string; contact_id: string }) {
    const links = await this.prisma.whatsapp_customer_contacts.findMany({ where: { customer_id: c.id } });
    const ids = [...new Set([c.contact_id, ...links.map((l) => l.contact_id)].filter(Boolean))];
    const contacts = ids.length ? await this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, id: { in: ids } } }) : [];
    const [otherLinks, otherMain] = await Promise.all([
      ids.length ? this.prisma.whatsapp_customer_contacts.findMany({ where: { contact_id: { in: ids }, customer_id: { not: c.id } }, select: { contact_id: true, customer_id: true } }) : Promise.resolve([] as any[]),
      ids.length ? this.prisma.whatsapp_customers.findMany({ where: { organization_id: orgId, contact_id: { in: ids }, id: { not: c.id } }, select: { contact_id: true } }) : Promise.resolve([] as any[]),
    ]);
    // vínculo com cliente de OUTRA org não existe (contato é por org), mas confere mesmo assim
    const otherCustIds = [...new Set(otherLinks.map((l) => l.customer_id))];
    const sameOrg = otherCustIds.length ? new Set((await this.prisma.whatsapp_customers.findMany({ where: { id: { in: otherCustIds }, organization_id: orgId }, select: { id: true } })).map((x) => x.id)) : new Set<string>();
    const shared = new Set<string>([...otherLinks.filter((l) => sameOrg.has(l.customer_id)).map((l) => l.contact_id), ...otherMain.map((x) => x.contact_id)]);
    return { links, contacts, own: contacts.filter((ct) => !shared.has(ct.id)), shared: contacts.filter((ct) => shared.has(ct.id)) };
  }

  // ====================================================================== exportar
  async export(orgId: string, customerId: string, actor: PrivacyActor) {
    const c = await this.customer(orgId, customerId);
    const { links, contacts } = await this.contactsOf(orgId, c);
    const contactIds = contacts.map((x) => x.id);
    const jids = [...new Set(contacts.flatMap(jidsOf))];
    const byCustomerOrContact = { organization_id: orgId, OR: [{ customer_id: c.id }, ...(contactIds.length ? [{ contact_id: { in: contactIds } }] : [])] };

    const [subs, charges, appointments, waitlist, tickets, orders, entitlements, methods, tasks, sessions] = await Promise.all([
      this.prisma.whatsapp_subscriptions.findMany({ where: { organization_id: orgId, customer_id: c.id }, orderBy: { created_at: 'asc' } }),
      this.prisma.whatsapp_charges.findMany({ where: { organization_id: orgId, customer_id: c.id }, orderBy: { created_at: 'asc' } }),
      this.prisma.whatsapp_appointments.findMany({ where: byCustomerOrContact, orderBy: { starts_at: 'asc' } }),
      this.prisma.whatsapp_waitlist.findMany({ where: byCustomerOrContact, orderBy: { created_at: 'asc' } }),
      this.prisma.whatsapp_tickets.findMany({ where: byCustomerOrContact, orderBy: { created_at: 'asc' } }),
      this.prisma.whatsapp_orders.findMany({ where: byCustomerOrContact, orderBy: { created_at: 'asc' } }),
      this.prisma.whatsapp_entitlements.findMany({ where: { organization_id: orgId, customer_id: c.id } }),
      this.prisma.whatsapp_payment_methods.findMany({ where: { organization_id: orgId, customer_id: c.id } }),
      this.prisma.whatsapp_tasks.findMany({ where: { organization_id: orgId, customer_id: c.id } }),
      this.prisma.whatsapp_sessions.findMany({ where: { organization_id: orgId }, select: { id: true, label: true, phone: true } }),
    ]);
    const subIds = subs.map((s) => s.id);
    const ticketIds = tickets.map((t) => t.id);
    const [subEvents, ticketEvents] = await Promise.all([
      subIds.length ? this.prisma.whatsapp_subscription_events.findMany({ where: { organization_id: orgId, subscription_id: { in: subIds } }, orderBy: { created_at: 'asc' } }) : Promise.resolve([] as any[]),
      ticketIds.length ? this.prisma.whatsapp_ticket_events.findMany({ where: { organization_id: orgId, ticket_id: { in: ticketIds } }, orderBy: { created_at: 'asc' } }) : Promise.resolve([] as any[]),
    ]);
    const sessionOf = new Map(sessions.map((s) => [s.id, { id: s.id, label: s.label, phone: s.phone }]));

    // conversas individuais da pessoa (em todos os números) — metadados + mensagens decifradas, sem arquivo
    const chats = jids.length
      ? await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, kind: 'individual', chat_id: { in: jids } }, orderBy: { last_message_at: 'desc' } })
      : [];
    let budget = MSG_TOTAL;
    let truncated = false;
    const conversations: any[] = [];
    const mediaIds = new Set<string>();
    const msgsByChat = new Map<string, any[]>();
    for (const ch of chats) {
      const take = Math.min(MSG_PER_CHAT, budget);
      const msgs = take > 0
        ? await this.prisma.whatsapp_messages.findMany({
            where: { organization_id: orgId, session_id: ch.session_id, chat_id: ch.chat_id },
            orderBy: { timestamp: 'desc' },
            take,
            select: { id: true, direction: true, type: true, body: true, timestamp: true, sender_name: true, quoted_preview: true, forwarded: true, edited: true, revoked: true, media_id: true, created_at: true },
          })
        : [];
      if (msgs.length >= take) truncated = true;
      budget -= msgs.length;
      msgs.reverse();
      for (const m of msgs) if (m.media_id) mediaIds.add(m.media_id);
      msgsByChat.set(ch.id, msgs);
    }
    const mediaRows = mediaIds.size ? await this.prisma.whatsapp_media.findMany({ where: { organization_id: orgId, id: { in: [...mediaIds] } }, select: { id: true, mime: true, filename: true, size_bytes: true } }) : [];
    const mediaOf = new Map(mediaRows.map((m) => [m.id, { mime: m.mime, filename: m.filename, size_bytes: m.size_bytes }]));
    const notes = chats.length
      ? await this.prisma.whatsapp_chat_notes.findMany({ where: { organization_id: orgId, OR: chats.map((ch) => ({ session_id: ch.session_id, chat_id: ch.chat_id })) }, orderBy: { created_at: 'asc' } })
      : [];
    for (const ch of chats) {
      conversations.push({
        number: sessionOf.get(ch.session_id) || { id: ch.session_id },
        whatsapp_id: ch.chat_id,
        name: ch.name,
        created_at: ch.created_at,
        last_message_at: ch.last_message_at,
        messages: (msgsByChat.get(ch.id) || []).map((m) => ({
          direction: m.direction === 'IN' ? 'recebida' : 'enviada',
          type: m.type,
          text: m.body,
          at: m.timestamp || m.created_at,
          sender_name: m.sender_name,
          quoted: m.quoted_preview || undefined,
          forwarded: m.forwarded || undefined,
          edited: m.edited || undefined,
          revoked: m.revoked || undefined,
          media: m.media_id ? mediaOf.get(m.media_id) || { unavailable: true } : undefined,
        })),
      });
    }

    const strip = (row: any, drop: string[]) => { const o = { ...row }; for (const k of drop) delete o[k]; return o; };
    const out = {
      format: 'pubmail.lgpd.customer.v1',
      generated_at: new Date().toISOString(),
      organization_id: orgId,
      notice: 'Dados pessoais deste cliente guardados pela organização no Pub Mail (LGPD, art. 18). Arquivos de mídia não são incluídos; cartões aparecem mascarados.',
      customer: strip(c, ['doc_hash', 'organization_id']),
      contacts: contacts.map((ct) => ({
        id: ct.id, phone: ct.phone, whatsapp_id: ct.wa_id, lid: ct.lid, name: ct.name, push_name: ct.push_name, tags: ct.tags, notes: ct.notes,
        opted_out_at: ct.opted_out_at, created_at: ct.created_at,
        role: links.find((l) => l.contact_id === ct.id)?.role || (ct.id === c.contact_id ? 'owner' : null),
        primary: ct.id === c.contact_id,
      })),
      subscriptions: subs.map((s) => ({ ...strip(s, ['organization_id']), events: subEvents.filter((e) => e.subscription_id === s.id).map((e) => strip(e, ['organization_id', 'subscription_id'])) })),
      charges: charges.map((x) => strip(x, ['organization_id', 'pay_link_token', 'pix_qr_media_id'])),
      payment_methods: methods.map((m) => ({ id: m.id, provider: m.provider, brand: m.brand, card: m.last4 ? `•••• ${m.last4}` : null, status: m.status, created_at: m.created_at, last_used_at: m.last_used_at })),
      appointments: appointments.map((a) => strip(a, ['organization_id'])),
      waitlist: waitlist.map((w) => strip(w, ['organization_id'])),
      tickets: tickets.map((t) => ({ ...strip(t, ['organization_id']), events: ticketEvents.filter((e) => e.ticket_id === t.id).map((e) => strip(e, ['organization_id', 'ticket_id'])) })),
      orders: orders.map((o) => strip(o, ['organization_id'])),
      entitlements: entitlements.map((e) => strip(e, ['organization_id'])),
      tasks: tasks.map((t) => strip(t, ['organization_id'])),
      notes: notes.map((n) => ({ chat: n.chat_id, number: sessionOf.get(n.session_id || "")?.label || null, text: n.text, created_at: n.created_at })),
      conversations,
      limits: { messages_per_conversation: MSG_PER_CHAT, messages_total: MSG_TOTAL, truncated },
    };
    void this.audit.log({
      orgId, userId: actor.userId, action: 'customers.export', entity: 'customers', entityId: c.id,
      summary: `Exportou os dados pessoais (LGPD) do cliente “${c.name}”`.slice(0, 255),
      changes: { customer_id: c.id, body: { conversations: conversations.length, messages: MSG_TOTAL - budget, truncated } },
      method: actor.method || 'GET', path: actor.path || null, status: 200, ip: actor.ip || null,
    });
    return out;
  }

  // ====================================================================== apagar (anonimizar)
  /**
   * Revisão de 14/10/2026 (A-1, A-2, A-4, A-6, A-7, A-18):
   *  - REFAZÍVEL: o `erased_at` (e a anonimização do cadastro + a saída dos vínculos de número) só é gravado no FIM;
   *    se algo falhar no meio, chamar de novo refaz só o que faltou (cada passo é idempotente). Mensagens saem em
   *    lotes por id, fora de uma transação única.
   *  - Webhooks: enquanto apaga (e por 10 min depois), nenhum evento com dados do cliente sai (`erasing.registry`); no
   *    fim, as entregas que citam o cliente são apagadas e sai só `customer.erased` (ids, sem dados pessoais).
   *  - Fila: o conteúdo de TODAS as linhas dos números do cliente é apagado; lembretes das cobranças DELE são
   *    cancelados/zerados também em número compartilhado (`charge:<id>:`).
   *  - Bot: `vars` das sessões do bot dos números do cliente zeradas sempre (CPF, e-mail, endereço…).
   *  - Também saem: alvo (telefone) dos direitos de acesso já revogados, `external_id`/`contract_number` das
   *    assinaturas, observações do histórico dos pedidos.
   *  - Auditoria: as linhas sobre o cliente perdem o conteúdo e o nome; o registro do apagamento não leva o nome.
   */
  async erase(orgId: string, customerId: string, dto: { confirm?: string; delete_messages?: boolean }, actor: PrivacyActor) {
    if (String(dto?.confirm || '').trim().toUpperCase() !== 'APAGAR') throw new BadRequestException('Para confirmar, digite APAGAR.');
    const c = await this.customer(orgId, customerId);
    if (c.erased_at) throw new BadRequestException('Os dados deste cliente já foram apagados (LGPD).');
    if (this.running.has(c.id)) throw new BadRequestException('Os dados deste cliente já estão sendo apagados. Aguarde.');
    this.running.add(c.id);
    markErasing(orgId, c.id);
    const deleteMessages = dto?.delete_messages === true;
    const r = {
      subscriptions_canceled: 0, charges_canceled: 0, charges_anonymized: 0, cards_removed: 0, entitlements_revoked: 0,
      appointments_canceled: 0, waitlist_canceled: 0, tickets_closed: 0, orders_canceled: 0, tasks_deleted: 0,
      contacts_anonymized: 0, contacts_shared_kept: 0, outbox_canceled: 0, outbox_redacted: 0, bot_sessions_cleared: 0,
      chats_deleted: 0, messages_deleted: 0, media_deleted: 0, audit_redacted: 0,
      warnings: [] as string[],
    };
    const warn = (msg: string) => { if (r.warnings.length < 30) r.warnings.push(msg.slice(0, 200)); };
    const now = new Date();
    const canceledChargeIds: string[] = [];
    let needles: string[] = [];
    let step = 'início';
    try {
      step = 'contatos';
      const { contacts, own, shared } = await this.contactsOf(orgId, c);
      r.contacts_shared_kept = shared.length;
      const ownIds = own.map((x) => x.id);
      const ownJids = [...new Set(own.flatMap(jidsOf))];
      const allJids = [...new Set(contacts.flatMap(jidsOf))];
      const mine = { organization_id: orgId, OR: [{ customer_id: c.id }, ...(ownIds.length ? [{ contact_id: { in: ownIds } }] : [])] };
      // o que identifica a pessoa nas entregas de webhook antigas (apagadas no fim): ids dos contatos e jids só dela
      needles = [...ownIds, ...ownJids];

      // 1) assinaturas: cancelamento imediato (o motor cancela as cobranças delas e avisa o motor de acesso)
      step = 'assinaturas';
      const subs = await this.prisma.whatsapp_subscriptions.findMany({ where: { organization_id: orgId, customer_id: c.id, status: { not: 'canceled' } }, select: { id: true, product_name: true } });
      for (const s of subs) {
        try { await this.subscriptions.cancel(orgId, s.id, { policy: 'immediate', reason: REASON, source: 'panel', user_id: actor.userId }); r.subscriptions_canceled++; }
        catch (e: any) { warn(`Assinatura ${s.product_name}: ${e?.message || e}`); }
      }

      // 2) direitos de acesso: revoga tudo do cliente (inclusive regra "manter ao cancelar") e acorda o worker
      step = 'direitos de acesso';
      {
        const a = await this.prisma.whatsapp_entitlements.updateMany({ where: { organization_id: orgId, customer_id: c.id, desired: { not: 'revoked' }, status: { not: 'failed' } }, data: { desired: 'revoked', next_try_at: now } });
        const b = await this.prisma.whatsapp_entitlements.updateMany({ where: { organization_id: orgId, customer_id: c.id, desired: { not: 'revoked' }, status: 'failed' }, data: { desired: 'revoked', status: 'pending', attempts: 0, error: null, next_try_at: now } });
        r.entitlements_revoked = a.count + b.count;
        if (r.entitlements_revoked) this.entitlements.kick(500);
      }

      // 3) cobranças em aberto: cancela aqui e no gateway
      step = 'cobranças';
      const pending = await this.prisma.whatsapp_charges.findMany({ where: { organization_id: orgId, customer_id: c.id, status: 'PENDING' }, select: { id: true, description: true } });
      for (const ch of pending) {
        try { await this.charges.cancel(orgId, ch.id); r.charges_canceled++; canceledChargeIds.push(ch.id); }
        catch (e: any) { warn(`Cobrança ${ch.description}: ${e?.message || e}`); }
      }

      // 4) cartões salvos: token destruído (o Asaas não tem rota para apagar o token do cartão)
      step = 'cartões';
      const methods = await this.prisma.whatsapp_payment_methods.findMany({ where: { organization_id: orgId, customer_id: c.id, status: 'active' }, select: { id: true } });
      for (const m of methods) {
        try { await this.charges.removePaymentMethod(orgId, c.id, m.id); r.cards_removed++; }
        catch (e: any) { warn(`Cartão: ${e?.message || e}`); }
      }
      await this.prisma.whatsapp_payment_methods.updateMany({ where: { organization_id: orgId, customer_id: c.id }, data: { provider_customer_id: null, brand: null, provider_token: '-' } });

      // 5) agenda: futuros em aberto cancelados (sem aviso ao cliente); textos livres apagados
      step = 'agenda';
      const appts = await this.prisma.whatsapp_appointments.findMany({ where: { ...mine, status: { in: OPEN_APPT }, starts_at: { gte: now } }, select: { id: true, service_name: true } });
      for (const a of appts) {
        try { await this.scheduling.cancel(orgId, a.id, { by: 'system', reason: REASON, notify: false, user_id: actor.userId }); r.appointments_canceled++; }
        catch (e: any) { warn(`Agendamento ${a.service_name}: ${e?.message || e}`); }
      }
      await this.prisma.whatsapp_appointments.updateMany({ where: mine, data: { notes: null, custom: Prisma.DbNull, chat_id: null } });
      r.waitlist_canceled = (await this.prisma.whatsapp_waitlist.updateMany({ where: { ...mine, status: { in: ['waiting', 'offered'] } }, data: { status: 'canceled' } })).count;
      await this.prisma.whatsapp_waitlist.updateMany({ where: mine, data: { chat_id: null } });

      // 6) chamados: abertos fechados; assunto/descrição/comentários apagados (protocolo fica)
      step = 'chamados';
      const tickets = await this.prisma.whatsapp_tickets.findMany({ where: mine, select: { id: true, media_ids: true } });
      const ticketIds = tickets.map((t) => t.id);
      const ticketMedia = new Set<string>();
      if (ticketIds.length) {
        r.tickets_closed = (await this.prisma.whatsapp_tickets.updateMany({ where: { id: { in: ticketIds }, status: { in: OPEN_TICKET } }, data: { status: 'closed', closed_at: now } })).count;
        for (const t of tickets) if (Array.isArray(t.media_ids)) for (const m of t.media_ids as any[]) if (typeof m === 'string') ticketMedia.add(m);
        for (const e of await this.prisma.whatsapp_ticket_events.findMany({ where: { organization_id: orgId, ticket_id: { in: ticketIds }, media_id: { not: null } }, select: { media_id: true } })) if (e.media_id) ticketMedia.add(e.media_id);
        await this.prisma.whatsapp_tickets.updateMany({ where: { id: { in: ticketIds } }, data: { subject: 'Chamado removido (LGPD)', description: null, chat_id: null, custom: Prisma.DbNull, media_ids: Prisma.DbNull } });
        await this.prisma.whatsapp_ticket_events.updateMany({ where: { organization_id: orgId, ticket_id: { in: ticketIds } }, data: { body: null, media_id: null } });
      }

      // 7) pedidos: em aberto cancelados; observações/endereço de entrega apagados; observações do histórico também (A-18)
      step = 'pedidos';
      r.orders_canceled = (await this.prisma.whatsapp_orders.updateMany({ where: { ...mine, status: { in: OPEN_ORDER } }, data: { status: 'canceled', canceled_at: now, cancel_reason: REASON } })).count;
      await this.prisma.whatsapp_orders.updateMany({ where: mine, data: { notes: null, delivery: Prisma.DbNull, custom: Prisma.DbNull, chat_id: null } });
      for (const o of await this.prisma.whatsapp_orders.findMany({ where: mine, select: { id: true, history: true } })) {
        if (!Array.isArray(o.history) || !(o.history as any[]).some((h) => h && typeof h === 'object' && ('note' in h || 'notes' in h || 'reason' in h))) continue;
        const history = (o.history as any[]).map((h) => {
          if (!h || typeof h !== 'object') return h;
          const { note: _n, notes: _ns, reason: _r, ...rest } = h; // eslint-disable-line @typescript-eslint/no-unused-vars
          return rest;
        });
        await this.prisma.whatsapp_orders.update({ where: { id: o.id }, data: { history: history as any } });
      }

      // 8) tarefas do cliente (texto livre da equipe sobre a pessoa)
      step = 'tarefas';
      r.tasks_deleted = (await this.prisma.whatsapp_tasks.deleteMany({ where: { organization_id: orgId, customer_id: c.id } })).count;

      // 9) cobranças restantes (pagas = obrigação legal): ficam, só com o nome do produto
      step = 'cobranças pagas';
      const rest = await this.prisma.whatsapp_charges.findMany({ where: { organization_id: orgId, customer_id: c.id }, select: { id: true, product_id: true, subscription_id: true } });
      const allChargeIds = rest.map((x) => x.id);
      if (rest.length) {
        const prodIds = [...new Set(rest.map((x) => x.product_id).filter(Boolean))] as string[];
        const subIds = [...new Set(rest.map((x) => x.subscription_id).filter(Boolean))] as string[];
        const [prods, subRows] = await Promise.all([
          prodIds.length ? this.prisma.whatsapp_products.findMany({ where: { organization_id: orgId, id: { in: prodIds } }, select: { id: true, name: true } }) : Promise.resolve([] as any[]),
          subIds.length ? this.prisma.whatsapp_subscriptions.findMany({ where: { organization_id: orgId, id: { in: subIds } }, select: { id: true, product_name: true } }) : Promise.resolve([] as any[]),
        ]);
        const pName = new Map(prods.map((p) => [p.id, p.name]));
        const sName = new Map(subRows.map((s) => [s.id, s.product_name]));
        const groups = new Map<string, string[]>();
        for (const x of rest) {
          const d = String((x.product_id && pName.get(x.product_id)) || (x.subscription_id && sName.get(x.subscription_id)) || 'Cobrança').slice(0, 255);
          groups.set(d, [...(groups.get(d) || []), x.id]);
        }
        for (const [description, ids] of groups) {
          for (let i = 0; i < ids.length; i += 500) {
            r.charges_anonymized += (await this.prisma.whatsapp_charges.updateMany({ where: { id: { in: ids.slice(i, i + 500) } }, data: { description, custom: Prisma.DbNull, chat_id: '', error: null } })).count;
          }
        }
      }
      // assinaturas: observações, campos livres e identificadores externos (A-18)
      await this.prisma.whatsapp_subscriptions.updateMany({ where: { organization_id: orgId, customer_id: c.id }, data: { notes: null, custom: Prisma.DbNull, external_id: null, contract_number: null } });

      // 10) fila de envios (A-4, A-18): conteúdo de TODAS as linhas dos números só dele; lembretes das cobranças dele
      //     também em número compartilhado (chave `charge:<id>:`)
      step = 'fila de envios';
      if (ownJids.length) {
        const q = await this.outbox.redactForJids(orgId, ownJids);
        r.outbox_canceled += q.canceled;
        r.outbox_redacted += q.redacted;
      }
      for (let i = 0; i < allChargeIds.length; i += 100) {
        const ors = allChargeIds.slice(i, i + 100).map((id) => ({ dedupe_key: { startsWith: `charge:${id}:` } }));
        const empty = { messages: [], redacted: true } as any;
        const a = await this.prisma.whatsapp_outbox.updateMany({ where: { organization_id: orgId, status: { in: ['pending', 'sending'] }, OR: ors }, data: { status: 'canceled', payload: empty, last_error: REASON } });
        const b = await this.prisma.whatsapp_outbox.updateMany({ where: { organization_id: orgId, status: { notIn: ['pending', 'sending'] }, OR: ors }, data: { payload: empty } });
        r.outbox_canceled += a.count;
        r.outbox_redacted += a.count + b.count;
      }

      // 11) bot (A-7): variáveis guardadas nas conversas do cliente (CPF, e-mail, endereço…) — sempre
      step = 'bot';
      for (let i = 0; i < allJids.length; i += 500) {
        r.bot_sessions_cleared += (await this.prisma.whatsapp_bot_sessions.updateMany({ where: { organization_id: orgId, chat_id: { in: allJids.slice(i, i + 500) } }, data: { vars: Prisma.DbNull } })).count;
      }

      // 12) contatos só deste cliente: sem nome/foto/observações, descadastrados (LGPD)
      step = 'contatos (anonimizar)';
      const photoMedia = own.map((x) => x.profile_pic_media_id).filter(Boolean) as string[];
      if (ownIds.length) {
        r.contacts_anonymized = (await this.prisma.whatsapp_contacts.updateMany({
          where: { organization_id: orgId, id: { in: ownIds } },
          data: { name: null, push_name: null, notes: null, tags: Prisma.DbNull, saved: false, is_my_contact: false, profile_pic_media_id: null, profile_pic_url: null, profile_pic_checked_at: null },
        })).count;
        await this.prisma.whatsapp_contacts.updateMany({ where: { organization_id: orgId, id: { in: ownIds }, opted_out_at: null }, data: { opted_out_at: now } });
        // nome da conversa (a lista mostra o telefone no lugar)
        if (ownJids.length) await this.prisma.whatsapp_chats.updateMany({ where: { organization_id: orgId, kind: 'individual', chat_id: { in: ownJids } }, data: { name: null } });
      }

      // 13) conversas, mensagens e mídias (opcional) — só dos contatos que não são de outro cliente. Em LOTES por id,
      //     fora de uma transação única (A-2): conversa longa não estoura o tempo e uma falha no meio pode ser refeita.
      step = 'conversas';
      const mediaToDelete = new Set<string>([...photoMedia, ...ticketMedia]);
      if (deleteMessages && ownJids.length) {
        const chatWhere = { organization_id: orgId, chat_id: { in: ownJids } };
        for (let i = 0; i < 2_000; i++) {
          const batch = await this.prisma.whatsapp_messages.findMany({ where: chatWhere, select: { id: true, media_id: true }, take: 1_000 });
          if (!batch.length) break;
          for (const m of batch) if (m.media_id) mediaToDelete.add(m.media_id);
          r.messages_deleted += (await this.prisma.whatsapp_messages.deleteMany({ where: { id: { in: batch.map((m) => m.id) } } })).count;
          if (batch.length < 1_000) break;
        }
        for (const st of await this.prisma.whatsapp_contact_statuses.findMany({ where: { organization_id: orgId, contact_jid: { in: ownJids }, media_id: { not: null } }, select: { media_id: true } })) if (st.media_id) mediaToDelete.add(st.media_id);
        await this.prisma.whatsapp_chat_notes.deleteMany({ where: chatWhere });
        await this.prisma.whatsapp_service_events.deleteMany({ where: chatWhere });
        await this.prisma.whatsapp_bot_sessions.deleteMany({ where: chatWhere });
        await this.prisma.whatsapp_ratings.deleteMany({ where: chatWhere });
        await this.prisma.whatsapp_contact_statuses.deleteMany({ where: { organization_id: orgId, contact_jid: { in: ownJids } } });
        r.chats_deleted = (await this.prisma.whatsapp_chats.deleteMany({ where: { organization_id: orgId, kind: 'individual', chat_id: { in: ownJids } } })).count;
      } else if (ownJids.length) {
        // sem apagar as conversas: as notas internas da equipe sobre a pessoa saem mesmo assim
        await this.prisma.whatsapp_chat_notes.deleteMany({ where: { organization_id: orgId, chat_id: { in: ownJids } } });
      }

      // mídias: linha + arquivo (as usadas em configuração — respostas rápidas, fluxo, campanhas — ficam)
      step = 'mídias';
      if (mediaToDelete.size) {
        const keep = await this.media.referencedIds([orgId]).catch(() => new Set<string>());
        const ids = [...mediaToDelete].filter((id) => !keep.has(id));
        for (let i = 0; i < ids.length; i += 500) {
          const files = await this.prisma.whatsapp_media.findMany({ where: { organization_id: orgId, id: { in: ids.slice(i, i + 500) } }, select: { id: true, storage_path: true } });
          if (!files.length) continue;
          await this.prisma.whatsapp_media.deleteMany({ where: { organization_id: orgId, id: { in: files.map((f) => f.id) } } });
          for (const f of files) {
            try { await fsp.unlink(this.media.absPath(f)); r.media_deleted++; } catch { /* já não existe */ }
          }
        }
      }

      if (deleteMessages && !ownJids.length && allJids.length) warn('Os números deste cliente também são de outro cliente — as conversas foram mantidas.');

      // 14) POR ÚLTIMO (A-2): o cadastro anonimizado + vínculos de número fora + `erased_at`. Antes disto, chamar de
      //     novo refaz o que faltou; depois, o cliente está apagado.
      step = 'cadastro';
      await this.prisma.$transaction([
        this.prisma.whatsapp_customer_contacts.deleteMany({ where: { customer_id: c.id } }),
        this.prisma.whatsapp_customers.update({
          where: { id: c.id },
          data: {
            name: ERASED_NAME, doc: null, doc_hash: null, email: null, address: Prisma.DbNull, addresses: Prisma.DbNull, notes: null,
            custom: Prisma.DbNull, code: null, external_id: null, provider_refs: Prisma.DbNull, erased_at: now, status: 'inactive',
          },
        }),
      ]);
    } catch (e: any) {
      this.running.delete(c.id);
      finishErasing(orgId, c.id);
      this.logger.warn(`LGPD: apagamento do cliente ${c.id} (org ${orgId}) parou em "${step}": ${e?.message || e}`);
      throw new BadRequestException(`O apagamento parou em "${step}" (${String(e?.message || e).slice(0, 160)}). Nada foi perdido: clique em apagar de novo para concluir — o que já foi feito não se repete.`);
    }

    // ---- depois de apagado: limpezas que não podem desfazer o apagamento (best-effort)
    try {
      // direitos já revogados: o alvo (telefone) sai; os que ainda vão ser revogados o motor limpa depois
      for (const row of await this.prisma.whatsapp_entitlements.findMany({ where: { organization_id: orgId, customer_id: c.id, status: 'revoked', desired: 'revoked', NOT: { target: '' } }, select: { id: true, rule_id: true } })) {
        await this.prisma.whatsapp_entitlements
          .update({ where: { id: row.id }, data: { target: '', rule_id: `${String(row.rule_id).split('~')[0].slice(0, 8)}~${row.id.replace(/-/g, '').slice(0, 6)}` } })
          .catch(() => undefined);
      }
      const subIds = (await this.prisma.whatsapp_subscriptions.findMany({ where: { organization_id: orgId, customer_id: c.id }, select: { id: true } })).map((x) => x.id);
      const chargeIds = (await this.prisma.whatsapp_charges.findMany({ where: { organization_id: orgId, customer_id: c.id }, select: { id: true } })).map((x) => x.id);
      r.audit_redacted = await this.audit.redactCustomer(orgId, c.id, [{ entity: 'subscriptions', ids: subIds }, { entity: 'charges', ids: chargeIds }]);
      await this.audit.log({
        orgId, userId: actor.userId, action: 'customers.erase', entity: 'customers', entityId: c.id,
        summary: 'Apagou os dados pessoais (LGPD) de um cliente',
        changes: { customer_id: c.id, redacted: true, body: { delete_messages: deleteMessages, ...r, warnings: r.warnings.length } },
        method: actor.method || 'POST', path: actor.path || null, status: 201, ip: actor.ip || null,
      });
      this.hooks.emit('customer_erased', {
        orgId, customer_id: c.id, erased_at: now.toISOString(), delete_messages: deleteMessages, needles,
        subscription_ids: subIds, entitlement_ids: (await this.prisma.whatsapp_entitlements.findMany({ where: { organization_id: orgId, customer_id: c.id }, select: { id: true } })).map((x) => x.id), charge_ids: canceledChargeIds,
      });
    } catch (e: any) {
      this.logger.warn(`LGPD: limpeza final do cliente ${c.id}: ${e?.message || e}`);
    } finally {
      this.running.delete(c.id);
      finishErasing(orgId, c.id);
    }
    this.logger.log(`LGPD: cliente ${c.id} (org ${orgId}) anonimizado${deleteMessages ? ' + conversas apagadas' : ''}`);
    return { ok: true, customer_id: c.id, erased_at: now.toISOString(), delete_messages: deleteMessages, ...r };
  }
}
