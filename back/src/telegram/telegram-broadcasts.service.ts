import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const uid = () => Math.random().toString(36).slice(2, 10);

// Normaliza a URL de um botão. Telegram exige URL absoluta — link inválido faz o
// sendMessage inteiro falhar, então normalizamos/descartamos aqui (nunca envia lixo).
function normalizeButtonUrl(u: any): string {
  const s = String(u || '').trim();
  if (!s) return '';
  if (/^(https?:|tg:)/i.test(s)) return s.slice(0, 2048);
  if (/^t\.me\//i.test(s)) return `https://${s}`.slice(0, 2048);
  if (/^telegram\.me\//i.test(s)) return s.replace(/^telegram\.me\//i, 'https://t.me/').slice(0, 2048);
  if (/^@?[A-Za-z0-9_]{4,32}$/.test(s)) return `https://t.me/${s.replace(/^@/, '')}`;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(s)) return `https://${s}`.slice(0, 2048);
  return '';
}

// Botões inline (só link). label+url válidos; descarta os incompletos.
function sanitizeButtons(buttons: any): any[] {
  if (!Array.isArray(buttons)) return [];
  return buttons
    .slice(0, 6)
    .map((b: any) => {
      const base = { id: String(b?.id || uid()), label: String(b?.label || '').slice(0, 64).trim() };
      // botão de plano (checkout PIX) tem prioridade sobre url
      if (b?.plan_id) return { ...base, plan_id: String(b.plan_id) };
      return { ...base, url: normalizeButtonUrl(b?.url) };
    })
    .filter((b: any) => b.label && (b.plan_id || b.url));
}

// Normaliza uma mensagem de copy (mesmo shape do nó do fluxo).
function sanitizeMessages(messages: any): any[] {
  if (!Array.isArray(messages)) return [];
  return messages.slice(0, 20).map((m: any) => ({
    id: String(m?.id || uid()),
    text: String(m?.text || '').slice(0, 4000),
    media: m?.media && m.media.url ? { type: m.media.type, url: m.media.url, name: m.media.name || null } : null,
    buttons: sanitizeButtons(m?.buttons),
    delay_seconds: Math.min(10, Math.max(0, Number(m?.delay_seconds) || 0)),
  }));
}

@Injectable()
export class TelegramBroadcastsService {
  constructor(private readonly prisma: PrismaService) {}

  // Hora atual (parede) em BRT.
  private brtNowParts() {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const g = (t: string) => Number(parts.find((p) => p.type === t)?.value || 0);
    return { hour: g('hour') % 24, minute: g('minute'), second: g('second') };
  }

  // minuto-do-dia (0..1439) de uma data específica, em BRT.
  private brtMinuteOfDay(d: Date): number {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const hh = Number(parts.find((p) => p.type === 'hour')?.value || 0) % 24;
    const mm = Number(parts.find((p) => p.type === 'minute')?.value || 0);
    return hh * 60 + mm;
  }

  private map(b: any, copiesCount?: number, dmsCount?: number, timeStatus?: Record<string, string>) {
    return {
      id: b.id,
      name: b.name,
      bot_ids: Array.isArray(b.bot_ids) ? b.bot_ids : [],
      targets: b.targets || { dms: false, group_ids: [], channel_ids: [] },
      times: Array.isArray(b.times) ? b.times : [],
      mode: b.mode,
      delete_used: b.delete_used,
      active: b.active,
      copies_count: copiesCount,
      dms_count: dmsCount,
      time_status: timeStatus,
      updated_at: b.updated_at,
    };
  }

  private mapCopy(c: any) {
    return {
      id: c.id,
      position: c.position,
      messages: Array.isArray(c.messages) ? c.messages : [],
    };
  }

  // valida/filtra os ids contra a org
  private async sanitizeInputs(orgId: string, dto: any) {
    const out: any = {};
    if (dto.name !== undefined) out.name = String(dto.name || 'Broadcast').slice(0, 255);
    if (dto.mode !== undefined) out.mode = ['sequential', 'random'].includes(dto.mode) ? dto.mode : 'sequential';
    if (dto.delete_used !== undefined) out.delete_used = !!dto.delete_used;
    if (dto.active !== undefined) out.active = !!dto.active;

    if (dto.bot_ids !== undefined) {
      const ids = Array.isArray(dto.bot_ids) ? dto.bot_ids.map(String) : [];
      const bots = await this.prisma.telegram_bots.findMany({
        where: { id: { in: ids }, organization_id: orgId },
        select: { id: true },
      });
      out.bot_ids = bots.map((b) => b.id);
    }

    if (dto.times !== undefined) {
      const arr = Array.isArray(dto.times) ? dto.times : [];
      out.times = [...new Set(arr.map((t: any) => Math.max(0, Math.min(1439, parseInt(t, 10) || 0))))].sort((a: any, b: any) => a - b);
    }

    if (dto.targets !== undefined) {
      const t = dto.targets || {};
      const gids = Array.isArray(t.group_ids) ? t.group_ids.map(String) : [];
      const cids = Array.isArray(t.channel_ids) ? t.channel_ids.map(String) : [];
      const rows = await this.prisma.telegram_groups.findMany({
        where: { id: { in: [...gids, ...cids] }, organization_id: orgId },
        select: { id: true, type: true },
      });
      out.targets = {
        dms: !!t.dms,
        group_ids: rows.filter((r) => r.type !== 'channel').map((r) => r.id),
        channel_ids: rows.filter((r) => r.type === 'channel').map((r) => r.id),
      };
    }
    return out;
  }

  async list(orgId: string) {
    const rows = await this.prisma.telegram_broadcasts.findMany({
      where: { organization_id: orgId },
      orderBy: { created_at: 'desc' },
    });
    const counts = await this.prisma.telegram_broadcast_copies.groupBy({
      by: ['broadcast_id'],
      where: { organization_id: orgId },
      _count: { _all: true },
    });
    const cmap = new Map(counts.map((c: any) => [c.broadcast_id, c._count._all]));
    // nº de leads (DMs) por bot, p/ estimar a audiência de DM de cada broadcast
    const contactCounts = await this.prisma.telegram_contacts.groupBy({
      by: ['bot_id'],
      where: { organization_id: orgId },
      _count: { _all: true },
    });
    const ccmap = new Map(contactCounts.map((c: any) => [c.bot_id, c._count._all]));

    // runs de HOJE (BRT) p/ status por horário nos cards
    const bp = this.brtNowParts();
    const nowMinute = bp.hour * 60 + bp.minute;
    const startOfToday = new Date(Date.now() - (bp.hour * 3600 + bp.minute * 60 + bp.second) * 1000);
    const runsToday = await this.prisma.telegram_broadcast_runs.findMany({
      where: { organization_id: orgId, run_at: { gte: startOfToday } },
      orderBy: { run_at: 'desc' },
      select: { broadcast_id: true, run_at: true, status: true, total: true, sent: true, failed: true, blocked: true },
    });
    const runsByBc = new Map<string, any[]>();
    for (const r of runsToday) {
      const arr = runsByBc.get(r.broadcast_id) || [];
      arr.push({ ...r, minute: this.brtMinuteOfDay(r.run_at) });
      runsByBc.set(r.broadcast_id, arr);
    }

    return rows.map((b) => {
      const targets: any = b.targets || {};
      const botIds: any[] = Array.isArray(b.bot_ids) ? (b.bot_ids as any[]) : [];
      const dms = targets.dms ? botIds.reduce((s: number, id: any) => s + (ccmap.get(id) || 0), 0) : 0;

      const times: number[] = Array.isArray(b.times) ? (b.times as number[]) : [];
      const bcRuns = runsByBc.get(b.id) || []; // já em ordem desc (mais recente primeiro)
      const timeStatus: Record<string, string> = {};
      for (const t of times) {
        const run = bcRuns.find((r) => r.minute === t); // o mais recente daquele minuto
        if (run) {
          if (run.status === 'SENDING') timeStatus[t] = 'sending';
          else if ((run.sent || 0) > 0 && (run.failed || 0) === 0) timeStatus[t] = 'sent';
          else if ((run.sent || 0) === 0 && (run.total || 0) > 0) timeStatus[t] = 'failed';
          else if ((run.failed || 0) > 0) timeStatus[t] = 'partial';
          else timeStatus[t] = 'sent';
        } else {
          timeStatus[t] = t >= nowMinute ? 'pending' : 'missed';
        }
      }
      return this.map(b, cmap.get(b.id) || 0, dms, timeStatus);
    });
  }

  async get(orgId: string, id: string) {
    const b = await this.prisma.telegram_broadcasts.findFirst({ where: { id, organization_id: orgId } });
    if (!b) throw new NotFoundException('Broadcast não encontrado.');
    const copies = await this.prisma.telegram_broadcast_copies.findMany({
      where: { broadcast_id: id },
      orderBy: { position: 'asc' },
    });
    return { ...this.map(b, copies.length), copies: copies.map((c) => this.mapCopy(c)) };
  }

  async create(orgId: string, dto: any) {
    const data = await this.sanitizeInputs(orgId, dto);
    const b = await this.prisma.telegram_broadcasts.create({
      data: {
        organization_id: orgId,
        name: data.name || 'Broadcast',
        bot_ids: data.bot_ids || [],
        targets: data.targets || { dms: false, group_ids: [], channel_ids: [] },
        times: data.times || [],
        mode: data.mode || 'sequential',
        delete_used: data.delete_used ?? false,
        active: data.active ?? false,
      },
    });
    return this.map(b, 0);
  }

  async update(orgId: string, id: string, dto: any) {
    const existing = await this.prisma.telegram_broadcasts.findFirst({ where: { id, organization_id: orgId }, select: { id: true } });
    if (!existing) throw new NotFoundException('Broadcast não encontrado.');
    const data = await this.sanitizeInputs(orgId, dto);
    const b = await this.prisma.telegram_broadcasts.update({ where: { id }, data });
    return this.map(b);
  }

  async remove(orgId: string, id: string) {
    const existing = await this.prisma.telegram_broadcasts.findFirst({ where: { id, organization_id: orgId }, select: { id: true } });
    if (!existing) throw new NotFoundException('Broadcast não encontrado.');
    await this.prisma.telegram_broadcasts.delete({ where: { id } });
    return { ok: true, id };
  }

  // Copies: substitui a lista inteira do broadcast (position = índice).
  async saveCopies(orgId: string, broadcastId: string, copies: any[]) {
    const existing = await this.prisma.telegram_broadcasts.findFirst({ where: { id: broadcastId, organization_id: orgId }, select: { id: true } });
    if (!existing) throw new NotFoundException('Broadcast não encontrado.');
    const arr = Array.isArray(copies) ? copies : [];

    await this.prisma.$transaction([
      this.prisma.telegram_broadcast_copies.deleteMany({ where: { broadcast_id: broadcastId } }),
      ...arr.map((c: any, i: number) =>
        this.prisma.telegram_broadcast_copies.create({
          data: {
            organization_id: orgId,
            broadcast_id: broadcastId,
            position: i,
            messages: sanitizeMessages(c?.messages),
          },
        }),
      ),
    ]);
    const rows = await this.prisma.telegram_broadcast_copies.findMany({ where: { broadcast_id: broadcastId }, orderBy: { position: 'asc' } });
    return rows.map((c) => this.mapCopy(c));
  }

  async listCopies(orgId: string, broadcastId: string) {
    const existing = await this.prisma.telegram_broadcasts.findFirst({ where: { id: broadcastId, organization_id: orgId }, select: { id: true } });
    if (!existing) throw new NotFoundException('Broadcast não encontrado.');
    const rows = await this.prisma.telegram_broadcast_copies.findMany({ where: { broadcast_id: broadcastId }, orderBy: { position: 'asc' } });
    return rows.map((c) => this.mapCopy(c));
  }

  // Estimativa de audiência (DMs + grupos + canais).
  async audienceEstimate(orgId: string, dto: any) {
    const data = await this.sanitizeInputs(orgId, { bot_ids: dto.bot_ids, targets: dto.targets });
    const botIds = data.bot_ids || [];
    const targets = data.targets || { dms: false, group_ids: [], channel_ids: [] };
    let dms = 0;
    if (targets.dms && botIds.length) {
      dms = await this.prisma.telegram_contacts.count({ where: { organization_id: orgId, bot_id: { in: botIds } } });
    }
    return {
      dms,
      groups: targets.group_ids.length,
      channels: targets.channel_ids.length,
      total: dms + targets.group_ids.length + targets.channel_ids.length,
    };
  }

  // Runs (histórico) — paginado + filtros (status, período).
  async listRuns(orgId: string, broadcastId: string, opts: any = {}) {
    const existing = await this.prisma.telegram_broadcasts.findFirst({ where: { id: broadcastId, organization_id: orgId }, select: { id: true } });
    if (!existing) throw new NotFoundException('Broadcast não encontrado.');

    const where: any = { broadcast_id: broadcastId, organization_id: orgId };
    const status = String(opts.status || 'all');
    if (status === 'sending') where.status = 'SENDING';
    else if (status === 'done') where.status = 'DONE';
    else if (status === 'errors') where.OR = [{ failed: { gt: 0 } }, { blocked: { gt: 0 } }];
    else if (status === 'clean') { where.status = 'DONE'; where.failed = 0; where.blocked = 0; }

    if (opts.from || opts.to) {
      where.run_at = {};
      if (opts.from) {
        const d = new Date(opts.from);
        if (!isNaN(d.getTime())) where.run_at.gte = d;
      }
      if (opts.to) {
        const d = new Date(opts.to);
        if (!isNaN(d.getTime())) where.run_at.lte = d;
      }
    }

    const page = Math.max(1, parseInt(opts.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(5, parseInt(opts.page_size, 10) || 10));

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.telegram_broadcast_runs.count({ where }),
      this.prisma.telegram_broadcast_runs.findMany({
        where,
        orderBy: { run_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        run_at: r.run_at,
        status: r.status,
        total: r.total,
        sent: r.sent,
        failed: r.failed,
        blocked: r.blocked,
      })),
      total,
      page,
      page_size: pageSize,
      pages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }
}
