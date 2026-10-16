# VAZIFA: PedResearch Lab platformasini 3 rolli (Super Admin / O'qituvchi / Talaba) tizimga o'tkazish

Sen Eco-Balance monorepo (Next.js 15 + NestJS 11 + Prisma/Postgres + Redis + MinIO, Docker) ustida ishlayotgan senior full-stack muhandissan. Foydalanuvchi bilan O'ZBEK tilida, qisqa gaplash. Kod, o'zgaruvchi va commit xabarlari mavjud loyiha uslubida qolsin; UI matnlari o'zbek tilida.

Bu kichik tuzatish emas, FUNDAMENTAL o'zgarish: loyiha endi "ekologik monitoring + fuqarolar" platformasidan "ekologik ta'lim LMS" ga aylanadi. Avval o'rgan va REJA ber, men tasdiqlagandan keyin bosqichma-bosqich amalga oshir.

---

## 1. Hozirgi holat (o'zing tekshirib tasdiqla)

- `apps/api/prisma/schema.prisma`: `enum RoleSlug { SUPER_ADMIN, ADMIN, CITY_ADMIN, MAHALLA_MANAGER, TEACHER, STUDENT, CITIZEN }`; `User`, `Role`, `Permission`, `UserRole`, `RolePermission`, `Organization`, `Course`, `Lesson`, `CourseMaterial`, `Quiz`, `QuizQuestion`, `QuizSubmission`, `QuizAnswer`, `EducationLevelItem`, `News`, `EcoReport`, `AiConversation`, `AuditLog` va boshqalar.
- NestJS modullari: `auth` (JWT access 15 daqiqa + aylanuvchi refresh cookie 7 kun, CASL RBAC), `users`, `roles`, `organizations`, `courses`, `quizzes`, `education-levels`, `news`, `eco-reports`, `chatbot`, `analytics`, `notifications`, `platform-settings`, `storage`.
- Web (`apps/web/src/app/(dashboard)`): home, dashboard, learning, monitoring, chatbot, analytics, recommendations, news, users, organizations, mahalla, reports, settings. Sidebar rolga qarab accent rangi o'zgaradi (yashil: fuqaro/talaba/o'qituvchi, ko'k: adminlar, binafsha: mahalla rahbari).
- `Course.educationLevel` slug matn (FK yo'q). Kurslar hozir global, egasi (owner) yo'q.
- Dev admin: `admin@eco-balance.uz` (seed'dan).

Ish boshlashdan oldin yuqoridagilarni, `docs/DB-SCHEMA.md` va `docs/ARCHITECTURE.md` ni (eskirgan bo'lishi mumkin, kodga ishon) o'qib chiq.

## 2. Maqsadli model: faqat 3 ta rol

### 2.1 SUPER_ADMIN (tizimda FAQAT BITTA)
- Tizimda bitta Super Admin bo'ladi. Buni 3 qatlamda ta'minla: (a) seed faqat bitta yaratadi, (b) servis qatlamida ikkinchi SUPER_ADMIN yaratish/tayinlashni taqiqla, (c) DB darajasida partial unique index (SUPER_ADMIN roli uchun) yoki teng kuchli cheklov.
- U o'qituvchi hisobini ham, talaba hisobini ham yarata oladi, tahrirlay oladi, bloklay (`isActive=false`) va parolini tiklay oladi.
- Barcha guruh, kurs, test, topshiriq va statistikani ko'ra oladi.
- Platforma sozlamalari, audit log, ta'lim darajalari, tizim statistikasi faqat unda.
- Super Admin o'qituvchi nomidan ham ishlay olishi kerak (ixtiyoriy kurs/guruhni tahrirlash).

### 2.2 TEACHER (o'qituvchi)
- Hisobni FAQAT Super Admin yaratadi (ommaviy ro'yxatdan o'tish yo'q).
- O'qituvchi FAQAT TALABA yarata oladi (boshqa rol yaratolmaydi, o'zini ham, boshqa o'qituvchini ham).
- Har bir o'qituvchining o'z guruhlari bor; har bir guruh ichida o'z talabalari bor. O'qituvchi faqat O'ZINING guruh/talabalarini ko'radi va boshqaradi (boshqa o'qituvchi ma'lumotiga kira olmaydi, buni `403/404` bilan test qil).
- O'z talabalari uchun qo'sha oladi: darsliklar (kurs/dars), ma'ruzalar (matn + fayl: PDF, PPT, video link/fayl), testlar (`Quiz`), topshiriqlar (`Assignment`).
- Har bir talabaning statistikasini ko'ra oladi: ko'rilgan darslar, test natijalari, topshiriqlar holati va bahosi, oxirgi faollik, o'rtacha ball, guruh bo'yicha reyting.

### 2.3 STUDENT (talaba)
- Hisobni o'qituvchi (yoki Super Admin) yaratadi. O'zi ro'yxatdan o'tolmaydi.
- Faqat o'z guruhiga biriktirilgan kurs/dars/test/topshiriqlarni ko'radi.
- Darslarni ko'radi (dars bo'yicha "ko'rildi" belgisi), testlarni ishlaydi, topshiriqlarni topshiradi (matn va/yoki fayl), o'z natijalari va progressini ko'radi.
- Boshqa talabalarning shaxsiy natijalarini ko'rmaydi (guruh reytingi anonim yoki faqat o'z o'rni bo'lsin, qaror: faqat o'z o'rni).

## 3. Eski rollar va modullar: qaror (rad etmasang shuni qil)

1. `ADMIN`, `CITY_ADMIN`, `MAHALLA_MANAGER`, `CITIZEN` rollari ishlatilmaydi. Enum'dan olib tashlash o'rniga avval migratsiya yoz: mavjud foydalanuvchilarni qayta tasniflash (ADMIN/CITY_ADMIN/MAHALLA_MANAGER -> avval ro'yxatini ko'rsat va menga so'ra; CITIZEN -> STUDENT yoki `isActive=false`, men tanlayman). Keyin enum, seed, CASL ability, guard va frontend'dagi barcha havolalarni tozala. Orqada qolgan "o'lik" kod bo'lmasin.
2. Ommaviy ro'yxatdan o'tish (`/register` va unga mos API) o'chiriladi; login qoladi. "Parolni unutdingizmi" oqimi qoladi.
3. Ekologik monitoring modullari (eco-reports/EKO-PATRUL, news, organizations/mahalla, weather, chatbot, recommendations): ularni DARHOL o'chirma. Ularni "keyingi bosqich" deb belgila: sidebar'dan yashir yoki rolga qarab cheklа, DB va kodni saqlab qol. Faqat men aniq aytgandan keyin o'chirasan. Chatbot (AI) talaba uchun o'quv yordamchisi sifatida qolishi mumkin, buni reja bo'limida taklif qil.
4. `Organization` modeli: o'qituvchi/talaba uchun majburiy emas, ixtiyoriy qoldir (masalan o'qituvchi qaysi maktab/universitetda ishlashi). Majburiy bog'lanish qo'yma.

## 4. Yangi ma'lumotlar modeli (Prisma, taklif; mavjud nomlash uslubiga moslashtir)

- `Group`: id, nameUz, descriptionUz?, `teacherId` (User, TEACHER), isActive, createdAt/updatedAt. Indeks: `teacherId`.
- `GroupMember`: `groupId`, `studentId` (User, STUDENT), joinedAt. Unique `(groupId, studentId)`. Qaror: talaba bir vaqtda faqat BITTA guruhda bo'lsin (`studentId` bo'yicha unique) yoki ko'p guruhli? Reja bo'limida variantlarni yoz va birinchisini tavsiya qil.
- `User.createdById` (kim yaratgan; audit va "o'qituvchi faqat o'zi yaratgan talabalarni boshqaradi" qoidasi uchun).
- `Course.ownerId` (User, null bo'lsa Super Admin/umumiy), `Course.visibility` yoki guruhga biriktirish: `CourseGroup` (courseId, groupId). Talaba kursni faqat guruhi orqali ko'radi. Mavjud global kurslar migratsiyada `ownerId = SUPER_ADMIN` bo'lsin va hech qaysi guruhga ko'rinmasin, men keyin biriktiraman.
- `Lesson`/`CourseMaterial`: mavjud, ma'ruzalar shu orqali; `ownerId` kursdan meros.
- `LessonProgress`: `studentId`, `lessonId`, `completedAt`, `lastViewedAt`. Unique `(studentId, lessonId)`.
- `Quiz`: mavjud. Qo'sh: `ownerId`, `GroupQuiz` (quizId, groupId, opensAt?, closesAt?, maxAttempts?). `QuizSubmission` va `QuizAnswer` mavjud, statistika shulardan hisoblanadi.
- `Assignment`: id, `courseId?`/`lessonId?`, `groupId`, `createdById`, titleUz, descriptionUz, `dueAt`, `maxScore`, fayl biriktirish imkoni.
- `AssignmentSubmission`: `assignmentId`, `studentId`, textUz?, fileUrl? (MinIO), submittedAt, `score?`, `feedbackUz?`, `gradedById?`, `gradedAt?`, status (`SUBMITTED`/`GRADED`/`RETURNED`). Unique `(assignmentId, studentId)`.
- Barcha yangi jadvallar `schema.prisma` + migratsiya bilan; mavjud ma'lumotlar buzilmasin (migratsiya orqaga qaytarilishi mumkin va idempotent bo'lsin).

## 5. Ruxsatlar (CASL) matritsasi

| Resurs | Super Admin | O'qituvchi | Talaba |
|---|---|---|---|
| User (TEACHER yaratish) | CRUD | yo'q | yo'q |
| User (STUDENT yaratish) | CRUD | faqat o'zi yaratgan / o'z guruhidagilar | yo'q |
| Group | hammasi | faqat o'zi egasi bo'lganlar | faqat o'zi a'zo bo'lgan (o'qish) |
| Course/Lesson/Material | hammasi | o'zi yaratganlari (CRUD) | guruhiga biriktirilganlarini o'qish |
| Quiz | hammasi | o'zi yaratganlari (CRUD) + natijalarni ko'rish | guruhiga biriktirilganlarini ishlash |
| Assignment | hammasi | o'zi yaratganlari (CRUD) + baholash | guruhiga berilganlarini ko'rish va topshirish |
| Statistika | tizim bo'yicha | o'z talabalari/guruhlari | faqat o'zining |
| Platforma sozlamalari, Audit, Ta'lim darajalari | CRUD | yo'q | yo'q |

Ruxsatlar faqat frontend'da yashirish bilan cheklanmasin: har bir endpoint backend'da guard va "ownership" tekshiruvi bilan himoyalansin (IDOR'ga qarshi: boshqa o'qituvchi guruhi/talabasi ID'si bilan so'rov yuborilsa rad etilsin).

## 6. API (NestJS) — yangi/o'zgaradigan endpointlar (taklif)

- `POST/GET/PATCH /users/teachers` (faqat Super Admin).
- `POST/GET/PATCH /users/students`: o'qituvchi faqat o'z talabalarini; talaba yaratganda guruh tanlanadi; vaqtinchalik parol generatsiya qilinib bir marta ko'rsatiladi, birinchi kirishda parolni almashtirishga majbur qilish (`mustChangePassword` bayrog'i).
- `/groups` CRUD, `/groups/:id/members` (qo'shish/chiqarish).
- `/courses`, `/lessons`, `/materials`, `/quizzes`: ownership va guruhga biriktirish bilan.
- `/assignments` CRUD, `/assignments/:id/submissions`, `PATCH /submissions/:id/grade`.
- `/lessons/:id/progress` (talaba ko'rildi belgilaydi).
- `/stats/students/:id` (o'qituvchi/Super Admin), `/stats/groups/:id`, `/stats/me` (talaba).
- Barcha o'zgartiruvchi amallar `AuditLog` ga yozilsin. DTO validatsiya (class-validator), mavjud javob formati (`response-transform.interceptor`) saqlansin. Rate limit va refresh-token xavfsizligi buzilmasin.

## 7. Frontend (Next.js) — rolga qarab 3 ta tajriba

Mavjud dizayn tizimini ishlat (Inter, `#21C45D` asosiy yashil, `#3C83F6` admin ko'k, karta radiusi 16, tugma/input radiusi 18, sidebar 256px, topbar 72px, o'zbek tili). Yangi komponentlarni `apps/web/src/features/*` strukturasiga mos qo'sh.

**Super Admin:** Bosh sahifa (tizim KPI), O'qituvchilar (ro'yxat, yaratish, bloklash), Talabalar (hammasi, filtr: o'qituvchi/guruh), Guruhlar, Kurslar, Statistika, Audit, Sozlamalar.

**O'qituvchi:** Bosh sahifa (guruhlar soni, faol talabalar, tekshirilmagan topshiriqlar), Guruhlarim (guruh sahifasi: talabalar jadvali + "Talaba qo'shish"), Kurslarim/Darsliklarim (kurs, dars, ma'ruza va fayl yuklash), Testlarim (test yaratish, savol muharriri, natijalar), Topshiriqlar (yaratish, topshirilganlarni baholash), Statistika (talaba kartasi: progress, ball dinamikasi, topshiriqlar, faollik; guruh bo'yicha jadval va CSV eksport).

**Talaba:** Bosh sahifa (progress, yaqin muddatli topshiriqlar, oxirgi natijalar), Darslarim (kurs -> dars -> ma'ruza materiallari), Testlar, Topshiriqlar (topshirish, ball va izoh), Natijalarim (umumiy statistika, o'tgan/yiqilgan testlar).

Sidebar, route guard (middleware) va menyu rolga qarab; ruxsati yo'q sahifaga kirilsa mos sahifaga yo'naltir. Bo'sh holat (empty state), yuklanish (skeleton) va xato holatlarini qo'sh. Mobil qurilmada talaba tajribasi qulay bo'lsin.

## 8. Qo'shimcha funksiyalar (hozir faqat REJADA taklif qil, men tanlayman)

Guruhga e'lonlar, dars/test muddatlari va eslatmalar (notifications modulidan foydalanib), davomat (attendance), guruh reytingi, sertifikat generatsiyasi (PDF), savollar banki, talabalarni CSV/Excel dan ommaviy import, test natijalarini eksport, AI chatbotni o'quv yordamchisi sifatida ishlatish, o'qituvchi izohlari (talaba haqida yopiq eslatma).

## 9. Ishlash tartibi (qat'iy)

1. **Tahlil:** kodni o'qi, yuqoridagi "hozirgi holat"ni tekshir, noaniq joylarni (masalan: talaba ko'p guruhli bo'la oladimi, eski rol egalari bilan nima qilish) menga SAVOL sifatida ber.
2. **Reja:** bosqichlar, o'zgaradigan fayllar, migratsiya xavfi, test rejasi. Tasdiqlashimni kut.
3. **Bosqichlar** (har biri alohida commit va ishlaydigan holatda):
   - B1: Prisma sxema + migratsiya + seed (bitta Super Admin, test o'qituvchi, test guruh, test talabalar), rol tozalash.
   - B2: Auth/CASL/guard: 3 rol, ownership qoidalari, `mustChangePassword`, ro'yxatdan o'tishni o'chirish.
   - B3: Users (o'qituvchi/talaba yaratish), Groups.
   - B4: Kurs/dars/material/test ownership va guruhga biriktirish.
   - B5: Topshiriqlar va baholash, LessonProgress.
   - B6: Statistika endpointlari.
   - B7: Frontend: Super Admin -> O'qituvchi -> Talaba tajribalari.
   - B8: Eski modullarni yashirish/tozalash, hujjatlarni (`docs/ARCHITECTURE.md`, `docs/DB-SCHEMA.md`) yangilash.
4. **Tekshiruv:** har bosqich oxirida `pnpm typecheck`, `pnpm lint`, build va API testlari; ruxsat testlari majburiy (o'qituvchi A o'qituvchi B talabasiga kira olmaydi; talaba boshqa guruh kursini ko'ra olmaydi; o'qituvchi o'qituvchi yarata olmaydi; ikkinchi Super Admin yaratib bo'lmaydi). Docker'da ishga tushirib `http://localhost:8080` da uchala rol bilan qo'lda sinab ko'r.
5. **Xavfsizlik:** parollarni hech qachon logga yoki javobga (vaqtinchalik parol bundan mustasno, bir marta) chiqarma; fayl yuklashda tur/hajm cheklovi; `.env`/sirlarni commit qilma.
6. Mavjud ma'lumotlarni (kurslar, darslar, fayllar) yo'qotma. Buzuvchi migratsiyadan oldin zaxira buyrug'ini (`pg_dump`) ko'rsat.

## 10. Qabul mezonlari (Definition of Done)

- Tizimda faqat `SUPER_ADMIN`, `TEACHER`, `STUDENT` rollari ishlaydi; ikkinchi Super Admin yaratib bo'lmaydi.
- Super Admin o'qituvchi va talaba yaratadi; o'qituvchi faqat talaba yaratadi; talaba o'zi ro'yxatdan o'ta olmaydi.
- O'qituvchi o'z guruhlari va talabalarini boshqaradi, o'z talabalariga kurs, ma'ruza, test va topshiriq beradi, har bir talabaning statistikasini ko'radi.
- Talaba faqat o'z guruhiga berilgan darslarni ko'radi, testlarni ishlaydi, topshiriqlarni topshiradi va natijasini ko'radi.
- Ruxsat testlari o'tadi, typecheck/lint/build toza, Docker'da uchala rol uchun asosiy oqimlar ishlaydi.
- Hujjatlar yangilangan.

Boshlash: 1-qadamdan (Tahlil). Hech narsani o'zgartirmasdan oldin menga qisqa savollar ro'yxati va reja ber.
