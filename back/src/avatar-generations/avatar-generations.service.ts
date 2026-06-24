import {
    BadRequestException,
    HttpException,
    HttpStatus,
    Injectable,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateAvatarDto } from './dto/generate-avatar.dto';

@Injectable()
export class AvatarGenerationsService {
    private readonly logger = new Logger(AvatarGenerationsService.name);

    constructor(private readonly prisma: PrismaService) { }

    async generateAvatar(organizationId: string, dto: GenerateAvatarDto) {
        const {
            prompt,
            colors,
            personality,
            userReferenceImage,
            lastGeneratedImage,
            is_realistic,
        } = dto;

        // 1. Definição do Custo
        const tokenCost = this.getTokenCostForAvatar();

        // 2. Desconta os tokens ANTES de chamar a IA
        await this.debitTokens(organizationId, tokenCost);

        const serviceUrl = process.env.IA_SERVICE_URL;
        const serviceKey = process.env.IA_SERVICE_KEY;

        if (!serviceUrl || !serviceKey) {
            throw new InternalServerErrorException(
                'Integração de IA não configurada no backend principal.',
            );
        }

        try {
            // 3. Chamada HTTP para o Micro-serviço
            const response = await fetch(`${serviceUrl}/api/generate-avatar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': serviceKey,
                },
                body: JSON.stringify({
                    prompt,
                    colors,
                    personality,
                    userReferenceImage,
                    lastGeneratedImage,
                }),
            });

            if (!response.ok) {
                const errorBody = await response.text().catch(() => '');
                throw new Error(
                    `O Micro-serviço retornou HTTP ${response.status} - ${errorBody}`,
                );
            }

            const json = await response.json();

            if (!json.success || !json.resultImageUrl) {
                throw new Error(
                    json.error || 'Erro desconhecido ao gerar imagem no micro-serviço.',
                );
            }

            const finalImageUrl = json.resultImageUrl;

            // 4. Salva na tabela avatar_generations (MATCH EXATO COM SUA MIGRATION)
            // Empacotamos os dados variáveis dentro do JSON technical_metadata
            const metadata = {
                colors: colors || null,
                personality: personality || null,
                userReferenceImage: userReferenceImage || null,
                lastGeneratedImage: lastGeneratedImage || null,
            };

            const generationRecord = await this.prisma.avatar_generations.create({
                data: {
                    organization_id: organizationId,
                    user_prompt: prompt,
                    system_prompt: null,
                    is_realistic: is_realistic !== undefined ? is_realistic : true,
                    inspiration_image_url:
                        lastGeneratedImage || userReferenceImage || null,
                    result_image_url: finalImageUrl,
                    technical_metadata: metadata,
                    tokens_cost: tokenCost,
                },
            });

            return {
                success: true,
                data: generationRecord,
                message: 'Avatar gerado e salvo no histórico com sucesso.',
            };
        } catch (error: any) {
            this.logger.error(
                `Falha ao gerar avatar para org ${organizationId}: ${error.message}`,
            );

            // 5. Estorno Automático por falha
            await this.refundTokens(
                organizationId,
                tokenCost,
                'Estorno por falha na geração do Avatar IA',
            );

            // OBS: Como result_image_url é NOT NULL, nós NÃO criamos um registro "FAILED"
            // na tabela. Apenas estornamos e devolvemos o erro para o Front.

            throw new HttpException(
                'Falha ao gerar o avatar com a IA. Seus tokens foram estornados.',
                HttpStatus.BAD_GATEWAY,
            );
        }
    }

    // =========================================================
    // MÉTODOS AUXILIARES: TRANSAÇÕES E CONFIGURAÇÕES
    // =========================================================

    private getTokenCostForAvatar(): number {
        const raw = process.env.AVATAR_GENERATION_TOKENS_COST || '0';
        const parsed = Number.parseInt(raw, 10);
        // if (!Number.isFinite(parsed) || parsed <= 0) {
        //     throw new InternalServerErrorException(
        //         'AVATAR_GENERATION_TOKENS_COST mal configurado no ambiente.',
        //     );
        // }
        return parsed;
    }

    private async debitTokens(organizationId: string, cost: number) {
        await this.prisma.$transaction(async (tx) => {
            const wallet = await tx.wallets.findFirst({
                where: { organization_id: organizationId, status: 'ACTIVE' },
                select: { id: true },
            });

            if (!wallet) {
                throw new BadRequestException(
                    'Carteira da organização não encontrada ou inativa.',
                );
            }

            const updated = await tx.wallets.updateMany({
                where: {
                    id: wallet.id,
                    status: 'ACTIVE',
                    balance: { gte: cost as any },
                },
                data: {
                    balance: { decrement: cost as any },
                },
            });

            if (updated.count === 0) {
                throw new HttpException(
                    'Saldo de tokens insuficiente para gerar o avatar.',
                    HttpStatus.PAYMENT_REQUIRED,
                );
            }

            await tx.transactions.create({
                data: {
                    wallet_id: wallet.id,
                    amount: -cost,
                    type: 'AVATAR_GENERATION_IA',
                    description: `Geração de Avatar IA`,
                },
            });
        });
    }

    private async refundTokens(
        organizationId: string,
        amount: number,
        reason: string,
    ) {
        try {
            await this.prisma.$transaction(async (tx) => {
                const wallet = await tx.wallets.findFirst({
                    where: { organization_id: organizationId },
                    select: { id: true },
                });

                if (wallet) {
                    await tx.wallets.update({
                        where: { id: wallet.id },
                        data: { balance: { increment: amount as any } },
                    });

                    await tx.transactions.create({
                        data: {
                            wallet_id: wallet.id,
                            amount: amount,
                            type: 'REFUND_AVATAR_IA',
                            description: reason,
                        },
                    });
                }
            });
        } catch (refundError) {
            this.logger.error(
                `ERRO CRÍTICO: Falha ao estornar tokens para org ${organizationId}: ${refundError}`,
            );
        }
    }
}
