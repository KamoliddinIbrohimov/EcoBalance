import { Module, RequestMethod } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { EnvelopeInterceptor } from './common/http/envelope.interceptor';
import { AppThrottlerGuard } from './common/http/throttler.guard';
import { ProblemFilter } from './common/http/problem.filter';
import { InfraModule } from './infra/infra.module';
import { AuthGuard } from './modules/auth/auth.guard';
import { AuthModule } from './modules/auth/auth.module';
import { HealthController } from './modules/health/health.controller';
import { ChatbotModule } from './modules/chatbot/chatbot.module';
import { CoursesModule } from './modules/courses/courses.module';
import { GroupsModule } from './modules/groups/groups.module';
import { LearningModule } from './modules/learning/learning.module';
import { PlatformModule } from './modules/platform/platform.module';
import { QuizzesModule } from './modules/quizzes/quizzes.module';
import { UsersModule } from './modules/users/users.module';

const dev = process.env.NODE_ENV === 'development';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.API_LOG_LEVEL ?? 'info',
        transport: dev ? { target: 'pino-pretty', options: { singleLine: true } } : undefined,
        redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
        autoLogging: { ignore: (req) => req.url === '/api/v1/health' },
        // Har so'rovda butun header'larni yozish shovqin — faqat kerakli qism.
        serializers: {
          req: (req: { id: unknown; method: string; url: string }) => ({ id: req.id, method: req.method, url: req.url }),
          res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
        },
      },
      // Nest 11 (path-to-regexp v8) sintaksisi — eski '*' ogohlantirish beradi.
      forRoutes: [{ path: '{*path}', method: RequestMethod.ALL }],
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'default', ttl: 60_000, limit: Number(process.env.RATE_LIMIT_DEFAULT ?? 300) },
      ],
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    InfraModule,
    AuthModule,
    UsersModule,
    CoursesModule,
    GroupsModule,
    QuizzesModule,
    LearningModule,
    PlatformModule,
    ChatbotModule,
  ],
  controllers: [HealthController],
  providers: [
    // Tartib muhim: avval rate-limit, keyin autentifikatsiya.
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    { provide: APP_FILTER, useClass: ProblemFilter },
  ],
})
export class AppModule {}
