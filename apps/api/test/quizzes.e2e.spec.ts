import type { INestApplication } from '@nestjs/common';

import type { PrismaService } from '../src/infra/prisma.service';
import { scoreSubmission } from '../src/modules/quizzes/scoring';
import { type Http, createApp, createUser, loginAdmin } from './app';

describe('scoreSubmission (sof)', () => {
  const opts = (correct: string) =>
    ['A', 'B', 'C'].map((key) => ({ key, textUz: key, isCorrect: key === correct }));
  const questions = [
    { id: 'q1', type: 'SINGLE_CHOICE' as const, options: opts('A') },
    { id: 'q2', type: 'SINGLE_CHOICE' as const, options: opts('B') },
    { id: 'q3', type: 'SINGLE_CHOICE' as const, options: opts('C') },
    { id: 'l1', type: 'LIKERT_5' as const, options: [] },
    { id: 'l2', type: 'LIKERT_5' as const, options: [] },
  ];

  it('SINGLE_CHOICE ballanadi, LIKERT faqat yig‘iladi, javobsiz = 0', () => {
    const r = scoreSubmission(
      questions,
      [
        { questionId: 'q1', value: 'a' },
        { questionId: 'q2', value: 'C' },
        { questionId: 'l1', value: '4' },
      ],
      60,
    );
    expect(r).toMatchObject({ scoreTotal: 1, scoreMax: 3, scorePercent: 33, passed: false, likertSum: 4, likertMax: 10 });
    expect(r.answers).toEqual([
      { questionId: 'q1', value: 'A' },
      { questionId: 'q2', value: 'C' },
      { questionId: 'l1', value: '4' },
    ]);
  });

  it('passPercent chegarasi inklyuziv', () => {
    const r = scoreSubmission(questions.slice(0, 2), [{ questionId: 'q1', value: 'A' }], 50);
    expect(r).toMatchObject({ scorePercent: 50, passed: true, likertSum: null, likertMax: null });
  });

  it('faqat Likert — score/passed null', () => {
    const r = scoreSubmission(questions.slice(3), [{ questionId: 'l2', value: '5' }], 60);
    expect(r).toMatchObject({ scoreTotal: null, scoreMax: null, scorePercent: null, passed: null, likertSum: 5, likertMax: 10 });
  });

  it('noto‘g‘ri kirish — 400', () => {
    expect(() => scoreSubmission(questions, [{ questionId: 'x', value: 'A' }], 60)).toThrow(/Noma'lum/);
    expect(() =>
      scoreSubmission(questions, [{ questionId: 'q1', value: 'A' }, { questionId: 'q1', value: 'B' }], 60),
    ).toThrow(/takroriy/);
    expect(() => scoreSubmission(questions, [{ questionId: 'q1', value: 'Z' }], 60)).toThrow(/variant/);
    expect(() => scoreSubmission(questions, [{ questionId: 'l1', value: '6' }], 60)).toThrow(/Likert/);
    expect(() => scoreSubmission([], [{ questionId: 'q1', value: 'A' }], 60)).toThrow(/savollar yo/);
  });
});

describe('quizzes', () => {
  let app: INestApplication;
  let http: Http;
  let prisma: PrismaService;
  let admin: string;
  let teacherA: Awaited<ReturnType<typeof createUser>>;
  let teacherB: Awaited<ReturnType<typeof createUser>>;
  let student: Awaited<ReturnType<typeof createUser>>;
  let outsider: Awaited<ReturnType<typeof createUser>>;
  let groupId: string;

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const choices = (correct: string) =>
    ['A', 'B', 'C', 'D'].map((key) => ({ key, textUz: `Variant ${key}`, isCorrect: key === correct }));

  /** O'qituvchi A nomidan: test + 2 ta SINGLE_CHOICE (A, B to'g'ri) + 1 ta LIKERT. */
  async function makeQuiz(token: string, extra: Record<string, unknown> = {}) {
    const quiz = await http
      .post('/api/v1/quizzes')
      .set(as(token))
      .send({ titleUz: 'Ekologik savodxonlik', passPercent: 60, ...extra })
      .expect(201);
    const id = quiz.body.data.id as string;
    const q1 = await http.post(`/api/v1/quizzes/${id}/questions`).set(as(token)).send({ type: 'SINGLE_CHOICE', textUz: 'Birinchi savol', options: choices('A') }).expect(201);
    const q2 = await http.post(`/api/v1/quizzes/${id}/questions`).set(as(token)).send({ type: 'SINGLE_CHOICE', textUz: 'Ikkinchi savol', options: choices('B') }).expect(201);
    const l1 = await http.post(`/api/v1/quizzes/${id}/questions`).set(as(token)).send({ type: 'LIKERT_5', textUz: 'Likert savol' }).expect(201);
    return { id, q1: q1.body.data.id as string, q2: q2.body.data.id as string, l1: l1.body.data.id as string };
  }

  const publish = (id: string) => http.patch(`/api/v1/quizzes/${id}`).set(as(teacherA.token)).send({ isPublished: true }).expect(200);
  const bind = (quizId: string, data: Record<string, unknown> = {}) => prisma.groupQuiz.create({ data: { quizId, groupId, ...data } });

  beforeAll(async () => {
    ({ app, http, prisma } = await createApp());
    admin = (await loginAdmin(http)).token;
    teacherA = await createUser(http, admin, 'TEACHER');
    teacherB = await createUser(http, admin, 'TEACHER');
    student = await createUser(http, teacherA.token, 'STUDENT');
    outsider = await createUser(http, teacherB.token, 'STUDENT');
    const group = await prisma.group.create({ data: { nameUz: 'A guruh', teacherId: teacherA.id } });
    groupId = group.id;
    await prisma.groupMember.create({ data: { groupId, studentId: student.id } });
  });
  afterAll(() => app.close());

  it("o'qituvchi test va savollarni boshqaradi; admin detail javob kaliti bilan", async () => {
    const { id, q1 } = await makeQuiz(teacherA.token);
    const detail = await http.get(`/api/v1/quizzes/${id}`).set(as(teacherA.token)).expect(200);
    expect(detail.body.data).toMatchObject({ id, lessonId: null, lesson: null, questionCount: 3, submissionCount: 0, isPublished: false });
    expect(detail.body.data.questions.map((q: { orderIndex: number }) => q.orderIndex)).toEqual([0, 1, 2]);
    expect(detail.body.data.questions[0].options[0]).toEqual({ key: 'A', textUz: 'Variant A', isCorrect: true });
    expect(detail.body.data.questions[2]).toMatchObject({ type: 'LIKERT_5', options: [] });

    // orderIndex band — 409
    await http.post(`/api/v1/quizzes/${id}/questions`).set(as(teacherA.token)).send({ type: 'LIKERT_5', textUz: 'Takror', orderIndex: 0 }).expect(409);
    // create sxemasi: 2 ta to'g'ri javob — 422
    const bad = choices('A').map((o) => ({ ...o, isCorrect: true }));
    await http.post(`/api/v1/quizzes/${id}/questions`).set(as(teacherA.token)).send({ type: 'SINGLE_CHOICE', textUz: 'Yomon', options: bad }).expect(422);
    // update ham bir xil qoidalar bilan — 400
    await http.patch(`/api/v1/quizzes/questions/${q1}`).set(as(teacherA.token)).send({ options: bad }).expect(400);
    const upd = await http.patch(`/api/v1/quizzes/questions/${q1}`).set(as(teacherA.token)).send({ textUz: 'Yangilangan savol' }).expect(200);
    expect(upd.body.data).toMatchObject({ id: q1, textUz: 'Yangilangan savol' });

    // qayta tartiblash
    const ids = detail.body.data.questions.map((q: { id: string }) => q.id) as string[];
    await http.patch(`/api/v1/quizzes/${id}/questions/reorder`).set(as(teacherA.token)).send({ questionIds: [...ids].reverse() }).expect(200);
    await http.patch(`/api/v1/quizzes/${id}/questions/reorder`).set(as(teacherA.token)).send({ questionIds: ids.slice(1) }).expect(400);
    const after = await http.get(`/api/v1/quizzes/${id}`).set(as(teacherA.token)).expect(200);
    expect(after.body.data.questions.map((q: { id: string }) => q.id)).toEqual([...ids].reverse());

    await http.delete(`/api/v1/quizzes/questions/${q1}`).set(as(teacherA.token)).expect(204);
    const list = await http.get('/api/v1/quizzes?standaloneOnly=true&perPage=100').set(as(teacherA.token)).expect(200);
    expect(list.body.meta).toMatchObject({ page: 1, perPage: 100 });
    expect(list.body.data.find((q: { id: string }) => q.id === id)).toMatchObject({ questionCount: 2 });
  });

  it("B o'qituvchi A ning testini ko'rmaydi/tahrirlay olmaydi; LIBRARY — faqat ro'yxatda", async () => {
    const { id, q1 } = await makeQuiz(teacherA.token);
    const listB = async () =>
      (await http.get('/api/v1/quizzes?perPage=100').set(as(teacherB.token)).expect(200)).body.data.map((q: { id: string }) => q.id);

    expect(await listB()).not.toContain(id);
    await http.get(`/api/v1/quizzes/${id}`).set(as(teacherB.token)).expect(404);
    await http.patch(`/api/v1/quizzes/${id}`).set(as(teacherB.token)).send({ titleUz: 'Buzildi' }).expect(404);
    await http.delete(`/api/v1/quizzes/${id}`).set(as(teacherB.token)).expect(404);
    await http.post(`/api/v1/quizzes/${id}/questions`).set(as(teacherB.token)).send({ type: 'LIKERT_5', textUz: 'Begona' }).expect(404);
    await http.patch(`/api/v1/quizzes/questions/${q1}`).set(as(teacherB.token)).send({ textUz: 'Begona' }).expect(404);
    await http.get(`/api/v1/quizzes/${id}/submissions`).set(as(teacherB.token)).expect(404);

    await prisma.quiz.update({ where: { id }, data: { visibility: 'LIBRARY' } });
    expect(await listB()).toContain(id);
    await http.get(`/api/v1/quizzes/${id}`).set(as(teacherB.token)).expect(404); // javob kaliti yo'q
    await http.patch(`/api/v1/quizzes/${id}`).set(as(teacherB.token)).send({ titleUz: 'Buzildi' }).expect(403);
    await http.delete(`/api/v1/quizzes/${id}`).set(as(teacherB.token)).expect(403);

    // SA hammasini boshqaradi
    await http.patch(`/api/v1/quizzes/${id}`).set(as(admin)).send({ titleUz: 'SA tahriri' }).expect(200);
    await http.delete(`/api/v1/quizzes/${id}`).set(as(admin)).expect(204);
  });

  it("talaba /quizzes ga kira olmaydi", async () => {
    await http.get('/api/v1/quizzes').set(as(student.token)).expect(403);
  });

  it('biriktirilmagan yoki nashr qilinmagan test — 404', async () => {
    const { id, q1 } = await makeQuiz(teacherA.token);
    await publish(id);
    await http.get(`/api/v1/my-quizzes/${id}/take`).set(as(student.token)).expect(404);
    await http.post(`/api/v1/my-quizzes/${id}/submissions`).set(as(student.token)).send({ answers: [{ questionId: q1, value: 'A' }] }).expect(404);
    const eco = await http.get('/api/v1/my-quizzes/ekologik').set(as(student.token)).expect(200);
    expect(eco.body.data.map((q: { id: string }) => q.id)).not.toContain(id);

    // biriktirilgan, lekin nashrdan olingan
    await bind(id);
    await http.patch(`/api/v1/quizzes/${id}`).set(as(teacherA.token)).send({ isPublished: false }).expect(200);
    await http.get(`/api/v1/my-quizzes/${id}/take`).set(as(student.token)).expect(404);

    // boshqa guruhsiz talaba va o'qituvchi (oldindan ko'rish yo'q — eski xatti-harakat)
    await publish(id);
    await http.get(`/api/v1/my-quizzes/${id}/take`).set(as(outsider.token)).expect(404);
    await http.get(`/api/v1/my-quizzes/${id}/take`).set(as(teacherA.token)).expect(404);
    expect((await http.get('/api/v1/my-quizzes/ekologik').set(as(teacherA.token)).expect(200)).body.data).toEqual([]);
  });

  it("yechish: to'g'ri javoblar oshkor qilinmaydi, baholash, urinishlar chegarasi, natijalar", async () => {
    const { id, q1, q2, l1 } = await makeQuiz(teacherA.token);
    await publish(id);
    await bind(id, { maxAttempts: 2 });
    await prisma.quiz.update({ where: { id }, data: { timeLimitMinutes: 15 } });
    const assignment = await prisma.assignment.create({
      data: { groupId, createdById: teacherA.id, kind: 'QUESTIONNAIRE', titleUz: 'So‘rovnoma', maxScore: 20, quizId: id },
    });

    const eco = await http.get('/api/v1/my-quizzes/ekologik').set(as(student.token)).expect(200);
    expect(eco.body.data.find((q: { id: string }) => q.id === id)).toMatchObject({
      questionCount: 3,
      binding: { maxAttempts: 2, attemptsUsed: 0, timeLimitMinutes: 15, opensAt: null, closesAt: null },
    });

    const take = await http.get(`/api/v1/my-quizzes/${id}/take`).set(as(student.token)).expect(200);
    expect(JSON.stringify(take.body)).not.toContain('isCorrect');
    expect(take.body.data.questions[0].options[0]).toEqual({ key: 'A', textUz: 'Variant A' });

    const answers = [
      { questionId: q1, value: 'a' },
      { questionId: q2, value: 'C' },
      { questionId: l1, value: '4' },
    ];
    const sub = await http.post(`/api/v1/my-quizzes/${id}/submissions`).set(as(student.token)).send({ answers }).expect(201);
    expect(sub.body.data).toMatchObject({
      quizId: id,
      userId: student.id,
      status: 'SUBMITTED',
      scoreTotal: 1,
      scoreMax: 2,
      scorePercent: 50,
      passed: false,
      likertSum: 4,
      likertMax: 5,
    });
    expect(JSON.stringify(sub.body)).not.toContain('isCorrect');

    // QUESTIONNAIRE topshirig'iga avto-baho: 50% × 20
    const graded = await prisma.assignmentSubmission.findUniqueOrThrow({
      where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: student.id } },
    });
    expect(graded).toMatchObject({ status: 'GRADED', score: 10 });
    // Guruh o'qituvchisiga (= egasi) bitta bildirishnoma
    expect(await prisma.notification.count({ where: { userId: teacherA.id, type: 'QUIZ_SUBMITTED' } })).toBe(1);

    const full = [
      { questionId: q1, value: 'A' },
      { questionId: q2, value: 'B' },
    ];
    const second = await http.post(`/api/v1/my-quizzes/${id}/submissions`).set(as(student.token)).send({ answers: full }).expect(201);
    expect(second.body.data).toMatchObject({ scorePercent: 100, passed: true, likertSum: 0, likertMax: 5 });
    const third = await http.post(`/api/v1/my-quizzes/${id}/submissions`).set(as(student.token)).send({ answers: full });
    expect(third.status).toBe(400);
    expect(third.body.title).toMatch(/Urinishlar/);

    const mine = await http.get(`/api/v1/my-quizzes/${id}/my-submissions`).set(as(student.token)).expect(200);
    expect(mine.body.data).toHaveLength(2);

    const detail = await http.get(`/api/v1/my-quizzes/submissions/${sub.body.data.id}`).set(as(student.token)).expect(200);
    expect(detail.body.data.answers.map((a: { value: string }) => a.value).sort()).toEqual(['4', 'A', 'C']);
    await http.get(`/api/v1/my-quizzes/submissions/${sub.body.data.id}`).set(as(outsider.token)).expect(404);

    // O'qituvchi natijalari: egasi — hammasi; LIBRARY orqali B — faqat o'z guruhi talabalari
    const results = await http.get(`/api/v1/quizzes/${id}/submissions?perPage=10`).set(as(teacherA.token)).expect(200);
    expect(results.body.meta).toMatchObject({ total: 2, perPage: 10 });
    expect(results.body.data[0].user).toMatchObject({ id: student.id, email: student.email });
    await prisma.quiz.update({ where: { id }, data: { visibility: 'LIBRARY' } });
    const resultsB = await http.get(`/api/v1/quizzes/${id}/submissions`).set(as(teacherB.token)).expect(200);
    expect(resultsB.body.meta.total).toBe(0);
  });

  it('noto‘g‘ri javoblar — 400/422', async () => {
    const { id, q1 } = await makeQuiz(teacherA.token);
    await publish(id);
    await bind(id);
    const send = (answers: unknown) => http.post(`/api/v1/my-quizzes/${id}/submissions`).set(as(student.token)).send({ answers });
    expect((await send([])).status).toBe(422);
    expect((await send([{ questionId: q1, value: 'Z' }])).status).toBe(400);
    expect((await send([{ questionId: '00000000-0000-7000-8000-000000000000', value: 'A' }])).status).toBe(400);
  });

  it('oyna: hali ochilmagan / yopilgan', async () => {
    const future = await makeQuiz(teacherA.token);
    await publish(future.id);
    await bind(future.id, { opensAt: new Date(Date.now() + 3_600_000) });
    await http.get(`/api/v1/my-quizzes/${future.id}/take`).set(as(student.token)).expect(403);
    await http.post(`/api/v1/my-quizzes/${future.id}/submissions`).set(as(student.token)).send({ answers: [{ questionId: future.q1, value: 'A' }] }).expect(400);

    const closed = await makeQuiz(teacherA.token);
    await publish(closed.id);
    await bind(closed.id, { closesAt: new Date(Date.now() - 60_000) });
    await http.get(`/api/v1/my-quizzes/${closed.id}/take`).set(as(student.token)).expect(403);
    const late = await http.post(`/api/v1/my-quizzes/${closed.id}/submissions`).set(as(student.token)).send({ answers: [{ questionId: closed.q1, value: 'A' }] });
    expect(late.status).toBe(400);

    // Yopilgandan keyin ham avval topshirgan talaba natija sahifasi uchun savollarni oladi
    await prisma.quizSubmission.create({ data: { quizId: closed.id, userId: student.id, status: 'SUBMITTED', submittedAt: new Date() } });
    await http.get(`/api/v1/my-quizzes/${closed.id}/take`).set(as(student.token)).expect(200);
  });

  it('nofaol guruh — 403', async () => {
    const { id } = await makeQuiz(teacherA.token);
    await publish(id);
    await bind(id);
    await prisma.group.update({ where: { id: groupId }, data: { isActive: false } });
    try {
      await http.get(`/api/v1/my-quizzes/${id}/take`).set(as(student.token)).expect(403);
    } finally {
      await prisma.group.update({ where: { id: groupId }, data: { isActive: true } });
    }
  });

  it("dars testlari: by-lesson faqat guruhga biriktirilgan va nashr qilinganlar", async () => {
    const course = await prisma.course.create({
      data: { slug: `kurs-${Date.now()}`, nameUz: 'Kurs', educationLevel: 'oliy-talim', ownerId: teacherA.id },
    });
    const lesson = await prisma.lesson.create({
      data: { courseId: course.id, orderIndex: 0, lessonType: 'MARUZA', titleUz: 'Dars 1' },
    });
    // B o'qituvchi begona kurs darsiga test qo'sha olmaydi
    await http.post('/api/v1/quizzes').set(as(teacherB.token)).send({ titleUz: 'Begona', lessonId: lesson.id }).expect(404);

    const bound = await makeQuiz(teacherA.token, { lessonId: lesson.id });
    const unbound = await makeQuiz(teacherA.token, { lessonId: lesson.id });
    await publish(bound.id);
    await publish(unbound.id);
    await bind(bound.id);

    const res = await http.get(`/api/v1/my-quizzes/by-lesson/${lesson.id}`).set(as(student.token)).expect(200);
    expect(res.body.data.map((q: { id: string }) => q.id)).toEqual([bound.id]);
    expect((await http.get(`/api/v1/my-quizzes/by-lesson/${lesson.id}`).set(as(teacherA.token)).expect(200)).body.data).toEqual([]);

    const take = await http.get(`/api/v1/my-quizzes/${bound.id}/take`).set(as(student.token)).expect(200);
    expect(take.body.data.lesson).toMatchObject({ id: lesson.id, titleUz: 'Dars 1', course: { id: course.id, nameUz: 'Kurs' } });

    // standaloneOnly dars testlarini chiqarmaydi; ekologik ham
    const standalone = await http.get('/api/v1/quizzes?standaloneOnly=true&perPage=100').set(as(teacherA.token)).expect(200);
    expect(standalone.body.data.map((q: { id: string }) => q.id)).not.toContain(bound.id);
    const eco = await http.get('/api/v1/my-quizzes/ekologik').set(as(student.token)).expect(200);
    expect(eco.body.data.map((q: { id: string }) => q.id)).not.toContain(bound.id);
  });
});
