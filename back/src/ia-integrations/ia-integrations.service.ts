import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Ajuste o nível dos '../' se precisar
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { GenerateEmailTemplateDto } from './dto/generate-email-template.dto';

type UnknownRecord = Record<string, unknown>;

export interface GeneratedEmailTemplate {
    subject: string;
    html: string;
}

@Injectable()
export class IaIntegrationsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly systemSettings: SystemSettingsService,
    ) { }

    private isRecord(value: unknown): value is UnknownRecord {
        return typeof value === 'object' && value !== null;
    }

    private parseTemplateCandidate(
        value: unknown,
    ): GeneratedEmailTemplate | null {
        if (!this.isRecord(value)) return null;

        const subjectRaw =
            typeof value.subject === 'string'
                ? value.subject
                : typeof value.title === 'string'
                    ? value.title
                    : '';

        const htmlRaw =
            typeof value.html === 'string'
                ? value.html
                : typeof value.body_html === 'string'
                    ? value.body_html
                    : '';

        const subject = subjectRaw.trim();
        const html = htmlRaw.trim();

        if (!subject || !html) return null;
        return { subject, html };
    }

    private normalizeTemplatePayload(payload: unknown): GeneratedEmailTemplate {
        const direct = this.parseTemplateCandidate(payload);
        if (direct) return direct;

        if (this.isRecord(payload)) {
            const nestedHtml = this.parseTemplateCandidate(payload.html);
            if (nestedHtml) return nestedHtml;

            const nestedData = this.parseTemplateCandidate(payload.data);
            if (nestedData) return nestedData;
        }

        throw new Error('Resposta inválida do micro-serviço de IA.');
    }

    async generateEmailTemplate(
        organizationId: string,
        dto: GenerateEmailTemplateDto,
    ) {
        const costInTokens = parseInt(
            process.env.EMAIL_TOKENS_FOR_ONE_TEMPLATE || '0',
            10,
        );

        // 1. VALIDAÇÃO: Busca diretamente a carteira ativa da Organização
        const wallet = await this.prisma.wallets.findFirst({
            where: {
                organization_id: organizationId,
                status: 'ACTIVE',
            },
        });

        if (!wallet) {
            throw new HttpException(
                'Carteira da organização não encontrada ou inativa.',
                HttpStatus.BAD_REQUEST,
            );
        }

        // O Prisma retorna Decimal, converte para Number
        if (Number(wallet.balance) < costInTokens) {
            throw new HttpException(
                'Saldo de tokens insuficiente na carteira da organização para gerar o template.',
                HttpStatus.PAYMENT_REQUIRED,
            );
        }

        // 2. EXECUÇÃO: Chama o Micro-serviço de IA
        const microserviceUrl = `${process.env.IA_SERVICE_URL}/api/ia-email-template`;
        const groqApiKeys = await this.systemSettings.getGroqApiKeysOrFail(organizationId);

        let generatedTemplate: GeneratedEmailTemplate;
        try {
            const response = await fetch(microserviceUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.IA_SERVICE_KEY as string,
                },
                body: JSON.stringify({ prompt: dto.prompt, groq_api_keys: groqApiKeys }),
            });

            if (!response.ok) {
                throw new Error(`Micro-serviço retornou status ${response.status}`);
            }

            const json = await response.json();
            if (!json.success) {
                throw new Error(json.message || 'Erro desconhecido na IA.');
            }

            generatedTemplate = this.normalizeTemplatePayload(json.data);
        } catch (error) {
            console.error('Erro na integração com IA:', error);
            throw new HttpException(
                'Falha ao gerar o template com a IA. Tente novamente mais tarde.',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }

        // 3. COBRANÇA: Debita da carteira (wallet) e registra a transação atrelada a ela
        try {
            await this.prisma.$transaction([
                // Desconta o saldo da carteira
                this.prisma.wallets.update({
                    where: { id: wallet.id },
                    data: { balance: { decrement: costInTokens } },
                }),
                // Registra a transação
                this.prisma.transactions.create({
                    data: {
                        wallet_id: wallet.id,
                        amount: -costInTokens,
                        type: 'IA_TEMPLATE_GENERATION',
                        description: 'Geração de Template de E-mail com IA',
                    },
                }),
            ]);
        } catch (error) {
            console.error('Erro ao debitar tokens da wallet:', error);
            throw new HttpException(
                'Erro ao processar o pagamento dos tokens.',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }

        // 4. RETORNO: Devolve os dados para o front-end
        return {
            success: true,
            message: 'Template gerado e tokens debitados com sucesso.',
            // `data.html.subject` e `data.html.html` para manter compatibilidade com o front atual.
            data: {
                subject: generatedTemplate.subject,
                body_html: generatedTemplate.html,
                html: generatedTemplate,
            },
            // shape plano para novos consumidores.
            template: generatedTemplate,
        };
    }
}
