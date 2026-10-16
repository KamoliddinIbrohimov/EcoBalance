# PROMPT: LMS mantig'ini tuzatish va yangi bloklar (mavzu joylash, 3 xil topshiriq, o'qish rejimi tahlili)

Rol: sen PedResearch Lab (Eco-Balance) monorepo'sida ishlayotgan senior full-stack muhandissan (Next.js 15 + NestJS 11 + Prisma + Postgres). Repo: `C:\Users\QA\Desktop\Eco-Balance`. UI va xabarlar o'zbek tilida, zod sxemalar `packages/shared`da, rollar: SUPER_ADMIN (bitta), TEACHER, STUDENT. Avval `docs/PROMPT-rollar-qayta-tuzish.md`, `docs/QA-hisobot-3-raund.md` va `docs/ARCHITECTURE.md`ni o'qi, mavjud uslubga (DTO, CASL permissions, audit, notifications) amal qil.

Bu hujjat 4 qismdan iborat: (0) deploy sharti, (1) QA topgan mantiqiy xatolar, (2) yangi bloklar spetsifikatsiyasi, (3) tartib va qabul mezonlari.

---

## 0. Deploy sharti (BIRINCHI QADAM)

QA paytida ishlayotgan API konteyneri `a1a106d` commit'idan oldingi kodda edi: `/groups/:id/courses/:courseId` 404 berdi, noto'g'ri UUID hali ham 500 + Prisma yo'lini sizdirdi. Ya'ni raund-3 tuzatishlari ishga tushmagan.

1. `docker compose up -d --build api web` (+ `prisma migrate deploy` / seed), keyin raund-3 tuzatishlarini (kurs/test guruhga biriktirish, UUID 400, 413, educationLevel) qayta tekshir.
2. Har bir keyingi fazadan so'ng konteynerni qayta build qilib, smoke-test o'tkaz. README'ga "o'zgartirishdan keyin qayta build" qadamini yoz.

---

## 1. QA topgan mantiqiy xatolar (jonli API + kod tekshiruvi bilan tasdiqlangan)

Belgilar: [J] — jonli API'da tasdiqlandi, [K] — kod o'qishda aniqlandi (build eskirgani uchun jonli sinab bo'lmadi, tuzatgach qayta tekshir).

### KRITIK

**L1. Talaba hamma darsni ko'radi [J].** `GET /lessons`, `GET /lessons/:id`, `GET /courses/:id/lessons` actor'ni umuman olmaydi. Guruhsiz/begona talaba 62 ta darsni (qoralama va boshqa o'qituvchining kursi ham) nazariya matni bilan oldi. Tuzat: `CoursesService.listLessons / listLessonsByCourse / findLessonById`ga actor bering. STUDENT faqat o'z guruhiga biriktirilgan va `isPublished=true` kurs darslarini (hamda ochilish sanasi kelgan darslarni, 2.A) ko'rsin; TEACHER o'z kurslari yoki ochiq kutubxona; SA hammasini.

**L2. Progress mantig'i buzuq [J].** `POST /lessons/:id/progress` istalgan dars uchun ishlaydi (begona/qoralama kurs ham). Natijada `lessonsTotal=0` bo'lsa-da `lessonsCompleted=3` (progress >100% yoki ma'nosiz). Tuzat: (a) progress faqat talabaning guruhidagi ochiq darsga yoziladi, aks holda 404; (b) `studentStats.lessonsCompleted` faqat guruhga biriktirilgan kurslar darslari bilan kesishmasi bo'yicha hisoblansin; (c) `progressPercent` 100 dan oshmasin.

**L3. Frontend progress'ni umuman yubormaydi [K].** `apps/web`da `/lessons/:id/progress` chaqiruvi yo'q, "Darsni tugatdim" tugmasi yo'q. Shu sababli talaba statistikasida darslar doim 0%. Tuzatish 2.C bilan birga.

**L4. Kurs/test kutubxonasi mantig'i yo'q [K].** `bindCourse`/`bindQuiz` faqat `ownerId === actor` bo'lsa ruxsat beradi. Seed kurslarning `ownerId`si `null`, SA yaratganlariniki SA: o'qituvchi ularni guruhiga biriktira olmaydi (403), faqat o'z yaratganini. Tuzat: kurs/testga `visibility` (`PRIVATE` | `LIBRARY`) qo'sh; SA `LIBRARY` qilib belgilagan kurs/test barcha o'qituvchilarga biriktirish uchun ochiq (tahrir emas); o'qituvchi uchun "Nusxa olish" (clone course + lessons + materials + quiz) endpoint'i: `POST /courses/:id/clone`.

### YUQORI

**L5. Topshiriq bog'lamlari tekshirilmaydi [J].** `lessonId` boshqa kursga (hatto begona o'qituvchi kursiga) tegishli bo'lsa ham, `courseId` begona kurs bo'lsa ham 201. Qoida: `lesson.courseId === courseId`; kurs shu guruhga biriktirilgan bo'lishi; `lessonId` bersa `courseId` avtomatik to'ldirilsin.

**L6. Baho o'rtachasi normallashtirilmagan [J].** 9/10 va 50/100 baholari uchun `assignmentsAverageScore=30` (xom ball o'rtachasi), to'g'risi 70%. Tuzat: foizda hisobla (`score/maxScore`), UI'da ham foiz ko'rsat; guruh va talaba statistikasida shu formulani ishlat.

**L7. Topshiriqni tahrirlash qoidalari yo'q [J].** (a) Baholangan ball bor bo'lsa `maxScore`ni pasaytirish 200 (ball > maxScore holati paydo bo'ladi): 409 qaytar yoki mavjud ballar chegarasi bilan tekshir; (b) `PATCH dueAt` o'tgan sanaga qo'yish 200 (yaratishda bloklangan, tahrirda emas); (c) muddat/tavsif o'zgarganda talabalarga bildirishnoma yo'q.

**L8. "Qaytarildi" (RETURNED) oqimi ishlamaydi [J].** O'qituvchi javobni qayta ishlash uchun qaytaradi, lekin `submitAssignment` `status !== SUBMITTED` bo'lsa rad etadi: talaba qayta topshira olmaydi. Tuzat: `RETURNED` holatida qayta topshirish ruxsat etilsin (status → SUBMITTED, `attempt` hisoblagichi +1, oldingi javob tarixda saqlansin: `AssignmentSubmissionRevision`); `GRADED` holatda taqiq qolsin (yoki o'qituvchi "qayta ochish" tugmasi bilan).

**L9. Nofaol guruh [J].** `isActive=false` guruhda talaba topshiriqlarni ko'rishda davom etadi, o'qituvchi yangi topshiriq yarata oladi. Qoida: nofaol guruh = o'qish-faqat arxiv; talabaga yangi kontent berilmaydi; yaratish/topshirish 409.

**L10. Guruhni almashtirish mantig'i aniq emas [J].** Talaba guruhdan chiqarilib boshqasiga qo'shilganda eski guruh topshiriqlari `assignmentsSubmitted`da qolib ketadi (statistika 2, ro'yxat 0). Tuzat: `POST /groups/:id/members/:studentId/transfer` (bitta tranzaksiya); statistika "joriy guruh" va "umumiy tarix" bo'yicha ajratilsin; guruh o'chirilganda (cascade) baholar yo'qolishi haqida tasdiqlash ogohlantirishi va `archive` imkoni.

**L11. Darslarni qayta tartiblash va o'chirish [J].** `orderIndex` unique bo'lgani uchun ikki darsni almashtirib bo'lmaydi (409). `DELETE /lessons/:id` talabalarning progressini ogohlantirishsiz cascade o'chiradi (completed 3 → 2). Tuzat: `PUT /courses/:id/lessons/order` (butun tartib, bitta tranzaksiya); darsga `isPublished`/`archivedAt` (soft delete) qo'sh; o'chirishdan oldin ta'sir hisobotini ber (nechta talaba progressi, nechta topshiriq bog'langan).

**L12. Test sozlamalari ishlamaydi [K].** `GroupQuiz.opensAt / closesAt / maxAttempts` sxemada bor, lekin `bindQuiz` ularni yozmaydi, `submit` esa o'qimaydi: test cheksiz qayta topshiriladi. Tuzat: bind endpoint'iga bu maydonlarni qabul qildir va `submit`da majburiy tekshir (ochilish/yopilish, urinishlar soni, 409/403 aniq xabar bilan). `startedAt` va `submittedAt` farqi sifatida test davomiyligi saqlansin; `timeLimitMinutes` qo'sh (server tomonda).

**L13. Test statistikasi noto'g'ri [K].** `quizzesTaken` urinishlar sonini sanaydi (bitta testni 2 marta topshirgan talaba "2/2" ko'rinadi); o'rtacha hamma urinish bo'yicha. Tuzat: noyob testlar bo'yicha, eng yaxshi (yoki oxirgi, sozlanadigan) urinish; `quizzesAssigned` (guruhga biriktirilgan jami) va "topshirilmagan" hisobi qo'sh. Shuningdek test natijasi bildirishnomasi faqat SUPER_ADMIN'ga ketadi: guruh o'qituvchisiga ham yuborilsin.

**L14. Fayl topshirish yo'q [K].** `fileKey`, `fileName`, `attachmentKey` maydonlari bor, lekin hech qanday upload/download endpoint'i va UI yo'q (xato matni "fayl yuklash alohida endpointda" deydi, u mavjud emas). MinIO (`storage` moduli) orqali: o'qituvchi topshiriqqa fayl biriktiradi, talaba javob fayli yuklaydi (ruxsat etilgan turlar, hajm limiti, antivirus/MIME tekshiruvi), yuklab olish faqat ruxsatli rollar uchun (presigned URL).

### O'RTA

**L15. Guruh statistikasi [K].** `groupStats` har talaba uchun ketma-ket so'rov yuboradi (N+1); `pendingSubmissions` talabalarning BARCHA topshiriqlarini (boshqa guruh topshiriqlarini ham) sanaydi; talabalar kesimidagi jadval yo'q (faqat 5 ta umumiy raqam). Tuzat: bitta agregat so'rov, faqat shu guruh topshiriqlari bo'yicha; `GET /stats/groups/:id/students`.

**L16. `lastActivityAt` faqat test/topshiriqni hisobga oladi [K];** dars ko'rishlar (`lastViewedAt`) hisobga olinmaydi.

**L17. O'qituvchi statistikasi UI'da talaba kesimi yo'q [K].** `/stats` faqat guruh kartalari; `/stats/students/:id` frontend'da ishlatilmaydi.

**L18. Nofaol foydalanuvchi va test qoldiqlari [J].** Soft-delete qilingan foydalanuvchilar email'ni band qiladi (qayta ishlatib bo'lmaydi), ro'yxatlar sahifalanmaydi (`limit` e'tiborsiz, default 20). `limit`/`perPage` parametrlarini bir xil qil; `isActive=false` foydalanuvchining emailini qayta ishlatish yoki anonimlashtirish qoidasini belgila.

---

## 2. Yangi bloklar spetsifikatsiyasi

### 2.A Mavzularni joylash (kontent rejalashtirish)

Maqsad: o'qituvchi kursni mavzular (bo'limlar) bo'yicha tuzadi va HAR BIR GURUHGA alohida qachon/qanday ochishni belgilaydi.

- Ma'lumotlar: `Course → Module (mavzu/bo'lim: id, courseId, titleUz, orderIndex, descriptionUz) → Lesson`. `Lesson.moduleId` (nullable, mavjud darslar uchun "Umumiy" modul avtomatik yaratilsin: migratsiya).
- `Lesson`: `isPublished`, `estimatedMinutes`, `archivedAt`.
- Guruh bo'yicha ochilish: `GroupLessonRelease { groupId, lessonId | moduleId, opensAt, closesAt?, status: OPEN|SCHEDULED|LOCKED }` va `CourseGroup.sequential` (oldingi dars tugatilmaguncha keyingisi yopiq) bayrog'i.
- Talaba ko'rinishi: faqat `OPEN` (yoki `opensAt <= now`) darslar; yopiq darslar kulrang "Ochilish: 20-oktabr" bilan ko'rinadi, mazmuni API'dan qaytmaydi.
- O'qituvchi UI: guruh sahifasida "Mazmun" tabida modul/dars daraxti, drag&drop tartib, har mavzu yonida "Ochish / Rejalashtirish (sana) / Yopish", ommaviy amal ("1-3 mavzularni ochish"), qoralama/e'lon holati.
- Mavzuga bog'lanish: topshiriq, test, material `moduleId`/`lessonId` bilan bog'lanadi; mavzu sahifasida shu mavzuning barcha topshiriq va testlari bir joyda chiqadi.
- Bildirishnoma: dars ochilganda guruh talabalariga xabar (bir martalik, takrorsiz).

### 2.B Topshiriqlar: 3 xil tur

`Assignment.kind` enum: `TASK | TIMED | QUESTIONNAIRE`.

1. **TASK — mavzuga biriktirilgan topshiriq.** `lessonId`/`moduleId` majburiy (L5 qoidalari bilan). Javob: matn va/yoki fayl (L14). Muddat (`dueAt`) ixtiyoriy; kechikish siyosati: `allowLate`, `latePenaltyPercent`, kechikkan topshiriq "KECHIKKAN" belgisi bilan qabul qilinadi (hozirgi qat'iy rad etish o'rniga o'qituvchi tanlaydi).
2. **TIMED — vaqt bilan tekshiruvchi topshiriq.** `startsAt`, `endsAt`, `timeLimitMinutes`. Talaba "Boshlash" bosganida server `attemptStartedAt` va `attemptDeadline = min(start + limit, endsAt)` ni yozadi; deadline'dan keyingi javob serverda rad etiladi (yoki avtomatik yopiladi); sahifa yangilanganda taymer serverdan tiklanadi; bitta faol urinish. O'qituvchi alohida talabaga vaqtni uzaytira oladi (`AssignmentAccommodation { assignmentId, studentId, extraMinutes | newDueAt }`).
3. **QUESTIONNAIRE — savol-javob / test ko'rinishidagi topshiriq.** Mavjud test dvigatelidan foydalan: `Assignment.quizId` (yoki inline savollar). Savol turlari: yopiq test (avto-baho), ochiq javob (o'qituvchi qo'lda baholaydi, `QuizAnswer.manualScore`), aralash. Sozlamalar: `maxAttempts`, `shuffleQuestions`, `shuffleOptions`, `showCorrectAnswers: NEVER|AFTER_SUBMIT|AFTER_DUE`, `passPercent`. Yakuniy ball = avto ball + qo'lda ball; qo'lda baholanmagan javoblar bo'lsa status `PENDING_REVIEW`. Test dvigateli (L12) sozlamalari shu yerda ham ishlaydi, kod takrorlanmasin: "GroupQuiz" va "Assignment QUESTIONNAIRE" bitta servisga tayansin.

Umumiy talablar:
- Barcha turlarda: yaratish/o'zgartirishda talabalarga bildirishnoma; muddatga 24 soat va 1 soat qolganda eslatma; muddat o'tib, topshirmaganlar ro'yxati.
- O'qituvchi UI: topshiriq yaratish formasi tur tanlovi bilan, javoblar jadvali (filtr: topshirgan / topshirmagan / baholanmagan / kechikkan), tezkor baholash, ommaviy "eslatma yuborish".
- Talaba UI: `/assignments` ro'yxatida har topshiriq holati (Ochilmagan / Topshirilmagan / Topshirilgan / Baholangan / Qaytarilgan / Kechikkan), qolgan vaqt hisoblagichi, baho va izoh; "Qayta topshirish" faqat ruxsat bo'lganda faol (hozir baholangandan keyin ham faol ko'rinadi).

### 2.C O'qish rejimini tahlil qilish va kuzatish

Hozir faqat `lastViewedAt` va `completedAt` bor. Kerak: talabaning qanday o'qiyotganini o'qituvchi ko'ra olishi.

Ma'lumotlar:
- `LessonProgress`ga: `firstViewedAt`, `viewCount`, `timeSpentSec`, `lastPosition` (0..100 yoki bo'lim indeksi), `completedAt`.
- `StudySession { id, studentId, lessonId?, startedAt, endedAt, activeSeconds }` va yengil `StudyEvent { studentId, type, refId, at, meta }` (type: LESSON_OPEN, LESSON_HEARTBEAT, LESSON_COMPLETE, MATERIAL_OPEN, QUIZ_START, QUIZ_SUBMIT, ASSIGNMENT_OPEN, ASSIGNMENT_SUBMIT).
- Frontend heartbeat: dars sahifasi ochiq va tab faol bo'lsa har 30 soniyada `POST /lessons/:id/heartbeat { activeSeconds, position }` (visibilitychange/idle'da to'xtaydi; server har chaqiruvda ko'pi bilan 60s qo'shadi, ya'ni soxta vaqtni oldini oladi). "Darsni tugatdim" tugmasi (L3) va minimal vaqt qoidasi (ixtiyoriy: kamida X% o'qilgan bo'lsa).

Hisob-kitoblar (talaba bo'yicha): kurs/mavzu/dars progressi, umumiy va haftalik o'qish vaqti, kunlik faollik (heatmap), uzluksiz kunlar (streak), o'rtacha dars vaqti, so'nggi faollik, topshiriq/test bajarish foizi (L6, L13 formulalari), kutilayotgan muddatlar.

Xavf qoidalari ("e'tibor kerak" belgisi, o'qituvchi sozlay oladi): 7+ kun faolsiz; 2+ muddati o'tgan topshiriq; o'rtacha ball < 50%; progress guruh o'rtachasidan 30%+ past.

API:
- `GET /stats/students/:id/overview`, `/timeline?from&to`, `/lessons` (dars kesimida vaqt, ko'rishlar, holat).
- `GET /stats/groups/:id/students` (jadval: ism, progress, o'rtacha ball, oxirgi faollik, vaqt, xavf belgisi), `/stats/groups/:id/analytics` (har dars bo'yicha tugatish voronkasi, o'rtacha vaqt, qaysi darsda ko'p talaba to'xtaydi, topshiriq bajarish foizi, faollik heatmap).
- `GET /stats/me/overview` (talabaning o'zi uchun, 2.A holati bilan "Davom etish" havolasi).
- Ruxsat: TEACHER faqat o'z guruhi talabalari; SA hammasi; STUDENT faqat o'zi (mavjud scoping qoidasi o'zgarmasin). Eksport: guruh hisoboti CSV/XLSX.

UI:
- O'qituvchi: `/groups/:id` ichida "Statistika" tabi: KPI kartalar, talabalar jadvali (saralash, xavf filtri), grafiklar (haftalik faollik, dars bo'yicha voronka), talaba kartasi sahifasi (`/groups/:id/students/:sid`: timeline, dars kesimi, topshiriq va testlar, baholar dinamikasi). `/stats` sahifasi guruh kartalaridan shu sahifalarga olib borsin.
- Talaba: "Mening o'qish rejimim" (`/stats/me`): haftalik vaqt, streak, progress halqasi, "Keyingi dars" tugmasi, yaqin muddatlar, olingan ballar dinamikasi.
- Yangi ma'lumot yo'qligida bo'sh holat matnlari (hozirgi `0/0` o'rniga "Hali darslar biriktirilmagan").
- Grafiklar uchun loyihadagi dizayn tokenlaridan foydalan (#21C45D asosiy, #3C83F6 admin urg'usi), yangi kutubxona kerak bo'lsa minimal.

Maxfiylik: faoliyat ma'lumotlari faqat guruh o'qituvchisi va SA ko'radi; saqlash muddati (masalan 12 oy) va talabaga "o'qish vaqtim kuzatiladi" tushuntirishi login/profilda ko'rsatilsin.

---

## 3. Tartib, test va qabul mezonlari

Fazalar (har biri alohida commit: `fix(lms): ...` / `feat(lms): ...`, har fazadan keyin build + smoke):
- **F0** — deploy sharti (0-bo'lim) va raund-3 tuzatishlarini tasdiqlash.
- **F1** — L1, L2, L5, L6, L7, L9 (xavfsizlik va hisob-kitob to'g'riligi; sxema o'zgarishsiz yoki minimal).
- **F2** — L4, L8, L10, L11, L12, L13 + sxema migratsiyalari (visibility, clone, transfer, revision, lesson publish/archive, quiz sozlamalari).
- **F3** — 2.A mavzu joylash (Module, GroupLessonRelease, UI).
- **F4** — 2.B uchta turdagi topshiriq + L14 (fayl).
- **F5** — 2.C o'qish rejimi: heartbeat, agregatlar, API, o'qituvchi/talaba UI, L3, L15–L17.
- **F6** — L18, README/ARCHITECTURE yangilash, e2e testlar.

Har bir fix uchun avtomatik test yoz (API e2e, Jest/Supertest). Minimal tekshiruvlar (QA shularni qayta o'tkazadi):
1. Talaba begona/qoralama/guruhga biriktirilmagan kurs darsini GET qilsa 404; progress yozsa 404.
2. Progress `lessonsCompleted <= lessonsTotal`, `progressPercent <= 100`.
3. 9/10 va 50/100 baholari → o'rtacha 70%.
4. `lessonId` boshqa kurs darsi bo'lsa topshiriq yaratish 400/409.
5. `maxScore`ni baholangan balldan past qilish 409; `dueAt`ni o'tmishga o'zgartirish 400.
6. RETURNED → talaba qayta topshiradi (SUBMITTED, attempt=2); GRADED → rad.
7. Nofaol guruhda yaratish/topshirish 409, talabaga yangi kontent ko'rinmaydi.
8. Talaba transfer'dan keyin statistika joriy guruh bo'yicha; eski tarix alohida.
9. Ikki darsning tartibini almashtirish 200; dars o'chirishdan oldin ta'sir hisobotini qaytaradi.
10. Test: `closesAt` o'tgan / `maxAttempts` to'lgan bo'lsa submit 403/409; `quizzesTaken` noyob testlar soni.
11. TIMED: deadline'dan keyingi javob rad; sahifa yangilanganda taymer serverdan tiklanadi; uzaytirilgan talabaga alohida muddat.
12. QUESTIONNAIRE: ochiq javob qo'lda baholangunga qadar `PENDING_REVIEW`; yakuniy ball = avto + qo'lda.
13. Heartbeat 60s dan ortiq vaqt qo'sha olmaydi; boshqa talabaning dars vaqtini ko'rish 403.
14. Guruh statistikasi uchun so'rovlar soni talabalar soniga bog'liq emas (N+1 yo'q).
15. O'qituvchi o'z guruhidan boshqa guruh/talaba statistikasini ko'ra olmaydi (403/404), STUDENT `/stats/groups/*` 403.

Cheklovlar: mavjud rol/ownership qoidalarini buzma; eski ma'lumotlar uchun migratsiya (default modul, `kind=TASK`, `isPublished=true`); xato javoblarida ichki ma'lumot sizmasin; barcha yangi matnlar o'zbekcha; har faza oxirida qisqa hisobot ber (nima o'zgardi, qaysi testlar o'tdi, nima qoldi).

Boshlashdan oldin 0-bo'limni bajar va F1 uchun reja (o'zgaradigan fayllar ro'yxati) tuzib ber, keyin davom et.
