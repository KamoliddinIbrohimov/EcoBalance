import { execSync } from 'node:child_process';

import { PrismaClient } from '@prisma/client';
import type { GlobalSetupContext } from 'vitest/node';

import { testEnv } from './env';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/**
 * Har run uchun alohida, yangi baza: migratsiyalar + seed. Mavjud bazalarga
 * tegilmaydi; teardown faqat shu run yaratgan bazani o'chiradi.
 */
export default async function setup({ provide }: GlobalSetupContext) {
  const base = new URL(testEnv().DATABASE_URL);
  const dbName = `ecobalance_test_${Date.now()}`;
  const admin = new URL(base);
  admin.pathname = '/postgres';
  const target = new URL(base);
  target.pathname = `/${dbName}`;

  const server = new PrismaClient({ datasourceUrl: admin.toString() });
  await server.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);

  const env = { ...process.env, ...testEnv(), DATABASE_URL: target.toString() };
  execSync('npx prisma migrate deploy', { cwd: `${__dirname}/..`, env, stdio: 'pipe' });
  execSync('npx prisma db seed', { cwd: `${__dirname}/..`, env, stdio: 'pipe' });
  provide('databaseUrl', target.toString());

  return async () => {
    await server.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await server.$disconnect();
  };
}
