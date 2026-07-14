import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: Record<string, string[]>;
  traceId?: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const problem = this.toProblem(exception, request);

    if (problem.status >= 500) {
      this.logger.error(
        { err: exception, path: request.url, method: request.method },
        problem.title,
      );
    }

    response
      .status(problem.status)
      .type('application/problem+json')
      .json(problem);
  }

  private toProblem(exception: unknown, req: Request): ProblemDetails {
    const instance = req.url;
    const traceId = (req.headers['x-request-id'] as string | undefined) ?? undefined;

    if (exception instanceof ZodError) {
      const errors: Record<string, string[]> = {};
      for (const issue of exception.issues) {
        const key = issue.path.join('.') || '_';
        (errors[key] ??= []).push(issue.message);
      }
      return {
        type: 'https://eco-balance.uz/errors/validation',
        title: 'Validation failed',
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors,
        instance,
        traceId,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const detail =
        typeof res === 'string'
          ? res
          : ((res as Record<string, unknown>).message as string | string[] | undefined);
      return {
        type: `https://eco-balance.uz/errors/${status}`,
        title: exception.message,
        status,
        detail: Array.isArray(detail) ? detail.join('; ') : detail,
        instance,
        traceId,
      };
    }

    return {
      type: 'https://eco-balance.uz/errors/internal',
      title: 'Internal Server Error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail:
        process.env.NODE_ENV === 'development' && exception instanceof Error
          ? exception.message
          : undefined,
      instance,
      traceId,
    };
  }
}
