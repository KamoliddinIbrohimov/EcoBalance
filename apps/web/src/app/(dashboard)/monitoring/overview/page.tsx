'use client';

import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import Link from 'next/link';

import { EducationCards } from '@/features/dashboard/components/education-cards';
import { KpiGrid } from '@/features/dashboard/components/kpi-grid';
import { NewsCard } from '@/features/dashboard/components/news-card';
import { ProjectMapCard } from '@/features/dashboard/components/project-map-card';
import { QuickFactsCard } from '@/features/dashboard/components/quick-facts-card';
import { QuickReportsRow } from '@/features/dashboard/components/quick-reports-row';

// recharts ~100 KB (gzip) — sahifaning qolgan qismi uni kutmasin.
const TrendsChartCard = dynamic(
  () => import('@/features/dashboard/components/trends-chart-card').then((m) => m.TrendsChartCard),
  { ssr: false, loading: () => <div className="h-72 animate-pulse rounded-2xl border border-border/60 bg-card" /> },
);

/**
 * Eski bosh sahifa kartalari (KPI, xarita, grafik, Tezkor ma'lumotlar,
 * Ta'lim jarayoni, Tezkor hisobotlar, Yangiliklar) — `bosh-sahifa-prompt.md`
 * bo'yicha "/" dan shu yerga ko'chirildi. Kontent o'zgarmagan, faqat joyi.
 */
export default function MonitoringOverviewPage() {
  const t = useTranslations('home');

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToHome')}
      </Link>

      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {t('monitoringOverviewTitle')}
      </h1>

      <KpiGrid />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr),minmax(0,1fr),minmax(0,320px)]">
        <ProjectMapCard />
        <TrendsChartCard />
        <QuickFactsCard />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr),minmax(0,320px)] xl:gap-4">
        <div className="flex flex-col gap-6">
          <EducationCards />
          <QuickReportsRow />
        </div>
        <NewsCard />
      </section>
    </div>
  );
}
