import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBillingCardDto } from './dto/create-billing-card.dto';
import { UpdateBillingCardDto } from './dto/update-billing-card.dto';

@Injectable()
export class BillingCardsService {
  constructor(private prisma: PrismaService) {}

  // NUNCA retornar provider_token
  private readonly cardPublicSelect = {
    id: true,
    organization_id: true,
    last_four_digits: true,
    brand: true,
    holder_name: true,
    is_default: true,
  };

  async listMyCards(organizationId: string) {
    return this.prisma.billing_cards.findMany({
      where: { organization_id: organizationId },
      // brand agora pode ser null → melhor ordenar por holder_name ou id
      orderBy: [{ is_default: 'desc' }, { holder_name: 'asc' }],
      select: this.cardPublicSelect,
    });
  }

  async createMyCard(organizationId: string, dto: CreateBillingCardDto) {
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
          provider_token: dto.provider_token, // salva, mas não retorna
          holder_name: dto.holder_name,

          // agora opcionais
          brand: dto.brand ?? null,
          last_four_digits: dto.last_four_digits ?? null,

          is_default: shouldBeDefault,
        },
        select: this.cardPublicSelect,
      });

      return card;
    });
  }

  async updateMyCard(organizationId: string, cardId: string, dto: UpdateBillingCardDto) {
    return this.prisma.$transaction(async (tx) => {
      const card = await tx.billing_cards.findFirst({
        where: { id: cardId, organization_id: organizationId },
        select: { id: true },
      });

      if (!card) throw new NotFoundException('Billing card not found');

      if (dto.is_default === true) {
        await tx.billing_cards.updateMany({
          where: { organization_id: organizationId, is_default: true },
          data: { is_default: false },
        });
      }

      // monta data com segurança (não sobrescreve campos quando não vier)
      const data: any = {};

      if (dto.holder_name !== undefined) data.holder_name = dto.holder_name;
      if (dto.is_default !== undefined) data.is_default = dto.is_default;

      // opcionais: se vier, salva; se não vier, não mexe.
      if (dto.brand !== undefined) data.brand = dto.brand ?? null;
      if (dto.last_four_digits !== undefined) data.last_four_digits = dto.last_four_digits ?? null;

      return tx.billing_cards.update({
        where: { id: cardId },
        data,
        select: this.cardPublicSelect,
      });
    });
  }

  async setDefault(organizationId: string, cardId: string) {
    return this.prisma.$transaction(async (tx) => {
      const card = await tx.billing_cards.findFirst({
        where: { id: cardId, organization_id: organizationId },
        select: { id: true },
      });

      if (!card) throw new NotFoundException('Billing card not found');

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

  async removeMyCard(organizationId: string, cardId: string) {
    return this.prisma.$transaction(async (tx) => {
      const card = await tx.billing_cards.findFirst({
        where: { id: cardId, organization_id: organizationId },
        select: { id: true, is_default: true },
      });

      if (!card) throw new NotFoundException('Billing card not found');

      await tx.billing_cards.delete({ where: { id: cardId } });

      // Se removeu o default, promove outro (se existir)
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
}