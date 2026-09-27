import { Module } from '@nestjs/common';
import { BillingCardsController } from "./billing_cards.controller";
import { BillingCardsService } from "./billing-cards.service";

@Module({
  controllers: [BillingCardsController],
  // PrismaService vem do PrismaModule (@Global) — não instanciar outro pool (A-79).
  providers: [BillingCardsService],
})
export class BillingCardsModule {}