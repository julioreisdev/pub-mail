import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { cancelCharge, createPixCharge, getChargeStatus } from '../payments/pix-providers';
import { AccessService } from './access.service';
import { PlatformBillingSettingsService } from './platform-billing-settings.service';

// Cobranças PIX das ASSINATURAS (acesso ao Pub Mail). Espelho do
// WebchatPaymentsService: valor/período SEMPRE do plano salvo (organization_access),
// PIX expira em 30 min, reconciliação por webhook + cron + polling do front,
// transição PENDING→PAID atômica (quem ganha o updateMany é quem ativa o acesso).
export const CHARGE_TTL_MIN = 30;
const BRL = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
type RateBucket = { count: number; resetAt: number };

@Injectable()
export class PlatformPaymentsService {
  private readonly logger = new Logger(PlatformPaymentsService.name);
  private readonly buckets = new Map<string, RateBucket>();
  private readonly orgLocks = new Map<string, Promise<unknown>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly settings: PlatformBillingSettingsService,
  ) {}

  private hit(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    const b = this.buckets.get(key);
    if (!b || b.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      if (this.buckets.size > 5000) for (const [k, v] of this.buckets) if (v.resetAt <= now) this.buckets.delete(k);
      return true;
    }
    b.count += 1;
    return b.count <= limit;
  }

  private async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.orgLocks.get(key) || Promise.resolve();
    const run = prev.catch(() => undefined).then(fn);
    this.orgLocks.set(key, run);
    try {
      return await run;
    } finally {
      if (this.orgLocks.get(key) === run) this.orgLocks.delete(key);
    }
  }

  private toPublic(p: any, extra: any = {}) {
    return {
      id: p.id,
      status: p.status,
      amount_cents: p.amount_cents,
      amount_label: BRL(p.amount_cents),
      period_days: p.period_days,
      description: p.description,
      pix_code: p.status === 'PENDING' ? p.pix_code : null,
      qr_base64: p.status === 'PENDING' ? p.qr_base64 : null,
      expires_at: p.expires_at ? new Date(p.expires_at).toISOString() : null,
      paid_at: p.paid_at ? new Date(p.paid_at).toISOString() : null,
      created_at: p.created_at,
      ...extra,
    };
  }

  // ------------------------------------------------------------ cliente
  // Cobrança PENDING ainda válida da org (pra retomar na tela sem gerar outra).
  async currentPending(orgId: string) {
    const p = await this.prisma.platform_payments.findFirst({
      where: { organization_id: orgId, status: 'PENDING', expires_at: { gt: new Date() } },
      orderBy: { created_at: 'desc' },
    });
    return p ? this.toPublic(p) : null;
  }

  async createCharge(userId: string, orgId: string) {
    return this.withLock(orgId, () => this.createChargeLocked(userId, orgId));
  }

  private async createChargeLocked(userId: string, orgId: string) {
    const st = await this.access.getOrgState(orgId);
    if (st.status === 'BLOCKED') throw new BadRequestException('Conta bloqueada pelo administrador.');
    if (st.price_cents <= 0) throw new BadRequestException('Sua conta não tem cobrança.');
    // Só cobra quando precisa (bloqueado) ou está perto de vencer — pagar com
    // 20 dias sobrando zeraria o contador (D3: conta do dia do pagamento).
    if (!st.needs_payment && !st.expiring_soon) throw new BadRequestException('Seu acesso está ativo. A renovação abre 3 dias antes do vencimento.');

    const gw = await this.settings.require();
    if (!gw) throw new BadRequestException('Pagamento indisponível no momento. Fale com o administrador.');

    const existing = await this.prisma.platform_payments.findFirst({
      where: { organization_id: orgId, status: 'PENDING', expires_at: { gt: new Date() } },
      orderBy: { created_at: 'desc' },
    });
    if (existing && existing.amount_cents === st.price_cents && existing.period_days === st.period_days) return this.toPublic(existing);

    const user = await this.prisma.users.findUnique({ where: { id: userId }, select: { name: true, email: true } });
    const description = st.lifetime ? 'Pub Mail — acesso vitalício' : `Pub Mail — acesso por ${st.period_days} dias`;
    const res = await createPixCharge(gw.provider, gw.access_token, st.price_cents, description, {
      payerRef: orgId.replace(/-/g, '').slice(0, 12),
      email: user?.email || undefined,
      name: user?.name || 'Cliente',
      webhookUrl: this.settings.webhookUrl(gw.provider),
      expiresInMin: CHARGE_TTL_MIN,
      idempotency: `pb-${orgId}-${Math.floor(Date.now() / 60000)}`,
    });
    if (!res.ok || !res.chargeId) {
      this.logger.warn(`createPixCharge falhou (${gw.provider}) org=${orgId}: ${res.error}`);
      throw new BadRequestException('Não foi possível gerar o PIX agora. Tente novamente em instantes.');
    }
    const row = await this.prisma.platform_payments.create({
      data: {
        organization_id: orgId,
        user_id: userId,
        provider: gw.provider,
        provider_charge_id: res.chargeId,
        amount_cents: st.price_cents,
        period_days: st.period_days,
        description,
        status: 'PENDING',
        pix_code: res.pixCode || null,
        qr_base64: res.qrBase64 || null,
        expires_at: new Date(Date.now() + CHARGE_TTL_MIN * 60_000),
      },
    });
    this.logger.log(`PIX de assinatura criado org=${orgId} ${BRL(row.amount_cents)} (${gw.provider})`);
    return this.toPublic(row);
  }

  // Status (`check=true` = botão Validar: reconfere no gateway, 1x/2s; polling 1x/4s).
  async getStatus(orgId: string, paymentId: string, check: boolean) {
    let p: any = await this.prisma.platform_payments.findFirst({ where: { id: paymentId, organization_id: orgId } });
    if (!p) throw new NotFoundException('Cobrança não encontrada.');
    if (p.status === 'PENDING') {
      if (p.expires_at && p.expires_at.getTime() <= Date.now()) p = await this.expireIfUnpaid(p);
      else {
        const allowed = check ? this.hit(`check:${p.id}`, 1, 2000) : this.hit(`poll:${p.id}`, 1, 4000);
        if (allowed) p = await this.checkPayment(p);
      }
    }
    const access = p.status === 'PAID' ? await this.access.getOrgState(orgId) : null;
    return this.toPublic(p, { access });
  }

  // ------------------------------------------------------------ núcleo
  async checkPayment(p: any): Promise<any> {
    if (p.status === 'PAID' || p.status === 'MANUAL') return p;
    const gw = await this.prisma.system_settings.findUnique({ where: { id: 1 }, select: { billing_access_token: true } });
    if (!gw?.billing_access_token || !p.provider_charge_id) return p;
    const r = await getChargeStatus(p.provider, gw.billing_access_token, p.provider_charge_id);
    if (!r.ok || !r.status) return p;
    if (r.status === 'PAID') return this.markPaid(p);
    if (p.status === 'PENDING' && r.status !== 'PENDING') return this.transitionFromPending(p.id, r.status);
    return p;
  }

  // Atômico: só quem virar a linha (count=1) ativa o acesso — webhook + cron + front juntos não duplicam.
  private async markPaid(p: any) {
    const paidAt = new Date();
    const r = await this.prisma.platform_payments.updateMany({ where: { id: p.id, status: { notIn: ['PAID', 'MANUAL'] } }, data: { status: 'PAID', paid_at: paidAt } });
    if (r.count === 1) {
      await this.access.markPaid(p.organization_id, paidAt, p.period_days == null ? null : Number(p.period_days));
      this.logger.log(`Assinatura PAGA org=${p.organization_id} pagamento=${p.id} ${BRL(p.amount_cents)}`);
    }
    return (await this.prisma.platform_payments.findUnique({ where: { id: p.id } }))!;
  }

  private async transitionFromPending(id: string, status: 'EXPIRED' | 'FAILED') {
    await this.prisma.platform_payments.updateMany({ where: { id, status: 'PENDING' }, data: { status } });
    return (await this.prisma.platform_payments.findUnique({ where: { id } }))!;
  }

  private async expireIfUnpaid(p: any) {
    const fresh = await this.checkPayment(p);
    if (fresh.status !== 'PENDING') return fresh;
    const gw = await this.prisma.system_settings.findUnique({ where: { id: 1 }, select: { billing_access_token: true } });
    if (gw?.billing_access_token && p.provider_charge_id) {
      cancelCharge(p.provider, gw.billing_access_token, p.provider_charge_id).catch(() => undefined);
    }
    return this.transitionFromPending(p.id, 'EXPIRED');
  }

  async handleWebhookCharge(provider: string, chargeId: string) {
    const p = await this.prisma.platform_payments.findFirst({ where: { provider, provider_charge_id: chargeId }, orderBy: { created_at: 'desc' } });
    if (!p) return false;
    await this.checkPayment(p);
    return true;
  }

  // Cron 1 min: expira vencidas, reconfere pendentes, revisita EXPIRED das últimas 24h.
  async reconcilePending() {
    const now = new Date();
    const overdue = await this.prisma.platform_payments.findMany({ where: { status: 'PENDING', expires_at: { lte: now } }, take: 200 });
    for (const p of overdue) {
      try { await this.expireIfUnpaid(p); } catch (e: any) { this.logger.warn(`expire ${p.id}: ${e?.message || e}`); }
    }
    const pending = await this.prisma.platform_payments.findMany({ where: { status: 'PENDING', expires_at: { gt: now } }, take: 200 });
    for (const p of pending) {
      try { await this.checkPayment(p); } catch (e: any) { this.logger.warn(`reconcile ${p.id}: ${e?.message || e}`); }
    }
    const expiredRecent = await this.prisma.platform_payments.findMany({
      where: { status: 'EXPIRED', provider_charge_id: { not: null }, expires_at: { gte: new Date(now.getTime() - 24 * 3600_000) } },
      take: 100,
    });
    for (const p of expiredRecent) {
      try { await this.checkPayment(p); } catch (e: any) { this.logger.warn(`reconcile-expired ${p.id}: ${e?.message || e}`); }
    }
  }

  // ------------------------------------------------------------ superadmin
  // Expira (localmente) e cancela no gateway todo PIX PENDING da org — usado por
  // "Bloquear" e "Marcar como pago", senão um PIX já aberto pago depois reativaria a
  // conta / cobraria em dobro.
  async cancelOpenCharges(orgId: string) {
    const open = await this.prisma.platform_payments.findMany({ where: { organization_id: orgId, status: 'PENDING' } });
    if (!open.length) return 0;
    const gw = await this.prisma.system_settings.findUnique({ where: { id: 1 }, select: { billing_access_token: true } });
    for (const p of open) {
      if (gw?.billing_access_token && p.provider_charge_id) {
        await cancelCharge(p.provider, gw.billing_access_token, p.provider_charge_id).catch(() => undefined);
      }
    }
    const r = await this.prisma.platform_payments.updateMany({ where: { organization_id: orgId, status: 'PENDING' }, data: { status: 'EXPIRED' } });
    return r.count;
  }

  // "Marcar como pago" manual: registra uma linha MANUAL e ativa o acesso (período do plano atual).
  async markManualPaid(orgId: string, userId: string) {
    const st = await this.access.getOrgState(orgId);
    const paidAt = new Date();
    await this.prisma.platform_payments.create({
      data: {
        organization_id: orgId,
        user_id: userId,
        provider: 'manual',
        amount_cents: st.price_cents,
        period_days: st.period_days,
        description: 'Pagamento registrado manualmente pelo administrador',
        status: 'MANUAL',
        paid_at: paidAt,
      },
    });
    // Cobranças PIX pendentes: cancela no gateway e expira (não faz sentido pagar 2x).
    await this.cancelOpenCharges(orgId);
    const state = await this.access.markPaid(orgId, paidAt, st.period_days);
    // Ação explícita do admin: também levanta um bloqueio manual (o PIX pago pelo cliente NÃO levanta).
    return state.status === 'BLOCKED' ? this.access.unblock(orgId) : state;
  }

  async listPayments(q: any = {}) {
    const dateOr = (v: any, fb?: Date) => { const d = v ? new Date(v) : undefined; return d && !Number.isNaN(d.getTime()) ? d : fb; };
    const page = Math.max(1, parseInt(String(q.page || 1), 10) || 1);
    const size = Math.min(100, Math.max(5, parseInt(String(q.page_size || 20), 10) || 20));
    const where: any = {};
    if (q.status && q.status !== 'all') where.status = String(q.status).toUpperCase();
    if (q.organization_id) where.organization_id = String(q.organization_id);
    if (q.from || q.to) {
      where.created_at = {};
      if (dateOr(q.from)) where.created_at.gte = dateOr(q.from);
      if (dateOr(q.to)) where.created_at.lte = dateOr(q.to);
      if (!Object.keys(where.created_at).length) delete where.created_at;
    }
    if (q.q) {
      const s = String(q.q).trim();
      const orgs = await this.prisma.organizations.findMany({
        where: { OR: [{ name: { contains: s } }, { users: { some: { OR: [{ email: { contains: s } }, { name: { contains: s } }] } } }] },
        select: { id: true },
        take: 200,
      });
      where.organization_id = { in: orgs.map((o) => o.id) };
    }
    // Org oculta (dev) nunca aparece.
    const hidden = await this.prisma.organizations.findMany({ where: { hidden: true }, select: { id: true } });
    if (hidden.length) where.organization_id = where.organization_id ? { ...(typeof where.organization_id === 'string' ? { equals: where.organization_id } : where.organization_id), notIn: hidden.map((h) => h.id) } : { notIn: hidden.map((h) => h.id) };

    const [total, rows] = await Promise.all([
      this.prisma.platform_payments.count({ where }),
      this.prisma.platform_payments.findMany({ where, orderBy: { created_at: 'desc' }, skip: (page - 1) * size, take: size }),
    ]);
    const orgIds = [...new Set(rows.map((r) => r.organization_id))];
    const orgs = orgIds.length ? await this.prisma.organizations.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true, users: { select: { name: true, email: true, role: true }, orderBy: { role: 'asc' }, take: 1 } } }) : [];
    const omap = new Map(orgs.map((o) => [o.id, o] as [string, any]));
    return {
      items: rows.map((r) => {
        const o = omap.get(r.organization_id);
        return {
          id: r.id,
          organization_id: r.organization_id,
          organization_name: o?.name || '—',
          user_name: o?.users?.[0]?.name || '',
          user_email: o?.users?.[0]?.email || '',
          provider: r.provider,
          amount_cents: r.amount_cents,
          period_days: r.period_days,
          status: r.status,
          created_at: r.created_at,
          paid_at: r.paid_at,
          expires_at: r.expires_at,
        };
      }),
      total,
      page,
      page_size: size,
      pages: Math.max(1, Math.ceil(total / size)),
    };
  }

  // KPIs pra dashboard do superadmin.
  async overview(q: any = {}) {
    const now = new Date();
    const valid = (v: any) => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? d : null; };
    const from = valid(q.from) || new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const to = valid(q.to) || now;
    const hidden = (await this.prisma.organizations.findMany({ where: { hidden: true }, select: { id: true } })).map((h) => h.id);
    const notHidden = hidden.length ? { organization_id: { notIn: hidden } } : {};
    const paidWhere = { status: { in: ['PAID', 'MANUAL'] }, ...notHidden };
    const [allPaid, periodPaid, pendingCount] = await Promise.all([
      this.prisma.platform_payments.aggregate({ where: paidWhere, _sum: { amount_cents: true }, _count: { _all: true } }),
      this.prisma.platform_payments.findMany({ where: { ...paidWhere, paid_at: { gte: from, lte: to } }, select: { amount_cents: true, paid_at: true, provider: true } }),
      this.prisma.platform_payments.count({ where: { status: 'PENDING', expires_at: { gt: now }, ...notHidden } }),
    ]);
    // Série mensal (chave YYYY-MM) dentro do período.
    const series = new Map<string, { month: string; revenue_cents: number; count: number }>();
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    while (cursor <= to) {
      const k = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      series.set(k, { month: k, revenue_cents: 0, count: 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    let periodRevenue = 0;
    for (const p of periodPaid) {
      periodRevenue += p.amount_cents;
      const d = new Date(p.paid_at as Date);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const s = series.get(k);
      if (s) { s.revenue_cents += p.amount_cents; s.count += 1; }
    }
    // Assinaturas por status efetivo + MRR estimado.
    const accessRows = await this.prisma.organization_access.findMany({ where: notHidden });
    const byStatus: Record<string, number> = { FREE: 0, PENDING: 0, ACTIVE: 0, EXPIRED: 0, BLOCKED: 0 };
    let mrr = 0;
    for (const r of accessRows) {
      const st = this.access.stateOf(r, now);
      byStatus[st.status] = (byStatus[st.status] || 0) + 1;
      if (st.status === 'ACTIVE' && st.price_cents > 0 && st.period_days) mrr += Math.round((st.price_cents * 30) / st.period_days);
    }
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      revenue_total_cents: allPaid._sum.amount_cents || 0,
      payments_total: allPaid._count._all || 0,
      revenue_period_cents: periodRevenue,
      payments_period: periodPaid.length,
      pending_charges: pendingCount,
      mrr_cents: mrr,
      subscriptions: byStatus,
      series: [...series.values()],
    };
  }
}
