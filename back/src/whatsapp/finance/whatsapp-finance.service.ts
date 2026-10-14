import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { formatBRL } from '../wa-crm-vars.util';
import { addMonths, cycleMonthsOf, discountActive } from '../wa-subscription-math.util';

// ============================================================================
// Financeiro do WhatsApp (Fase 7 — contrato `docs/whatsapp-assinaturas-contrato.md` §11.4).
// Tudo em BRT (UTC−3 fixo). Período = [from 00:00, to 24:00).
//  - Recebido, inadimplência, cobranças abertas e cohort: AGREGADOS no SQL (sem trazer as linhas, sem teto).
//  - Unidade: filtro por JOIN com o cliente (`cu.unit_id`) — nunca um `IN (…)` com todos os clientes da unidade.
//  - Números (`session_id` e o acesso por número do usuário): valem para COBRANÇAS e pedidos. Assinaturas não têm
//    número → MRR, assinaturas ativas/novas/canceladas, churn e a parte "assinaturas" da previsão são da conta toda.
//  - Assinaturas ainda são lidas em memória (até 200 mil; as canceladas antes do período ficam de fora da consulta).
//  - Recebido inclui a linha "Pedidos pagos na entrega": pedidos marcados pagos sem cobrança paga (na entrega/
//    retirada ou baixa à mão sem PIX). Pedido pago por PIX entra pela própria cobrança (sem contar duas vezes).
//  - Churn = canceladas no período ENTRE as que estavam ativas no início (criadas antes, já iniciadas, fora do teste
//    grátis e não canceladas antes). Quem nunca ativou (teste grátis, criada e cancelada no período) não conta.
//  - Previsão = cobranças abertas que vencem na janela + CADA ciclo das assinaturas ativas que cai na janela
//    (mensal em 90 dias = até 3 ciclos), sem o ciclo que já tem cobrança aberta naquele vencimento.
// ============================================================================

const DAY = 86_400_000;
const isDay = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(+new Date(`${s}T12:00:00Z`));
const brtToday = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const brtStart = (day: string) => new Date(`${day}T00:00:00-03:00`);
const brtDayOf = (d: Date | string) => new Date(+new Date(d) - 3 * 3600_000).toISOString().slice(0, 10);
const addDays = (day: string, n: number) => new Date(+new Date(`${day}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const dstr = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v ? String(v).slice(0, 10) : '');
const num = (v: unknown) => Number(v ?? 0) || 0;
const ORDERS_METHOD = 'orders_on_delivery';
const METHOD_LABEL: Record<string, string> = { pix: 'PIX', boleto: 'Boleto', card: 'Cartão', manual: 'Baixa manual', other: 'Outros', [ORDERS_METHOD]: 'Pedidos pagos na entrega' };
/** Célula de CSV: aspas quando precisa e NEUTRALIZA fórmula (`=`, `+`, `-`, `@`, tab, CR no começo) — nada vira fórmula no Excel. */
const csvCell = (v: unknown) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(,\d+)?$/.test(s)) s = `'${s}`;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const BOM = String.fromCharCode(0xfeff);
/** Data/hora em UTC no formato do MySQL (o banco guarda UTC) — parâmetro de SQL cru sem depender do adaptador. */
const sqlDt = (d: Date) => d.toISOString().replace('T', ' ').replace('Z', '');
const money = (c: number) => (Number(c || 0) / 100).toFixed(2).replace('.', ',');

type Scope = { allowed: Set<string> | null };

@Injectable()
export class WhatsAppFinanceService {
  constructor(private readonly prisma: PrismaService) {}

  private period(q: any) {
    const today = brtToday();
    const to = isDay(q?.to) ? String(q.to) : today;
    const from = isDay(q?.from) ? String(q.from) : `${to.slice(0, 7)}-01`;
    if (from > to) throw new BadRequestException('O início do período é depois do fim.');
    if (+new Date(to) - +new Date(from) > 3 * 366 * DAY) throw new BadRequestException('Período de no máximo 3 anos.');
    return { from, to, start: brtStart(from), end: brtStart(addDays(to, 1)), today };
  }

  /** Filtro de unidade sobre o cliente (`cu` = alias do JOIN com whatsapp_customers). */
  private unitSql(unitId: unknown): Prisma.Sql {
    if (!unitId) return Prisma.empty;
    return String(unitId) === 'none' ? Prisma.sql` AND cu.unit_id IS NULL` : Prisma.sql` AND cu.unit_id = ${String(unitId)}`;
  }

  /** Número das COBRANÇAS: o escolhido (já conferido no controller) ou os números do usuário (null = todos). */
  private chargeSessSql(sessionId: unknown, allowed: Set<string> | null): Prisma.Sql {
    if (sessionId) return Prisma.sql` AND c.session_id = ${String(sessionId)}`;
    if (allowed === null) return Prisma.empty;
    if (!allowed.size) return Prisma.sql` AND 1 = 0`;
    return Prisma.sql` AND c.session_id IN (${Prisma.join([...allowed])})`;
  }

  /** Número dos PEDIDOS: pedido sem número é de todos (mesma regra da tela de pedidos). */
  private orderSessSql(sessionId: unknown, allowed: Set<string> | null): Prisma.Sql {
    if (sessionId) return Prisma.sql` AND o.session_id = ${String(sessionId)}`;
    if (allowed === null) return Prisma.empty;
    if (!allowed.size) return Prisma.sql` AND o.session_id IS NULL`;
    return Prisma.sql` AND (o.session_id IS NULL OR o.session_id IN (${Prisma.join([...allowed])}))`;
  }

  async overview(orgId: string, q: any = {}, scope: Scope = { allowed: null }) {
    const p = this.period(q);
    const unit = this.unitSql(q.unit_id);
    const cSess = this.chargeSessSql(q.session_id, scope.allowed);
    const oSess = this.orderSessSql(q.session_id, scope.allowed);
    const orderUnit: Prisma.Sql = !q.unit_id ? Prisma.empty : String(q.unit_id) === 'none' ? Prisma.sql` AND o.unit_id IS NULL` : Prisma.sql` AND o.unit_id = ${String(q.unit_id)}`;
    const firstMonth = addDays(p.to, -365).slice(0, 7);
    const lim90 = addDays(p.today, 90);

    const [subs, paidAgg, ordersAgg, pendAgg, pendSubs, products, units, cohortRows] = await Promise.all([
      // assinaturas: só o que pesa no período (as canceladas antes do início não entram em nenhum número)
      this.prisma.$queryRaw<any[]>`SELECT s.id, s.customer_id, s.product_id, s.product_name, s.price_cents, s.discount_cents, s.discount_until, s.billing, s.status, s.next_due_at, s.canceled_at, s.created_at, s.started_at, s.trial_ends_at
        FROM whatsapp_subscriptions s LEFT JOIN whatsapp_customers cu ON cu.id = s.customer_id
        WHERE s.organization_id = ${orgId} AND s.created_at < ${sqlDt(p.end)} AND (s.canceled_at IS NULL OR s.canceled_at >= ${sqlDt(p.start)})${unit}
        LIMIT 200000`,
      // recebido (cobranças pagas no período), agrupado por meio × produto × unidade × dia
      this.prisma.$queryRaw<any[]>`SELECT COALESCE(c.paid_via, '') AS via, COALESCE(c.product_id, s.product_id) AS pid,
          CASE WHEN c.subscription_id IS NOT NULL THEN s.product_name ELSE NULL END AS sname, (c.subscription_id IS NOT NULL) AS has_sub,
          cu.unit_id AS unit_id, DATE_FORMAT(DATE_SUB(c.paid_at, INTERVAL 3 HOUR), '%Y-%m-%d') AS pd, SUM(c.amount_cents) AS cents, COUNT(*) AS n
        FROM whatsapp_charges c
          LEFT JOIN whatsapp_subscriptions s ON s.id = c.subscription_id
          LEFT JOIN whatsapp_customers cu ON cu.id = c.customer_id
        WHERE c.organization_id = ${orgId} AND c.status = 'PAID' AND c.paid_at >= ${sqlDt(p.start)} AND c.paid_at < ${sqlDt(p.end)}${unit}${cSess}
        GROUP BY via, pid, sname, has_sub, unit_id, pd`,
      // pedidos pagos SEM cobrança paga (na entrega/retirada ou baixa à mão sem PIX)
      this.prisma.$queryRaw<any[]>`SELECT o.unit_id AS unit_id, DATE_FORMAT(DATE_SUB(o.paid_at, INTERVAL 3 HOUR), '%Y-%m-%d') AS pd, SUM(o.total_cents) AS cents, COUNT(*) AS n
        FROM whatsapp_orders o LEFT JOIN whatsapp_charges c ON c.id = o.charge_id
        WHERE o.organization_id = ${orgId} AND o.payment_status = 'paid' AND o.paid_at >= ${sqlDt(p.start)} AND o.paid_at < ${sqlDt(p.end)} AND o.total_cents > 0
          AND (c.id IS NULL OR c.status <> 'PAID')${orderUnit}${oSess}
        GROUP BY unit_id, pd`,
      // cobranças em aberto: em atraso (sem as de pedido/agenda, que não são inadimplência) e as que vencem nas janelas
      this.prisma.$queryRaw<any[]>`SELECT
          SUM(CASE WHEN c.due_at < ${p.today} AND c.purpose IS NULL THEN c.amount_cents ELSE 0 END) AS overdue,
          COUNT(DISTINCT CASE WHEN c.due_at < ${p.today} AND c.purpose IS NULL THEN c.customer_id END) AS overdue_customers,
          SUM(CASE WHEN c.due_at >= ${p.today} AND c.due_at <= ${addDays(p.today, 30)} THEN c.amount_cents ELSE 0 END) AS d30,
          SUM(CASE WHEN c.due_at >= ${p.today} AND c.due_at <= ${addDays(p.today, 60)} THEN c.amount_cents ELSE 0 END) AS d60,
          SUM(CASE WHEN c.due_at >= ${p.today} AND c.due_at <= ${lim90} THEN c.amount_cents ELSE 0 END) AS d90
        FROM whatsapp_charges c LEFT JOIN whatsapp_customers cu ON cu.id = c.customer_id
        WHERE c.organization_id = ${orgId} AND c.status = 'PENDING'${unit}${cSess}`,
      // vencimentos que já têm cobrança aberta (o ciclo não é contado de novo na previsão) — conta toda, como as assinaturas
      this.prisma.$queryRaw<any[]>`SELECT c.subscription_id AS sid, c.due_at AS due FROM whatsapp_charges c
        WHERE c.organization_id = ${orgId} AND c.status = 'PENDING' AND c.subscription_id IS NOT NULL AND c.due_at >= ${p.today} AND c.due_at <= ${lim90}
        LIMIT 400000`,
      this.prisma.whatsapp_products.findMany({ where: { organization_id: orgId }, select: { id: true, name: true } }),
      this.prisma.whatsapp_units.findMany({ where: { organization_id: orgId }, select: { id: true, name: true } }),
      // cohort (12 meses até o fim do período): clientes por mês de entrada e quantos têm assinatura viva hoje
      this.prisma.$queryRaw<any[]>`SELECT DATE_FORMAT(DATE_SUB(cu.created_at, INTERVAL 3 HOUR), '%Y-%m') AS m, COUNT(*) AS customers,
          SUM(EXISTS(SELECT 1 FROM whatsapp_subscriptions s WHERE s.customer_id = cu.id AND s.status IN ('active', 'overdue'))) AS active_now
        FROM whatsapp_customers cu
        WHERE cu.organization_id = ${orgId} AND cu.created_at >= ${sqlDt(brtStart(`${firstMonth}-01`))} AND cu.created_at < ${sqlDt(p.end)}${unit}
        GROUP BY m`,
    ]);
    const pname = new Map(products.map((x) => [x.id, x.name] as [string, string]));
    const uname = new Map(units.map((x) => [x.id, x.name] as [string, string]));

    // ---- assinaturas (conta toda; o número não vale aqui)
    const live = (s: any) => s.status === 'active' || s.status === 'overdue';
    const priceOn = (s: any, day: string) => Math.max(0, num(s.price_cents) - (discountActive(num(s.discount_cents), s.discount_until, day) ? num(s.discount_cents) : 0));
    let mrr = 0, active = 0;
    for (const s of subs) {
      const months = cycleMonthsOf(s.billing);
      if (!months || !live(s)) continue;
      active++;
      mrr += priceOn(s, p.today) / months;
    }
    const recurring = subs.filter((s) => cycleMonthsOf(s.billing) > 0);
    const inPeriod = (d: any) => d && +new Date(d) >= +p.start && +new Date(d) < +p.end;
    const newSubs = recurring.filter((s) => inPeriod(s.created_at)).length;
    const canceledList = recurring.filter((s) => inPeriod(s.canceled_at));
    // ativa no início = já existia, já tinha começado, fora do teste grátis e não cancelada antes
    const activeAtStartOf = (s: any) =>
      +new Date(s.created_at) < +p.start &&
      (!s.canceled_at || +new Date(s.canceled_at) >= +p.start) &&
      (!s.started_at || dstr(s.started_at) < p.from) &&
      (!s.trial_ends_at || dstr(s.trial_ends_at) <= p.from);
    const activeAtStart = recurring.filter(activeAtStartOf).length;
    const churned = canceledList.filter(activeAtStartOf).length;

    // ---- recebido
    const byMethod = new Map<string, { cents: number; count: number }>();
    const byProduct = new Map<string, { name: string; cents: number; count: number }>();
    const byUnit = new Map<string, { name: string; cents: number; count: number }>();
    const series = new Map<string, number>();
    let received = 0, receivedCount = 0;
    const add = (m: Map<string, any>, key: string, name: string, cents: number, n: number) => { const e = m.get(key) || { name, cents: 0, count: 0 }; e.cents += cents; e.count += n; m.set(key, e); };
    const unitName = (uid: string) => (uid === 'none' ? 'Sem unidade' : uname.get(uid) || 'Unidade removida');
    for (const r of paidAgg) {
      const cents = num(r.cents), n = num(r.n);
      received += cents; receivedCount += n;
      const m = ['pix', 'boleto', 'card', 'manual'].includes(String(r.via)) ? String(r.via) : 'other';
      add(byMethod, m, m, cents, n);
      const pid = r.pid || null, hasSub = num(r.has_sub) > 0;
      const pkey = pid || (hasSub ? `sub:${r.sname || ''}` : 'avulsa');
      const pn = pid ? pname.get(pid) || 'Produto removido' : hasSub ? r.sname || 'Assinatura' : 'Cobranças avulsas';
      add(byProduct, pkey, pn, cents, n);
      const uid = r.unit_id || 'none';
      add(byUnit, uid, unitName(uid), cents, n);
      if (r.pd) series.set(r.pd, (series.get(r.pd) || 0) + cents);
    }
    for (const r of ordersAgg) {
      const cents = num(r.cents), n = num(r.n);
      received += cents; receivedCount += n;
      add(byMethod, ORDERS_METHOD, ORDERS_METHOD, cents, n);
      add(byProduct, 'orders', 'Pedidos pagos na entrega', cents, n);
      const uid = r.unit_id || 'none';
      add(byUnit, uid, unitName(uid), cents, n);
      if (r.pd) series.set(r.pd, (series.get(r.pd) || 0) + cents);
    }

    // ---- inadimplência e previsão
    const pa = pendAgg[0] || {};
    const overdue = num(pa.overdue);
    const covered = new Set(pendSubs.map((r) => `${r.sid}|${dstr(r.due)}`));
    const subsForecast = (limit: string) => {
      let sum = 0;
      for (const s of subs) {
        const months = cycleMonthsOf(s.billing);
        if (!live(s) || !s.next_due_at || !months) continue;
        const first = dstr(s.next_due_at);
        for (let k = 0; k < 120; k++) {
          const due = k ? addMonths(first, k * months) : first;
          if (!due || due > limit) break;
          if (due < p.today || covered.has(`${s.id}|${due}`)) continue;
          sum += priceOn(s, due);
        }
      }
      return Math.round(sum);
    };

    const cohort = cohortRows
      .filter((r) => r.m && r.m >= firstMonth && r.m <= p.to.slice(0, 7))
      .map((r) => ({ month: String(r.m), customers: num(r.customers), active_now: num(r.active_now) }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const days: { day: string; received_cents: number }[] = [];
    for (let d = p.from; d <= p.to && days.length < 1200; d = addDays(d, 1)) days.push({ day: d, received_cents: series.get(d) || 0 });
    const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 10_000) / 100 : 0);
    return {
      period: { from: p.from, to: p.to, today: p.today, unit_id: q.unit_id || null, session_id: q.session_id || null, numbers_restricted: scope.allowed !== null },
      kpis: {
        mrr_cents: Math.round(mrr), mrr_label: formatBRL(Math.round(mrr)), active_subscriptions: active, new_subscriptions: newSubs, canceled_subscriptions: canceledList.length,
        churned_subscriptions: churned, active_at_start: activeAtStart, churn_rate: pct(churned, activeAtStart),
        received_cents: received, received_label: formatBRL(received), received_count: receivedCount,
        overdue_cents: overdue, overdue_label: formatBRL(overdue), overdue_customers: num(pa.overdue_customers), overdue_rate: pct(overdue, received + overdue),
        avg_ticket_cents: receivedCount ? Math.round(received / receivedCount) : 0,
      },
      forecast: {
        d30: num(pa.d30) + subsForecast(addDays(p.today, 30)),
        d60: num(pa.d60) + subsForecast(addDays(p.today, 60)),
        d90: num(pa.d90) + subsForecast(lim90),
      },
      received_by_method: [...byMethod.entries()].map(([method, v]) => ({ method, label: METHOD_LABEL[method] || method, cents: v.cents, count: v.count })).sort((a, b) => b.cents - a.cents),
      by_product: [...byProduct.entries()].map(([key, v]) => ({ product_id: key.startsWith('sub:') || key === 'avulsa' || key === 'orders' ? null : key, ...v })).sort((a, b) => b.cents - a.cents).slice(0, 50),
      by_unit: [...byUnit.entries()].map(([id, v]) => ({ unit_id: id === 'none' ? null : id, ...v })).sort((a, b) => b.cents - a.cents),
      series: days,
      cohort: cohort.map((v) => ({ ...v, retention: pct(v.active_now, v.customers) })),
    };
  }

  /** CSV (`;` + BOM, abre certo no Excel pt-BR): cobranças pagas no período ou assinaturas. */
  async exportCsv(orgId: string, q: any = {}, scope: Scope = { allowed: null }): Promise<{ filename: string; body: string }> {
    const p = this.period(q);
    const unit = this.unitSql(q.unit_id);
    const kind = q.kind === 'subscriptions' ? 'subscriptions' : 'charges';
    const lines: string[] = [];
    if (kind === 'charges') {
      const rows = await this.prisma.$queryRaw<any[]>`SELECT c.paid_at, c.description, c.amount_cents, c.paid_via, c.due_at, cu.name AS cname, cu.code AS ccode, cu.external_id AS cext, u.name AS uname
        FROM whatsapp_charges c
          LEFT JOIN whatsapp_customers cu ON cu.id = c.customer_id
          LEFT JOIN whatsapp_units u ON u.id = cu.unit_id
        WHERE c.organization_id = ${orgId} AND c.status = 'PAID' AND c.paid_at >= ${sqlDt(p.start)} AND c.paid_at < ${sqlDt(p.end)}${unit}${this.chargeSessSql(q.session_id, scope.allowed)}
        ORDER BY c.paid_at ASC LIMIT 100000`;
      lines.push(['Pago em', 'Cliente', 'Código', 'Código externo', 'Unidade', 'Descrição', 'Valor', 'Meio', 'Vencimento'].map(csvCell).join(';'));
      for (const r of rows) {
        lines.push([r.paid_at ? brtDayOf(r.paid_at) : '', r.cname, r.ccode, r.cext, r.uname, r.description, money(num(r.amount_cents)), METHOD_LABEL[String(r.paid_via)] || r.paid_via, dstr(r.due_at)].map(csvCell).join(';'));
      }
    } else {
      const rows = await this.prisma.$queryRaw<any[]>`SELECT s.product_name, s.price_cents, s.billing, s.status, s.next_due_at, s.created_at, s.canceled_at, cu.name AS cname, cu.code AS ccode, cu.external_id AS cext
        FROM whatsapp_subscriptions s LEFT JOIN whatsapp_customers cu ON cu.id = s.customer_id
        WHERE s.organization_id = ${orgId}${unit}
        ORDER BY s.created_at ASC LIMIT 100000`;
      lines.push(['Cliente', 'Código', 'Código externo', 'Produto', 'Valor', 'Ciclo', 'Status', 'Próximo vencimento', 'Criada em', 'Cancelada em'].map(csvCell).join(';'));
      for (const r of rows) {
        lines.push([r.cname, r.ccode, r.cext, r.product_name, money(num(r.price_cents)), r.billing, r.status, dstr(r.next_due_at), r.created_at ? brtDayOf(r.created_at) : '', r.canceled_at ? brtDayOf(r.canceled_at) : ''].map(csvCell).join(';'));
      }
    }
    return { filename: `${kind === 'charges' ? 'recebimentos' : 'assinaturas'}-${p.from}-a-${p.to}.csv`, body: BOM + lines.join('\r\n') + '\r\n' };
  }
}
