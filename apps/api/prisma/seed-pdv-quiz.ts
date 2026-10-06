/**
 * "Pedagogik dasturiy vositalar" fani bo'yicha test va so'rovnoma
 * diagnostikasini bazaga quyadigan seed. Manba: PDV_test_sorovnoma_diagnostika.docx
 *
 * 3 ta blok:
 *   I.   30 ta kognitiv SINGLE_CHOICE (A/B/C/D) — baholanadi
 *   II.  20 ta motivatsion LIKERT_5 — baholanmaydi (so'rovnoma)
 *   III. 10 ta refleksiv LIKERT_5 — baholanmaydi (so'rovnoma)
 *
 * Idempotent: `pdv-test-sorovnoma-diagnostika` sarlavhali test bor-yo'qligini
 * tekshiradi, bor bo'lsa savollarni almashtiradi.
 *
 * Run (konteyner ichida):
 *   docker exec eco-api sh -c "cd /workspace/apps/api && pnpm exec tsx prisma/seed-pdv-quiz.ts"
 */
import { PrismaClient, QuizQuestionType } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';

const prisma = new PrismaClient();

/**
 * Phase 8 (keyingi iteratsiya): test "Ekologik monitoring" bo'limining
 * standalone testlar oqimida yashaydi — darsga biriktirilmaydi.
 */
const COURSE_SLUG: string | null = null;
const TARGET_LESSON_ORDER: number | null = null;

const QUIZ_TITLE = '"Pedagogik dasturiy vositalar" fani bo‘yicha test va so‘rovnoma diagnostikasi';
const QUIZ_DESCRIPTION =
  'Bo‘lajak o‘qituvchilarning tadqiqotchilik kompetensiyasini (kognitiv + motivatsion-qiymatli + refleksiv-baholash) aniqlash uchun diagnostika. Birinchi 30 ta savol baholanadi; qolgan 30 tasi so‘rovnoma (1–5 shkalasida).';

// ---------------------------------------------------------------
// I. KOGNITIV — 30 ta SINGLE_CHOICE (javob kaliti faylda keltirilgan)
// ---------------------------------------------------------------

interface Mcq {
  textUz: string;
  options: Array<{ key: 'A' | 'B' | 'C' | 'D'; textUz: string }>;
  correctKey: 'A' | 'B' | 'C' | 'D';
}

const KOGNITIV: Mcq[] = [
  {
    textUz: 'Pedagogik dasturiy vositaning asosiy vazifasi qaysi?',
    options: [
      { key: 'A', textUz: 'Faqat matn saqlash' },
      { key: 'B', textUz: 'Ta’lim maqsadiga xizmat qiluvchi elektron o‘quv faoliyatini tashkil etish' },
      { key: 'C', textUz: 'Faqat video ko‘rsatish' },
      { key: 'D', textUz: 'Faqat baho qo‘yish' },
    ],
    correctKey: 'B',
  },
  {
    textUz: 'Elektron darslikning oddiy elektron matndan asosiy farqi nimada?',
    options: [
      { key: 'A', textUz: 'Faqat rangli bo‘lishida' },
      { key: 'B', textUz: 'Hajmi katta bo‘lishida' },
      { key: 'C', textUz: 'Mazmun, navigatsiya, interaktivlik, nazorat va teskari aloqaning integratsiyasida' },
      { key: 'D', textUz: 'Faqat internetda ishlashida' },
    ],
    correctKey: 'C',
  },
  {
    textUz: 'Pedagogik dasturiy vositani loyihalashning birinchi bosqichi qaysi?',
    options: [
      { key: 'A', textUz: 'Dasturlash' },
      { key: 'B', textUz: 'Pedagogik muammo va foydalanuvchi ehtiyojini aniqlash' },
      { key: 'C', textUz: 'Rang tanlash' },
      { key: 'D', textUz: 'Faylni eksport qilish' },
    ],
    correctKey: 'B',
  },
  {
    textUz: 'Didaktik talab nimani ifodalaydi?',
    options: [
      { key: 'A', textUz: 'O‘quv maqsadi, mazmuni va faoliyatining pedagogik muvofiqligini' },
      { key: 'B', textUz: 'Kompyuter narxini' },
      { key: 'C', textUz: 'Internet tezligini' },
      { key: 'D', textUz: 'Faqat shrift o‘lchamini' },
    ],
    correctKey: 'A',
  },
  {
    textUz: 'Ergonomik talabning asosiy mazmuni qaysi?',
    options: [
      { key: 'A', textUz: 'Foydalanuvchi uchun qulay va tushunarli interfeys' },
      { key: 'B', textUz: 'Ko‘proq animatsiya' },
      { key: 'C', textUz: 'Ko‘proq matn' },
      { key: 'D', textUz: 'Faqat audio' },
    ],
    correctKey: 'A',
  },
  {
    textUz: 'Elektron diagnostikaning vazifasi nima?',
    options: [
      { key: 'A', textUz: 'Faqat yakuniy baho chiqarish' },
      { key: 'B', textUz: 'O‘zlashtirish holati va qiyinchiliklarni aniqlash' },
      { key: 'C', textUz: 'Faqat davomatni aniqlash' },
      { key: 'D', textUz: 'Faqat sertifikat berish' },
    ],
    correctKey: 'B',
  },
  {
    textUz: 'Teskari aloqa nima uchun zarur?',
    options: [
      { key: 'A', textUz: 'Talabaga xato va keyingi harakat haqida ma’lumot berish uchun' },
      { key: 'B', textUz: 'Faqat o‘qituvchi uchun' },
      { key: 'C', textUz: 'Dastur hajmini oshirish uchun' },
      { key: 'D', textUz: 'Dizaynni bezash uchun' },
    ],
    correctKey: 'A',
  },
  {
    textUz: 'Interaktiv topshiriqning muhim xususiyati qaysi?',
    options: [
      { key: 'A', textUz: 'Talabani faol harakat va qaror qabul qilishga jalb etishi' },
      { key: 'B', textUz: 'Faqat o‘qilishi' },
      { key: 'C', textUz: 'Faqat chop etilishi' },
      { key: 'D', textUz: 'Faqat rasm bo‘lishi' },
    ],
    correctKey: 'A',
  },
  {
    textUz: 'Virtual laboratoriyaning didaktik afzalligi qaysi?',
    options: [
      { key: 'A', textUz: 'Tajriba jarayonini xavfsiz va takroriy modellashtirish imkoniyati' },
      { key: 'B', textUz: 'Faqat matn yozish' },
      { key: 'C', textUz: 'Faqat test olish' },
      { key: 'D', textUz: 'Faqat fayl saqlash' },
    ],
    correctKey: 'A',
  },
  {
    textUz: 'AR texnologiyasi nimani anglatadi?',
    options: [
      { key: 'A', textUz: 'Real muhitga raqamli obyektlarni qo‘shib aks ettirish' },
      { key: 'B', textUz: 'Faqat audio yozish' },
      { key: 'C', textUz: 'Faqat statistik hisoblash' },
      { key: 'D', textUz: 'Matn muharriri' },
    ],
    correctKey: 'A',
  },
  {
    textUz: 'VR texnologiyasining xususiyati qaysi?',
    options: [
      { key: 'A', textUz: 'Immersiv virtual muhit yaratish' },
      { key: 'B', textUz: 'Faqat jadval yaratish' },
      { key: 'C', textUz: 'Faqat elektron pochta' },
      { key: 'D', textUz: 'Faqat rasm kesish' },
    ],
    correctKey: 'A',
  },
  {
    textUz: 'Camtasia va Bandicam asosan nima uchun qo‘llanadi?',
    options: [
      { key: 'A', textUz: 'Ekran va o‘quv video yozish uchun' },
      { key: 'B', textUz: 'Ma’lumotlar bazasi yaratish uchun' },
      { key: 'C', textUz: 'Faqat test tuzish uchun' },
      { key: 'D', textUz: 'LMS boshqarish uchun' },
    ],
    correctKey: 'A',
  },
  {
    textUz: 'Sifatli o‘quv videosi qanday bo‘lishi kerak?',
    options: [
      { key: 'A', textUz: 'Maqsadli, qisqa va mantiqiy' },
      { key: 'B', textUz: 'Iloji boricha uzun' },
      { key: 'C', textUz: 'Faqat effektlardan iborat' },
      { key: 'D', textUz: 'Ovozsiz va izohsiz' },
    ],
    correctKey: 'A',
  },
  {
    textUz: 'Elektron test savoli nimaga mos bo‘lishi kerak?',
    options: [
      { key: 'A', textUz: 'O‘quv natijasi va mazmunga' },
      { key: 'B', textUz: 'Faqat dizaynga' },
      { key: 'C', textUz: 'Faqat savollar soniga' },
      { key: 'D', textUz: 'Kompyuter modeliga' },
    ],
    correctKey: 'A',
  },
  {
    textUz: 'iSpring vositasining ta’limdagi vazifasi qaysi?',
    options: [
      { key: 'A', textUz: 'Interaktiv elektron o‘quv resurslarini yaratish' },
      { key: 'B', textUz: 'Operatsion tizim o‘rnatish' },
      { key: 'C', textUz: 'Antivirus yaratish' },
      { key: 'D', textUz: 'Tarmoq kabelini sozlash' },
    ],
    correctKey: 'A',
  },
  {
    textUz: 'Elektron glossariy nima uchun xizmat qiladi?',
    options: [
      { key: 'A', textUz: 'Tayanch tushunchalarni tizimli izohlash uchun' },
      { key: 'B', textUz: 'Faqat rasm saqlash uchun' },
      { key: 'C', textUz: 'Faqat baho qo‘yish uchun' },
      { key: 'D', textUz: 'Video montaj uchun' },
    ],
    correctKey: 'A',
  },
  {
    textUz: 'Timeline qaysi mazmun uchun ayniqsa qulay?',
    options: [
      { key: 'A', textUz: 'Ketma-ket rivojlanish va voqealarni ko‘rsatish' },
      { key: 'B', textUz: 'Faqat test' },
      { key: 'C', textUz: 'Faqat formulalar' },
      { key: 'D', textUz: 'Parol saqlash' },
    ],
    correctKey: 'A',
  },
  {
    textUz: 'CMSning asosiy vazifasi nima?',
    options: [
      { key: 'A', textUz: 'Elektron kontentni yaratish va boshqarish' },
      { key: 'B', textUz: 'Faqat video yozish' },
      { key: 'C', textUz: 'Statistik test o‘tkazish' },
      { key: 'D', textUz: 'Kompyuterni ta’mirlash' },
    ],
    correctKey: 'A',
  },
  {
    textUz: 'LMSning asosiy vazifasi qaysi?',
    options: [
      { key: 'A', textUz: 'Ta’lim jarayoni, kurs, topshiriq va natijalarni boshqarish' },
      { key: 'B', textUz: 'Faqat sayt rangini o‘zgartirish' },
      { key: 'C', textUz: 'Faqat fayl siqish' },
      { key: 'D', textUz: 'Faqat audio yozish' },
    ],
    correctKey: 'A',
  },
  {
    textUz: 'Moodle qaysi turdagi tizimga kiradi?',
    options: [
      { key: 'A', textUz: 'LMS' },
      { key: 'B', textUz: 'Video muharrir' },
      { key: 'C', textUz: 'Grafik muharrir' },
      { key: 'D', textUz: 'Operatsion tizim' },
    ],
    correctKey: 'A',
  },
  {
    textUz: 'MOOC tushunchasi nimani anglatadi?',
    options: [
      { key: 'A', textUz: 'Ommaviy ochiq onlayn kurs' },
      { key: 'B', textUz: 'Mahalliy oflayn kurs' },
      { key: 'C', textUz: 'Grafik muharrir' },
      { key: 'D', textUz: 'Elektron jadval' },
    ],
    correctKey: 'A',
  },
  {
    textUz: 'Pedagogik ekspert baholashda qaysi mezonlar qo‘llanishi mumkin?',
    options: [
      { key: 'A', textUz: 'Didaktik, metodik, psixologik, estetik, ergonomik, funksional' },
      { key: 'B', textUz: 'Faqat narx' },
      { key: 'C', textUz: 'Faqat fayl hajmi' },
      { key: 'D', textUz: 'Faqat rang' },
    ],
    correctKey: 'A',
  },
  {
    textUz: 'Tadqiqot savoli qanday bo‘lishi kerak?',
    options: [
      { key: 'A', textUz: 'Muammo bilan bog‘liq va tekshiriladigan' },
      { key: 'B', textUz: 'Juda umumiy va o‘lchanmaydigan' },
      { key: 'C', textUz: 'Javobi oldindan aniq' },
      { key: 'D', textUz: 'Mavzuga aloqasiz' },
    ],
    correctKey: 'A',
  },
  {
    textUz: 'Gipoteza nima?',
    options: [
      { key: 'A', textUz: 'Tadqiqotda tekshiriladigan ilmiy faraz' },
      { key: 'B', textUz: 'Yakuniy isbotlangan qonun' },
      { key: 'C', textUz: 'Adabiyotlar ro‘yxati' },
      { key: 'D', textUz: 'Faqat savol' },
    ],
    correctKey: 'A',
  },
  {
    textUz: 'Tajriba natijalarini tahlil qilishning vazifasi nima?',
    options: [
      { key: 'A', textUz: 'Dalillar asosida ilmiy xulosa chiqarish' },
      { key: 'B', textUz: 'Faqat jadvalni bezash' },
      { key: 'C', textUz: 'Natijani yashirish' },
      { key: 'D', textUz: 'Faqat fayl nomlash' },
    ],
    correctKey: 'A',
  },
  {
    textUz: 'O‘rtacha qiymat nimani ko‘rsatadi?',
    options: [
      { key: 'A', textUz: 'Natijalar to‘plamining markaziy umumlashgan ko‘rsatkichini' },
      { key: 'B', textUz: 'Eng katta qiymatni' },
      { key: 'C', textUz: 'Faqat xatolar sonini' },
      { key: 'D', textUz: 'Savollar sonini' },
    ],
    correctKey: 'A',
  },
  {
    textUz: 'Kirish va yakuniy diagnostikani taqqoslash nima beradi?',
    options: [
      { key: 'A', textUz: 'Rivojlanish dinamikasini ko‘rish imkonini' },
      { key: 'B', textUz: 'Faqat davomatni' },
      { key: 'C', textUz: 'Faqat fayl hajmini' },
      { key: 'D', textUz: 'Dizayn sifatini' },
    ],
    correctKey: 'A',
  },
  {
    textUz: 'Refleksiya nimani anglatadi?',
    options: [
      { key: 'A', textUz: 'O‘z faoliyati va natijasini tahlil qilib baholashni' },
      { key: 'B', textUz: 'Faqat test ishlashni' },
      { key: 'C', textUz: 'Faqat ma’ruza tinglashni' },
      { key: 'D', textUz: 'Fayl yuklashni' },
    ],
    correctKey: 'A',
  },
  {
    textUz: 'Korreksiya jarayonining vazifasi qaysi?',
    options: [
      { key: 'A', textUz: 'Aniqlangan kamchiliklar asosida faoliyat yoki mahsulotni takomillashtirish' },
      { key: 'B', textUz: 'Natijani o‘zgartirmaslik' },
      { key: 'C', textUz: 'Faqat nusxa olish' },
      { key: 'D', textUz: 'Faqat bahoni oshirish' },
    ],
    correctKey: 'A',
  },
  {
    textUz: 'Eco-Balance platformasidan "Pedagogik dasturiy vositalar" fanida qanday foydalanish maqsadga muvofiq?',
    options: [
      { key: 'A', textUz: 'Real elektron o‘quv-tadqiqot muhiti sifatida' },
      { key: 'B', textUz: 'Faqat ekologik rasm albomi sifatida' },
      { key: 'C', textUz: 'Faqat yangiliklar sayti sifatida' },
      { key: 'D', textUz: 'Faqat fayl ombori sifatida' },
    ],
    correctKey: 'A',
  },
];

// ---------------------------------------------------------------
// II. MOTIVATSION-QIYMATLI — 20 ta LIKERT_5 (1-5 shkala, baholanmaydi)
// ---------------------------------------------------------------

const MOTIVATSION: string[] = [
  'Pedagogik muammolarni ilmiy yo‘l bilan o‘rganishga qiziqaman.',
  'Yangi elektron ta’lim vositalarini o‘rganish men uchun kasbiy ahamiyatga ega.',
  'Tadqiqot olib borish bo‘lajak o‘qituvchi uchun zarur deb hisoblayman.',
  'Pedagogik muammoning sababini mustaqil izlashga intilaman.',
  'Elektron o‘quv mahsuloti yaratishda uning pedagogik samaradorligini tekshirishga qiziqaman.',
  'Ilmiy manbalarni izlash va o‘rganish menga qiziq.',
  'Muammoli topshiriqlar meni yangi yechim izlashga undaydi.',
  'Tadqiqot natijalarini dalillar bilan asoslashni muhim deb bilaman.',
  'Elektron platformada tadqiqot topshiriqlarini bajarishga tayyorman.',
  'Pedagogik yangiliklarni tajribada sinab ko‘rishga qiziqaman.',
  'O‘z fikrimni ilmiy dalillar bilan himoya qilishga intilaman.',
  'Tadqiqot davomida yuzaga kelgan qiyinchiliklar meni izlanishni davom ettirishga undaydi.',
  'Elektron ta’lim vositalarining sifatini baholashni kasbiy ko‘nikma deb bilaman.',
  'Talabalarning o‘quv natijalarini tahlil qilishga qiziqaman.',
  'Pedagogik qaror qabul qilishda ma’lumot va dalillarga tayanishni muhim deb hisoblayman.',
  'Yaratgan elektron mahsulotimni ekspert fikri asosida takomillashtirishga tayyorman.',
  'Jamoaviy tadqiqot va fikr almashish men uchun foydali.',
  'Tadqiqot natijalarini taqdim etish va muhokama qilishga qiziqaman.',
  'Eco-Balance kabi real elektron muhitda tadqiqot olib borish mening kasbiy rivojlanishimga yordam beradi.',
  'Kelajakdagi pedagogik faoliyatimda tadqiqotchilik yondashuvidan foydalanishni rejalashtiraman.',
];

// ---------------------------------------------------------------
// III. REFLEKSIV-BAHOLASH — 10 ta LIKERT_5 (1-5 shkala, baholanmaydi)
// ---------------------------------------------------------------

const REFLEKSIV: string[] = [
  'Tadqiqot topshirig‘ini bajargach, natijamni o‘zim tahlil qilaman.',
  'Yo‘l qo‘ygan xatolarimning sababini aniqlashga harakat qilaman.',
  'Olingan teskari aloqani keyingi faoliyatimda hisobga olaman.',
  'Natijam kutilganidan past bo‘lsa, ishlash usulimni o‘zgartiraman.',
  'Tadqiqot savolim va gipotezamning qanchalik to‘g‘ri tuzilganini qayta ko‘rib chiqaman.',
  'Yig‘ilgan ma’lumotlar xulosamni yetarlicha asoslayaptimi, deb tekshiraman.',
  'Elektron mahsulotimni foydalanuvchi va ekspert baholari asosida takomillashtiraman.',
  'O‘z kuchli va rivojlantirilishi kerak bo‘lgan tomonlarimni aniqlay olaman.',
  'Tadqiqot yakunida keyingi ishlarim uchun aniq korreksiya rejasini tuzaman.',
  'Bir xil vazifani qayta bajarsam, nimalarni boshqacha qilishim kerakligini tushuntira olaman.',
];

async function main() {
  // Resolve optional lesson link (null → standalone / monitoring quiz).
  let lessonId: string | null = null;
  if (COURSE_SLUG && TARGET_LESSON_ORDER !== null) {
    const course = await prisma.course.findUnique({ where: { slug: COURSE_SLUG } });
    if (!course) {
      throw new Error(`Course "${COURSE_SLUG}" topilmadi.`);
    }
    const lesson = await prisma.lesson.findFirst({
      where: { courseId: course.id, orderIndex: TARGET_LESSON_ORDER },
    });
    if (!lesson) {
      throw new Error(`Dars (order=${TARGET_LESSON_ORDER}) topilmadi.`);
    }
    lessonId = lesson.id;
  }

  // Idempotent: shu nomli quiz bo'lsa, savollarini qayta yozamiz.
  const existing = await prisma.quiz.findFirst({
    where: { titleUz: QUIZ_TITLE },
  });

  const quizId = existing?.id ?? uuidv7();
  if (existing) {
    await prisma.quizQuestion.deleteMany({ where: { quizId } });
    await prisma.quiz.update({
      where: { id: quizId },
      data: {
        lessonId,
        descriptionUz: QUIZ_DESCRIPTION,
        passPercent: 60,
        isPublished: true,
      },
    });
    console.log(`[pdv-quiz] existing quiz ${quizId} — savollar qayta yoziladi (lessonId=${lessonId ?? 'null — standalone'})`);
  } else {
    await prisma.quiz.create({
      data: {
        id: quizId,
        lessonId,
        titleUz: QUIZ_TITLE,
        descriptionUz: QUIZ_DESCRIPTION,
        passPercent: 60,
        isPublished: true,
      },
    });
    console.log(`[pdv-quiz] new quiz ${quizId} — ${QUIZ_TITLE} (lessonId=${lessonId ?? 'null — standalone'})`);
  }

  const questions: Array<{
    id: string;
    quizId: string;
    orderIndex: number;
    type: QuizQuestionType;
    textUz: string;
    options: unknown;
  }> = [];

  let idx = 0;
  for (const q of KOGNITIV) {
    questions.push({
      id: uuidv7(),
      quizId,
      orderIndex: idx++,
      type: QuizQuestionType.SINGLE_CHOICE,
      textUz: q.textUz,
      options: q.options.map((o) => ({
        key: o.key,
        textUz: o.textUz,
        isCorrect: o.key === q.correctKey,
      })),
    });
  }
  for (const text of MOTIVATSION) {
    questions.push({
      id: uuidv7(),
      quizId,
      orderIndex: idx++,
      type: QuizQuestionType.LIKERT_5,
      textUz: text,
      options: [],
    });
  }
  for (const text of REFLEKSIV) {
    questions.push({
      id: uuidv7(),
      quizId,
      orderIndex: idx++,
      type: QuizQuestionType.LIKERT_5,
      textUz: text,
      options: [],
    });
  }

  // createMany does not accept JSON values for Json fields reliably across
  // engines; insert in a batch via Promise.all for small N=60.
  await Promise.all(
    questions.map((q) =>
      prisma.quizQuestion.create({
        data: {
          id: q.id,
          quizId: q.quizId,
          orderIndex: q.orderIndex,
          type: q.type,
          textUz: q.textUz,
          options: q.options as never,
        },
      }),
    ),
  );

  console.log(
    `[pdv-quiz] ${KOGNITIV.length} kognitiv + ${MOTIVATSION.length} motivatsion + ${REFLEKSIV.length} refleksiv = ${questions.length} ta savol qo'shildi.`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
