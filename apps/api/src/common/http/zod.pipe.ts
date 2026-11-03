import type { PipeTransform } from '@nestjs/common';
import { Body, Query } from '@nestjs/common';
import type { ZodIssue, ZodTypeAny, z } from 'zod';

/**
 * `instanceof ZodError` ishonchsiz: @eco/shared o'z zod nusxasi bilan keladi.
 * Shuning uchun validatsiya xatosi o'z klassimizda tashlanadi.
 */
export class ValidationError extends Error {
  constructor(readonly issues: ZodIssue[]) {
    super('Validation failed');
  }
}

export class ZodPipe<S extends ZodTypeAny> implements PipeTransform<unknown, z.infer<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.infer<S> {
    const result = this.schema.safeParse(value);
    if (!result.success) throw new ValidationError(result.error.issues);
    return result.data;
  }
}

export const ZBody = (schema: ZodTypeAny) => Body(new ZodPipe(schema));
export const ZQuery = (schema: ZodTypeAny) => Query(new ZodPipe(schema));
