import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { classifyEmail } from '../../common/email.util';

// ============================================================================
// Higiene de e-mails — REDE DE SEGURANÇA (roda 1x/hora).
// A defesa principal é a validação nas portas de entrada (captação, form/API,
// importação) — e-mail inválido nem entra mais. Este cron é o backup: varre os
// leads com e-mail SUSPEITO, CONSERTA os consertáveis (ex.: "gmail..com") e
// REMOVE os insanáveis. E-mails claramente válidos NUNCA são tocados.
// ============================================================================
@Injectable()
export class EmailHygieneRunner {
  private readonly logger = new Logger(EmailHygieneRunner.name);
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron() {
    if (this.running) return; // evita sobreposição
    this.running = true;
    try {
      const r = await this.runHygiene();
      if (r.fixed || r.removed) {
        this.logger.log(
          `Higiene de e-mails: ${r.fixed} corrigido(s), ${r.removed} removido(s) de ${r.scanned} candidato(s).`,
        );
      }
    } catch (e: any) {
      this.logger.warn(`Falha na higiene de e-mails: ${e?.message ?? e}`);
    } finally {
      this.running = false;
    }
  }

  async runHygiene(): Promise<{ scanned: number; fixed: number; removed: number }> {
    // Pré-filtro no banco: só os que "cheiram mal" (ponto duplo, espaço, vírgula,
    // ponto na ponta, ou fora de um formato básico). Barato mesmo com muitos leads.
    const candidates: Array<{
      id: string;
      email: string | null;
      organization_id: string;
    }> = await this.prisma.$queryRaw`
      SELECT id, email, organization_id
      FROM email_leads
      WHERE email IS NULL
         OR email LIKE '%..%'
         OR email LIKE '% %'
         OR email LIKE '%,%'
         OR email LIKE '.%'
         OR email LIKE '%@.%'
         OR email LIKE '%.@%'
         OR email NOT REGEXP '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
      LIMIT 5000
    `;

    let fixed = 0;
    let removed = 0;

    for (const lead of candidates) {
      try {
        const c = classifyEmail(lead.email);
        if (c.status === 'valid') continue; // falso-positivo do pré-filtro — não toca

        if (c.status === 'fixed') {
          // Se já existe outro lead (mesma org) com o e-mail consertado, este é
          // duplicado do válido -> remove este. Senão, conserta.
          const collision = await this.prisma.email_leads.findFirst({
            where: {
              organization_id: lead.organization_id,
              email: c.email,
              NOT: { id: lead.id },
            },
            select: { id: true },
          });
          if (collision) {
            await this.prisma.email_leads.delete({ where: { id: lead.id } });
            removed++;
            this.logger.log(
              `Higiene: removido lead ${lead.id} (dup de "${c.email}" já existente).`,
            );
          } else {
            await this.prisma.email_leads.update({
              where: { id: lead.id },
              data: { email: c.email },
            });
            fixed++;
            this.logger.log(
              `Higiene: corrigido lead ${lead.id}: "${c.original}" -> "${c.email}".`,
            );
          }
        } else {
          // insanável -> remove (cascade apaga os vínculos email_project_leads)
          await this.prisma.email_leads.delete({ where: { id: lead.id } });
          removed++;
          this.logger.log(
            `Higiene: removido lead ${lead.id} com e-mail inválido: "${c.email}".`,
          );
        }
      } catch (e: any) {
        this.logger.warn(
          `Higiene: falha ao processar lead ${lead?.id}: ${e?.message ?? e}`,
        );
      }
    }

    return { scanned: candidates.length, fixed, removed };
  }
}
