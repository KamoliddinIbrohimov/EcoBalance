import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch } from '@nestjs/common';
import type { Request, Response } from 'express';

export const AI_MESSAGES = {
  notConfigured: 'AI xizmati sozlanmagan. Iltimos, administrator bilan bog‘laning.',
  badKey: 'AI kaliti noto‘g‘ri yoki ruxsat berilmagan. Administrator sozlamalarni tekshirsin.',
  down: 'AI xizmati vaqtincha ishlamayapti, birozdan so‘ng qayta urinib ko‘ring.',
} as const;

/** AI provayderi ishlamayotgani — har doim 503, xabar o'zbekcha. */
export class AiUnavailableError extends Error {}

/**
 * Global ProblemFilter prod'da 5xx sarlavhasini yashiradi; chatbot esa
 * foydalanuvchiga aniq sababni ko'rsatishi kerak — shu sabab alohida filtr.
 */
@Catch(AiUnavailableError)
export class AiUnavailableFilter implements ExceptionFilter {
  catch(error: AiUnavailableError, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    http
      .getResponse<Response>()
      .status(503)
      .type('application/problem+json')
      .json({ type: 'about:blank#503', title: error.message, status: 503, instance: req.originalUrl });
  }
}
