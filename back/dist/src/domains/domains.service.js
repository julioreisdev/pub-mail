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
exports.DomainsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const resend_1 = require("resend");
const system_settings_service_1 = require("../system-settings/system-settings.service");
let DomainsService = class DomainsService {
    prisma;
    systemSettings;
    constructor(prisma, systemSettings) {
        this.prisma = prisma;
        this.systemSettings = systemSettings;
    }
    async getResend() {
        const apiKey = await this.systemSettings.getResendApiKeyOrFail();
        return new resend_1.Resend(apiKey);
    }
    async create(organizationId, dto) {
        const domainStr = dto.domain.toLowerCase();
        const exists = await this.prisma.organization_domains.findFirst({
            where: { domain: domainStr, organization_id: organizationId }
        });
        if (exists)
            throw new common_1.ConflictException('Domínio já cadastrado na sua organização.');
        try {
            const resend = await this.getResend();
            const { data, error } = await resend.domains.create({
                name: domainStr,
            });
            if (error || !data) {
                throw new common_1.BadRequestException(`Erro no provedor: ${error?.message}`);
            }
            const mappedRecords = data.records.map((r) => ({
                type: r.record,
                name: r.name,
                value: r.value,
                description: r.type || 'Configuração DNS'
            }));
            return await this.prisma.organization_domains.create({
                data: {
                    organization_id: organizationId,
                    domain: domainStr,
                    provider_id: data.id,
                    status: 'PENDING',
                    dns_records: mappedRecords,
                },
            });
        }
        catch (error) {
            throw new common_1.BadRequestException(`Falha ao registrar domínio: ${error.message}`);
        }
    }
    async list(organizationId) {
        return this.prisma.organization_domains.findMany({
            where: { organization_id: organizationId },
            orderBy: { created_at: 'desc' },
        });
    }
    async remove(organizationId, domainId) {
        const domain = await this.prisma.organization_domains.findFirst({
            where: { id: domainId, organization_id: organizationId },
        });
        if (!domain)
            throw new common_1.NotFoundException('Domínio não encontrado.');
        if (domain.provider_id) {
            const resend = await this.getResend();
            await resend.domains.remove(domain.provider_id);
        }
        await this.prisma.organization_domains.delete({
            where: { id: domainId },
        });
        return { message: 'Domínio removido com sucesso' };
    }
    async verifyReal(organizationId, domainId) {
        const domain = await this.prisma.organization_domains.findFirst({
            where: { id: domainId, organization_id: organizationId },
        });
        if (!domain)
            throw new common_1.NotFoundException('Domínio não encontrado.');
        if (!domain.provider_id)
            throw new common_1.BadRequestException('ID do provedor ausente neste domínio.');
        try {
            const resend = await this.getResend();
            await resend.domains.verify(domain.provider_id);
            const { data } = await resend.domains.get(domain.provider_id);
            let newStatus = domain.status;
            if (data?.status === 'verified') {
                newStatus = 'VERIFIED';
            }
            return await this.prisma.organization_domains.update({
                where: { id: domainId },
                data: { status: newStatus },
            });
        }
        catch (error) {
            throw new common_1.BadRequestException(`Erro ao verificar: ${error.message}`);
        }
    }
};
exports.DomainsService = DomainsService;
exports.DomainsService = DomainsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        system_settings_service_1.SystemSettingsService])
], DomainsService);
//# sourceMappingURL=domains.service.js.map