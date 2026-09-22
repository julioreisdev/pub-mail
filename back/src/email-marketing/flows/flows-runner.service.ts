import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

import { PrismaService } from '../../prisma/prisma.service';
import { SystemSettingsService } from '../../system-settings/system-settings.service';

function stepDelayMs(step: { delay_value: number; delay_unit: string }) {
  const v = Math.max(0, Number(step.delay_value) || 0);
  return step.delay_unit === 'hours' ? v * 3_600_000 : v * 60_000;
}

type StepCondition = { type: 'always' | 'opened' | 'clicked'; on_fail: 'skip' | 'stop' };

export function normalizeStepCondition(raw: any): StepCondition {
  const type =
    raw?.type === 'opened' || raw?.type === 'clicked' ? raw.type : 'always';
  const on_fail = raw?.on_fail === 'stop' ? 'stop' : 'skip';
  return { type, on_fail };
}

// Executa o "Fluxo Inicial" de e-mails: inscreve leads captados após a ativação
// e dispara cada e-mail no seu horário. Roda a cada minuto (delays em minutos).
@Injectable()
export class EmailFlowsRunner {
  private readonly logger = new Logger(EmailFlowsRunner.name);
  private readonly emailServiceUrl =
    process.env.EMAIL_SERVICE_URL ?? 'http://localhost:9999';
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly systemSettings: SystemSettingsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    if (this.running) return; // evita sobreposição se um tick demorar
    this.running = true;
    try {
      await this.enrollNewLeads();
      await this.processDue();
    } catch (e: any) {
      this.logger.error(`tick error: ${String(e?.message ?? e)}`);
    } finally {
      this.running = false;
    }
  }

  // Inscreve leads do projeto captados DEPOIS da ativação e ainda sem enrollment.
  private async enrollNewLeads() {
    const flows = await this.prisma.email_flows.findMany({
      where: { active: true, activated_at: { not: null } },
      include: { steps: { orderBy: { position: 'asc' }, take: 1 } },
    });

    for (const flow of flows) {
      const firstStep = (flow as any).steps?.[0];
      if (!firstStep) continue;

      const pivots = await this.prisma.email_project_leads.findMany({
        where: {
          project_id: flow.project_id,
          status: 'SUBSCRIBED',
          created_at: { gte: flow.activated_at as Date },
        },
        include: { leads: { select: { id: true, email: true } } },
        orderBy: { created_at: 'asc' },
        take: 500,
      });
      if (pivots.length === 0) continue;

      const leadIds = pivots.map((p) => p.lead_id);
      const already = await this.prisma.email_flow_enrollments.findMany({
        where: { flow_id: flow.id, lead_id: { in: leadIds } },
        select: { lead_id: true },
      });
      const enrolled = new Set(already.map((e) => e.lead_id));
      const delayMs = stepDelayMs(firstStep);

      for (const p of pivots) {
        if (enrolled.has(p.lead_id)) continue;
        const base = new Date(p.created_at as any);
        const nextSendAt = new Date(base.getTime() + delayMs);
        try {
          await this.prisma.email_flow_enrollments.create({
            data: {
              organization_id: flow.organization_id,
              flow_id: flow.id,
              project_id: flow.project_id,
              lead_id: p.lead_id,
              email: (p as any).leads?.email ?? null,
              next_step: 0,
              next_send_at: nextSendAt,
              status: 'active',
            },
          });
        } catch {
          // corrida no unique (flow_id, lead_id) — ok
        }
      }
    }
  }

  private async processDue() {
    const now = new Date();
    const due = await this.prisma.email_flow_enrollments.findMany({
      where: { status: 'active', next_send_at: { lte: now } },
      orderBy: { next_send_at: 'asc' },
      take: 300,
    });
    for (const en of due) {
      try {
        await this.processEnrollment(en);
      } catch (e: any) {
        this.logger.warn(
          `enrollment ${en.id} erro: ${String(e?.message ?? e)}`,
        );
      }
    }
  }

  private async processEnrollment(en: any) {
    const flow = await this.prisma.email_flows.findUnique({
      where: { id: en.flow_id },
      include: { steps: { orderBy: { position: 'asc' } } },
    });

    // fluxo removido ou desativado => encerra a inscrição
    if (!flow || !flow.active) {
      await this.prisma.email_flow_enrollments.update({
        where: { id: en.id },
        data: { status: 'canceled' },
      });
      return;
    }

    const steps: any[] = (flow as any).steps || [];
    const step = steps[en.next_step];
    if (!step) {
      await this.prisma.email_flow_enrollments.update({
        where: { id: en.id },
        data: { status: 'completed' },
      });
      return;
    }

    // Condição: só envia este passo se o lead abriu/clicou o e-mail ANTERIOR.
    // (não se aplica ao 1º passo, que não tem anterior.)
    const cond = normalizeStepCondition(step.condition);
    if (en.next_step > 0 && cond.type !== 'always' && en.last_sent_id) {
      const met = await this.conditionMet(cond.type, en.last_sent_id);
      if (!met) {
        if (cond.on_fail === 'stop') {
          await this.prisma.email_flow_enrollments.update({
            where: { id: en.id },
            data: { status: 'stopped' },
          });
          this.logger.log(
            `fluxo: lead ${en.email} saiu (condição ${cond.type} não atendida no step ${en.next_step})`,
          );
          return;
        }
        // skip: pula este passo, segue pro próximo (mantém last_sent_id)
        await this.advance(en, steps, en.last_sent_id);
        return;
      }
    }

    // envia (best-effort — nunca lança). Retorna o sent row id em caso de sucesso.
    const sentId = await this.sendStep(flow, en, step);

    // avança pro próximo step (ou completa), guardando o último envio.
    await this.advance(en, steps, sentId ?? en.last_sent_id);
  }

  // Avança a inscrição pro próximo passo (ou completa).
  private async advance(en: any, steps: any[], lastSentId: string | null) {
    const nextIndex = en.next_step + 1;
    if (nextIndex >= steps.length) {
      await this.prisma.email_flow_enrollments.update({
        where: { id: en.id },
        data: { status: 'completed', next_step: nextIndex, last_sent_id: lastSentId },
      });
    } else {
      const nextAt = new Date(Date.now() + stepDelayMs(steps[nextIndex]));
      await this.prisma.email_flow_enrollments.update({
        where: { id: en.id },
        data: { next_step: nextIndex, next_send_at: nextAt, last_sent_id: lastSentId },
      });
    }
  }

  // Abriu/clicou o e-mail do sent row informado?
  private async conditionMet(
    type: 'opened' | 'clicked',
    sentId: string,
  ): Promise<boolean> {
    if (type === 'opened') {
      const n = await this.prisma.email_schedules_sent_opens.count({
        where: { schedule_sent_id: sentId },
      });
      return n > 0;
    }
    // clicked: o sent row é de 1 lead, então click_cta_count>0 = esse lead clicou
    const row = await this.prisma.email_projects_schedules_sent.findUnique({
      where: { id: sentId },
      select: { click_cta_count: true },
    });
    return (row?.click_cta_count ?? 0) > 0;
  }

  // Retorna o id do sent row em caso de envio bem-sucedido; null caso contrário.
  private async sendStep(flow: any, en: any, step: any): Promise<string | null> {
    try {
      const html = String(step.body_html ?? '').trim();
      const email = String(en.email ?? '').trim().toLowerCase();
      if (!html || !email) return null;

      const project = await this.prisma.email_projects.findFirst({
        where: { id: flow.project_id, active: true },
        include: { organizations: true },
      });
      if (!project) return null;
      const sender = (project.settings as any)?.sender;
      if (!sender?.fromEmail) return null;

      // Puxa nome + atributos do lead pra popular {{name}}/{{phone}}/etc no
      // Handlebars (o runner antes mandava name:null → {{name}} vinha vazio).
      const lead = await this.prisma.email_leads.findUnique({
        where: { id: en.lead_id },
        select: { name: true, attributes: true },
      });

      const baseApi = process.env.BASE_API_URL || 'http://localhost:8000';
      const mappedLead = {
        email,
        name: lead?.name ?? null,
        attributes: {
          ...(lead?.attributes && typeof lead.attributes === 'object'
            ? (lead.attributes as Record<string, any>)
            : {}),
          unsubscribe_link: `${baseApi}/email/leads/unsubscribe/${project.id}/${email}`,
        },
      };

      // sent row (histórico/tracking) — best effort
      let dispatchId = '';
      let sentRowId: string | null = null;
      try {
        const row = await this.prisma.email_projects_schedules_sent.create({
          data: {
            organization_id: project.organization_id,
            project_id: project.id,
            run_at: new Date(),
            schedule_daily: false,
            sent: false,
            total_leads: 1,
            sent_for_leads: 0,
            tokens_unit_cost: 0,
            tokens_cost: 0,
            flow_step_id: step.id ?? null,
          },
          select: { id: true },
        });
        dispatchId = row.id;
        sentRowId = row.id;
      } catch {
        /* sem row */
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
              data: { error_message: 'Saldo insuficiente (fluxo)' },
            });
          }
          return null;
        }
        await this.prisma.wallets.update({
          where: { id: wallet.id },
          data: { balance: { decrement: totalCost } },
        });
        await this.prisma.transactions.create({
          data: {
            wallet_id: wallet.id,
            amount: -totalCost,
            description: `FLUXO INICIAL | Projeto: ${project.id.slice(0, 8)} | 1 lead`,
            type: 'TOKEN_DEBIT',
          },
        });
      }

      const resendApiKey = await this.systemSettings.getResendApiKeyOrFail();
      const payload = {
        dispatchId: dispatchId || `flow-${en.id}`,
        leads: { count: 1, sample: [mappedLead] },
        project,
        organization: project.organizations,
        schedule: null,
        template: {
          subject: step.subject || '',
          from_name: (step.builder_model as any)?.from_name?.trim?.() || null,
          body_html: html,
          body_text: '',
        },
        templatesCount: 1,
        resend_api_key: resendApiKey,
      };

      const resp = await axios.post(`${this.emailServiceUrl}/send`, payload, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (resp.status !== 201) throw new Error(`micro status ${resp.status}`);

      if (sentRowId) {
        await this.prisma.email_projects_schedules_sent.update({
          where: { id: sentRowId },
          data: { sent: true, subject: step.subject || '', body_html: html },
        });
      }
      this.logger.log(
        `fluxo: e-mail (step ${en.next_step}) enviado p/ ${email} (projeto ${project.id.slice(0, 8)})`,
      );
      return sentRowId;
    } catch (e: any) {
      this.logger.warn(
        `fluxo: falha ao enviar step p/ ${en.email}: ${String(e?.message ?? e)}`,
      );
      return null;
    }
  }
}
