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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const prisma_service_1 = require("../prisma/prisma.service");
const users_service_1 = require("../users/users.service");
let AuthService = class AuthService {
    prisma;
    usersService;
    jwt;
    constructor(prisma, usersService, jwt) {
        this.prisma = prisma;
        this.usersService = usersService;
        this.jwt = jwt;
    }
    getAccessExpiresIn() {
        return process.env.JWT_ACCESS_EXPIRES_IN || '15m';
    }
    getRefreshExpiresIn() {
        return process.env.JWT_REFRESH_EXPIRES_IN || '30d';
    }
    hashToken(token) {
        return crypto_1.default.createHash('sha256').update(token).digest('hex');
    }
    signAccessToken(user) {
        const secret = process.env.JWT_ACCESS_SECRET;
        if (!secret)
            throw new Error('JWT_ACCESS_SECRET is not set');
        const expiresIn = this.getAccessExpiresIn();
        const options = {
            secret,
            expiresIn: expiresIn,
        };
        const accessToken = this.jwt.sign({ sub: user.id, org: user.organization_id, role: user.role }, options);
        return { accessToken, expiresIn };
    }
    signRefreshToken(userId) {
        const secret = process.env.JWT_REFRESH_SECRET;
        if (!secret)
            throw new Error('JWT_REFRESH_SECRET is not set');
        const expiresIn = this.getRefreshExpiresIn();
        const random = crypto_1.default.randomBytes(64).toString('hex');
        const options = {
            secret,
            expiresIn: expiresIn,
        };
        const refreshToken = this.jwt.sign({ sub: userId, rnd: random }, options);
        return { refreshToken, expiresIn };
    }
    async setUserRefreshTokenHash(userId, refreshToken) {
        const refreshHash = this.hashToken(refreshToken);
        await this.prisma.users.update({
            where: { id: userId },
            data: { refresh_token: refreshHash },
        });
    }
    async validateUserPassword(email, password) {
        const user = await this.prisma.users.findUnique({
            where: { email: email.toLowerCase().trim() },
            select: {
                id: true,
                organization_id: true,
                role: true,
                active: true,
                password_hash: true,
            },
        });
        if (!user || !user.active) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok)
            throw new common_1.UnauthorizedException('Invalid credentials');
        return { id: user.id, organization_id: user.organization_id, role: user.role };
    }
    async register(createUserDto) {
        const result = await this.usersService.register(createUserDto);
        const user = await this.prisma.users.findUnique({
            where: { id: result.user.id },
            select: { id: true, organization_id: true, role: true, active: true },
        });
        if (!user || !user.active)
            throw new common_1.BadRequestException('User not active');
        const { accessToken, expiresIn: accessExpiresIn } = this.signAccessToken(user);
        const { refreshToken, expiresIn: refreshExpiresIn } = this.signRefreshToken(user.id);
        await this.setUserRefreshTokenHash(user.id, refreshToken);
        return {
            ...result,
            tokens: {
                accessToken,
                refreshToken,
                accessExpiresIn,
                refreshExpiresIn,
            },
        };
    }
    async login(dto) {
        const user = await this.validateUserPassword(dto.email, dto.password);
        const { accessToken, expiresIn: accessExpiresIn } = this.signAccessToken(user);
        const { refreshToken, expiresIn: refreshExpiresIn } = this.signRefreshToken(user.id);
        await this.setUserRefreshTokenHash(user.id, refreshToken);
        return {
            user: { id: user.id, organizationId: user.organization_id, role: user.role },
            tokens: { accessToken, refreshToken, accessExpiresIn, refreshExpiresIn },
        };
    }
    async refresh(dto) {
        const secret = process.env.JWT_REFRESH_SECRET;
        if (!secret)
            throw new Error('JWT_REFRESH_SECRET is not set');
        let payload;
        try {
            payload = this.jwt.verify(dto.refreshToken, { secret });
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
        const userId = payload?.sub;
        if (!userId)
            throw new common_1.UnauthorizedException('Invalid refresh token');
        const refreshHash = this.hashToken(dto.refreshToken);
        const user = await this.prisma.users.findFirst({
            where: { id: userId, refresh_token: refreshHash, active: true },
            select: { id: true, organization_id: true, role: true },
        });
        if (!user)
            throw new common_1.UnauthorizedException('Refresh token not recognized');
        const { accessToken, expiresIn: accessExpiresIn } = this.signAccessToken(user);
        const { refreshToken, expiresIn: refreshExpiresIn } = this.signRefreshToken(user.id);
        await this.setUserRefreshTokenHash(user.id, refreshToken);
        return { tokens: { accessToken, refreshToken, accessExpiresIn, refreshExpiresIn } };
    }
    async me(userId, organizationId) {
        const [user, organization] = await this.prisma.$transaction([
            this.prisma.users.findFirst({
                where: { id: userId, organization_id: organizationId, active: true },
                select: {
                    id: true,
                    organization_id: true,
                    name: true,
                    email: true,
                    role: true,
                    active: true,
                },
            }),
            this.prisma.organizations.findUnique({
                where: { id: organizationId },
                select: {
                    id: true,
                    name: true,
                    document_id: true,
                    status: true,
                    stripe_customer_id: true,
                    created_at: true,
                    updated_at: true,
                },
            }),
        ]);
        if (!user)
            throw new common_1.NotFoundException('User not found');
        if (!organization)
            throw new common_1.NotFoundException('Organization not found');
        return { user, organization };
    }
    async logout(userId) {
        await this.prisma.users.update({
            where: { id: userId },
            data: { refresh_token: null },
        });
        return { message: 'Logged out' };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        users_service_1.UsersService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map