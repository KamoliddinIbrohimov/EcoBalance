import { EducationCards } from '@/features/dashboard/components/education-cards';
import { HeroBanner } from '@/features/dashboard/components/hero-banner';
import { KpiGrid } from '@/features/dashboard/components/kpi-grid';
import { NewsCard } from '@/features/dashboard/components/news-card';
import { ProjectMapCard } from '@/features/dashboard/components/project-map-card';
import { QuickFactsCard } from '@/features/dashboard/components/quick-facts-card';
import { QuickReportsRow } from '@/features/dashboard/components/quick-reports-row';
import { TestModeBanner } from '@/features/dashboard/components/test-mode-banner';
import { TrendsChartCard } from '@/features/dashboard/components/trends-chart-card';

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-6">
      <TestModeBanner />

      <HeroBanner />

      <KpiGrid />

      {/*
       * Middle row — map + chart + Tezkor ma'lumotlar side-by-side.
       */}
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr),minmax(0,1fr),minmax(0,320px)]">
        <ProjectMapCard />
        <TrendsChartCard />
        <QuickFactsCard />
      </section>

      {/*
       * Bottom section — Ta'lim + Tezkor hisobotlar stacked on the left,
       * Yangiliklar as a tall right column running alongside them.
       */}
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
