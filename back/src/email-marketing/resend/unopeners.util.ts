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
