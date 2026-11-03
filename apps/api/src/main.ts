import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { loadEnv } from './config/env';

/** HTTP ilovani sozlaydi — main va e2e testlar bir xil konfiguratsiyadan foydalanadi. */
export function configureApp(app: NestExpressApplication) {
  const env = loadEnv();
  app.set('trust proxy', 1);
  app.setGlobalPrefix('api/v1');
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '1mb' });
  app.use(cookieParser());
  // CSP, X-Frame va nosniff'ni Caddy qo'yadi.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      frameguard: false,
      noSniff: false,
    }),
  );
  app.enableCors({
    origin: env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
    credentials: true,
  });
  app.enableShutdownHooks();
  return env;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const env = configureApp(app);
  await app.listen(env.API_PORT, '0.0.0.0');
  app.get(Logger).log(`API: http://0.0.0.0:${env.API_PORT}/api/v1`);
}

if (require.main === module) void bootstrap();
