/**
 * End-to-end auth flow tests.
 *
 * Requires a running Postgres reachable via DATABASE_URL.
 * Run inside docker: `docker compose exec api pnpm test`.
 * The tests wipe and reseed the database between runs — do NOT run against production data.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ResponseTransformInterceptor } from '../src/common/interceptors/response-transform.interceptor';
import { PrismaService } from '../src/modules/prisma/prisma.service';

const strongPassword = 'ValidPass!2026';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.enableVersioning({ type: 1 as never, defaultVersion: '1' });
    app.useGlobalPipes(new ZodValidationPipe());
    app.useGlobalInterceptors(new ResponseTransformInterceptor());
    app.useGlobalFilters(new GlobalExceptionFilter());

    await app.init();

    prisma = app.get(PrismaService);

    await prisma.user.deleteMany({ where: { email: { contains: '@test.eco-balance.uz' } } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: '@test.eco-balance.uz' } } });
    await app.close();
  });

  const uniqueEmail = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.eco-balance.uz`;

  it('POST /auth/register — 201 with valid payload', async () => {
    const email = uniqueEmail();
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        firstName: 'Ali',
        lastName: 'Valiyev',
        email,
        password: strongPassword,
        confirmPassword: strongPassword,
      })
      .expect(201);

    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.tokenType).toBe('Bearer');
    const rawCookies = res.headers['set-cookie'];
    const cookies = Array.isArray(rawCookies) ? rawCookies : rawCookies ? [rawCookies] : [];
    expect(cookies.some((c) => c.startsWith('refresh_token='))).toBe(true);
  });

  it('POST /auth/register — 422 when password is weak', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        firstName: 'Ali',
        lastName: 'Valiyev',
        email: uniqueEmail(),
        password: 'weak',
        confirmPassword: 'weak',
      })
      .expect(422);

    expect(res.body.status).toBe(422);
    expect(res.body.errors).toBeDefined();
  });

  it('POST /auth/register — 409 when email already exists', async () => {
    const email = uniqueEmail();
    const payload = {
      firstName: 'Ali',
      lastName: 'Valiyev',
      email,
      password: strongPassword,
      confirmPassword: strongPassword,
    };
    await request(app.getHttpServer()).post('/api/v1/auth/register').send(payload).expect(201);
    await request(app.getHttpServer()).post('/api/v1/auth/register').send(payload).expect(409);
  });

  it('POST /auth/login — 200 with correct credentials', async () => {
    const email = uniqueEmail();
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        firstName: 'Dilfuza',
        lastName: 'Makhmudova',
        email,
        password: strongPassword,
        confirmPassword: strongPassword,
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: strongPassword })
      .expect(200);

    expect(res.body.data.accessToken).toBeDefined();
  });

  it('POST /auth/login — 401 with wrong password', async () => {
    const email = uniqueEmail();
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        firstName: 'X',
        lastName: 'Y',
        email,
        password: strongPassword,
        confirmPassword: strongPassword,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'WrongPass!2026' })
      .expect(401);
  });

  it('GET /auth/me — 200 with bearer token', async () => {
    const email = uniqueEmail();
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        firstName: 'Kamoliddin',
        lastName: 'Tester',
        email,
        password: strongPassword,
        confirmPassword: strongPassword,
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${reg.body.data.accessToken}`)
      .expect(200);

    expect(res.body.data.email).toBe(email);
    expect(res.body.data.roles).toContain('CITIZEN');
    expect(res.body.data.permissions).toContain('notifications.read.own');
  });

  it('GET /auth/me — 401 without token', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('POST /auth/refresh — 200 with valid refresh cookie', async () => {
    const email = uniqueEmail();
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        firstName: 'Refresh',
        lastName: 'Test',
        email,
        password: strongPassword,
        confirmPassword: strongPassword,
      })
      .expect(201);

    const cookie = reg.headers['set-cookie']!;
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body.data.accessToken).toBeDefined();
  });

  it('POST /auth/refresh — 401 when no cookie', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/refresh').expect(401);
  });

  it('POST /auth/forgot-password — 200 (does not leak account existence)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody@test.eco-balance.uz' })
      .expect(200);

    expect(res.body.data.ok).toBe(true);
  });
});
