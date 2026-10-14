import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppCrmService } from '../whatsapp/whatsapp-crm.service';
import { WhatsAppSubscriptionsService } from '../whatsapp/whatsapp-subscriptions.service';
import { WhatsAppChargesService } from '../whatsapp/whatsapp-charges.service';
import { WhatsAppOutboxService } from '../whatsapp/whatsapp-outbox.service';
import { WhatsAppIdentityService } from '../whatsapp/whatsapp-identity.service';
import { WhatsAppContactsService } from '../whatsapp/whatsapp-contacts.service';
import { WhatsAppSessionsService } from '../whatsapp/whatsapp-sessions.service';
import { WhatsAppEntitlementsService } from '../whatsapp/whatsapp-entitlements.service';
import { digitsOf, jidFromPhone } from '../whatsapp/wa-jid.util';
import { ApiKeyCtx } from './org-api-keys.service';
import { publicCharge, publicCustomer, publicSubscription } from './public-shapes';

// Regras de negócio da API pública v1 (Fase 5, contrato §8.4). Reusa os serviços do painel (mesmos shapes,
// mesmas validações) com acesso a TODOS os números da organização (`allowed = null`) e `source: 'api'`.
// Mensagens saem SEMPRE pela fila com ritmo (`whatsapp_outbox`, kind `api_message`).

const clean = <T extends Record<string, any>>(o: T): Partial<T> => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== undefined)) as Partial<T>;
const pageOf = (q: any) => Math.max(1, parseInt(String(q?.page || 1), 10) || 1);
const sizeOf = (q: any, max = 100) => Math.min(max, Math.max(1, parseInt(String(q?.page_size || 25), 10) || 25));
const MEDIA_KIND: Record<string, 'image' | 'video' | 'audio' | 'document'> = { image: 'image', sticker: 'image', video: 'video', audio: 'audio', voice: 'audio', document: 'document' };
const OUTBOX_STATUS: Record<string, string> = { pending: 'queued', sending: 'sending', sent: 'sent', failed: 'failed', canceled: 'canceled' };

/** Variações de um telefone BR (com e sem o 9º dígito) — o WhatsApp guarda alguns números sem ele. */
export function phoneVariants(d: string): string[] {
  const out = new Set<string>([d]);
  let m = /^55(\d{2})9(\d{8})$/.exec(d);
  if (m) out.add(`55${m[1]}${m[2]}`);
  m = /^55(\d{2})(\d{8})$/.exec(d);
  if (m) out.add(`55${m[1]}9${m[2]}`);
  return [...out];
}

@Injectable()
export class OrgApiV1Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crm: WhatsAppCrmService,
    private readonly subs: WhatsAppSubscriptionsService,
    private readonly charges: WhatsAppChargesService,
    private readonly outbox: WhatsAppOutboxService,
    private readonly identity: WhatsAppIdentityService,
    private readonly contacts: WhatsAppContactsService,
    private readonly sessions: WhatsAppSessionsService,
    private readonly entitlements: WhatsAppEntitlementsService,
  ) {}

  private meta() {
    return { source: 'api' as const, user_id: null };
  }

  // ---------------------------------------------------------------- produtos
  async products(orgId: string, q: any) {
    return { items: await this.crm.listProducts(orgId, { active: q?.active }) };
  }

  // ---------------------------------------------------------------- clientes
  async customers(orgId: string, q: any) {
    const key = q?.doc !== undefined ? { doc: String(q.doc) } : q?.code !== undefined ? { code: String(q.code) } : q?.phone !== undefined ? { phone: String(q.phone) } : null;
    if (key) {
      const r = await this.identity.findCustomer(orgId, key);
      if (r.reason === 'invalid_doc') throw new BadRequestException('CPF/CNPJ inválido.');
      if (r.reason === 'invalid_phone') throw new BadRequestException('Telefone inválido.');
      if (r.reason === 'invalid_code') throw new BadRequestException('Informe o código.');
      const items: any[] = [];
      for (const c of r.found.slice(0, 10)) items.push(publicCustomer(await this.crm.getCustomer(orgId, c.id)));
      return { items, total: items.length, page: 1, page_size: items.length, pages: 1 };
    }
    const r = await this.crm.listCustomers(orgId, clean({ q: q?.q ? String(q.q) : undefined, status: q?.status, product_id: q?.product_id, unit_id: q?.unit_id, external_id: q?.external_id, page: pageOf(q), page_size: sizeOf(q) }));
    return { items: r.items.map((c: any) => publicCustomer(c)), total: r.total, page: r.page, page_size: r.page_size, pages: r.pages };
  }

  async customer(orgId: string, id: string) {
    return publicCustomer(await this.crm.getCustomer(orgId, id));
  }

  async createCustomer(orgId: string, dto: any) {
    return publicCustomer(await this.crm.createCustomer(orgId, null, { ...clean(dto), source: 'api' }));
  }

  async updateCustomer(orgId: string, id: string, dto: any) {
    return publicCustomer(await this.crm.updateCustomer(orgId, id, clean(dto)));
  }

  // ---------------------------------------------------------------- assinaturas
  async subscriptions(orgId: string, q: any) {
    const r = await this.subs.list(orgId, clean({ customer_id: q?.customer_id, status: q?.status, product_id: q?.product_id, external_id: q?.external_id, page: pageOf(q), page_size: sizeOf(q) }), null);
    return { items: r.items.map((s: any) => publicSubscription(s)), total: r.total, page: r.page, page_size: r.page_size, pages: r.pages, counts: r.counts };
  }

  async subscription(orgId: string, id: string) {
    return publicSubscription(await this.subs.get(orgId, id));
  }

  async createSubscription(orgId: string, customerId: string, dto: any) {
    const r: any = await this.crm.addSubscription(orgId, customerId, clean(dto), { source: 'api', user_id: null, auto_charge: dto?.charge_now === true });
    return publicSubscription(r.subscription);
  }

  async cancel(orgId: string, id: string, dto: { policy?: string; reason?: string }) {
    const policy = (dto?.policy === 'immediate' || dto?.policy === 'end_of_cycle' ? dto.policy : 'product') as 'product' | 'immediate' | 'end_of_cycle';
    return publicSubscription(await this.subs.cancel(orgId, id, { policy, reason: dto?.reason || null, ...this.meta() }));
  }
  async pause(orgId: string, id: string, dto: { until?: string; days?: number }) {
    if (!dto?.until && !dto?.days) throw new BadRequestException('Informe `until` (YYYY-MM-DD) ou `days`.');
    return publicSubscription(await this.subs.pause(orgId, id, { until: dto.until || null, days: dto.days || null, ...this.meta() }));
  }
  async resume(orgId: string, id: string) {
    return publicSubscription(await this.subs.resume(orgId, id, this.meta()));
  }
  async reactivate(orgId: string, id: string) {
    return publicSubscription(await this.subs.reactivate(orgId, id, this.meta()));
  }
  async changePlan(orgId: string, id: string, productId: string) {
    return publicSubscription(await this.subs.changePlan(orgId, id, productId, this.meta()));
  }

  // ---------------------------------------------------------------- cobranças
  async chargeList(orgId: string, q: any) {
    if (q?.subscription_id) {
      // a lista do painel não filtra por assinatura: consulta própria + shape do painel por linha (página ≤ 50)
      const sub = await this.prisma.whatsapp_subscriptions.findFirst({ where: { id: String(q.subscription_id), organization_id: orgId }, select: { id: true } });
      if (!sub) throw new NotFoundException('Assinatura não encontrada.');
      const page = pageOf(q), size = sizeOf(q, 50);
      const where: any = { organization_id: orgId, subscription_id: sub.id };
      if (q.customer_id) where.customer_id = String(q.customer_id);
      const st = String(q.status || '').toUpperCase();
      if (st === 'OVERDUE') { where.status = 'PENDING'; where.due_at = { lt: new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())}T00:00:00Z`) }; }
      else if (['PENDING', 'PAID', 'EXPIRED', 'CANCELED', 'FAILED'].includes(st)) where.status = st;
      const [total, rows] = await Promise.all([
        this.prisma.whatsapp_charges.count({ where }),
        this.prisma.whatsapp_charges.findMany({ where, orderBy: [{ created_at: 'desc' }], skip: (page - 1) * size, take: size, select: { id: true } }),
      ]);
      const items: any[] = [];
      for (const r of rows) items.push(publicCharge(await this.charges.get(orgId, r.id)));
      return { items, total, page, page_size: size, pages: Math.max(1, Math.ceil(total / size)) };
    }
    const r = await this.charges.list(orgId, clean({ customer_id: q?.customer_id, status: q?.status ? String(q.status).toUpperCase() : undefined, kind: q?.kind, from: q?.from, to: q?.to, page: pageOf(q), page_size: sizeOf(q) }), null);
    return { items: r.items.map((c: any) => publicCharge(c)), total: r.total, page: r.page, page_size: r.page_size, pages: r.pages };
  }

  async charge(orgId: string, id: string) {
    return publicCharge(await this.charges.get(orgId, id));
  }

  async createCharge(orgId: string, dto: any) {
    return publicCharge(await this.charges.create(orgId, null, clean(dto), 'manual', null));
  }
  async resendCharge(orgId: string, id: string, kind?: string) {
    return publicCharge(await this.charges.resend(orgId, id, kind ? { kind: kind as any } : {}));
  }
  async cancelCharge(orgId: string, id: string) {
    return publicCharge(await this.charges.cancel(orgId, id));
  }

  // ---------------------------------------------------------------- contatos
  private async findContact(orgId: string, phone: string) {
    const vs = phoneVariants(phone);
    return this.prisma.whatsapp_contacts.findFirst({ where: { organization_id: orgId, OR: [{ phone: { in: vs } }, { wa_id: { in: vs.map((v) => jidFromPhone(v)) } }] }, orderBy: [{ last_message_at: 'desc' }] });
  }

  private async ensureContact(orgId: string, phone: string) {
    const found = await this.findContact(orgId, phone);
    if (found) return found;
    const shaped = await this.contacts.createManual(orgId, { phone });
    return this.prisma.whatsapp_contacts.findUnique({ where: { id: shaped.id } });
  }

  private phoneOrFail(raw: string) {
    const d = digitsOf(raw);
    if (d.length < 10 || d.length > 15) throw new BadRequestException('Telefone inválido. Use DDI+DDD+número, só dígitos (ex.: 5511999999999).');
    return d;
  }

  async optOut(orgId: string, dto: { phone: string; opted_out: boolean }) {
    const d = this.phoneOrFail(dto.phone);
    let contact: any = await this.findContact(orgId, d);
    if (!contact && !dto.opted_out) return { contact_id: null, phone: d, opted_out: false, opted_out_at: null };
    if (!contact) contact = await this.ensureContact(orgId, d); // descadastro de quem ainda não falou: fica guardado para os próximos envios
    const r: any = await this.contacts.patch(orgId, contact.id, { opted_out: Boolean(dto.opted_out) });
    return { contact_id: r.id, phone: r.phone || d, opted_out: Boolean(r.opted_out), opted_out_at: r.opted_out_at || null };
  }

  // ---------------------------------------------------------------- mensagens (sempre pela fila)
  private shapeMessage(row: any, to?: string) {
    const p: any = row.payload || {};
    const m = Array.isArray(p.messages) ? p.messages[0] || {} : {};
    return {
      id: row.id, status: OUTBOX_STATUS[row.status] || row.status, session_id: row.session_id, to: to || String(row.chat_id || '').split('@')[0] || null,
      text: m.text ?? null, media_id: m.media_id ?? null, attempts: row.attempts || 0, error: row.status === 'failed' ? row.last_error || null : null,
      run_at: row.run_at, sent_at: row.sent_at || null, created_at: row.created_at,
    };
  }

  async sendMessage(orgId: string, key: ApiKeyCtx, dto: { to: string; session_id?: string; text?: string; media_id?: string; idempotency_key?: string }) {
    const d = this.phoneOrFail(dto.to);
    const text = String(dto.text || '').trim();
    if (!text && !dto.media_id) throw new BadRequestException('Informe `text` e/ou `media_id`.');
    const dedupe = dto.idempotency_key ? `api:${key.id}:${dto.idempotency_key}`.slice(0, 120) : null;
    if (dedupe) {
      const prev = await this.prisma.whatsapp_outbox.findFirst({ where: { organization_id: orgId, dedupe_key: dedupe } });
      if (prev) return this.shapeMessage(prev);
    }
    const existing = await this.findContact(orgId, d);
    if (existing?.opted_out_at) throw new ConflictException({ statusCode: 409, code: 'OPTED_OUT', message: 'Este contato pediu para não receber mensagens (descadastrado).' });
    let kind: 'text' | 'image' | 'video' | 'audio' | 'document' = 'text';
    if (dto.media_id) {
      const m = await this.prisma.whatsapp_media.findFirst({ where: { id: String(dto.media_id), organization_id: orgId }, select: { id: true, kind: true, mime: true } });
      if (!m) throw new NotFoundException('Mídia não encontrada.');
      kind = MEDIA_KIND[m.kind] || (/^image\//.test(m.mime) ? 'image' : /^video\//.test(m.mime) ? 'video' : /^audio\//.test(m.mime) ? 'audio' : 'document');
    }
    const contact: any = existing || (await this.ensureContact(orgId, d));
    if (!contact) throw new BadRequestException('Não foi possível registrar o contato.');
    let target: { session_id: string; chat_id: string } | null;
    if (dto.session_id) {
      const row = await this.sessions.requireReady(orgId, String(dto.session_id)); // 404 número de outra org / 400 desconectado
      const jids = [...new Set([contact.wa_id, contact.lid, contact.phone ? jidFromPhone(contact.phone) : null].filter(Boolean))] as string[];
      const chat = jids.length ? await this.prisma.whatsapp_chats.findFirst({ where: { organization_id: orgId, session_id: row.id, kind: 'individual', chat_id: { in: jids } }, orderBy: { last_message_at: 'desc' }, select: { chat_id: true } }) : null;
      target = { session_id: row.id, chat_id: chat?.chat_id || jidFromPhone(contact.phone || d) };
    } else target = await this.outbox.chatKeyForContact(orgId, contact.id); // conversa mais recente (número conectado) → 1º número conectado
    if (!target) throw new ConflictException({ statusCode: 409, code: 'NO_SESSION', message: 'Nenhum número do WhatsApp conectado para enviar.' });
    const row = await this.outbox.enqueue(orgId, { ...target, kind: 'api_message', payload: { messages: [{ kind, text: text || null, media_id: dto.media_id || null }], mark: { api: true, api_key_id: key.id } }, dedupe_key: dedupe });
    if (!row) {
      const prev = dedupe ? await this.prisma.whatsapp_outbox.findFirst({ where: { organization_id: orgId, dedupe_key: dedupe } }) : null;
      if (prev) return this.shapeMessage(prev);
      throw new BadRequestException('Mensagem vazia.');
    }
    return this.shapeMessage(row, contact.phone || d);
  }

  async message(orgId: string, id: string) {
    const row = await this.prisma.whatsapp_outbox.findFirst({ where: { id: String(id), organization_id: orgId, kind: 'api_message' } });
    if (!row) throw new NotFoundException('Mensagem não encontrada.');
    return this.shapeMessage(row);
  }

  // ---------------------------------------------------------------- direitos de acesso
  async entitlementList(orgId: string, q: any) {
    return this.entitlements.list(orgId, clean({ customer_id: q?.customer_id, subscription_id: q?.subscription_id, status: q?.status, page: q?.page, page_size: q?.page_size }));
  }
}
