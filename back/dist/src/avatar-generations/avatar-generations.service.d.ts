import { PrismaService } from '../prisma/prisma.service';
import { GenerateAvatarDto } from './dto/generate-avatar.dto';
export declare class AvatarGenerationsService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    generateAvatar(organizationId: string, dto: GenerateAvatarDto): Promise<{
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
    private getTokenCostForAvatar;
    private debitTokens;
    private refundTokens;
}
