import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infra/prisma.service';
import { StorageService } from '../src/infra/storage.service';
import { configureApp } from '../src/main';
import { ADMIN } from './env';

/** MinIO'siz testlar uchun xotiradagi storage. */
export class FakeStorage {
  readonly files = new Map<string, Buffer>();
  async put(key: string, body: Buffer) {
    this.files.set(key, body);
  }
  async remove(key: string) {
    this.files.delete(key);
  }
  publicUrl(key: string) {
    return `http://assets.test/ecobalance-public/${key}`;
  }
  locate(url: string) {
    const m = /\/ecobalance-(public|private)\/([^?]+)/.exec(url);
    return m ? { bucket: m[1] as 'public' | 'private', key: m[2]! } : null;
  }
  async downloadUrl(key: string) {
    return `http://assets.test/ecobalance-private/${key}?signed=1`;
  }
}

export async function createApp() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(StorageService)
    .useClass(FakeStorage)
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  configureApp(app);
  await app.init();
  return { app, http: request(app.getHttpServer()), prisma: app.get(PrismaService) };
}

export type Http = Awaited<ReturnType<typeof createApp>>['http'];

export function refreshCookie(res: request.Response): string {
  const raw = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const cookie = raw.find((c) => c.startsWith('refresh_token='));
  if (!cookie) throw new Error('refresh_token cookie yo‘q');
  return cookie.split(';')[0]!;
}

export async function login(http: Http, email: string, password: string) {
  const res = await http.post('/api/v1/auth/login').send({ email, password }).expect(200);
  return { token: res.body.data.accessToken as string, cookie: refreshCookie(res), body: res.body };
}

export const loginAdmin = (http: Http) => login(http, ADMIN.email, ADMIN.password);

let seq = 0;
/** Foydalanuvchi yaratadi va vaqtinchalik parolni almashtirib, tayyor token qaytaradi. */
export async function createUser(http: Http, creatorToken: string, role: 'TEACHER' | 'STUDENT') {
  seq += 1;
  const email = `${role.toLowerCase()}${seq}-${Date.now()}@test.local`;
  const temp = 'TempPass1234';
  const res = await http
    .post('/api/v1/users')
    .set('Authorization', `Bearer ${creatorToken}`)
    .send({ firstName: 'Test', lastName: role, email, password: temp, roleSlugs: [role] })
    .expect(201);
  const session = await login(http, email, temp);
  const changed = await http
    .post('/api/v1/auth/me/change-password')
    .set('Authorization', `Bearer ${session.token}`)
    .set('Cookie', session.cookie)
    .send({ currentPassword: temp, newPassword: 'FinalPass1234', confirmPassword: 'FinalPass1234' })
    .expect(200);
  return { id: res.body.data.id as string, email, token: changed.body.accessToken as string };
}
