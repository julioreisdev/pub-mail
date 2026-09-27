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
    // Paginado por cursor de id (A-91): antes era LIMIT 5000 fixo e, se a mesma
    // amostra fosse "válida mas diferente do cru" (ex.: "Nome <x@y.com>"), o
    // cron travava nela pra sempre sem nunca corrigir.
    const PAGE = 2000;
    const MAX_PAGES = 50; // teto por execução (100k candidatos)
    let cursor = '';
    let scanned = 0;
    let fixed = 0;
    let removed = 0;

    for (let page = 0; page < MAX_PAGES; page++) {
      const candidates: Array<{
        id: string;
        email: string | null;
        organization_id: string;
      }> = await this.prisma.$queryRaw`
        SELECT id, email, organization_id
        FROM email_leads
        WHERE id > ${cursor}
          AND (
               email IS NULL
            OR email LIKE '%..%'
            OR email LIKE '% %'
            OR email LIKE '%,%'
            OR email LIKE '.%'
            OR email LIKE '%@.%'
            OR email LIKE '%.@%'
            OR email NOT REGEXP '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
          )
        ORDER BY id ASC
        LIMIT ${PAGE}
      `;
      if (candidates.length === 0) break;
      cursor = candidates[candidates.length - 1].id;
      scanned += candidates.length;

      for (const lead of candidates) {
        try {
          const c = classifyEmail(lead.email);
          const raw = String(lead.email ?? '');

          // Válido mas DIFERENTE do cru (ex.: "Nome <x@y.com>", espaços,
          // maiúsculas): grava a forma normalizada (com checagem de colisão).
          // Válido e idêntico = falso-positivo do pré-filtro — não toca.
          if (c.status === 'valid') {
            if (c.email === raw) continue;
            const r = await this.applyFix(lead, c.email, raw);
            if (r === 'fixed') fixed++;
            else removed++;
            continue;
          }

          if (c.status === 'fixed') {
            const r = await this.applyFix(lead, c.email, c.original);
            if (r === 'fixed') fixed++;
            else removed++;
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

      if (candidates.length < PAGE) break;
    }

    return { scanned, fixed, removed };
  }

  // Se já existe outro lead (mesma org) com o e-mail consertado, este é
  // duplicado do válido -> remove este. Senão, conserta.
  private async applyFix(
    lead: { id: string; organization_id: string },
    fixedEmail: string,
    original: string,
  ): Promise<'fixed' | 'removed'> {
    const collision = await this.prisma.email_leads.findFirst({
      where: {
        organization_id: lead.organization_id,
        email: fixedEmail,
        NOT: { id: lead.id },
      },
      select: { id: true },
    });
    if (collision) {
      await this.prisma.email_leads.delete({ where: { id: lead.id } });
      this.logger.log(
        `Higiene: removido lead ${lead.id} (dup de "${fixedEmail}" já existente).`,
      );
      return 'removed';
    }
    await this.prisma.email_leads.update({
      where: { id: lead.id },
      data: { email: fixedEmail },
    });
    this.logger.log(
      `Higiene: corrigido lead ${lead.id}: "${original}" -> "${fixedEmail}".`,
    );
    return 'fixed';
  }
}
