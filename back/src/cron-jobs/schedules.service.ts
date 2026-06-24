import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

import { PrismaService } from '../prisma/prisma.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { EmailSchedule } from './domain/email_schedules_domain';

type ScheduleLite = {
  id: string;
  project_id: string;
  daily: boolean;
  time: number | null;
  date: Date | null;
  for_x_days: number | null;
  last_run: Date | null;
};

function isPrismaUniqueError(e: any) {
  return e?.code === 'P2002';
}

@Injectable()
export class EmailSchedulesRunner {
  private readonly logger = new Logger(EmailSchedulesRunner.name);

  private readonly emailServiceUrl =
    process.env.EMAIL_SERVICE_URL ?? 'http://localhost:9999';

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private readonly systemSettings: SystemSettingsService,
  ) {
    this.logger.log('EmailSchedulesRunner loaded');
  }

  private mapToDispatchPayloadSummary(
    payload: any,
    schedule: ScheduleLite | null,
    runAt: Date,
  ) {
    const leadsArray = payload?.leads?.sample || [];
    const template = payload?.template ?? null;

    return {
      dispatchId: payload?.dispatchId,
      runAt: runAt.toISOString(),
      schedule: schedule
        ? {
          id: schedule.id,
          daily: schedule.daily,
          date: schedule.date ? schedule.date.toISOString() : null,
          time: schedule.time ?? null,
          for_x_days: schedule.for_x_days ?? null,
          last_run: schedule.last_run
            ? schedule.last_run.toISOString()
            : null,
        }
        : null,
      project: payload?.project,
      organization: payload?.organization,
      template: template,
      leads: {
        count: payload?.leads?.count || 0,
        sample: leadsArray.slice(0, 5),
      },
      templatesCount: payload?.templatesCount ?? null,
    };
  }

  @Cron('0 0 * * * *')
  async handleCron() {
    const now = new Date();
    const runAtHour = new Date(now);
    runAtHour.setMinutes(0, 0, 0);

    this.logger.debug(`[tick] runAtHour=${runAtHour.toISOString()}`);

    const jobs = await this.findDueSchedules(runAtHour);

    this.logger.debug(`[tick] found ${jobs.length} schedules to execute`);

    for (const job of jobs) {
      try {
        await this.processSchedule(job.schedule, runAtHour);
      } catch (error) {
        this.logger.error(`Error executing schedule ${job.schedule.id}`, error);
      }
    }
  }

  private async findDueSchedules(runAtHour: Date) {
    const rows = await this.prisma.email_projects_schedules.findMany({
      where: { projects: { active: true } },
      select: {
        id: true,
        project_id: true,
        daily: true,
        time: true,
        date: true,
        for_x_days: true,
        last_run: true,
      },
    });

    const due: { schedule: ScheduleLite }[] = [];

    for (const row of rows) {
      let domain: EmailSchedule;

      try {
        domain = EmailSchedule.fromPersistence(row);
      } catch (e: any) {
        this.logger.warn(`Invalid schedule ignored id=${row.id}`);
        continue;
      }

      const decision = domain.decide(runAtHour);

      if (decision.shouldRun) {
        due.push({
          schedule: {
            id: row.id,
            project_id: row.project_id,
            daily: row.daily,
            time: row.time,
            date: row.date,
            for_x_days: row.for_x_days ?? null,
            last_run: row.last_run ?? null,
          },
        });
      }
    }

    return due;
  }

  private async processSchedule(schedule: ScheduleLite, runAt: Date) {
    const projectLite = await this.prisma.email_projects.findFirst({
      where: { id: schedule.project_id, active: true },
      select: { id: true, organization_id: true },
    });

    if (!projectLite) return;

    let sentRow: { id: string };

    try {
      sentRow = await this.prisma.email_projects_schedules_sent.create({
        data: {
          schedule_id: schedule.id,
          organization_id: projectLite.organization_id,
          project_id: schedule.project_id,
          run_at: runAt,
          schedule_daily: schedule.daily,
          schedule_time: schedule.time ?? null,
          schedule_date: schedule.date ?? null,
          sent: false,
          total_leads: 0,
          sent_for_leads: 0,
          tokens_unit_cost: 0,
          tokens_cost: 0,
        },
        select: { id: true },
      });
    } catch (e: any) {
      if (isPrismaUniqueError(e)) return;
      throw e;
    }

    let totalLeads = 0;
    let payloadSummary: any | null = null;

    try {
      const payload = await this.buildPayload(schedule, sentRow.id);
      totalLeads = payload.leads.count;

      payloadSummary = this.mapToDispatchPayloadSummary(
        payload,
        schedule,
        runAt,
      );

      const tokensPerLead = Number(
        this.configService.get<number>('EMAIL_TOKENS_FOR_ONE_LEAD') ?? 0,
      );
      const totalTokensCost = totalLeads * tokensPerLead;

      await this.prisma.email_projects_schedules_sent.update({
        where: { id: sentRow.id },
        data: {
          total_leads: totalLeads, // ✅ CORREÇÃO APLICADA
          tokens_unit_cost: tokensPerLead,
          tokens_cost: totalTokensCost,
        },
      });

      const wallet = await this.prisma.wallets.findFirst({
        where: {
          organization_id: projectLite.organization_id,
          status: 'ACTIVE',
        },
      });

      if (!wallet || Number(wallet.balance) < totalTokensCost) {
        await this.prisma.email_projects_schedules_sent.update({
          where: { id: sentRow.id },
          data: {
            sent: false,
            error_message: 'Saldo insuficiente ou wallet inativa',
          },
        });
        return;
      }

      await this.prisma.wallets.update({
        where: { id: wallet.id },
        data: { balance: { decrement: totalTokensCost } },
      });

      await this.prisma.transactions.create({
        data: {
          wallet_id: wallet.id,
          amount: -totalTokensCost,
          description: `DISPARO DE E-MAIL AUTOMÁTICO | Projeto: ${schedule.project_id} | Leads: ${totalLeads}`,
          type: 'TOKEN_DEBIT',
        },
      });

      if (!payload.templatesCount) throw new Error('No templates available');
      if (!payload.leads.count)
        throw new Error('No SUBSCRIBED ACTIVE leads found');

      const template = payload.template;
      if (!template?.id) throw new Error('Template selection failed');

      this.logger.log(
        `[EMAIL_DISPATCH_PAYLOAD_PRE] ${JSON.stringify(payloadSummary, null, 2)}`,
      );

      const statusCode = await this.sendEmailToMicroservice(payload);

      if (statusCode !== 201)
        throw new Error(`Email service returned status ${statusCode}`);

      await this.prisma.email_projects_schedules_sent.update({
        where: { id: sentRow.id },
        data: {
          sent: true,
          total_leads: totalLeads, // ✅ GARANTIDO AQUI TAMBÉM
          subject: template.subject,
          body_html: template.body_html,
          body_text: template.body_text,
        },
      });

      this.logger.log(
        `[EMAIL_DISPATCH_PAYLOAD_SUCCESS] ${JSON.stringify(payloadSummary, null, 2)}`,
      );

      if (payload.templatesCount > 2) {
        await this.prisma.email_templates.delete({
          where: { id: template.id },
        });
      }

      const domain = EmailSchedule.fromPersistence(schedule as any);
      const effect = domain.afterSuccessfulRun(runAt);

      if (effect.type === 'DELETE') {
        await this.prisma.email_projects_schedules.delete({
          where: { id: schedule.id },
        });
      } else if (effect.update.lastRun) {
        await this.prisma.email_projects_schedules.update({
          where: { id: schedule.id },
          data: { last_run: effect.update.lastRun },
        });
      }
    } catch (e: any) {
      const msg = String(e?.message ?? e).slice(0, 255);
      if (payloadSummary) {
        this.logger.warn(
          `[EMAIL_DISPATCH_PAYLOAD_FAIL] ${JSON.stringify({ ...payloadSummary, error: msg }, null, 2)}`,
        );
      }
      try {
        await this.prisma.email_projects_schedules_sent.update({
          where: { id: sentRow.id },
          data: { sent: false, error_message: msg },
        });
      } catch (err) {
        this.logger.error(`Falha ao gravar erro no banco: ${err}`);
      }
    }
  }

  private async buildPayload(schedule: ScheduleLite, sentRowId: string) {
    const scheduleFull = await this.prisma.email_projects_schedules.findUnique({
      where: { id: schedule.id },
    });

    const project = await this.prisma.email_projects.findFirst({
      where: { id: schedule.project_id, active: true },
      include: { organizations: true },
    });
    if (!project) throw new Error('Project not found or inactive');

    const links = await this.prisma.email_project_leads.findMany({
      where: { project_id: schedule.project_id, status: 'SUBSCRIBED' },
      include: { leads: true },
    });

    const leads = links
      .map((x) => x.leads)
      .filter((l) => l.global_status === 'ACTIVE')
      .filter((l) => l.organization_id === project.organization_id);

    const mappedLeads = leads.map((l: any) => ({
      ...l,
      attributes: {
        ...(l.attributes && typeof l.attributes === 'object'
          ? l.attributes
          : {}),
        unsubscribe_link: `${process.env.BASE_API_URL || 'http://localhost:8000'}/email/leads/unsubscribe/${project.id}/${l.email}`,
      },
    }));

    const templatesCount = await this.prisma.email_templates.count({
      where: { project_id: schedule.project_id },
    });

    let template: any = null;
    if (templatesCount > 0) {
      const skip = Math.floor(Math.random() * templatesCount);
      template = await this.prisma.email_templates.findFirst({
        where: { project_id: schedule.project_id },
        orderBy: { id: 'asc' },
        skip,
        select: {
          id: true,
          name: true,
          subject: true,
          body_html: true,
          body_text: true,
        },
      });
    }

    return {
      dispatchId: sentRowId,
      leads: { count: mappedLeads.length, sample: mappedLeads },
      project,
      organization: project.organizations,
      schedule: scheduleFull,
      template,
      templatesCount,
    };
  }

  private async sendEmailToMicroservice(payload: any): Promise<number> {
    const url = `${this.emailServiceUrl}/send`;
    try {
      const resendApiKey = await this.systemSettings.getResendApiKeyOrFail();
      const enrichedPayload = { ...payload, resend_api_key: resendApiKey };
      const response = await axios.post(url, enrichedPayload, {
        headers: { 'Content-Type': 'application/json' },
      });
      return response.status;
    } catch (error: any) {
      return error.response?.status || 500;
    }
  }

  // =========================================================================
  // 🚀 MÉTODO NOVO: DISPARO MANUAL (BOTÃO "DISPARAR AGORA")
  // =========================================================================
  async executeManualDispatch(projectId: string) {
    this.logger.log(
      `[MANUAL DISPATCH] Iniciando disparo para projeto: ${projectId}`,
    );
    const runAt = new Date();

    const project = await this.prisma.email_projects.findFirst({
      where: { id: projectId, active: true },
      include: { organizations: true },
    });
    if (!project) throw new Error('Projeto não encontrado ou inativo.');

    const templatesCount = await this.prisma.email_templates.count({
      where: { project_id: projectId },
    });
    if (templatesCount === 0)
      throw new Error('Nenhum template encontrado neste projeto.');

    const skip = Math.floor(Math.random() * templatesCount);
    const template = await this.prisma.email_templates.findFirst({
      where: { project_id: projectId },
      orderBy: { id: 'asc' },
      skip,
      select: {
        id: true,
        name: true,
        subject: true,
        body_html: true,
        body_text: true,
      },
    });
    if (!template) throw new Error('Falha ao selecionar template aleatório.');

    const links = await this.prisma.email_project_leads.findMany({
      where: { project_id: projectId, status: 'SUBSCRIBED' },
      include: { leads: true },
    });

    const leads = links
      .map((x) => x.leads)
      .filter((l) => l.global_status === 'ACTIVE')
      .filter((l) => l.organization_id === project.organization_id);

    if (leads.length === 0)
      throw new Error('Nenhum lead inscrito e ativo encontrado.');

    const mappedLeads = leads.map((l: any) => ({
      ...l,
      attributes: {
        ...(l.attributes && typeof l.attributes === 'object'
          ? l.attributes
          : {}),
        unsubscribe_link: `${process.env.BASE_API_URL || 'http://localhost:8000'}/email/leads/unsubscribe/${project.id}/${l.email}`,
      },
    }));

    const totalLeads = mappedLeads.length;

    const sentRow = await this.prisma.email_projects_schedules_sent.create({
      data: {
        organization_id: project.organization_id,
        project_id: projectId,
        run_at: runAt,
        schedule_daily: false,
        sent: false,
        total_leads: totalLeads,
        sent_for_leads: 0,
        tokens_unit_cost: 0,
        tokens_cost: 0,
      },
    });

    const tokensPerLead = Number(
      this.configService.get<number>('EMAIL_TOKENS_FOR_ONE_LEAD') ?? 0,
    );
    const totalTokensCost = totalLeads * tokensPerLead;

    const payloadForMicroservice = {
      dispatchId: sentRow.id,
      leads: { count: totalLeads, sample: mappedLeads },
      project: project,
      organization: project.organizations,
      schedule: null,
      template: template,
      templatesCount: templatesCount,
    };

    const payloadSummary = this.mapToDispatchPayloadSummary(
      payloadForMicroservice,
      null,
      runAt,
    );

    const wallet = await this.prisma.wallets.findFirst({
      where: { organization_id: project.organization_id, status: 'ACTIVE' },
    });

    if (!wallet || Number(wallet.balance) < totalTokensCost) {
      await this.prisma.email_projects_schedules_sent.update({
        where: { id: sentRow.id },
        data: {
          error_message: 'Saldo de tokens insuficiente ou wallet inativa.',
          tokens_unit_cost: tokensPerLead,
          tokens_cost: totalTokensCost,
        },
      });
      throw new Error('Saldo de tokens insuficiente.');
    }

    await this.prisma.wallets.update({
      where: { id: wallet.id },
      data: { balance: { decrement: totalTokensCost } },
    });

    await this.prisma.transactions.create({
      data: {
        wallet_id: wallet.id,
        amount: -totalTokensCost,
        description: `DISPARO MANUAL | Projeto: ${projectId.slice(0, 8)}... | Leads: ${totalLeads}`,
        type: 'TOKEN_DEBIT',
      },
    });

    try {
      this.logger.log(
        `[EMAIL_DISPATCH_PAYLOAD_PRE] ${JSON.stringify(payloadSummary, null, 2)}`,
      );

      const statusCode = await this.sendEmailToMicroservice(
        payloadForMicroservice,
      );
      if (statusCode !== 201)
        throw new Error(`Micro-serviço retornou status ${statusCode}`);

      await this.prisma.email_projects_schedules_sent.update({
        where: { id: sentRow.id },
        data: {
          sent: true,
          subject: template.subject,
          body_html: template.body_html,
          body_text: template.body_text,
          tokens_unit_cost: tokensPerLead,
          tokens_cost: totalTokensCost,
        },
      });

      this.logger.log(
        `[EMAIL_DISPATCH_PAYLOAD_SUCCESS] ${JSON.stringify(payloadSummary, null, 2)}`,
      );

      return {
        success: true,
        message: 'Disparo manual iniciado com sucesso!',
        dispatchId: sentRow.id,
      };
    } catch (error: any) {
      const msg = String(error?.message ?? error).slice(0, 255);
      this.logger.warn(
        `[EMAIL_DISPATCH_PAYLOAD_FAIL] ${JSON.stringify({ ...payloadSummary, error: msg }, null, 2)}`,
      );

      await this.prisma.email_projects_schedules_sent.update({
        where: { id: sentRow.id },
        data: {
          error_message: msg,
          tokens_unit_cost: tokensPerLead,
          tokens_cost: totalTokensCost,
        },
      });
      throw new Error(`Falha no envio: ${msg}`);
    }
  }
}
