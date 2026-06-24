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
exports.TransactionsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("../../generated/prisma/client");
function isPositiveDecimalString(v) {
    return typeof v === 'string' && /^[0-9]+(\.[0-9]{1,4})?$/.test(v) && Number(v) > 0;
}
let TransactionsService = class TransactionsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createForMyWallet(organizationId, dto) {
        if (!isPositiveDecimalString(dto.amount)) {
            throw new common_1.BadRequestException('amount must be a positive decimal with up to 4 places');
        }
        const wallet = await this.prisma.wallets.findFirst({
            where: { organization_id: organizationId },
            select: { id: true, status: true },
        });
        if (!wallet)
            throw new common_1.NotFoundException('Wallet not found');
        if (wallet.status !== client_1.wallets_status.ACTIVE) {
            throw new common_1.BadRequestException('Wallet is not active');
        }
        const amount = dto.amount;
        const type = dto.type?.trim();
        if (!type)
            throw new common_1.BadRequestException('type is required');
        const isCredit = dto.operation === 'CREDIT';
        const isDebit = dto.operation === 'DEBIT';
        if (!isCredit && !isDebit) {
            throw new common_1.BadRequestException('operation must be CREDIT or DEBIT');
        }
        return this.prisma.$transaction(async (tx) => {
            if (isCredit) {
                const updated = await tx.wallets.updateMany({
                    where: { id: wallet.id, status: client_1.wallets_status.ACTIVE },
                    data: {
                        balance: { increment: amount },
                    },
                });
                if (updated.count === 0)
                    throw new common_1.BadRequestException('Wallet update failed');
            }
            else {
                const updated = await tx.wallets.updateMany({
                    where: {
                        id: wallet.id,
                        status: client_1.wallets_status.ACTIVE,
                        balance: { gte: amount },
                    },
                    data: {
                        balance: { decrement: amount },
                    },
                });
                if (updated.count === 0) {
                    throw new common_1.BadRequestException('Insufficient balance');
                }
            }
            const transaction = await tx.transactions.create({
                data: {
                    wallet_id: wallet.id,
                    amount: amount,
                    type,
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
            const updatedWallet = await tx.wallets.findUnique({
                where: { id: wallet.id },
                select: { id: true, balance: true, status: true },
            });
            return { transaction, wallet: updatedWallet };
        });
    }
};
exports.TransactionsService = TransactionsService;
exports.TransactionsService = TransactionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TransactionsService);
//# sourceMappingURL=transactions.service.js.map