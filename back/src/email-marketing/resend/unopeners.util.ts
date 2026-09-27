import { PrismaService } from '../../prisma/prisma.service';

// Leads inscritos + ativos do projeto que NÃO abriram o disparo `sentId`.
// Retorna os não-abridores + o total de ativos (para o "N de M" da UI).
export async function getUnopeners(
  prisma: PrismaService,
  organizationId: string,
  projectId: string,
  sentId: string,
): Promise<{ nonOpeners: any[]; totalActive: number }> {
  const opens = await prisma.email_schedules_sent_opens.findMany({
    where: { schedule_sent_id: sentId },
    select: { email: true },
  });
  const openers = new Set(
    opens.map((o: any) => String(o.email || '').toLowerCase()),
  );

  const links = await prisma.email_project_leads.findMany({
    where: { project_id: projectId, status: 'SUBSCRIBED' },
    include: { leads: true },
  });

  const active = links.filter(
    (x: any) =>
      x.leads &&
      x.leads.global_status === 'ACTIVE' &&
      x.leads.organization_id === organizationId,
  );
  const nonOpeners = active.filter(
    (x: any) => !openers.has(String(x.leads.email || '').toLowerCase()),
  );

  return { nonOpeners, totalActive: active.length };
}

// Regra do "Reenviar para não-abridores" (A-28): o reenvio manda para "todos os
// inscritos ativos menos quem abriu", então só faz sentido para um disparo
// NORMAL (agendado/manual) pra base. Devolve o motivo do bloqueio ou null.
export async function sentNotResendableReason(
  prisma: PrismaService,
  sent: {
    id: string;
    flow_step_id?: string | null;
    recycle?: boolean | null;
    total_leads?: number | null;
  },
): Promise<string | null> {
  if (sent.flow_step_id) {
    return 'Este envio é de um passo do Fluxo Inicial — não pode ser reenviado para não-abridores.';
  }
  if (sent.recycle) {
    return 'Este envio é de reciclagem (win-back) — não pode ser reenviado para não-abridores.';
  }
  if ((sent.total_leads ?? 0) <= 1) {
    return 'Este envio foi individual (gatilho, boas-vindas ou teste) — não pode ser reenviado para não-abridores.';
  }
  const [asVariant, asWinner] = await Promise.all([
    prisma.email_ab_variants.count({ where: { test_sent_id: sent.id } }),
    prisma.email_ab_tests.count({ where: { winner_sent_id: sent.id } }),
  ]);
  if (asVariant > 0 || asWinner > 0) {
    return 'Este envio faz parte de um teste A/B — não pode ser reenviado para não-abridores.';
  }
  return null;
}
