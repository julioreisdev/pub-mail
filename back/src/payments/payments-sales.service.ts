import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebchatPaymentsService } from './webchat-payments.service';

const BRL = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Vendas unificadas (Webchat + Telegram) — mescla em memória e pagina.
@Injectable()
export class PaymentsSalesService {
  constructor(private readonly prisma: PrismaService, private readonly webchat: WebchatPaymentsService) {}

  private async telegramSales(orgId: string, status?: string) {
    const where: any = { organization_id: orgId };
    if (status && status !== 'all') where.status = String(status).toUpperCase();
    const rows = await this.prisma.telegram_payments.findMany({ where, orderBy: { created_at: 'desc' }, take: 2000 });
    const planIds = [...new Set(rows.map((r) => r.plan_id).filter(Boolean) as string[])];
    const botIds = [...new Set(rows.map((r) => r.bot_id))];
    const [plans, bots] = await Promise.all([
      planIds.length ? this.prisma.telegram_plans.findMany({ where: { id: { in: planIds } }, select: { id: true, name: true } }) : [],
      botIds.length ? this.prisma.telegram_bots.findMany({ where: { id: { in: botIds } }, select: { id: true, name: true } }) : [],
    ]);
    const pmap = new Map<string, string>(plans.map((p) => [p.id, p.name] as [string, string]));
    const bmap = new Map<string, string>(bots.map((b) => [b.id, b.name] as [string, string]));
    return rows.map((r) => ({
      id: r.id,
      channel: 'telegram',
      title: r.plan_id ? pmap.get(r.plan_id) || 'Plano' : 'Plano',
      source_name: bmap.get(r.bot_id) || '—',
      customer: `Telegram ${String(r.tg_user_id)}`,
      amount_cents: r.amount_cents,
      amount_label: BRL(r.amount_cents),
      status: r.status,
      provider: r.provider,
      delivered: r.delivered,
      paid_at: r.paid_at,
      created_at: r.created_at,
    }));
  }

  async list(orgId: string, opts: any = {}) {
    const channel = String(opts.channel || 'all');
    const status = String(opts.status || 'all');
    const page = Math.max(1, parseInt(opts.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(5, parseInt(opts.page_size, 10) || 15));
    const [wc, tg]: [any[], any[]] = await Promise.all([
      channel === 'telegram' ? Promise.resolve([] as any[]) : this.webchat.listSales(orgId, { status }),
      channel === 'webchat' ? Promise.resolve([] as any[]) : this.telegramSales(orgId, status),
    ]);
    // Filtros em memória (busca livre + período) — volumes por org são pequenos
    // e a mescla dos dois canais já acontece aqui.
    const q = String(opts.q || '').trim().toLowerCase();
    const from = opts.from ? new Date(String(opts.from)) : null;
    const to = opts.to ? new Date(String(opts.to)) : null;
    const all = [...wc, ...tg]
      .filter((s) => {
        if (q && !`${s.title} ${s.source_name} ${s.customer} ${s.provider}`.toLowerCase().includes(q)) return false;
        const t = new Date(s.created_at).getTime();
        if (from && !Number.isNaN(from.getTime()) && t < from.getTime()) return false;
        if (to && !Number.isNaN(to.getTime()) && t > to.getTime()) return false;
        return true;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const paid = all.filter((s) => s.status === 'PAID');
    const total = all.length;
    return {
      items: all.slice((page - 1) * pageSize, page * pageSize),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / pageSize)),
      revenue_paid: BRL(paid.reduce((acc, s) => acc + s.amount_cents, 0)),
      paid_count: paid.length,
      by_channel: {
        webchat: { paid: wc.filter((s) => s.status === 'PAID').length, revenue: BRL(wc.filter((s) => s.status === 'PAID').reduce((a, s) => a + s.amount_cents, 0)) },
        telegram: { paid: tg.filter((s) => s.status === 'PAID').length, revenue: BRL(tg.filter((s) => s.status === 'PAID').reduce((a, s) => a + s.amount_cents, 0)) },
      },
    };
  }
}
