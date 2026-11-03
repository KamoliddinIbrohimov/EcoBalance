import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { ValidationError } from './zod.pipe';

/** RFC 7807 — web klient `title` maydoni bor body'ni muammo deb taniydi. */
export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: Record<string, string[]>;
}

const BODY_PARSER_TITLES: Record<string, string> = {
  'entity.too.large': 'So‘rov tanasi juda katta',
  'entity.parse.failed': 'JSON noto‘g‘ri formatda',
};

@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger('Http');
  private readonly exposeInternals = process.env.NODE_ENV === 'development';

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const problem = { ...this.toProblem(exception), instance: req.originalUrl };
    if (problem.status >= 500) {
      this.logger.error({ err: exception, method: req.method, url: req.originalUrl }, problem.title);
    }
    res.status(problem.status).type('application/problem+json').json(problem);
  }

  private toProblem(exception: unknown): Problem {
    if (exception instanceof ValidationError) {
      const errors: Record<string, string[]> = {};
      for (const issue of exception.issues) {
        (errors[issue.path.join('.') || '_'] ??= []).push(issue.message);
      }
      const first = exception.issues[0];
      return {
        type: 'about:blank#validation',
        title: first ? `Ma'lumot noto‘g‘ri: ${first.message}` : 'Ma’lumot noto‘g‘ri',
        status: 422,
        errors,
      };
    }

    if (exception instanceof ThrottlerException) {
      return { type: 'about:blank#429', title: 'Juda ko‘p so‘rov. Birozdan so‘ng urinib ko‘ring', status: 429 };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status >= 500 && !this.exposeInternals) {
        return { type: `about:blank#${status}`, title: 'Server xatosi', status };
      }
      // Multer limiti inglizcha "File too large" qaytaradi.
      if (status === 413) {
        return { type: 'about:blank#413', title: 'Fayl hajmi ruxsat etilganidan katta', status };
      }
      const body = exception.getResponse();
      const message =
        typeof body === 'string' ? body : (body as { message?: string | string[] }).message;
      const title = Array.isArray(message) ? message.join('; ') : (message ?? exception.message);
      return { type: `about:blank#${status}`, title, status };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2025') {
        return { type: 'about:blank#404', title: 'Topilmadi', status: 404 };
      }
      if (exception.code === 'P2002') {
        return { type: 'about:blank#409', title: 'Bunday yozuv allaqachon mavjud', status: 409 };
      }
    }

    // body-parser xatolari HttpException emas, `status` maydoni bilan keladi.
    const raw = exception as { status?: unknown; type?: unknown } | null;
    if (raw && typeof raw.status === 'number' && raw.status >= 400 && raw.status < 500) {
      const title = BODY_PARSER_TITLES[String(raw.type)] ?? 'So‘rov noto‘g‘ri';
      return { type: `about:blank#${raw.status}`, title, status: raw.status };
    }

    return {
      type: 'about:blank#500',
      title: 'Server xatosi',
      status: 500,
      detail: this.exposeInternals && exception instanceof Error ? exception.message : undefined,
    };
  }
}
