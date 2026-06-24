"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IaIntegrationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const system_settings_service_1 = require("../system-settings/system-settings.service");
let IaIntegrationsService = class IaIntegrationsService {
    prisma;
    systemSettings;
    constructor(prisma, systemSettings) {
        this.prisma = prisma;
        this.systemSettings = systemSettings;
    }
    isRecord(value) {
        return typeof value === 'object' && value !== null;
    }
    parseTemplateCandidate(value) {
        if (!this.isRecord(value))
            return null;
        const subjectRaw = typeof value.subject === 'string'
            ? value.subject
            : typeof value.title === 'string'
                ? value.title
                : '';
        const htmlRaw = typeof value.html === 'string'
            ? value.html
            : typeof value.body_html === 'string'
                ? value.body_html
                : '';
        const subject = subjectRaw.trim();
        const html = htmlRaw.trim();
        if (!subject || !html)
            return null;
        return { subject, html };
    }
    normalizeTemplatePayload(payload) {
        const direct = this.parseTemplateCandidate(payload);
        if (direct)
            return direct;
        if (this.isRecord(payload)) {
            const nestedHtml = this.parseTemplateCandidate(payload.html);
            if (nestedHtml)
                return nestedHtml;
            const nestedData = this.parseTemplateCandidate(payload.data);
            if (nestedData)
                return nestedData;
        }
        throw new Error('Resposta inválida do micro-serviço de IA.');
    }
    async generateEmailTemplate(organizationId, dto) {
        const costInTokens = parseInt(process.env.EMAIL_TOKENS_FOR_ONE_TEMPLATE || '0', 10);
        const wallet = await this.prisma.wallets.findFirst({
            where: {
                organization_id: organizationId,
                status: 'ACTIVE',
            },
        });
        if (!wallet) {
            throw new common_1.HttpException('Carteira da organização não encontrada ou inativa.', common_1.HttpStatus.BAD_REQUEST);
        }
        if (Number(wallet.balance) < costInTokens) {
            throw new common_1.HttpException('Saldo de tokens insuficiente na carteira da organização para gerar o template.', common_1.HttpStatus.PAYMENT_REQUIRED);
        }
        const microserviceUrl = `${process.env.IA_SERVICE_URL}/api/ia-email-template`;
        const groqApiKeys = await this.systemSettings.getGroqApiKeysOrFail();
        let generatedTemplate;
        try {
            const response = await fetch(microserviceUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.IA_SERVICE_KEY,
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
        }
        catch (error) {
            console.error('Erro na integração com IA:', error);
            throw new common_1.HttpException('Falha ao gerar o template com a IA. Tente novamente mais tarde.', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
        try {
            await this.prisma.$transaction([
                this.prisma.wallets.update({
                    where: { id: wallet.id },
                    data: { balance: { decrement: costInTokens } },
                }),
                this.prisma.transactions.create({
                    data: {
                        wallet_id: wallet.id,
                        amount: -costInTokens,
                        type: 'IA_TEMPLATE_GENERATION',
                        description: 'Geração de Template de E-mail com IA',
                    },
                }),
            ]);
        }
        catch (error) {
            console.error('Erro ao debitar tokens da wallet:', error);
            throw new common_1.HttpException('Erro ao processar o pagamento dos tokens.', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
        return {
            success: true,
            message: 'Template gerado e tokens debitados com sucesso.',
            data: {
                subject: generatedTemplate.subject,
                body_html: generatedTemplate.html,
                html: generatedTemplate,
            },
            template: generatedTemplate,
        };
    }
};
exports.IaIntegrationsService = IaIntegrationsService;
exports.IaIntegrationsService = IaIntegrationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        system_settings_service_1.SystemSettingsService])
], IaIntegrationsService);
//# sourceMappingURL=ia-integrations.service.js.map