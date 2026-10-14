import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppContactsService } from './whatsapp-contacts.service';
import { digitsOf, isGroupJid, jidFromPhone, phoneFromJid } from './wa-jid.util';
import { docHash, isValidDoc, normalizeDoc } from './wa-doc.util';

// ============================================================================
// Identidade do cliente (Fase 1 do plano de assinaturas, 12/10/2026).
//
//   cliente 1 ─── N contatos (whatsapp_customer_contacts: role owner|financial|user|dependent)
//   contato 1 ─── N clientes (o mesmo número pode ser do responsável por 2 cadastros)
//
// Regra decidida pelo Júlio (D1/D2): o NÚMERO identifica o cliente; se a org liga
// `identity.require_doc`, o bot pede o CPF/CNPJ e confere pelo `doc_hash` (o `doc` em si é cifrado).
// Sem OTP, sem data de nascimento. Número novo de um cliente é vinculado pela equipe no painel
// (ou pelo próprio documento/código quando a org exige).
//
// Este serviço NÃO importa o CRM (o CRM importa este). O bot (Fase 2) usa só este serviço.
// ============================================================================

export const CONTACT_ROLES = ['owner', 'financial', 'user', 'dependent'] as const;
export type ContactRole = (typeof CONTACT_ROLES)[number];
export const ROLE_LABEL: Record<string, string> = { owner: 'Titular', financial: 'Financeiro', user: 'Usuário', dependent: 'Dependente' };
const ROLE_RANK: Record<string, number> = { owner: 0, financial: 1, user: 2, dependent: 3 };
export const LINKED_BY = ['panel', 'bot', 'import', 'api'] as const;

export type IdentitySettings = {
  require_doc: boolean; // o bot só mostra/mexe nos dados depois do CPF/CNPJ
  doc_kinds: Array<'cpf' | 'cnpj'>;
  ask_doc_text: string;
  doc_not_found_text: string;
  doc_invalid_text: string;
  use_code: boolean; // a org usa código/matrícula/contrato (aparece nas telas e no bot)
  code_label: string;
};
export const DEFAULT_IDENTITY: IdentitySettings = {
  require_doc: false,
  doc_kinds: ['cpf', 'cnpj'],
  ask_doc_text: 'Para continuar, me informe o seu CPF ou CNPJ (só números).',
  doc_not_found_text: 'Não encontrei um cadastro com esse documento. Confira os números ou fale com um atendente.',
  doc_invalid_text: 'Esse documento não parece válido. Pode conferir e enviar de novo?',
  use_code: false,
  code_label: 'Código do cliente',
};

const str = (v: unknown, fb: string, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fb);

export function normalizeIdentity(raw: any): IdentitySettings {
  const r = raw && typeof raw === 'object' ? raw : {};
  const kinds = Array.isArray(r.doc_kinds) ? r.doc_kinds.filter((k: any) => k === 'cpf' || k === 'cnpj') : [];
  return {
    require_doc: Boolean(r.require_doc),
    doc_kinds: kinds.length ? [...new Set(kinds)] as Array<'cpf' | 'cnpj'> : DEFAULT_IDENTITY.doc_kinds,
    ask_doc_text: str(r.ask_doc_text, DEFAULT_IDENTITY.ask_doc_text, 500),
    doc_not_found_text: str(r.doc_not_found_text, DEFAULT_IDENTITY.doc_not_found_text, 500),
    doc_invalid_text: str(r.doc_invalid_text, DEFAULT_IDENTITY.doc_invalid_text, 500),
    use_code: Boolean(r.use_code),
    code_label: str(r.code_label, DEFAULT_IDENTITY.code_label, 40),
  };
}

export type CustomerLink = { customer_id: string; contact_id: string; role: string; linked_by: string; created_at: Date };

@Injectable()
export class WhatsAppIdentityService {
  private readonly logger = new Logger(WhatsAppIdentityService.name);
  constructor(private readonly prisma: PrismaService, private readonly contacts: WhatsAppContactsService) {}

  // ---------------------------------------------------------------- configuração
  async settings(orgId: string): Promise<IdentitySettings> {
    const row = await this.prisma.whatsapp_crm_settings.findUnique({ where: { organization_id: orgId }, select: { identity: true } });
    return normalizeIdentity(row?.identity);
  }

  async updateSettings(orgId: string, dto: any): Promise<IdentitySettings> {
    const cur = await this.settings(orgId);
    const next = normalizeIdentity({ ...cur, ...(dto && typeof dto === 'object' ? dto : {}) });
    await this.prisma.whatsapp_crm_settings.upsert({ where: { organization_id: orgId }, create: { organization_id: orgId, identity: next as any }, update: { identity: next as any } });
    return next;
  }

  // ---------------------------------------------------------------- vínculos
  private sortLinks<T extends { role: string; created_at: Date }>(links: T[]) {
    return [...links].sort((a, b) => (ROLE_RANK[a.role] ?? 9) - (ROLE_RANK[b.role] ?? 9) || a.created_at.getTime() - b.created_at.getTime());
  }

  /** Vínculos de vários clientes de uma vez (customer_id → vínculos ordenados por papel). */
  async linksOfCustomers(customerIds: string[]) {
    const out = new Map<string, CustomerLink[]>();
    if (!customerIds.length) return out;
    const rows = await this.prisma.whatsapp_customer_contacts.findMany({ where: { customer_id: { in: customerIds } } });
    for (const r of rows) out.set(r.customer_id, [...(out.get(r.customer_id) || []), r]);
    for (const [k, v] of out) out.set(k, this.sortLinks(v));
    return out;
  }

  /** Clientes de um contato, do titular para o dependente. */
  async customersOfContact(orgId: string, contactId: string) {
    const links = await this.prisma.whatsapp_customer_contacts.findMany({ where: { contact_id: contactId } });
    if (!links.length) return [] as Array<{ customer: any; role: string }>;
    const customers = await this.prisma.whatsapp_customers.findMany({ where: { organization_id: orgId, id: { in: links.map((l) => l.customer_id) } } });
    const byId = new Map(customers.map((c) => [c.id, c]));
    return this.sortLinks(links).map((l) => ({ customer: byId.get(l.customer_id), role: l.role })).filter((x) => x.customer);
  }

  /** Contato da conversa (resolve @lid/telefone/wa_id) — compartilhado com o CRM e o bot. */
  async contactOfJid(orgId: string, session: string | null | undefined, jid: string) {
    if (!jid || isGroupJid(jid)) return null;
    const canonical = await this.contacts.canonicalChatId(orgId, session || null, jid).catch(() => jid);
    const ids = [...new Set([canonical, jid])];
    let contact = await this.prisma.whatsapp_contacts.findFirst({ where: { organization_id: orgId, OR: [{ wa_id: { in: ids } }, { lid: { in: ids } }] }, orderBy: { saved: 'desc' } });
    if (!contact) {
      const phone = phoneFromJid(canonical) || phoneFromJid(jid);
      if (phone) contact = await this.prisma.whatsapp_contacts.findFirst({ where: { organization_id: orgId, phone } });
    }
    return contact;
  }

  /**
   * Cliente(s) da conversa pelo NÚMERO: o primeiro é o "principal" (titular > financeiro > usuário > dependente);
   * `customers` traz todos (o bot pergunta qual quando há mais de um).
   */
  async customersOfJid(orgId: string, session: string | null | undefined, jid: string) {
    const contact = await this.contactOfJid(orgId, session, jid);
    if (!contact) return { contact: null, customers: [] as Array<{ customer: any; role: string }> };
    return { contact, customers: await this.customersOfContact(orgId, contact.id) };
  }

  async linkContact(orgId: string, customerId: string, target: { contact_id?: string; phone?: string }, role: string = 'user', linkedBy: string = 'panel') {
    const customer = await this.prisma.whatsapp_customers.findFirst({ where: { id: customerId, organization_id: orgId }, select: { id: true, name: true } });
    if (!customer) throw new NotFoundException('Cliente não encontrado.');
    const r = CONTACT_ROLES.includes(role as ContactRole) ? role : 'user';
    let contact: any = null;
    if (target.contact_id) contact = await this.prisma.whatsapp_contacts.findFirst({ where: { id: String(target.contact_id), organization_id: orgId } });
    else if (target.phone) {
      const phone = digitsOf(target.phone);
      if (phone.length < 10 || phone.length > 15) throw new BadRequestException('Informe o WhatsApp com DDI e DDD, ex.: 5511999999999.');
      const shaped = await this.contacts.createManual(orgId, { phone });
      contact = await this.prisma.whatsapp_contacts.findUnique({ where: { id: shaped.id } });
    }
    if (!contact) throw new NotFoundException('Contato não encontrado.');
    const by = LINKED_BY.includes(linkedBy as any) ? linkedBy : 'panel';
    // titular já vinculado não é rebaixado por um vínculo repetido com o papel padrão (rebaixar é pelo `setRole`)
    const existing = await this.prisma.whatsapp_customer_contacts.findUnique({ where: { customer_id_contact_id: { customer_id: customerId, contact_id: contact.id } } });
    const finalRole = existing?.role === 'owner' && r !== 'owner' ? 'owner' : r;
    await this.prisma.whatsapp_customer_contacts.upsert({
      where: { customer_id_contact_id: { customer_id: customerId, contact_id: contact.id } },
      create: { customer_id: customerId, contact_id: contact.id, role: finalRole, linked_by: by },
      update: { role: finalRole },
    });
    if (finalRole === 'owner') await this.demoteOtherOwners(customerId, contact.id);
    if (!contact.saved) await this.prisma.whatsapp_contacts.update({ where: { id: contact.id }, data: { saved: true } }).catch(() => undefined);
    return { customer_id: customerId, contact_id: contact.id, role: finalRole, phone: contact.phone, name: contact.name || contact.push_name || null };
  }

  /** Só UM titular por cliente: quem era `owner` vira `user`. */
  private async demoteOtherOwners(customerId: string, keepContactId: string) {
    await this.prisma.whatsapp_customer_contacts.updateMany({ where: { customer_id: customerId, role: 'owner', contact_id: { not: keepContactId } }, data: { role: 'user' } });
  }

  async setRole(orgId: string, customerId: string, contactId: string, role: string) {
    if (!CONTACT_ROLES.includes(role as ContactRole)) throw new BadRequestException('Papel inválido.');
    const customer = await this.prisma.whatsapp_customers.findFirst({ where: { id: customerId, organization_id: orgId }, select: { id: true } });
    if (!customer) throw new NotFoundException('Cliente não encontrado.');
    const r = await this.prisma.whatsapp_customer_contacts.updateMany({ where: { customer_id: customerId, contact_id: contactId }, data: { role } });
    if (!r.count) throw new NotFoundException('Vínculo não encontrado.');
    if (role === 'owner') await this.demoteOtherOwners(customerId, contactId); // o titular anterior vira usuário
    return { ok: true };
  }

  /** Desvincula um número; o cliente precisa continuar com pelo menos um (o principal é trocado quando necessário). */
  async unlinkContact(orgId: string, customerId: string, contactId: string) {
    const customer = await this.prisma.whatsapp_customers.findFirst({ where: { id: customerId, organization_id: orgId } });
    if (!customer) throw new NotFoundException('Cliente não encontrado.');
    const links = await this.prisma.whatsapp_customer_contacts.findMany({ where: { customer_id: customerId } });
    if (!links.some((l) => l.contact_id === contactId)) throw new NotFoundException('Vínculo não encontrado.');
    if (links.length <= 1) throw new BadRequestException('O cliente precisa ter pelo menos um número. Vincule outro antes de remover este.');
    await this.prisma.whatsapp_customer_contacts.delete({ where: { customer_id_contact_id: { customer_id: customerId, contact_id: contactId } } });
    if (customer.contact_id === contactId) {
      // o próximo vira principal E titular (só um titular por cliente)
      const next = this.sortLinks(links.filter((l) => l.contact_id !== contactId))[0];
      await this.prisma.whatsapp_customers.update({ where: { id: customerId }, data: { contact_id: next.contact_id } });
      await this.prisma.whatsapp_customer_contacts.update({ where: { customer_id_contact_id: { customer_id: customerId, contact_id: next.contact_id } }, data: { role: 'owner' } }).catch(() => undefined);
      await this.demoteOtherOwners(customerId, next.contact_id);
    }
    return { ok: true, primary_contact_id: customer.contact_id === contactId ? this.sortLinks(links.filter((l) => l.contact_id !== contactId))[0].contact_id : customer.contact_id };
  }

  // ---------------------------------------------------------------- busca
  /**
   * Acha o cliente por documento, código ou telefone. Documento: valida o dígito verificador e busca
   * pelo hash (a coluna `doc` é cifrada). Devolve `{ found: [...], reason }` — `reason` explica o "não achou".
   */
  async findCustomer(orgId: string, q: { doc?: string; code?: string; phone?: string; contact_id?: string }) {
    if (q.doc !== undefined) {
      const d = normalizeDoc(q.doc);
      if (!d || !isValidDoc(d)) return { found: [] as any[], reason: 'invalid_doc' as const };
      const rows = await this.prisma.whatsapp_customers.findMany({ where: { organization_id: orgId, doc_hash: docHash(orgId, d) }, orderBy: { created_at: 'asc' }, take: 10 });
      return { found: rows, reason: rows.length ? null : ('not_found' as const) };
    }
    if (q.code !== undefined) {
      const code = String(q.code || '').trim().slice(0, 32);
      if (!code) return { found: [] as any[], reason: 'invalid_code' as const };
      const row = await this.prisma.whatsapp_customers.findFirst({ where: { organization_id: orgId, code } });
      return { found: row ? [row] : [], reason: row ? null : ('not_found' as const) };
    }
    if (q.contact_id) {
      const list = await this.customersOfContact(orgId, String(q.contact_id));
      return { found: list.map((x) => x.customer), reason: list.length ? null : ('not_found' as const) };
    }
    if (q.phone !== undefined) {
      const phone = digitsOf(q.phone);
      if (phone.length < 8) return { found: [] as any[], reason: 'invalid_phone' as const };
      const contact = await this.contactOfJid(orgId, null, jidFromPhone(phone));
      if (!contact) return { found: [] as any[], reason: 'not_found' as const };
      const list = await this.customersOfContact(orgId, contact.id);
      return { found: list.map((x) => x.customer), reason: list.length ? null : ('not_found' as const) };
    }
    return { found: [] as any[], reason: 'invalid' as const };
  }

  /** Garante que o contato está vinculado ao cliente (bot/API ao reconhecer pelo documento). */
  async ensureLinked(orgId: string, customerId: string, contactId: string, linkedBy: string = 'bot', role: string = 'user') {
    const exists = await this.prisma.whatsapp_customer_contacts.findUnique({ where: { customer_id_contact_id: { customer_id: customerId, contact_id: contactId } } });
    if (exists) return exists;
    return this.linkContact(orgId, customerId, { contact_id: contactId }, role, linkedBy).catch((e) => { this.logger.debug(`ensureLinked: ${e?.message || e}`); return null; });
  }
}
