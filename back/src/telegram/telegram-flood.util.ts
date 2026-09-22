import { PrismaService } from '../prisma/prisma.service';

// Persiste o estado de flood-wait do bot (429 do Telegram) na coluna telegram_bots.flood_until,
// pra que o front mostre "em pausa temporária, volta em ~Xh" no card. Best-effort, nunca lança.
export async function noteFlood(prisma: PrismaService, botId: string, res: any): Promise<number | null> {
  if (res && res.error_code === 429) {
    const retry = Math.min(Number(res?.parameters?.retry_after) || 30, 6 * 3600);
    await prisma.telegram_bots
      .update({ where: { id: botId }, data: { flood_until: new Date(Date.now() + retry * 1000) } })
      .catch(() => undefined);
    return retry;
  }
  return null;
}

// Limpa o flood-wait quando um envio volta a funcionar (só escreve se havia algo marcado).
export async function clearFlood(prisma: PrismaService, botId: string): Promise<void> {
  await prisma.telegram_bots
    .updateMany({ where: { id: botId, flood_until: { not: null } }, data: { flood_until: null } })
    .catch(() => undefined);
}
