import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Sanitiza a lista de textos rotativos.
function sanitizeMessages(messages: any): string[] {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((m: any) => (typeof m === 'string' ? m : String(m?.text || '')))
    .map((s: string) => s.slice(0, 3000))
    .filter((s: string) => s.trim().length > 0)
    .slice(0, 50);
}

function sanitizeNamePool(pool: any): string[] {
  if (!Array.isArray(pool)) return [];
  return pool
    .map((n: any) => String(n || '').trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 500);
}

@Injectable()
export class TelegramRotatorsService {
  constructor(private readonly prisma: PrismaService) {}

  private map(r: any, extra: any = {}) {
    return {
      id: r.id,
      bot_id: r.bot_id,
      group_id: r.group_id,
      target_kind: r.target_kind || 'group',
      name: r.name,
      active: r.active,
      interval_seconds: r.interval_seconds,
      mode: r.mode,
      messages: Array.isArray(r.messages) ? r.messages : [],
      name_pool: Array.isArray(r.name_pool) ? r.name_pool : [],
      current_index: r.current_index,
      last_rotated_at: r.last_rotated_at,
      updated_at: r.updated_at,
      ...extra,
    };
  }

  private async sanitizeInputs(orgId: string, dto: any, requireTarget: boolean) {
    const out: any = {};
    if (dto.name !== undefined) out.name = String(dto.name || 'Rotativa').slice(0, 255);
    if (dto.active !== undefined) out.active = !!dto.active;
    if (dto.mode !== undefined) out.mode = ['sequential', 'random'].includes(dto.mode) ? dto.mode : 'sequential';
    if (dto.interval_seconds !== undefined) out.interval_seconds = Math.min(3600, Math.max(5, parseInt(dto.interval_seconds, 10) || 15));
    if (dto.messages !== undefined) out.messages = sanitizeMessages(dto.messages);
    if (dto.name_pool !== undefined) out.name_pool = sanitizeNamePool(dto.name_pool);

    if (dto.target_kind !== undefined) out.target_kind = dto.target_kind === 'dm' ? 'dm' : 'group';

    if (dto.bot_id !== undefined || requireTarget) {
      const bot = await this.prisma.telegram_bots.findFirst({ where: { id: String(dto.bot_id || ''), organization_id: orgId }, select: { id: true } });
      if (!bot) throw new BadRequestException('Bot inválido.');
      out.bot_id = bot.id;
    }

    if (out.target_kind === 'dm') {
      // DM do próprio bot: não usa grupo
      out.group_id = null;
    } else if (out.target_kind === 'group' || dto.group_id !== undefined || requireTarget) {
      const grp = await this.prisma.telegram_groups.findFirst({
        where: { id: String(dto.group_id || ''), organization_id: orgId, ...(out.bot_id ? { bot_id: out.bot_id } : {}) },
        select: { id: true },
      });
      if (!grp) throw new BadRequestException('Grupo/canal inválido (precisa pertencer ao bot escolhido).');
      out.group_id = grp.id;
    }
    return out;
  }

  async list(orgId: string) {
    const rows = await this.prisma.telegram_rotators.findMany({ where: { organization_id: orgId }, orderBy: { created_at: 'desc' } });
    const botIds = [...new Set(rows.map((r) => r.bot_id))];
    const grpIds = [...new Set(rows.map((r) => r.group_id).filter(Boolean) as string[])];
    const bots = await this.prisma.telegram_bots.findMany({ where: { id: { in: botIds } }, select: { id: true, name: true, username: true, status: true } });
    const grps = await this.prisma.telegram_groups.findMany({ where: { id: { in: grpIds } }, select: { id: true, title: true, username: true, type: true } });
    const bmap = new Map(bots.map((b) => [b.id, b]));
    const gmap = new Map(grps.map((g) => [g.id, g]));
    return rows.map((r) => this.map(r, { bot: bmap.get(r.bot_id) || null, group: r.group_id ? gmap.get(r.group_id) || null : null }));
  }

  async create(orgId: string, dto: any) {
    const data = await this.sanitizeInputs(orgId, dto, true);
    const kind = data.target_kind || 'group';
    if (kind === 'dm') {
      // uma rotativa de DM por bot
      const exists = await this.prisma.telegram_rotators.findFirst({ where: { bot_id: data.bot_id, target_kind: 'dm' }, select: { id: true } });
      if (exists) throw new BadRequestException('Já existe uma mensagem rotativa nas DMs deste bot.');
    } else {
      // uma rotativa por grupo/canal (edita uma mensagem só)
      const exists = await this.prisma.telegram_rotators.findFirst({ where: { group_id: data.group_id }, select: { id: true } });
      if (exists) throw new BadRequestException('Já existe uma mensagem rotativa para este grupo/canal.');
    }
    const r = await this.prisma.telegram_rotators.create({
      data: {
        organization_id: orgId,
        bot_id: data.bot_id,
        group_id: data.group_id ?? null,
        target_kind: kind,
        name: data.name || 'Rotativa',
        active: data.active ?? false,
        interval_seconds: data.interval_seconds ?? 15,
        mode: data.mode || 'sequential',
        messages: data.messages || [],
        name_pool: data.name_pool || [],
      },
    });
    return this.map(r);
  }

  async update(orgId: string, id: string, dto: any) {
    const existing = await this.prisma.telegram_rotators.findFirst({ where: { id, organization_id: orgId } });
    if (!existing) throw new NotFoundException('Rotativa não encontrada.');
    const data = await this.sanitizeInputs(orgId, dto, false);
    const newKind = data.target_kind ?? existing.target_kind;
    // trocou de tipo (grupo<->DM) → reseta o estado de edição
    if (data.target_kind && data.target_kind !== existing.target_kind) {
      data.current_message_id = null;
      data.current_index = 0;
      data.dm_cursor = 0;
    }
    if (newKind === 'dm') {
      const botId = data.bot_id ?? existing.bot_id;
      const dup = await this.prisma.telegram_rotators.findFirst({ where: { bot_id: botId, target_kind: 'dm', id: { not: id } }, select: { id: true } });
      if (dup) throw new BadRequestException('Já existe uma mensagem rotativa nas DMs deste bot.');
    } else if (data.group_id && data.group_id !== existing.group_id) {
      const dup = await this.prisma.telegram_rotators.findFirst({ where: { group_id: data.group_id, id: { not: id } }, select: { id: true } });
      if (dup) throw new BadRequestException('Já existe uma mensagem rotativa para este grupo/canal.');
      data.current_message_id = null;
      data.current_index = 0;
    }
    const r = await this.prisma.telegram_rotators.update({ where: { id }, data });
    return this.map(r);
  }

  async remove(orgId: string, id: string) {
    const existing = await this.prisma.telegram_rotators.findFirst({ where: { id, organization_id: orgId }, select: { id: true } });
    if (!existing) throw new NotFoundException('Rotativa não encontrada.');
    await this.prisma.telegram_rotators.delete({ where: { id } });
    return { ok: true, id };
  }
}
