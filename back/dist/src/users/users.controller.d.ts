import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    findAll(req: any): Promise<{
        id: string;
        organization_id: string;
        name: string;
        email: string;
        role: import("../../generated/prisma/enums").users_role;
        active: boolean;
    }[]>;
    me(req: any): Promise<{
        id: string;
        organization_id: string;
        name: string;
        email: string;
        role: import("../../generated/prisma/enums").users_role;
        active: boolean;
    }>;
    findOne(req: any, id: string): Promise<{
        id: string;
        organization_id: string;
        name: string;
        email: string;
        role: import("../../generated/prisma/enums").users_role;
        active: boolean;
    }>;
    update(req: any, id: string, dto: UpdateUserDto): Promise<{
        id: string;
        organization_id: string;
        name: string;
        email: string;
        role: import("../../generated/prisma/enums").users_role;
        active: boolean;
    }>;
    remove(req: any, id: string): Promise<{
        id: string;
        organization_id: string;
        name: string;
        email: string;
        role: import("../../generated/prisma/enums").users_role;
        active: boolean;
    }>;
}
