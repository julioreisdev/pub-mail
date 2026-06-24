"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectSchedulesSentService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let ProjectSchedulesSentService = class ProjectSchedulesSentService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    sentSelect = {
        id: true,
        schedule_id: true,
        organization_id: true,
        project_id: true,
        schedule_daily: true,
        schedule_time: true,
        schedule_date: true,
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
        created_at: true,
        status: true,
    };
    async assertProjectFromOrg(organizationId, projectId) {
        const project = await this.prisma.email_projects.findFirst({
            where: { id: projectId, organization_id: organizationId },
            select: { id: true },
        });
        if (!project)
            throw new common_1.NotFoundException('Project not found');
    }
    normalizeMinute(date) {
        const d = new Date(date);
        d.setSeconds(0, 0);
        return d;
    }
    parseDateOrThrow(value) {
        if (!value)
            return undefined;
        const d = new Date(value);
        if (Number.isNaN(d.getTime()))
            throw new common_1.BadRequestException(`Invalid date: ${value}`);
        return this.normalizeMinute(d);
    }
    parseBooleanOrThrow(value) {
        if (value === undefined)
            return undefined;
        const v = String(value).toLowerCase();
        if (v === 'true' || v === '1')
            return true;
        if (v === 'false' || v === '0')
            return false;
        throw new common_1.BadRequestException('sent must be true/false/1/0');
    }
    parsePaginationOrThrow(take, skip) {
        const takeN = take ? Number(take) : 50;
        const skipN = skip ? Number(skip) : 0;
        if (!Number.isInteger(takeN) || takeN < 1 || takeN > 200) {
            throw new common_1.BadRequestException('take must be an integer between 1 and 200');
        }
        if (!Number.isInteger(skipN) || skipN < 0) {
            throw new common_1.BadRequestException('skip must be an integer >= 0');
        }
        return { take: takeN, skip: skipN };
    }
    async list(organizationId, projectId, query) {
        await this.assertProjectFromOrg(organizationId, projectId);
        const from = this.parseDateOrThrow(query?.from);
        const to = this.parseDateOrThrow(query?.to);
        const sentFilter = this.parseBooleanOrThrow(query?.sent);
        const { take, skip } = this.parsePaginationOrThrow(query?.take, query?.skip);
        const runAtFilter = {};
        if (from)
            runAtFilter.gte = from;
        if (to)
            runAtFilter.lte = to;
        return this.prisma.email_projects_schedules_sent.findMany({
            where: {
                organization_id: organizationId,
                project_id: projectId,
                ...(query?.scheduleId ? { schedule_id: query.scheduleId } : {}),
                ...(sentFilter !== undefined ? { sent: sentFilter } : {}),
                ...(Object.keys(runAtFilter).length ? { run_at: runAtFilter } : {}),
            },
            orderBy: { run_at: 'desc' },
            take,
            skip,
            select: this.sentSelect,
        });
    }
    async getOne(organizationId, projectId, sentId) {
        await this.assertProjectFromOrg(organizationId, projectId);
        const row = await this.prisma.email_projects_schedules_sent.findFirst({
            where: {
                id: sentId,
                organization_id: organizationId,
                project_id: projectId,
            },
            select: this.sentSelect,
        });
        if (!row)
            throw new common_1.NotFoundException('Sent record not found');
        return row;
    }
    async removeOne(organizationId, projectId, sentId) {
        await this.assertProjectFromOrg(organizationId, projectId);
        const res = await this.prisma.email_projects_schedules_sent.deleteMany({
            where: {
                id: sentId,
                organization_id: organizationId,
                project_id: projectId,
            },
        });
        if (res.count === 0)
            throw new common_1.NotFoundException('Sent record not found');
        return { message: 'Sent record removed' };
    }
    async purge(organizationId, projectId, query) {
        await this.assertProjectFromOrg(organizationId, projectId);
        const from = this.parseDateOrThrow(query?.from);
        const to = this.parseDateOrThrow(query?.to);
        if (!from && !to)
            throw new common_1.BadRequestException('Provide from and/or to to purge');
        const runAtFilter = {};
        if (from)
            runAtFilter.gte = from;
        if (to)
            runAtFilter.lte = to;
        const res = await this.prisma.email_projects_schedules_sent.deleteMany({
            where: {
                organization_id: organizationId,
                project_id: projectId,
                run_at: runAtFilter,
            },
        });
        return { message: 'Sent records purged', deleted: res.count };
    }
};
exports.ProjectSchedulesSentService = ProjectSchedulesSentService;
exports.ProjectSchedulesSentService = ProjectSchedulesSentService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProjectSchedulesSentService);
//# sourceMappingURL=project-schedules-sent.service.js.map