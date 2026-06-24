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
exports.BillingCardsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let BillingCardsService = class BillingCardsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    cardPublicSelect = {
        id: true,
        organization_id: true,
        last_four_digits: true,
        brand: true,
        holder_name: true,
        is_default: true,
    };
    async listMyCards(organizationId) {
        return this.prisma.billing_cards.findMany({
            where: { organization_id: organizationId },
            orderBy: [{ is_default: 'desc' }, { holder_name: 'asc' }],
            select: this.cardPublicSelect,
        });
    }
    async createMyCard(organizationId, dto) {
        return this.prisma.$transaction(async (tx) => {
            const hasAny = await tx.billing_cards.findFirst({
                where: { organization_id: organizationId },
                select: { id: true },
            });
            const shouldBeDefault = dto.is_default === true || !hasAny;
            if (shouldBeDefault) {
                await tx.billing_cards.updateMany({
                    where: { organization_id: organizationId, is_default: true },
                    data: { is_default: false },
                });
            }
            const card = await tx.billing_cards.create({
                data: {
                    organization_id: organizationId,
                    provider_token: dto.provider_token,
                    holder_name: dto.holder_name,
                    brand: dto.brand ?? null,
                    last_four_digits: dto.last_four_digits ?? null,
                    is_default: shouldBeDefault,
                },
                select: this.cardPublicSelect,
            });
            return card;
        });
    }
    async updateMyCard(organizationId, cardId, dto) {
        return this.prisma.$transaction(async (tx) => {
            const card = await tx.billing_cards.findFirst({
                where: { id: cardId, organization_id: organizationId },
                select: { id: true },
            });
            if (!card)
                throw new common_1.NotFoundException('Billing card not found');
            if (dto.is_default === true) {
                await tx.billing_cards.updateMany({
                    where: { organization_id: organizationId, is_default: true },
                    data: { is_default: false },
                });
            }
            const data = {};
            if (dto.holder_name !== undefined)
                data.holder_name = dto.holder_name;
            if (dto.is_default !== undefined)
                data.is_default = dto.is_default;
            if (dto.brand !== undefined)
                data.brand = dto.brand ?? null;
            if (dto.last_four_digits !== undefined)
                data.last_four_digits = dto.last_four_digits ?? null;
            return tx.billing_cards.update({
                where: { id: cardId },
                data,
                select: this.cardPublicSelect,
            });
        });
    }
    async setDefault(organizationId, cardId) {
        return this.prisma.$transaction(async (tx) => {
            const card = await tx.billing_cards.findFirst({
                where: { id: cardId, organization_id: organizationId },
                select: { id: true },
            });
            if (!card)
                throw new common_1.NotFoundException('Billing card not found');
            await tx.billing_cards.updateMany({
                where: { organization_id: organizationId, is_default: true },
                data: { is_default: false },
            });
            return tx.billing_cards.update({
                where: { id: cardId },
                data: { is_default: true },
                select: this.cardPublicSelect,
            });
        });
    }
    async removeMyCard(organizationId, cardId) {
        return this.prisma.$transaction(async (tx) => {
            const card = await tx.billing_cards.findFirst({
                where: { id: cardId, organization_id: organizationId },
                select: { id: true, is_default: true },
            });
            if (!card)
                throw new common_1.NotFoundException('Billing card not found');
            await tx.billing_cards.delete({ where: { id: cardId } });
            if (card.is_default) {
                const next = await tx.billing_cards.findFirst({
                    where: { organization_id: organizationId },
                    select: { id: true },
                    orderBy: { id: 'asc' },
                });
                if (next) {
                    await tx.billing_cards.update({
                        where: { id: next.id },
                        data: { is_default: true },
                    });
                }
            }
            return { message: 'Billing card removed' };
        });
    }
};
exports.BillingCardsService = BillingCardsService;
exports.BillingCardsService = BillingCardsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BillingCardsService);
//# sourceMappingURL=billing-cards.service.js.map