import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAvatarDto } from './dto/create-avatar.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';

@Injectable()
export class AvatarsService {
    constructor(private readonly prisma: PrismaService) { }

    async create(organizationId: string, data: CreateAvatarDto) {
        return this.prisma.avatars.create({
            data: {
                organization_id: organizationId,
                name: data.name,
                avatar_image_url: data.avatar_image_url,
                is_realistic: data.is_realistic ?? true,
                default_colors: data.default_colors
                    ? (data.default_colors as any)
                    : null,
                inspiration_image_url: data.inspiration_image_url || null,
                user_prompt: data.user_prompt || null,
                system_prompt: data.system_prompt || null,
                personality: data.personality || null,
                technical_metadata: data.technical_metadata
                    ? (data.technical_metadata as any)
                    : null,
                status: data.status || 'ACTIVE',
            },
        });
    }

    async findAll(organizationId: string) {
        return this.prisma.avatars.findMany({
            where: { organization_id: organizationId },
            orderBy: { created_at: 'desc' },
        });
    }

    async findOne(organizationId: string, id: string) {
        const avatar = await this.prisma.avatars.findFirst({
            where: {
                id,
                organization_id: organizationId,
            },
        });

        if (!avatar) {
            throw new NotFoundException(
                'Avatar não encontrado ou não pertence a esta organização.',
            );
        }

        return avatar;
    }

    async update(organizationId: string, id: string, data: UpdateAvatarDto) {
        // Valida se o avatar existe e pertence à organização
        await this.findOne(organizationId, id);

        return this.prisma.avatars.update({
            where: { id },
            data: {
                ...(data.name !== undefined && { name: data.name }),
                ...(data.avatar_image_url !== undefined && {
                    avatar_image_url: data.avatar_image_url,
                }),
                ...(data.is_realistic !== undefined && {
                    is_realistic: data.is_realistic,
                }),
                ...(data.default_colors !== undefined && {
                    default_colors: data.default_colors as any,
                }),
                ...(data.inspiration_image_url !== undefined && {
                    inspiration_image_url: data.inspiration_image_url,
                }),
                ...(data.user_prompt !== undefined && {
                    user_prompt: data.user_prompt,
                }),
                ...(data.system_prompt !== undefined && {
                    system_prompt: data.system_prompt,
                }),
                ...(data.personality !== undefined && {
                    personality: data.personality,
                }),
                ...(data.technical_metadata !== undefined && {
                    technical_metadata: data.technical_metadata as any,
                }),
                ...(data.status !== undefined && { status: data.status }),
            },
        });
    }

    async remove(organizationId: string, id: string) {
        // Valida se o avatar existe e pertence à organização antes de deletar
        await this.findOne(organizationId, id);

        await this.prisma.avatars.delete({
            where: { id },
        });

        return { success: true, message: 'Avatar deletado com sucesso.' };
    }
}
