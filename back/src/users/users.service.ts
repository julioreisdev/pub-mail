import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

import * as bcrypt from 'bcryptjs';
import { wallets_status, users_role } from 'generated/prisma/client';

function isPrismaUniqueError(e: any) {
  return e?.code === 'P2002';
}

function prismaUniqueTargets(e: any): string[] {
  const t = e?.meta?.target;
  if (Array.isArray(t)) return t.map(String);
  if (typeof t === 'string') return [t];
  return [];
}

const userSelect = {
  id: true,
  organization_id: true,
  name: true,
  email: true,
  role: true,
  active: true,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // usado pelo AuthService em /auth/register
  async register(dto: CreateUserDto) {
    const email = dto.email?.toLowerCase().trim();

    // document_id agora é opcional
    const documentId = dto.document_id?.trim();

    // Se vier como string vazia, rejeita (opcional)
    if (documentId === '') {
      throw new BadRequestException('document_id cannot be empty');
    }

    if (!email) throw new BadRequestException('email is required');
    if (!dto.password) throw new BadRequestException('password is required');
    if (!dto.organization_name?.trim())
      throw new BadRequestException('organization_name is required');
    if (!dto.name?.trim()) throw new BadRequestException('name is required');

    const userExists = await this.prisma.users.findUnique({ where: { email } });
    if (userExists) throw new BadRequestException('Email already registered');

    const password_hash = await bcrypt.hash(dto.password, 12);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const organization = await tx.organizations.create({
          data: {
            name: dto.organization_name.trim(),

            // só envia document_id se existir
            ...(documentId ? { document_id: documentId } : {}),
          },
        });

        const wallet = await tx.wallets.create({
          data: {
            organization_id: organization.id,
            balance: '0.0000',
            status: wallets_status.ACTIVE,
          },
        });

        const user = await tx.users.create({
          data: {
            organization_id: organization.id,
            name: dto.name.trim(),
            email,
            password_hash,
            role: users_role.OWNER,
            active: true,
          },
          select: userSelect,
        });

        return { user, organization, wallet };
      });
    } catch (e: any) {
      if (isPrismaUniqueError(e)) {
        const targets = prismaUniqueTargets(e);
        if (targets.includes('email'))
          throw new BadRequestException('Email already registered');
        if (targets.includes('document_id'))
          throw new BadRequestException('Document already registered');
        throw new BadRequestException('Email or document already registered');
      }
      throw e;
    }
  }

  //  GET /users (somente da org)
  async findAllByOrganization(organizationId: string) {
    return this.prisma.users.findMany({
      where: { organization_id: organizationId, active: true },
      select: userSelect,
      orderBy: { name: 'asc' },
    });
  }

  // GET /users/me
  async findMe(userId: string, organizationId: string) {
    const user = await this.prisma.users.findFirst({
      where: { id: userId, organization_id: organizationId },
      select: userSelect,
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  //  GET /users/:id (somente da org)
  async findOneInOrganization(organizationId: string, userId: string) {
    const user = await this.prisma.users.findFirst({
      where: { id: userId, organization_id: organizationId },
      select: userSelect,
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  //  PATCH /users/:id (somente da org)
  async updateInOrganization(
    organizationId: string,
    userId: string,
    dto: UpdateUserDto,
  ) {
    const exists = await this.prisma.users.findFirst({
      where: { id: userId, organization_id: organizationId },
      select: { id: true },
    });

    if (!exists) throw new NotFoundException('User not found');

    return this.prisma.users.update({
      where: { id: userId },
      data: dto,
      select: userSelect,
    });
  }

  //  DELETE /users/:id (soft delete, somente da org)
  async removeInOrganization(organizationId: string, userId: string) {
    const exists = await this.prisma.users.findFirst({
      where: { id: userId, organization_id: organizationId },
      select: { id: true },
    });

    if (!exists) throw new NotFoundException('User not found');

    return this.prisma.users.update({
      where: { id: userId },
      data: { active: false },
      select: userSelect,
    });
  }
}
