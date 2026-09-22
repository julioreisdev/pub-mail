import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SaveFlowDto } from './dto/save-flow.dto';

@Injectable()
export class EmailFlowsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertProject(organizationId: string, projectId: string) {
    const p = await this.prisma.email_projects.findFirst({
      where: { id: projectId, organization_id: organizationId },
      select: { id: true },
    });
    if (!p) throw new NotFoundException('Projeto não encontrado.');
  }

  private stepToDto(s: any) {
    return {
      id: s.id,
      position: s.position,
      delay_value: s.delay_value,
      delay_unit: s.delay_unit,
      subject: s.subject,
      body_html: s.body_html ?? '',
      builder_model: s.builder_model ?? null,
      condition: this.normalizeCondition(s.condition),
    };
  }

  private normalizeCondition(raw: any) {
    const type =
      raw?.type === 'opened' || raw?.type === 'clicked' ? raw.type : 'always';
    const on_fail = raw?.on_fail === 'stop' ? 'stop' : 'skip';
    return { type, on_fail };
  }

  // Fluxo de um projeto (com steps ordenados). Sempre retorna um shape completo.
  async getFlow(organizationId: string, projectId: string) {
    await this.assertProject(organizationId, projectId);
    const flow = await this.prisma.email_flows.findUnique({
      where: { project_id: projectId },
      include: { steps: { orderBy: { position: 'asc' } } },
    });
    if (!flow) {
      return { project_id: projectId, active: false, activated_at: null, steps: [] };
    }
    const enrolledActive = await this.prisma.email_flow_enrollments.count({
      where: { flow_id: flow.id, status: 'active' },
    });
    return {
      id: flow.id,
      project_id: flow.project_id,
      active: flow.active,
      activated_at: flow.activated_at,
      enrolled_active: enrolledActive,
      steps: flow.steps.map((s) => this.stepToDto(s)),
    };
  }

  // Métricas por passo do fluxo (reusa os sent rows marcados com flow_step_id).
  async getFlowMetrics(organizationId: string, projectId: string) {
    await this.assertProject(organizationId, projectId);
    const flow = await this.prisma.email_flows.findUnique({
      where: { project_id: projectId },
      include: { steps: { orderBy: { position: 'asc' } } },
    });
    if (!flow) return { steps: [], enrollments: null };

    const stepIds = flow.steps.map((s) => s.id);

    const sents = stepIds.length
      ? await this.prisma.email_projects_schedules_sent.findMany({
          where: { project_id: projectId, flow_step_id: { in: stepIds } },
          select: {
            flow_step_id: true,
            delivered_count: true,
            open_count: true,
            click_cta_count: true,
            bounced_count: true,
            complained_count: true,
          },
        })
      : [];

    const agg = new Map<string, any>();
    for (const id of stepIds) {
      agg.set(id, { sent: 0, delivered: 0, opens: 0, clicks: 0, bounces: 0, complaints: 0 });
    }
    for (const s of sents as any[]) {
      const a = agg.get(s.flow_step_id);
      if (!a) continue;
      a.sent += 1; // cada envio do fluxo é 1 lead
      a.delivered += s.delivered_count || 0;
      a.opens += s.open_count || 0; // open_count é único por envio (0/1)
      if ((s.click_cta_count || 0) > 0) a.clicks += 1; // clicaram (únicos)
      a.bounces += s.bounced_count || 0;
      a.complaints += s.complained_count || 0;
    }

    const rate = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 1000 : 0);

    const steps = flow.steps.map((s) => {
      const a = agg.get(s.id);
      const base = a.delivered > 0 ? a.delivered : a.sent;
      return {
        step_id: s.id,
        position: s.position,
        subject: s.subject,
        sent: a.sent,
        delivered: a.delivered,
        opens: a.opens,
        clicks: a.clicks,
        bounces: a.bounces,
        complaints: a.complaints,
        delivery_rate: rate(a.delivered, a.sent),
        open_rate: rate(a.opens, base),
        click_rate: rate(a.clicks, base),
        ctor: rate(a.clicks, a.opens), // click-to-open
        bounce_rate: rate(a.bounces, a.sent),
        complaint_rate: rate(a.complaints, a.sent),
      };
    });

    // Funil de inscrições (contagens por status)
    const countBy = (status: string) =>
      this.prisma.email_flow_enrollments.count({
        where: { flow_id: flow.id, status },
      });
    const [active, completed, stopped, canceled] = await Promise.all([
      countBy('active'),
      countBy('completed'),
      countBy('stopped'),
      countBy('canceled'),
    ]);
    const enrollments = {
      total: active + completed + stopped + canceled,
      active,
      completed,
      stopped,
      canceled,
    };

    return { steps, enrollments };
  }

  // Resumo de todos os fluxos da org (pra listar status por projeto).
  async listFlows(organizationId: string) {
    const flows = await this.prisma.email_flows.findMany({
      where: { organization_id: organizationId },
      include: { _count: { select: { steps: true } } },
    });
    return flows.map((f: any) => ({
      project_id: f.project_id,
      active: f.active,
      steps_count: f._count?.steps ?? 0,
    }));
  }

  async saveFlow(organizationId: string, projectId: string, dto: SaveFlowDto) {
    await this.assertProject(organizationId, projectId);

    const existing = await this.prisma.email_flows.findUnique({
      where: { project_id: projectId },
      select: { id: true, active: true, activated_at: true },
    });

    const nowActive = dto.active === true;
    // activated_at só (re)inicia quando o fluxo passa a ficar ativo — assim o
    // worker só inscreve leads captados A PARTIR desse momento.
    let activatedAt: Date | null;
    if (nowActive && !existing?.active) activatedAt = new Date();
    else activatedAt = existing?.activated_at ?? (nowActive ? new Date() : null);

    const incoming = (Array.isArray(dto.steps) ? dto.steps : []).map((s, i) => ({
      id: s.id || null,
      position: i,
      delay_value: Math.max(0, Math.floor(Number(s.delay_value) || 0)),
      delay_unit: s.delay_unit === 'hours' ? 'hours' : 'minutes',
      subject: String(s.subject || '').slice(0, 255),
      body_html: s.body_html ?? '',
      builder_model: (s.builder_model as any) ?? null,
      // 1º passo não tem "anterior" → condição sempre 'always'.
      condition:
        i === 0
          ? { type: 'always', on_fail: 'skip' }
          : (this.normalizeCondition(s.condition) as any),
    }));

    await this.prisma.$transaction(async (tx) => {
      const f = await tx.email_flows.upsert({
        where: { project_id: projectId },
        update: { active: nowActive, activated_at: activatedAt },
        create: {
          organization_id: organizationId,
          project_id: projectId,
          active: nowActive,
          activated_at: activatedAt,
        },
        select: { id: true },
      });

      // Reconcilia por id (preserva o id → mantém flow_step_id das métricas).
      const existing = await tx.email_flow_steps.findMany({
        where: { flow_id: f.id },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((e) => e.id));
      const keep = new Set<string>();

      for (const s of incoming) {
        const data = {
          position: s.position,
          delay_value: s.delay_value,
          delay_unit: s.delay_unit,
          subject: s.subject,
          body_html: s.body_html,
          builder_model: s.builder_model,
          condition: s.condition,
        };
        if (s.id && existingIds.has(s.id)) {
          await tx.email_flow_steps.update({ where: { id: s.id }, data });
          keep.add(s.id);
        } else {
          await tx.email_flow_steps.create({ data: { ...data, flow_id: f.id } });
        }
      }

      const toDelete = [...existingIds].filter((id) => !keep.has(id));
      if (toDelete.length > 0) {
        await tx.email_flow_steps.deleteMany({ where: { id: { in: toDelete } } });
      }
      return f;
    });

    return this.getFlow(organizationId, projectId);
  }
}
