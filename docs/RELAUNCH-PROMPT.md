# Prompt: Eco-Balance platformasini noldan tozalab, bosqichma-bosqich ishga tushirish

> Ushbu fayl — keyingi Claude/AI sessiyasiga (yoki shu loyiha ustida ishlaydigan istalgan
> dasturchi/agentga) to'g'ridan-to'g'ri nusxalab beriladigan tayyor topshiriq matni. U hech
> qanday oldingi suhbat konteksti bo'lmagan holda ham tushunarli va bajarilishi mumkin bo'lishi
> uchun yozilgan. `docs/materials/ekologiya/PROMPT.md` bilan bir xil uslubda.

---

## Vazifaning mohiyati

Eco-Balance monorepo'sini **noldan, toza muhitda** ko'tarib, hozirda kodda mavjud bo'lgan
funksionallikning (Phase 0 — Foundation, Phase 1 — Users/Organizations CRUD, va Course/Lesson
e-learning moduli) **to'liq va xatosiz ishlashini** ta'minlash. Bu — yangi funksiya qo'shish
vazifasi EMAS. Bu — mavjud kodni tozalab, o'rnatib, migratsiya qilib, ishga tushirib, har bir
qatlamni (backend, frontend, infra) alohida-alohida sinab, topilgan xatolarni tuzatish vazifasi.

## Qattiq cheklovlar (buzilmasligi shart)

1. **Dizaynga tegilmaydi.** Web ilovaning vizual ko'rinishi — ranglar, tayoq(layout), komponent
   uslublari (`apps/web/src/shared/components/ui/*`, `globals.css`, `tailwind.config.ts`),
   sidebar tuzilishi, sahifalarning joylashuvi — **hozirgi holida qoladi**. Faqat funksional
   xato (masalan, sahifa umuman ochilmasligi, konsolda xato chiqishi, build muvaffaqiyatsiz
   tugashi) tuzatiladi — bu tuzatish uchun bitta CSS qatori yoki bitta prop o'zgarishi kifoya
   qilsa, undan ortiqni qilmang.
2. **Yangi feature yo'q.** Monitoring (Phase 4), AI Chatbot backend (Phase 7), gamifikatsiya
   (Phase 6), hisobotlar (Phase 8), rol-asosidagi alohida dashboard panellari — bularning
   HECH BIRI ushbu topshiriq doirasida qilinmaydi. Agar shu davomida ular "ishlamayapti" deb
   topilsa (masalan `/monitoring`, `/chatbot` — "ishlab chiqilmoqda" sahifasini ko'rsatadi),
   bu **kutilgan xatti-harakat**, xato emas — README.md dagi "Delivery phases" jadvaliga qarang.
3. **Mock ma'lumotlarga tegilmaydi.** `apps/web/src/features/dashboard/data/mock.ts` dagi
   raqamlar (KPI, yangiliklar, tezkor faktlar) ataylab qattiq kodlangan (Phase 3 gacha). Ularni
   o'chirish yoki "haqiqiy" API'ga ulash — bu alohida, kelajakdagi vazifa.
4. **Har bir bosqichdan keyin sinov o'tkazing** va natijani yozib boring (muvaffaqiyatli/
   muvaffaqiyatsiz, va agar muvaffaqiyatsiz bo'lsa — nima uchun va qanday tuzatilgani).
   Keyingi bosqichga o'tishdan oldin joriy bosqich yashil (passing) bo'lishi shart.
5. **`.env` faylidagi maxfiy qiymatlarni commitga qo'shmang**, boshqa joyga chiqarmang yoki
   loglamang. Fayl allaqachon mavjud (`.env`) — uni o'chirmang, faqat kerak bo'lsa solishtiring.

## Loyiha konteksti (texnik stek va tuzilma)

- Monorepo: pnpm workspaces (`pnpm@9.15.0`) + Turborepo (`apps/api`, `apps/web`,
  `packages/shared`)
- Backend: NestJS 11, Prisma 6, PostgreSQL 16, Redis 7, BullMQ, MinIO (S3-compat), Zod
  (`nestjs-zod`), CASL (RBAC)
- Frontend: Next.js 15 (App Router), TailwindCSS, shadcn/ui uslubidagi komponentlar,
  TanStack Query, Zustand, next-intl (`uz.json`)
- Infra: Docker Compose (`docker-compose.yml` — dev; `infra/docker-compose.prod.yml` — prod),
  Nginx reverse-proxy, GitHub Actions CI (`.github/workflows/ci.yml`, `deploy.yml`)
- To'liq tafsilot uchun: `README.md`, `docs/ARCHITECTURE.md`, `docs/DB-SCHEMA.md`

### Hozirgi kod bazasida allaqachon mavjud bo'lgan qismlar (sinash kerak bo'lganlar)

- **Auth**: register/login/refresh/logout, JWT (access 15m / refresh 7d rotatsiya + reuse
  detection), argon2 parol hash, audit log yozish
- **RBAC**: 7 rol, ruxsatlar katalogi (`packages/shared/src/constants/permissions.ts`),
  CASL asosida `PermissionsGuard` + `@RequirePermissions`
- **Users CRUD** (`apps/api/src/modules/users`, `apps/web/src/features/users`)
- **Organizations CRUD** (`apps/api/src/modules/organizations`, `.../features/organizations`)
- **Courses/Lessons CRUD** (`apps/api/src/modules/courses`, `.../features/learning`) — Prisma
  migratsiyasi ikkita: `20260912195732_init_phase_0_to_5` va
  `20260913094217_add_education_level`
- **Seed skriptlari**: `prisma/seed.ts` (asosiy — rollar/ruxsatlar/super-admin),
  `prisma/seed-ekologiya.ts`, `prisma/seed-education-extra.ts` (qo'shimcha kurs kontenti)
- **Web sahifalar**: `(auth)` guruhi (login/register/forgot/reset), `(dashboard)` guruhi
  (bosh sahifa, `/users`, `/organizations`, `/learning`, `/learning/manage`)

### Bilib qo'yish kerak bo'lgan mavjud holatlar

- `apps/api/dist/`, `apps/web/.next/`, `apps/web/tsconfig.tsbuildinfo` — eski build
  artefaktlari allaqachon papkada bor. Ularni **toza boshlash uchun o'chirib qayta qurish**
  tavsiya etiladi (pastdagi 1-bosqichga qarang) — eski `dist` yangi kod bilan mos kelmasligi
  build/runtime xatolariga sabab bo'lishi mumkin.
- `node_modules` va `.pnpm-store` allaqachon mavjud — lekin ular eski/nomukammal bo'lishi
  mumkin. Shubha tug'ilsa, toza `pnpm install` bilan boshlang.
- Root papkada loyihaga aloqasi bo'lmagan ikkita fayl bor: `oliy ta'lim uchun.docx` va
  `экобаланс.rar` — bularga tegilmang, ular kodga bog'lanmagan.

## Bosqichlar (har birida aniq sinov mezoni bilan)

### 0-bosqich — Muhitni tekshirish

- `node -v` (>= 20.11.0), `pnpm -v` (>= 9.0.0), `docker -v`, `docker compose version`
- `.env` faylining mavjudligi va asosiy o'zgaruvchilar (`DATABASE_URL`, `JWT_ACCESS_SECRET`,
  `JWT_REFRESH_SECRET`, `SUPER_ADMIN_EMAIL/PASSWORD`) bo'sh emasligini tekshiring.
  **Sinov**: hech qanday buyruq xato bermasligi, versiyalar minimal talabga mos kelishi kerak.

### 1-bosqich — Toza o'rnatish

- Eski build artefaktlarini tozalang: `pnpm clean` (root `package.json`dagi skript —
  `turbo run clean && rimraf node_modules`), yoki qo'lda `apps/api/dist`,
  `apps/web/.next`, `apps/web/tsconfig.tsbuildinfo`, barcha `node_modules` papkalarini
  o'chiring.
- `pnpm install` — root papkada.
  **Sinov**: `pnpm install` xatosiz tugashi, `node_modules` va workspace symlink'lari
  (`apps/api/node_modules/@eco/shared` va h.k.) to'g'ri yaratilganini tekshiring.

### 2-bosqich — Infratuzilmani ko'tarish (Docker)

- `make up` (yoki `docker compose up -d postgres redis minio mailpit`) — faqat infra
  konteynerlarini birinchi ko'tarib ko'ring (api/web hali emas, chunki ular hali build
  qilinmagan/migratsiya o'tmagan bo'lishi mumkin).
  **Sinov**: `docker compose ps` barcha konteynerlar `healthy`/`running` ekanini ko'rsatishi,
  Postgres'ga `psql`/Prisma orqali ulanish mumkinligini tekshiring.

### 3-bosqich — Prisma migratsiya va seed

- `pnpm --filter @eco/api prisma generate`
- `pnpm --filter @eco/api prisma migrate deploy` (yoki mavjud migratsiyalar allaqachon
  qo'llanganmi tekshirish uchun avval `prisma migrate status`)
- `pnpm --filter @eco/api prisma db seed` (asosiy seed — rollar, ruxsatlar, super-admin)
- Ixtiyoriy: `pnpm --filter @eco/api prisma:seed:ekologiya` va `prisma:seed:extra` — agar
  ular ilgari muvaffaqiyatli ishlagan bo'lsa, qayta ishga tushirib idempotent ekanini
  tasdiqlang (ikkinchi marta ishga tushirilganda xato bermasligi yoki dublikat
  yaratmasligi kerak).
  **Sinov**: `prisma studio` orqali (yoki to'g'ridan-to'g'ri SQL bilan) `roles` jadvalida
  7 ta rol, `permissions` jadvalida barcha ruxsatlar, `users` jadvalida
  `admin@eco-balance.uz` (yoki `.env`dagi `SUPER_ADMIN_EMAIL`) borligini tasdiqlang.

### 4-bosqich — Backend: build, typecheck, lint

- `pnpm --filter @eco/api typecheck`
- `pnpm --filter @eco/api lint`
- `pnpm --filter @eco/api build`
  **Sinov**: uchalasi ham xatosiz (0 error) tugashi kerak. Har qanday TypeScript/ESLint
  xatosi shu bosqichda tuzatilishi kerak — build muvaffaqiyatli tugamasa, keyingi
  bosqichga o'tmang.

### 5-bosqich — Backend runtime smoke test

- `pnpm --filter @eco/api start:dev` (yoki `make sh-api` orqali konteyner ichida)
- `GET /api/v1/health` — 200 qaytishini tekshiring
- `GET /api/docs` — Swagger UI ochilishini tekshiring
- Swagger yoki curl orqali qo'lda sinang:
  - `POST /api/v1/auth/register` — yangi CITIZEN yaratish
  - `POST /api/v1/auth/login` — super-admin bilan kirish, access token olish
  - `POST /api/v1/auth/refresh` — cookie orqali yangi token olish
  - `GET /api/v1/auth/me` — profil (rollar + ruxsatlar) to'g'ri qaytishini tekshirish
  - `GET /api/v1/users`, `GET /api/v1/organizations`, `GET /api/v1/courses` — super-admin
    tokeni bilan 200, ruxsatsiz (masalan yaratilgan oddiy CITIZEN) tokeni bilan
    `/users` POST kabi amallarga **403** qaytishini tekshirish (RBAC ishlayotganini
    tasdiqlash)
  **Sinov**: yuqoridagi barcha so'rovlar kutilgan status kod va tanadagi ma'lumotni
  qaytarishi kerak.

### 6-bosqich — Backend avtomatik testlar

- `pnpm --filter @eco/api test` (Vitest unit)
- `pnpm --filter @eco/api test:e2e` (Vitest + Supertest, `auth.e2e.spec.ts` mavjud)
  **Sinov**: barcha testlar yashil (passing). Muvaffaqiyatsiz test — yoki test eskirgan
  (kod o'zgargan, lekin test yangilanmagan), yoki haqiqiy regressiya. Ikkalasini ham
  aniqlab, mos ravishda tuzating (testni yangilang YOKI kodni tuzating — qaysi biri
  to'g'ri ekanini logikadan aniqlang, ko'r-ko'rona testni "moslashtirmang").

### 7-bosqich — Frontend: build, typecheck, lint

- `pnpm --filter @eco/web typecheck`
- `pnpm --filter @eco/web lint`
- `pnpm --filter @eco/web build`
  **Sinov**: uchalasi ham xatosiz tugashi kerak.

### 8-bosqich — Frontend runtime smoke test (dizaynni tekshirish bilan)

- `pnpm --filter @eco/web dev`
- Brauzerda quyidagi sahifalarni oching va **konsolda xato yo'qligini** hamda **vizual
  ko'rinish o'zgarmaganini** tasdiqlang:
  - `/login`, `/register`, `/forgot-password`, `/reset-password`
  - `/` (bosh sahifa — hero banner, KPI grid, xarita, grafik, ta'lim bloki, yangiliklar)
  - `/users`, `/organizations` — jadval, pagination, create/edit/delete dialoglari
  - `/learning`, `/learning/manage` — kurslar ro'yxati, dars qo'shish/tahrirlash
  - `/monitoring`, `/chatbot`, `/dashboard`, `/reports` va h.k. — "ishlab chiqilmoqda"
    sahifasi to'g'ri ko'rsatilishini (bu normal holat, YUQORIDAGI CHEKLOVGA qarang)
  **Sinov**: hech bir sahifada oq/bo'sh ekran yoki React xatosi chiqmasligi, barcha
  matnlar (`uz.json` orqali) to'g'ri ko'rinishi kerak.

### 9-bosqich — Frontend avtomatik testlar

- `pnpm --filter @eco/web test`
  **Sinov**: barcha testlar yashil.

### 10-bosqich — To'liq Docker Compose integratsiyasi

- `make up` (yoki `docker compose up -d` — barcha servislar: postgres, redis, minio,
  mailpit, api, web, nginx)
- `http://localhost` — web ilova ochilishi
- `http://localhost/api/v1/health` — API javob berishi
- `http://localhost/api/docs` — Swagger nginx orqali ham ishlashi
- `http://localhost:9001` — MinIO konsoli
- `http://localhost:8025` — Mailpit
  **Sinov**: hammasi Nginx orqali proksi qilinganida ham to'g'ri ishlashi kerak (CORS,
  cookie domain sozlamalari to'g'ri bo'lishi muhim — `.env`dagi `COOKIE_DOMAIN`,
  `CORS_ALLOWED_ORIGINS`).

### 11-bosqich — Uchdan-uchgacha (end-to-end) qo'lda tekshirish

Brauzerda haqiqiy foydalanuvchi bo'lib quyidagi ssenariyni to'liq bajaring:

1. Super-admin bilan kirish (`admin@eco-balance.uz` / `.env`dagi parol)
2. Yangi tashkilot (masalan maktab) yaratish
3. Yangi foydalanuvchi yaratish va unga rol biriktirish
4. Chiqish, yangi foydalanuvchi bilan kirish — faqat unga ruxsat berilgan sahifalar
   ishlashini (boshqalari 403/UI xatosiz "ruxsat yo'q" ko'rsatishini) tekshirish
5. Yangi kurs va unga bir nechta dars qo'shish, ro'yxatda to'g'ri ko'rinishini tekshirish
6. Parolni "unutdim" oqimini oxirigacha sinash (Mailpit orqali xatni ko'rish)

**Sinov**: yuqoridagi barcha qadamlar xatosiz, kutilgan natija bilan bajarilishi kerak.

## Yakuniy hisobot (majburiy)

Ishni tugatgach, quyidagilarni o'z ichiga olgan qisqa hisobot yozing:

- Har bir bosqich holati (✅/❌) va agar ❌ bo'lgan bo'lsa — sabab va qilingan tuzatish
- O'zgartirilgan fayllar ro'yxati (agar bo'lsa) va **har biri nima uchun** o'zgartirilgani
  (faqat xato tuzatish uchun bo'lishi kerak, dizayn/feature o'zgarishi emas)
- Agar biror narsa cheklov tufayli (yangi feature/dizayn talab qilgani uchun) ataylab
  qilinmagan bo'lsa — buni aniq ko'rsating, keyingi bosqich uchun eslatma sifatida qoldiring
- `make fresh` (DB'ni tozalab qayta migratsiya+seed) oxirgi marta ishlatilib, hammasi
  noldan ham muammosiz ko'tarilishini tasdiqlovchi yakuniy tekshiruv natijasi
