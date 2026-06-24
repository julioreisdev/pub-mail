import { users_role } from 'generated/prisma/client';
export declare class UpdateUserDto {
    name?: string;
    role?: users_role;
    active?: boolean;
}
