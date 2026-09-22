import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getUnopeners } from '../email-marketing/resend/unopeners.util';

@Injectable()
export class ProjectSchedulesSentService {
  constructor(private prisma: PrismaService) { }

  private readonly sentSelect = {
    id: true,
    schedule_id: true,
    organization_id: true,
    project_id: true,

    schedule_daily: true,
    schedule_time: true,
    schedule_date: true,
    recycle: true,

    run_at: true,

    sent: true,
    error_message: true,

    subject: true,
    body_html: true,
    body_text: true,

    total_leads: true,
    sent_for_leads: true,
    open_count: true,
    click_cta_count: true,
    delivered_count: true,
    bounced_count: true,
    complained_count: true,

    created_at: true,

    status: true,

    // schedule: true,
  };

  private async assertProjectFromOrg(
    organizationId: string,
    projectId: string,
  ) {
    const project = await this.prisma.email_projects.findFirst({
      where: { id: projectId, organization_id: organizationId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
  }

  private normalizeMinute(date: Date) {
    const d = new Date(date);
    d.setSeconds(0, 0);
    return d;
  }

  private parseDateOrThrow(value?: string) {
    if (!value) return undefined;
    const d = new Date(value);
    if (Number.isNaN(d.getTime()))
      throw new BadRequestException(`Invalid date: ${value}`);
    return this.normalizeMinute(d);
  }

  private parseBooleanOrThrow(value?: string) {
    if (value === undefined) return undefined;
    const v = String(value).toLowerCase();
    if (v === 'true' || v === '1') return true;
    if (v === 'false' || v === '0') return false;
    throw new BadRequestException('sent must be true/false/1/0');
  }

  private parsePaginationOrThrow(take?: string, skip?: string) {
    const takeN = take ? Number(take) : 50;
    const skipN = skip ? Number(skip) : 0;

    if (!Number.isInteger(takeN) || takeN < 1 || takeN > 200) {
      throw new BadRequestException(
        'take must be an integer between 1 and 200',
      );
    }
    if (!Number.isInteger(skipN) || skipN < 0) {
      throw new BadRequestException('skip must be an integer >= 0');
    }

    return { take: takeN, skip: skipN };
  }

  async list(
    organizationId: string,
    projectId: string,
    query?: {
      sent?: string;
      from?: string;
      to?: string;
      take?: string;
      skip?: string;

      // ✅ novo
      scheduleId?: string;
      recycle?: string;
    },
  ) {
    await this.assertProjectFromOrg(organizationId, projectId);

    const from = this.parseDateOrThrow(query?.from);
    const to = this.parseDateOrThrow(query?.to);
    const sentFilter = this.parseBooleanOrThrow(query?.sent);
    const recycleFilter = this.parseBooleanOrThrow(query?.recycle);
    const { take, skip } = this.parsePaginationOrThrow(
      query?.take,
      query?.skip,
    );

    const runAtFilter: any = {};
    if (from) runAtFilter.gte = from;
    if (to) runAtFilter.lte = to;

    return this.prisma.email_projects_schedules_sent.findMany({
      where: {
        organization_id: organizationId,
        project_id: projectId,

        ...(query?.scheduleId ? { schedule_id: query.scheduleId } : {}),

        ...(recycleFilter !== undefined ? { recycle: recycleFilter } : {}),
        ...(sentFilter !== undefined ? { sent: sentFilter } : {}),
        ...(Object.keys(runAtFilter).length ? { run_at: runAtFilter } : {}),
      },
      orderBy: { run_at: 'desc' },
      take,
      skip,
      select: this.sentSelect,
    });
  }

  // Quantos inscritos ativos NÃO abriram este disparo (para o reenvio).
  async unopenedCount(organizationId: string, projectId: string, sentId: string) {
    await this.assertProjectFromOrg(organizationId, projectId);
    const { nonOpeners, totalActive } = await getUnopeners(
      this.prisma,
      organizationId,
      projectId,
      sentId,
    );
    return { count: nonOpeners.length, total: totalActive };
  }

  async getOne(organizationId: string, projectId: string, sentId: string) {
    await this.assertProjectFromOrg(organizationId, projectId);

    const row = await this.prisma.email_projects_schedules_sent.findFirst({
      where: {
        id: sentId,
        organization_id: organizationId,
        project_id: projectId,
      },
      select: this.sentSelect,
    });

    if (!row) throw new NotFoundException('Sent record not found');
    return row;
  }

  async removeOne(organizationId: string, projectId: string, sentId: string) {
    await this.assertProjectFromOrg(organizationId, projectId);

    const res = await this.prisma.email_projects_schedules_sent.deleteMany({
      where: {
        id: sentId,
        organization_id: organizationId,
        project_id: projectId,
      },
    });

    if (res.count === 0) throw new NotFoundException('Sent record not found');
    return { message: 'Sent record removed' };
  }

  async purge(
    organizationId: string,
    projectId: string,
    query?: { from?: string; to?: string },
  ) {
    await this.assertProjectFromOrg(organizationId, projectId);

    const from = this.parseDateOrThrow(query?.from);
    const to = this.parseDateOrThrow(query?.to);

    if (!from && !to)
      throw new BadRequestException('Provide from and/or to to purge');

    const runAtFilter: any = {};
    if (from) runAtFilter.gte = from;
    if (to) runAtFilter.lte = to;

    const res = await this.prisma.email_projects_schedules_sent.deleteMany({
      where: {
        organization_id: organizationId,
        project_id: projectId,
        run_at: runAtFilter,
      },
    });

    return { message: 'Sent records purged', deleted: res.count };
  }
}
