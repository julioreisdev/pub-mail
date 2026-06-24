import { Module } from '@nestjs/common';
import { BillingCardsController } from "./billing_cards.controller";
import { BillingCardsService } from "./billing-cards.service";
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [BillingCardsController],
  providers: [BillingCardsService, PrismaService],
})
export class BillingCardsModule {}