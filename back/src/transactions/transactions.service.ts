import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { wallets_status } from 'generated/prisma/client';

function isPositiveDecimalString(v: string) {
  // aceita "10", "10.5", "10.5000"
  return typeof v === 'string' && /^[0-9]+(\.[0-9]{1,4})?$/.test(v) && Number(v) > 0;
}

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async createForMyWallet(organizationId: string, dto: CreateTransactionDto) {
    if (!isPositiveDecimalString(dto.amount)) {
      throw new BadRequestException('amount must be a positive decimal with up to 4 places');
    }

    const wallet = await this.prisma.wallets.findFirst({
      where: { organization_id: organizationId },
      select: { id: true, status: true },
    });

    if (!wallet) throw new NotFoundException('Wallet not found');
    if (wallet.status !== wallets_status.ACTIVE) {
      throw new BadRequestException('Wallet is not active');
    }

    const amount = dto.amount; // string decimal
    const type = dto.type?.trim();

    if (!type) throw new BadRequestException('type is required');

    // agora quem decide é operation, não o type
    const isCredit = dto.operation === 'CREDIT';
    const isDebit = dto.operation === 'DEBIT';

    if (!isCredit && !isDebit) {
      throw new BadRequestException('operation must be CREDIT or DEBIT');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1) Atualiza saldo de forma segura
      if (isCredit) {
        const updated = await tx.wallets.updateMany({
          where: { id: wallet.id, status: wallets_status.ACTIVE },
          data: {
            balance: { increment: amount as any },
          },
        });

        if (updated.count === 0) throw new BadRequestException('Wallet update failed');
      } else {
        // Débito: garante que balance >= amount no próprio UPDATE (evita race condition)
        const updated = await tx.wallets.updateMany({
          where: {
            id: wallet.id,
            status: wallets_status.ACTIVE,
            balance: { gte: amount as any },
          },
          data: {
            balance: { decrement: amount as any },
          },
        });

        if (updated.count === 0) {
          throw new BadRequestException('Insufficient balance');
        }
      }

      // 2) Cria a transaction (type é livre)
      const transaction = await tx.transactions.create({
        data: {
          wallet_id: wallet.id,
          amount: amount as any,
          type, // qualquer string
          description: dto.description,
          provider_transaction_id: dto.provider_transaction_id ?? null,
        },
        select: {
          id: true,
          wallet_id: true,
          amount: true,
          type: true,
          description: true,
          provider_transaction_id: true,
          created_at: true,
        },
      });

      // 3) Retorna também o saldo atualizado
      const updatedWallet = await tx.wallets.findUnique({
        where: { id: wallet.id },
        select: { id: true, balance: true, status: true },
      });

      return { transaction, wallet: updatedWallet };
    });
  }
}