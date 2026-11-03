# @eco/api — PedResearch Lab REST API (v1)

NestJS 11 + Prisma 6 + PostgreSQL. Barcha yo'llar `/api/v1/...`. Web klient
(`apps/web`) shartnomasi o'zgarmaydi — yangi kod eski javob shakllarini aynan
saqlaydi.

## Tuzilma

```
src/
  main.ts                    # bootstrap + configureApp() (testlar ham ishlatadi)
  app.module.ts              # modullar, global guard/interceptor/filter
  config/env.ts              # zod bilan env; @InjectEnv() orqali olinadi
  infra/                     # global: PrismaService, StorageService, AuditService
  common/http/               # ProblemFilter, EnvelopeInterceptor, ZBody/ZQuery, pagination
  modules/
    auth/                    # login/refresh/logout, profil, AuthGuard, Actor
    users/                   # users, roles, organizations/tree
    courses/                 # education-levels, courses, lessons, modules, materials
    groups/                  # guruhlar, a'zolar, kurs/test biriktirish, dars ochilishi
    quizzes/                 # quizzes (o'qituvchi), my-quizzes (talaba)
    learning/                # assignments, dars progressi, stats
    platform/                # notifications, settings, analytics, eco-reports, news
    chatbot/                 # AI suhbat
prisma/
  schema.prisma              # DB prod bilan bir xil (o'zgartirishsiz ko'chirish)
  migrations/0_init          # prod holatining baseline'i
  seed.ts                    # idempotent: rollar, super admin, ta'lim darajalari
test/                        # e2e (supertest) — har run uchun alohida test baza
```

## Konventsiyalar

- **Auth.** Global `AuthGuard` har so'rovda: JWT → DB'dan foydalanuvchi
  (faolmi, rollari) → vaqtinchalik parol → `@Roles(...)`. Ochiq endpoint —
  `@Public()`. Kontrollerda foydalanuvchi: `@CurrentActor() actor: Actor`;
  audit uchun `@Client() client: ClientInfo`. Rol tekshiruvi: `isAdmin(actor)`,
  `isTeacher(actor)`, `isStudent(actor)` (`modules/auth/actor.ts`).
- **Egalik.** SA — hammasi. O'qituvchi — o'zi yaratgan/egasi bo'lgan narsalar
  (`ownerId`, `teacherId`, `createdById`); begona resurs uchun **404** (mavjudligini
  oshkor qilmaymiz), ruxsat yo'q amal uchun 403.
- **Validatsiya.** `@ZBody(schema)` / `@ZQuery(schema)` — sxemalar `@eco/shared`dan.
  Xato → 422 `{title, errors: {field: [msg]}}`. Query boolean uchun
  `queryBoolean` (shared) — `z.coerce.boolean()` ishlatilmaydi.
- **Javob shakli.** Interceptor har javobni `{data: ...}` ga o'raydi. Sahifalangan
  ro'yxat servisdan `toPage(rows, total, page, perPage)` → `{data, meta}` bo'lib
  qaytadi (qayta o'ralmaydi). `pageArgs(query)` — skip/take. O'ramsiz javob
  kerak bo'lsa `@RawResponse()`.
- **Xatolar.** Nest `HttpException`lar (NotFound, Forbidden, BadRequest,
  Conflict) — xabar o'zbekcha, `title` sifatida ko'rinadi. Prisma P2002 → 409,
  P2025 → 404 avtomatik.
- **Sanalar** DTO'da ISO string (`toISOString()`), ID'lar UUIDv7 (Prisma default).
- **Fayllar.** `FileInterceptor('file', { limits: { fileSize } })`, saqlash
  `StorageService.put/remove/downloadUrl/publicUrl`.
- **Audit.** Muhim yozish amallari `AuditService.record({...client})`.
- **Kod uslubi.** Kichik, aniq servislar (~300–400 qatordan oshmasin; oshsa
  bo'lib chiqing). Izohlar o'zbekcha, faqat "nima uchun" ni tushuntiradi.

## Ishga tushirish

```bash
pnpm --filter @eco/api prisma:generate
pnpm --filter @eco/api start:dev
pnpm --filter @eco/api test        # e2e: localhost:5434 dagi Postgres kerak
```

## Prod'ga ko'chirish (bir martalik)

Prod baza ilgari `prisma db push` bilan boshqarilgan. Yangi API migratsiyalar
bilan ishlaydi, shuning uchun birinchi deploy'dan oldin baseline belgilanadi
(ma'lumotga tegmaydi):

```bash
npx prisma migrate resolve --applied 0_init
```
