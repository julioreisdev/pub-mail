import { PrismaService } from '../../prisma/prisma.service';

const DAY = 86_400_000;

export type SegmentCondition = Record<string, any>;
export type Segment = { match: 'all' | 'any'; conditions: SegmentCondition[] };

const CONDITION_TYPES = new Set([
  'opened_within',
  'not_opened_within',
  'clicked_within',
  'not_clicked_within',
  'never_interacted',
  'open_rate',
  'open_count',
  'click_rate',
  'click_count',
  'has_tag',
  'not_has_tag',
  'source_is',
  'joined_within',
  'joined_before',
]);

const clampDays = (v: any) =>
  Math.max(1, Math.min(3650, Math.floor(Number(v) || 0)));
const clampPercent = (v: any) =>
  Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
const clampCount = (v: any) => Math.max(0, Math.floor(Number(v) || 0));
const opOf = (v: any) => (v === 'lte' ? 'lte' : 'gte');
const str = (v: any) => String(v ?? '').trim();

// Normaliza uma condição vinda do front. Retorna null se inválida.
function normalizeCondition(c: any): SegmentCondition | null {
  if (!c || typeof c !== 'object') return null;
  const type = String(c.type || '');
  if (!CONDITION_TYPES.has(type)) return null;

  switch (type) {
    case 'opened_within':
    case 'not_opened_within':
    case 'clicked_within':
    case 'not_clicked_within':
    case 'joined_within':
    case 'joined_before':
      return { type, days: clampDays(c.days) };
    case 'never_interacted':
      return { type };
    case 'open_rate':
    case 'click_rate':
      return {
        type,
        op: opOf(c.op),
        percent: clampPercent(c.percent),
        days: clampDays(c.days),
      };
    case 'open_count':
    case 'click_count':
      return {
        type,
        op: opOf(c.op),
        count: clampCount(c.count),
        days: clampDays(c.days),
      };
    case 'has_tag':
    case 'not_has_tag': {
      const tag = str(c.tag);
      return tag ? { type, tag } : null;
    }
    case 'source_is': {
      const source = str(c.source);
      return source ? { type, source } : null;
    }
    default:
      return null;
  }
}

// Normaliza o segmento inteiro. Retorna null se não houver condição válida.
export function normalizeSegment(raw: any): Segment | null {
  if (!raw || typeof raw !== 'object') return null;
  const match = raw.match === 'any' ? 'any' : 'all';
  const conditions = Array.isArray(raw.conditions)
    ? raw.conditions.map(normalizeCondition).filter(Boolean)
    : [];
  if ((conditions as SegmentCondition[]).length === 0) return null;
  return { match, conditions: conditions as SegmentCondition[] };
}

type EvalContext = {
  nowMs: number;
  lastOpenMs: number;
  lastClickMs: number;
  tags: string[];
  source: string;
  joinedMs: number;
  openRunAts: number[]; // run_at (ms) dos disparos que ESTE lead abriu
  clickRunAts: number[]; // run_at (ms) dos disparos que ESTE lead clicou
  dispatchRunAts: number[]; // run_at (ms) de TODOS os disparos na janela
};

const parseMs = (v: any) => {
  if (!v) return 0;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : 0;
};

function evalCondition(c: SegmentCondition, ctx: EvalContext): boolean {
  const cutoff = (days: number) => ctx.nowMs - days * DAY;
  switch (c.type) {
    case 'opened_within':
      return ctx.lastOpenMs > 0 && ctx.lastOpenMs >= cutoff(c.days);
    case 'not_opened_within':
      return !(ctx.lastOpenMs > 0 && ctx.lastOpenMs >= cutoff(c.days));
    case 'clicked_within':
      return ctx.lastClickMs > 0 && ctx.lastClickMs >= cutoff(c.days);
    case 'not_clicked_within':
      return !(ctx.lastClickMs > 0 && ctx.lastClickMs >= cutoff(c.days));
    case 'never_interacted':
      return ctx.lastOpenMs === 0 && ctx.lastClickMs === 0;
    case 'open_rate': {
      const co = cutoff(c.days);
      const dispatches = ctx.dispatchRunAts.filter((t) => t >= co).length;
      const opens = ctx.openRunAts.filter((t) => t >= co).length;
      const rate =
        dispatches > 0 ? (Math.min(opens, dispatches) / dispatches) * 100 : 0;
      return c.op === 'lte' ? rate <= c.percent : rate >= c.percent;
    }
    case 'open_count': {
      const co = cutoff(c.days);
      const opens = ctx.openRunAts.filter((t) => t >= co).length;
      return c.op === 'lte' ? opens <= c.count : opens >= c.count;
    }
    case 'click_rate': {
      const co = cutoff(c.days);
      const dispatches = ctx.dispatchRunAts.filter((t) => t >= co).length;
      const clicks = ctx.clickRunAts.filter((t) => t >= co).length;
      const rate =
        dispatches > 0 ? (Math.min(clicks, dispatches) / dispatches) * 100 : 0;
      return c.op === 'lte' ? rate <= c.percent : rate >= c.percent;
    }
    case 'click_count': {
      const co = cutoff(c.days);
      const clicks = ctx.clickRunAts.filter((t) => t >= co).length;
      return c.op === 'lte' ? clicks <= c.count : clicks >= c.count;
    }
    case 'has_tag':
      return ctx.tags.includes(c.tag);
    case 'not_has_tag':
      return !ctx.tags.includes(c.tag);
    case 'source_is':
      return ctx.source.toLowerCase() === String(c.source).toLowerCase();
    case 'joined_within':
      return ctx.joinedMs > 0 && ctx.joinedMs >= cutoff(c.days);
    case 'joined_before':
      return ctx.joinedMs > 0 && ctx.joinedMs <= cutoff(c.days);
    default:
      return false;
  }
}

function evaluateSegment(seg: Segment, ctx: EvalContext): boolean {
  const results = seg.conditions.map((c) => evalCondition(c, ctx));
  return seg.match === 'any' ? results.some(Boolean) : results.every(Boolean);
}

// Condições de taxa/quantidade (open/click) precisam buscar eventos + disparos.
function windowNeeds(seg: Segment): { maxDays: number; needsOpens: boolean; needsClicks: boolean } {
  let maxDays = 0;
  let needsOpens = false;
  let needsClicks = false;
  for (const c of seg.conditions) {
    if (c.type === 'open_rate' || c.type === 'open_count') {
      needsOpens = true;
      maxDays = Math.max(maxDays, Number(c.days) || 0);
    }
    if (c.type === 'click_rate' || c.type === 'click_count') {
      needsClicks = true;
      maxDays = Math.max(maxDays, Number(c.days) || 0);
    }
  }
  return { maxDays, needsOpens, needsClicks };
}

// Filtra os links (email_project_leads com include leads) pelo segmento.
// `links` já deve conter `.leads`, `.metrics` e `.created_at`.
export async function filterLinksBySegment(
  prisma: PrismaService,
  projectId: string,
  links: any[],
  rawSegment: any,
  now: Date,
): Promise<any[]> {
  const seg = normalizeSegment(rawSegment);
  if (!seg) return links;

  const nowMs = now.getTime();
  const { maxDays, needsOpens, needsClicks } = windowNeeds(seg);

  let dispatchRunAts: number[] = [];
  const openMap = new Map<string, number[]>();
  const clickMap = new Map<string, number[]>();

  if (maxDays > 0) {
    const since = new Date(nowMs - maxDays * DAY);

    const dispatches = await prisma.email_projects_schedules_sent.findMany({
      where: { project_id: projectId, sent: true, run_at: { gte: since } },
      select: { run_at: true },
    });
    dispatchRunAts = dispatches.map((d: any) => new Date(d.run_at).getTime());

    if (needsOpens) {
      const opens = await prisma.email_schedules_sent_opens.findMany({
        where: { sent_campaign: { project_id: projectId, sent: true, run_at: { gte: since } } },
        select: { email: true, sent_campaign: { select: { run_at: true } } },
      });
      for (const o of opens as any[]) {
        const key = String(o.email || '').toLowerCase();
        const t = new Date(o.sent_campaign?.run_at).getTime();
        if (!key || !Number.isFinite(t)) continue;
        const arr = openMap.get(key) || [];
        arr.push(t);
        openMap.set(key, arr);
      }
    }

    if (needsClicks) {
      const clicks = await prisma.email_schedules_sent_clicks.findMany({
        where: { sent_campaign: { project_id: projectId, sent: true, run_at: { gte: since } } },
        select: { email: true, sent_campaign: { select: { run_at: true } } },
      });
      for (const c of clicks as any[]) {
        const key = String(c.email || '').toLowerCase();
        const t = new Date(c.sent_campaign?.run_at).getTime();
        if (!key || !Number.isFinite(t)) continue;
        const arr = clickMap.get(key) || [];
        arr.push(t);
        clickMap.set(key, arr);
      }
    }
  }

  return links.filter((link: any) => {
    const lead = link?.leads;
    if (!lead) return false;
    const metrics =
      link.metrics && typeof link.metrics === 'object' ? link.metrics : {};
    const attrs =
      lead.attributes && typeof lead.attributes === 'object'
        ? lead.attributes
        : {};
    const ctx: EvalContext = {
      nowMs,
      lastOpenMs: parseMs(metrics.last_open),
      lastClickMs: parseMs(metrics.last_click_cta),
      tags: Array.isArray(lead.tags) ? lead.tags.map(String) : [],
      source: str(attrs.source),
      joinedMs: link.created_at ? new Date(link.created_at).getTime() : 0,
      openRunAts: openMap.get(String(lead.email || '').toLowerCase()) || [],
      clickRunAts: clickMap.get(String(lead.email || '').toLowerCase()) || [],
      dispatchRunAts,
    };
    return evaluateSegment(seg, ctx);
  });
}
