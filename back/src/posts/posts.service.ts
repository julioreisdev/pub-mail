import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

@Injectable()
export class PostsService {
    constructor(private readonly prisma: PrismaService) { }

    async create(
        organizationId: string,
        dto: CreatePostDto,
        files: Array<Express.Multer.File>,
    ) {
        if (!files || files.length === 0) {
            throw new HttpException(
                'É necessário enviar pelo menos um arquivo de mídia.',
                HttpStatus.BAD_REQUEST,
            );
        }

        const tokensPerMb = parseInt(
            process.env.POSTS_TOKENS_PER_MEDIA_MB || '1',
            10,
        );
        const totalBytes = files.reduce((acc, file) => acc + file.size, 0);
        const totalMb = Math.ceil(totalBytes / (1024 * 1024));
        const costInTokens = totalMb * tokensPerMb;

        const wallet = await this.prisma.wallets.findFirst({
            where: { organization_id: organizationId, status: 'ACTIVE' },
        });

        if (!wallet) {
            this.cleanupFiles(files);
            throw new HttpException(
                'Carteira da organização não encontrada ou inativa.',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (Number(wallet.balance) < costInTokens) {
            this.cleanupFiles(files);
            throw new HttpException(
                `Saldo insuficiente. São necessários ${costInTokens} tokens para processar ${totalMb}MB de mídia.`,
                HttpStatus.PAYMENT_REQUIRED,
            );
        }

        let parsedTags: any = null;
        if (dto.tags) {
            try {
                parsedTags = JSON.parse(dto.tags);
            } catch (error) {
                parsedTags = dto.tags;
            }
        }

        let mediaMetadata: Array<{
            file: Express.Multer.File;
            isVideo: boolean;
            durationSec: number | null;
        }> = [];
        try {
            mediaMetadata = await Promise.all(
                files.map(async (file) => {
                    const isVideo = file.mimetype.startsWith('video/');
                    if (!isVideo) {
                        return {
                            file,
                            isVideo,
                            durationSec: null
                        };
                    }

                    const durationSec = await this.extractVideoDurationSec(file.path, file.originalname);
                    return {
                        file,
                        isVideo,
                        durationSec
                    };
                }),
            );
        } catch (error) {
            this.cleanupFiles(files);
            throw error;
        }

        try {
            const result = await this.prisma.$transaction(async (tx) => {
                if (costInTokens > 0) {
                    await tx.wallets.update({
                        where: { id: wallet.id },
                        data: { balance: { decrement: costInTokens } },
                    });

                    await tx.transactions.create({
                        data: {
                            wallet_id: wallet.id,
                            amount: -costInTokens,
                            type: 'MEDIA_STORAGE_FEE',
                            description: `Upload de ${totalMb}MB de mídias para post.`,
                        },
                    });
                }

                const post = await tx.posts.create({
                    data: {
                        organization_id: organizationId,
                        internal_name: dto.internal_name,
                        post_type: dto.post_type as any, // Passamos a string limpa
                        default_title: dto.default_title,
                        default_caption: dto.default_caption,
                        tags: parsedTags,
                    },
                });

                const mediaData = mediaMetadata.map((item, index) => {
                    return {
                        post_id: post.id,
                        sort_order: index,
                        media_type: item.isVideo ? ('VIDEO' as any) : ('IMAGE' as any), // Resolve o TS sem precisar de import
                        mime_type: item.file.mimetype,
                        file_size_bytes: item.file.size,
                        original_name: item.file.originalname,
                        storage_key: item.file.filename,
                        storage_provider: 'LOCAL',
                        duration_sec: item.durationSec,
                    };
                });

                await tx.post_media.createMany({ data: mediaData });

                return tx.posts.findUnique({
                    where: { id: post.id },
                    include: { media: { orderBy: { sort_order: 'asc' } } },
                });
            });

            return {
                success: true,
                message: 'Post cadastrado e tokens debitados com sucesso.',
                tokens_cost: costInTokens,
                data: result,
            };
        } catch (error) {
            this.cleanupFiles(files);
            console.error('Erro ao salvar post e debitar tokens:', error);
            throw new HttpException(
                'Falha ao processar o post. Tente novamente.',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async findAll(organizationId: string) {
        const posts = await this.prisma.posts.findMany({
            where: { organization_id: organizationId },
            include: {
                media: {
                    orderBy: { sort_order: 'asc' },
                },
            },
            orderBy: { created_at: 'desc' },
        });

        return { success: true, data: posts };
    }

    async findOne(organizationId: string, id: string) {
        const post = await this.prisma.posts.findFirst({
            where: { id, organization_id: organizationId },
            include: {
                media: { orderBy: { sort_order: 'asc' } },
            },
        });

        if (!post) {
            throw new HttpException('Post não encontrado.', HttpStatus.NOT_FOUND);
        }

        return { success: true, data: post };
    }

    async update(organizationId: string, id: string, dto: UpdatePostDto) {
        await this.findOne(organizationId, id);

        let parsedTags: any = undefined;
        if (dto.tags) {
            try {
                parsedTags = JSON.parse(dto.tags);
            } catch (e) {
                parsedTags = dto.tags;
            }
        }

        const updated = await this.prisma.posts.update({
            where: { id },
            data: {
                internal_name: dto.internal_name,
                post_type: dto.post_type as any,
                default_title: dto.default_title,
                default_caption: dto.default_caption,
                ...(parsedTags !== undefined && { tags: parsedTags }),
            },
            include: {
                media: { orderBy: { sort_order: 'asc' } },
            },
        });

        return { success: true, data: updated };
    }

    async remove(organizationId: string, id: string) {
        const { data: post } = await this.findOne(organizationId, id);

        await this.prisma.posts.delete({ where: { id } });

        for (const media of post.media) {
            try {
                const filePath = path.join(process.cwd(), 'uploads', media.storage_key);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (error) {
                console.error(
                    `Falha ao deletar o arquivo físico: ${media.storage_key}`,
                    error,
                );
            }
        }

        return { success: true, message: 'Post e arquivos deletados com sucesso.' };
    }

    private cleanupFiles(files: Array<Express.Multer.File>) {
        if (!files) return;
        files.forEach((file) => {
            try {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            } catch (error) {
                console.error(`Falha ao limpar arquivo temporário: ${file.path}`);
            }
        });
    }

    private parseFfprobeDurationValue(raw: unknown): number | null {
        if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
            return raw;
        }

        const value = String(raw ?? '').trim();
        if (!value) return null;

        const asNumber = Number.parseFloat(value);
        if (Number.isFinite(asNumber) && asNumber > 0) {
            return asNumber;
        }

        const timeLike = value.match(/^(\d+):(\d+):(\d+(?:\.\d+)?)$/);
        if (!timeLike) return null;

        const hours = Number.parseInt(timeLike[1], 10);
        const minutes = Number.parseInt(timeLike[2], 10);
        const seconds = Number.parseFloat(timeLike[3]);

        if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
            return null;
        }

        const total = hours * 3600 + minutes * 60 + seconds;
        return Number.isFinite(total) && total > 0 ? total : null;
    }

    private pickDurationFromFfprobePayload(payload: any): number | null {
        const candidates: number[] = [];

        const formatDuration = this.parseFfprobeDurationValue(payload?.format?.duration);
        if (formatDuration) candidates.push(formatDuration);

        const streams = Array.isArray(payload?.streams) ? payload.streams : [];
        for (const stream of streams) {
            const streamDuration = this.parseFfprobeDurationValue(stream?.duration);
            if (streamDuration) {
                candidates.push(streamDuration);
                continue;
            }

            const taggedDuration = this.parseFfprobeDurationValue(stream?.tags?.DURATION);
            if (taggedDuration) {
                candidates.push(taggedDuration);
            }
        }

        if (candidates.length === 0) return null;
        return Math.max(...candidates);
    }

    private async extractVideoDurationSec(filePath: string, originalName?: string) {
        try {
            const { stdout } = await execFileAsync('ffprobe', [
                '-v',
                'error',
                '-print_format',
                'json',
                '-show_format',
                '-show_streams',
                filePath
            ]);

            const payload = JSON.parse(String(stdout || '{}'));
            const duration = this.pickDurationFromFfprobePayload(payload);

            if (!duration || !Number.isFinite(duration) || duration <= 0) {
                throw new Error('Duração inválida');
            }

            return Math.max(1, Math.ceil(duration));
        } catch (error: any) {
            const detail = String(error?.stderr || error?.message || '').trim();
            const ffprobeMissing =
                error?.code === 'ENOENT' ||
                /ffprobe/i.test(detail) && /(not found|no such file|cannot find)/i.test(detail);

            throw new HttpException(
                ffprobeMissing
                    ? 'Não foi possível processar o vídeo neste servidor (ffprobe não disponível).'
                    : `Não foi possível extrair a duração do vídeo "${originalName || 'arquivo'}". Reenvie o arquivo em formato suportado.`,
                ffprobeMissing ? HttpStatus.INTERNAL_SERVER_ERROR : HttpStatus.BAD_REQUEST,
            );
        }
    }
}
