import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import Stripe from 'stripe';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CreateBillingDto} from "./dto/create-billing-cards.dto" ;
import {UpdateBillingDto} from  "./dto/update-billing-cards.dto";

@Injectable()
export class BillingService {
    private stripe: Stripe;

    constructor(private prisma: PrismaService) {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key) throw new Error('STRIPE_SECRET_KEY não configurada no .env');

        this.stripe = new Stripe(key, {
            apiVersion: '2025-01-27.acacia' as any,
        });
    }

    /**
     * Garante que a org tem um stripe_customer_id.
     * Se não tiver, cria customer na Stripe e salva no banco.
     */
    async getOrCreateCustomerForOrg(organizationId: string) {
        const org = await this.prisma.organizations.findUnique({
            where: { id: organizationId },
        });

        if (!org) throw new NotFoundException('Organização não encontrada');

        if (org.stripe_customer_id) return org.stripe_customer_id;

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

    /**
     * SetupIntent para salvar cartão (off_session) no customer da org.
     */
    async createSetupIntentForOrg(organizationId: string) {
        const customerId = await this.getOrCreateCustomerForOrg(organizationId);

        const setupIntent = await this.stripe.setupIntents.create({
            customer: customerId,
            usage: 'off_session',
            payment_method_types: ['card'],
        });

        return { client_secret: setupIntent.client_secret };
    }

    async listCards(organizationId: string) {
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

    private async unsetDefaultForOrg(organizationId: string) {
        await this.prisma.billing_cards.updateMany({
            where: { organization_id: organizationId, is_default: true },
            data: { is_default: false },
        });
    }

    async createCard(organizationId: string, dto: CreateBillingDto) {
        const customerId = await this.getOrCreateCustomerForOrg(organizationId);

        // 1) Recupera PaymentMethod e valida se pertence ao customer
        const pm = await this.stripe.paymentMethods.retrieve(dto.provider_token);

        // pm.customer pode vir string | null
        const pmCustomerId = (pm as any)?.customer;
        if (!pmCustomerId || pmCustomerId !== customerId) {
            throw new ForbiddenException(
                'Esse cartão não pertence à organização logada (customer mismatch).',
            );
        }

        const brand = (pm as any)?.card?.brand?.toUpperCase?.() || 'CARD';
        const last4 = (pm as any)?.card?.last4;

        if (!last4)
            throw new BadRequestException('PaymentMethod inválido (sem last4).');

        // 2) Regra: se for o primeiro cartão -> default true
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

    async setDefaultCard(organizationId: string, cardId: string) {
        const card = await this.prisma.billing_cards.findUnique({
            where: { id: cardId },
        });
        if (!card) throw new NotFoundException('Cartão não encontrado');
        if (card.organization_id !== organizationId)
            throw new ForbiddenException('Sem acesso a este cartão');

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

    async updateCard(
        organizationId: string,
        cardId: string,
        dto: UpdateBillingDto,
    ) {
        const card = await this.prisma.billing_cards.findUnique({
            where: { id: cardId },
        });
        if (!card) throw new NotFoundException('Cartão não encontrado');
        if (card.organization_id !== organizationId)
            throw new ForbiddenException('Sem acesso a este cartão');

        if (dto.is_default) {
            await this.unsetDefaultForOrg(organizationId);
        }

        const updated = await this.prisma.billing_cards.update({
            where: { id: cardId },
            data: {
                holder_name: dto.holder_name ?? card.holder_name,
                // normalmente não editamos brand/last4, mas deixei opcional:
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

    async deleteCard(organizationId: string, cardId: string) {
        const card = await this.prisma.billing_cards.findUnique({
            where: { id: cardId },
        });
        if (!card) throw new NotFoundException('Cartão não encontrado');
        if (card.organization_id !== organizationId)
            throw new ForbiddenException('Sem acesso a este cartão');

        const wasDefault = card.is_default;

        await this.prisma.billing_cards.delete({ where: { id: cardId } });

        // Se apagou o default, tenta promover outro como default (mais simples)
        if (wasDefault) {
            const next = await this.prisma.billing_cards.findFirst({
                where: { organization_id: organizationId },
                orderBy: [{ id: 'desc' }], // se tiver created_at, troca pra created_at desc
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

    private tokenPriceCents(tokens: number) {
        // Preço: $25 por 1.000.000 tokens
        // => 1 token = $0.000025
        // Stripe amount é em centavos (USD): $0.01 = 1 cent
        // total_cents = tokens * 25 / 1_000_000 * 100
        //           = tokens * 2500 / 1_000_000
        //           = tokens / 400
        if (!Number.isFinite(tokens)) throw new Error('tokens inválido');

        const t = Math.floor(tokens);
        if (t <= 0) throw new Error('tokens deve ser >= 1');

        const cents = Math.round(t / 400); // pois 1 cent compra 400 tokens
        return Math.max(1, cents); // Stripe não aceita amount 0
    }

    async topupTokens(organizationId: string, tokens: number) {
        const customerId = await this.getOrCreateCustomerForOrg(organizationId);

        const defaultCard = await this.prisma.billing_cards.findFirst({
            where: { organization_id: organizationId, is_default: true },
        });

        if (!defaultCard) {
            throw new BadRequestException('Nenhum cartão principal cadastrado');
        }

        // acha wallet da org
        const wallet = await this.prisma.wallets.findFirst({
            where: { organization_id: organizationId },
        });
        if (!wallet) throw new NotFoundException('Wallet não encontrada');

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
            throw new BadRequestException(
                `Pagamento não aprovado. Status: ${pi.status}`,
            );
        }

        // credita tokens e registra transaction (simples)
        const newBalance = Number(wallet.balance) + tokens;

        await this.prisma.wallets.update({
            where: { id: wallet.id },
            data: { balance: newBalance },
        });

        await this.prisma.transactions.create({
            data: {
                wallet_id: wallet.id,
                amount: tokens, // aqui estou registrando em tokens (coerente com "cobrar por token")
                type: 'TOPUP' as any, // ajuste conforme seu enum
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
}
