import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_ENV: z.string().default('local'),
  APP_TIMEZONE: z.string().default('Asia/Tashkent'),

  API_PORT: z.coerce.number().int().positive().default(4000),
  API_LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().url(),

  REDIS_URL: z.string().url().default('redis://redis:6379'),
  REDIS_CACHE_DB: z.coerce.number().int().min(0).max(15).default(0),
  REDIS_QUEUE_DB: z.coerce.number().int().min(0).max(15).default(1),
  REDIS_SESSION_DB: z.coerce.number().int().min(0).max(15).default(2),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost'),

  MAIL_HOST: z.string().default('mailpit'),
  MAIL_PORT: z.coerce.number().int().default(1025),
  MAIL_USER: z.string().optional(),
  MAIL_PASSWORD: z.string().optional(),
  MAIL_FROM_ADDRESS: z.string().email().default('no-reply@eco-balance.uz'),
  MAIL_FROM_NAME: z.string().default('Eco-Balance Platformasi'),

  RATE_LIMIT_DEFAULT: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_AUTH: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_FORGOT_PASSWORD: z.coerce.number().int().positive().default(3),

  SENTRY_DSN: z.string().optional(),

  SUPER_ADMIN_EMAIL: z.string().email().default('admin@eco-balance.uz'),
  SUPER_ADMIN_PASSWORD: z.string().min(10).default('ChangeMe!2026'),
  SUPER_ADMIN_FIRST_NAME: z.string().default('Bosh'),
  SUPER_ADMIN_LAST_NAME: z.string().default('Administrator'),
});

export type Env = z.infer<typeof envSchema>;
