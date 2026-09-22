import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmailProjectScheduleDto } from './dto/create-project_schedule.dto';
import { UpdateEmailProjectScheduleDto } from './dto/update-project_schedule.dto';
import { ProjectSchedule } from './entities/project_schedule.entity';
import {
  filterLinksBySegment,
  normalizeSegment,
} from '../email-marketing/segments/segment.util';

@Injectable()
export class ProjectSchedulesService {
  constructor(private prisma: PrismaService) {}

  private readonly scheduleSelect = {
    id: true,
    project_id: true,
    daily: true,
    date: true,
    time: true,
    for_x_days: true,
    last_run: true,
    template_ids: true,
    recycle: true,
    recycle_criteria: true,
    recycle_days: true,
    segment: true,
    created_at: true,
    updated_at: true,
  };

  // Normaliza os campos de reciclagem a partir do DTO.
  private recycleData(dto: {
    recycle?: boolean;
    recycle_criteria?: 'never' | 'inactive';
    recycle_days?: number;
  }) {
    const recycle = Boolean(dto.recycle);
    if (!recycle) {
      return { recycle: false, recycle_criteria: null, recycle_days: null };
    }
    const criteria = dto.recycle_criteria === 'never' ? 'never' : 'inactive';
    const days =
      criteria === 'inactive'
        ? Math.max(1, Math.floor(Number(dto.recycle_days) || 30))
        : null;
    return { recycle: true, recycle_criteria: criteria, recycle_days: days };
  }

  private async assertProjectFromOrg(organizationId: string, projectId: string) {
    const project = await this.prisma.email_projects.findFirst({
      where: { id: projectId, organization_id: organizationId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
  }

  // Filtra os ids recebidos aos templates que realmente existem no projeto.
  // Vazio/sem válidos => null (o disparo usa TODOS, comportamento atual).
  private async resolveTemplateIds(
    projectId: string,
    ids?: string[] | null,
  ): Promise<string[] | null> {
    if (!Array.isArray(ids) || ids.length === 0) return null;
    const found = await this.prisma.email_templates.findMany({
      where: { project_id: projectId, id: { in: ids } },
      select: { id: true },
    });
    const valid = found.map((t) => t.id);
    return valid.length ? valid : null;
  }

  // -------------------------
  // CRUD
  // -------------------------

  async create(organizationId: string, projectId: string, dto: CreateEmailProjectScheduleDto) {
    await this.assertProjectFromOrg(organizationId, projectId);

    const schedule = ProjectSchedule.create({
      projectId,
      daily: dto.daily,
      date: dto.date ?? null,
      time: dto.time ?? null,
      forXDays: dto.for_x_days ?? null,
    });

    const templateIds = await this.resolveTemplateIds(
      projectId,
      dto.template_ids,
    );

    return this.prisma.email_projects_schedules.create({
      data: {
        ...schedule.toPersistenceForCreate(),
        template_ids: (templateIds as any) ?? undefined,
        ...this.recycleData(dto),
        segment: (normalizeSegment(dto.segment) as any) ?? undefined,
      },
      select: this.scheduleSelect,
    });
  }

  async list(organizationId: string, projectId: string, recycle = false) {
    await this.assertProjectFromOrg(organizationId, projectId);

    return this.prisma.email_projects_schedules.findMany({
      where: { project_id: projectId, recycle: Boolean(recycle) },
      orderBy: [{ daily: 'desc' }, { for_x_days: 'asc' }, { time: 'asc' }, { date: 'asc' }],
      select: this.scheduleSelect,
    });
  }

  async update(
    organizationId: string,
    projectId: string,
    scheduleId: string,
    dto: UpdateEmailProjectScheduleDto,
  ) {
    await this.assertProjectFromOrg(organizationId, projectId);

    const existing = await this.prisma.email_projects_schedules.findFirst({
      where: { id: scheduleId, project_id: projectId },
      select: {
        id: true,
        project_id: true,
        daily: true,
        date: true,
        time: true,
        for_x_days: true,
        last_run: true,
      },
    });
    if (!existing) throw new NotFoundException('Schedule not found');

    const schedule = ProjectSchedule.rehydrate(existing).update({
      daily: dto.daily,
      date: dto.date,       // string | null | undefined (DTO)
      time: dto.time,       // number | undefined (DTO)
      forXDays: dto.for_x_days, // number | undefined (DTO)
    });

    // template_ids só é tocado se veio no payload.
    const templateIds =
      dto.template_ids !== undefined
        ? await this.resolveTemplateIds(projectId, dto.template_ids)
        : undefined;

    // reciclagem só é tocada se algum campo de recycle veio no payload.
    const recycleTouched =
      dto.recycle !== undefined ||
      dto.recycle_criteria !== undefined ||
      dto.recycle_days !== undefined;

    const res = await this.prisma.email_projects_schedules.updateMany({
      where: { id: scheduleId, project_id: projectId },
      data: {
        ...schedule.toPersistenceForUpdate(),
        ...(templateIds !== undefined ? { template_ids: templateIds as any } : {}),
        ...(recycleTouched ? this.recycleData(dto) : {}),
        // segment: null limpa; objeto normaliza; ausente não mexe.
        ...(dto.segment !== undefined
          ? { segment: (normalizeSegment(dto.segment) as any) ?? null }
          : {}),
      },
    });

    if (res.count === 0) throw new NotFoundException('Schedule not found');

    return this.prisma.email_projects_schedules.findUnique({
      where: { id: scheduleId },
      select: this.scheduleSelect,
    });
  }

  async remove(organizationId: string, projectId: string, scheduleId: string) {
    await this.assertProjectFromOrg(organizationId, projectId);

    const res = await this.prisma.email_projects_schedules.deleteMany({
      where: { id: scheduleId, project_id: projectId },
    });

    if (res.count === 0) throw new NotFoundException('Schedule not found');

    return { message: 'Schedule removed' };
  }

  // Conta quantos leads inscritos/ativos casam com um segmento (preview da UI).
  async previewSegment(
    organizationId: string,
    projectId: string,
    segment: any,
  ) {
    await this.assertProjectFromOrg(organizationId, projectId);

    const links = await this.prisma.email_project_leads.findMany({
      where: { project_id: projectId, status: 'SUBSCRIBED' },
      include: { leads: true },
    });
    const activeLinks = links.filter(
      (x: any) =>
        x.leads &&
        x.leads.global_status === 'ACTIVE' &&
        x.leads.organization_id === organizationId,
    );

    const normalized = normalizeSegment(segment);
    if (!normalized) {
      return { count: activeLinks.length, total: activeLinks.length };
    }

    const matched = await filterLinksBySegment(
      this.prisma,
      projectId,
      activeLinks,
      segment,
      new Date(),
    );
    return { count: matched.length, total: activeLinks.length };
  }

  async getOne(organizationId: string, projectId: string, scheduleId: string) {
  await this.assertProjectFromOrg(organizationId, projectId);

  const schedule = await this.prisma.email_projects_schedules.findFirst({
    where: { id: scheduleId, project_id: projectId },
    select: this.scheduleSelect,
  });

  if (!schedule) throw new NotFoundException('Schedule not found');

  return schedule;
}


}
