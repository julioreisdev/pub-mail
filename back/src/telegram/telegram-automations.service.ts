import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const UNIT_MS: Record<string, number> = { minutes: 60_000, hours: 3_600_000, days: 86_400_000 };

export function stepDelayMs(step: any): number {
  const v = Number(step?.delay_value) || 0;
  const ms = UNIT_MS[step?.delay_unit] ?? UNIT_MS.minutes;
  return Math.max(0, v * ms);
}

type Bot = { id: string; organization_id: string };

@Injectable()
export class TelegramAutomationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertBot(orgId: string, botId: string) {
    const bot = await this.prisma.telegram_bots.findFirst({
      where: { id: botId, organization_id: orgId },
      select: { id: true },
    });
    if (!bot) throw new NotFoundException('Bot não encontrado.');
    return bot;
  }

  private sanitizeSteps(steps: any): any[] {
    if (!Array.isArray(steps)) return [];
    return steps.slice(0, 50).map((s: any) => ({
      id: String(s?.id || Math.random().toString(36).slice(2)),
      delay_value: Math.max(0, Number(s?.delay_value) || 0),
      delay_unit: ['minutes', 'hours', 'days'].includes(s?.delay_unit) ? s.delay_unit : 'minutes',
      text: String(s?.text || '').slice(0, 4000),
      media: s?.media && s.media.url ? { type: s.media.type, url: s.media.url, name: s.media.name || null } : null,
      buttons: Array.isArray(s?.buttons)
        ? s.buttons.slice(0, 10).map((b: any) =>
            b?.plan_id
              ? { id: String(b?.id || ''), label: String(b?.label || '').slice(0, 64), plan_id: String(b.plan_id) }
              : { id: String(b?.id || ''), label: String(b?.label || '').slice(0, 64), url: String(b?.url || '') }
          )
        : [],
      condition: {
        type: ['always', 'inactive'].includes(s?.condition?.type) ? s.condition.type : 'always',
        on_fail: ['skip', 'stop'].includes(s?.condition?.on_fail) ? s.condition.on_fail : 'skip',
      },
      apply_tags: Array.isArray(s?.apply_tags) ? s.apply_tags.map((t: any) => String(t || '').trim()).filter(Boolean).slice(0, 20) : [],
    }));
  }

  private map(a: any) {
    return {
      id: a.id,
      name: a.name,
      active: a.active,
      trigger_type: a.trigger_type,
      steps: Array.isArray(a.steps) ? a.steps : [],
      updated_at: a.updated_at,
    };
  }

  async list(orgId: string, botId: string) {
    await this.assertBot(orgId, botId);
    const rows = await this.prisma.telegram_automations.findMany({
      where: { bot_id: botId, organization_id: orgId },
      orderBy: { created_at: 'asc' },
    });
    return rows.map((r) => this.map(r));
  }

  async create(orgId: string, botId: string, dto: any) {
    await this.assertBot(orgId, botId);
    const row = await this.prisma.telegram_automations.create({
      data: {
        organization_id: orgId,
        bot_id: botId,
        name: dto?.name ? String(dto.name).slice(0, 255) : 'Automação',
        active: !!dto?.active,
        trigger_type: 'ON_START',
        steps: this.sanitizeSteps(dto?.steps),
      },
    });
    return this.map(row);
  }

  async update(orgId: string, botId: string, id: string, dto: any) {
    await this.assertBot(orgId, botId);
    const existing = await this.prisma.telegram_automations.findFirst({
      where: { id, bot_id: botId, organization_id: orgId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Automação não encontrada.');
    const row = await this.prisma.telegram_automations.update({
      where: { id },
      data: {
        ...(dto?.name !== undefined ? { name: String(dto.name).slice(0, 255) } : {}),
        ...(dto?.active !== undefined ? { active: !!dto.active } : {}),
        ...(dto?.steps !== undefined ? { steps: this.sanitizeSteps(dto.steps) } : {}),
      },
    });
    return this.map(row);
  }

  async remove(orgId: string, botId: string, id: string) {
    await this.assertBot(orgId, botId);
    const existing = await this.prisma.telegram_automations.findFirst({
      where: { id, bot_id: botId, organization_id: orgId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Automação não encontrada.');
    await this.prisma.telegram_automations.delete({ where: { id } });
    return { ok: true, id };
  }

  // Inscreve o usuário em todas as automações ativas do bot (chamado no /start).
  async enrollOnStart(bot: Bot, tgUserId: number | string) {
    if (tgUserId == null) return;
    const autos = await this.prisma.telegram_automations.findMany({
      where: { bot_id: bot.id, organization_id: bot.organization_id, active: true },
    });
    if (!autos.length) return;
    const contact = await this.prisma.telegram_contacts.findFirst({
      where: { bot_id: bot.id, tg_user_id: BigInt(tgUserId) },
      select: { id: true },
    });

    for (const a of autos) {
      const steps = Array.isArray(a.steps) ? (a.steps as any[]) : [];
      if (!steps.length) continue;
      const nextAt = new Date(Date.now() + stepDelayMs(steps[0]));
      const data: any = { next_step: 0, next_send_at: nextAt, status: 'ACTIVE', enrolled_at: new Date(), contact_id: contact?.id || null };
      const existing = await this.prisma.telegram_automation_enrollments.findFirst({
        where: { automation_id: a.id, tg_user_id: BigInt(tgUserId) },
        select: { id: true },
      });
      if (existing) {
        await this.prisma.telegram_automation_enrollments.update({ where: { id: existing.id }, data });
      } else {
        await this.prisma.telegram_automation_enrollments.create({
          data: { organization_id: bot.organization_id, bot_id: bot.id, automation_id: a.id, tg_user_id: BigInt(tgUserId), ...data },
        });
      }
    }
  }
}
