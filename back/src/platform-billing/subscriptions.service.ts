import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService, OrgStatus } from './access.service';
import { normalizeModules } from './modules.const';

// Listagem de assinaturas pro superadmin: organização + dono + plano + status
// efetivo + total pago. Org oculta (dev) só aparece pra quem é dela.
@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService, private readonly access: AccessService) {}

  private async seesHidden(viewerOrgId?: string) {
    if (!viewerOrgId) return false;
    const o = await this.prisma.organizations.findUnique({ where: { id: viewerOrgId }, select: { hidden: true } });
    return o?.hidden === true;
  }

  async assertVisible(orgId: string, viewerOrgId?: string) {
    const o = await this.prisma.organizations.findUnique({ where: { id: orgId }, select: { hidden: true } });
    if (!o || (o.hidden && !(await this.seesHidden(viewerOrgId)))) throw new NotFoundException('Organização não encontrada.');
  }

  private shape(org: any, accessRow: any, paid: { sum: number; count: number; last: Date | null }) {
    const st = this.access.stateOf(accessRow);
    const owner = org.users?.find((u: any) => u.role === 'OWNER') || org.users?.[0] || null;
    return {
      organization_id: org.id,
      organization_name: org.name,
      org_status: org.status,
      created_at: org.created_at,
      owner: owner ? { id: owner.id, name: owner.name, email: owner.email, role: owner.role, modules: normalizeModules(owner.modules) } : null,
      users_count: org.users?.length || 0,
      users: (org.users || []).map((u: any) => ({ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, modules: normalizeModules(u.modules) })),
      access: {
        status: st.status,
        needs_payment: st.needs_payment,
        price_cents: st.price_cents,
        period_days: st.period_days,
        lifetime: st.lifetime,
        access_until: st.access_until,
        days_left: st.days_left,
        expiring_soon: st.expiring_soon,
        first_paid_at: st.first_paid_at,
        last_paid_at: st.last_paid_at,
        notes: st.notes,
      },
      total_paid_cents: paid.sum,
      payments_count: paid.count,
      last_payment_at: paid.last,
    };
  }

  private async paidMap(orgIds: string[]) {
    const map = new Map<string, { sum: number; count: number; last: Date | null }>();
    if (!orgIds.length) return map;
    const g = await this.prisma.platform_payments.groupBy({
      by: ['organization_id'],
      where: { organization_id: { in: orgIds }, status: { in: ['PAID', 'MANUAL'] } },
      _sum: { amount_cents: true },
      _count: { _all: true },
      _max: { paid_at: true },
    });
    for (const r of g) map.set(r.organization_id, { sum: r._sum.amount_cents || 0, count: r._count._all, last: r._max.paid_at });
    return map;
  }

  async get(orgId: string, viewerOrgId?: string) {
    await this.assertVisible(orgId, viewerOrgId);
    const org = await this.prisma.organizations.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, status: true, created_at: true, users: { select: { id: true, name: true, email: true, role: true, active: true, modules: true } } },
    });
    if (!org) throw new NotFoundException('Organização não encontrada.');
    const accessRow = await this.prisma.organization_access.findUnique({ where: { organization_id: orgId } });
    const paid = (await this.paidMap([orgId])).get(orgId) || { sum: 0, count: 0, last: null };
    return this.shape(org, accessRow, paid);
  }

  async list(q: any = {}, viewerOrgId?: string) {
    const showHidden = await this.seesHidden(viewerOrgId);
    const page = Math.max(1, parseInt(String(q.page || 1), 10) || 1);
    const size = Math.min(100, Math.max(5, parseInt(String(q.page_size || 20), 10) || 20));
    const where: any = showHidden ? {} : { hidden: false };
    if (q.q) {
      const s = String(q.q).trim();
      where.OR = [{ name: { contains: s } }, { users: { some: { OR: [{ email: { contains: s } }, { name: { contains: s } }] } } }];
    }
    const orgs = await this.prisma.organizations.findMany({
      where,
      orderBy: { created_at: 'desc' },
      select: { id: true, name: true, status: true, created_at: true, users: { select: { id: true, name: true, email: true, role: true, active: true, modules: true } } },
    });
    const ids = orgs.map((o) => o.id);
    const [accessRows, paid] = await Promise.all([
      ids.length ? this.prisma.organization_access.findMany({ where: { organization_id: { in: ids } } }) : [],
      this.paidMap(ids),
    ]);
    const amap = new Map(accessRows.map((r) => [r.organization_id, r] as [string, any]));
    let items = orgs.map((o) => this.shape(o, amap.get(o.id) || null, paid.get(o.id) || { sum: 0, count: 0, last: null }));
    // Filtro por status EFETIVO (calculado) — por isso é pós-query.
    const status = String(q.status || 'all').toUpperCase() as OrgStatus | 'ALL';
    if (status !== 'ALL') items = items.filter((i) => i.access.status === status);
    if (q.paid === 'true') items = items.filter((i) => i.access.price_cents > 0);
    if (q.paid === 'false') items = items.filter((i) => i.access.price_cents === 0);
    const total = items.length;
    return { items: items.slice((page - 1) * size, page * size), total, page, page_size: size, pages: Math.max(1, Math.ceil(total / size)) };
  }
}
