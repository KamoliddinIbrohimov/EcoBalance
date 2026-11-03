'use client';

import { ArrowRight, ImageUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { useCoursesList } from '@/features/learning/hooks/use-learning';
import { useHomeMedia, useUploadHomeMedia } from '@/features/platform-settings/use-home-media';
import type { HomeMediaCardKey } from '@/features/platform-settings/home-media-api';
import { cn } from '@/shared/lib/cn';
import { useAuthStore } from '@/shared/stores/auth-store';
import { KPIS, QUICK_FACTS } from '../data/mock';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// bosh-sahifa-prompt.md: "pastdan yuqoriga gradient overlay: bg-gradient-to-t
// from-slate-900/45 to-transparent (pastki 55%)" — matnni o'qilishi uchun,
// ikkala kartada BIR XIL, rasmning o'ziga bog'liq emas.
const PHOTO_OVERLAY_GRADIENT = 'from-slate-900/45';

interface DirectionCardSpec {
  cardKey: HomeMediaCardKey;
  fallbackImage: string;
  /** Rasm umuman ochilmaganda butun kartani qopovchi, oxiri shaffof BO'LMAGAN gradient. */
  fullFallbackGradient: string;
  objectPosition: string;
  href: string;
  titleKey: 'ecoCard' | 'eduCard';
  chips: string[];
}

/**
 * Ikkita katta yo'nalish kartasi — "Ekologik monitoring" va "Ta'lim" uchun.
 * `bosh-sahifa-prompt.md` maketiga mos. SUPER_ADMIN uchun rasm almashtirish
 * tugmasi ko'rinadi (POST /settings/home-media — serverda rol tekshiriladi).
 */
export function HomeDirectionCards() {
  const t = useTranslations('home');
  const isSuperAdmin = useAuthStore((s) => s.hasRole('SUPER_ADMIN'));

  const { data: coursesData } = useCoursesList({ page: 1, perPage: 100, isPublished: true });
  const { data: homeMedia } = useHomeMedia();

  const coursesValue = coursesData ? String(coursesData.data.length) : '4';
  const lessonsValue = coursesData
    ? String(coursesData.data.reduce((sum, c) => sum + (c.lessonsCount ?? 0), 0))
    : '58';

  const ecoIndex = KPIS.find((k) => k.key === 'ecoIndex');
  const airQuality = KPIS.find((k) => k.key === 'airQuality');
  const monitoringPoints = QUICK_FACTS.find((f) => f.key === 'monitoring');

  const cards: DirectionCardSpec[] = [
    {
      cardKey: 'eco',
      fallbackImage: '/images/home/hm-eco-v2.jpg',
      fullFallbackGradient: 'from-primary/80 via-primary/50 to-primary/20',
      objectPosition: 'center 12%',
      // Karta sarlavhasi/tavsifi/chip'lari monitoring mavzusida — tugma ham
      // shunga mos (bosh-sahifa-prompt.md). "Topshiriqlar" allaqachon
      // "Boshqaruv modullari" to'rida bor, shuning uchun bu yerda qaytarilmaydi.
      href: '/monitoring/overview',
      titleKey: 'ecoCard',
      chips: [
        t('ecoCard.chipIndex', { value: ecoIndex?.value ?? 78 }),
        t('ecoCard.chipPm25', { value: airQuality?.value ?? 28 }),
        t('ecoCard.chipPoints', { value: monitoringPoints?.value?.replace(/\D/g, '') ?? 24 }),
      ],
    },
    {
      cardKey: 'edu',
      fallbackImage: '/images/home/hm-ped-v2.jpg',
      fullFallbackGradient: 'from-info/80 via-info/50 to-info/20',
      objectPosition: 'center 30%',
      href: '/learning',
      titleKey: 'eduCard',
      chips: [
        t('eduCard.chipCourses', { value: coursesValue }),
        t('eduCard.chipLessons', { value: lessonsValue }),
      ],
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-5 min-[900px]:grid-cols-2">
      {cards.map((card) => (
        <DirectionCard
          key={card.cardKey}
          card={card}
          uploadedImageUrl={card.cardKey === 'eco' ? homeMedia?.ecoImageUrl : homeMedia?.eduImageUrl}
          canEditImage={isSuperAdmin}
        />
      ))}
    </section>
  );
}

function DirectionCard({
  card,
  uploadedImageUrl,
  canEditImage,
}: {
  card: DirectionCardSpec;
  uploadedImageUrl: string | null | undefined;
  canEditImage: boolean;
}) {
  const t = useTranslations('home');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadHomeMedia();
  const [error, setError] = useState<string | null>(null);

  const imageSrc = uploadedImageUrl ?? card.fallbackImage;
  const [imgError, setImgError] = useState(false);
  // Yangi rasm (yuklash yoki boshqa manzil) kelganda oldingi xato holatini
  // tashlab yuboramiz — aks holda muvaffaqiyatli yuklashdan keyin ham
  // gradient ko'rinib qolaveradi.
  useEffect(() => {
    setImgError(false);
  }, [imageSrc]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    // Klient tekshiruvi — tezkor fikr-mulohaza. Server HAM mustaqil
    // tekshiradi (rasm-tuzatish-prompt.md D bandi — klientga ishonma).
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(t('imageUploadErrorType'));
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(t('imageUploadErrorSize'));
      return;
    }
    uploadMutation.mutate(
      { cardKey: card.cardKey, file },
      { onError: () => setError(t('imageUploadError')) },
    );
  }

  return (
    <article className="group flex flex-col gap-4 rounded-[1.25rem] border border-border/70 bg-card p-3 pb-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative flex h-60 items-end overflow-hidden rounded-[0.875rem] p-4">
        {imgError ? (
          // Rasm (yuklangan yoki mahalliy fallback) ochilmadi — buzilgan
          // rasm belgisi o'rniga to'liq gradient fon (rasm-tuzatish-prompt.md
          // C bandi: "buzilgan rasm belgisi hech qachon ko'rinmasin").
          <div
            className={cn('absolute inset-0 bg-gradient-to-br', card.fullFallbackGradient)}
            aria-hidden
          />
        ) : (
          <>
            <Image
              src={imageSrc}
              alt=""
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
              style={{ objectPosition: card.objectPosition }}
              // Yuklangan rasm ortogonal origin'dan (PUBLIC_ASSET_ORIGIN) kelsa
              // ham, Next.js image optimizer'i server (konteyner) ichidan shu
              // manzilga qayta murojaat qiladi — agar bu origin konteyner
              // ichidan yetib bo'lmasa, optimizatsiya shart emas.
              unoptimized={!!uploadedImageUrl}
              onError={() => setImgError(true)}
            />
            <div
              className={cn(
                'pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t to-transparent',
                PHOTO_OVERLAY_GRADIENT,
              )}
            />
          </>
        )}

        {canEditImage ? (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title={`${t('changeImage')} — ${t('imageUploadHint')}`}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-foreground shadow-sm transition hover:bg-white"
            >
              <ImageUp className="h-4 w-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              className="hidden"
              onChange={handleFileChange}
            />
          </>
        ) : null}

        <div className="relative z-[1] flex flex-wrap gap-2">
          {card.chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full bg-white/95 px-3 py-[5px] text-xs text-muted-foreground shadow-sm"
            >
              <ChipText text={chip} />
            </span>
          ))}
        </div>
      </div>

      {error ? <p className="px-2 text-xs text-destructive">{error}</p> : null}

      <div className="px-2">
        <h2 className="text-xl font-bold leading-7 tracking-tight text-foreground">
          {t(`${card.titleKey}.title`)}
        </h2>
        <p className="mt-1.5 text-sm leading-[1.375rem] text-muted-foreground">
          {t(`${card.titleKey}.description`)}
        </p>
      </div>

      <Link
        href={card.href}
        className="mx-2 mt-auto inline-flex h-10 w-fit self-start items-center gap-2 rounded-[calc(var(--radius)+4px)] bg-primary px-[18px] text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
      >
        {t(`${card.titleKey}.cta`)}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </article>
  );
}

/** "78 /100 ekologik indeks" ichidagi raqamni <b> bilan ajratib chiqaradi. */
function ChipText({ text }: { text: string }) {
  const match = text.match(/^(\S+)\s(.*)$/);
  if (!match) return <>{text}</>;
  const [, value, rest] = match;
  return (
    <>
      <b className="text-[0.9375rem] font-bold text-foreground">{value}</b> {rest}
    </>
  );
}
