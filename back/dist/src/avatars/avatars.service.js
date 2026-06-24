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
exports.AvatarsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let AvatarsService = class AvatarsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(organizationId, data) {
        return this.prisma.avatars.create({
            data: {
                organization_id: organizationId,
                name: data.name,
                avatar_image_url: data.avatar_image_url,
                is_realistic: data.is_realistic ?? true,
                default_colors: data.default_colors
                    ? data.default_colors
                    : null,
                inspiration_image_url: data.inspiration_image_url || null,
                user_prompt: data.user_prompt || null,
                system_prompt: data.system_prompt || null,
                personality: data.personality || null,
                technical_metadata: data.technical_metadata
                    ? data.technical_metadata
                    : null,
                status: data.status || 'ACTIVE',
            },
        });
    }
    async findAll(organizationId) {
        return this.prisma.avatars.findMany({
            where: { organization_id: organizationId },
            orderBy: { created_at: 'desc' },
        });
    }
    async findOne(organizationId, id) {
        const avatar = await this.prisma.avatars.findFirst({
            where: {
                id,
                organization_id: organizationId,
            },
        });
        if (!avatar) {
            throw new common_1.NotFoundException('Avatar não encontrado ou não pertence a esta organização.');
        }
        return avatar;
    }
    async update(organizationId, id, data) {
        await this.findOne(organizationId, id);
        return this.prisma.avatars.update({
            where: { id },
            data: {
                ...(data.name !== undefined && { name: data.name }),
                ...(data.avatar_image_url !== undefined && {
                    avatar_image_url: data.avatar_image_url,
                }),
                ...(data.is_realistic !== undefined && {
                    is_realistic: data.is_realistic,
                }),
                ...(data.default_colors !== undefined && {
                    default_colors: data.default_colors,
                }),
                ...(data.inspiration_image_url !== undefined && {
                    inspiration_image_url: data.inspiration_image_url,
                }),
                ...(data.user_prompt !== undefined && {
                    user_prompt: data.user_prompt,
                }),
                ...(data.system_prompt !== undefined && {
                    system_prompt: data.system_prompt,
                }),
                ...(data.personality !== undefined && {
                    personality: data.personality,
                }),
                ...(data.technical_metadata !== undefined && {
                    technical_metadata: data.technical_metadata,
                }),
                ...(data.status !== undefined && { status: data.status }),
            },
        });
    }
    async remove(organizationId, id) {
        await this.findOne(organizationId, id);
        await this.prisma.avatars.delete({
            where: { id },
        });
        return { success: true, message: 'Avatar deletado com sucesso.' };
    }
};
exports.AvatarsService = AvatarsService;
exports.AvatarsService = AvatarsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AvatarsService);
//# sourceMappingURL=avatars.service.js.map