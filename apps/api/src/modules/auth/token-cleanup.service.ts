import type { OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { Injectable, Logger } from '@nestjs/common';

import { type Env, InjectEnv } from '../../config/env';
import { PrismaService } from '../../infra/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Har refresh yangi qator yozadi — tozalanmasa jadval cheksiz o'sadi.
 * Muddati o'tgan tokenlar va 7 kundan eski bekor qilinganlar o'chiriladi
 * (yaqinda bekor qilinganlar qayta-ishlatishni aniqlash uchun qoladi).
 */
@Injectable()
export class TokenCleanupService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(TokenCleanupService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    @InjectEnv() private readonly env: Env,
  ) {}

  onApplicationBootstrap() {
    if (this.env.NODE_ENV === 'test') return;
    void this.run();
    this.timer = setInterval(() => void this.run(), DAY_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  async run() {
    try {
      const now = new Date();
      const [tokens, resets] = await this.prisma.$transaction([
        this.prisma.refreshToken.deleteMany({
          where: { OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: new Date(now.getTime() - 7 * DAY_MS) } }] },
        }),
        this.prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } }),
      ]);
      if (tokens.count || resets.count) {
        this.logger.log(`Tozalandi: ${tokens.count} refresh, ${resets.count} parol-tiklash token`);
      }
    } catch (err) {
      this.logger.warn(`Token tozalash xatosi: ${(err as Error).message}`);
    }
  }
}
