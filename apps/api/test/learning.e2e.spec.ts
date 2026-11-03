import { Controller, Get, type INestApplication, Module, Param, ParseUUIDPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import type { PrismaService } from '../src/infra/prisma.service';
import { StorageService } from '../src/infra/storage.service';
import { configureApp } from '../src/main';
import { FakeStorage, type Http, createApp, createUser, loginAdmin } from './app';

/** courses modulining `/lessons/:id` yo'llari LearningModule'dan OLDIN ro'yxatga olingan holat. */
@Controller('lessons')
class ShadowLessonsController {
  @Get(':id')
  one(@Param('id', ParseUUIDPipe) id: string) {
    return { shadow: id };
  }

  @Get(':id/removal-impact')
  impact(@Param('id', ParseUUIDPipe) id: string) {
    return { shadow: id };
  }
}

@Module({ controllers: [ShadowLessonsController] })
class ShadowLessonsModule {}

type User = Awaited<ReturnType<typeof createUser>>;

const HOUR = 3_600_000;
const inHours = (h: number) => new Date(Date.now() + h * HOUR);
const PDF = Buffer.from('%PDF-1.4\n%test\n');

describe('learning', () => {
  let app: INestApplication;
  let http: Http;
  let prisma: PrismaService;
  let admin: string;
  let teacherA: User;
  let teacherB: User;
  let studentA1: User;
  let studentA2: User;
  let studentB: User;
  let loner: User;
  let groupA: string;
  let groupB: string;
  let courseA: string;
  let hiddenCourse: string;
  let lesson1: string;
  let lesson2: string;
  let lockedLesson: string;

  const as = (u: User | string) => ({ Authorization: `Bearer ${typeof u === 'string' ? u : u.token}` });

  let seq = 0;
  async function course(isPublished: boolean, groupId: string) {
    seq += 1;
    const c = await prisma.course.create({
      data: { slug: `learn-${Date.now()}-${seq}`, nameUz: `Kurs ${seq}`, educationLevel: 'oliy-talim', isPublished },
    });
    await prisma.courseGroup.create({ data: { courseId: c.id, groupId } });
    return c.id;
  }
  const lesson = (courseId: string, orderIndex: number) =>
    prisma.lesson
      .create({ data: { courseId, orderIndex, lessonType: 'MARUZA', titleUz: `Dars ${orderIndex}` } })
      .then((l) => l.id);

  async function createAssignment(teacher: User, body: Record<string, unknown>) {
    const res = await http
      .post('/api/v1/assignments')
      .set(as(teacher))
      .send({ groupId: groupA, titleUz: 'Topshiriq', ...body });
    expect(res.status).toBe(201);
    return res.body.data as { id: string } & Record<string, unknown>;
  }

  beforeAll(async () => {
    ({ app, http, prisma } = await createApp());
    admin = (await loginAdmin(http)).token;
    [teacherA, teacherB] = [await createUser(http, admin, 'TEACHER'), await createUser(http, admin, 'TEACHER')];
    studentA1 = await createUser(http, admin, 'STUDENT');
    studentA2 = await createUser(http, admin, 'STUDENT');
    studentB = await createUser(http, admin, 'STUDENT');
    loner = await createUser(http, admin, 'STUDENT');

    groupA = (await prisma.group.create({ data: { nameUz: 'A guruh', teacherId: teacherA.id } })).id;
    groupB = (await prisma.group.create({ data: { nameUz: 'B guruh', teacherId: teacherB.id } })).id;
    await prisma.groupMember.createMany({
      data: [
        { groupId: groupA, studentId: studentA1.id },
        { groupId: groupA, studentId: studentA2.id },
        { groupId: groupB, studentId: studentB.id },
      ],
    });
    courseA = await course(true, groupA);
    hiddenCourse = await course(false, groupA);
    lesson1 = await lesson(courseA, 1);
    lesson2 = await lesson(courseA, 2);
    lockedLesson = await lesson(courseA, 3);
    await prisma.groupLessonRelease.create({ data: { groupId: groupA, lessonId: lockedLesson, status: 'LOCKED' } });
  });
  afterAll(() => app.close());

  describe('assignments CRUD va ko‘rinish', () => {
    it("faqat o'z guruhiga yaratish mumkin", async () => {
      const created = await createAssignment(teacherA, { courseId: courseA, lessonId: lesson1, dueAt: inHours(24) });
      expect(created).toMatchObject({ kind: 'TASK', maxScore: 100, groupId: groupA, courseId: courseA, submissionCount: 0 });

      await http.post('/api/v1/assignments').set(as(teacherB)).send({ groupId: groupA, titleUz: 'Begona' }).expect(404);
      await http.post('/api/v1/assignments').set(as(studentA1)).send({ groupId: groupA, titleUz: 'Talaba' }).expect(403);
      const other = await course(true, groupB);
      await http
        .post('/api/v1/assignments')
        .set(as(teacherA))
        .send({ groupId: groupA, titleUz: 'Bog‘lanmagan', courseId: other })
        .expect(400);
      await http
        .post('/api/v1/assignments')
        .set(as(teacherA))
        .send({ groupId: groupA, titleUz: 'O‘tgan', dueAt: inHours(-1) })
        .expect(400);
    });

    it("talaba faqat o'z guruhi va nashr etilgan kurs topshiriqlarini ko'radi", async () => {
      const visible = await createAssignment(teacherA, { titleUz: 'Ko‘rinadi' });
      const hidden = await createAssignment(teacherA, { titleUz: 'Yashirin', courseId: hiddenCourse });
      const ofB = (
        await http.post('/api/v1/assignments').set(as(teacherB)).send({ groupId: groupB, titleUz: 'B topshiriq' }).expect(201)
      ).body.data;

      const ids = async (u: User | string, query = '') => {
        const res = await http.get(`/api/v1/assignments?perPage=100${query}`).set(as(u)).expect(200);
        expect(res.body.meta).toMatchObject({ page: 1, perPage: 100 });
        return res.body.data.map((a: { id: string }) => a.id) as string[];
      };

      const a1 = await ids(studentA1);
      expect(a1).toContain(visible.id);
      expect(a1).not.toContain(hidden.id);
      expect(a1).not.toContain(ofB.id);
      expect(await ids(studentB)).toEqual([ofB.id]);
      expect(await ids(loner)).toEqual([]);
      expect(await ids(teacherB)).toEqual([ofB.id]);
      expect(await ids(teacherA)).toEqual(expect.arrayContaining([visible.id, hidden.id]));
      expect(await ids(admin)).toEqual(expect.arrayContaining([visible.id, ofB.id]));
      expect(await ids(studentA1, `&groupId=${groupB}`)).toEqual([]);

      // Begona/yashirin topshiriqqa topshirib bo'lmaydi.
      await http.post(`/api/v1/assignments/${ofB.id}/submissions`).set(as(studentA1)).send({ textUz: 'x' }).expect(404);
      await http.post(`/api/v1/assignments/${hidden.id}/submissions`).set(as(studentA1)).send({ textUz: 'x' }).expect(404);
    });

    it("muddati o'tgan topshiriqni tahrirlash (muddat o'zgarmasa) va siyosat maydonlari saqlanadi", async () => {
      const a = await createAssignment(teacherA, { dueAt: inHours(2) });
      const past = new Date(Date.now() - HOUR);
      await prisma.assignment.update({ where: { id: a.id }, data: { dueAt: past } });

      const res = await http
        .patch(`/api/v1/assignments/${a.id}`)
        .set(as(teacherA))
        .send({ titleUz: 'Yangi nom', dueAt: past.toISOString(), allowLate: true, latePenaltyPercent: 15 })
        .expect(200);
      expect(res.body.data).toMatchObject({ titleUz: 'Yangi nom', allowLate: true, latePenaltyPercent: 15 });

      await http.patch(`/api/v1/assignments/${a.id}`).set(as(teacherA)).send({ dueAt: inHours(-5) }).expect(400);
      await http.patch(`/api/v1/assignments/${a.id}`).set(as(teacherB)).send({ titleUz: 'Begona' }).expect(404);
    });

    it("o'chirish — faqat egasi", async () => {
      const a = await createAssignment(teacherA, {});
      await http.delete(`/api/v1/assignments/${a.id}`).set(as(teacherB)).expect(404);
      await http.delete(`/api/v1/assignments/${a.id}`).set(as(teacherA)).expect(204);
      expect(await prisma.assignment.findUnique({ where: { id: a.id } })).toBeNull();
    });
  });

  describe('topshirish, baholash, qaytarish', () => {
    it('submit → grade → reopen → resubmit (attempt oshadi, revision saqlanadi)', async () => {
      const a = await createAssignment(teacherA, { dueAt: inHours(24), maxScore: 50 });
      const mine0 = await http.get(`/api/v1/assignments/${a.id}/my-submission`).set(as(studentA1)).expect(200);
      expect(mine0.body).toEqual({ data: null });

      await http.post(`/api/v1/assignments/${a.id}/submissions`).set(as(teacherA)).send({ textUz: 'x' }).expect(403);
      await http.post(`/api/v1/assignments/${a.id}/submissions`).set(as(studentA1)).send({ textUz: '  ' }).expect(400);
      const sub = (
        await http.post(`/api/v1/assignments/${a.id}/submissions`).set(as(studentA1)).send({ textUz: 'Birinchi javob' }).expect(201)
      ).body.data;
      expect(sub).toMatchObject({ status: 'SUBMITTED', attempt: 1, isLate: false, textUz: 'Birinchi javob', score: null });

      const list = await http.get(`/api/v1/assignments/${a.id}/submissions`).set(as(teacherA)).expect(200);
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0].student).toMatchObject({ id: studentA1.id });
      await http.get(`/api/v1/assignments/${a.id}/submissions`).set(as(teacherB)).expect(404);
      await http.get(`/api/v1/assignments/${a.id}/submissions`).set(as(studentA1)).expect(403);

      const grade = (body: object, u: User) =>
        http.patch(`/api/v1/assignments/submissions/${sub.id}/grade`).set(as(u)).send(body);
      expect((await grade({ score: 40 }, teacherB)).status).toBe(404);
      expect((await grade({ score: 51 }, teacherA)).status).toBe(400);
      const graded = await grade({ score: 40, feedbackUz: 'Yaxshi' }, teacherA);
      expect(graded.status).toBe(200);
      expect(graded.body.data).toMatchObject({ status: 'GRADED', score: 40, feedbackUz: 'Yaxshi', gradedById: teacherA.id });

      await http.post(`/api/v1/assignments/${a.id}/submissions`).set(as(studentA1)).send({ textUz: 'Qayta' }).expect(400);

      await http.post(`/api/v1/assignments/submissions/${sub.id}/reopen`).set(as(teacherB)).send({}).expect(404);
      const reopened = await http.post(`/api/v1/assignments/submissions/${sub.id}/reopen`).set(as(teacherA)).send({}).expect(201);
      expect(reopened.body.data).toMatchObject({ status: 'RETURNED', feedbackUz: 'Yaxshi', score: 40 });

      const second = await http
        .post(`/api/v1/assignments/${a.id}/submissions`)
        .set(as(studentA1))
        .send({ textUz: 'Ikkinchi javob' })
        .expect(201);
      expect(second.body.data).toMatchObject({ id: sub.id, status: 'SUBMITTED', attempt: 2, score: null, feedbackUz: null, gradedById: null });

      const revisions = await prisma.assignmentSubmissionRevision.findMany({ where: { submissionId: sub.id } });
      expect(revisions).toHaveLength(1);
      expect(revisions[0]).toMatchObject({ attempt: 1, textUz: 'Birinchi javob', score: 40, status: 'RETURNED', feedbackUz: 'Yaxshi' });

      const notices = await prisma.notification.findMany({ where: { userId: studentA1.id, type: 'assignment.graded' } });
      expect(notices.length).toBeGreaterThan(0);
    });

    it('kechikish: allowLate=false rad etadi, allowLate=true jarima bilan baholanadi', async () => {
      const strict = await createAssignment(teacherA, { dueAt: inHours(1) });
      const lenient = await createAssignment(teacherA, { dueAt: inHours(1), allowLate: true, latePenaltyPercent: 20 });
      await prisma.assignment.updateMany({ where: { id: { in: [strict.id, lenient.id] } }, data: { dueAt: inHours(-1) } });

      await http.post(`/api/v1/assignments/${strict.id}/submissions`).set(as(studentA1)).send({ textUz: 'kech' }).expect(400);
      const late = await http.post(`/api/v1/assignments/${lenient.id}/submissions`).set(as(studentA1)).send({ textUz: 'kech' }).expect(201);
      expect(late.body.data.isLate).toBe(true);

      const graded = await http
        .patch(`/api/v1/assignments/submissions/${late.body.data.id}/grade`)
        .set(as(teacherA))
        .send({ score: 90 })
        .expect(200);
      expect(graded.body.data.score).toBe(72);
    });

    it('alohida uzaytirish muddatni kengaytiradi', async () => {
      const a = await createAssignment(teacherA, { dueAt: inHours(1) });
      await prisma.assignment.update({ where: { id: a.id }, data: { dueAt: inHours(-2) } });
      const url = (studentId: string) => `/api/v1/assignments/${a.id}/accommodations/${studentId}`;

      await http.post(`/api/v1/assignments/${a.id}/submissions`).set(as(studentA2)).send({ textUz: 'kech' }).expect(400);
      await http.post(url(studentA2.id)).set(as(teacherA)).send({}).expect(422);
      await http.post(url(studentA2.id)).set(as(teacherB)).send({ extraMinutes: 30 }).expect(404);
      await http.post(url(studentB.id)).set(as(teacherA)).send({ extraMinutes: 30 }).expect(400);

      // extraMinutes TASK muddatiga qo'shiladi: 2 soat kechikishga 30 daqiqa yetmaydi.
      await http.post(url(studentA2.id)).set(as(teacherA)).send({ extraMinutes: 30 }).expect(200);
      await http.post(`/api/v1/assignments/${a.id}/submissions`).set(as(studentA2)).send({ textUz: 'kech' }).expect(400);

      const newDueAt = inHours(3).toISOString();
      const acc = await http.post(url(studentA2.id)).set(as(teacherA)).send({ newDueAt }).expect(200);
      expect(acc.body.data).toMatchObject({ studentId: studentA2.id, extraMinutes: null, newDueAt });
      const ok = await http.post(`/api/v1/assignments/${a.id}/submissions`).set(as(studentA2)).send({ textUz: 'o‘z vaqtida' }).expect(201);
      expect(ok.body.data.isLate).toBe(false);

      // Boshqa talabaga ta'sir qilmaydi.
      await http.post(`/api/v1/assignments/${a.id}/submissions`).set(as(studentA1)).send({ textUz: 'kech' }).expect(400);
    });
  });

  describe('TIMED', () => {
    it("start majburiy, deadline server tomonda, qayta boshlash — faqat qaytarilgandan keyin", async () => {
      const a = await createAssignment(teacherA, { kind: 'TIMED', endsAt: inHours(2), timeLimitMinutes: 30 });
      await http
        .post('/api/v1/assignments')
        .set(as(teacherA))
        .send({ groupId: groupA, titleUz: 'TIMED xato', kind: 'TIMED', endsAt: inHours(2) })
        .expect(400);

      const submit = (u: User, textUz = 'javob') => http.post(`/api/v1/assignments/${a.id}/submissions`).set(as(u)).send({ textUz });
      expect((await submit(studentA1)).status).toBe(400);

      const started = await http.post(`/api/v1/assignments/${a.id}/start`).set(as(studentA1)).send({}).expect(200);
      const deadline = new Date(started.body.data.attemptDeadline).getTime();
      expect(Math.abs(deadline - (Date.now() + 30 * 60_000))).toBeLessThan(10_000);
      const again = await http.post(`/api/v1/assignments/${a.id}/start`).set(as(studentA1)).send({}).expect(200);
      expect(again.body.data.attemptDeadline).toBe(started.body.data.attemptDeadline);

      expect((await submit(studentA1)).status).toBe(201);
      expect((await submit(studentA1, 'yana')).status).toBe(400);

      // Muddati tugagan urinish: topshirib ham, qayta boshlab ham bo'lmaydi.
      const s2 = (await http.post(`/api/v1/assignments/${a.id}/start`).set(as(studentA2)).send({}).expect(200)).body.data;
      await prisma.assignmentSubmission.update({ where: { id: s2.id }, data: { attemptDeadline: new Date(Date.now() - 1000) } });
      expect((await submit(studentA2)).status).toBe(400);
      await http.post(`/api/v1/assignments/${a.id}/start`).set(as(studentA2)).send({}).expect(409);

      // O'qituvchi qaytarsa — yangi urinish (attempt 2), eskisi revision'da.
      await http.post(`/api/v1/assignments/submissions/${s2.id}/reopen`).set(as(teacherA)).send({ feedbackUz: 'Qayta' }).expect(201);
      expect((await submit(studentA2)).status).toBe(400);
      const restarted = await http.post(`/api/v1/assignments/${a.id}/start`).set(as(studentA2)).send({}).expect(200);
      expect(restarted.body.data).toMatchObject({ attempt: 2, status: 'SUBMITTED', textUz: null });
      expect(new Date(restarted.body.data.attemptDeadline).getTime()).toBeGreaterThan(Date.now());
      expect((await submit(studentA2)).status).toBe(201);
      expect(await prisma.assignmentSubmissionRevision.count({ where: { submissionId: s2.id } })).toBe(1);
    });

    it('extraMinutes taymerni uzaytiradi, oyna tashqarisida — taymer oyna bilan kesiladi', async () => {
      const a = await createAssignment(teacherA, { kind: 'TIMED', endsAt: inHours(0.5), timeLimitMinutes: 20 });
      await http.post(`/api/v1/assignments/${a.id}/accommodations/${studentA1.id}`).set(as(teacherA)).send({ extraMinutes: 5 }).expect(200);
      await http.post(`/api/v1/assignments/${a.id}/accommodations/${studentA2.id}`).set(as(teacherA)).send({ extraMinutes: 60 }).expect(200);

      const d1 = (await http.post(`/api/v1/assignments/${a.id}/start`).set(as(studentA1)).send({}).expect(200)).body.data;
      expect(Math.abs(new Date(d1.attemptDeadline).getTime() - (Date.now() + 25 * 60_000))).toBeLessThan(10_000);
      const d2 = (await http.post(`/api/v1/assignments/${a.id}/start`).set(as(studentA2)).send({}).expect(200)).body.data;
      const endsAt = (await prisma.assignment.findUniqueOrThrow({ where: { id: a.id } })).endsAt!;
      expect(new Date(d2.attemptDeadline).getTime()).toBe(endsAt.getTime());
    });

    it('TIMED bo‘lmagan topshiriqda start — 400', async () => {
      const a = await createAssignment(teacherA, {});
      await http.post(`/api/v1/assignments/${a.id}/start`).set(as(studentA1)).send({}).expect(400);
    });
  });

  describe('fayllar', () => {
    it('fayl bilan topshirish: magic-byte, tur va yuklab olish huquqi', async () => {
      const a = await createAssignment(teacherA, {});
      const url = `/api/v1/assignments/${a.id}/submissions/file`;

      await http.post(url).set(as(studentA1)).attach('file', Buffer.from('not a pdf'), { filename: 'x.pdf', contentType: 'application/pdf' }).expect(400);
      await http.post(url).set(as(studentA1)).attach('file', Buffer.from('MZ....'), { filename: 'x.exe', contentType: 'application/x-msdownload' }).expect(400);
      await http.post(url).set(as(studentA1)).expect(400);

      const res = await http.post(url).set(as(studentA1)).attach('file', PDF, { filename: 'javob.pdf', contentType: 'application/pdf' }).expect(201);
      expect(res.body.data).toMatchObject({ fileName: 'javob.pdf', status: 'SUBMITTED' });
      expect(res.body.data.fileKey).toMatch(new RegExp(`^submissions/${a.id}/${studentA1.id}/.+\\.pdf$`));

      const sid = res.body.data.id;
      const own = await http.get(`/api/v1/assignments/submissions/${sid}/file-url`).set(as(studentA1)).expect(200);
      expect(own.body.data.url).toContain(res.body.data.fileKey);
      await http.get(`/api/v1/assignments/submissions/${sid}/file-url`).set(as(teacherA)).expect(200);
      await http.get(`/api/v1/assignments/submissions/${sid}/file-url`).set(as(studentA2)).expect(404);
      await http.get(`/api/v1/assignments/submissions/${sid}/file-url`).set(as(teacherB)).expect(404);
    });

    it('o‘qituvchi shablon fayl biriktiradi, talaba URL oladi', async () => {
      const a = await createAssignment(teacherA, {});
      await http.get(`/api/v1/assignments/${a.id}/attachment-url`).set(as(studentA1)).expect(404);
      await http
        .post(`/api/v1/assignments/${a.id}/attachment`)
        .set(as(teacherB))
        .attach('file', PDF, { filename: 'shablon.pdf', contentType: 'application/pdf' })
        .expect(404);
      const up = await http
        .post(`/api/v1/assignments/${a.id}/attachment`)
        .set(as(teacherA))
        .attach('file', PDF, { filename: 'shablon.pdf', contentType: 'application/pdf' })
        .expect(200);
      expect(up.body.data.fileName).toBe('shablon.pdf');
      await http.get(`/api/v1/assignments/${a.id}/attachment-url`).set(as(studentA1)).expect(200);
      await http.get(`/api/v1/assignments/${a.id}/attachment-url`).set(as(studentB)).expect(404);
    });
  });

  describe('dars progressi', () => {
    it('GET /lessons/progress/me /lessons/:id bilan to‘qnashmaydi', async () => {
      const res = await http.get('/api/v1/lessons/progress/me').set(as(studentA1));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const teacher = await http.get('/api/v1/lessons/progress/me').set(as(teacherA)).expect(200);
      expect(teacher.body.data).toEqual([]);
    });

    it("modullar tartibi ahamiyatsiz: oldin ro'yxatga olingan `lessons/:id` progress/me'ni yopmaydi", async () => {
      const moduleRef = await Test.createTestingModule({ imports: [ShadowLessonsModule, AppModule] })
        .overrideProvider(StorageService)
        .useClass(FakeStorage)
        .compile();
      const shadowed = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
      configureApp(shadowed);
      await shadowed.init();
      try {
        const agent = request(shadowed.getHttpServer());
        await agent.get(`/api/v1/lessons/${lesson1}`).set(as(studentA1)).expect(200, { data: { shadow: lesson1 } });
        const res = await agent.get('/api/v1/lessons/progress/me').set(as(studentA1));
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
      } finally {
        await shadowed.close();
      }
    });

    it('darsni tugatish, heartbeat va ruxsatlar', async () => {
      const done = await http.post(`/api/v1/lessons/${lesson1}/progress`).set(as(studentA1)).send({ completed: true }).expect(200);
      expect(done.body.data).toMatchObject({ lessonId: lesson1, studentId: studentA1.id });
      expect(done.body.data.completedAt).toEqual(expect.any(String));

      const mine = await http.get('/api/v1/lessons/progress/me').set(as(studentA1)).expect(200);
      expect(mine.body.data.find((p: { lessonId: string }) => p.lessonId === lesson1)).toMatchObject({ viewCount: 1 });

      await http.post(`/api/v1/lessons/${lesson1}/progress`).set(as(teacherA)).send({ completed: true }).expect(403);
      await http.post(`/api/v1/lessons/${lesson1}/progress`).set(as(studentB)).send({ completed: true }).expect(404);
      await http.post(`/api/v1/lessons/${lockedLesson}/progress`).set(as(studentA1)).send({ completed: true }).expect(404);
      await http.post('/api/v1/lessons/not-a-uuid/progress').set(as(studentA1)).send({ completed: true }).expect(400);

      const beat1 = await http.post(`/api/v1/lessons/${lesson2}/heartbeat`).set(as(studentA1)).send({ activeSeconds: 30 }).expect(200);
      expect(beat1.body.data).toEqual({ ok: true, addedSeconds: 30 });
      const beat2 = await http.post(`/api/v1/lessons/${lesson2}/heartbeat`).set(as(studentA1)).send({ activeSeconds: 30 }).expect(200);
      expect(beat2.body.data.addedSeconds).toBe(0);
      await http.post(`/api/v1/lessons/${lesson2}/heartbeat`).set(as(studentA1)).send({ activeSeconds: 500 }).expect(422);
    });
  });

  describe('statistika', () => {
    it('/stats/me — talaba bo‘lmasa yoki guruhsiz bo‘lsa null', async () => {
      expect((await http.get('/api/v1/stats/me').set(as(teacherA)).expect(200)).body).toEqual({ data: null });
      expect((await http.get('/api/v1/stats/me').set(as(admin)).expect(200)).body).toEqual({ data: null });
      expect((await http.get('/api/v1/stats/me').set(as(loner)).expect(200)).body).toEqual({ data: null });

      const me = await http.get('/api/v1/stats/me').set(as(studentA1)).expect(200);
      expect(me.body.data).toMatchObject({ studentId: studentA1.id, lessonsTotal: 3, lessonsCompleted: 1, progressPercent: 33 });
      expect(me.body.data.assignmentsSubmitted).toBeGreaterThan(0);
    });

    it('guruh statistikasi — faqat guruh o‘qituvchisi va SA', async () => {
      const g = await http.get(`/api/v1/stats/groups/${groupA}`).set(as(teacherA)).expect(200);
      expect(g.body.data).toMatchObject({ groupId: groupA, studentCount: 2 });
      expect(g.body.data.pendingSubmissions).toBeGreaterThan(0);
      await http.get(`/api/v1/stats/groups/${groupA}`).set(as(admin)).expect(200);
      await http.get(`/api/v1/stats/groups/${groupA}`).set(as(teacherB)).expect(404);
      await http.get(`/api/v1/stats/groups/${groupA}`).set(as(studentA1)).expect(403);

      const rows = await http.get(`/api/v1/stats/groups/${groupA}/students`).set(as(teacherA)).expect(200);
      expect(rows.body.data).toHaveLength(2);
      expect(rows.body.data[0]).toMatchObject({
        student: { id: expect.any(String), email: expect.any(String) },
        totalStudyTimeSec: expect.any(Number),
        risks: expect.any(Array),
      });
      await http.get(`/api/v1/stats/groups/${groupA}/students`).set(as(teacherB)).expect(404);
    });

    it('talaba overview va timeline — egalik tekshiruvi', async () => {
      const own = await http.get(`/api/v1/stats/students/${studentA1.id}/overview`).set(as(studentA1)).expect(200);
      expect(own.body.data).toMatchObject({ studentId: studentA1.id, totalStudyTimeSec: 30, weeklyActivity: expect.any(Object) });
      expect(own.body.data.weeklyActivity.LESSON_HEARTBEAT).toBe(1);

      await http.get(`/api/v1/stats/students/${studentA1.id}/overview`).set(as(teacherA)).expect(200);
      await http.get(`/api/v1/stats/students/${studentA1.id}/overview`).set(as(teacherB)).expect(404);
      await http.get(`/api/v1/stats/students/${studentA1.id}/overview`).set(as(studentA2)).expect(404);

      const tl = await http.get(`/api/v1/stats/students/${studentA1.id}/timeline`).set(as(teacherA)).expect(200);
      const types = tl.body.data.map((e: { type: string }) => e.type);
      expect(types).toEqual(expect.arrayContaining(['LESSON_COMPLETE', 'LESSON_HEARTBEAT', 'ASSIGNMENT_SUBMIT']));

      const future = await http
        .get(`/api/v1/stats/students/${studentA1.id}/timeline?from=${inHours(1).toISOString()}&to=${inHours(2).toISOString()}`)
        .set(as(teacherA))
        .expect(200);
      expect(future.body.data).toEqual([]);
      await http.get(`/api/v1/stats/students/${studentA1.id}/timeline?from=yesterday`).set(as(teacherA)).expect(422);
    });
  });
});
