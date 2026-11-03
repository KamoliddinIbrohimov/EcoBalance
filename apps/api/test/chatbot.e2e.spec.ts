import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infra/prisma.service';
import { StorageService } from '../src/infra/storage.service';
import { configureApp } from '../src/main';
import { KnowledgeService } from '../src/modules/chatbot/knowledge.service';
import {
  AI_PROVIDERS,
  type AiCompletionRequest,
  type AiCompletionResult,
  type AiProvider,
} from '../src/modules/chatbot/providers/ai-provider';
import { FakeStorage, type Http, createUser, loginAdmin } from './app';

/** Tarmoqsiz soxta provayder: so'rovlarni yozib oladi, javobni test belgilaydi. */
class FakeAi implements AiProvider {
  calls: AiCompletionRequest[] = [];
  reply: (req: AiCompletionRequest) => Promise<AiCompletionResult> = async (req) => ({
    text: `Javob #${this.calls.length}: ${req.history[req.history.length - 1]!.content}`,
    tokens: 42,
  });
  complete(req: AiCompletionRequest) {
    this.calls.push(req);
    return this.reply(req);
  }
}

describe('chatbot', () => {
  const anthropic = new FakeAi();
  const gemini = new FakeAi();
  let app: NestExpressApplication;
  let http: Http;
  let prisma: PrismaClient;
  let admin: string;
  let student: Awaited<ReturnType<typeof createUser>>;
  let other: Awaited<ReturnType<typeof createUser>>;

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const setKey = (aiApiKey: string) =>
    http.patch('/api/v1/settings/ai').set(as(admin)).send({ aiApiKey }).expect(200);

  beforeAll(async () => {
    // Kalit faqat DB orqali beriladi — env'dagi haqiqiy kalit testga ta'sir qilmasin.
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.AI_SYSTEM_PROMPT;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(StorageService)
      .useClass(FakeStorage)
      .overrideProvider(AI_PROVIDERS)
      .useValue({ anthropic, gemini })
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);

    await prisma.platformSetting.deleteMany({ where: { key: { startsWith: 'AI_' } } });
    admin = (await loginAdmin(http)).token;
    const teacher = await createUser(http, admin, 'TEACHER');
    student = await createUser(http, teacher.token, 'STUDENT');
    other = await createUser(http, teacher.token, 'STUDENT');
  });
  afterAll(async () => {
    await prisma.platformSetting.deleteMany({ where: { key: { startsWith: 'AI_' } } });
    await app.close();
  });
  beforeEach(() => {
    anthropic.calls = [];
    gemini.calls = [];
  });

  it("kalit yo'q — 503 o'zbekcha sarlavha bilan, hech narsa yozilmaydi", async () => {
    const res = await http
      .post('/api/v1/chatbot/messages')
      .set(as(student.token))
      .send({ content: 'Suv resurslarini qanday tejash mumkin?' })
      .expect(503);
    expect(res.body).toMatchObject({ status: 503, title: expect.stringContaining('AI xizmati sozlanmagan') });
    expect(anthropic.calls).toHaveLength(0);

    const list = await http.get('/api/v1/chatbot/conversations?perPage=50').set(as(student.token)).expect(200);
    expect(list.body.data).toHaveLength(0);
  });

  it("kalitsiz ham tarix CRUD va tayyor javoblar ishlaydi", async () => {
    const created = await http.post('/api/v1/chatbot/conversations').set(as(student.token)).send({}).expect(201);
    expect(created.body.data).toMatchObject({ title: 'Yangi suhbat', messageCount: 0 });
    const id = created.body.data.id as string;

    const titled = await http
      .post('/api/v1/chatbot/conversations')
      .set(as(student.token))
      .send({ title: 'Mening suhbatim' })
      .expect(201);
    expect(titled.body.data.title).toBe('Mening suhbatim');

    const hello = await http
      .post(`/api/v1/chatbot/conversations/${id}/messages`)
      .set(as(student.token))
      .send({ content: 'Salom' })
      .expect(201);
    expect(hello.body.data.assistantMessage.content).toMatch(/Salom|Assalomu/);
    expect(hello.body.data.conversation.messageCount).toBe(2);
    expect(anthropic.calls).toHaveLength(0);

    const detail = await http.get(`/api/v1/chatbot/conversations/${id}`).set(as(student.token)).expect(200);
    expect(detail.body.data.messages.map((m: { role: string }) => m.role)).toEqual(['USER', 'ASSISTANT']);

    const list = await http.get('/api/v1/chatbot/conversations?perPage=50').set(as(student.token)).expect(200);
    expect(list.body.meta).toMatchObject({ page: 1, perPage: 50, total: 2 });
    expect(list.body.data[0].id).toBe(id); // oxirgi xabar — tepada

    await http.delete(`/api/v1/chatbot/conversations/${titled.body.data.id}`).set(as(student.token)).expect(204);
    await http.get(`/api/v1/chatbot/conversations/${titled.body.data.id}`).set(as(student.token)).expect(404);
  });

  it("begona suhbat — 404 (o'qish, yozish, o'chirish)", async () => {
    const mine = await http.post('/api/v1/chatbot/conversations').set(as(student.token)).send({}).expect(201);
    const id = mine.body.data.id as string;
    await http.get(`/api/v1/chatbot/conversations/${id}`).set(as(other.token)).expect(404);
    await http
      .post(`/api/v1/chatbot/conversations/${id}/messages`)
      .set(as(other.token))
      .send({ content: 'Salom' })
      .expect(404);
    await http.delete(`/api/v1/chatbot/conversations/${id}`).set(as(other.token)).expect(404);
    await http.get(`/api/v1/chatbot/conversations/${id}`).set(as(student.token)).expect(200);
  });

  it('validatsiya', async () => {
    await http.post('/api/v1/chatbot/messages').set(as(student.token)).send({ content: '   ' }).expect(422);
    await http
      .post('/api/v1/chatbot/messages')
      .set(as(student.token))
      .send({ content: 'x'.repeat(4001) })
      .expect(422);
    await http.get('/api/v1/chatbot/conversations/not-a-uuid').set(as(student.token)).expect(400);
  });

  it('AI javobi: yangi suhbat, tarix va kurs materiallaridan kontekst (RAG)', async () => {
    const course = await prisma.course.create({
      data: { slug: `eko-${Date.now()}`, nameUz: 'Ekologiya asoslari', educationLevel: 'oliy-talim', isPublished: true },
    });
    await prisma.courseMaterial.create({
      data: {
        courseId: course.id,
        fileName: 'suv.docx',
        storageKey: `materials/${course.id}/suv.docx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: 100,
        contentText: 'Suv resurslarini tejash uchun tomchilatib sug‘orish usuli qo‘llaniladi. Suvni qayta ishlash ham muhim.',
      },
    });
    app.get(KnowledgeService).invalidate();
    await setKey('sk-ant-test-key-0123456789');

    const first = await http
      .post('/api/v1/chatbot/messages')
      .set(as(student.token))
      .send({ content: 'Suv resurslarini qanday tejash mumkin?' })
      .expect(201);
    const body = first.body.data;
    expect(body.conversation).toMatchObject({ title: 'Suv resurslarini qanday tejash mumkin?', messageCount: 2 });
    expect(body.userMessage).toMatchObject({ role: 'USER', content: 'Suv resurslarini qanday tejash mumkin?' });
    expect(body.assistantMessage).toMatchObject({ role: 'ASSISTANT', conversationId: body.conversation.id });
    expect(new Date(body.assistantMessage.createdAt) > new Date(body.userMessage.createdAt)).toBe(true);

    expect(anthropic.calls).toHaveLength(1);
    expect(gemini.calls).toHaveLength(0);
    const call = anthropic.calls[0]!;
    expect(call.apiKey).toBe('sk-ant-test-key-0123456789');
    expect(call.system).toContain('KONTEKST');
    expect(call.system).toContain('Ekologiya asoslari > fayl: suv.docx');
    expect(call.history).toEqual([{ role: 'user', content: 'Suv resurslarini qanday tejash mumkin?' }]);

    const second = await http
      .post(`/api/v1/chatbot/conversations/${body.conversation.id}/messages`)
      .set(as(student.token))
      .send({ content: 'Yana batafsilroq?' })
      .expect(201);
    expect(second.body.data.conversation.messageCount).toBe(4);
    expect(anthropic.calls[1]!.history.map((t) => t.role)).toEqual(['user', 'assistant', 'user']);

    const tokens = await prisma.aiMessage.findUnique({ where: { id: second.body.data.assistantMessage.id } });
    expect(tokens?.tokens).toBe(42);
  });

  it("provayder xatosi — 503, savol saqlanmaydi; tarix buzilmaydi", async () => {
    await setKey('sk-ant-test-key-0123456789');
    const conv = await http.post('/api/v1/chatbot/conversations').set(as(student.token)).send({}).expect(201);
    const id = conv.body.data.id as string;

    anthropic.reply = async () => {
      throw new Error('upstream exploded');
    };
    const failed = await http
      .post(`/api/v1/chatbot/conversations/${id}/messages`)
      .set(as(student.token))
      .send({ content: 'Havo ifloslanishi sabablari?' })
      .expect(503);
    expect(failed.body.title).toContain('vaqtincha');
    expect(await prisma.aiMessage.count({ where: { conversationId: id } })).toBe(0);

    anthropic.reply = async () => ({ text: 'Tiklandi', tokens: 1 });
    const ok = await http
      .post(`/api/v1/chatbot/conversations/${id}/messages`)
      .set(as(student.token))
      .send({ content: 'Havo ifloslanishi sabablari?' })
      .expect(201);
    expect(ok.body.data.assistantMessage.content).toBe('Tiklandi');
    expect(anthropic.calls[anthropic.calls.length - 1]!.history).toHaveLength(1);
  });

  it('Gemini kaliti — Gemini provayderi tanlanadi', async () => {
    await setKey('AIzaTestKey0123456789');
    await http
      .post('/api/v1/chatbot/messages')
      .set(as(student.token))
      .send({ content: 'Daraxt ekishning tabiatga foydasi?' })
      .expect(201);
    expect(anthropic.calls).toHaveLength(0);
    expect(gemini.calls).toHaveLength(1);
    expect(gemini.calls[0]!.model).toBe('gemini-3.5-flash-lite');
  });
});
