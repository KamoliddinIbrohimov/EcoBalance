import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/** JWT payload'idan `sub` (imzo tekshirilmaydi — faqat hisob kaliti uchun). */
function subjectOf(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'));
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * Rate-limit kaliti: kirgan foydalanuvchi — o'z ID'si bo'yicha, refresh —
 * sessiya (token oilasi) bo'yicha, qolgani — IP bo'yicha. Bitta NAT ortidagi
 * butun sinf IP bo'yicha bitta limitni bo'lishib 429 olmasligi uchun.
 * Soxta token bilan limitni chetlab o'tish foyda bermaydi: AuthGuard uni rad etadi.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  // Imzo ThrottlerGuard'dan meros (Record<string, any>).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected override async getTracker(req: Record<string, any>): Promise<string> {
    const auth: unknown = req.headers?.authorization;
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
      const sub = subjectOf(auth.slice(7));
      if (sub) return `user:${sub}`;
    }
    const family = String(req.cookies?.refresh_token ?? '').split('.')[0];
    if (family && String(req.url ?? '').includes('/auth/refresh')) return `session:${family}`;
    return `ip:${req.ip}`;
  }
}
