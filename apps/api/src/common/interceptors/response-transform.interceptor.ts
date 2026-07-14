import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface EnvelopedResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

@Injectable()
export class ResponseTransformInterceptor<T = unknown>
  implements NestInterceptor<T, EnvelopedResponse<T> | T>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<EnvelopedResponse<T> | T> {
    return next.handle().pipe(
      map((body) => {
        // Do not double-wrap already-enveloped responses or non-JSON payloads.
        if (
          body !== null &&
          typeof body === 'object' &&
          'data' in (body as Record<string, unknown>)
        ) {
          return body;
        }
        return { data: body } as EnvelopedResponse<T>;
      }),
    );
  }
}
