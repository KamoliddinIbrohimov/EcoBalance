import { createHash, randomBytes } from 'node:crypto';

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { v7 as uuidv7 } from 'uuid';

import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  iat?: number;
  exp?: number;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const REFRESH_TTL_DAYS = 7;

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async issueTokens(
    userId: string,
    email: string,
    roles: string[],
    permissions: string[],
    context: { ip?: string; userAgent?: string; familyId?: string } = {},
  ): Promise<IssuedTokens> {
    const payload: JwtPayload = { sub: userId, email, roles, permissions };

    const accessToken = await this.jwt.signAsync(payload);

    const refreshRaw = randomBytes(48).toString('base64url');
    const refreshHash = this.hash(refreshRaw);
    const familyId = context.familyId ?? uuidv7();
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        id: uuidv7(),
        userId,
        tokenHash: refreshHash,
        familyId,
        expiresAt,
        ipAddress: context.ip,
        userAgent: context.userAgent?.slice(0, 500),
      },
    });

    return {
      accessToken,
      refreshToken: `${familyId}.${refreshRaw}`,
      expiresIn: this.getAccessTtlSeconds(),
    };
  }

  /**
   * Rotate a refresh token: verifies, revokes the current one, issues a new one.
   * If the presented token has already been used (reuse detection), we revoke the whole family.
   */
  async rotateRefresh(
    presented: string,
    context: { ip?: string; userAgent?: string },
  ): Promise<IssuedTokens & { userId: string }> {
    const [familyId, raw] = presented.split('.', 2);
    if (!familyId || !raw) throw new UnauthorizedException('Invalid refresh token');

    const hash = this.hash(raw);
    const record = await this.prisma.refreshToken.findFirst({
      where: { tokenHash: hash, familyId },
      include: {
        user: { include: { roles: { include: { role: true } } } },
      },
    });

    if (!record) {
      // Presented token was never issued OR already rotated → possible reuse.
      await this.revokeFamily(familyId);
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (record.revokedAt) {
      // Bu tokenni allaqachon rotate qilingan. Concurrent /auth/refresh oqimida
      // (masalan React StrictMode double-mount yoki multi-tab) bu tabiiy hodisa.
      // Grace davri ichida — familyni bekor qilmaymiz, aktiv tokenni topib
      // qaytaramiz yoki qayta rotate qilamiz.
      const GRACE_MS = 30_000;
      const revokedAgo = Date.now() - record.revokedAt.getTime();
      if (revokedAgo <= GRACE_MS) {
        // Concurrent rotation'ning yangi tokeni hali insert bo'lmagan holati bor.
        // Shuning uchun bir necha marta polling qilamiz — max 500ms.
        const DEADLINE = Date.now() + 500;
        const findLatestActive = () =>
          this.prisma.refreshToken.findFirst({
            where: { familyId, revokedAt: null },
            include: { user: { include: { roles: { include: { role: true } } } } },
            orderBy: { createdAt: 'desc' },
          });
        let latest: Awaited<ReturnType<typeof findLatestActive>> = null;
        while (Date.now() <= DEADLINE) {
          latest = await findLatestActive();
          if (latest) break;
          await new Promise((r) => setTimeout(r, 25));
        }
        if (latest) {
          if (!latest.user.isActive) throw new UnauthorizedException('User is inactive');
          const permissions = await this.permissionsFor(latest.userId);
          const roleSlugs = latest.user.roles.map((r) => r.role.slug);
          // Reorder: yangi token yaratamiz avval, keyin eski aktivini revoke qilamiz.
          // Shu tariqa parallel readerlar hech qachon "familyda aktiv token yo'q"
          // holatida qolmaydi.
          const tokens = await this.issueTokens(
            latest.userId,
            latest.user.email,
            roleSlugs,
            permissions,
            { ...context, familyId },
          );
          await this.prisma.refreshToken.update({
            where: { id: latest.id },
            data: { revokedAt: new Date() },
          });
          return { ...tokens, userId: latest.userId };
        }
      }
      // Grace-period tashqarisida — haqiqiy reuse deb hisoblaymiz.
      this.logger.warn(
        `Refresh reuse detected for family=${familyId} user=${record.userId} — revoking family`,
      );
      await this.revokeFamily(familyId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    if (!record.user.isActive) {
      throw new UnauthorizedException('User is inactive');
    }

    const permissions = await this.permissionsFor(record.userId);
    const roleSlugs = record.user.roles.map((r) => r.role.slug);

    // Reorder: yangi tokenni AVVAL yaratamiz, keyin eskisini revoke qilamiz.
    // Shu tariqa concurrent /auth/refresh oqimida hech qachon "familyda hech
    // qanday aktiv token yo'q" holati yuz bermaydi — false-positive "reuse
    // detected" oldi olinadi.
    const tokens = await this.issueTokens(
      record.userId,
      record.user.email,
      roleSlugs,
      permissions,
      { ...context, familyId },
    );

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    return { ...tokens, userId: record.userId };
  }

  async revokeByRaw(presented: string): Promise<void> {
    const [familyId, raw] = presented.split('.', 2);
    if (!familyId || !raw) return;
    const hash = this.hash(raw);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hash, familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  getRefreshCookieOptions() {
    // NOTE: path is intentionally '/' so that Next.js edge middleware can detect
    // its presence and gate protected routes. The cookie remains httpOnly + Secure
    // + SameSite=Lax, so it is still opaque to JS and safe against CSRF from other origins.
    return {
      httpOnly: true,
      secure: this.config.get<boolean>('COOKIE_SECURE', false),
      sameSite: 'lax' as const,
      domain: this.config.get<string>('COOKIE_DOMAIN', 'localhost'),
      path: '/',
      maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
    };
  }

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private getAccessTtlSeconds(): number {
    const raw = this.config.get<string>('JWT_ACCESS_TTL', '15m');
    const match = /^(\d+)([smhd])$/.exec(raw);
    if (!match) return 900;
    const [, n, unit] = match;
    const value = Number(n);
    const mul = { s: 1, m: 60, h: 3600, d: 86400 }[unit as 's' | 'm' | 'h' | 'd']!;
    return value * mul;
  }

  private async permissionsFor(userId: string): Promise<string[]> {
    const rows = await this.prisma.rolePermission.findMany({
      where: { role: { users: { some: { userId } } } },
      include: { permission: true },
    });
    return Array.from(new Set(rows.map((r) => r.permission.slug)));
  }
}
