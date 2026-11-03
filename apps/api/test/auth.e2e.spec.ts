import type { INestApplication } from '@nestjs/common';

import { type Http, createApp, createUser, loginAdmin, refreshCookie } from './app';
import { ADMIN } from './env';

describe('auth', () => {
  let app: INestApplication;
  let http: Http;

  beforeAll(async () => {
    ({ app, http } = await createApp());
  });
  afterAll(() => app.close());

  it("noto'g'ri parol — 401 problem+json", async () => {
    const res = await http.post('/api/v1/auth/login').send({ email: ADMIN.email, password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body.title).toBe('Email yoki parol noto‘g‘ri');
  });

  it("validatsiya xatosi — 422 va maydon xatolari", async () => {
    const res = await http.post('/api/v1/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.errors)).toEqual(expect.arrayContaining(['email', 'password']));
  });

  it('login — token, httpOnly cookie va profil (web kontrakti)', async () => {
    const res = await http.post('/api/v1/auth/login').send(ADMIN).expect(200);
    const { data } = res.body;
    expect(data).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 });
    expect(data.refreshToken).toBeUndefined();
    expect(data.user).toMatchObject({ email: ADMIN.email, roles: ['SUPER_ADMIN'], mustChangePassword: false });
    expect(data.user.permissions).toContain('users.read');
    const cookie = ([] as string[]).concat(res.headers['set-cookie']).join(';');
    expect(cookie).toMatch(/refresh_token=.+HttpOnly/);
    expect(cookie).toContain('Path=/');
  });

  it('tokensiz himoyalangan endpoint — 401', async () => {
    await http.get('/api/v1/auth/me').expect(401);
  });

  it('refresh tokenni almashtiradi; logout butun sessiyani yopadi', async () => {
    const login = await http.post('/api/v1/auth/login').send(ADMIN).expect(200);
    const first = refreshCookie(login);

    const r1 = await http.post('/api/v1/auth/refresh').set('Cookie', first).send({}).expect(200);
    const second = refreshCookie(r1);
    expect(second).not.toBe(first);
    expect(r1.body.data.user.email).toBe(ADMIN.email);

    // Parallel tab: eski token grace oralig'ida hali ishlaydi.
    await http.post('/api/v1/auth/refresh').set('Cookie', first).send({}).expect(200);

    await http.post('/api/v1/auth/logout').set('Cookie', second).expect(204);
    await new Promise((r) => setTimeout(r, 2_100));
    await http.post('/api/v1/auth/refresh').set('Cookie', second).send({}).expect(401);
  });

  it('cookiesiz logout ham 204', async () => {
    await http.post('/api/v1/auth/logout').expect(204);
  });

  it("vaqtinchalik parol: faqat profil va parol almashtirish ochiq", async () => {
    const admin = await http.post('/api/v1/auth/login').send(ADMIN).expect(200);
    const token = admin.body.data.accessToken;
    const email = `temp-${Date.now()}@test.local`;
    await http
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Vaqt', lastName: 'Parol', email, password: 'TempPass1234', roleSlugs: ['TEACHER'] })
      .expect(201);

    const login = await http.post('/api/v1/auth/login').send({ email, password: 'TempPass1234' }).expect(200);
    const t = login.body.data.accessToken;
    expect(login.body.data.user.mustChangePassword).toBe(true);

    const blocked = await http.get('/api/v1/users').set('Authorization', `Bearer ${t}`);
    expect(blocked.status).toBe(403);
    expect(blocked.body.title).toBe('Avval parolingizni almashtirishingiz kerak');
    await http.get('/api/v1/auth/me').set('Authorization', `Bearer ${t}`).expect(200);

    // Web klient bu javobni o'ramsiz o'qiydi.
    const changed = await http
      .post('/api/v1/auth/me/change-password')
      .set('Authorization', `Bearer ${t}`)
      .set('Cookie', refreshCookie(login))
      .send({ currentPassword: 'TempPass1234', newPassword: 'NewPass12345', confirmPassword: 'NewPass12345' })
      .expect(200);
    expect(changed.body).toMatchObject({ ok: true, expiresIn: 900 });
    expect(changed.body.data).toBeUndefined();

    await http.get('/api/v1/users').set('Authorization', `Bearer ${changed.body.accessToken}`).expect(200);
    // Eski sessiya bekor qilingan.
    await http.post('/api/v1/auth/refresh').set('Cookie', refreshCookie(login)).send({}).expect(401);
  });

  it("noto'g'ri joriy parol — 400 (401 emas, aks holda klient sessiyani tashlab yuboradi)", async () => {
    const admin = await http.post('/api/v1/auth/login').send(ADMIN).expect(200);
    const teacher = await createUser(http, admin.body.data.accessToken, 'TEACHER');
    await http
      .post('/api/v1/auth/me/change-password')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ currentPassword: 'nope', newPassword: 'Another12345', confirmPassword: 'Another12345' })
      .expect(400);
  });

  it('profilni tahrirlash va avatar', async () => {
    const admin = await http.post('/api/v1/auth/login').send(ADMIN).expect(200);
    const auth = { Authorization: `Bearer ${admin.body.data.accessToken}` };

    const patched = await http.patch('/api/v1/auth/me').set(auth).send({ firstName: 'Yangi' }).expect(200);
    expect(patched.body.data.firstName).toBe('Yangi');

    const up = await http
      .post('/api/v1/auth/me/avatar')
      .set(auth)
      .attach('file', Buffer.from('fake-png'), { filename: 'a.png', contentType: 'image/png' })
      .expect(201);
    expect(up.body.data.avatarUrl).toMatch(/^http:\/\/assets\.test\/ecobalance-public\/avatars\//);

    const bad = await http
      .post('/api/v1/auth/me/avatar')
      .set(auth)
      .attach('file', Buffer.from('x'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(bad.status).toBe(400);

    const removed = await http.delete('/api/v1/auth/me/avatar').set(auth).expect(200);
    expect(removed.body.data.avatarUrl).toBeNull();
  });

  it('health ochiq', async () => {
    const res = await http.get('/api/v1/health').expect(200);
    expect(res.body).toEqual({ data: { status: 'ok' } });
  });
});
