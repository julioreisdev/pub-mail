import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmailProjectScheduleDto } from './dto/create-project_schedule.dto';
import { UpdateEmailProjectScheduleDto } from './dto/update-project_schedule.dto';
import { ProjectSchedule } from './entities/project_schedule.entity';

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
    created_at: true,
    updated_at: true,
  };

  private async assertProjectFromOrg(organizationId: string, projectId: string) {
    const project = await this.prisma.email_projects.findFirst({
      where: { id: projectId, organization_id: organizationId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
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

    return this.prisma.email_projects_schedules.create({
      data: schedule.toPersistenceForCreate(),
      select: this.scheduleSelect,
    });
  }

  async list(organizationId: string, projectId: string) {
    await this.assertProjectFromOrg(organizationId, projectId);

    return this.prisma.email_projects_schedules.findMany({
      where: { project_id: projectId },
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

    const res = await this.prisma.email_projects_schedules.updateMany({
      where: { id: scheduleId, project_id: projectId },
      data: schedule.toPersistenceForUpdate(),
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
