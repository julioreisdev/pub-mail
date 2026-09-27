import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  controllers: [TransactionsController],
  // PrismaService vem do PrismaModule (@Global) — não instanciar outro pool (A-79).
  providers: [TransactionsService],
})
export class TransactionsModule {}