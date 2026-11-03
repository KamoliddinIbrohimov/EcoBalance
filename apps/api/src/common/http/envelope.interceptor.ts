import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map } from 'rxjs/operators';

const RAW_RESPONSE = 'rawResponse';

/** Javobni `{data}` ichiga o'ramaslik (web klient o'ramsiz kutgan joylar uchun). */
export const RawResponse = () => SetMetadata(RAW_RESPONSE, true);

/**
 * Har 2xx javob `{data: ...}` ko'rinishida. Sahifalangan ro'yxatlar allaqachon
 * `{data, meta}` bo'lib keladi — ular qayta o'ralmaydi.
 */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(ctx: ExecutionContext, next: CallHandler) {
    const raw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    return next.handle().pipe(
      map((body: unknown) => {
        if (raw) return body;
        if (body !== null && typeof body === 'object' && 'data' in body) return body;
        return { data: body ?? null };
      }),
    );
  }
}
