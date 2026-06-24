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
exports.WalletsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let WalletsService = class WalletsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getMyWallet(organizationId) {
        const wallet = await this.prisma.wallets.findFirst({
            where: { organization_id: organizationId },
            select: {
                id: true,
                organization_id: true,
                balance: true,
                status: true,
            },
        });
        if (!wallet)
            throw new common_1.NotFoundException('Wallet not found');
        return wallet;
    }
    async listMyTransactions(organizationId, query) {
        const wallet = await this.prisma.wallets.findFirst({
            where: { organization_id: organizationId },
            select: { id: true },
        });
        if (!wallet)
            throw new common_1.NotFoundException('Wallet not found');
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 20;
        const skip = (page - 1) * pageSize;
        const whereTx = { wallet_id: wallet.id };
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
};
exports.WalletsService = WalletsService;
exports.WalletsService = WalletsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WalletsService);
//# sourceMappingURL=wallets.service.js.map