"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const bcrypt = __importStar(require("bcryptjs"));
const client_1 = require("../../generated/prisma/client");
function isPrismaUniqueError(e) {
    return e?.code === 'P2002';
}
function prismaUniqueTargets(e) {
    const t = e?.meta?.target;
    if (Array.isArray(t))
        return t.map(String);
    if (typeof t === 'string')
        return [t];
    return [];
}
const userSelect = {
    id: true,
    organization_id: true,
    name: true,
    email: true,
    role: true,
    active: true,
};
let UsersService = class UsersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async register(dto) {
        const email = dto.email?.toLowerCase().trim();
        const documentId = dto.document_id?.trim();
        if (documentId === '') {
            throw new common_1.BadRequestException('document_id cannot be empty');
        }
        if (!email)
            throw new common_1.BadRequestException('email is required');
        if (!dto.password)
            throw new common_1.BadRequestException('password is required');
        if (!dto.organization_name?.trim())
            throw new common_1.BadRequestException('organization_name is required');
        if (!dto.name?.trim())
            throw new common_1.BadRequestException('name is required');
        const userExists = await this.prisma.users.findUnique({ where: { email } });
        if (userExists)
            throw new common_1.BadRequestException('Email already registered');
        const password_hash = await bcrypt.hash(dto.password, 12);
        try {
            return await this.prisma.$transaction(async (tx) => {
                const organization = await tx.organizations.create({
                    data: {
                        name: dto.organization_name.trim(),
                        ...(documentId ? { document_id: documentId } : {}),
                    },
                });
                const wallet = await tx.wallets.create({
                    data: {
                        organization_id: organization.id,
                        balance: '0.0000',
                        status: client_1.wallets_status.ACTIVE,
                    },
                });
                const user = await tx.users.create({
                    data: {
                        organization_id: organization.id,
                        name: dto.name.trim(),
                        email,
                        password_hash,
                        role: client_1.users_role.OWNER,
                        active: true,
                    },
                    select: userSelect,
                });
                return { user, organization, wallet };
            });
        }
        catch (e) {
            if (isPrismaUniqueError(e)) {
                const targets = prismaUniqueTargets(e);
                if (targets.includes('email'))
                    throw new common_1.BadRequestException('Email already registered');
                if (targets.includes('document_id'))
                    throw new common_1.BadRequestException('Document already registered');
                throw new common_1.BadRequestException('Email or document already registered');
            }
            throw e;
        }
    }
    async findAllByOrganization(organizationId) {
        return this.prisma.users.findMany({
            where: { organization_id: organizationId, active: true },
            select: userSelect,
            orderBy: { name: 'asc' },
        });
    }
    async findMe(userId, organizationId) {
        const user = await this.prisma.users.findFirst({
            where: { id: userId, organization_id: organizationId },
            select: userSelect,
        });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return user;
    }
    async findOneInOrganization(organizationId, userId) {
        const user = await this.prisma.users.findFirst({
            where: { id: userId, organization_id: organizationId },
            select: userSelect,
        });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return user;
    }
    async updateInOrganization(organizationId, userId, dto) {
        const exists = await this.prisma.users.findFirst({
            where: { id: userId, organization_id: organizationId },
            select: { id: true },
        });
        if (!exists)
            throw new common_1.NotFoundException('User not found');
        return this.prisma.users.update({
            where: { id: userId },
            data: dto,
            select: userSelect,
        });
    }
    async removeInOrganization(organizationId, userId) {
        const exists = await this.prisma.users.findFirst({
            where: { id: userId, organization_id: organizationId },
            select: { id: true },
        });
        if (!exists)
            throw new common_1.NotFoundException('User not found');
        return this.prisma.users.update({
            where: { id: userId },
            data: { active: false },
            select: userSelect,
        });
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);
//# sourceMappingURL=users.service.js.map