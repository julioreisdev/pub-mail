import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
export declare class AuthController {
    private auth;
    constructor(auth: AuthService);
    register(dto: CreateUserDto): Promise<{
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
    logout(req: any): Promise<{
        message: string;
    }>;
    me(req: any): Promise<{
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
}
