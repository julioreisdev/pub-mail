import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramFlowRuntimeService } from './telegram-flow-runtime.service';
import { stepDelayMs } from './telegram-automations.service';

@Injectable()
export class TelegramAutomationsRunner {
  private readonly logger = new Logger(TelegramAutomationsRunner.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly runtime: TelegramFlowRuntimeService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const due = await this.prisma.telegram_automation_enrollments.findMany({
        where: { status: 'ACTIVE', next_send_at: { lte: new Date() } },
        orderBy: { next_send_at: 'asc' },
        take: 200,
      });
      for (const enr of due) {
        try {
          await this.process(enr);
        } catch (e: any) {
          this.logger.warn(`automação enrollment ${enr.id} falhou: ${e?.message || e}`);
        }
      }
    } catch (e: any) {
      this.logger.error(`tick de automações falhou: ${e?.message || e}`);
    } finally {
      this.running = false;
    }
  }

  private async setEnrollment(id: string, data: any) {
    await this.prisma.telegram_automation_enrollments.update({ where: { id }, data }).catch(() => undefined);
  }

  private async process(enr: any) {
    const autom = await this.prisma.telegram_automations.findFirst({ where: { id: enr.automation_id } });
    if (!autom || !autom.active) {
      await this.setEnrollment(enr.id, { status: 'COMPLETED' });
      return;
    }
    const steps = Array.isArray(autom.steps) ? (autom.steps as any[]) : [];
    const step = steps[enr.next_step];
    if (!step) {
      await this.setEnrollment(enr.id, { status: 'COMPLETED' });
      return;
    }

    const bot = await this.prisma.telegram_bots.findFirst({
      where: { id: enr.bot_id },
      select: { token: true, status: true },
    });
    if (!bot?.token || bot.status === 'BANNED') {
      await this.setEnrollment(enr.id, { status: 'STOPPED' });
      return;
    }

    // avalia condição
    let shouldSend = true;
    if (step.condition?.type === 'inactive') {
      const interactions = await this.prisma.telegram_messages.count({
        where: {
          bot_id: enr.bot_id,
          direction: 'IN',
          tg_chat_id: BigInt(enr.tg_user_id),
          ...(enr.enrolled_at ? { created_at: { gt: enr.enrolled_at } } : {}),
        },
      });
      if (interactions > 0) shouldSend = false;
    }

    if (!shouldSend && step.condition?.on_fail === 'stop') {
      await this.setEnrollment(enr.id, { status: 'STOPPED' });
      return;
    }

    if (shouldSend) {
      const contact = await this.prisma.telegram_contacts.findFirst({
        where: enr.contact_id ? { id: enr.contact_id } : { bot_id: enr.bot_id, tg_user_id: BigInt(enr.tg_user_id) },
        select: { first_name: true, last_name: true, username: true, attributes: true },
      });
      const info = {
        first_name: contact?.first_name || '',
        last_name: contact?.last_name || '',
        username: contact?.username || '',
        start_param: (contact?.attributes as any)?.start_param || '',
      };
      const bot2 = { id: enr.bot_id, organization_id: enr.organization_id };
      await this.runtime.sendComposed(bot2, bot.token, String(enr.tg_user_id), String(enr.tg_user_id), step, info);
      if (Array.isArray(step.apply_tags) && step.apply_tags.length) {
        await this.runtime.applyTags(bot2, String(enr.tg_user_id), step.apply_tags).catch(() => undefined);
      }
    }

    // avança
    const nextIndex = enr.next_step + 1;
    if (nextIndex < steps.length) {
      const nextAt = new Date(Date.now() + stepDelayMs(steps[nextIndex]));
      await this.setEnrollment(enr.id, { next_step: nextIndex, next_send_at: nextAt });
    } else {
      await this.setEnrollment(enr.id, { status: 'COMPLETED' });
    }
  }
}
