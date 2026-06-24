import { BadRequestException, Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import crypto from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private jwt: JwtService,
  ) {}

  private getAccessExpiresIn() {
    return process.env.JWT_ACCESS_EXPIRES_IN || '15m';
  }

  private getRefreshExpiresIn() {
    return process.env.JWT_REFRESH_EXPIRES_IN || '30d';
  }

  private hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private signAccessToken(user: { id: string; organization_id: string; role: string }) {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) throw new Error('JWT_ACCESS_SECRET is not set');

    const expiresIn = this.getAccessExpiresIn();

    const options: JwtSignOptions = {
      secret,
      expiresIn: expiresIn as any, // corrige a tipagem do expiresIn
    };

    const accessToken = this.jwt.sign(
      { sub: user.id, org: user.organization_id, role: user.role },
      options,
    );

    return { accessToken, expiresIn };
  }

  private signRefreshToken(userId: string) {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) throw new Error('JWT_REFRESH_SECRET is not set');

    const expiresIn = this.getRefreshExpiresIn();

    const random = crypto.randomBytes(64).toString('hex');

    const options: JwtSignOptions = {
      secret,
      expiresIn: expiresIn as any, // ✅ corrige a tipagem do expiresIn
    };

    const refreshToken = this.jwt.sign({ sub: userId, rnd: random }, options);

    return { refreshToken, expiresIn };
  }

  private async setUserRefreshTokenHash(userId: string, refreshToken: string) {
    const refreshHash = this.hashToken(refreshToken);

    await this.prisma.users.update({
      where: { id: userId },
      data: { refresh_token: refreshHash },
    });
  }

  private async validateUserPassword(email: string, password: string) {
    const user = await this.prisma.users.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        organization_id: true,
        role: true,
        active: true,
        password_hash: true,
      },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    return { id: user.id, organization_id: user.organization_id, role: user.role };
  }

  // REGISTER: cria user/org/wallet (via UsersService) e devolve tokens
  async register(createUserDto: any) {
    const result = await this.usersService.register(createUserDto);

    const user = await this.prisma.users.findUnique({
      where: { id: result.user.id },
      select: { id: true, organization_id: true, role: true, active: true },
    });

    if (!user || !user.active) throw new BadRequestException('User not active');

    const { accessToken, expiresIn: accessExpiresIn } = this.signAccessToken(user);
    const { refreshToken, expiresIn: refreshExpiresIn } = this.signRefreshToken(user.id);

    await this.setUserRefreshTokenHash(user.id, refreshToken);

    return {
      ...result,
      tokens: {
        accessToken,
        refreshToken,
        accessExpiresIn,
        refreshExpiresIn,
      },
    };
  }

  // LOGIN
  async login(dto: LoginDto) {
    const user = await this.validateUserPassword(dto.email, dto.password);

    const { accessToken, expiresIn: accessExpiresIn } = this.signAccessToken(user);
    const { refreshToken, expiresIn: refreshExpiresIn } = this.signRefreshToken(user.id);

    await this.setUserRefreshTokenHash(user.id, refreshToken);

    return {
      user: { id: user.id, organizationId: user.organization_id, role: user.role },
      tokens: { accessToken, refreshToken, accessExpiresIn, refreshExpiresIn },
    };
  }

  // REFRESH (rotação)
  async refresh(dto: RefreshDto) {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) throw new Error('JWT_REFRESH_SECRET is not set');

    let payload: any;
    try {
      payload = this.jwt.verify(dto.refreshToken, { secret });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const userId = payload?.sub as string;
    if (!userId) throw new UnauthorizedException('Invalid refresh token');

    const refreshHash = this.hashToken(dto.refreshToken);

    const user = await this.prisma.users.findFirst({
      where: { id: userId, refresh_token: refreshHash, active: true },
      select: { id: true, organization_id: true, role: true },
    });

    if (!user) throw new UnauthorizedException('Refresh token not recognized');

    const { accessToken, expiresIn: accessExpiresIn } = this.signAccessToken(user);
    const { refreshToken, expiresIn: refreshExpiresIn } = this.signRefreshToken(user.id);

    await this.setUserRefreshTokenHash(user.id, refreshToken);

    return { tokens: { accessToken, refreshToken, accessExpiresIn, refreshExpiresIn } };
  }

  async me(userId: string, organizationId: string) {
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
        stripe_customer_id: true,
        created_at: true,
        updated_at: true,
      },
    }),
  ]);

  if (!user) throw new NotFoundException('User not found');
  if (!organization) throw new NotFoundException('Organization not found');

  return { user, organization };
}


  // LOGOUT
  async logout(userId: string) {
    await this.prisma.users.update({
      where: { id: userId },
      data: { refresh_token: null },
    });

    return { message: 'Logged out' };
  }
}