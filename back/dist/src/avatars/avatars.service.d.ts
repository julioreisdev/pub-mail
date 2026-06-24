import { PrismaService } from '../prisma/prisma.service';
import { CreateAvatarDto } from './dto/create-avatar.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
export declare class AvatarsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(organizationId: string, data: CreateAvatarDto): Promise<{
        id: string;
        organization_id: string;
        name: string;
        status: import("../../generated/prisma/enums").avatar_status;
        created_at: Date;
        updated_at: Date;
        is_realistic: boolean;
        default_colors: import("@prisma/client/runtime/client").JsonValue | null;
        inspiration_image_url: string | null;
        avatar_image_url: string;
        user_prompt: string | null;
        system_prompt: string | null;
        personality: string | null;
        technical_metadata: import("@prisma/client/runtime/client").JsonValue | null;
    }>;
    findAll(organizationId: string): Promise<{
        id: string;
        organization_id: string;
        name: string;
        status: import("../../generated/prisma/enums").avatar_status;
        created_at: Date;
        updated_at: Date;
        is_realistic: boolean;
        default_colors: import("@prisma/client/runtime/client").JsonValue | null;
        inspiration_image_url: string | null;
        avatar_image_url: string;
        user_prompt: string | null;
        system_prompt: string | null;
        personality: string | null;
        technical_metadata: import("@prisma/client/runtime/client").JsonValue | null;
    }[]>;
    findOne(organizationId: string, id: string): Promise<{
        id: string;
        organization_id: string;
        name: string;
        status: import("../../generated/prisma/enums").avatar_status;
        created_at: Date;
        updated_at: Date;
        is_realistic: boolean;
        default_colors: import("@prisma/client/runtime/client").JsonValue | null;
        inspiration_image_url: string | null;
        avatar_image_url: string;
        user_prompt: string | null;
        system_prompt: string | null;
        personality: string | null;
        technical_metadata: import("@prisma/client/runtime/client").JsonValue | null;
    }>;
    update(organizationId: string, id: string, data: UpdateAvatarDto): Promise<{
        id: string;
        organization_id: string;
        name: string;
        status: import("../../generated/prisma/enums").avatar_status;
        created_at: Date;
        updated_at: Date;
        is_realistic: boolean;
        default_colors: import("@prisma/client/runtime/client").JsonValue | null;
        inspiration_image_url: string | null;
        avatar_image_url: string;
        user_prompt: string | null;
        system_prompt: string | null;
        personality: string | null;
        technical_metadata: import("@prisma/client/runtime/client").JsonValue | null;
    }>;
    remove(organizationId: string, id: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
