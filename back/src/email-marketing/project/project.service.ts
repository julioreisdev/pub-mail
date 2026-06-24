import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEmailProjectDto } from './dto/create-email-project.dto';
import { UpdateEmailProjectDto } from './dto/update-email-project.dto';

@Injectable()
export class EmailProjectsService {
  constructor(private prisma: PrismaService) { }

  private readonly projectSelect = {
    id: true,
    organization_id: true,
    name: true,
    active: true, // novo
    settings: true,
    created_at: true,
  };

  /**
   * 🛡️ Regra de Negócio: Validação de segurança do domínio no Settings
   */
  private async validateSettingsDomain(organizationId: string, settings: any) {
    if (!settings || !settings.sender) return;

    const { domain_id, fromEmail } = settings.sender;

    if (!domain_id || !fromEmail) {
      throw new BadRequestException(
        'Os campos domain_id e fromEmail são obrigatórios na configuração do remetente.',
      );
    }

    // 1. Busca o domínio no banco garantindo que pertence à organização logada
    const domainRecord = await this.prisma.organization_domains.findFirst({
      where: { id: domain_id, organization_id: organizationId },
    });

    if (!domainRecord) {
      throw new BadRequestException(
        'O domínio selecionado não foi encontrado ou não pertence a esta organização.',
      );
    }

    // 2. Checa se já está verificado
    if (domainRecord.status !== 'VERIFIED') {
      throw new BadRequestException(
        'Não é possível usar um domínio que ainda não foi verificado.',
      );
    }

    // 3. Checa se o fromEmail bate com o domínio real (evita spoofing)
    const expectedSuffix = `@${domainRecord.domain}`;
    if (!fromEmail.endsWith(expectedSuffix)) {
      throw new BadRequestException(
        `O e-mail do remetente (${fromEmail}) deve obrigatoriamente terminar com o domínio verificado (${expectedSuffix}).`,
      );
    }
  }

  async create(organizationId: string, dto: CreateEmailProjectDto) {
    // 👇 Chama o "segurança" antes de fazer qualquer coisa
    if (dto.settings) {
      await this.validateSettingsDomain(organizationId, dto.settings);
    }

    return this.prisma.email_projects.create({
      data: {
        organization_id: organizationId,
        name: dto.name.trim(),
        settings: dto.settings ?? null,
      },
      select: this.projectSelect,
    });
  }

  // lista só os ativos (padrão SaaS)
  findAll(organizationId: string) {
    return this.prisma.email_projects.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
      select: this.projectSelect,
    });
  }

  // por padrão, não retorna projetos desativados
  async findOne(organizationId: string, id: string) {
    const project = await this.prisma.email_projects.findFirst({
      where: { id, organization_id: organizationId, active: true },
      select: this.projectSelect,
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async update(organizationId: string, id: string, dto: UpdateEmailProjectDto) {
    const exists = await this.prisma.email_projects.findFirst({
      where: { id, organization_id: organizationId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Project not found');

    // 👇 Chama o "segurança" também na atualização
    if (dto.settings) {
      await this.validateSettingsDomain(organizationId, dto.settings);
    }

    return this.prisma.email_projects.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.settings !== undefined ? { settings: dto.settings } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}), // novo
      },
      select: this.projectSelect,
    });
  }

  // soft delete (não remove do banco)
  async remove(organizationId: string, id: string) {
    const exists = await this.prisma.email_projects.findFirst({
      where: { id, organization_id: organizationId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Project not found');

    await this.prisma.email_projects.delete({
      where: { id },
    });

    return { message: 'Project disabled' };
  }
}
