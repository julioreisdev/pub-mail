import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

// ============================================================================
// Escolher cliente (revisão 14/10/2026, P7-6): busca LEVE para os diálogos de "Novo pedido" e "Novo chamado".
// Fica FORA de `/whatsapp/customers` de propósito:
//  - a lista do CRM (`GET /whatsapp/customers`) exige a sub-permissão `whatsapp:crm`; quem só atende também
//    precisa escolher o cliente de um pedido/chamado → esta rota só exige o módulo WhatsApp;
//  - `GET /whatsapp/customers/:id` do CRM engoliria `/customers/pick` dependendo da ordem dos controllers.
// Devolve só id, nome, código e telefone principal (sem documento, e-mail, endereço, valores). Máx. 20.
// Busca: nome (contém), código (exato, sem diferenciar maiúsculas) e telefone (≥ 4 dígitos, contém).
// ============================================================================

@ApiTags('WhatsApp CRM')
@UseGuards(JwtAuthGuard)
@Controller('whatsapp/customer-pick')
export class WhatsAppCustomerPickController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async pick(@Req() req: any, @Query() q: any) {
    const orgId = req.user.organizationId as string;
    const term = String(q?.q ?? '').trim().slice(0, 80);
    const take = Math.min(20, Math.max(1, parseInt(String(q?.limit ?? 20), 10) || 20));
    const base = { organization_id: orgId, erased_at: null };
    let customerIds: string[] | null = null;
    if (term) {
      const digits = term.replace(/\D/g, '');
      const or: any[] = [{ name: { contains: term } }, { code: term }];
      if (digits.length >= 4) {
        const contacts = await this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, phone: { contains: digits } }, select: { id: true }, take: 200 });
        if (contacts.length) {
          const ids = contacts.map((c) => c.id);
          const links = await this.prisma.whatsapp_customer_contacts.findMany({ where: { contact_id: { in: ids } }, select: { customer_id: true }, take: 400 });
          or.push({ contact_id: { in: ids } });
          if (links.length) customerIds = [...new Set(links.map((l) => l.customer_id))];
        }
      }
      if (customerIds?.length) or.push({ id: { in: customerIds } });
      const rows = await this.prisma.whatsapp_customers.findMany({ where: { ...base, OR: or }, select: { id: true, name: true, code: true, contact_id: true }, orderBy: { name: 'asc' }, take });
      return { items: await this.withPhones(orgId, rows) };
    }
    const rows = await this.prisma.whatsapp_customers.findMany({ where: base, select: { id: true, name: true, code: true, contact_id: true }, orderBy: { updated_at: 'desc' }, take });
    return { items: await this.withPhones(orgId, rows) };
  }

  private async withPhones(orgId: string, rows: Array<{ id: string; name: string; code: string | null; contact_id: string }>) {
    const ids = [...new Set(rows.map((r) => r.contact_id).filter(Boolean))];
    const contacts = ids.length ? await this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, id: { in: ids } }, select: { id: true, phone: true } }) : [];
    const pm = new Map(contacts.map((c) => [c.id, c.phone || null] as [string, string | null]));
    return rows.map((r) => ({ id: r.id, name: r.name, code: r.code || null, phone: pm.get(r.contact_id) || null, contact_id: r.contact_id || null }));
  }
}
