import { Inject } from '@nestjs/common';
import { z } from 'zod';

// Eski API har qanday satrni qabul qilardi — prod .env buzilmasligi uchun shu qoida.
const bool = z
  .string()
  .default('false')
  .transform((v) => ['true', '1', 'yes'].includes(v.trim().toLowerCase()));

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DATABASE_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET kamida 32 belgi'),
  // '15m', '1h' yoki birliksiz soniya ('900').
  JWT_ACCESS_TTL: z.string().trim().regex(/^\d+[smhd]?$/).default('15m'),

  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: bool,
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost'),

  RATE_LIMIT_DEFAULT: z.coerce.number().int().positive().default(300),

  S3_ENDPOINT: z.string().min(1).default('http://minio:9000'),
  S3_PUBLIC_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().default('ecobalance'),
  S3_SECRET_KEY: z.string().default('ecobalance'),
  S3_BUCKET_PRIVATE: z.string().default('ecobalance-private'),
  S3_BUCKET_PUBLIC: z.string().default('ecobalance-public'),
  /** Public bucket fayllari shu origin orqali (Caddy/nginx proksi) beriladi. */
  PUBLIC_ASSET_ORIGIN: z.string().default('http://localhost:8080'),

  AI_PROVIDER: z.enum(['anthropic', 'gemini']).default('anthropic'),
  AI_MODEL: z.string().default('claude-sonnet-4-5'),
  AI_MAX_TOKENS: z.coerce.number().int().positive().default(1024),
  AI_SYSTEM_PROMPT: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),

  SUPER_ADMIN_EMAIL: z.string().email().default('admin@eco-balance.uz'),
  SUPER_ADMIN_PASSWORD: z.string().min(10).default('ChangeMe!2026'),
  SUPER_ADMIN_FIRST_NAME: z.string().default('Bosh'),
  SUPER_ADMIN_LAST_NAME: z.string().default('Administrator'),
});

export type Env = z.infer<typeof envSchema>;

export const ENV = Symbol('ENV');
export const InjectEnv = () => Inject(ENV);

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Env noto'g'ri sozlangan:\n${lines.join('\n')}`);
  }
  return parsed.data;
}

export function accessTtlSeconds(env: Env): number {
  const [, n, unit = 's'] = /^(\d+)([smhd])?$/.exec(env.JWT_ACCESS_TTL)!;
  return Number(n) * { s: 1, m: 60, h: 3600, d: 86400 }[unit as 's' | 'm' | 'h' | 'd'];
}
