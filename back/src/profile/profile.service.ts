import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService) {}

  async getMe(userId: string, organizationId: string) {
    const [user, organization] = await this.prisma.$transaction([
      this.prisma.users.findFirst({
        where: { id: userId, organization_id: organizationId, active: true },
        select: {
          id: true,
          organization_id: true,
          name: true,
          email: true,
          role: true,
          active: true,
        },
      }),
      this.prisma.organizations.findUnique({
        where: { id: organizationId },
        select: {
          id: true,
          name: true,
          document_id: true,
          status: true,
          stripe_customer_id: true, // ✅ requisito
          created_at: true,
          updated_at: true,
        },
      }),
    ]);

    if (!user) throw new NotFoundException('User not found');
    if (!organization) throw new NotFoundException('Organization not found');

    return { user, organization };
  }
}