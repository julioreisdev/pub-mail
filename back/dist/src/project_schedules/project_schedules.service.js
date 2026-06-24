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
exports.ProjectSchedulesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const project_schedule_entity_1 = require("./entities/project_schedule.entity");
let ProjectSchedulesService = class ProjectSchedulesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    scheduleSelect = {
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
    async assertProjectFromOrg(organizationId, projectId) {
        const project = await this.prisma.email_projects.findFirst({
            where: { id: projectId, organization_id: organizationId },
            select: { id: true },
        });
        if (!project)
            throw new common_1.NotFoundException('Project not found');
    }
    async create(organizationId, projectId, dto) {
        await this.assertProjectFromOrg(organizationId, projectId);
        const schedule = project_schedule_entity_1.ProjectSchedule.create({
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
    async list(organizationId, projectId) {
        await this.assertProjectFromOrg(organizationId, projectId);
        return this.prisma.email_projects_schedules.findMany({
            where: { project_id: projectId },
            orderBy: [{ daily: 'desc' }, { for_x_days: 'asc' }, { time: 'asc' }, { date: 'asc' }],
            select: this.scheduleSelect,
        });
    }
    async update(organizationId, projectId, scheduleId, dto) {
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
        if (!existing)
            throw new common_1.NotFoundException('Schedule not found');
        const schedule = project_schedule_entity_1.ProjectSchedule.rehydrate(existing).update({
            daily: dto.daily,
            date: dto.date,
            time: dto.time,
            forXDays: dto.for_x_days,
        });
        const res = await this.prisma.email_projects_schedules.updateMany({
            where: { id: scheduleId, project_id: projectId },
            data: schedule.toPersistenceForUpdate(),
        });
        if (res.count === 0)
            throw new common_1.NotFoundException('Schedule not found');
        return this.prisma.email_projects_schedules.findUnique({
            where: { id: scheduleId },
            select: this.scheduleSelect,
        });
    }
    async remove(organizationId, projectId, scheduleId) {
        await this.assertProjectFromOrg(organizationId, projectId);
        const res = await this.prisma.email_projects_schedules.deleteMany({
            where: { id: scheduleId, project_id: projectId },
        });
        if (res.count === 0)
            throw new common_1.NotFoundException('Schedule not found');
        return { message: 'Schedule removed' };
    }
    async getOne(organizationId, projectId, scheduleId) {
        await this.assertProjectFromOrg(organizationId, projectId);
        const schedule = await this.prisma.email_projects_schedules.findFirst({
            where: { id: scheduleId, project_id: projectId },
            select: this.scheduleSelect,
        });
        if (!schedule)
            throw new common_1.NotFoundException('Schedule not found');
        return schedule;
    }
};
exports.ProjectSchedulesService = ProjectSchedulesService;
exports.ProjectSchedulesService = ProjectSchedulesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProjectSchedulesService);
//# sourceMappingURL=project_schedules.service.js.map