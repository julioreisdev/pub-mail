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
exports.EmailLeadsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
function isPrismaUniqueError(e) {
    return e?.code === 'P2002';
}
let EmailLeadsService = class EmailLeadsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    leadSelect = {
        id: true,
        organization_id: true,
        email: true,
        name: true,
        attributes: true,
        global_status: true,
    };
    mergeJson(oldJson, newJson) {
        if (newJson === undefined)
            return undefined;
        if (newJson === null)
            return undefined;
        if (oldJson === null || oldJson === undefined)
            return newJson;
        if (typeof oldJson !== 'object' || typeof newJson !== 'object')
            return newJson;
        return { ...oldJson, ...newJson };
    }
    async publicSubscribe(organizationId, projectId, dto) {
        const email = dto.email.toLowerCase().trim();
        const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (!isValidEmail) {
            throw new common_1.BadRequestException('Invalid email address format');
        }
        const org = await this.prisma.organizations.findUnique({
            where: { id: organizationId },
            select: { id: true },
        });
        if (!org)
            throw new common_1.NotFoundException('Organization not found');
        const project = await this.prisma.email_projects.findFirst({
            where: { id: projectId, organization_id: organizationId },
            select: { id: true },
        });
        if (!project)
            throw new common_1.NotFoundException('Project not found');
        await this.prisma.$transaction(async (tx) => {
            const existing = await tx.email_leads.findFirst({
                where: { organization_id: organizationId, email },
                select: { id: true, name: true, attributes: true },
            });
            let leadId;
            if (!existing) {
                const data = {
                    organization_id: organizationId,
                    email,
                    name: dto.name?.trim() || null,
                    global_status: 'ACTIVE',
                };
                if (dto.attributes !== undefined)
                    data.attributes = dto.attributes;
                const created = await tx.email_leads.create({
                    data,
                    select: { id: true },
                });
                leadId = created.id;
            }
            else {
                const mergedAttrs = this.mergeJson(existing.attributes, dto.attributes);
                const data = {
                    name: dto.name?.trim() ? dto.name.trim() : existing.name,
                };
                if (mergedAttrs !== undefined)
                    data.attributes = mergedAttrs;
                await tx.email_leads.update({
                    where: { id: existing.id },
                    data,
                });
                leadId = existing.id;
            }
            const pivot = await tx.email_project_leads.findFirst({
                where: { project_id: projectId, lead_id: leadId },
                select: { status: true },
            });
            if (!pivot) {
                await tx.email_project_leads.create({
                    data: {
                        project_id: projectId,
                        lead_id: leadId,
                        status: 'SUBSCRIBED',
                    },
                });
            }
            else if (pivot.status === 'UNSUBSCRIBED') {
                await tx.email_project_leads.updateMany({
                    where: { project_id: projectId, lead_id: leadId },
                    data: { status: 'SUBSCRIBED' },
                });
            }
            else {
                await tx.email_project_leads.updateMany({
                    where: { project_id: projectId, lead_id: leadId },
                    data: {},
                });
            }
        });
        return { message: 'Lead subscribed successfully' };
    }
    async create(organizationId, dto) {
        const email = dto.email.toLowerCase().trim();
        const data = {
            organization_id: organizationId,
            email,
            name: dto.name?.trim() ?? null,
            global_status: 'ACTIVE',
        };
        if (dto.attributes !== undefined)
            data.attributes = dto.attributes;
        try {
            return await this.prisma.email_leads.create({
                data,
                select: this.leadSelect,
            });
        }
        catch (e) {
            if (isPrismaUniqueError(e)) {
                throw new common_1.BadRequestException('Email already exists in this organization');
            }
            throw e;
        }
    }
    list(organizationId) {
        return this.prisma.email_leads.findMany({
            where: { organization_id: organizationId },
            orderBy: { email: 'asc' },
            select: this.leadSelect,
        });
    }
    async update(organizationId, id, dto) {
        const lead = await this.prisma.email_leads.findFirst({
            where: { id, organization_id: organizationId },
            select: { id: true },
        });
        if (!lead)
            throw new common_1.NotFoundException('Lead not found');
        const data = {};
        if (dto.name !== undefined)
            data.name = dto.name?.trim() ?? null;
        if (dto.attributes !== undefined)
            data.attributes = dto.attributes;
        return this.prisma.email_leads.update({
            where: { id },
            data,
            select: this.leadSelect,
        });
    }
    async remove(organizationId, id) {
        const lead = await this.prisma.email_leads.findFirst({
            where: { id, organization_id: organizationId },
            select: { id: true },
        });
        if (!lead)
            throw new common_1.NotFoundException('Lead not found');
        await this.prisma.email_leads.delete({ where: { id } });
        return { message: 'Lead removed' };
    }
    async countLeadsByProject(organizationId, projectId) {
        const project = await this.prisma.email_projects.findFirst({
            where: { id: projectId, organization_id: organizationId },
            select: { id: true },
        });
        if (!project)
            throw new common_1.NotFoundException('Project not found');
        const [inscribed_leads, unscribed_leads] = await Promise.all([
            this.prisma.email_project_leads.count({
                where: { project_id: projectId, status: 'SUBSCRIBED' },
            }),
            this.prisma.email_project_leads.count({
                where: { project_id: projectId, status: 'UNSUBSCRIBED' },
            }),
        ]);
        return { inscribed_leads, unscribed_leads };
    }
    async unsubscribe(projectId, leadEmail) {
        const email = decodeURIComponent(leadEmail).trim().toLowerCase();
        const project = await this.prisma.email_projects.findUnique({
            where: { id: projectId },
            select: { id: true, organization_id: true, settings: true },
        });
        if (!project)
            throw new common_1.NotFoundException('Project not found');
        const lead = await this.prisma.email_leads.findFirst({
            where: { organization_id: project.organization_id, email },
            select: { id: true },
        });
        if (!lead)
            throw new common_1.NotFoundException('Lead not found');
        const pivot = await this.prisma.email_project_leads.findFirst({
            where: { project_id: projectId, lead_id: lead.id },
            select: { project_id: true, lead_id: true },
        });
        if (!pivot)
            throw new common_1.NotFoundException('Subscription not found');
        await this.prisma.email_project_leads.updateMany({
            where: { project_id: projectId, lead_id: lead.id },
            data: { status: 'UNSUBSCRIBED' },
        });
        const settings = project.settings ?? {};
        const customMsg = typeof settings?.unsubscribe_message === 'string' &&
            settings.unsubscribe_message.trim()
            ? settings.unsubscribe_message.trim()
            : null;
        return customMsg ?? 'Unsubscribed!';
    }
};
exports.EmailLeadsService = EmailLeadsService;
exports.EmailLeadsService = EmailLeadsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], EmailLeadsService);
//# sourceMappingURL=leads.service.js.map