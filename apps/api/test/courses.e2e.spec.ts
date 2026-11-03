import { createRequire } from 'node:module';

import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

import { StorageService } from '../src/infra/storage.service';
import { type FakeStorage, type Http, createApp, createUser, loginAdmin } from './app';

type User = Awaited<ReturnType<typeof createUser>>;

/** mammoth o'qiy oladigan eng kichik .docx (jszip — mammoth'ning o'z bog'liqligi). */
async function makeDocx(text: string): Promise<Buffer> {
  const JSZip = createRequire(require.resolve('mammoth'))('jszip');
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`,
  );
  return zip.generateAsync({ type: 'nodebuffer' });
}

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

describe('courses', () => {
  let app: INestApplication;
  let http: Http;
  let prisma: PrismaClient;
  let storage: FakeStorage;
  let admin: string;
  let teacherA: User;
  let teacherB: User;
  /** A guruhida, kurs biriktirilgan. */
  let student: User;
  /** Boshqa guruhda (kurs biriktirilmagan). */
  let outsider: User;
  /** Guruhsiz. */
  let loner: User;
  let groupId: string;
  let seq = 0;

  const as = (u: string | User) => ({ Authorization: `Bearer ${typeof u === 'string' ? u : u.token}` });
  const slug = (p: string) => `${p}-${Date.now()}-${++seq}`;

  async function createCourse(owner: string | User, body: Record<string, unknown> = {}) {
    const res = await http
      .post('/api/v1/courses')
      .set(as(owner))
      .send({ slug: slug('kurs'), nameUz: 'Ekologiya asoslari', ...body })
      .expect(201);
    return res.body.data as { id: string; slug: string; ownerId: string; lessonsCount: number };
  }

  async function createLesson(owner: string | User, courseId: string, orderIndex: number, body: Record<string, unknown> = {}) {
    const res = await http
      .post('/api/v1/lessons')
      .set(as(owner))
      .send({ courseId, orderIndex, lessonType: 'MARUZA', titleUz: `Dars ${orderIndex}`, theoryUz: 'Nazariya', ...body })
      .expect(201);
    return res.body.data as { id: string; moduleId: string | null };
  }

  const bind = (courseId: string, gid = groupId) => prisma.courseGroup.create({ data: { courseId, groupId: gid } });

  beforeAll(async () => {
    const created = await createApp();
    ({ app, http } = created);
    prisma = created.prisma;
    storage = app.get(StorageService) as unknown as FakeStorage;
    admin = (await loginAdmin(http)).token;
    teacherA = await createUser(http, admin, 'TEACHER');
    teacherB = await createUser(http, admin, 'TEACHER');
    student = await createUser(http, teacherA.token, 'STUDENT');
    outsider = await createUser(http, teacherB.token, 'STUDENT');
    loner = await createUser(http, teacherA.token, 'STUDENT');

    const group = await prisma.group.create({ data: { nameUz: 'A guruh', teacherId: teacherA.id } });
    groupId = group.id;
    await prisma.groupMember.create({ data: { groupId, studentId: student.id } });
    const other = await prisma.group.create({ data: { nameUz: 'B guruh', teacherId: teacherB.id } });
    await prisma.groupMember.create({ data: { groupId: other.id, studentId: outsider.id } });
  });
  afterAll(() => app.close());

  describe("faqat oliy ta'lim", () => {
    it("darajalar endpointi yo'q; kurs har doim oliy-talim bo'ladi", async () => {
      await http.get('/api/v1/education-levels').set(as(admin)).expect(404);
      const course = await createCourse(teacherA, { educationLevel: 'maktab' });
      expect(course.educationLevel).toBe('oliy-talim');
    });

    it("boshqa darajadagi eski kurslar hech kimga ko'rinmaydi va tahrirlanmaydi", async () => {
      const old = await prisma.course.create({
        data: { slug: slug('eski'), nameUz: 'Eski maktab kursi', educationLevel: 'maktab', isPublished: true, ownerId: teacherA.id },
      });
      const list = await http.get('/api/v1/courses?perPage=100').set(as(admin)).expect(200);
      expect(list.body.data.map((c: { id: string }) => c.id)).not.toContain(old.id);
      await http.get(`/api/v1/courses/${old.id}`).set(as(admin)).expect(404);
      await http.get(`/api/v1/courses/slug/${old.slug}`).set(as(teacherA)).expect(404);
      await http.patch(`/api/v1/courses/${old.id}`).set(as(teacherA)).send({ nameUz: 'Yangi' }).expect(404);
    });
  });

  describe('courses CRUD va egalik', () => {
    it("yaratish: egasi — yaratuvchi; talaba yarata olmaydi; validatsiya", async () => {
      const course = await createCourse(teacherA);
      expect(course).toMatchObject({ ownerId: teacherA.id, lessonsCount: 0, visibility: 'PRIVATE', isPublished: false });

      await http.post('/api/v1/courses').set(as(student)).send({ slug: slug('x'), nameUz: 'Xx' }).expect(403);
      const bad = await http.post('/api/v1/courses').set(as(teacherA)).send({ slug: 'Katta Harf', nameUz: 'X' }).expect(422);
      expect(bad.body.errors).toHaveProperty('slug');
      await http.post('/api/v1/courses').set(as(teacherB)).send({ slug: course.slug, nameUz: 'Yy' }).expect(409);
    });

    it("begona PRIVATE kurs o'qituvchiga ko'rinmaydi (404), LIBRARY ko'rinadi lekin tahrirlanmaydi (403)", async () => {
      const priv = await createCourse(teacherA, { nameUz: 'Maxfiy kurs' });
      const lib = await createCourse(teacherA, { nameUz: 'Kutubxona kursi', visibility: 'LIBRARY' });

      for (const path of [`/courses/${priv.id}`, `/courses/slug/${priv.slug}`, `/courses/${priv.id}/lessons`, `/courses/${priv.id}/modules`, `/courses/${priv.id}/materials`]) {
        await http.get(`/api/v1${path}`).set(as(teacherB)).expect(404);
      }
      await http.patch(`/api/v1/courses/${priv.id}`).set(as(teacherB)).send({ nameUz: 'Buzildi' }).expect(404);

      await http.get(`/api/v1/courses/${lib.id}`).set(as(teacherB)).expect(200);
      await http.get(`/api/v1/courses/slug/${lib.slug.toUpperCase()}`).set(as(teacherB)).expect(200);
      await http.patch(`/api/v1/courses/${lib.id}`).set(as(teacherB)).send({ nameUz: 'Buzildi' }).expect(403);
      await http.post('/api/v1/lessons').set(as(teacherB)).send({ courseId: lib.id, orderIndex: 0, lessonType: 'AMALIY', titleUz: 'Begona' }).expect(403);

      const list = await http.get('/api/v1/courses?perPage=100').set(as(teacherB)).expect(200);
      const ids = list.body.data.map((c: { id: string }) => c.id);
      expect(ids).toContain(lib.id);
      expect(ids).not.toContain(priv.id);

      // Qidiruv o'qituvchi filtrini bekor qilmasligi kerak (eski OR-ustma-ust xatosi).
      const search = await http.get('/api/v1/courses?search=Maxfiy&perPage=100').set(as(teacherB)).expect(200);
      expect(search.body.data.map((c: { id: string }) => c.id)).not.toContain(priv.id);
      const own = await http.get('/api/v1/courses?search=Maxfiy&perPage=100').set(as(teacherA)).expect(200);
      expect(own.body.data.map((c: { id: string }) => c.id)).toContain(priv.id);

      const all = await http.get('/api/v1/courses?perPage=100').set(as(admin)).expect(200);
      expect(all.body.data.map((c: { id: string }) => c.id)).toEqual(expect.arrayContaining([priv.id, lib.id]));
    });

    it('egasi tahrirlaydi; filtrlar; sahifalash', async () => {
      const course = await createCourse(teacherA, { educationLevel: 'oliy-talim' });
      const res = await http
        .patch(`/api/v1/courses/${course.id}`)
        .set(as(teacherA))
        .send({ nameUz: 'Yangi nom', isPublished: true, descriptionUz: null })
        .expect(200);
      expect(res.body.data).toMatchObject({ nameUz: 'Yangi nom', isPublished: true, descriptionUz: null });

      const published = await http.get('/api/v1/courses?isPublished=true&educationLevel=oliy-talim&perPage=100').set(as(teacherA)).expect(200);
      expect(published.body.data.every((c: { isPublished: boolean; educationLevel: string }) => c.isPublished && c.educationLevel === 'oliy-talim')).toBe(true);
      expect(published.body.data.map((c: { id: string }) => c.id)).toContain(course.id);
      const drafts = await http.get('/api/v1/courses?isPublished=false&perPage=100').set(as(teacherA)).expect(200);
      expect(drafts.body.data.map((c: { id: string }) => c.id)).not.toContain(course.id);

      const page = await http.get('/api/v1/courses?perPage=1&page=2').set(as(admin)).expect(200);
      expect(page.body.data).toHaveLength(1);
      expect(page.body.meta).toMatchObject({ page: 2, perPage: 1 });
      expect(page.body.meta.total).toBeGreaterThan(1);
    });

    it("o'chirish — faqat SA; materiallar fayllari ham o'chadi", async () => {
      const course = await createCourse(teacherA);
      const up = await http
        .post(`/api/v1/courses/${course.id}/materials`)
        .set(as(teacherA))
        .attach('file', Buffer.from('salom'), { filename: 'a.txt', contentType: 'text/plain' })
        .expect(201);
      const { storageKey } = await prisma.courseMaterial.findUniqueOrThrow({ where: { id: up.body.data.id } });
      expect(storage.files.has(storageKey)).toBe(true);

      await http.delete(`/api/v1/courses/${course.id}`).set(as(teacherA)).expect(403);
      await http.delete(`/api/v1/courses/${course.id}`).set(as(admin)).expect(200);
      await http.get(`/api/v1/courses/${course.id}`).set(as(admin)).expect(404);
      expect(storage.files.has(storageKey)).toBe(false);
    });

    it("noto'g'ri UUID — 400; /lessons/:id ko'p segmentli yo'llarni yutmaydi", async () => {
      await http.get('/api/v1/courses/not-a-uuid').set(as(admin)).expect(400);
      await http.get('/api/v1/lessons/not-a-uuid').set(as(admin)).expect(400);
      const res = await http.get('/api/v1/lessons/progress/me').set(as(student));
      expect(res.status).not.toBe(400);
    });
  });

  describe('talaba ko‘rinishi', () => {
    let course: { id: string; slug: string };
    let draft: { id: string; slug: string };

    beforeAll(async () => {
      course = await createCourse(teacherA, { isPublished: true });
      draft = await createCourse(teacherA, { isPublished: false });
      await bind(course.id);
      await bind(draft.id);
    });

    it("faqat o'z faol guruhiga biriktirilgan, nashr etilgan kurslar", async () => {
      const list = await http.get('/api/v1/courses?perPage=100&isPublished=false').set(as(student)).expect(200);
      const ids = list.body.data.map((c: { id: string }) => c.id);
      expect(ids).toContain(course.id);
      expect(ids).not.toContain(draft.id);
      await http.get(`/api/v1/courses/${course.id}`).set(as(student)).expect(200);
      await http.get(`/api/v1/courses/slug/${course.slug}`).set(as(student)).expect(200);
      await http.get(`/api/v1/courses/${draft.id}`).set(as(student)).expect(404);

      // Boshqa guruh talabasi va guruhsiz talaba.
      await http.get(`/api/v1/courses/${course.id}`).set(as(outsider)).expect(404);
      await http.get(`/api/v1/courses/${course.id}/lessons`).set(as(outsider)).expect(404);
      const none = await http.get('/api/v1/courses').set(as(loner)).expect(200);
      expect(none.body).toEqual({ data: [], meta: { page: 1, perPage: 20, total: 0, totalPages: 1 } });

      // Talaba yozuv amallarini bajara olmaydi.
      await http.patch(`/api/v1/courses/${course.id}`).set(as(student)).send({ nameUz: 'Xx' }).expect(403);
    });

    it("nofaol guruh talabasi hech narsa ko'rmaydi", async () => {
      await prisma.group.update({ where: { id: groupId }, data: { isActive: false } });
      try {
        await http.get(`/api/v1/courses/${course.id}`).set(as(student)).expect(404);
        const list = await http.get('/api/v1/courses').set(as(student)).expect(200);
        expect(list.body.data).toEqual([]);
      } finally {
        await prisma.group.update({ where: { id: groupId }, data: { isActive: true } });
      }
    });

    it('darslar: yashirin/arxiv/nashr etilmagan modul — talabaga yopiq; lessonsCount shunga mos', async () => {
      const visible = await createLesson(teacherA, course.id, 0);
      const hidden = await createLesson(teacherA, course.id, 1, { isPublished: false });
      const draftModule = await http.post('/api/v1/modules').set(as(teacherA)).send({ courseId: course.id, titleUz: 'Qoralama', isPublished: false }).expect(201);
      const inDraftModule = await createLesson(teacherA, course.id, 2, { moduleId: draftModule.body.data.id });
      const archived = await createLesson(teacherA, course.id, 3);
      const del = await http.delete(`/api/v1/lessons/${archived.id}`).set(as(teacherA)).expect(200);
      expect(del.body.data).toEqual({ ok: true, archived: true });

      const studentLessons = await http.get(`/api/v1/courses/${course.id}/lessons`).set(as(student)).expect(200);
      expect(studentLessons.body.data.map((l: { id: string }) => l.id)).toEqual([visible.id]);
      const teacherLessons = await http.get(`/api/v1/courses/${course.id}/lessons`).set(as(teacherA)).expect(200);
      expect(teacherLessons.body.data).toHaveLength(4);
      expect(teacherLessons.body.data.find((l: { id: string }) => l.id === archived.id).archivedAt).toEqual(expect.any(String));

      const detail = await http.get(`/api/v1/courses/${course.id}`).set(as(student)).expect(200);
      expect(detail.body.data.lessonsCount).toBe(1);
      const teacherDetail = await http.get(`/api/v1/courses/${course.id}`).set(as(teacherA)).expect(200);
      expect(teacherDetail.body.data.lessonsCount).toBe(4);

      const one = await http.get(`/api/v1/lessons/${visible.id}`).set(as(student)).expect(200);
      expect(one.body.data).toMatchObject({ id: visible.id, theoryUz: 'Nazariya', procedureUz: [], course: { id: course.id, slug: course.slug } });
      expect(Object.keys(one.body.data.course).sort()).toEqual(['id', 'nameUz', 'slug']);
      for (const l of [hidden, inDraftModule, archived]) {
        await http.get(`/api/v1/lessons/${l.id}`).set(as(student)).expect(404);
      }
      await http.get(`/api/v1/lessons/${visible.id}`).set(as(outsider)).expect(404);
      await http.get(`/api/v1/lessons/${visible.id}`).set(as(teacherB)).expect(404);

      // Talabaga modul ro'yxatida faqat nashr etilganlar.
      const mods = await http.get(`/api/v1/courses/${course.id}/modules`).set(as(student)).expect(200);
      expect(mods.body.data.map((m: { id: string }) => m.id)).not.toContain(draftModule.body.data.id);
    });

    it('release: LOCKED dars mazmuni kesiladi va ochilmaydi; modul release ham amal qiladi', async () => {
      const mod = await http.post('/api/v1/modules').set(as(teacherA)).send({ courseId: course.id, titleUz: 'Ikkinchi bo‘lim' }).expect(201);
      const locked = await createLesson(teacherA, course.id, 10, { objectiveUz: 'Maqsad', procedureUz: ['1-qadam'] });
      const viaModule = await createLesson(teacherA, course.id, 11, { moduleId: mod.body.data.id });
      const scheduled = await createLesson(teacherA, course.id, 12);
      await prisma.groupLessonRelease.create({ data: { groupId, lessonId: locked.id, status: 'LOCKED' } });
      await prisma.groupLessonRelease.create({ data: { groupId, moduleId: mod.body.data.id, status: 'LOCKED' } });
      await prisma.groupLessonRelease.create({
        data: { groupId, lessonId: scheduled.id, status: 'SCHEDULED', opensAt: new Date(Date.now() - 60_000) },
      });

      const list = await http.get(`/api/v1/courses/${course.id}/lessons`).set(as(student)).expect(200);
      const byId = new Map(list.body.data.map((l: { id: string }) => [l.id, l]));
      expect(byId.get(locked.id)).toMatchObject({ titleUz: 'Dars 10', theoryUz: null, objectiveUz: null, procedureUz: [] });
      expect(byId.get(viaModule.id)).toMatchObject({ theoryUz: null });
      expect(byId.get(scheduled.id)).toMatchObject({ theoryUz: 'Nazariya' });

      const closed = await http.get(`/api/v1/lessons/${locked.id}`).set(as(student)).expect(404);
      expect(closed.body.title).toBe('Dars hali ochilmagan');
      await http.get(`/api/v1/lessons/${viaModule.id}`).set(as(student)).expect(404);
      await http.get(`/api/v1/lessons/${scheduled.id}`).set(as(student)).expect(200);
      // O'qituvchi uchun release ahamiyatsiz.
      await http.get(`/api/v1/lessons/${locked.id}`).set(as(teacherA)).expect(200);
    });

    it("nashr etilgan kursga dars qo'shilsa talabaga bildirishnoma", async () => {
      const lesson = await createLesson(teacherA, course.id, 20, { titleUz: 'Suv resurslari' });
      const notes = await prisma.notification.findMany({ where: { userId: student.id, type: 'LESSON_CREATED' } });
      expect(notes.some((n) => (n.data as { lessonId?: string }).lessonId === lesson.id)).toBe(true);
      expect(await prisma.notification.count({ where: { userId: outsider.id, type: 'LESSON_CREATED' } })).toBe(0);
      // Qoralama dars — bildirishnomasiz.
      const quiet = await createLesson(teacherA, course.id, 21, { isPublished: false });
      const after = await prisma.notification.findMany({ where: { userId: student.id, type: 'LESSON_CREATED' } });
      expect(after.some((n) => (n.data as { lessonId?: string }).lessonId === quiet.id)).toBe(false);
    });
  });

  describe('darslar CRUD', () => {
    it('tartib to‘qnashuvi 409, begona modul 404, tahrirlash va to‘liq o‘chirish', async () => {
      const course = await createCourse(teacherA);
      const other = await createCourse(teacherA);
      const lesson = await createLesson(teacherA, course.id, 0);
      await createLesson(teacherA, course.id, 1);

      const clash = await http.post('/api/v1/lessons').set(as(teacherA)).send({ courseId: course.id, orderIndex: 0, lessonType: 'MARUZA', titleUz: 'Takror' }).expect(409);
      expect(clash.body.title).toContain('#0');
      await http.patch(`/api/v1/lessons/${lesson.id}`).set(as(teacherA)).send({ orderIndex: 1 }).expect(409);

      const foreignModule = await http.post('/api/v1/modules').set(as(teacherA)).send({ courseId: other.id, titleUz: 'Boshqa kurs moduli' }).expect(201);
      await http.post('/api/v1/lessons').set(as(teacherA)).send({ courseId: course.id, orderIndex: 5, lessonType: 'MARUZA', titleUz: 'Xato modul', moduleId: foreignModule.body.data.id }).expect(404);
      await http.patch(`/api/v1/lessons/${lesson.id}`).set(as(teacherA)).send({ moduleId: foreignModule.body.data.id }).expect(404);

      await http.post('/api/v1/lessons').set(as(teacherA)).send({ courseId: course.id, orderIndex: 5, lessonType: 'NOMA', titleUz: 'X' }).expect(422);
      await http.post('/api/v1/lessons').set(as(teacherB)).send({ courseId: course.id, orderIndex: 5, lessonType: 'MARUZA', titleUz: 'Begona' }).expect(404);
      await http.patch(`/api/v1/lessons/${lesson.id}`).set(as(teacherB)).send({ titleUz: 'Begona' }).expect(404);
      await http.delete(`/api/v1/lessons/${lesson.id}`).set(as(teacherB)).expect(404);

      const patched = await http
        .patch(`/api/v1/lessons/${lesson.id}`)
        .set(as(teacherA))
        .send({ titleUz: '  Yangi sarlavha ', procedureUz: ['a', 'b'], estimatedMinutes: 45, objectiveUz: null, orderIndex: 7 })
        .expect(200);
      expect(patched.body.data).toMatchObject({ titleUz: 'Yangi sarlavha', procedureUz: ['a', 'b'], estimatedMinutes: 45, objectiveUz: null, orderIndex: 7 });

      const hard = await http.delete(`/api/v1/lessons/${lesson.id}?hard=true`).set(as(teacherA)).expect(200);
      expect(hard.body.data).toEqual({ ok: true });
      await http.get(`/api/v1/lessons/${lesson.id}`).set(as(teacherA)).expect(404);
      await http.get(`/api/v1/lessons/${lesson.id}`).set(as(student)).expect(404);
    });
  });

  describe('modullar', () => {
    it("avtomatik tartib, to'qnashuv, o'chirishda darslar 'Umumiy'ga ko'chadi", async () => {
      const course = await createCourse(teacherA);
      const m0 = await http.post('/api/v1/modules').set(as(teacherA)).send({ courseId: course.id, titleUz: 'Birinchi', descriptionUz: 'Tavsif', isPublished: true }).expect(201);
      const m1 = await http.post('/api/v1/modules').set(as(teacherA)).send({ courseId: course.id, titleUz: 'Ikkinchi' }).expect(201);
      expect(m0.body.data).toMatchObject({ orderIndex: 0, courseId: course.id, descriptionUz: 'Tavsif', isPublished: true });
      expect(m1.body.data.orderIndex).toBe(1);
      await http.post('/api/v1/modules').set(as(teacherA)).send({ courseId: course.id, titleUz: 'Takror', orderIndex: 1 }).expect(409);
      await http.post('/api/v1/modules').set(as(teacherA)).send({ courseId: course.id, titleUz: 'X' }).expect(422);
      await http.post('/api/v1/modules').set(as(teacherB)).send({ courseId: course.id, titleUz: 'Begona' }).expect(404);
      await http.patch(`/api/v1/modules/${m0.body.data.id}`).set(as(teacherB)).send({ titleUz: 'Begona' }).expect(404);
      await http.patch(`/api/v1/modules/${m0.body.data.id}`).set(as(teacherA)).send({ orderIndex: 1 }).expect(409);

      const upd = await http.patch(`/api/v1/modules/${m0.body.data.id}`).set(as(teacherA)).send({ titleUz: 'Kirish', isPublished: false }).expect(200);
      expect(upd.body.data).toMatchObject({ titleUz: 'Kirish', isPublished: false });

      await createLesson(teacherA, course.id, 0, { moduleId: m0.body.data.id });
      await createLesson(teacherA, course.id, 1, { moduleId: m0.body.data.id });
      const del = await http.delete(`/api/v1/modules/${m0.body.data.id}`).set(as(teacherA)).expect(200);
      expect(del.body.data).toEqual({ movedLessonCount: 2 });

      const mods = await http.get(`/api/v1/courses/${course.id}/modules`).set(as(teacherA)).expect(200);
      const general = mods.body.data.find((m: { titleUz: string }) => m.titleUz === 'Umumiy');
      expect(general).toBeDefined();
      const lessons = await http.get(`/api/v1/courses/${course.id}/lessons`).set(as(teacherA)).expect(200);
      expect(lessons.body.data.every((l: { moduleId: string }) => l.moduleId === general.id)).toBe(true);

      // "Umumiy"ning o'zi o'chirilsa — darslar modulsiz qoladi.
      const del2 = await http.delete(`/api/v1/modules/${general.id}`).set(as(teacherA)).expect(200);
      expect(del2.body.data).toEqual({ movedLessonCount: 2 });
      const after = await http.get(`/api/v1/courses/${course.id}/lessons`).set(as(teacherA)).expect(200);
      expect(after.body.data.every((l: { moduleId: string | null }) => l.moduleId === null)).toBe(true);
    });
  });

  describe('materiallar', () => {
    let course: { id: string };
    let lessonId: string;

    beforeAll(async () => {
      course = await createCourse(teacherA, { isPublished: true });
      await bind(course.id);
      lessonId = (await createLesson(teacherA, course.id, 0)).id;
    });

    it('yuklash: docx/txt matni indekslanadi, fayl storage’da', async () => {
      const docx = await http
        .post(`/api/v1/courses/${course.id}/materials?lessonId=${lessonId}`)
        .set(as(teacherA))
        .attach('file', await makeDocx('Atmosfera ifloslanishi'), { filename: 'Ma‘ruza 1.docx', contentType: DOCX })
        .expect(201);
      expect(docx.body.data).toMatchObject({ courseId: course.id, lessonId, mimeType: DOCX, uploadedBy: teacherA.id });
      expect(Object.keys(docx.body.data).sort()).toEqual(['courseId', 'createdAt', 'fileName', 'id', 'lessonId', 'mimeType', 'sizeBytes', 'uploadedBy']);
      const row = await prisma.courseMaterial.findUniqueOrThrow({ where: { id: docx.body.data.id } });
      expect(row.contentText).toContain('Atmosfera ifloslanishi');
      expect(storage.files.get(row.storageKey)?.length).toBe(docx.body.data.sizeBytes);

      const txt = await http
        .post(`/api/v1/courses/${course.id}/materials`)
        .set(as(teacherA))
        .attach('file', Buffer.from('Oddiy matn\u0000'), { filename: 'Дарс режа.txt', contentType: 'text/plain' })
        .expect(201);
      expect(txt.body.data).toMatchObject({ lessonId: null, fileName: 'Дарс_режа.txt' });
      expect((await prisma.courseMaterial.findUniqueOrThrow({ where: { id: txt.body.data.id } })).contentText).toBe('Oddiy matn');

      const img = await http
        .post(`/api/v1/courses/${course.id}/materials`)
        .set(as(teacherA))
        .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47]), { filename: 'rasm.png', contentType: 'image/png' })
        .expect(201);
      expect((await prisma.courseMaterial.findUniqueOrThrow({ where: { id: img.body.data.id } })).contentText).toBeNull();
    });

    it('yuklash validatsiyasi va egalik', async () => {
      const file = { filename: 'a.txt', contentType: 'text/plain' };
      await http.post(`/api/v1/courses/${course.id}/materials`).set(as(teacherA)).expect(400);
      await http
        .post(`/api/v1/courses/${course.id}/materials`)
        .set(as(teacherA))
        .attach('file', Buffer.from('MZ'), { filename: 'virus.exe', contentType: 'application/x-msdownload' })
        .expect(422);
      await http.post(`/api/v1/courses/${course.id}/materials?lessonId=nope`).set(as(teacherA)).attach('file', Buffer.from('x'), file).expect(422);
      const otherCourse = await createCourse(teacherA);
      const otherLesson = await createLesson(teacherA, otherCourse.id, 0);
      await http.post(`/api/v1/courses/${course.id}/materials?lessonId=${otherLesson.id}`).set(as(teacherA)).attach('file', Buffer.from('x'), file).expect(404);
      await http.post(`/api/v1/courses/${course.id}/materials`).set(as(teacherB)).attach('file', Buffer.from('x'), file).expect(404);
      await http.post(`/api/v1/courses/${course.id}/materials`).set(as(student)).attach('file', Buffer.from('x'), file).expect(403);
    });

    it("talaba: ro'yxat va yuklab olish ko'rinishga bo'ysunadi", async () => {
      const hiddenLesson = await createLesson(teacherA, course.id, 1, { isPublished: false });
      const lockedLesson = await createLesson(teacherA, course.id, 2);
      await prisma.groupLessonRelease.create({ data: { groupId, lessonId: lockedLesson.id, status: 'LOCKED' } });
      const upload = async (lesson?: string) =>
        (
          await http
            .post(`/api/v1/courses/${course.id}/materials${lesson ? `?lessonId=${lesson}` : ''}`)
            .set(as(teacherA))
            .attach('file', Buffer.from('x'), { filename: 'f.txt', contentType: 'text/plain' })
            .expect(201)
        ).body.data.id as string;
      const open = await upload(lessonId);
      const hidden = await upload(hiddenLesson.id);
      const locked = await upload(lockedLesson.id);

      const list = await http.get(`/api/v1/courses/${course.id}/materials`).set(as(student)).expect(200);
      const ids = list.body.data.map((m: { id: string }) => m.id);
      expect(ids).toEqual(expect.arrayContaining([open, locked]));
      expect(ids).not.toContain(hidden);
      const teacherList = await http.get(`/api/v1/courses/${course.id}/materials`).set(as(teacherA)).expect(200);
      expect(teacherList.body.data.map((m: { id: string }) => m.id)).toContain(hidden);

      const dl = await http.get(`/api/v1/materials/${open}/download`).set(as(student)).expect(200);
      expect(dl.body.data).toEqual({ url: expect.stringContaining('signed=1'), fileName: 'f.txt' });
      await http.get(`/api/v1/materials/${hidden}/download`).set(as(student)).expect(404);
      await http.get(`/api/v1/materials/${locked}/download`).set(as(student)).expect(404);
      await http.get(`/api/v1/materials/${open}/download`).set(as(outsider)).expect(404);
      await http.get(`/api/v1/materials/${open}/download`).set(as(teacherB)).expect(404);
      await http.get(`/api/v1/courses/${course.id}/materials`).set(as(loner)).expect(404);
    });

    it("o'chirish: egasi yoki SA; fayl storage'dan ham o'chadi", async () => {
      const id = (
        await http
          .post(`/api/v1/courses/${course.id}/materials`)
          .set(as(teacherA))
          .attach('file', Buffer.from('y'), { filename: 'del.txt', contentType: 'text/plain' })
          .expect(201)
      ).body.data.id;
      const { storageKey } = await prisma.courseMaterial.findUniqueOrThrow({ where: { id } });
      await http.delete(`/api/v1/materials/${id}`).set(as(teacherB)).expect(404);
      await http.delete(`/api/v1/materials/${id}`).set(as(student)).expect(403);
      await http.delete(`/api/v1/materials/${id}`).set(as(teacherA)).expect(200);
      expect(storage.files.has(storageKey)).toBe(false);
      await http.get(`/api/v1/materials/${id}/download`).set(as(admin)).expect(404);
    });
  });
});
