import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Aquecimento e limites de envio — implementados AQUI (o pacing do OpenWA é global,
// não por sessão; o do Pub Mail é POR NÚMERO e o cliente pode desligar assumindo o risco).
// Só BROADCASTS obedecem ao limite; o chat manual (humano) sempre envia, mas conta.
// Dia de aquecimento = dias desde o pareamento daquele número (1..7; ≥8 = aquecido).
export const WARMUP_DAILY = [20, 40, 80, 160, 320, 640, 1000];
export const WARMUP_COLD = [5, 10, 20, 40, 60, 80, 100];
const WARM_DAILY = 1000;
const WARM_COLD = 100;

export type PacingRow = { id: string; paired_at: Date | null; pacing_enabled: boolean; organization_id: string };

export function brtDayStart(now = new Date()) {
  // início do dia em America/Sao_Paulo (UTC-3, sem horário de verão desde 2019)
  const brt = new Date(now.getTime() - 3 * 3600_000);
  const start = Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate()) + 3 * 3600_000;
  return new Date(start);
}

@Injectable()
export class WhatsAppPacingService {
  constructor(private readonly prisma: PrismaService) {}

  warmupDay(pairedAt: Date | null | undefined) {
    if (!pairedAt) return null;
    return Math.max(1, Math.floor((Date.now() - new Date(pairedAt).getTime()) / 86_400_000) + 1);
  }

  limits(pairedAt: Date | null | undefined) {
    const day = this.warmupDay(pairedAt);
    if (!day) return { day: null, daily: WARMUP_DAILY[0], cold: WARMUP_COLD[0], warmed: false };
    if (day >= 8) return { day, daily: WARM_DAILY, cold: WARM_COLD, warmed: true };
    return { day, daily: WARMUP_DAILY[day - 1], cold: WARMUP_COLD[day - 1], warmed: false };
  }

  // Enviadas hoje (BRT) pelo número e, dentre elas, "frias" = para chats individuais sem nenhuma mensagem recebida antes.
  async sentToday(row: PacingRow) {
    const start = brtDayStart();
    const out = await this.prisma.whatsapp_messages.findMany({
      where: { organization_id: row.organization_id, session_id: row.id, direction: 'OUT', timestamp: { gte: start }, chat_id: { endsWith: '@c.us' } },
      select: { chat_id: true },
    });
    const total = out.length;
    if (!total) return { total: 0, cold: 0 };
    const chats = [...new Set(out.map((m) => m.chat_id))];
    // chats que já receberam algo (não são frios)
    const warmChats = await this.prisma.whatsapp_messages.groupBy({ by: ['chat_id'], where: { organization_id: row.organization_id, session_id: row.id, direction: 'IN', chat_id: { in: chats } } });
    const warm = new Set(warmChats.map((w) => w.chat_id));
    const coldChats = new Set(chats.filter((c) => !warm.has(c)));
    const cold = out.filter((m) => coldChats.has(m.chat_id)).length;
    return { total, cold };
  }

  async summary(row: PacingRow) {
    const lim = this.limits(row.paired_at);
    const sent = await this.sentToday(row);
    return { session_id: row.id, day: lim.day, warmed: lim.warmed, daily_limit: lim.daily, cold_limit: lim.cold, sent_today: sent.total, cold_today: sent.cold, pacing_enabled: row.pacing_enabled !== false, remaining: Math.max(0, lim.daily - sent.total), cold_remaining: Math.max(0, lim.cold - sent.cold) };
  }

  // Broadcast pode enviar deste número para este chat agora? (false → PACED até amanhã)
  // `dailyCap` (opcional) = limite diário extra configurado na campanha (vale o menor).
  async canSend(row: PacingRow, chatId: string, dailyCap?: number | null): Promise<{ ok: boolean; reason?: string }> {
    if (!/@c\.us$/.test(chatId)) return { ok: true }; // grupos não entram no aquecimento
    const lim = this.limits(row.paired_at);
    const daily = row.pacing_enabled === false ? Number.POSITIVE_INFINITY : lim.daily;
    const cap = dailyCap && dailyCap > 0 ? Math.min(daily, dailyCap) : daily;
    if (!Number.isFinite(cap) && row.pacing_enabled === false) return { ok: true };
    const sent = await this.sentToday(row);
    if (sent.total >= cap) return { ok: false, reason: `Limite do dia (${cap}) atingido` };
    if (row.pacing_enabled === false) return { ok: true };
    const hasIn = await this.prisma.whatsapp_messages.count({ where: { organization_id: row.organization_id, session_id: row.id, chat_id: chatId, direction: 'IN' } });
    if (!hasIn && sent.cold >= lim.cold) return { ok: false, reason: `Limite de contatos frios do dia (${lim.cold}) atingido` };
    return { ok: true };
  }
}
