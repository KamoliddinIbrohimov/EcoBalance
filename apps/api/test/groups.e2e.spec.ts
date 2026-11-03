import type { INestApplication } from '@nestjs/common';
import type { ContentVisibility } from '@prisma/client';

import type { PrismaService } from '../src/infra/prisma.service';
import { StudentGroupService, isReleaseOpenNow } from '../src/modules/groups/release-policy';
import { type Http, createApp, createUser, loginAdmin } from './app';

type User = Awaited<ReturnType<typeof createUser>>;

describe('groups', () => {
  let app: INestApplication;
  let http: Http;
  let prisma: PrismaService;
  let admin: string;
  let teacher: User;
  let otherTeacher: User;

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  let seq = 0;

  async function createGroup(token: string, body: Record<string, unknown> = {}) {
    const res = await http
      .post('/api/v1/groups')
      .set(as(token))
      .send({ nameUz: `Guruh ${++seq}`, ...body })
      .expect(201);
    return res.body.data as { id: string; teacherId: string };
  }

  async function createCourse(ownerId: string, visibility: ContentVisibility = 'PRIVATE') {
    seq += 1;
    return prisma.course.create({
      data: { slug: `kurs-${seq}-${Date.now()}`, nameUz: `Kurs ${seq}`, educationLevel: 'oliy-talim', ownerId, visibility },
    });
  }

  beforeAll(async () => {
    ({ app, http, prisma } = await createApp());
    admin = (await loginAdmin(http)).token;
    teacher = await createUser(http, admin, 'TEACHER');
    otherTeacher = await createUser(http, admin, 'TEACHER');
  });
  afterAll(() => app.close());

  describe('CRUD va egalik', () => {
    it("o'qituvchi o'z guruhini yaratadi, teacherId e'tiborga olinmaydi", async () => {
      const g = await createGroup(teacher.token, { teacherId: otherTeacher.id });
      expect(g.teacherId).toBe(teacher.id);

      const detail = await http.get(`/api/v1/groups/${g.id}`).set(as(teacher.token)).expect(200);
      expect(detail.body.data).toMatchObject({
        id: g.id,
        memberCount: 0,
        isActive: true,
        descriptionUz: null,
        teacher: { id: teacher.id, email: teacher.email },
      });
    });

    it('SA teacherId bersa — shu o‘qituvchiga; bermasa 400', async () => {
      await http.post('/api/v1/groups').set(as(admin)).send({ nameUz: 'SA guruh' }).expect(400);
      const g = await createGroup(admin, { teacherId: teacher.id });
      expect(g.teacherId).toBe(teacher.id);
    });

    it("begona guruh — 404 (ko'rish, tahrirlash, o'chirish, ichki ro'yxatlar)", async () => {
      const g = await createGroup(otherTeacher.token);
      const t = as(teacher.token);
      await http.get(`/api/v1/groups/${g.id}`).set(t).expect(404);
      await http.patch(`/api/v1/groups/${g.id}`).set(t).send({ nameUz: 'Buzildi' }).expect(404);
      await http.delete(`/api/v1/groups/${g.id}`).set(t).expect(404);
      for (const sub of ['members', 'courses', 'quizzes', 'releases']) {
        await http.get(`/api/v1/groups/${g.id}/${sub}`).set(t).expect(404);
      }
      // SA hammasini ko'radi
      await http.get(`/api/v1/groups/${g.id}`).set(as(admin)).expect(200);
    });

    it("ro'yxat sahifalangan va faqat o'zinikilar", async () => {
      const mine = await createGroup(teacher.token);
      const theirs = await createGroup(otherTeacher.token);
      const res = await http.get('/api/v1/groups?page=1&perPage=100').set(as(teacher.token)).expect(200);
      const ids = res.body.data.map((g: { id: string }) => g.id);
      expect(ids).toContain(mine.id);
      expect(ids).not.toContain(theirs.id);
      expect(res.body.meta).toMatchObject({ page: 1, perPage: 100, total: ids.length, totalPages: 1 });

      const small = await http.get('/api/v1/groups?page=1&perPage=1').set(as(teacher.token)).expect(200);
      expect(small.body.data).toHaveLength(1);
      expect(small.body.meta.totalPages).toBe(small.body.meta.total);

      const filtered = await http
        .get(`/api/v1/groups?teacherId=${otherTeacher.id}&perPage=100`)
        .set(as(admin))
        .expect(200);
      expect(filtered.body.data.every((g: { teacherId: string }) => g.teacherId === otherTeacher.id)).toBe(true);
    });

    it('tahrirlash va o‘chirish (204)', async () => {
      const g = await createGroup(teacher.token);
      const res = await http
        .patch(`/api/v1/groups/${g.id}`)
        .set(as(teacher.token))
        .send({ nameUz: 'Yangi nom', descriptionUz: 'Izoh', isActive: false })
        .expect(200);
      expect(res.body.data).toMatchObject({ nameUz: 'Yangi nom', descriptionUz: 'Izoh', isActive: false });
      await http.delete(`/api/v1/groups/${g.id}`).set(as(teacher.token)).expect(204);
      await http.get(`/api/v1/groups/${g.id}`).set(as(teacher.token)).expect(404);
    });

    it('talaba guruhlar API’siga kira olmaydi', async () => {
      const student = await createUser(http, teacher.token, 'STUDENT');
      await http.get('/api/v1/groups').set(as(student.token)).expect(403);
    });
  });

  describe("a'zolar", () => {
    it("talaba faqat bitta guruhda; chiqarilgach boshqasiga qo'shiladi", async () => {
      const a = await createGroup(teacher.token);
      const b = await createGroup(teacher.token);
      const student = await createUser(http, teacher.token, 'STUDENT');
      const t = as(teacher.token);

      const added = await http.post(`/api/v1/groups/${a.id}/members`).set(t).send({ studentId: student.id }).expect(201);
      expect(added.body.data).toMatchObject({
        groupId: a.id,
        studentId: student.id,
        student: { id: student.id, email: student.email, isActive: true },
      });

      await http.post(`/api/v1/groups/${a.id}/members`).set(t).send({ studentId: student.id }).expect(409);
      await http.post(`/api/v1/groups/${b.id}/members`).set(t).send({ studentId: student.id }).expect(409);

      const list = await http.get(`/api/v1/groups/${a.id}/members`).set(t).expect(200);
      expect(list.body.data.map((m: { studentId: string }) => m.studentId)).toEqual([student.id]);
      const detail = await http.get(`/api/v1/groups/${a.id}`).set(t).expect(200);
      expect(detail.body.data.memberCount).toBe(1);

      await http.delete(`/api/v1/groups/${b.id}/members/${student.id}`).set(t).expect(404);
      await http.delete(`/api/v1/groups/${a.id}/members/${student.id}`).set(t).expect(204);
      await http.post(`/api/v1/groups/${b.id}/members`).set(t).send({ studentId: student.id }).expect(201);
    });

    it("o'qituvchi begona talabani yoki o'qituvchini qo'sha olmaydi", async () => {
      const g = await createGroup(teacher.token);
      const foreign = await createUser(http, otherTeacher.token, 'STUDENT');
      const t = as(teacher.token);
      await http.post(`/api/v1/groups/${g.id}/members`).set(t).send({ studentId: foreign.id }).expect(404);
      await http.post(`/api/v1/groups/${g.id}/members`).set(t).send({ studentId: otherTeacher.id }).expect(404);
      await http.post(`/api/v1/groups/${g.id}/members`).set(t).send({ studentId: 'xato' }).expect(422);
      // SA istalgan talabani qo'sha oladi
      await http.post(`/api/v1/groups/${g.id}/members`).set(as(admin)).send({ studentId: foreign.id }).expect(201);
    });
  });

  describe('kurs biriktirish', () => {
    it("o'ziniki va LIBRARY — mumkin, begona PRIVATE — 404", async () => {
      const g = await createGroup(teacher.token);
      const t = as(teacher.token);
      const own = await createCourse(teacher.id);
      const library = await createCourse(otherTeacher.id, 'LIBRARY');
      const privateForeign = await createCourse(otherTeacher.id);

      const res = await http.post(`/api/v1/groups/${g.id}/courses/${own.id}`).set(t).expect(201);
      expect(res.body.data).toEqual({ courseId: own.id, groupId: g.id });
      await http.post(`/api/v1/groups/${g.id}/courses/${library.id}`).set(t).expect(201);
      await http.post(`/api/v1/groups/${g.id}/courses/${privateForeign.id}`).set(t).expect(404);
      await http.post(`/api/v1/groups/${g.id}/courses/${own.id}`).set(t).expect(409);

      const list = await http.get(`/api/v1/groups/${g.id}/courses`).set(t).expect(200);
      expect(list.body.data).toHaveLength(2);
      expect(list.body.data[0]).toEqual({
        courseId: own.id,
        groupId: g.id,
        course: { id: own.id, slug: own.slug, nameUz: own.nameUz, isPublished: false },
      });

      await http.delete(`/api/v1/groups/${g.id}/courses/${own.id}`).set(t).expect(204);
      await http.delete(`/api/v1/groups/${g.id}/courses/${own.id}`).set(t).expect(404);
    });

    it('kurs biriktirilganda darslaridagi nashr etilgan testlar ham guruhga ochiladi', async () => {
      const t = as(teacher.token);
      const g = await createGroup(teacher.token);
      const course = await createCourse(teacher.id);
      const lesson = await prisma.lesson.create({
        data: { courseId: course.id, orderIndex: 0, lessonType: 'MARUZA', titleUz: 'Kirish' },
      });
      const published = await prisma.quiz.create({
        data: { titleUz: 'Kirish diagnostikasi', lessonId: lesson.id, ownerId: teacher.id, isPublished: true },
      });
      await prisma.quiz.create({
        data: { titleUz: 'Qoralama', lessonId: lesson.id, ownerId: teacher.id, isPublished: false },
      });

      await http.post(`/api/v1/groups/${g.id}/courses/${course.id}`).set(t).expect(201);
      const quizzes = await http.get(`/api/v1/groups/${g.id}/quizzes`).set(t).expect(200);
      expect(quizzes.body.data.map((q: { quizId: string }) => q.quizId)).toEqual([published.id]);
    });
  });

  describe('test biriktirish', () => {
    it('sozlamalar bilan biriktirish, qisman PATCH, ajratish', async () => {
      const g = await createGroup(teacher.token);
      const t = as(teacher.token);
      const quiz = await prisma.quiz.create({ data: { titleUz: 'Test', ownerId: teacher.id } });
      const foreign = await prisma.quiz.create({ data: { titleUz: 'Begona', ownerId: otherTeacher.id } });
      const opensAt = '2030-01-01T09:00:00.000Z';

      await http.post(`/api/v1/groups/${g.id}/quizzes/${foreign.id}`).set(t).send({}).expect(404);
      await http
        .post(`/api/v1/groups/${g.id}/quizzes/${quiz.id}`)
        .set(t)
        .send({ opensAt, closesAt: '2029-01-01T00:00:00.000Z' })
        .expect(400);
      await http.post(`/api/v1/groups/${g.id}/quizzes/${quiz.id}`).set(t).send({ maxAttempts: 0 }).expect(422);

      const bound = await http
        .post(`/api/v1/groups/${g.id}/quizzes/${quiz.id}`)
        .set(t)
        .send({ opensAt, closesAt: null, maxAttempts: 3, timeLimitMinutes: null })
        .expect(201);
      expect(bound.body.data).toEqual({ quizId: quiz.id, groupId: g.id });
      await http.post(`/api/v1/groups/${g.id}/quizzes/${quiz.id}`).set(t).send({}).expect(409);

      // Yuborilmagan maydonlar o'zgarmaydi
      const patched = await http
        .patch(`/api/v1/groups/${g.id}/quizzes/${quiz.id}`)
        .set(t)
        .send({ timeLimitMinutes: 15 })
        .expect(200);
      expect(patched.body.data).toEqual({
        quizId: quiz.id,
        groupId: g.id,
        opensAt,
        closesAt: null,
        maxAttempts: 3,
        timeLimitMinutes: 15,
      });
      await http
        .patch(`/api/v1/groups/${g.id}/quizzes/${quiz.id}`)
        .set(t)
        .send({ maxAttempts: null })
        .expect(200);

      const list = await http.get(`/api/v1/groups/${g.id}/quizzes`).set(t).expect(200);
      expect(list.body.data).toEqual([
        {
          quizId: quiz.id,
          groupId: g.id,
          quiz: { id: quiz.id, titleUz: 'Test', isPublished: false, lessonId: null },
          opensAt,
          closesAt: null,
          maxAttempts: null,
          timeLimitMinutes: 15,
        },
      ]);

      await http.delete(`/api/v1/groups/${g.id}/quizzes/${quiz.id}`).set(t).expect(204);
      await http.patch(`/api/v1/groups/${g.id}/quizzes/${quiz.id}`).set(t).send({}).expect(404);
    });
  });

  describe('dars ochilishi (release)', () => {
    it('yaratish/yangilash, xabar, o‘chirish va begona release', async () => {
      const g = await createGroup(teacher.token);
      const t = as(teacher.token);
      const course = await createCourse(teacher.id);
      const mod = await prisma.module.create({ data: { courseId: course.id, orderIndex: 0, titleUz: 'Modul 1' } });
      const lesson = await prisma.lesson.create({
        data: { courseId: course.id, moduleId: mod.id, orderIndex: 0, lessonType: 'MARUZA', titleUz: 'Kirish' },
      });
      const student = await createUser(http, teacher.token, 'STUDENT');
      await http.post(`/api/v1/groups/${g.id}/members`).set(t).send({ studentId: student.id }).expect(201);

      // Kurs biriktirilmagan
      await http.post(`/api/v1/groups/${g.id}/releases`).set(t).send({ lessonId: lesson.id, status: 'OPEN' }).expect(400);
      await http.post(`/api/v1/groups/${g.id}/courses/${course.id}`).set(t).expect(201);

      // Validatsiya
      await http.post(`/api/v1/groups/${g.id}/releases`).set(t).send({ status: 'OPEN' }).expect(422);
      await http
        .post(`/api/v1/groups/${g.id}/releases`)
        .set(t)
        .send({ lessonId: lesson.id, moduleId: mod.id, status: 'OPEN' })
        .expect(422);
      await http.post(`/api/v1/groups/${g.id}/releases`).set(t).send({ lessonId: lesson.id, status: 'SCHEDULED' }).expect(400);
      await http
        .post(`/api/v1/groups/${g.id}/releases`)
        .set(t)
        .send({ lessonId: '0190f5c2-0000-7000-8000-000000000000', status: 'OPEN' })
        .expect(404);

      const locked = await http
        .post(`/api/v1/groups/${g.id}/releases`)
        .set(t)
        .send({ lessonId: lesson.id, status: 'LOCKED' })
        .expect(200);
      expect(locked.body.data).toMatchObject({
        groupId: g.id,
        lessonId: lesson.id,
        moduleId: null,
        opensAt: null,
        closesAt: null,
        status: 'LOCKED',
      });

      // Upsert: o'sha dars uchun yangi yozuv emas, yangilanadi
      const opened = await http
        .post(`/api/v1/groups/${g.id}/releases`)
        .set(t)
        .send({ lessonId: lesson.id, status: 'OPEN' })
        .expect(200);
      expect(opened.body.data.id).toBe(locked.body.data.id);
      await http.post(`/api/v1/groups/${g.id}/releases`).set(t).send({ lessonId: lesson.id, status: 'OPEN' }).expect(200);
      const notes = await prisma.notification.findMany({ where: { userId: student.id, type: 'RELEASE_OPEN' } });
      expect(notes).toHaveLength(1);

      const modRelease = await http
        .post(`/api/v1/groups/${g.id}/releases`)
        .set(t)
        .send({ moduleId: mod.id, status: 'SCHEDULED', opensAt: '2030-01-01T00:00:00.000Z' })
        .expect(200);

      const list = await http.get(`/api/v1/groups/${g.id}/releases`).set(t).expect(200);
      expect(list.body.data).toHaveLength(2);

      // Begona guruh release'ini o'z guruhi ID'si orqali o'chirib bo'lmaydi
      const other = await createGroup(teacher.token);
      await http.delete(`/api/v1/groups/${other.id}/releases/${modRelease.body.data.id}`).set(t).expect(404);
      await http.delete(`/api/v1/groups/${g.id}/releases/${modRelease.body.data.id}`).set(as(otherTeacher.token)).expect(404);

      await http.delete(`/api/v1/groups/${g.id}/releases/${modRelease.body.data.id}`).set(t).expect(204);
      await http.delete(`/api/v1/groups/${g.id}/releases/${modRelease.body.data.id}`).set(t).expect(404);
      const after = await http.get(`/api/v1/groups/${g.id}/releases`).set(t).expect(200);
      expect(after.body.data.map((r: { id: string }) => r.id)).toEqual([opened.body.data.id]);
    });
  });
  describe('StudentGroupService (boshqa modullar uchun)', () => {
    it('isReleaseOpenNow qoidalari', () => {
      const now = Date.parse('2030-06-01T00:00:00Z');
      const d = (s: string) => new Date(s);
      expect(isReleaseOpenNow({ status: 'LOCKED', opensAt: null, closesAt: null }, now)).toBe(false);
      expect(isReleaseOpenNow({ status: 'OPEN', opensAt: null, closesAt: null }, now)).toBe(true);
      expect(isReleaseOpenNow({ status: 'OPEN', opensAt: null, closesAt: d('2030-05-01') }, now)).toBe(false);
      expect(isReleaseOpenNow({ status: 'SCHEDULED', opensAt: d('2030-05-01'), closesAt: null }, now)).toBe(true);
      expect(isReleaseOpenNow({ status: 'SCHEDULED', opensAt: d('2030-07-01'), closesAt: null }, now)).toBe(false);
      expect(isReleaseOpenNow({ status: 'SCHEDULED', opensAt: null, closesAt: null }, now)).toBe(false);
    });

    it('talaba guruhi, kurs va dars ochiqligi (dars release modulnikidan ustun)', async () => {
      const svc = app.get(StudentGroupService);
      const g = await createGroup(teacher.token);
      const t = as(teacher.token);
      const course = await createCourse(teacher.id);
      const mod = await prisma.module.create({ data: { courseId: course.id, orderIndex: 0, titleUz: 'M' } });
      const l1 = await prisma.lesson.create({
        data: { courseId: course.id, moduleId: mod.id, orderIndex: 0, lessonType: 'AMALIY', titleUz: 'L1' },
      });
      const l2 = await prisma.lesson.create({
        data: { courseId: course.id, moduleId: mod.id, orderIndex: 1, lessonType: 'AMALIY', titleUz: 'L2' },
      });
      const free = await prisma.lesson.create({
        data: { courseId: course.id, orderIndex: 2, lessonType: 'AMALIY', titleUz: 'L3' },
      });
      const student = await createUser(http, teacher.token, 'STUDENT');

      expect(await svc.activeGroupId(student.id)).toBeNull();
      await http.post(`/api/v1/groups/${g.id}/members`).set(t).send({ studentId: student.id }).expect(201);
      expect(await svc.activeGroupId(student.id)).toBe(g.id);
      expect(await svc.hasCourse(student.id, course.id)).toBe(false);
      await http.post(`/api/v1/groups/${g.id}/courses/${course.id}`).set(t).expect(201);
      expect(await svc.hasCourse(student.id, course.id)).toBe(true);

      await http.post(`/api/v1/groups/${g.id}/releases`).set(t).send({ moduleId: mod.id, status: 'LOCKED' }).expect(200);
      await http.post(`/api/v1/groups/${g.id}/releases`).set(t).send({ lessonId: l1.id, status: 'OPEN' }).expect(200);
      expect(await svc.isLessonOpen(g.id, l1)).toBe(true);
      expect(await svc.isLessonOpen(g.id, l2)).toBe(false);
      expect(await svc.isLessonOpen(g.id, free)).toBe(true);
      const resolve = await svc.releaseResolver(g.id);
      expect(resolve(l1)?.status).toBe('OPEN');
      expect(resolve(l2)?.status).toBe('LOCKED');
      expect(resolve(free)).toBeNull();

      await http.patch(`/api/v1/groups/${g.id}`).set(t).send({ isActive: false }).expect(200);
      expect(await svc.activeGroupId(student.id)).toBeNull();
      expect(await svc.groupOf(student.id)).toEqual({ groupId: g.id, isActive: false });
    });
  });
});
