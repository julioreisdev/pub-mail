import { PrismaService } from '../prisma/prisma.service';

// Estado de flood-wait (429 do Telegram) por bot.
//
// Duas camadas: (1) cache em memória COMPARTILHADO pelos runners (broadcast, rotativa, …) —
// `isCooling(botId)` é a única fonte de verdade em runtime; (2) coluna `telegram_bots.flood_until`
// (persistida) — o front mostra "em pausa temporária" no card e, no boot / a cada ~60s,
// `refreshFromDb` recarrega o cache a partir dela (sobrevive a restart e a 429s vistos por outro
// runner). Tudo best-effort: nunca lança.
const MAX_COOLDOWN = 6 * 3600; // teto do flood-wait honrado (s)
const cooldownUntil = new Map<string, number>(); // botId → epoch ms

// true = bot em flood-wait agora; nenhuma chamada deve ser feita pra ele.
export function isCooling(botId: string): boolean {
  return Date.now() < (cooldownUntil.get(botId) || 0);
}

// ids dos bots em flood-wait (p/ excluir da fila: `bot_id: { notIn: coolingBotIds() }`).
export function coolingBotIds(): string[] {
  const now = Date.now();
  const out: string[] = [];
  for (const [id, until] of cooldownUntil) {
    if (until > now) out.push(id);
    else cooldownUntil.delete(id);
  }
  return out;
}

// Extrai o retry_after (s) de um 429, com fallback e teto.
export function retryAfterOf(res: any, fallback = 30): number {
  return Math.min(Number(res?.parameters?.retry_after) || fallback, MAX_COOLDOWN);
}

// true = há registro de flood pro bot (mesmo já vencido) → vale limpar o card no próximo envio ok.
export function hadFlood(botId: string): boolean {
  return cooldownUntil.has(botId);
}

export function setCooling(botId: string, seconds: number): void {
  cooldownUntil.set(botId, Date.now() + Math.max(1, seconds) * 1000);
}

export function clearCooling(botId: string): boolean {
  return cooldownUntil.delete(botId);
}

// Persiste o estado de flood-wait do bot na coluna telegram_bots.flood_until (+ cache em memória).
// Devolve o retry_after aplicado, ou null se a resposta não era 429.
export async function noteFlood(prisma: PrismaService, botId: string, res: any): Promise<number | null> {
  if (res && res.error_code === 429) {
    const retry = retryAfterOf(res);
    setCooling(botId, retry);
    await prisma.telegram_bots
      .update({ where: { id: botId }, data: { flood_until: new Date(Date.now() + retry * 1000) } })
      .catch(() => undefined);
    return retry;
  }
  return null;
}

// Limpa o flood-wait quando um envio volta a funcionar (só escreve se havia algo marcado).
export async function clearFlood(prisma: PrismaService, botId: string): Promise<void> {
  clearCooling(botId);
  await prisma.telegram_bots
    .updateMany({ where: { id: botId, flood_until: { not: null } }, data: { flood_until: null } })
    .catch(() => undefined);
}

// Recarrega o cache a partir do banco (bots com flood_until no futuro). Chamado no boot dos
// runners e periodicamente (~60s) — assim um 429 registrado por um runner vale pra todos, e
// um restart não "esquece" a pausa.
export async function refreshFromDb(prisma: PrismaService): Promise<void> {
  try {
    const rows = await prisma.telegram_bots.findMany({
      where: { flood_until: { gt: new Date() } },
      select: { id: true, flood_until: true },
    });
    for (const r of rows) {
      const until = r.flood_until ? r.flood_until.getTime() : 0;
      // só estende (nunca encurta um cooldown mais longo já conhecido em memória)
      if (until > (cooldownUntil.get(r.id) || 0)) cooldownUntil.set(r.id, until);
    }
  } catch {
    /* best-effort */
  }
}
