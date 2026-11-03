import type { INestApplication } from '@nestjs/common';

import { type Http, createApp, createUser, loginAdmin } from './app';

describe('users', () => {
  let app: INestApplication;
  let http: Http;
  let admin: string;
  let teacher: Awaited<ReturnType<typeof createUser>>;
  let otherTeacher: Awaited<ReturnType<typeof createUser>>;

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ({ app, http } = await createApp());
    admin = (await loginAdmin(http)).token;
    teacher = await createUser(http, admin, 'TEACHER');
    otherTeacher = await createUser(http, admin, 'TEACHER');
  });
  afterAll(() => app.close());

  it("o'qituvchi faqat talaba yarata oladi", async () => {
    const res = await http
      .post('/api/v1/users')
      .set(as(teacher.token))
      .send({ firstName: 'Ab', lastName: 'Cd', email: `x${Date.now()}@test.local`, password: 'TempPass1234', roleSlugs: ['TEACHER'] });
    expect(res.status).toBe(403);
  });

  it("hech kim ikkinchi SUPER_ADMIN yarata olmaydi", async () => {
    const res = await http
      .post('/api/v1/users')
      .set(as(admin))
      .send({ firstName: 'Ab', lastName: 'Cd', email: `sa${Date.now()}@test.local`, password: 'TempPass1234', roleSlugs: ['SUPER_ADMIN'] });
    expect(res.status).toBe(403);
  });

  it('takroriy email — 409', async () => {
    const res = await http
      .post('/api/v1/users')
      .set(as(admin))
      .send({ firstName: 'Ab', lastName: 'Cd', email: teacher.email, password: 'TempPass1234', roleSlugs: ['TEACHER'] });
    expect(res.status).toBe(409);
  });

  it("o'qituvchi faqat o'z talabalarini ko'radi", async () => {
    const mine = await createUser(http, teacher.token, 'STUDENT');
    const theirs = await createUser(http, otherTeacher.token, 'STUDENT');

    const list = await http.get('/api/v1/users?perPage=100').set(as(teacher.token)).expect(200);
    const ids = list.body.data.map((u: { id: string }) => u.id);
    expect(ids).toContain(mine.id);
    expect(ids).not.toContain(theirs.id);
    expect(list.body.meta).toMatchObject({ page: 1, perPage: 100 });

    await http.get(`/api/v1/users/${theirs.id}`).set(as(teacher.token)).expect(404);
    await http.patch(`/api/v1/users/${theirs.id}`).set(as(teacher.token)).send({ firstName: 'Xx' }).expect(404);
    await http.patch(`/api/v1/users/${mine.id}`).set(as(teacher.token)).send({ firstName: 'Yangi' }).expect(200);
  });

  it("talaba users ro'yxatiga kira olmaydi", async () => {
    const student = await createUser(http, teacher.token, 'STUDENT');
    await http.get('/api/v1/users').set(as(student.token)).expect(403);
  });

  it('isActive=false filtri haqiqatan nofaollarni qaytaradi', async () => {
    const student = await createUser(http, admin, 'STUDENT');
    await http.patch(`/api/v1/users/${student.id}`).set(as(admin)).send({ isActive: false }).expect(200);

    const inactive = await http.get('/api/v1/users?isActive=false&perPage=100').set(as(admin)).expect(200);
    expect(inactive.body.data.every((u: { isActive: boolean }) => !u.isActive)).toBe(true);
    expect(inactive.body.data.map((u: { id: string }) => u.id)).toContain(student.id);

    const active = await http.get('/api/v1/users?isActive=true&perPage=100').set(as(admin)).expect(200);
    expect(active.body.data.every((u: { isActive: boolean }) => u.isActive)).toBe(true);

    // Bloklangan foydalanuvchi tokeni darhol ishlamay qoladi.
    await http.get('/api/v1/auth/me').set(as(student.token)).expect(401);
  });

  it("o'chirish — faolsizlantirish va emailni bo'shatish", async () => {
    const student = await createUser(http, admin, 'STUDENT');
    await http.delete(`/api/v1/users/${student.id}`).set(as(teacher.token)).expect(403);
    await http.delete(`/api/v1/users/${student.id}`).set(as(admin)).expect(200);

    const detail = await http.get(`/api/v1/users/${student.id}`).set(as(admin)).expect(200);
    expect(detail.body.data).toMatchObject({ isActive: false, email: `deleted-${student.id}@invalid.local` });

    // Email qayta ishlatilishi mumkin.
    await http
      .post('/api/v1/users')
      .set(as(admin))
      .send({ firstName: 'Ab', lastName: 'Cd', email: student.email, password: 'TempPass1234', roleSlugs: ['STUDENT'] })
      .expect(201);
  });

  it("o'z rolini o'zgartirib bo'lmaydi", async () => {
    const me = await http.get('/api/v1/auth/me').set(as(admin)).expect(200);
    await http.patch(`/api/v1/users/${me.body.data.id}`).set(as(admin)).send({ roleSlugs: ['TEACHER'] }).expect(403);
  });

  it("rollar va tashkilotlar daraxti", async () => {
    const roles = await http.get('/api/v1/roles').set(as(teacher.token)).expect(200);
    expect(roles.body.data.map((r: { slug: string }) => r.slug).sort()).toEqual(['STUDENT', 'SUPER_ADMIN', 'TEACHER']);
    const tree = await http.get('/api/v1/organizations/tree').set(as(admin)).expect(200);
    expect(Array.isArray(tree.body.data)).toBe(true);
  });
});
