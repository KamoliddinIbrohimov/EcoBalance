/**
 * End-to-end tests for the AI chatbot module.
 *
 * Uses a mocked AI provider so the real Anthropic API is never called from
 * automated tests (no key spend, no external network). Requires a running
 * Postgres reachable via DATABASE_URL.
 */
import { INestApplication, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ResponseTransformInterceptor } from '../src/common/interceptors/response-transform.interceptor';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import {
  AI_PROVIDER,
  type AiCompletionRequest,
  type AiProvider,
} from '../src/modules/chatbot/providers/ai-provider.interface';

const strongPassword = 'ValidPass!2026';

/** Deterministic AI stub — never touches the network. */
class StubAiProvider implements AiProvider {
  public calls: AiCompletionRequest[] = [];
  isConfigured() {
    return true;
  }
  async sendMessage(req: AiCompletionRequest): Promise<string> {
    this.calls.push(req);
    const last = req.history[req.history.length - 1];
    return `Stub javob: ${last?.content ?? ''}`;
  }
}

describe('Chatbot (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ai: StubAiProvider;

  const bootstrap = async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AI_PROVIDER)
      .useValue(new StubAiProvider())
      .compile();

    const nest = moduleRef.createNestApplication();
    nest.use(cookieParser());
    nest.setGlobalPrefix('api');
    nest.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    nest.useGlobalPipes(new ZodValidationPipe());
    nest.useGlobalInterceptors(new ResponseTransformInterceptor());
    nest.useGlobalFilters(new GlobalExceptionFilter());
    await nest.init();

    return {
      nest,
      prisma: nest.get(PrismaService),
      ai: nest.get<StubAiProvider>(AI_PROVIDER),
    };
  };

  const registerUser = async (nest: INestApplication, email: string) => {
    const res = await request(nest.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        firstName: 'Chat',
        lastName: 'Tester',
        email,
        password: strongPassword,
        confirmPassword: strongPassword,
      })
      .expect(201);
    return res.body.data.accessToken as string;
  };

  const uniqueEmail = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.eco-balance.uz`;

  beforeAll(async () => {
    const boot = await bootstrap();
    app = boot.nest;
    prisma = boot.prisma;
    ai = boot.ai;

    await prisma.aiConversation.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { contains: '@test.eco-balance.uz' } } });
  });

  afterAll(async () => {
    await prisma.aiConversation.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { contains: '@test.eco-balance.uz' } } });
    await app.close();
  });

  it('POST /chatbot/messages — creates a conversation and returns AI reply', async () => {
    const token = await registerUser(app, uniqueEmail());
    ai.calls = [];

    const res = await request(app.getHttpServer())
      .post('/api/v1/chatbot/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Salom, ekologiya nima?' })
      .expect(201);

    expect(res.body.data.conversation.id).toBeDefined();
    expect(res.body.data.userMessage.content).toBe('Salom, ekologiya nima?');
    expect(res.body.data.assistantMessage.content).toBe('Stub javob: Salom, ekologiya nima?');
    expect(res.body.data.conversation.title.length).toBeGreaterThan(0);
    expect(ai.calls).toHaveLength(1);
    expect(ai.calls[0]?.history[0]?.role).toBe('user');
  });

  it('GET /chatbot/conversations — lists only current user conversations', async () => {
    const tokenA = await registerUser(app, uniqueEmail());
    const tokenB = await registerUser(app, uniqueEmail());

    await request(app.getHttpServer())
      .post('/api/v1/chatbot/messages')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ content: 'A ning suhbati' })
      .expect(201);

    const listA = await request(app.getHttpServer())
      .get('/api/v1/chatbot/conversations')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const listB = await request(app.getHttpServer())
      .get('/api/v1/chatbot/conversations')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    expect(listA.body.data.length).toBeGreaterThan(0);
    expect(listB.body.data.length).toBe(0);
  });

  it('GET /chatbot/conversations/:id — 404 for other user conversation', async () => {
    const tokenOwner = await registerUser(app, uniqueEmail());
    const tokenIntruder = await registerUser(app, uniqueEmail());

    const created = await request(app.getHttpServer())
      .post('/api/v1/chatbot/messages')
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ content: 'Egasining xabari' })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/chatbot/conversations/${created.body.data.conversation.id}`)
      .set('Authorization', `Bearer ${tokenIntruder}`)
      .expect(404);
  });

  it('DELETE /chatbot/conversations/:id — 403 for other user, 204 for owner, then not visible', async () => {
    const tokenOwner = await registerUser(app, uniqueEmail());
    const tokenIntruder = await registerUser(app, uniqueEmail());

    const created = await request(app.getHttpServer())
      .post('/api/v1/chatbot/messages')
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ content: 'Delete me' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/chatbot/conversations/${created.body.data.conversation.id}`)
      .set('Authorization', `Bearer ${tokenIntruder}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/chatbot/conversations/${created.body.data.conversation.id}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/chatbot/conversations/${created.body.data.conversation.id}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .expect(404);
  });

  it('Sends full conversation history on subsequent messages', async () => {
    const token = await registerUser(app, uniqueEmail());
    ai.calls = [];

    const first = await request(app.getHttpServer())
      .post('/api/v1/chatbot/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Birinchi savol' })
      .expect(201);

    const conversationId = first.body.data.conversation.id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/chatbot/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Ikkinchi savol' })
      .expect(201);

    expect(ai.calls).toHaveLength(2);
    // Second call should include the previous user + assistant + new user message.
    expect(ai.calls[1]?.history.length).toBeGreaterThanOrEqual(3);
    expect(ai.calls[1]?.history.at(-1)?.content).toBe('Ikkinchi savol');
  });

  it('POST /chatbot/messages — 400 on empty content', async () => {
    const token = await registerUser(app, uniqueEmail());
    await request(app.getHttpServer())
      .post('/api/v1/chatbot/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '   ' })
      .expect(400);
  });

  it('GET /chatbot/conversations — 401 without token', async () => {
    await request(app.getHttpServer()).get('/api/v1/chatbot/conversations').expect(401);
  });
});
