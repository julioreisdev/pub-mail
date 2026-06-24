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
exports.ProfileService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let ProfileService = class ProfileService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getMe(userId, organizationId) {
        const [user, organization] = await this.prisma.$transaction([
            this.prisma.users.findFirst({
                where: { id: userId, organization_id: organizationId, active: true },
                select: {
                    id: true,
                    organization_id: true,
                    name: true,
                    email: true,
                    role: true,
                    active: true,
                },
            }),
            this.prisma.organizations.findUnique({
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
            }),
        ]);
        if (!user)
            throw new common_1.NotFoundException('User not found');
        if (!organization)
            throw new common_1.NotFoundException('Organization not found');
        return { user, organization };
    }
};
exports.ProfileService = ProfileService;
exports.ProfileService = ProfileService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProfileService);
//# sourceMappingURL=profile.service.js.map