import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListTransactionsDto } from './dto/list-transactions.dto';

@Injectable()
export class WalletsService {
  constructor(private prisma: PrismaService) {}

  async getMyWallet(organizationId: string) {
    const wallet = await this.prisma.wallets.findFirst({
      where: { organization_id: organizationId },
      select: {
        id: true,
        organization_id: true,
        balance: true,
        status: true,
      },
    });

    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  async listMyTransactions(organizationId: string, query: ListTransactionsDto) {
    const wallet = await this.prisma.wallets.findFirst({
      where: { organization_id: organizationId },
      select: { id: true },
    });

    if (!wallet) throw new NotFoundException('Wallet not found');

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const whereTx: any = { wallet_id: wallet.id };

    // agora type é string livre, sem enum
    if (query.type && query.type.trim()) {
      whereTx.type = query.type.trim();
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.transactions.findMany({
        where: whereTx,
        orderBy: { created_at: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          wallet_id: true,
          amount: true,
          type: true,
          description: true,
          provider_transaction_id: true,
          created_at: true,
        },
      }),
      this.prisma.transactions.count({ where: whereTx }),
    ]);

    return { page, pageSize, total, items };
  }
}
