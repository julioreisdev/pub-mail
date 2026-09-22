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
import { CreateTriggerDto, UpdateTriggerDto } from './dto/trigger.dto';

const UNIT_MS: Record<string, number> = {
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
};

export function normalizeFrequency(raw: any): {
  type: 'once' | 'unlimited' | 'cooldown';
  value: number;
  unit: 'minutes' | 'hours' | 'days';
  cooldownMs: number;
} {
  const type =
    raw?.type === 'unlimited' || raw?.type === 'cooldown' ? raw.type : 'once';
  const unit = ['minutes', 'hours', 'days'].includes(raw?.unit)
    ? raw.unit
    : 'days';
  const value = Math.max(1, Math.floor(Number(raw?.value) || 1));
  return { type, value, unit, cooldownMs: value * (UNIT_MS[unit] || UNIT_MS.days) };
}

function normalizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const raw of input) {
    const t = String(raw ?? '').trim().slice(0, 40);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= 20) break;
  }
  return out;
}

@Injectable()
export class TriggersService {
  private readonly logger = new Logger(TriggersService.name);
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

  // valida coerência ação/config e (se SEND_TEMPLATE) o template do projeto
  private async validatePayload(
    projectId: string,
    action: string,
    tags?: string[],
    templateId?: string | null,
  ): Promise<{ tags: string[]; template_id: string | null }> {
    if (action === 'ADD_TAG') {
      const t = normalizeTags(tags);
      if (t.length === 0) throw new BadRequestException('Informe ao menos uma tag.');
      return { tags: t, template_id: null };
    }
    // SEND_TEMPLATE
    if (!templateId) throw new BadRequestException('Selecione um template.');
    const tpl = await this.prisma.email_templates.findFirst({
      where: { id: templateId, project_id: projectId },
      select: { id: true },
    });
    if (!tpl) throw new BadRequestException('Template não pertence ao projeto.');
    return { tags: [], template_id: templateId };
  }

  async list(organizationId: string, projectId: string) {
    await this.assertProject(organizationId, projectId);
    return this.prisma.email_behavior_triggers.findMany({
      where: { project_id: projectId },
      orderBy: { created_at: 'desc' },
    });
  }

  async create(organizationId: string, projectId: string, dto: CreateTriggerDto) {
    await this.assertProject(organizationId, projectId);
    const { tags, template_id } = await this.validatePayload(
      projectId,
      dto.action,
      dto.tags,
      dto.template_id,
    );
    return this.prisma.email_behavior_triggers.create({
      data: {
        organization_id: organizationId,
        project_id: projectId,
        event: dto.event,
        action: dto.action,
        tags: (tags as any) ?? undefined,
        template_id,
        frequency: this.freqData(dto.frequency) as any,
        active: dto.active ?? true,
      },
    });
  }

  // Guarda só {type,value,unit} (sem o cooldownMs derivado).
  private freqData(raw: any) {
    const f = normalizeFrequency(raw);
    return { type: f.type, value: f.value, unit: f.unit };
  }

  async update(
    organizationId: string,
    projectId: string,
    id: string,
    dto: UpdateTriggerDto,
  ) {
    await this.assertProject(organizationId, projectId);
    const existing = await this.prisma.email_behavior_triggers.findFirst({
      where: { id, project_id: projectId },
    });
    if (!existing) throw new NotFoundException('Gatilho não encontrado.');

    const action = dto.action ?? existing.action;
    const tags = dto.tags ?? (existing.tags as any);
    const templateId =
      dto.template_id !== undefined ? dto.template_id : existing.template_id;

    const validated = await this.validatePayload(projectId, action, tags, templateId);

    return this.prisma.email_behavior_triggers.update({
      where: { id },
      data: {
        ...(dto.event !== undefined ? { event: dto.event } : {}),
        action,
        tags: (validated.tags as any) ?? undefined,
        template_id: validated.template_id,
        ...(dto.frequency !== undefined ? { frequency: this.freqData(dto.frequency) as any } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
  }

  async remove(organizationId: string, projectId: string, id: string) {
    await this.assertProject(organizationId, projectId);
    const res = await this.prisma.email_behavior_triggers.deleteMany({
      where: { id, project_id: projectId },
    });
    if (res.count === 0) throw new NotFoundException('Gatilho não encontrado.');
    return { message: 'Gatilho removido.' };
  }

  // ======================================================================
  // EXECUÇÃO (chamada pelo webhook de open/click). SEMPRE best-effort.
  // ======================================================================
  async fire(projectId: string, email: string, event: 'OPEN' | 'CLICK') {
    try {
      const triggers = await this.prisma.email_behavior_triggers.findMany({
        where: { project_id: projectId, event, active: true },
      });
      if (triggers.length === 0) return;

      const link = await this.prisma.email_project_leads.findFirst({
        where: { project_id: projectId, leads: { email } },
        include: { leads: true },
      });
      if (!link?.leads) return;
      const lead = link.leads;

      const now = Date.now();
      for (const trg of triggers) {
        const freq = normalizeFrequency(trg.frequency as any);

        // Checa frequência via o registro de disparos (trigger, lead).
        const prev = await this.prisma.email_behavior_trigger_fires.findUnique({
          where: { trigger_id_lead_id: { trigger_id: trg.id, lead_id: lead.id } },
        });

        if (freq.type === 'once' && prev) continue; // já disparou 1x
        if (freq.type === 'cooldown' && prev) {
          const last = prev.last_fired_at
            ? new Date(prev.last_fired_at).getTime()
            : new Date(prev.created_at).getTime();
          if (now - last < freq.cooldownMs) continue; // ainda em cooldown
        }
        // 'unlimited' → sempre passa

        try {
          if (trg.action === 'ADD_TAG') {
            await this.applyTags(lead, normalizeTags(trg.tags as any));
          } else if (trg.action === 'SEND_TEMPLATE' && trg.template_id) {
            await this.sendTemplateToLead(projectId, lead, trg.template_id);
          }
          // registra o disparo (cria/atualiza contador + last_fired_at)
          await this.prisma.email_behavior_trigger_fires.upsert({
            where: { trigger_id_lead_id: { trigger_id: trg.id, lead_id: lead.id } },
            create: {
              trigger_id: trg.id,
              lead_id: lead.id,
              fired_count: 1,
              last_fired_at: new Date(now),
            },
            update: {
              fired_count: { increment: 1 },
              last_fired_at: new Date(now),
            },
          });
          this.logger.log(
            `⚡ Gatilho ${event}/${trg.action} executado p/ ${email} (projeto ${projectId.slice(0, 8)})`,
          );
        } catch (err: any) {
          this.logger.error(
            `Gatilho ${trg.id} (${trg.action}) falhou p/ ${email}: ${err?.message}`,
          );
        }
      }
    } catch (err: any) {
      this.logger.error(`fire() falhou p/ projeto ${projectId}: ${err?.message}`);
    }
  }

  private async applyTags(lead: any, addTags: string[]) {
    if (addTags.length === 0) return;
    const current = Array.isArray(lead.tags) ? lead.tags.map(String) : [];
    const merged = [...current];
    for (const t of addTags) if (!merged.includes(t)) merged.push(t);
    if (merged.length === current.length) return; // nada novo
    await this.prisma.email_leads.update({
      where: { id: lead.id },
      data: { tags: merged as any },
    });
  }

  // Envio de UM template para UM lead (reusa o micro /send). Cobra token igual
  // aos demais disparos e grava histórico em email_projects_schedules_sent.
  private async sendTemplateToLead(
    projectId: string,
    lead: any,
    templateId: string,
  ) {
    const project = await this.prisma.email_projects.findFirst({
      where: { id: projectId, active: true },
      include: { organizations: true },
    });
    if (!project) return;
    const sender = (project.settings as any)?.sender;
    if (!sender?.fromEmail) return; // sem remetente, não envia

    const template = await this.prisma.email_templates.findFirst({
      where: { id: templateId, project_id: projectId },
      select: { id: true, subject: true, body_html: true, body_text: true, builder_model: true },
    });
    if (!template) return;

    const baseApi = process.env.BASE_API_URL || 'http://localhost:8000';
    const mappedLead = {
      ...lead,
      attributes: {
        ...(lead.attributes && typeof lead.attributes === 'object'
          ? lead.attributes
          : {}),
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

    const tokensPerLead = Number(
      this.config.get<number>('EMAIL_TOKENS_FOR_ONE_LEAD') ?? 0,
    );
    if (tokensPerLead > 0) {
      const wallet = await this.prisma.wallets.findFirst({
        where: { organization_id: project.organization_id, status: 'ACTIVE' },
      });
      if (!wallet || Number(wallet.balance) < tokensPerLead) {
        await this.prisma.email_projects_schedules_sent.update({
          where: { id: sentRow.id },
          data: { error_message: 'Saldo insuficiente (gatilho).' },
        });
        return;
      }
      await this.prisma.wallets.update({
        where: { id: wallet.id },
        data: { balance: { decrement: tokensPerLead } },
      });
      await this.prisma.transactions.create({
        data: {
          wallet_id: wallet.id,
          amount: -tokensPerLead,
          description: `GATILHO | Projeto: ${project.id.slice(0, 8)} | 1 lead`,
          type: 'TOKEN_DEBIT',
        },
      });
    }

    const resendApiKey = await this.systemSettings.getResendApiKeyOrFail();
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
      resend_api_key: resendApiKey,
    };

    const resp = await axios.post(`${this.emailServiceUrl}/send`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (resp.status !== 201) throw new Error(`micro status ${resp.status}`);
    await this.prisma.email_projects_schedules_sent.update({
      where: { id: sentRow.id },
      data: {
        sent: true,
        subject: template.subject,
        body_html: template.body_html,
        body_text: template.body_text || '',
      },
    });
  }
}
