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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const stripe_1 = __importDefault(require("stripe"));
const common_2 = require("@nestjs/common");
let BillingService = class BillingService {
    prisma;
    stripe;
    constructor(prisma) {
        this.prisma = prisma;
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key)
            throw new Error('STRIPE_SECRET_KEY não configurada no .env');
        this.stripe = new stripe_1.default(key, {
            apiVersion: '2025-01-27.acacia',
        });
    }
    async getOrCreateCustomerForOrg(organizationId) {
        const org = await this.prisma.organizations.findUnique({
            where: { id: organizationId },
        });
        if (!org)
            throw new common_1.NotFoundException('Organização não encontrada');
        if (org.stripe_customer_id)
            return org.stripe_customer_id;
        const customer = await this.stripe.customers.create({
            name: org.name,
            metadata: { organization_id: org.id },
        });
        await this.prisma.organizations.update({
            where: { id: org.id },
            data: { stripe_customer_id: customer.id },
        });
        return customer.id;
    }
    async createSetupIntentForOrg(organizationId) {
        const customerId = await this.getOrCreateCustomerForOrg(organizationId);
        const setupIntent = await this.stripe.setupIntents.create({
            customer: customerId,
            usage: 'off_session',
            payment_method_types: ['card'],
        });
        return { client_secret: setupIntent.client_secret };
    }
    async listCards(organizationId) {
        const cards = await this.prisma.billing_cards.findMany({
            where: { organization_id: organizationId },
            orderBy: [{ is_default: 'desc' }],
            select: {
                id: true,
                organization_id: true,
                last_four_digits: true,
                brand: true,
                holder_name: true,
                is_default: true,
            },
        });
        return cards;
    }
    async unsetDefaultForOrg(organizationId) {
        await this.prisma.billing_cards.updateMany({
            where: { organization_id: organizationId, is_default: true },
            data: { is_default: false },
        });
    }
    async createCard(organizationId, dto) {
        const customerId = await this.getOrCreateCustomerForOrg(organizationId);
        const pm = await this.stripe.paymentMethods.retrieve(dto.provider_token);
        const pmCustomerId = pm?.customer;
        if (!pmCustomerId || pmCustomerId !== customerId) {
            throw new common_2.ForbiddenException('Esse cartão não pertence à organização logada (customer mismatch).');
        }
        const brand = pm?.card?.brand?.toUpperCase?.() || 'CARD';
        const last4 = pm?.card?.last4;
        if (!last4)
            throw new common_2.BadRequestException('PaymentMethod inválido (sem last4).');
        const count = await this.prisma.billing_cards.count({
            where: { organization_id: organizationId },
        });
        const shouldBeDefault = count === 0 ? true : !!dto.is_default;
        if (shouldBeDefault) {
            await this.unsetDefaultForOrg(organizationId);
        }
        const created = await this.prisma.billing_cards.create({
            data: {
                organization_id: organizationId,
                provider_token: dto.provider_token,
                last_four_digits: String(last4),
                brand,
                holder_name: dto.holder_name,
                is_default: shouldBeDefault,
            },
            select: {
                id: true,
                last_four_digits: true,
                brand: true,
                holder_name: true,
                is_default: true,
            },
        });
        return created;
    }
    async setDefaultCard(organizationId, cardId) {
        const card = await this.prisma.billing_cards.findUnique({
            where: { id: cardId },
        });
        if (!card)
            throw new common_1.NotFoundException('Cartão não encontrado');
        if (card.organization_id !== organizationId)
            throw new common_2.ForbiddenException('Sem acesso a este cartão');
        await this.unsetDefaultForOrg(organizationId);
        const updated = await this.prisma.billing_cards.update({
            where: { id: cardId },
            data: { is_default: true },
            select: {
                id: true,
                last_four_digits: true,
                brand: true,
                holder_name: true,
                is_default: true,
            },
        });
        return updated;
    }
    async updateCard(organizationId, cardId, dto) {
        const card = await this.prisma.billing_cards.findUnique({
            where: { id: cardId },
        });
        if (!card)
            throw new common_1.NotFoundException('Cartão não encontrado');
        if (card.organization_id !== organizationId)
            throw new common_2.ForbiddenException('Sem acesso a este cartão');
        if (dto.is_default) {
            await this.unsetDefaultForOrg(organizationId);
        }
        const updated = await this.prisma.billing_cards.update({
            where: { id: cardId },
            data: {
                holder_name: dto.holder_name ?? card.holder_name,
                brand: dto.brand ?? card.brand,
                last_four_digits: dto.last_four_digits ?? card.last_four_digits,
                is_default: dto.is_default ?? card.is_default,
            },
            select: {
                id: true,
                last_four_digits: true,
                brand: true,
                holder_name: true,
                is_default: true,
            },
        });
        return updated;
    }
    async deleteCard(organizationId, cardId) {
        const card = await this.prisma.billing_cards.findUnique({
            where: { id: cardId },
        });
        if (!card)
            throw new common_1.NotFoundException('Cartão não encontrado');
        if (card.organization_id !== organizationId)
            throw new common_2.ForbiddenException('Sem acesso a este cartão');
        const wasDefault = card.is_default;
        await this.prisma.billing_cards.delete({ where: { id: cardId } });
        if (wasDefault) {
            const next = await this.prisma.billing_cards.findFirst({
                where: { organization_id: organizationId },
                orderBy: [{ id: 'desc' }],
            });
            if (next) {
                await this.unsetDefaultForOrg(organizationId);
                await this.prisma.billing_cards.update({
                    where: { id: next.id },
                    data: { is_default: true },
                });
            }
        }
        return { ok: true };
    }
    tokenPriceCents(tokens) {
        if (!Number.isFinite(tokens))
            throw new Error('tokens inválido');
        const t = Math.floor(tokens);
        if (t <= 0)
            throw new Error('tokens deve ser >= 1');
        const cents = Math.round(t / 400);
        return Math.max(1, cents);
    }
    async topupTokens(organizationId, tokens) {
        const customerId = await this.getOrCreateCustomerForOrg(organizationId);
        const defaultCard = await this.prisma.billing_cards.findFirst({
            where: { organization_id: organizationId, is_default: true },
        });
        if (!defaultCard) {
            throw new common_2.BadRequestException('Nenhum cartão principal cadastrado');
        }
        const wallet = await this.prisma.wallets.findFirst({
            where: { organization_id: organizationId },
        });
        if (!wallet)
            throw new common_1.NotFoundException('Wallet não encontrada');
        const amountCents = this.tokenPriceCents(tokens);
        const pi = await this.stripe.paymentIntents.create({
            amount: amountCents,
            currency: 'usd',
            customer: customerId,
            payment_method: defaultCard.provider_token,
            confirm: true,
            off_session: true,
            metadata: {
                organization_id: organizationId,
                wallet_id: wallet.id,
                tokens: String(tokens),
            },
        });
        if (pi.status !== 'succeeded') {
            throw new common_2.BadRequestException(`Pagamento não aprovado. Status: ${pi.status}`);
        }
        const newBalance = Number(wallet.balance) + tokens;
        await this.prisma.wallets.update({
            where: { id: wallet.id },
            data: { balance: newBalance },
        });
        await this.prisma.transactions.create({
            data: {
                wallet_id: wallet.id,
                amount: tokens,
                type: 'TOPUP',
                description: `Compra de ${tokens} tokens`,
                provider_transaction_id: pi.id,
            },
        });
        return {
            ok: true,
            tokens,
            wallet_id: wallet.id,
            provider_transaction_id: pi.id,
            new_balance: newBalance,
        };
    }
};
exports.BillingService = BillingService;
exports.BillingService = BillingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BillingService);
//# sourceMappingURL=billing.service.js.map