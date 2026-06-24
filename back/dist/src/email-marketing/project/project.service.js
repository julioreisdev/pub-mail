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
exports.EmailProjectsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let EmailProjectsService = class EmailProjectsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    projectSelect = {
        id: true,
        organization_id: true,
        name: true,
        active: true,
        settings: true,
        created_at: true,
    };
    async validateSettingsDomain(organizationId, settings) {
        if (!settings || !settings.sender)
            return;
        const { domain_id, fromEmail } = settings.sender;
        if (!domain_id || !fromEmail) {
            throw new common_1.BadRequestException('Os campos domain_id e fromEmail são obrigatórios na configuração do remetente.');
        }
        const domainRecord = await this.prisma.organization_domains.findFirst({
            where: { id: domain_id, organization_id: organizationId },
        });
        if (!domainRecord) {
            throw new common_1.BadRequestException('O domínio selecionado não foi encontrado ou não pertence a esta organização.');
        }
        if (domainRecord.status !== 'VERIFIED') {
            throw new common_1.BadRequestException('Não é possível usar um domínio que ainda não foi verificado.');
        }
        const expectedSuffix = `@${domainRecord.domain}`;
        if (!fromEmail.endsWith(expectedSuffix)) {
            throw new common_1.BadRequestException(`O e-mail do remetente (${fromEmail}) deve obrigatoriamente terminar com o domínio verificado (${expectedSuffix}).`);
        }
    }
    async create(organizationId, dto) {
        if (dto.settings) {
            await this.validateSettingsDomain(organizationId, dto.settings);
        }
        return this.prisma.email_projects.create({
            data: {
                organization_id: organizationId,
                name: dto.name.trim(),
                settings: dto.settings ?? null,
            },
            select: this.projectSelect,
        });
    }
    findAll(organizationId) {
        return this.prisma.email_projects.findMany({
            where: { organization_id: organizationId },
            orderBy: { created_at: 'desc' },
            select: this.projectSelect,
        });
    }
    async findOne(organizationId, id) {
        const project = await this.prisma.email_projects.findFirst({
            where: { id, organization_id: organizationId, active: true },
            select: this.projectSelect,
        });
        if (!project)
            throw new common_1.NotFoundException('Project not found');
        return project;
    }
    async update(organizationId, id, dto) {
        const exists = await this.prisma.email_projects.findFirst({
            where: { id, organization_id: organizationId },
            select: { id: true },
        });
        if (!exists)
            throw new common_1.NotFoundException('Project not found');
        if (dto.settings) {
            await this.validateSettingsDomain(organizationId, dto.settings);
        }
        return this.prisma.email_projects.update({
            where: { id },
            data: {
                ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
                ...(dto.settings !== undefined ? { settings: dto.settings } : {}),
                ...(dto.active !== undefined ? { active: dto.active } : {}),
            },
            select: this.projectSelect,
        });
    }
    async remove(organizationId, id) {
        const exists = await this.prisma.email_projects.findFirst({
            where: { id, organization_id: organizationId },
            select: { id: true },
        });
        if (!exists)
            throw new common_1.NotFoundException('Project not found');
        await this.prisma.email_projects.delete({
            where: { id },
        });
        return { message: 'Project disabled' };
    }
};
exports.EmailProjectsService = EmailProjectsService;
exports.EmailProjectsService = EmailProjectsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], EmailProjectsService);
//# sourceMappingURL=project.service.js.map