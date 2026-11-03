import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Ildiz .env'dan bitta qiymat (dev Postgres paroli kabi). */
function rootEnv(key: string): string | undefined {
  try {
    const text = readFileSync(resolve(__dirname, '../../../.env'), 'utf8');
    return new RegExp(`^${key}=(.*)$`, 'm').exec(text)?.[1]?.trim();
  } catch {
    return undefined;
  }
}

export const ADMIN = { email: 'admin@test.local', password: 'AdminPass123' };

export function testEnv(): Record<string, string> {
  const password = rootEnv('POSTGRES_PASSWORD') ?? 'ecobalance';
  return {
    NODE_ENV: 'test',
    API_LOG_LEVEL: 'silent',
    DATABASE_URL:
      process.env.TEST_DATABASE_URL ??
      `postgresql://ecobalance:${password}@localhost:5434/postgres`,
    JWT_ACCESS_SECRET: 'test-access-secret-test-access-secret-0123',
    SUPER_ADMIN_EMAIL: ADMIN.email,
    SUPER_ADMIN_PASSWORD: ADMIN.password,
  };
}
