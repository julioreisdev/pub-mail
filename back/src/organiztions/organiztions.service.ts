import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateOrganiztionDto } from './dto/update-organiztion.dto';

function isPrismaUniqueError(e: any) {
  return e?.code === 'P2002';
}

function prismaUniqueTargets(e: any): string[] {
  const t = e?.meta?.target;
  if (Array.isArray(t)) return t.map(String);
  if (typeof t === 'string') return [t];
  return [];
}

@Injectable()
export class OrganiztionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMyOrganization(organizationId: string) {
    const org = await this.prisma.organizations.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        document_id: true,
        status: true,
        stripe_customer_id: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async updateMyOrganization(organizationId: string, dto: UpdateOrganiztionDto) {
    const exists = await this.prisma.organizations.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Organization not found');

    try {
      return await this.prisma.organizations.update({
        where: { id: organizationId },
        data: { ...dto },
        select: {
          id: true,
          name: true,
          document_id: true,
          status: true,
          stripe_customer_id: true,
          created_at: true,
          updated_at: true,
        },
      });
    } catch (e: any) {
      if (isPrismaUniqueError(e)) {
        const targets = prismaUniqueTargets(e);
        if (targets.includes('document_id')) {
          throw new BadRequestException('Document already registered');
        }
        throw new BadRequestException('Unique constraint violation');
      }
      throw e;
    }
  }

  async disableMyOrganization(organizationId: string) {
    const exists = await this.prisma.organizations.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Organization not found');

    return this.prisma.organizations.update({
      where: { id: organizationId },
      data: { status: false },
      select: {
        id: true,
        name: true,
        document_id: true,
        status: true,
        stripe_customer_id: true,
        created_at: true,
        updated_at: true,
      },
    });
  }
}