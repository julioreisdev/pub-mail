import { AvatarsService } from './avatars.service';
import { CreateAvatarDto } from './dto/create-avatar.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
export declare class AvatarsController {
    private readonly avatarsService;
    constructor(avatarsService: AvatarsService);
    create(req: any, createAvatarDto: CreateAvatarDto): Promise<{
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
    findAll(req: any): Promise<{
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
    findOne(req: any, id: string): Promise<{
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
    update(req: any, id: string, updateAvatarDto: UpdateAvatarDto): Promise<{
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
    remove(req: any, id: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
