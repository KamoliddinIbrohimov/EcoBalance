import sharp from 'sharp';
import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

import { StorageService } from '../src/infra/storage.service';
import { NotificationsService } from '../src/modules/platform/notifications.service';
import { type FakeStorage, type Http, createApp, createUser, loginAdmin } from './app';

describe('platform', () => {
  let app: INestApplication;
  let http: Http;
  let prisma: PrismaClient;
  let admin: string;
  let adminId: string;
  let teacher: Awaited<ReturnType<typeof createUser>>;
  let student: Awaited<ReturnType<typeof createUser>>;

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ({ app, http, prisma } = await createApp());
    admin = (await loginAdmin(http)).token;
    adminId = (await http.get('/api/v1/auth/me').set(as(admin)).expect(200)).body.data.id;
    teacher = await createUser(http, admin, 'TEACHER');
    student = await createUser(http, teacher.token, 'STUDENT');
  });
  afterAll(async () => {
    await prisma.platformSetting.deleteMany({
      where: { key: { in: ['AI_API_KEY', 'AI_MODEL', 'AI_MAX_TOKENS', 'AI_SYSTEM_PROMPT', 'home_card_eco_image'] } },
    });
    await app.close();
  });

  describe('notifications', () => {
    it("ro'yxat, o'qilmaganlar soni va o'qilgan deb belgilash", async () => {
      const notifications = app.get(NotificationsService);
      const created = await notifications.notify([student.id, student.id], {
        type: 'assignment.graded',
        titleUz: 'Topshiriq baholandi',
        bodyUz: '"Suv" topshirig‘i baholandi: 90/100',
        data: { assignmentId: '00000000-0000-7000-8000-000000000001' },
      });
      expect(created).toBe(1);
      await notifications.notify(student.id, { type: 'assignment.created', titleUz: 'Yangi', bodyUz: 'B' });
      await notifications.notify(teacher.id, { type: 'assignment.submitted', titleUz: 'T', bodyUz: 'B' });

      const list = await http.get('/api/v1/notifications?limit=30').set(as(student.token)).expect(200);
      expect(list.body.data).toHaveLength(2);
      expect(list.body.data[1]).toMatchObject({
        type: 'assignment.graded',
        titleUz: 'Topshiriq baholandi',
        readAt: null,
        data: { assignmentId: '00000000-0000-7000-8000-000000000001' },
      });
      expect(typeof list.body.data[0].createdAt).toBe('string');

      const count = await http.get('/api/v1/notifications/unread-count').set(as(student.token)).expect(200);
      expect(count.body).toEqual({ data: { count: 2 } });

      // Begona bildirishnomani belgilab bo'lmaydi.
      const teacherList = await http.get('/api/v1/notifications').set(as(teacher.token)).expect(200);
      const foreign = await http
        .patch('/api/v1/notifications/read')
        .set(as(student.token))
        .send({ ids: [teacherList.body.data[0].id] })
        .expect(200);
      expect(foreign.body.data).toEqual({ updated: 0 });

      const marked = await http
        .patch('/api/v1/notifications/read')
        .set(as(student.token))
        .send({ ids: [list.body.data[0].id] })
        .expect(200);
      expect(marked.body.data).toEqual({ updated: 1 });

      await http.patch('/api/v1/notifications/read').set(as(student.token)).send({ ids: ['x'] }).expect(422);

      const all = await http.post('/api/v1/notifications/read-all').set(as(student.token)).send({}).expect(200);
      expect(all.body.data).toEqual({ updated: 1 });
      const after = await http.get('/api/v1/notifications/unread-count').set(as(student.token)).expect(200);
      expect(after.body.data.count).toBe(0);

      const teacherCount = await http.get('/api/v1/notifications/unread-count').set(as(teacher.token)).expect(200);
      expect(teacherCount.body.data.count).toBe(1);
    });

    it('notifyRole — faqat shu roldagi faol foydalanuvchilarga', async () => {
      const n = await app.get(NotificationsService).notifyRole('SUPER_ADMIN', {
        type: 'QUIZ_SUBMITTED',
        titleUz: 'Yangi test topshirildi',
        bodyUz: 'B',
      });
      expect(n).toBe(1);
      const list = await http.get('/api/v1/notifications').set(as(admin)).expect(200);
      expect(list.body.data[0].type).toBe('QUIZ_SUBMITTED');
    });
  });

  describe('settings/ai', () => {
    it('faqat SUPER_ADMIN', async () => {
      await http.get('/api/v1/settings/ai').set(as(teacher.token)).expect(403);
      await http.patch('/api/v1/settings/ai').set(as(teacher.token)).send({ aiModel: 'x' }).expect(403);
    });

    it("kalit maskalanadi, xom holda hech qachon qaytmaydi", async () => {
      const key = 'sk-ant-test-0123456789abcdefghij';
      const res = await http
        .patch('/api/v1/settings/ai')
        .set(as(admin))
        .send({ aiApiKey: key, aiModel: 'claude-test', aiMaxTokens: 512, aiSystemPrompt: 'Prompt' })
        .expect(200);
      expect(JSON.stringify(res.body)).not.toContain(key);
      expect(res.body.data.config).toMatchObject({
        apiKeySet: true,
        provider: 'anthropic',
        model: 'claude-test',
        maxTokens: 512,
        systemPrompt: 'Prompt',
      });
      expect(res.body.data.config.apiKey).toMatch(/^sk-ant•+ghij$/);
      expect(res.body.data.usage).toMatchObject({ conversations: expect.any(Number), byRole: expect.any(Array) });

      // Bo'sh prompt — standartga qaytish.
      const cleared = await http.patch('/api/v1/settings/ai').set(as(admin)).send({ aiSystemPrompt: '' }).expect(200);
      expect(cleared.body.data.config.systemPrompt).toBeNull();

      const audit = await prisma.auditLog.findFirst({
        where: { subjectType: 'PlatformSetting' },
        orderBy: { createdAt: 'desc' },
      });
      expect(JSON.stringify(audit?.changes)).not.toContain(key);

      await http.patch('/api/v1/settings/ai').set(as(admin)).send({ aiMaxTokens: 0 }).expect(422);
    });

    it('Gemini kaliti prefiksdan aniqlanadi, claude modeli Gemini standartiga almashadi', async () => {
      const res = await http
        .patch('/api/v1/settings/ai')
        .set(as(admin))
        .send({ aiApiKey: 'AIzaTestKey0123456789' })
        .expect(200);
      expect(res.body.data.config).toMatchObject({ provider: 'gemini', model: 'gemini-3.5-flash-lite' });
    });
  });

  describe('settings/home-media', () => {
    let png: Buffer;
    beforeAll(async () => {
      // Haqiqiy rasm kerak: server uni sharp bilan WebP'ga aylantiradi.
      png = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: '#2e7d32' } }).png().toBuffer();
    });

    it("yuklash faqat SA; rasm public bucket'da, eskisi o'chiriladi", async () => {
      const storage = app.get(StorageService) as unknown as FakeStorage;
      const empty = await http.get('/api/v1/settings/home-media').set(as(student.token)).expect(200);
      expect(empty.body.data).toEqual({ ecoImageUrl: null, eduImageUrl: null });

      await http
        .post('/api/v1/settings/home-media')
        .set(as(teacher.token))
        .field('cardKey', 'eco')
        .attach('file', png, { filename: 'a.png', contentType: 'image/png' })
        .expect(403);
      await http
        .post('/api/v1/settings/home-media')
        .set(as(admin))
        .field('cardKey', 'xyz')
        .attach('file', png, { filename: 'a.png', contentType: 'image/png' })
        .expect(400);
      await http
        .post('/api/v1/settings/home-media')
        .set(as(admin))
        .field('cardKey', 'eco')
        .attach('file', Buffer.from('%PDF'), { filename: 'a.pdf', contentType: 'application/pdf' })
        .expect(400);
      await http.post('/api/v1/settings/home-media').set(as(admin)).field('cardKey', 'eco').expect(400);

      const first = await http
        .post('/api/v1/settings/home-media')
        .set(as(admin))
        .field('cardKey', 'eco')
        .attach('file', png, { filename: 'a.png', contentType: 'image/png' })
        .expect(201);
      const firstUrl: string = first.body.data.ecoImageUrl;
      expect(firstUrl).toMatch(/^http:\/\/assets\.test\/ecobalance-public\/home\/eco-\d+\.webp$/);
      expect(first.body.data.eduImageUrl).toBeNull();
      const firstKey = firstUrl.split('/ecobalance-public/')[1]!;
      expect(storage.files.has(firstKey)).toBe(true);
      // 2400px → 1600px WebP.
      const meta = await sharp(storage.files.get(firstKey)!).metadata();
      expect(meta).toMatchObject({ format: 'webp', width: 1600 });

      await new Promise((r) => setTimeout(r, 5));
      const second = await http
        .post('/api/v1/settings/home-media')
        .set(as(admin))
        .field('cardKey', 'eco')
        .attach('file', png, { filename: 'b.png', contentType: 'image/png' })
        .expect(201);
      expect(second.body.data.ecoImageUrl).not.toBe(firstUrl);
      expect(storage.files.has(firstKey)).toBe(false);

      const seen = await http.get('/api/v1/settings/home-media').set(as(student.token)).expect(200);
      expect(seen.body.data.ecoImageUrl).toBe(second.body.data.ecoImageUrl);
    });

    it("eski formatdagi to'liq URL ham key'ga keltiriladi", async () => {
      await prisma.platformSetting.upsert({
        where: { key: 'home_card_edu_image' },
        create: { key: 'home_card_edu_image', value: 'http://old.host:9000/ecobalance-public/home/edu-1.jpg' },
        update: { value: 'http://old.host:9000/ecobalance-public/home/edu-1.jpg' },
      });
      const res = await http.get('/api/v1/settings/home-media').set(as(student.token)).expect(200);
      expect(res.body.data.eduImageUrl).toBe('http://assets.test/ecobalance-public/home/edu-1.jpg');
      await prisma.platformSetting.delete({ where: { key: 'home_card_edu_image' } });
    });
  });

  describe('analytics', () => {
    it('overview va audit-recent — faqat SA', async () => {
      await http.get('/api/v1/analytics/overview').set(as(teacher.token)).expect(403);
      await http.get('/api/v1/analytics/audit-recent').set(as(student.token)).expect(403);

      const res = await http.get('/api/v1/analytics/overview').set(as(admin)).expect(200);
      const o = res.body.data;
      expect(o.totals).toMatchObject({
        users: expect.any(Number),
        organizations: expect.any(Number),
        courses: expect.any(Number),
        lessons: expect.any(Number),
        ecoReports: expect.any(Number),
        levels: expect.any(Number),
        materials: expect.any(Number),
        materialsSizeBytes: expect.any(Number),
      });
      expect(o.totals.users).toBeGreaterThanOrEqual(3);
      expect(o.registrationsLast30Days).toHaveLength(30);
      expect(o.usersByRole.map((r: { role: string }) => r.role)).toEqual(
        expect.arrayContaining(['SUPER_ADMIN', 'TEACHER', 'STUDENT']),
      );
      for (const k of [
        'orgsByType',
        'coursesByLevel',
        'lessonsByLevel',
        'lessonsByType',
        'materialsByLevel',
        'ecoReportsByCategory',
        'ecoReportsByStatus',
      ]) {
        expect(Array.isArray(o[k])).toBe(true);
      }

      const audit = await http.get('/api/v1/analytics/audit-recent?limit=2').set(as(admin)).expect(200);
      expect(audit.body.data).toHaveLength(2);
      expect(audit.body.data[0]).toMatchObject({ id: expect.any(String), action: expect.any(String) });
      // Noto'g'ri limit 422 emas — chegaraga keltiriladi (eski xatti-harakat).
      await http.get('/api/v1/analytics/audit-recent?limit=abc').set(as(admin)).expect(200);
    });
  });

  describe('eco-reports (faqat o‘qish)', () => {
    it("SA sahifalangan ro'yxatni filtr bilan oladi, boshqalar — 403", async () => {
      await prisma.ecoReport.createMany({
        data: [
          { reportedBy: adminId, category: 'WATER', riskLevel: 'HIGH', descriptionUz: 'Ariq ifloslangan', latitude: 41.3 },
          { reportedBy: adminId, category: 'WASTE', riskLevel: 'LOW', descriptionUz: 'Chiqindi', status: 'RESOLVED' },
        ],
      });
      await http.get('/api/v1/eco-reports').set(as(teacher.token)).expect(403);

      const all = await http.get('/api/v1/eco-reports?page=1&perPage=5').set(as(admin)).expect(200);
      expect(all.body.meta).toMatchObject({ page: 1, perPage: 5, total: 2, totalPages: 1 });

      const water = await http.get('/api/v1/eco-reports?category=WATER').set(as(admin)).expect(200);
      expect(water.body.data).toHaveLength(1);
      expect(water.body.data[0]).toMatchObject({
        category: 'WATER',
        status: 'REPORTED',
        latitude: 41.3,
        longitude: null,
        reporterName: expect.any(String),
      });
      const resolved = await http.get('/api/v1/eco-reports?status=RESOLVED').set(as(admin)).expect(200);
      expect(resolved.body.data.map((r: { category: string }) => r.category)).toEqual(['WASTE']);

      await http.post('/api/v1/eco-reports').set(as(admin)).send({}).expect(404);
    });
  });

  describe('news (faqat o‘qish)', () => {
    it("nashr qilinganlar hammaga, qoralamalar faqat SA'ga", async () => {
      const published = await prisma.news.create({
        data: {
          titleUz: 'Nashr',
          bodyUz: 'Matn',
          isPublished: true,
          publishedAt: new Date(),
          authorId: adminId,
          attachmentKey: 'news/x-a.pdf',
          attachmentFileName: 'a.pdf',
        },
      });
      const draft = await prisma.news.create({ data: { titleUz: 'Qoralama', bodyUz: 'Matn' } });

      const forStudent = await http.get('/api/v1/news?isPublished=false').set(as(student.token)).expect(200);
      expect(forStudent.body.data.map((n: { id: string }) => n.id)).toEqual([published.id]);
      // Standart sahifalangan shakl {data, meta} (eski backend ham shunday qaytargan).
      expect(forStudent.body.meta).toMatchObject({ page: 1, total: 1 });
      expect(forStudent.body.data[0]).toMatchObject({
        authorName: expect.any(String),
        attachmentUrl: expect.stringContaining('news/x-a.pdf'),
      });

      const forAdmin = await http.get('/api/v1/news').set(as(admin)).expect(200);
      expect(forAdmin.body.data.map((n: { id: string }) => n.id).sort()).toEqual([published.id, draft.id].sort());
      const drafts = await http.get('/api/v1/news?isPublished=false').set(as(admin)).expect(200);
      expect(drafts.body.data.map((n: { id: string }) => n.id)).toEqual([draft.id]);

      await http.get(`/api/v1/news/${draft.id}`).set(as(student.token)).expect(404);
      await http.get(`/api/v1/news/${draft.id}`).set(as(admin)).expect(200);
      await http.get(`/api/v1/news/${published.id}`).set(as(student.token)).expect(200);
      await http.post('/api/v1/news').set(as(admin)).send({}).expect(404);
    });
  });
});
