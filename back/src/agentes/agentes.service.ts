import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgenteDto } from './dto/create-agente.dto';
import { UpdateAgenteDto } from './dto/update-agente.dto';

@Injectable()
export class AgentesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateAgenteDto) {
    return this.prisma.agentes_ia.create({
      data: {
        organization_id: organizationId,
        name: dto.name,
        description: dto.description ?? null,
        ia_config: dto.ia_config as any,
        active: dto.active ?? true,
      },
    });
  }

  async list(organizationId: string) {
    return this.prisma.agentes_ia.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const agente = await this.prisma.agentes_ia.findFirst({
      where: { id, organization_id: organizationId },
    });

    if (!agente) throw new NotFoundException('Agente não encontrado.');
    return agente;
  }

  async update(organizationId: string, id: string, dto: UpdateAgenteDto) {
    await this.findOne(organizationId, id);

    return this.prisma.agentes_ia.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.ia_config !== undefined ? { ia_config: dto.ia_config as any } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
  }

  async remove(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    try {
      await this.prisma.agentes_ia.delete({ where: { id } });
    } catch (error: any) {
      if (error?.code === 'P2003') {
        throw new BadRequestException(
          'Não é possível excluir este agente porque ele está vinculado a um webchat.',
        );
      }
      throw error;
    }
    return { success: true, message: 'Agente removido com sucesso.' };
  }
}
