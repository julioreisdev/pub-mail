import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TelegramFlowsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertBot(orgId: string, botId: string) {
    const bot = await this.prisma.telegram_bots.findFirst({
      where: { id: botId, organization_id: orgId },
      select: { id: true, name: true, username: true, status: true },
    });
    if (!bot) throw new NotFoundException('Bot não encontrado.');
    return bot;
  }

  async getFlow(orgId: string, botId: string) {
    await this.assertBot(orgId, botId);
    const f = await this.prisma.telegram_flows.findFirst({
      where: { bot_id: botId, organization_id: orgId },
    });
    return {
      active: f?.active ?? false,
      name: f?.name ?? null,
      definition: (f?.definition as any) ?? null,
      start_node_id: f?.start_node_id ?? null,
      updated_at: f?.updated_at ?? null,
    };
  }

  async saveFlow(
    orgId: string,
    botId: string,
    dto: { active?: boolean; name?: string | null; definition?: any; start_node_id?: string | null },
  ) {
    await this.assertBot(orgId, botId);
    const data = {
      name: dto.name ?? null,
      active: !!dto.active,
      definition: dto.definition ?? null,
      start_node_id: dto.start_node_id ?? null,
    };
    const existing = await this.prisma.telegram_flows.findFirst({
      where: { bot_id: botId, organization_id: orgId },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.telegram_flows.update({ where: { id: existing.id }, data });
    } else {
      await this.prisma.telegram_flows.create({ data: { organization_id: orgId, bot_id: botId, ...data } });
    }
    return this.getFlow(orgId, botId);
  }
}
