import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import axios from 'axios';

import { PrismaService } from '../prisma/prisma.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';

type QuizLike = {
  id: string;
  organization_id: string;
  name: string;
  email_project_id: string | null;
  lead_email_html?: string | null;
  lead_email_subject?: string | null;
  lead_email_model?: any;
};

type LeadLike = {
  email?: string | null;
  name?: string | null;
  attributes?: Record<string, any> | null;
};

// Envio imediato de e-mail ao lead captado pelo quiz, reaproveitando o micro
// de e-mail (/send). Best-effort: NUNCA lança — a captação do lead não pode
// falhar por causa do e-mail.
@Injectable()
export class QuizLeadEmailService {
  private readonly logger = new Logger(QuizLeadEmailService.name);
  private readonly emailServiceUrl =
    process.env.EMAIL_SERVICE_URL ?? 'http://localhost:9999';

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly systemSettings: SystemSettingsService,
  ) {}

  async maybeSend(quiz: QuizLike, lead: LeadLike): Promise<void> {
    try {
      const html = String(quiz?.lead_email_html ?? '').trim();
      if (!html) return; // sem HTML => não envia (regra do produto)
      if (!quiz.email_project_id) return; // precisa do projeto p/ sender
      const email = String(lead?.email ?? '').trim().toLowerCase();
      if (!email) return; // sem destinatário

      const project = await this.prisma.email_projects.findFirst({
        where: { id: quiz.email_project_id, active: true },
        include: { organizations: true },
      });
      if (!project) return;

      const sender = (project.settings as any)?.sender;
      if (!sender?.fromEmail) {
        this.logger.warn(
          `Quiz ${quiz.id}: projeto sem sender configurado — e-mail do lead não enviado.`,
        );
        return;
      }

      const subject =
        String(quiz.lead_email_subject ?? '').trim() ||
        quiz.name ||
        'Sua resposta foi recebida';

      const baseApi = process.env.BASE_API_URL || 'http://localhost:8000';
      const mappedLead = {
        email,
        name: lead.name ?? null,
        attributes: {
          ...(lead.attributes && typeof lead.attributes === 'object'
            ? lead.attributes
            : {}),
          unsubscribe_link: `${baseApi}/email/leads/unsubscribe/${project.id}/${email}`,
        },
      };

      // Sent row p/ histórico/tracking (igual disparo manual). Em colisão de
      // unique (mesmo segundo/projeto), segue sem row (dispatchId aleatório).
      const runAt = new Date();
      let dispatchId: string = randomUUID();
      let sentRowId: string | null = null;
      try {
        const row = await this.prisma.email_projects_schedules_sent.create({
          data: {
            organization_id: project.organization_id,
            project_id: project.id,
            run_at: runAt,
            schedule_daily: false,
            sent: false,
            total_leads: 1,
            sent_for_leads: 0,
            tokens_unit_cost: 0,
            tokens_cost: 0,
          },
          select: { id: true },
        });
        dispatchId = row.id;
        sentRowId = row.id;
      } catch {
        // sem row — segue mesmo assim
      }

      const tokensPerLead = Number(
        this.config.get<number>('EMAIL_TOKENS_FOR_ONE_LEAD') ?? 0,
      );
      const totalCost = tokensPerLead * 1;

      if (totalCost > 0) {
        const wallet = await this.prisma.wallets.findFirst({
          where: { organization_id: project.organization_id, status: 'ACTIVE' },
        });
        if (!wallet || Number(wallet.balance) < totalCost) {
          if (sentRowId) {
            await this.prisma.email_projects_schedules_sent.update({
              where: { id: sentRowId },
              data: { error_message: 'Saldo insuficiente ou wallet inativa' },
            });
          }
          this.logger.warn(
            `Quiz ${quiz.id}: saldo insuficiente — e-mail do lead não enviado.`,
          );
          return;
        }
        await this.prisma.wallets.update({
          where: { id: wallet.id },
          data: { balance: { decrement: totalCost } },
        });
        await this.prisma.transactions.create({
          data: {
            wallet_id: wallet.id,
            amount: -totalCost,
            description: `DISPARO QUIZ (lead) | Quiz: ${quiz.name} | 1 lead`,
            type: 'TOKEN_DEBIT',
          },
        });
        if (sentRowId) {
          await this.prisma.email_projects_schedules_sent.update({
            where: { id: sentRowId },
            data: { tokens_unit_cost: tokensPerLead, tokens_cost: totalCost },
          });
        }
      }

      const resendApiKey = await this.systemSettings.getResendApiKeyOrFail();

      const payload = {
        dispatchId,
        leads: { count: 1, sample: [mappedLead] },
        project,
        organization: project.organizations,
        schedule: null,
        template: { subject, from_name: (quiz.lead_email_model as any)?.from_name?.trim?.() || null, body_html: html, body_text: '' },
        templatesCount: 1,
        resend_api_key: resendApiKey,
      };

      const response = await axios.post(
        `${this.emailServiceUrl}/send`,
        payload,
        { headers: { 'Content-Type': 'application/json' } },
      );

      if (response.status !== 201) {
        throw new Error(`Micro de e-mail retornou status ${response.status}`);
      }

      if (sentRowId) {
        await this.prisma.email_projects_schedules_sent.update({
          where: { id: sentRowId },
          data: { sent: true, subject, body_html: html },
        });
      }
      this.logger.log(`Quiz ${quiz.id}: e-mail enviado ao lead ${email}.`);
    } catch (e: any) {
      // Best-effort: nunca propaga erro pra captação.
      this.logger.warn(
        `Quiz ${quiz?.id}: falha ao enviar e-mail do lead: ${String(e?.message ?? e)}`,
      );
    }
  }
}
