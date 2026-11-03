import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { CookieOptions } from 'express';

import { type Env, InjectEnv, accessTtlSeconds } from '../../config/env';
import { PrismaService } from '../../infra/prisma.service';

export const REFRESH_COOKIE = 'refresh_token';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Parallel refresh (bir nechta tab, StrictMode) — bu oraliqda qayta ishlatish hujum hisoblanmaydi. */
const REUSE_GRACE_MS = 30_000;
const JWT_OPTS = { issuer: 'eco-balance-api', audience: 'eco-balance-web' };

export interface AccessPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface SessionInfo {
  ip?: string;
  userAgent?: string;
}

const sha256 = (raw: string) => createHash('sha256').update(raw).digest('hex');

/**
 * Access — 15 daqiqalik JWT. Refresh — `familyId.random` ko'rinishidagi
 * opaque token; DB'da faqat hash saqlanadi, har ishlatilganda almashadi.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    @InjectEnv() private readonly env: Env,
  ) {}

  async verifyAccess(token: string): Promise<AccessPayload> {
    try {
      return await this.jwt.verifyAsync<AccessPayload>(token, JWT_OPTS);
    } catch {
      throw new UnauthorizedException('Token yaroqsiz yoki muddati o‘tgan');
    }
  }

  async issue(
    payload: AccessPayload,
    session: SessionInfo,
    familyId: string = randomUUID(),
    db: Pick<PrismaService, 'refreshToken'> = this.prisma,
  ): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(payload, {
      ...JWT_OPTS,
      expiresIn: accessTtlSeconds(this.env),
    });
    const raw = randomBytes(48).toString('base64url');
    await db.refreshToken.create({
      data: {
        userId: payload.sub,
        tokenHash: sha256(raw),
        familyId,
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        ipAddress: session.ip?.slice(0, 45),
        userAgent: session.userAgent?.slice(0, 500),
      },
    });
    return {
      accessToken,
      refreshToken: `${familyId}.${raw}`,
      expiresIn: accessTtlSeconds(this.env),
    };
  }

  /** Refresh token egasini aniqlaydi (yaroqsiz yoki muddati o'tgan bo'lsa 401). */
  async ownerOf(presented: string) {
    const [familyId, raw] = presented.split('.', 2);
    if (!familyId || !raw) throw new UnauthorizedException('Refresh token yaroqsiz');
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(raw) },
      select: { id: true, userId: true, familyId: true, revokedAt: true, expiresAt: true },
    });
    if (!record || record.familyId !== familyId) throw new UnauthorizedException('Refresh token yaroqsiz');
    if (record.expiresAt < new Date()) throw new UnauthorizedException('Sessiya muddati tugagan');
    return record;
  }

  /**
   * Tokenni almashtiradi. "Egallash" va yangi tokenni yozish bitta
   * tranzaksiyada: parallel so'rov qulf bo'shagach yangi tokenni ko'radi.
   * Grace oralig'ida oila tirik bo'lsa qayta ishlatish ruxsat etiladi;
   * aks holda (logout, parol almashgan, eski o'g'irlangan token) — 401.
   */
  async rotate(
    record: Awaited<ReturnType<TokenService['ownerOf']>>,
    payload: AccessPayload,
    session: SessionInfo,
  ): Promise<TokenPair> {
    const { familyId } = record;
    const pair = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.refreshToken.updateMany({
        where: { id: record.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (claimed.count === 0) {
        const age = Date.now() - (record.revokedAt?.getTime() ?? Date.now());
        const alive = await tx.refreshToken.count({
          where: { familyId, revokedAt: null, expiresAt: { gt: new Date() } },
        });
        if (age > REUSE_GRACE_MS || !alive) return null;
      }
      return this.issue(payload, session, familyId, tx);
    });
    if (!pair) {
      this.logger.warn(`Refresh reuse: family=${familyId} user=${record.userId}`);
      await this.revokeFamily(familyId);
      throw new UnauthorizedException('Sessiya bekor qilingan, qaytadan kiring');
    }
    return pair;
  }

  /** Taqdim etilgan token egasini qaytaradi va uning oilasini bekor qiladi. */
  async revokeByToken(presented: string | undefined): Promise<string | null> {
    const [familyId, raw] = (presented ?? '').split('.', 2);
    if (!familyId || !raw) return null;
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(raw) },
      select: { userId: true, familyId: true },
    });
    if (!record || record.familyId !== familyId) return null;
    await this.revokeFamily(familyId);
    return record.userId;
  }

  async revokeFamily(familyId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Cookie path '/' — Next.js middleware cookie borligiga qarab sahifalarni
   * himoyalaydi. httpOnly + SameSite=Lax.
   */
  cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.env.COOKIE_SECURE,
      sameSite: 'lax',
      domain: this.env.COOKIE_DOMAIN,
      path: '/',
      maxAge: REFRESH_TTL_MS,
    };
  }
}
