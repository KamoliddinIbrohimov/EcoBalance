import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { envSchema } from './config/env.validation';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { ChatbotModule } from './modules/chatbot/chatbot.module';
import { CoursesModule } from './modules/courses/courses.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { EcoReportsModule } from './modules/eco-reports/eco-reports.module';
import { EducationLevelsModule } from './modules/education-levels/education-levels.module';
import { HealthModule } from './modules/health/health.module';
import { NewsModule } from './modules/news/news.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { PlatformSettingsModule } from './modules/platform-settings/platform-settings.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RolesModule } from './modules/roles/roles.module';
import { StorageModule } from './modules/storage/storage.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => envSchema.parse(config),
      envFilePath: ['../../.env', '.env'],
    }),

    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.API_LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV === 'development'
            ? {
                target: 'pino-pretty',
                options: {
                  singleLine: true,
                  translateTime: 'SYS:HH:MM:ss.l',
                  ignore: 'pid,hostname,req.headers,res.headers',
                },
              }
            : undefined,
        redact: ['req.headers.authorization', 'req.headers.cookie', '*.password'],
      },
    }),

    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: Number(process.env.RATE_LIMIT_DEFAULT ?? 60),
      },
      {
        name: 'chatbot',
        ttl: 60_000,
        limit: Number(process.env.RATE_LIMIT_CHATBOT ?? 20),
      },
    ]),

    ScheduleModule.forRoot(),

    PrismaModule,
    StorageModule,
    HealthModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    RolesModule,
    CoursesModule,
    EducationLevelsModule,
    EcoReportsModule,
    AnalyticsModule,
    NotificationsModule,
    NewsModule,
    PlatformSettingsModule,
    ChatbotModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
