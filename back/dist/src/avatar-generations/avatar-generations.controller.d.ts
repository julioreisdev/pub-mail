import { AvatarGenerationsService } from './avatar-generations.service';
import { GenerateAvatarDto } from './dto/generate-avatar.dto';
export declare class AvatarGenerationsController {
    private readonly avatarGenerationsService;
    constructor(avatarGenerationsService: AvatarGenerationsService);
    generate(req: any, dto: GenerateAvatarDto): Promise<{
        success: boolean;
        data: {
            id: string;
            organization_id: string;
            created_at: Date;
            tokens_cost: number;
            is_realistic: boolean;
            inspiration_image_url: string | null;
            user_prompt: string | null;
            system_prompt: string | null;
            technical_metadata: import("@prisma/client/runtime/client").JsonValue | null;
            result_image_url: string;
        };
        message: string;
    }>;
}
