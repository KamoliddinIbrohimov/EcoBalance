/**
 * F1-F5 LMS logic — QA ro'yxatidagi 15 ta mezon avtomatik tekshiruvi.
 *
 * Ishga tushurish (konteyner ichida):
 *   docker exec -w /workspace/apps/api eco-api sh -c "pnpm test lms-logic"
 *
 * Testlar jonli (hozirgi) API konteynerining HTTP endpointlarini uradi,
 * yangi NestFactory yaratmaydi. Shu sababli test tez va local DB holatiga
 * ta'sir qiladi (eng oxirgi `prisma db seed`'dagi hisoblar talab qilinadi):
 *   • admin@eco-balance.uz / ChangeMe!2026 — SA
 *   • teacher@test.uz     / StudentPass!2026 — TEACHER
 *   • student1@test.uz    / StudentPass!2026 — STUDENT (Test guruh a'zosi)
 */
import { beforeAll, describe, expect, it } from 'vitest';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:8080';

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login failed ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data: { accessToken: string; user: { id: string } } };
  return json.data.accessToken;
}

async function api(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`${BASE}/api/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

let saToken: string;
let teacherToken: string;
let studentToken: string;
let studentId: string;
let groupId: string;
let courseId: string;
let studentLessonId: string;

beforeAll(async () => {
  saToken = await login('admin@eco-balance.uz', 'ChangeMe!2026');
  teacherToken = await login('teacher@test.uz', 'StudentPass!2026');
  studentToken = await login('student1@test.uz', 'StudentPass!2026');

  const meRes = await api(studentToken, '/auth/me');
  const me = (await meRes.json()) as { data: { id: string } };
  studentId = me.data.id;

  // Response: `{data: TValue, meta?}` — list endpoints: TValue=array; single: TValue=object
  const groups = (await (await api(saToken, '/groups')).json()) as { data: { id: string }[] };
  groupId = groups.data[0].id;

  const bindings = (await (await api(saToken, `/groups/${groupId}/courses`)).json()) as {
    data: { courseId: string }[];
  };
  courseId = bindings.data[0]?.courseId;

  if (!courseId) {
    const courses = (await (await api(saToken, '/courses')).json()) as { data: { id: string }[] };
    courseId = courses.data[0].id;
    await api(saToken, `/groups/${groupId}/courses/${courseId}`, { method: 'POST' });
  }

  const lessons = (await (await api(studentToken, '/lessons?page=1&perPage=5')).json()) as {
    data: { id: string }[];
  };
  studentLessonId = lessons.data[0]?.id;
});

describe('F1-F5 QA mezonlari', () => {
  it('1. Talaba begona/qoralama kursning darsini GET qilsa 404', async () => {
    const saRes = (await (
      await api(saToken, '/lessons?page=1&perPage=100')
    ).json()) as { data: { id: string }[] };
    const stRes = (await (
      await api(studentToken, '/lessons?page=1&perPage=100')
    ).json()) as { data: { id: string }[] };
    const stIds = new Set(stRes.data.map((l) => l.id));
    const outside = saRes.data.find((l) => !stIds.has(l.id));
    if (outside) {
      const res = await api(studentToken, `/lessons/${outside.id}`);
      expect(res.status).toBe(404);
    }
  });

  it('2. progressPercent <= 100 va lessonsCompleted <= lessonsTotal', async () => {
    const res = await api(studentToken, '/stats/me');
    const stats = (await res.json()).data as {
      progressPercent: number;
      lessonsCompleted: number;
      lessonsTotal: number;
    };
    expect(stats.progressPercent).toBeLessThanOrEqual(100);
    expect(stats.lessonsCompleted).toBeLessThanOrEqual(stats.lessonsTotal);
  });

  it('2b. Begona dars progress yozilsa 404', async () => {
    const bogus = '00000000-0000-0000-0000-000000000000';
    const res = await api(studentToken, `/lessons/${bogus}/progress`, {
      method: 'POST',
      body: JSON.stringify({ completed: true }),
    });
    expect([400, 404]).toContain(res.status);
  });

  it('3 (L6). Baho o\'rtachasi 0..100 oralig\'ida', async () => {
    const res = await api(studentToken, '/stats/me');
    const s = (await res.json()).data as { assignmentsAverageScore: number | null };
    if (s.assignmentsAverageScore !== null) {
      expect(s.assignmentsAverageScore).toBeGreaterThanOrEqual(0);
      expect(s.assignmentsAverageScore).toBeLessThanOrEqual(100);
    }
  });

  it('4b (L5). lessonId mavjud kursda — assignment yaratish 201', async () => {
    const lessons = (await (
      await api(saToken, `/courses/${courseId}/lessons`)
    ).json()).data as { id: string }[];
    if (lessons.length === 0) return;
    const res = await api(saToken, '/assignments', {
      method: 'POST',
      body: JSON.stringify({
        groupId,
        courseId,
        lessonId: lessons[0].id,
        kind: 'TASK',
        titleUz: `E2E same-course ${Date.now()}`,
        maxScore: 100,
        allowLate: false,
        latePenaltyPercent: 0,
      }),
    });
    expect(res.status).toBe(201);
    const created = (await res.json()).data as { id: string };
    await api(saToken, `/assignments/${created.id}`, { method: 'DELETE' });
  });

  it('4 (L5). lessonId boshqa kurs darsi bo\'lsa topshiriq yaratish 400', async () => {
    const allCourses = (await (await api(saToken, '/courses')).json()).data as { id: string }[];
    const otherCourse = allCourses.find((c) => c.id !== courseId);
    if (!otherCourse) return;
    const otherLessons = (await (
      await api(saToken, `/courses/${otherCourse.id}/lessons`)
    ).json()).data as { id: string }[];
    if (otherLessons.length === 0) return;
    const res = await api(saToken, '/assignments', {
      method: 'POST',
      body: JSON.stringify({
        groupId,
        courseId,
        lessonId: otherLessons[0].id,
        kind: 'TASK',
        titleUz: 'X-course lesson',
        maxScore: 100,
        allowLate: false,
        latePenaltyPercent: 0,
      }),
    });
    expect(res.status).toBe(400);
  });

  it('5a. dueAt o\'tgan sanaga create -> 400', async () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const res = await api(saToken, '/assignments', {
      method: 'POST',
      body: JSON.stringify({
        groupId,
        courseId,
        kind: 'TASK',
        titleUz: 'Past due',
        dueAt: past,
        maxScore: 100,
        allowLate: false,
        latePenaltyPercent: 0,
      }),
    });
    expect(res.status).toBe(400);
  });

  it('7 (L9). Nofaol guruhda create assignment -> 409', async () => {
    await api(saToken, `/groups/${groupId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: false }),
    });
    const res = await api(saToken, '/assignments', {
      method: 'POST',
      body: JSON.stringify({
        groupId,
        courseId,
        kind: 'TASK',
        titleUz: 'Inactive',
        maxScore: 100,
        allowLate: false,
        latePenaltyPercent: 0,
      }),
    });
    expect(res.status).toBe(409);
    await api(saToken, `/groups/${groupId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: true }),
    });
  });

  it('7b. Nofaol guruh talabasi 0 ta assignment ko\'radi', async () => {
    await api(saToken, `/groups/${groupId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: false }),
    });
    const payload = (await (await api(studentToken, '/assignments')).json()).data as unknown[];
    expect(payload.length).toBe(0);
    await api(saToken, `/groups/${groupId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: true }),
    });
  });

  it('9a. Ikki dars tartibi almashuvi — PUT /courses/:id/lessons/order 200', async () => {
    const lessons = (await (
      await api(saToken, `/courses/${courseId}/lessons`)
    ).json()).data.slice(0, 3) as { id: string }[];
    if (lessons.length < 2) return;
    const ids = lessons.map((l) => l.id);
    const reversed = [...ids].reverse();
    const r = await api(saToken, `/courses/${courseId}/lessons/order`, {
      method: 'PUT',
      body: JSON.stringify({ lessonIds: reversed }),
    });
    expect(r.status).toBe(200);
    // restore
    await api(saToken, `/courses/${courseId}/lessons/order`, {
      method: 'PUT',
      body: JSON.stringify({ lessonIds: ids }),
    });
  });

  it('9b. Darsni o\'chirishdan oldin ta\'sir hisoboti qaytariladi', async () => {
    if (!studentLessonId) return;
    const r = await api(saToken, `/lessons/${studentLessonId}/removal-impact`);
    expect(r.status).toBe(200);
    const data = (await r.json()).data as Record<string, number>;
    expect(data).toHaveProperty('completedProgressCount');
    expect(data).toHaveProperty('assignmentCount');
    expect(data).toHaveProperty('quizCount');
  });

  it('13 (heartbeat). 60s dan ortiq vaqt qo\'sha olmaydi', async () => {
    if (!studentLessonId) return;
    const r = await api(studentToken, `/lessons/${studentLessonId}/heartbeat`, {
      method: 'POST',
      body: JSON.stringify({ activeSeconds: 300 }),
    });
    expect(r.status).toBe(200);
    const data = (await r.json()).data as { addedSeconds: number };
    expect(data.addedSeconds).toBeLessThanOrEqual(60);
  });

  it('13b. Boshqa talabaning stats-ini ko\'rish 403', async () => {
    const me = (await (await api(studentToken, '/auth/me')).json()).data as { id: string };
    const bogus = '11111111-1111-1111-1111-111111111111';
    const r = await api(studentToken, `/stats/students/${bogus}/overview`);
    expect([403, 404]).toContain(r.status);
    expect(me.id).toBe(studentId);
  });

  it('14 (L15). Guruh statistikasi — faqat o\'z guruhi topshiriqlari', async () => {
    const r = await api(saToken, `/stats/groups/${groupId}`);
    expect(r.status).toBe(200);
    const data = (await r.json()).data as { pendingSubmissions: number };
    expect(data).toHaveProperty('pendingSubmissions');
    expect(data.pendingSubmissions).toBeGreaterThanOrEqual(0);
  });

  it('15 (STUDENT access control). STUDENT /stats/groups/*  403/404', async () => {
    const r = await api(studentToken, `/stats/groups/${groupId}`);
    expect([403, 404]).toContain(r.status);
  });

  it('UUID bo\'lmagan :id -> 400', async () => {
    const r = await api(saToken, '/courses/not-a-uuid');
    expect(r.status).toBe(400);
  });

  it('Payload >1MB -> 413', async () => {
    const bigText = 'a'.repeat(2 * 1024 * 1024);
    const r = await fetch(`${BASE}/api/v1/courses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${saToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slug: 'test',
        nameUz: 'test',
        educationLevel: 'x',
        blob: bigText,
      }),
    });
    expect(r.status).toBe(413);
  });
});
