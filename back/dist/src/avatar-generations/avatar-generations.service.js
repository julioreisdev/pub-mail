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
var AvatarGenerationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AvatarGenerationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let AvatarGenerationsService = AvatarGenerationsService_1 = class AvatarGenerationsService {
    prisma;
    logger = new common_1.Logger(AvatarGenerationsService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async generateAvatar(organizationId, dto) {
        const { prompt, colors, personality, userReferenceImage, lastGeneratedImage, is_realistic, } = dto;
        const tokenCost = this.getTokenCostForAvatar();
        await this.debitTokens(organizationId, tokenCost);
        const serviceUrl = process.env.IA_SERVICE_URL;
        const serviceKey = process.env.IA_SERVICE_KEY;
        if (!serviceUrl || !serviceKey) {
            throw new common_1.InternalServerErrorException('Integração de IA não configurada no backend principal.');
        }
        try {
            const response = await fetch(`${serviceUrl}/api/generate-avatar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': serviceKey,
                },
                body: JSON.stringify({
                    prompt,
                    colors,
                    personality,
                    userReferenceImage,
                    lastGeneratedImage,
                }),
            });
            if (!response.ok) {
                const errorBody = await response.text().catch(() => '');
                throw new Error(`O Micro-serviço retornou HTTP ${response.status} - ${errorBody}`);
            }
            const json = await response.json();
            if (!json.success || !json.resultImageUrl) {
                throw new Error(json.error || 'Erro desconhecido ao gerar imagem no micro-serviço.');
            }
            const finalImageUrl = json.resultImageUrl;
            const metadata = {
                colors: colors || null,
                personality: personality || null,
                userReferenceImage: userReferenceImage || null,
                lastGeneratedImage: lastGeneratedImage || null,
            };
            const generationRecord = await this.prisma.avatar_generations.create({
                data: {
                    organization_id: organizationId,
                    user_prompt: prompt,
                    system_prompt: null,
                    is_realistic: is_realistic !== undefined ? is_realistic : true,
                    inspiration_image_url: lastGeneratedImage || userReferenceImage || null,
                    result_image_url: finalImageUrl,
                    technical_metadata: metadata,
                    tokens_cost: tokenCost,
                },
            });
            return {
                success: true,
                data: generationRecord,
                message: 'Avatar gerado e salvo no histórico com sucesso.',
            };
        }
        catch (error) {
            this.logger.error(`Falha ao gerar avatar para org ${organizationId}: ${error.message}`);
            await this.refundTokens(organizationId, tokenCost, 'Estorno por falha na geração do Avatar IA');
            throw new common_1.HttpException('Falha ao gerar o avatar com a IA. Seus tokens foram estornados.', common_1.HttpStatus.BAD_GATEWAY);
        }
    }
    getTokenCostForAvatar() {
        const raw = process.env.AVATAR_GENERATION_TOKENS_COST || '0';
        const parsed = Number.parseInt(raw, 10);
        return parsed;
    }
    async debitTokens(organizationId, cost) {
        await this.prisma.$transaction(async (tx) => {
            const wallet = await tx.wallets.findFirst({
                where: { organization_id: organizationId, status: 'ACTIVE' },
                select: { id: true },
            });
            if (!wallet) {
                throw new common_1.BadRequestException('Carteira da organização não encontrada ou inativa.');
            }
            const updated = await tx.wallets.updateMany({
                where: {
                    id: wallet.id,
                    status: 'ACTIVE',
                    balance: { gte: cost },
                },
                data: {
                    balance: { decrement: cost },
                },
            });
            if (updated.count === 0) {
                throw new common_1.HttpException('Saldo de tokens insuficiente para gerar o avatar.', common_1.HttpStatus.PAYMENT_REQUIRED);
            }
            await tx.transactions.create({
                data: {
                    wallet_id: wallet.id,
                    amount: -cost,
                    type: 'AVATAR_GENERATION_IA',
                    description: `Geração de Avatar IA`,
                },
            });
        });
    }
    async refundTokens(organizationId, amount, reason) {
        try {
            await this.prisma.$transaction(async (tx) => {
                const wallet = await tx.wallets.findFirst({
                    where: { organization_id: organizationId },
                    select: { id: true },
                });
                if (wallet) {
                    await tx.wallets.update({
                        where: { id: wallet.id },
                        data: { balance: { increment: amount } },
                    });
                    await tx.transactions.create({
                        data: {
                            wallet_id: wallet.id,
                            amount: amount,
                            type: 'REFUND_AVATAR_IA',
                            description: reason,
                        },
                    });
                }
            });
        }
        catch (refundError) {
            this.logger.error(`ERRO CRÍTICO: Falha ao estornar tokens para org ${organizationId}: ${refundError}`);
        }
    }
};
exports.AvatarGenerationsService = AvatarGenerationsService;
exports.AvatarGenerationsService = AvatarGenerationsService = AvatarGenerationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AvatarGenerationsService);
//# sourceMappingURL=avatar-generations.service.js.map