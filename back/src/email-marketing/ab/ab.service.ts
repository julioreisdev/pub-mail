import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

import { PrismaService } from '../../prisma/prisma.service';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { CreateAbTestDto } from './dto/ab.dto';

const LABELS = ['A', 'B', 'C', 'D'];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

@Injectable()
export class EmailAbService {
  private readonly logger = new Logger(EmailAbService.name);
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

  private tokensPerLead() {
    return Number(this.config.get<number>('EMAIL_TOKENS_FOR_ONE_LEAD') ?? 0);
  }

  // Inscritos ativos do projeto (objetos email_leads).
  private async activeLeads(organizationId: string, projectId: string) {
    const links = await this.prisma.email_project_leads.findMany({
      where: { project_id: projectId, status: 'SUBSCRIBED' },
      include: { leads: true },
    });
    return links
      .map((x: any) => x.leads)
      .filter(
        (l: any) => l && l.global_status === 'ACTIVE' && l.organization_id === organizationId,
      );
  }

  // Envia {subject, html} para uma lista de leads (1 disparo). Retorna o sentId.
  private async sendToLeads(
    project: any,
    leads: any[],
    subject: string,
    html: string,
    fromName?: string | null,
  ): Promise<string> {
    const baseApi = process.env.BASE_API_URL || 'http://localhost:8000';
    const mapped = leads.map((l: any) => ({
      ...l,
      attributes: {
        ...(l.attributes && typeof l.attributes === 'object' ? l.attributes : {}),
        unsubscribe_link: `${baseApi}/email/leads/unsubscribe/${project.id}/${l.email}`,
      },
    }));
    const total = mapped.length;

    const sentRow = await this.prisma.email_projects_schedules_sent.create({
      data: {
        organization_id: project.organization_id,
        project_id: project.id,
        run_at: new Date(),
        schedule_daily: false,
        sent: false,
        total_leads: total,
        sent_for_leads: 0,
        tokens_unit_cost: 0,
        tokens_cost: 0,
      },
    });

    const perLead = this.tokensPerLead();
    const cost = perLead * total;
    if (cost > 0) {
      const wallet = await this.prisma.wallets.findFirst({
        where: { organization_id: project.organization_id, status: 'ACTIVE' },
      });
      if (!wallet || Number(wallet.balance) < cost) {
        await this.prisma.email_projects_schedules_sent.update({
          where: { id: sentRow.id },
          data: { error_message: 'Saldo insuficiente (A/B).' },
        });
        throw new BadRequestException('Saldo de tokens insuficiente.');
      }
      await this.prisma.wallets.update({
        where: { id: wallet.id },
        data: { balance: { decrement: cost } },
      });
      await this.prisma.transactions.create({
        data: {
          wallet_id: wallet.id,
          amount: -cost,
          description: `TESTE A/B | Projeto: ${project.id.slice(0, 8)} | ${total} leads`,
          type: 'TOKEN_DEBIT',
        },
      });
    }

    const resendApiKey = await this.systemSettings.getResendApiKeyOrFail(project.organization_id);
    const payload = {
      dispatchId: sentRow.id,
      leads: { count: total, sample: mapped },
      project,
      organization: project.organizations,
      schedule: null,
      template: { subject, from_name: fromName?.trim?.() || null, body_html: html, body_text: '' },
      templatesCount: 1,
      resend_api_key: resendApiKey,
    };
    const resp = await axios.post(`${this.emailServiceUrl}/send`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (resp.status !== 201) {
      await this.prisma.email_projects_schedules_sent.update({
        where: { id: sentRow.id },
        data: { error_message: `Micro retornou ${resp.status}` },
      });
      throw new BadRequestException('Falha ao enfileirar o envio.');
    }
    await this.prisma.email_projects_schedules_sent.update({
      where: { id: sentRow.id },
      data: { sent: true, subject, body_html: html },
    });
    return sentRow.id;
  }

  // -------------------------------------------------------------- CREATE
  async create(organizationId: string, projectId: string, dto: CreateAbTestDto) {
    await this.assertProject(organizationId, projectId);

    const variantsIn = Array.isArray(dto.variants) ? dto.variants : [];
    if (variantsIn.length < 2 || variantsIn.length > 4) {
      throw new BadRequestException('Um teste A/B precisa de 2 a 4 variantes.');
    }

    // resolve templates -> subject + body
    const resolved: { subject: string; html: string; model: any }[] = [];
    for (const v of variantsIn) {
      const tpl = await this.prisma.email_templates.findFirst({
        where: { id: v.template_id, project_id: projectId },
        select: { subject: true, body_html: true, builder_model: true },
      });
      if (!tpl) throw new BadRequestException('Template não pertence ao projeto.');
      const html = String(tpl.body_html || '').trim();
      if (!html) throw new BadRequestException('Um dos templates está sem conteúdo.');
      const subject = String(v.subject || '').trim() || String(tpl.subject || '').trim();
      if (!subject) throw new BadRequestException('Uma das variantes está sem assunto.');
      resolved.push({ subject, html, model: tpl.builder_model ?? null });
    }

    const project = await this.prisma.email_projects.findFirst({
      where: { id: projectId, active: true },
      include: { organizations: true },
    });
    if (!project) throw new BadRequestException('Projeto inativo ou não encontrado.');
    const sender = (project.settings as any)?.sender;
    if (!sender?.fromEmail)
      throw new BadRequestException('Configure o remetente do projeto antes de testar.');

    const active = await this.activeLeads(organizationId, projectId);
    if (active.length < variantsIn.length + 1) {
      throw new BadRequestException(
        'Base pequena demais para um teste A/B (precisa de mais inscritos ativos).',
      );
    }

    const pct = Math.max(5, Math.min(90, Math.floor(Number(dto.test_percent) || 30)));
    const shuffled = shuffle(active);
    let testCount = Math.max(
      variantsIn.length,
      Math.floor((active.length * pct) / 100),
    );
    testCount = Math.min(testCount, active.length - 1); // garante restante >= 1

    // fatias por variante (o mais uniforme possível)
    const base = Math.floor(testCount / variantsIn.length);
    const extra = testCount % variantsIn.length;
    const slices: any[][] = [];
    let cursor = 0;
    for (let i = 0; i < variantsIn.length; i++) {
      const size = base + (i < extra ? 1 : 0);
      slices.push(shuffled.slice(cursor, cursor + size));
      cursor += size;
    }

    // pré-checa saldo total (evita envio parcial)
    const perLead = this.tokensPerLead();
    if (perLead > 0) {
      const wallet = await this.prisma.wallets.findFirst({
        where: { organization_id: project.organization_id, status: 'ACTIVE' },
      });
      if (!wallet || Number(wallet.balance) < perLead * testCount) {
        throw new BadRequestException('Saldo de tokens insuficiente para o teste.');
      }
    }

    const hours = Math.max(1, Math.min(168, Math.floor(Number(dto.decision_hours) || 4)));
    const decisionAt = new Date(Date.now() + hours * 3_600_000);

    const test = await this.prisma.email_ab_tests.create({
      data: {
        organization_id: organizationId,
        project_id: projectId,
        name: String(dto.name || '').slice(0, 255) || 'Teste A/B',
        status: 'testing',
        test_percent: pct,
        winner_metric: dto.winner_metric === 'click' ? 'click' : 'open',
        decision_at: decisionAt,
        test_emails: [],
      },
    });

    const allEmails: string[] = [];
    for (let i = 0; i < variantsIn.length; i++) {
      const slice = slices[i];
      const r = resolved[i];
      const sentId = await this.sendToLeads(project, slice, r.subject, r.html, (r.model as any)?.from_name);
      await this.prisma.email_ab_variants.create({
        data: {
          ab_test_id: test.id,
          label: LABELS[i],
          subject: r.subject,
          body_html: r.html,
          builder_model: r.model ?? undefined,
          test_sent_id: sentId,
          recipients_count: slice.length,
        },
      });
      for (const l of slice) allEmails.push(String(l.email || '').toLowerCase());
    }
    await this.prisma.email_ab_tests.update({
      where: { id: test.id },
      data: { test_emails: allEmails as any },
    });

    return this.getOne(organizationId, projectId, test.id);
  }

  // -------------------------------------------------------------- READ
  private async variantMetrics(v: any) {
    if (!v.test_sent_id) {
      return { sent: 0, opens: 0, clicks: 0, open_rate: 0, click_rate: 0 };
    }
    const row = await this.prisma.email_projects_schedules_sent.findUnique({
      where: { id: v.test_sent_id },
      select: { total_leads: true, open_count: true, click_unique_count: true },
    });
    const sent = row?.total_leads || 0;
    const opens = row?.open_count || 0;
    const clicks = row?.click_unique_count || 0;
    const rate = (n: number) => (sent > 0 ? Math.round((n / sent) * 1000) / 1000 : 0);
    return { sent, opens, clicks, open_rate: rate(opens), click_rate: rate(clicks) };
  }

  private async toDto(t: any) {
    const variants = await Promise.all(
      (t.variants || []).map(async (v: any) => ({
        id: v.id,
        label: v.label,
        subject: v.subject,
        recipients_count: v.recipients_count,
        is_winner: t.winner_variant_id === v.id,
        metrics: await this.variantMetrics(v),
      })),
    );
    return {
      id: t.id,
      name: t.name,
      status: t.status,
      test_percent: t.test_percent,
      winner_metric: t.winner_metric,
      decision_at: t.decision_at,
      winner_variant_id: t.winner_variant_id,
      error_message: t.error_message,
      created_at: t.created_at,
      variants,
    };
  }

  async list(organizationId: string, projectId: string) {
    await this.assertProject(organizationId, projectId);
    const tests = await this.prisma.email_ab_tests.findMany({
      where: { project_id: projectId },
      orderBy: { created_at: 'desc' },
      include: { variants: { orderBy: { label: 'asc' } } },
    });
    return Promise.all(tests.map((t) => this.toDto(t)));
  }

  async getOne(organizationId: string, projectId: string, id: string) {
    await this.assertProject(organizationId, projectId);
    const t = await this.prisma.email_ab_tests.findFirst({
      where: { id, project_id: projectId },
      include: { variants: { orderBy: { label: 'asc' } } },
    });
    if (!t) throw new NotFoundException('Teste não encontrado.');
    return this.toDto(t);
  }

  async cancel(organizationId: string, projectId: string, id: string) {
    await this.assertProject(organizationId, projectId);
    const res = await this.prisma.email_ab_tests.updateMany({
      where: { id, project_id: projectId, status: 'testing' },
      data: { status: 'canceled' },
    });
    if (res.count === 0)
      throw new BadRequestException('Teste não encontrado ou já finalizado.');
    return { message: 'Teste cancelado.' };
  }

  // -------------------------------------------------------------- DECIDE (cron)
  async decidePending() {
    const now = new Date();
    const due = await this.prisma.email_ab_tests.findMany({
      where: { status: 'testing', decision_at: { lte: now } },
      include: { variants: true },
    });
    for (const t of due) {
      try {
        await this.decideTest(t);
      } catch (e: any) {
        this.logger.error(`A/B ${t.id} decisão falhou: ${e?.message}`);
        await this.prisma.email_ab_tests.update({
          where: { id: t.id },
          data: { status: 'completed', error_message: String(e?.message).slice(0, 255) },
        });
      }
    }
  }

  private async decideTest(t: any) {
    // escolhe o vencedor pela métrica
    let winner: any = null;
    let best = -1;
    for (const v of t.variants || []) {
      const m = await this.variantMetrics(v);
      const val = t.winner_metric === 'click' ? m.click_rate : m.open_rate;
      if (val > best) {
        best = val;
        winner = v;
      }
    }
    if (!winner) {
      await this.prisma.email_ab_tests.update({
        where: { id: t.id },
        data: { status: 'completed', error_message: 'Sem variantes.' },
      });
      return;
    }

    const project = await this.prisma.email_projects.findFirst({
      where: { id: t.project_id, active: true },
      include: { organizations: true },
    });

    let winnerSentId: string | null = null;
    let errorMsg: string | null = null;

    if (project && (project.settings as any)?.sender?.fromEmail) {
      const tested = new Set(
        (Array.isArray(t.test_emails) ? t.test_emails : []).map((e: any) =>
          String(e || '').toLowerCase(),
        ),
      );
      const active = await this.activeLeads(t.organization_id, t.project_id);
      const remainder = active.filter(
        (l: any) => !tested.has(String(l.email || '').toLowerCase()),
      );
      if (remainder.length > 0) {
        try {
          winnerSentId = await this.sendToLeads(
            project,
            remainder,
            winner.subject,
            String(winner.body_html || ''),
            (winner.builder_model as any)?.from_name,
          );
        } catch (e: any) {
          errorMsg = String(e?.message).slice(0, 255);
        }
      }
    } else {
      errorMsg = 'Projeto inativo ou sem remetente no momento da decisão.';
    }

    await this.prisma.email_ab_tests.update({
      where: { id: t.id },
      data: {
        status: 'completed',
        winner_variant_id: winner.id,
        winner_sent_id: winnerSentId,
        error_message: errorMsg,
      },
    });
    this.logger.log(
      `A/B ${t.id} concluído — vencedor ${winner.label} (${t.winner_metric}); enviado p/ ${winnerSentId ? 'restante' : '0 (sem restante)'}`,
    );
  }
}
