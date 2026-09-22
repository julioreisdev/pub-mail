import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

import { PrismaService } from '../../prisma/prisma.service';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { RecycleDto } from './dto/recycle.dto';

// "Frio" avaliado em memória a partir da pivô metrics (last_open/last_click_cta)
// — mesmo dado que já usamos na tela de Leads.
export function isColdLink(
  link: any,
  criteria: 'never' | 'inactive',
  days: number,
): boolean {
  const m = link?.metrics && typeof link.metrics === 'object' ? link.metrics : {};
  const lo = m.last_open ? Date.parse(m.last_open) : 0;
  const lc = m.last_click_cta ? Date.parse(m.last_click_cta) : 0;
  const last = Math.max(lo || 0, lc || 0);
  if (criteria === 'never') return last === 0; // nunca abriu nem clicou
  const cutoff = Date.now() - Math.max(1, days) * 86_400_000;
  return last < cutoff; // sem interação nos últimos X dias (inclui "nunca")
}

@Injectable()
export class RecycleService {
  private readonly emailServiceUrl =
    process.env.EMAIL_SERVICE_URL ?? 'http://localhost:9999';

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly systemSettings: SystemSettingsService,
  ) {}

  private async assertProject(organizationId: string, projectId: string) {
    const p = await this.prisma.email_projects.findFirst({
      where: { id: projectId, organization_id: organizationId },
      select: { id: true },
    });
    if (!p) throw new NotFoundException('Projeto não encontrado.');
  }

  // leads frios (objetos email_leads) do projeto
  private async coldLeads(
    organizationId: string,
    projectId: string,
    criteria: 'never' | 'inactive',
    days: number,
  ) {
    const links = await this.prisma.email_project_leads.findMany({
      where: { project_id: projectId, status: 'SUBSCRIBED' },
      include: { leads: true },
    });
    return links
      .filter(
        (x: any) =>
          x.leads &&
          x.leads.global_status === 'ACTIVE' &&
          x.leads.organization_id === organizationId &&
          isColdLink(x, criteria, days),
      )
      .map((x: any) => x.leads);
  }

  async coldCount(
    organizationId: string,
    projectId: string,
    criteria: 'never' | 'inactive',
    days: number,
  ) {
    await this.assertProject(organizationId, projectId);
    const leads = await this.coldLeads(organizationId, projectId, criteria, days);
    return { count: leads.length };
  }

  async recycle(organizationId: string, projectId: string, dto: RecycleDto) {
    await this.assertProject(organizationId, projectId);
    const criteria = dto.criteria === 'inactive' ? 'inactive' : 'never';
    const days = Math.max(1, Math.floor(Number(dto.days) || 30));
    const html = String(dto.body_html || '').trim();
    const subject = String(dto.subject || '').trim() || 'Sentimos sua falta 👋';
    if (!html) throw new BadRequestException('Monte o e-mail antes de disparar.');

    const project = await this.prisma.email_projects.findFirst({
      where: { id: projectId, active: true },
      include: { organizations: true },
    });
    if (!project) throw new BadRequestException('Projeto inativo ou não encontrado.');
    const sender = (project.settings as any)?.sender;
    if (!sender?.fromEmail) {
      throw new BadRequestException('Configure o remetente do projeto antes de disparar.');
    }

    const cold = await this.coldLeads(organizationId, projectId, criteria, days);
    if (cold.length === 0) return { sent: 0, message: 'Nenhum lead frio no critério.' };

    const baseApi = process.env.BASE_API_URL || 'http://localhost:8000';
    const mappedLeads = cold.map((l: any) => ({
      ...l,
      attributes: {
        ...(l.attributes && typeof l.attributes === 'object' ? l.attributes : {}),
        unsubscribe_link: `${baseApi}/email/leads/unsubscribe/${project.id}/${l.email}`,
      },
    }));
    const totalLeads = mappedLeads.length;

    const sentRow = await this.prisma.email_projects_schedules_sent.create({
      data: {
        organization_id: project.organization_id,
        project_id: project.id,
        run_at: new Date(),
        schedule_daily: false,
        recycle: true,
        sent: false,
        total_leads: totalLeads,
        sent_for_leads: 0,
        tokens_unit_cost: 0,
        tokens_cost: 0,
      },
    });

    const tokensPerLead = Number(
      this.config.get<number>('EMAIL_TOKENS_FOR_ONE_LEAD') ?? 0,
    );
    const totalCost = tokensPerLead * totalLeads;
    if (totalCost > 0) {
      const wallet = await this.prisma.wallets.findFirst({
        where: { organization_id: project.organization_id, status: 'ACTIVE' },
      });
      if (!wallet || Number(wallet.balance) < totalCost) {
        await this.prisma.email_projects_schedules_sent.update({
          where: { id: sentRow.id },
          data: { error_message: 'Saldo insuficiente para a reciclagem.' },
        });
        throw new BadRequestException('Saldo de tokens insuficiente.');
      }
      await this.prisma.wallets.update({
        where: { id: wallet.id },
        data: { balance: { decrement: totalCost } },
      });
      await this.prisma.transactions.create({
        data: {
          wallet_id: wallet.id,
          amount: -totalCost,
          description: `RECICLAGEM | Projeto: ${project.id.slice(0, 8)} | ${totalLeads} leads`,
          type: 'TOKEN_DEBIT',
        },
      });
    }

    const resendApiKey = await this.systemSettings.getResendApiKeyOrFail();
    const payload = {
      dispatchId: sentRow.id,
      leads: { count: totalLeads, sample: mappedLeads },
      project,
      organization: project.organizations,
      schedule: null,
      template: { subject, body_html: html, body_text: '' },
      templatesCount: 1,
      resend_api_key: resendApiKey,
    };

    try {
      const resp = await axios.post(`${this.emailServiceUrl}/send`, payload, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (resp.status !== 201) throw new Error(`micro status ${resp.status}`);
      await this.prisma.email_projects_schedules_sent.update({
        where: { id: sentRow.id },
        data: { sent: true, subject, body_html: html },
      });
      return { sent: totalLeads };
    } catch (e: any) {
      await this.prisma.email_projects_schedules_sent.update({
        where: { id: sentRow.id },
        data: { error_message: String(e?.message ?? e).slice(0, 255) },
      });
      throw new BadRequestException('Falha ao disparar a reciclagem.');
    }
  }
}
