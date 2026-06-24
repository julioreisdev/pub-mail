import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
export declare class PostsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(organizationId: string, dto: CreatePostDto, files: Array<Express.Multer.File>): Promise<{
        success: boolean;
        message: string;
        tokens_cost: number;
        data: ({
            media: {
                id: string;
                created_at: Date;
                updated_at: Date;
                post_id: string;
                sort_order: number;
                media_type: import("../../generated/prisma/enums").media_type;
                mime_type: string;
                file_size_bytes: number;
                original_name: string;
                storage_key: string;
                storage_provider: string;
                width: number | null;
                height: number | null;
                duration_sec: number | null;
                thumbnail_key: string | null;
            }[];
        } & {
            id: string;
            organization_id: string;
            status: import("../../generated/prisma/enums").post_status;
            created_at: Date;
            updated_at: Date;
            internal_name: string;
            post_type: import("../../generated/prisma/enums").post_type;
            default_title: string | null;
            default_caption: string | null;
            tags: import("@prisma/client/runtime/client").JsonValue | null;
        }) | null;
    }>;
    findAll(organizationId: string): Promise<{
        success: boolean;
        data: ({
            media: {
                id: string;
                created_at: Date;
                updated_at: Date;
                post_id: string;
                sort_order: number;
                media_type: import("../../generated/prisma/enums").media_type;
                mime_type: string;
                file_size_bytes: number;
                original_name: string;
                storage_key: string;
                storage_provider: string;
                width: number | null;
                height: number | null;
                duration_sec: number | null;
                thumbnail_key: string | null;
            }[];
        } & {
            id: string;
            organization_id: string;
            status: import("../../generated/prisma/enums").post_status;
            created_at: Date;
            updated_at: Date;
            internal_name: string;
            post_type: import("../../generated/prisma/enums").post_type;
            default_title: string | null;
            default_caption: string | null;
            tags: import("@prisma/client/runtime/client").JsonValue | null;
        })[];
    }>;
    findOne(organizationId: string, id: string): Promise<{
        success: boolean;
        data: {
            media: {
                id: string;
                created_at: Date;
                updated_at: Date;
                post_id: string;
                sort_order: number;
                media_type: import("../../generated/prisma/enums").media_type;
                mime_type: string;
                file_size_bytes: number;
                original_name: string;
                storage_key: string;
                storage_provider: string;
                width: number | null;
                height: number | null;
                duration_sec: number | null;
                thumbnail_key: string | null;
            }[];
        } & {
            id: string;
            organization_id: string;
            status: import("../../generated/prisma/enums").post_status;
            created_at: Date;
            updated_at: Date;
            internal_name: string;
            post_type: import("../../generated/prisma/enums").post_type;
            default_title: string | null;
            default_caption: string | null;
            tags: import("@prisma/client/runtime/client").JsonValue | null;
        };
    }>;
    update(organizationId: string, id: string, dto: UpdatePostDto): Promise<{
        success: boolean;
        data: {
            media: {
                id: string;
                created_at: Date;
                updated_at: Date;
                post_id: string;
                sort_order: number;
                media_type: import("../../generated/prisma/enums").media_type;
                mime_type: string;
                file_size_bytes: number;
                original_name: string;
                storage_key: string;
                storage_provider: string;
                width: number | null;
                height: number | null;
                duration_sec: number | null;
                thumbnail_key: string | null;
            }[];
        } & {
            id: string;
            organization_id: string;
            status: import("../../generated/prisma/enums").post_status;
            created_at: Date;
            updated_at: Date;
            internal_name: string;
            post_type: import("../../generated/prisma/enums").post_type;
            default_title: string | null;
            default_caption: string | null;
            tags: import("@prisma/client/runtime/client").JsonValue | null;
        };
    }>;
    remove(organizationId: string, id: string): Promise<{
        success: boolean;
        message: string;
    }>;
    private cleanupFiles;
    private parseFfprobeDurationValue;
    private pickDurationFromFfprobePayload;
    private extractVideoDurationSec;
}
