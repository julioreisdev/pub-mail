import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

type JwtPayload = {
  sub: string;     // userId
  org: string;     // organizationId
  role: string;    // users_role
};

// Cache curto (por userId) do "ainda pode usar o sistema?" — evita 1 hit no
// banco por request mas garante que desativar usuário/org faz efeito em até
// ~60s, mesmo com access token ainda válido (A-09).
const STATUS_TTL_MS = 60_000;
type StatusEntry = { ok: boolean; expiresAt: number };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly statusCache = new Map<string, StatusEntry>();

  constructor(private readonly prisma: PrismaService) {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) throw new Error('JWT_ACCESS_SECRET is not set');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
    });
  }

  private async isStillAllowed(userId: string, organizationId: string): Promise<boolean> {
    const now = Date.now();
    const cached = this.statusCache.get(userId);
    if (cached && cached.expiresAt > now) return cached.ok;

    let ok = false;
    try {
      const user = await this.prisma.users.findFirst({
        where: { id: userId, organization_id: organizationId },
        select: { active: true, organizations: { select: { status: true } } },
      });
      ok = Boolean(user?.active) && user?.organizations?.status !== false;
    } catch {
      // Banco indisponível: não derruba quem já tem token válido.
      ok = cached ? cached.ok : true;
    }

    if (this.statusCache.size > 10_000) {
      for (const [k, v] of this.statusCache) if (v.expiresAt <= now) this.statusCache.delete(k);
    }
    this.statusCache.set(userId, { ok, expiresAt: now + STATUS_TTL_MS });
    return ok;
  }

  async validate(payload: JwtPayload) {
    if (!payload?.sub || !payload?.org) {
      throw new UnauthorizedException('Invalid token payload');
    }

    if (!(await this.isStillAllowed(payload.sub, payload.org))) {
      throw new UnauthorizedException('Usuário ou organização desativados');
    }

    // O que vai para req.user
    return {
      userId: payload.sub,
      organizationId: payload.org,
      role: payload.role,
    };
  }
}
