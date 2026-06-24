import { ConflictException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDomainDto } from './dto/create-domain.dto';
import { Resend } from 'resend';
import { SystemSettingsService } from '../system-settings/system-settings.service';

@Injectable()
export class DomainsService {
    constructor(
        private prisma: PrismaService,
        private readonly systemSettings: SystemSettingsService,
    ) { }

    private async getResend(): Promise<Resend> {
        const apiKey = await this.systemSettings.getResendApiKeyOrFail();
        return new Resend(apiKey);
    }

    async create(organizationId: string, dto: CreateDomainDto) {
        const domainStr = dto.domain.toLowerCase();

        // 1. Checa se já existe localmente
        const exists = await this.prisma.organization_domains.findFirst({
            where: { domain: domainStr, organization_id: organizationId }
        });
        if (exists) throw new ConflictException('Domínio já cadastrado na sua organização.');

        try {
            const resend = await this.getResend();
            // 2. Cria o domínio no painel oficial do Resend
            const { data, error } = await resend.domains.create({
                name: domainStr,
            });

            if (error || !data) {
                throw new BadRequestException(`Erro no provedor: ${error?.message}`);
            }

            // 3. Mapeia os registros DNS reais para o formato que o seu Frontend já espera
            const mappedRecords = data.records.map((r: any) => ({
                type: r.record,
                name: r.name,
                value: r.value,
                description: r.type || 'Configuração DNS'
            }));

            // 4. Salva no seu banco o ID do Resend e as chaves DNS
            return await this.prisma.organization_domains.create({
                data: {
                    organization_id: organizationId,
                    domain: domainStr,
                    provider_id: data.id, // O "UUID" do Resend
                    status: 'PENDING',
                    dns_records: mappedRecords,
                },
            });
        } catch (error: any) {
            throw new BadRequestException(`Falha ao registrar domínio: ${error.message}`);
        }
    }

    async list(organizationId: string) {
        return this.prisma.organization_domains.findMany({
            where: { organization_id: organizationId },
            orderBy: { created_at: 'desc' },
        });
    }

    async remove(organizationId: string, domainId: string) {
        const domain = await this.prisma.organization_domains.findFirst({
            where: { id: domainId, organization_id: organizationId },
        });

        if (!domain) throw new NotFoundException('Domínio não encontrado.');

        // Remove do Resend também para limpar sua conta
        if (domain.provider_id) {
            const resend = await this.getResend();
            await resend.domains.remove(domain.provider_id);
        }

        await this.prisma.organization_domains.delete({
            where: { id: domainId },
        });

        return { message: 'Domínio removido com sucesso' };
    }

    // 👇 A NOVA VALIDAÇÃO REAL!
    async verifyReal(organizationId: string, domainId: string) {
        const domain = await this.prisma.organization_domains.findFirst({
            where: { id: domainId, organization_id: organizationId },
        });

        if (!domain) throw new NotFoundException('Domínio não encontrado.');
        if (!domain.provider_id) throw new BadRequestException('ID do provedor ausente neste domínio.');

        try {
            const resend = await this.getResend();
            // 1. Pede pro Resend escanear o DNS do cliente
            await resend.domains.verify(domain.provider_id);

            // 2. Consulta imediatamente qual foi o resultado do escaneamento
            const { data } = await resend.domains.get(domain.provider_id);

            // 3. Analisa o status retornado pelo Resend (verified, pending, failed...)
            let newStatus = domain.status;
            if (data?.status === 'verified') {
                newStatus = 'VERIFIED';
            }

            // 4. Atualiza seu banco e devolve pro Front
            return await this.prisma.organization_domains.update({
                where: { id: domainId },
                data: { status: newStatus as any }, // Forçando cast caso use Enums do Prisma
            });
        } catch (error: any) {
            throw new BadRequestException(`Erro ao verificar: ${error.message}`);
        }
    }
}
