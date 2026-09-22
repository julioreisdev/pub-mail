import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type OverviewParams = {
  projectId?: string;
  from?: string;
  to?: string;
};

const DAY = 86_400_000;
const BRT_OFFSET = 3 * 3_600_000; // Brasil sem horário de verão → UTC-3

function parseDate(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

function ratio(n: number, d: number): number {
  if (!d || d <= 0) return 0;
  return Math.round((n / d) * 10000) / 10000;
}

// campos agregados de um conjunto de disparos
function emptyTotals() {
  return {
    dispatches: 0,
    leads_reached: 0,
    delivered: 0,
    opens: 0,
    clicks: 0,
    unique_clicks: 0,
    bounces: 0,
    complaints: 0,
  };
}

@Injectable()
export class EmailAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private sentWhere(organizationId: string, projectId: string | undefined, from: Date, to: Date) {
    return {
      organization_id: organizationId,
      ...(projectId ? { project_id: projectId } : {}),
      run_at: { gte: from, lte: to },
    };
  }

  private accumulate(t: ReturnType<typeof emptyTotals>, s: any) {
    t.dispatches += 1;
    t.leads_reached += s.total_leads || 0;
    t.delivered += s.delivered_count || 0;
    t.opens += s.open_count || 0;
    t.clicks += s.click_cta_count || 0;
    t.unique_clicks += s.click_unique_count || 0;
    t.bounces += s.bounced_count || 0;
    t.complaints += s.complained_count || 0;
  }

  async overview(organizationId: string, params: OverviewParams) {
    const now = new Date();
    const to = parseDate(params.to) ?? now;
    const from = parseDate(params.from) ?? new Date(now.getTime() - 30 * DAY);
    const windowMs = Math.max(DAY, to.getTime() - from.getTime());

    if (params.projectId) {
      const p = await this.prisma.email_projects.findFirst({
        where: { id: params.projectId, organization_id: organizationId },
        select: { id: true },
      });
      if (!p) throw new NotFoundException('Projeto não encontrado.');
    }

    const sentSelect = {
      project_id: true,
      subject: true,
      run_at: true,
      total_leads: true,
      delivered_count: true,
      open_count: true,
      click_cta_count: true,
      click_unique_count: true,
      bounced_count: true,
      complained_count: true,
    };

    // -------- disparos no período + período anterior (para deltas) --------
    const prevFrom = new Date(from.getTime() - windowMs);
    const [sents, prevSents] = await Promise.all([
      this.prisma.email_projects_schedules_sent.findMany({
        where: this.sentWhere(organizationId, params.projectId, from, to),
        select: sentSelect,
        orderBy: { run_at: 'asc' },
      }),
      this.prisma.email_projects_schedules_sent.findMany({
        where: this.sentWhere(organizationId, params.projectId, prevFrom, from),
        select: {
          total_leads: true,
          delivered_count: true,
          open_count: true,
          click_cta_count: true,
          click_unique_count: true,
          bounced_count: true,
          complained_count: true,
        },
      }),
    ]);

    const totals = emptyTotals();
    const previous = emptyTotals();
    for (const s of prevSents) this.accumulate(previous, s);

    const seriesMap = new Map<string, any>();
    const perProjectMap = new Map<string, any>();
    const subjectMap = new Map<string, any>();
    const byWeekday = Array.from({ length: 7 }, () => ({ sent: 0, delivered: 0, opens: 0 }));
    const byHour = Array.from({ length: 24 }, () => ({ sent: 0, delivered: 0, opens: 0 }));

    for (const s of sents) {
      this.accumulate(totals, s);

      // série diária
      const k = dayKey(new Date(s.run_at));
      const row =
        seriesMap.get(k) ||
        { date: k, sent: 0, delivered: 0, opens: 0, clicks: 0, bounces: 0 };
      row.sent += s.total_leads || 0;
      row.delivered += s.delivered_count || 0;
      row.opens += s.open_count || 0;
      row.clicks += s.click_cta_count || 0;
      row.bounces += s.bounced_count || 0;
      seriesMap.set(k, row);

      // por projeto
      const pp =
        perProjectMap.get(s.project_id) ||
        { project_id: s.project_id, project_name: '', ...emptyTotals() };
      this.accumulate(pp, s);
      perProjectMap.set(s.project_id, pp);

      // por assunto
      const subj = (s.subject || '').trim();
      if (subj) {
        const su = subjectMap.get(subj) || { subject: subj, ...emptyTotals() };
        this.accumulate(su, s);
        subjectMap.set(subj, su);
      }

      // melhor dia/hora (em BRT)
      const brt = new Date(new Date(s.run_at).getTime() - BRT_OFFSET);
      const wd = brt.getUTCDay();
      const hr = brt.getUTCHours();
      byWeekday[wd].sent += s.total_leads || 0;
      byWeekday[wd].delivered += s.delivered_count || 0;
      byWeekday[wd].opens += s.open_count || 0;
      byHour[hr].sent += s.total_leads || 0;
      byHour[hr].delivered += s.delivered_count || 0;
      byHour[hr].opens += s.open_count || 0;
    }

    // nomes dos projetos do breakdown
    const projectIds = [...perProjectMap.keys()];
    if (projectIds.length > 0) {
      const projects = await this.prisma.email_projects.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, name: true },
      });
      const nameById = new Map(projects.map((p) => [p.id, p.name]));
      for (const pp of perProjectMap.values()) pp.project_name = nameById.get(pp.project_id) || '—';
    }

    const denom = totals.delivered > 0 ? totals.delivered : totals.leads_reached;
    const rates = {
      open_rate: ratio(totals.opens, denom),
      click_rate: ratio(totals.clicks, denom),
      ctor: ratio(totals.clicks, totals.opens), // click-to-open
      delivery_rate: ratio(totals.delivered, totals.leads_reached),
      bounce_rate: ratio(totals.bounces, totals.leads_reached),
      complaint_rate: ratio(totals.complaints, totals.leads_reached),
    };

    // -------- engajamento atual dos leads (na pivô) --------
    const links = await this.prisma.email_project_leads.findMany({
      where: {
        status: 'SUBSCRIBED',
        projects: {
          organization_id: organizationId,
          ...(params.projectId ? { id: params.projectId } : {}),
        },
      },
      select: { metrics: true, leads: { select: { global_status: true } } },
    });

    const engagement = { clicked: 0, opened: 0, none: 0, total: 0, suppressed: 0 };
    for (const l of links) {
      engagement.total += 1;
      const gs = (l.leads as any)?.global_status;
      if (gs === 'BOUNCED' || gs === 'COMPLAINED') engagement.suppressed += 1;
      const m = (l.metrics as any) || {};
      if (m.last_click_cta) engagement.clicked += 1;
      else if (m.last_open) engagement.opened += 1;
      else engagement.none += 1;
    }

    // -------- crescimento da base (novos leads/dia no período) --------
    const newLeadLinks = await this.prisma.email_project_leads.findMany({
      where: {
        created_at: { gte: from, lte: to },
        projects: {
          organization_id: organizationId,
          ...(params.projectId ? { id: params.projectId } : {}),
        },
      },
      select: { created_at: true },
    });
    const growthMap = new Map<string, number>();
    for (const nl of newLeadLinks) {
      const k = dayKey(new Date(nl.created_at as any));
      growthMap.set(k, (growthMap.get(k) || 0) + 1);
    }

    // -------- séries contínuas (dias vazios preenchidos, cap 180d) --------
    const series: any[] = [];
    const growth: any[] = [];
    const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
    const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
    let guard = 0;
    for (let t = start.getTime(); t <= end.getTime() && guard < 180; t += DAY, guard++) {
      const k = dayKey(new Date(t));
      const r = seriesMap.get(k) || { date: k, sent: 0, delivered: 0, opens: 0, clicks: 0, bounces: 0 };
      const d = r.delivered > 0 ? r.delivered : r.sent;
      series.push({
        ...r,
        open_rate: ratio(r.opens, d),
        click_rate: ratio(r.clicks, d),
        delivery_rate: ratio(r.delivered, r.sent),
      });
      growth.push({ date: k, new_leads: growthMap.get(k) || 0 });
    }

    const per_project = [...perProjectMap.values()]
      .map((pp) => ({
        ...pp,
        open_rate: ratio(pp.opens, pp.delivered > 0 ? pp.delivered : pp.leads_reached),
        click_rate: ratio(pp.clicks, pp.delivered > 0 ? pp.delivered : pp.leads_reached),
      }))
      .sort((a, b) => b.leads_reached - a.leads_reached);

    // top assuntos por taxa de abertura (com pelo menos 1 lead alcançado)
    const top_subjects = [...subjectMap.values()]
      .filter((su) => su.leads_reached > 0)
      .map((su) => {
        const d = su.delivered > 0 ? su.delivered : su.leads_reached;
        return {
          subject: su.subject,
          dispatches: su.dispatches,
          leads_reached: su.leads_reached,
          delivered: su.delivered,
          opens: su.opens,
          clicks: su.clicks,
          open_rate: ratio(su.opens, d),
          click_rate: ratio(su.clicks, d),
        };
      })
      .sort((a, b) => b.open_rate - a.open_rate)
      .slice(0, 8);

    // finaliza melhor dia/hora com taxa
    const weekdays = byWeekday.map((w, i) => ({
      weekday: i,
      sent: w.sent,
      opens: w.opens,
      open_rate: ratio(w.opens, w.delivered > 0 ? w.delivered : w.sent),
    }));
    const hours = byHour.map((h, i) => ({
      hour: i,
      sent: h.sent,
      opens: h.opens,
      open_rate: ratio(h.opens, h.delivered > 0 ? h.delivered : h.sent),
    }));

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      totals,
      previous,
      rates,
      series,
      growth,
      engagement,
      per_project,
      top_subjects,
      by_weekday: weekdays,
      by_hour: hours,
    };
  }
}
