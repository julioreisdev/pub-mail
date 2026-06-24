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
exports.AgentesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let AgentesService = class AgentesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(organizationId, dto) {
        return this.prisma.agentes_ia.create({
            data: {
                organization_id: organizationId,
                name: dto.name,
                description: dto.description ?? null,
                ia_config: dto.ia_config,
                active: dto.active ?? true,
            },
        });
    }
    async list(organizationId) {
        return this.prisma.agentes_ia.findMany({
            where: { organization_id: organizationId },
            orderBy: { created_at: 'desc' },
        });
    }
    async findOne(organizationId, id) {
        const agente = await this.prisma.agentes_ia.findFirst({
            where: { id, organization_id: organizationId },
        });
        if (!agente)
            throw new common_1.NotFoundException('Agente não encontrado.');
        return agente;
    }
    async update(organizationId, id, dto) {
        await this.findOne(organizationId, id);
        return this.prisma.agentes_ia.update({
            where: { id },
            data: {
                ...(dto.name !== undefined ? { name: dto.name } : {}),
                ...(dto.description !== undefined ? { description: dto.description } : {}),
                ...(dto.ia_config !== undefined ? { ia_config: dto.ia_config } : {}),
                ...(dto.active !== undefined ? { active: dto.active } : {}),
            },
        });
    }
    async remove(organizationId, id) {
        await this.findOne(organizationId, id);
        try {
            await this.prisma.agentes_ia.delete({ where: { id } });
        }
        catch (error) {
            if (error?.code === 'P2003') {
                throw new common_1.BadRequestException('Não é possível excluir este agente porque ele está vinculado a um webchat.');
            }
            throw error;
        }
        return { success: true, message: 'Agente removido com sucesso.' };
    }
};
exports.AgentesService = AgentesService;
exports.AgentesService = AgentesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AgentesService);
//# sourceMappingURL=agentes.service.js.map