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
exports.OrganiztionsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
function isPrismaUniqueError(e) {
    return e?.code === 'P2002';
}
function prismaUniqueTargets(e) {
    const t = e?.meta?.target;
    if (Array.isArray(t))
        return t.map(String);
    if (typeof t === 'string')
        return [t];
    return [];
}
let OrganiztionsService = class OrganiztionsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findMyOrganization(organizationId) {
        const org = await this.prisma.organizations.findUnique({
            where: { id: organizationId },
            select: {
                id: true,
                name: true,
                document_id: true,
                status: true,
                stripe_customer_id: true,
                created_at: true,
                updated_at: true,
            },
        });
        if (!org)
            throw new common_1.NotFoundException('Organization not found');
        return org;
    }
    async updateMyOrganization(organizationId, dto) {
        const exists = await this.prisma.organizations.findUnique({
            where: { id: organizationId },
            select: { id: true },
        });
        if (!exists)
            throw new common_1.NotFoundException('Organization not found');
        try {
            return await this.prisma.organizations.update({
                where: { id: organizationId },
                data: { ...dto },
                select: {
                    id: true,
                    name: true,
                    document_id: true,
                    status: true,
                    stripe_customer_id: true,
                    created_at: true,
                    updated_at: true,
                },
            });
        }
        catch (e) {
            if (isPrismaUniqueError(e)) {
                const targets = prismaUniqueTargets(e);
                if (targets.includes('document_id')) {
                    throw new common_1.BadRequestException('Document already registered');
                }
                throw new common_1.BadRequestException('Unique constraint violation');
            }
            throw e;
        }
    }
    async disableMyOrganization(organizationId) {
        const exists = await this.prisma.organizations.findUnique({
            where: { id: organizationId },
            select: { id: true },
        });
        if (!exists)
            throw new common_1.NotFoundException('Organization not found');
        return this.prisma.organizations.update({
            where: { id: organizationId },
            data: { status: false },
            select: {
                id: true,
                name: true,
                document_id: true,
                status: true,
                stripe_customer_id: true,
                created_at: true,
                updated_at: true,
            },
        });
    }
};
exports.OrganiztionsService = OrganiztionsService;
exports.OrganiztionsService = OrganiztionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OrganiztionsService);
//# sourceMappingURL=organiztions.service.js.map