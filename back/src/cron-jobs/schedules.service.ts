import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

import { PrismaService } from '../prisma/prisma.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { EmailSchedule } from './domain/email_schedules_domain';
import { isColdLink } from '../email-marketing/recycle/recycle.service';
import { filterLinksBySegment } from '../email-marketing/segments/segment.util';
import { getUnopeners } from '../email-marketing/resend/unopeners.util';

type ScheduleLite = {
  id: string;
  project_id: string;
  daily: boolean;
  time: number | null;
  date: Date | null;
  for_x_days: number | null;
  last_run: Date | null;
  template_ids: string[] | null;
  recycle: boolean;
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

  // A cada minuto (segundo 0). Necessário p/ suportar horários "quebrados"
  // (ex.: 11:30). A decisão de rodar é por minuto-do-dia em BRT.
  @Cron('0 * * * * *')
  async handleCron() {
    const now = new Date();
    const runAt = new Date(now);
    runAt.setSeconds(0, 0); // precisão de minuto (idempotência via uk run_at)

    const jobs = await this.findDueSchedules(runAt);

    if (jobs.length > 0) {
      this.logger.debug(
        `[tick] ${runAt.toISOString()} — ${jobs.length} schedules to execute`,
      );
    }

    for (const job of jobs) {
      try {
        await this.processSchedule(job.schedule, runAt);
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
        template_ids: true,
        recycle: true,
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
            template_ids: Array.isArray((row as any).template_ids)
              ? ((row as any).template_ids as string[])
              : null,
            recycle: Boolean((row as any).recycle),
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
          recycle: Boolean(schedule.recycle),
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
          from_name: (template as any).from_name ?? null,
          body_html: template.body_html,
          body_text: template.body_text,
        },
      });

      this.logger.log(
        `[EMAIL_DISPATCH_PAYLOAD_SUCCESS] ${JSON.stringify(payloadSummary, null, 2)}`,
      );

      if (!payload.keepTemplates && payload.templatesCount > 2) {
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
    const isRecycle = Boolean((scheduleFull as any)?.recycle);

    const project = await this.prisma.email_projects.findFirst({
      where: { id: schedule.project_id, active: true },
      include: { organizations: true },
    });
    if (!project) throw new Error('Project not found or inactive');

    const links = await this.prisma.email_project_leads.findMany({
      where: { project_id: schedule.project_id, status: 'SUBSCRIBED' },
      include: { leads: true },
    });

    // Agendamento de RECICLAGEM: dispara SÓ para os leads frios (o inverso do
    // bloqueio). Caso contrário, aplica o bloqueio de frios do projeto (exclui
    // quem não interagiu no período). Ambos avaliados na pivô metrics.
    let effectiveLinks = links;
    if (isRecycle) {
      const crit =
        (scheduleFull as any)?.recycle_criteria === 'never'
          ? 'never'
          : 'inactive';
      const rdays = Math.max(
        1,
        Math.floor(Number((scheduleFull as any)?.recycle_days) || 30),
      );
      effectiveLinks = links.filter((x: any) => isColdLink(x, crit, rdays));
    } else {
      const coldBlock = (project.settings as any)?.cold_block;
      if (coldBlock?.enabled) {
        const days = Math.max(1, Math.floor(Number(coldBlock.days) || 30));
        const cutoff = Date.now() - days * 86_400_000;
        effectiveLinks = links.filter((x: any) => {
          const m = x.metrics && typeof x.metrics === 'object' ? x.metrics : {};
          const lo = m.last_open ? Date.parse(m.last_open) : 0;
          const lc = m.last_click_cta ? Date.parse(m.last_click_cta) : 0;
          return Math.max(lo || 0, lc || 0) >= cutoff;
        });
      }

      // Apenas leads que interagiram no fluxo inicial (abriram/clicaram um
      // e-mail do fluxo). Vale só para agendamentos normais (não reciclagem).
      const flowOnly = (project.settings as any)?.flow_interacted_only;
      if (flowOnly?.enabled) {
        effectiveLinks = effectiveLinks.filter((x: any) => {
          const m = x.metrics && typeof x.metrics === 'object' ? x.metrics : {};
          return m.flow_interacted === true;
        });
      }
    }

    // Segmentação por regras/condições (compõe com o filtro acima via AND).
    if ((scheduleFull as any)?.segment) {
      effectiveLinks = await filterLinksBySegment(
        this.prisma,
        schedule.project_id,
        effectiveLinks,
        (scheduleFull as any).segment,
        new Date(),
      );
    }

    const leads = effectiveLinks
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

    const templateFields = {
      id: true,
      name: true,
      subject: true,
      body_html: true,
      body_text: true,
      builder_model: true,
    };

    const selectedIds = Array.isArray(schedule.template_ids)
      ? schedule.template_ids.filter(Boolean)
      : [];

    let template: any = null;
    let templatesCount = 0;
    // keepTemplates: quando o agendamento tem templates selecionados, sorteia
    // entre eles e NÃO apaga nenhum depois do envio. Reciclagem NUNCA apaga.
    let keepTemplates = isRecycle;

    // Reciclagem usa APENAS os templates de reciclagem (recycle=true);
    // agendamentos normais usam os templates normais (recycle=false).
    if (selectedIds.length > 0) {
      const selected = await this.prisma.email_templates.findMany({
        where: {
          project_id: schedule.project_id,
          id: { in: selectedIds },
          recycle: isRecycle,
        },
        select: templateFields,
      });
      if (selected.length > 0) {
        template = selected[Math.floor(Math.random() * selected.length)];
        templatesCount = selected.length;
        keepTemplates = true;
      }
    }

    // Sem seleção (ou selecionados já apagados) => sorteia entre TODOS os
    // templates do escopo (normal/reciclagem) e pode apagar depois quando > 2
    // (apagar só vale p/ normal; reciclagem tem keepTemplates=true).
    if (!template) {
      templatesCount = await this.prisma.email_templates.count({
        where: { project_id: schedule.project_id, recycle: isRecycle },
      });
      if (templatesCount > 0) {
        const skip = Math.floor(Math.random() * templatesCount);
        template = await this.prisma.email_templates.findFirst({
          where: { project_id: schedule.project_id, recycle: isRecycle },
          orderBy: { id: 'asc' },
          skip,
          select: templateFields,
        });
      }
    }

    // From name por template (do builder_model). Fallback no micro p/ o do projeto.
    if (template) {
      (template as any).from_name =
        (template.builder_model as any)?.from_name?.trim?.() || null;
    }

    return {
      dispatchId: sentRowId,
      leads: { count: mappedLeads.length, sample: mappedLeads },
      project,
      organization: project.organizations,
      schedule: scheduleFull,
      template,
      templatesCount,
      keepTemplates,
    };
  }

  private async sendEmailToMicroservice(payload: any): Promise<number> {
    const url = `${this.emailServiceUrl}/send`;
    try {
      const orgId = payload?.organization?.id || payload?.project?.organization_id;
      if (!orgId) throw new Error('Payload sem organização — não dá pra resolver a chave do Resend.');
      const resendApiKey = await this.systemSettings.getResendApiKeyOrFail(orgId);
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
  async executeManualDispatch(projectId: string, templateId?: string | null) {
    this.logger.log(
      `[MANUAL DISPATCH] Iniciando disparo para projeto: ${projectId}${templateId ? ` (template ${templateId})` : ' (aleatório)'}`,
    );
    const runAt = new Date();

    const project = await this.prisma.email_projects.findFirst({
      where: { id: projectId, active: true },
      include: { organizations: true },
    });
    if (!project) throw new Error('Projeto não encontrado ou inativo.');

    const templateSelect = {
      id: true,
      name: true,
      subject: true,
      body_html: true,
      body_text: true,
      builder_model: true,
    };

    let template: any = null;

    if (templateId) {
      // Template específico escolhido pelo usuário (precisa ser do projeto).
      template = await this.prisma.email_templates.findFirst({
        where: { id: templateId, project_id: projectId, recycle: false },
        select: templateSelect,
      });
      if (!template)
        throw new Error('Template não encontrado neste projeto.');
    } else {
      // Template aleatório entre os do projeto.
      const templatesCount = await this.prisma.email_templates.count({
        where: { project_id: projectId, recycle: false },
      });
      if (templatesCount === 0)
        throw new Error('Nenhum template encontrado neste projeto.');

      const skip = Math.floor(Math.random() * templatesCount);
      template = await this.prisma.email_templates.findFirst({
        where: { project_id: projectId, recycle: false },
        orderBy: { id: 'asc' },
        skip,
        select: templateSelect,
      });
      if (!template)
        throw new Error('Falha ao selecionar template aleatório.');
    }

    (template as any).from_name =
      (template.builder_model as any)?.from_name?.trim?.() || null;

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
      templatesCount: 1,
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
          from_name: (template as any).from_name ?? null,
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

  // =========================================================================
  // 🔁 REENVIO PARA NÃO-ABRIDORES
  // Reenvia o conteúdo de um disparo passado só para os inscritos ativos que
  // NÃO o abriram (opcionalmente com um novo assunto).
  // =========================================================================
  async resendToUnopeners(
    organizationId: string,
    projectId: string,
    sentId: string,
    subjectOverride?: string | null,
  ) {
    const original = await this.prisma.email_projects_schedules_sent.findFirst({
      where: { id: sentId, organization_id: organizationId, project_id: projectId },
      select: { subject: true, from_name: true, body_html: true, body_text: true },
    });
    if (!original) throw new Error('Disparo original não encontrado.');
    const html = String(original.body_html ?? '').trim();
    if (!html)
      throw new Error('Este disparo não tem conteúdo salvo para reenviar.');

    const project = await this.prisma.email_projects.findFirst({
      where: { id: projectId, active: true },
      include: { organizations: true },
    });
    if (!project) throw new Error('Projeto não encontrado ou inativo.');
    const sender = (project.settings as any)?.sender;
    if (!sender?.fromEmail)
      throw new Error('Configure o remetente do projeto antes de reenviar.');

    const { nonOpeners } = await getUnopeners(
      this.prisma,
      organizationId,
      projectId,
      sentId,
    );
    if (nonOpeners.length === 0)
      return { sent: 0, message: 'Ninguém para reenviar — todos os ativos já abriram.' };

    const baseApi = process.env.BASE_API_URL || 'http://localhost:8000';
    const mappedLeads = nonOpeners.map((x: any) => ({
      ...x.leads,
      attributes: {
        ...(x.leads.attributes && typeof x.leads.attributes === 'object'
          ? x.leads.attributes
          : {}),
        unsubscribe_link: `${baseApi}/email/leads/unsubscribe/${project.id}/${x.leads.email}`,
      },
    }));
    const totalLeads = mappedLeads.length;
    const subject =
      String(subjectOverride || '').trim() || String(original.subject || '').trim();

    const sentRow = await this.prisma.email_projects_schedules_sent.create({
      data: {
        organization_id: project.organization_id,
        project_id: project.id,
        run_at: new Date(),
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
    const totalCost = tokensPerLead * totalLeads;
    if (totalCost > 0) {
      const wallet = await this.prisma.wallets.findFirst({
        where: { organization_id: project.organization_id, status: 'ACTIVE' },
      });
      if (!wallet || Number(wallet.balance) < totalCost) {
        await this.prisma.email_projects_schedules_sent.update({
          where: { id: sentRow.id },
          data: { error_message: 'Saldo insuficiente (reenvio).' },
        });
        throw new Error('Saldo de tokens insuficiente.');
      }
      await this.prisma.wallets.update({
        where: { id: wallet.id },
        data: { balance: { decrement: totalCost } },
      });
      await this.prisma.transactions.create({
        data: {
          wallet_id: wallet.id,
          amount: -totalCost,
          description: `REENVIO NÃO-ABRIDORES | Projeto: ${project.id.slice(0, 8)} | ${totalLeads} leads`,
          type: 'TOKEN_DEBIT',
        },
      });
    }

    const fromName = original.from_name ?? null;
    const payload = {
      dispatchId: sentRow.id,
      leads: { count: totalLeads, sample: mappedLeads },
      project,
      organization: project.organizations,
      schedule: null,
      template: { subject, from_name: fromName, body_html: html, body_text: original.body_text || '' },
      templatesCount: 1,
    };

    const statusCode = await this.sendEmailToMicroservice(payload);
    if (statusCode !== 201) {
      await this.prisma.email_projects_schedules_sent.update({
        where: { id: sentRow.id },
        data: { error_message: `Micro retornou ${statusCode}` },
      });
      throw new Error('Falha ao enfileirar o reenvio.');
    }
    await this.prisma.email_projects_schedules_sent.update({
      where: { id: sentRow.id },
      data: {
        sent: true,
        subject,
        from_name: fromName,
        body_html: html,
        tokens_unit_cost: tokensPerLead,
        tokens_cost: totalCost,
      },
    });
    return { sent: totalLeads, dispatchId: sentRow.id };
  }

  // ===========================================================================
  // FLUXO INICIAL (welcome): e-mail de boas-vindas quando um lead NOVO entra no
  // projeto (webchat / quiz / cadastro). Config em email_projects.settings.welcome
  // = { enabled, templateId }. Desligado por padrão. Best-effort: NUNCA lança
  // (chamado com `void` fora da transação do cadastro). Cobra token e grava
  // histórico em email_projects_schedules_sent, igual aos gatilhos.
  // ===========================================================================
  async sendWelcomeToLead(projectId: string, leadId: string): Promise<void> {
    try {
      const project = await this.prisma.email_projects.findFirst({
        where: { id: projectId, active: true },
        include: { organizations: true },
      });
      if (!project) return;
      const welcome = (project.settings as any)?.welcome;
      if (!welcome?.enabled || !welcome?.templateId) return;
      const sender = (project.settings as any)?.sender;
      if (!sender?.fromEmail) return;

      const lead = await this.prisma.email_leads.findFirst({
        where: { id: leadId, organization_id: project.organization_id, global_status: 'ACTIVE' },
      });
      if (!lead?.email) return;

      const template = await this.prisma.email_templates.findFirst({
        where: { id: String(welcome.templateId), project_id: projectId },
        select: { id: true, subject: true, body_html: true, body_text: true, builder_model: true },
      });
      if (!template) return;

      const baseApi = process.env.BASE_API_URL || 'http://localhost:8000';
      const mappedLead = {
        ...lead,
        attributes: {
          ...(lead.attributes && typeof lead.attributes === 'object' ? (lead.attributes as any) : {}),
          unsubscribe_link: `${baseApi}/email/leads/unsubscribe/${project.id}/${lead.email}`,
        },
      };

      const sentRow = await this.prisma.email_projects_schedules_sent.create({
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
        },
      });

      const tokensPerLead = Number(this.configService.get<number>('EMAIL_TOKENS_FOR_ONE_LEAD') ?? 0);
      if (tokensPerLead > 0) {
        const wallet = await this.prisma.wallets.findFirst({
          where: { organization_id: project.organization_id, status: 'ACTIVE' },
        });
        if (!wallet || Number(wallet.balance) < tokensPerLead) {
          await this.prisma.email_projects_schedules_sent.update({
            where: { id: sentRow.id },
            data: { error_message: 'Saldo insuficiente (boas-vindas).' },
          });
          return;
        }
        await this.prisma.wallets.update({ where: { id: wallet.id }, data: { balance: { decrement: tokensPerLead } } });
        await this.prisma.transactions.create({
          data: {
            wallet_id: wallet.id,
            amount: -tokensPerLead,
            description: `BOAS-VINDAS | Projeto: ${project.id.slice(0, 8)} | 1 lead`,
            type: 'TOKEN_DEBIT',
          },
        });
        await this.prisma.email_projects_schedules_sent.update({
          where: { id: sentRow.id },
          data: { tokens_unit_cost: tokensPerLead, tokens_cost: tokensPerLead },
        });
      }

      const resendApiKey = await this.systemSettings.getResendApiKeyOrFail(project.organization_id);
      const payload = {
        dispatchId: sentRow.id,
        leads: { count: 1, sample: [mappedLead] },
        project,
        organization: project.organizations,
        schedule: null,
        template: {
          subject: template.subject,
          from_name: (template.builder_model as any)?.from_name?.trim?.() || null,
          body_html: template.body_html,
          body_text: template.body_text || '',
        },
        templatesCount: 1,
        keepTemplates: true,
        resend_api_key: resendApiKey,
      };

      const resp = await axios.post(`${this.emailServiceUrl}/send`, payload, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (resp.status !== 201) throw new Error(`micro status ${resp.status}`);
      await this.prisma.email_projects_schedules_sent.update({
        where: { id: sentRow.id },
        data: { sent: true, subject: template.subject, body_html: template.body_html, body_text: template.body_text || '' },
      });
    } catch (e: any) {
      this.logger.warn(`sendWelcomeToLead falhou (projeto ${projectId}, lead ${leadId}): ${e?.message || e}`);
    }
  }
}
