import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
export declare class AuthService {
    private prisma;
    private usersService;
    private jwt;
    constructor(prisma: PrismaService, usersService: UsersService, jwt: JwtService);
    private getAccessExpiresIn;
    private getRefreshExpiresIn;
    private hashToken;
    private signAccessToken;
    private signRefreshToken;
    private setUserRefreshTokenHash;
    private validateUserPassword;
    register(createUserDto: any): Promise<{
        tokens: {
            accessToken: string;
            refreshToken: string;
            accessExpiresIn: string;
            refreshExpiresIn: string;
        };
        user: {
            id: string;
            organization_id: string;
            name: string;
            email: string;
            role: import("../../generated/prisma/enums").users_role;
            active: boolean;
        };
        organization: {
            id: string;
            name: string;
            document_id: string | null;
            status: boolean;
            stripe_customer_id: string | null;
            created_at: Date;
            updated_at: Date;
        };
        wallet: {
            id: string;
            organization_id: string;
            status: import("../../generated/prisma/enums").wallets_status;
            balance: import("@prisma/client-runtime-utils").Decimal;
        };
    }>;
    login(dto: LoginDto): Promise<{
        user: {
            id: string;
            organizationId: string;
            role: import("../../generated/prisma/enums").users_role;
        };
        tokens: {
            accessToken: string;
            refreshToken: string;
            accessExpiresIn: string;
            refreshExpiresIn: string;
        };
    }>;
    refresh(dto: RefreshDto): Promise<{
        tokens: {
            accessToken: string;
            refreshToken: string;
            accessExpiresIn: string;
            refreshExpiresIn: string;
        };
    }>;
    me(userId: string, organizationId: string): Promise<{
        user: {
            id: string;
            organization_id: string;
            name: string;
            email: string;
            role: import("../../generated/prisma/enums").users_role;
            active: boolean;
        };
        organization: {
            id: string;
            name: string;
            document_id: string | null;
            status: boolean;
            stripe_customer_id: string | null;
            created_at: Date;
            updated_at: Date;
        };
    }>;
    logout(userId: string): Promise<{
        message: string;
    }>;
}
