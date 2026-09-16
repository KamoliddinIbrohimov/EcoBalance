'use client';

import {
  ECO_REPORT_CATEGORY_LABELS_UZ,
  ECO_REPORT_STATUS,
  ECO_REPORT_STATUS_LABELS_UZ,
  PERMISSION,
  type EcoReportCategory,
  type EcoReportStatus,
} from '@eco/shared';
import { FileText, Printer } from 'lucide-react';
import { useState } from 'react';

import { useAnalyticsOverview } from '@/features/analytics/hooks/use-analytics';
import { useEcoReportsList } from '@/features/eco-reports/hooks/use-eco-reports';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { UnderDevelopment } from '@/shared/components/layout/under-development';
import { useAuthStore } from '@/shared/stores/auth-store';

type PeriodDays = 7 | 30 | 90;

const PERIOD_LABELS: Record<PeriodDays, string> = {
  7: 'So‘nggi 7 kun',
  30: 'So‘nggi 30 kun',
  90: 'So‘nggi 90 kun',
};

export default function ReportsPage() {
  const canRead = useAuthStore((s) => s.hasPermission(PERMISSION.ECO_REPORTS_READ));
  const [period, setPeriod] = useState<PeriodDays>(30);

  const { data: overview } = useAnalyticsOverview();
  const { data: reports } = useEcoReportsList({ page: 1, perPage: 200 });

  if (!canRead) {
    return <UnderDevelopment description="Ushbu bo'limni ko'rish uchun ruxsatingiz yo'q." />;
  }

  // Davr bo'yicha filtr (klient tomonda — MVP)
  const now = Date.now();
  const cutoff = now - period * 24 * 60 * 60 * 1000;
  const withinPeriod = (reports?.data ?? []).filter(
    (r) => new Date(r.createdAt).getTime() >= cutoff,
  );

  // Toifa bo'yicha jamlash
  const byCategoryPeriod = new Map<string, number>();
  const byStatusPeriod = new Map<string, number>();
  for (const r of withinPeriod) {
    byCategoryPeriod.set(r.category, (byCategoryPeriod.get(r.category) ?? 0) + 1);
    byStatusPeriod.set(r.status, (byStatusPeriod.get(r.status) ?? 0) + 1);
  }

  const totalPeriod = withinPeriod.length;
  const resolved = byStatusPeriod.get(ECO_REPORT_STATUS.RESOLVED) ?? 0;
  const resolvedPct = totalPeriod > 0 ? Math.round((resolved / totalPeriod) * 100) : 0;

  const topCategory = [...byCategoryPeriod.entries()].sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="space-y-6">
      {/* Bu blok chop etishda yashiriladi */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Hisobotlar</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Ekologik monitoring hisobotini davr bo&apos;yicha ko&apos;rish va chop etish.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={String(period)} onValueChange={(v) => setPeriod(Number(v) as PeriodDays)}>
            <SelectTrigger className="min-w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {([7, 30, 90] as PeriodDays[]).map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {PERIOD_LABELS[d]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            PDF ga chop etish
          </Button>
        </div>
      </div>

      {/* Print-mode sarlavhasi — faqat chop etishda ko'rinadi */}
      <div className="hidden print:block">
        <h1 className="text-2xl font-bold">Ekologik monitoring hisoboti</h1>
        <p className="text-sm text-muted-foreground">
          Davr: {PERIOD_LABELS[period]} · Sana: {new Date().toLocaleDateString('uz-UZ')}
        </p>
      </div>

      {/* Xulosa kartalari */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="text-xs text-muted-foreground">Jami murojaatlar</div>
          <div className="mt-1 text-2xl font-bold text-foreground">{totalPeriod}</div>
          <div className="text-xs text-muted-foreground">{PERIOD_LABELS[period]}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs text-muted-foreground">Hal qilingan</div>
          <div className="mt-1 text-2xl font-bold text-primary">{resolved}</div>
          <div className="text-xs text-muted-foreground">{resolvedPct}% umumdan</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs text-muted-foreground">Eng ko&apos;p toifa</div>
          <div className="mt-1 text-lg font-bold text-foreground">
            {topCategory
              ? ECO_REPORT_CATEGORY_LABELS_UZ[topCategory[0] as EcoReportCategory]
              : '—'}
          </div>
          <div className="text-xs text-muted-foreground">
            {topCategory ? `${topCategory[1]} ta murojaat` : 'Ma’lumot yo’q'}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-xs text-muted-foreground">Umumiy platforma</div>
          <div className="mt-1 text-2xl font-bold text-foreground">
            {overview?.totals.ecoReports ?? 0}
          </div>
          <div className="text-xs text-muted-foreground">barcha vaqt bo&apos;yicha</div>
        </Card>
      </div>

      {/* Toifa bo'yicha */}
      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Toifa bo&apos;yicha murojaatlar ({PERIOD_LABELS[period]})
        </h2>
        {totalPeriod === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Ushbu davrda murojaatlar yo&apos;q
          </p>
        ) : (
          <div className="space-y-3">
            {Object.entries(ECO_REPORT_CATEGORY_LABELS_UZ).map(([key, label]) => {
              const count = byCategoryPeriod.get(key) ?? 0;
              const pct = totalPeriod > 0 ? Math.round((count / totalPeriod) * 100) : 0;
              return (
                <div key={key}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium text-foreground">{label}</span>
                    <span className="text-muted-foreground">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Status bo'yicha funnel */}
      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Holat taqsimoti (funnel)
        </h2>
        {totalPeriod === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Ushbu davrda murojaatlar yo&apos;q
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(ECO_REPORT_STATUS_LABELS_UZ).map(([key, label]) => {
              const count = byStatusPeriod.get(key) ?? 0;
              const pct = totalPeriod > 0 ? Math.round((count / totalPeriod) * 100) : 0;
              return (
                <div
                  key={key}
                  className="rounded-lg border border-border/60 bg-secondary/40 p-4"
                >
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="mt-1 text-2xl font-bold text-foreground">{count}</div>
                  <div className="text-xs text-muted-foreground">{pct}%</div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Chop etish uchun jadval — barcha murojaatlar */}
      {totalPeriod > 0 ? (
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Murojaatlar ro&apos;yxati ({totalPeriod} ta)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-3">#</th>
                  <th className="pb-2 pr-3">Toifa</th>
                  <th className="pb-2 pr-3">Tavsif</th>
                  <th className="pb-2 pr-3">Joylashuv</th>
                  <th className="pb-2 pr-3">Holat</th>
                  <th className="pb-2">Sana</th>
                </tr>
              </thead>
              <tbody>
                {withinPeriod.map((r, i) => (
                  <tr key={r.id} className="border-b border-border/40">
                    <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                    <td className="py-2 pr-3">
                      {ECO_REPORT_CATEGORY_LABELS_UZ[r.category as EcoReportCategory]}
                    </td>
                    <td className="py-2 pr-3 max-w-[300px] truncate">{r.descriptionUz}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {r.locationLabel ?? '—'}
                    </td>
                    <td className="py-2 pr-3">
                      {ECO_REPORT_STATUS_LABELS_UZ[r.status as EcoReportStatus]}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString('uz-UZ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
