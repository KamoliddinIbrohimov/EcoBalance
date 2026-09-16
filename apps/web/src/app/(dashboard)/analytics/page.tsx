'use client';

import {
  ECO_REPORT_CATEGORY_LABELS_UZ,
  ECO_REPORT_STATUS_LABELS_UZ,
  LESSON_TYPE_LABELS_UZ,
  PERMISSION,
  ROLE_LABELS_UZ,
  type LessonType,
  type Role,
  type EcoReportCategory,
  type EcoReportStatus,
} from '@eco/shared';
import {
  BarChart3,
  BookOpen,
  Building2,
  FileText,
  Layers,
  Leaf,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useAnalyticsOverview } from '@/features/analytics/hooks/use-analytics';
import { useEducationLevels } from '@/features/learning/hooks/use-education-levels';
import { Card } from '@/shared/components/ui/card';
import { UnderDevelopment } from '@/shared/components/layout/under-development';
import { useAuthStore } from '@/shared/stores/auth-store';

const ORG_TYPE_LABELS: Record<string, string> = {
  CITY: 'Shahar',
  DISTRICT: 'Tuman',
  MAHALLA: 'Mahalla',
  SCHOOL: 'Maktab',
  KINDERGARTEN: 'Bog‘cha',
  UNIVERSITY: 'Universitet',
};

const CHART_COLORS = [
  'hsl(142, 71%, 45%)', // primary green
  'hsl(217, 91%, 60%)', // info blue
  'hsl(24, 95%, 53%)', // warning orange
  'hsl(262, 83%, 58%)', // purple
  'hsl(0, 84%, 60%)', // destructive red
  'hsl(180, 71%, 45%)', // teal
  'hsl(45, 100%, 60%)', // yellow
];

export default function AnalyticsPage() {
  const canRead = useAuthStore((s) => s.hasPermission(PERMISSION.AUDIT_READ));
  const { data, isLoading } = useAnalyticsOverview();
  const { data: levels } = useEducationLevels();

  if (!canRead) {
    return (
      <UnderDevelopment description="Ushbu bo'lim faqat administrator uchun mo'ljallangan." />
    );
  }

  if (isLoading || !data) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">Yuklanmoqda…</Card>
    );
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  const kpis: Array<{ label: string; value: string; icon: typeof Users; tone: string }> = [
    { label: 'Foydalanuvchilar', value: String(data.totals.users), icon: Users, tone: 'primary' },
    { label: 'Tashkilotlar', value: String(data.totals.organizations), icon: Building2, tone: 'info' },
    { label: "Ta'lim darajalari", value: String(data.totals.levels), icon: Layers, tone: 'primary' },
    { label: 'Kurslar', value: String(data.totals.courses), icon: BookOpen, tone: 'warning' },
    {
      label: 'Materiallar',
      value: `${data.totals.materials} · ${formatSize(data.totals.materialsSizeBytes)}`,
      icon: FileText,
      tone: 'info',
    },
    { label: 'EKO-PATRUL', value: String(data.totals.ecoReports), icon: Leaf, tone: 'primary' },
  ];

  const roleChart = data.usersByRole.map((r) => ({
    name: ROLE_LABELS_UZ[r.role as Role] ?? r.role,
    value: r.count,
  }));

  const levelNameBySlug = new Map((levels ?? []).map((l) => [l.slug, l.nameUz]));
  const levelChart = data.coursesByLevel.map((r) => ({
    name: levelNameBySlug.get(r.level) ?? r.level,
    count: r.count,
  }));

  // Ta'lim kontenti — darajalar bo'yicha, 3 ta ustundan iborat grouped bar
  const contentByLevel = (levels ?? []).map((lvl) => ({
    name: lvl.nameUz,
    kurslar: data.coursesByLevel.find((x) => x.level === lvl.slug)?.count ?? 0,
    darslar: data.lessonsByLevel.find((x) => x.level === lvl.slug)?.count ?? 0,
    fayllar: data.materialsByLevel.find((x) => x.level === lvl.slug)?.count ?? 0,
  }));

  // Dars turlari (AMALIY / LABORATORIYA / EKSKURSIYA)
  const lessonTypeChart = data.lessonsByType.map((r) => ({
    name: LESSON_TYPE_LABELS_UZ[r.type as LessonType] ?? r.type,
    value: r.count,
  }));

  const regChart = data.registrationsLast30Days.map((r) => ({
    date: r.date.slice(5),
    count: r.count,
  }));

  const ecoCategoryChart = data.ecoReportsByCategory.map((r) => ({
    name: ECO_REPORT_CATEGORY_LABELS_UZ[r.category as EcoReportCategory] ?? r.category,
    value: r.count,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
          <BarChart3 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Statistik tahlil</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Platforma bo‘yicha umumiy ko‘rsatkichlar va tendensiyalar.
          </p>
        </div>
      </div>

      {/* KPI kartalari — 6 ta ustun */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="p-5">
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-lg ${
                    k.tone === 'primary'
                      ? 'bg-primary-soft text-primary'
                      : k.tone === 'info'
                        ? 'bg-info-soft text-info'
                        : 'bg-warning-soft text-warning'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">{k.label}</div>
                  <div className="mt-1 text-2xl font-bold text-foreground">{k.value}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Rol taqsimoti + Kurslar darajasi */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Foydalanuvchilar rol bo‘yicha
          </h2>
          {roleChart.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Ma&apos;lumot yo&apos;q
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={roleChart} dataKey="value" nameKey="name" outerRadius={90} label>
                  {roleChart.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Kurslar — ta&apos;lim darajasi bo&apos;yicha
          </h2>
          {levelChart.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Kurslar hali qo&apos;shilmagan
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={levelChart}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Ta'lim kontenti — daraja bo'yicha (kurslar/darslar/fayllar) */}
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Ta&apos;lim kontenti — daraja bo&apos;yicha
        </h2>
        {contentByLevel.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Ta&apos;lim darajalari qo&apos;shilmagan
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={contentByLevel}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="kurslar" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="darslar" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="fayllar" fill="hsl(24, 95%, 53%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Dars turlari */}
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Dars turlari — taqsimot
        </h2>
        {lessonTypeChart.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Darslar qo&apos;shilmagan
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={lessonTypeChart} dataKey="value" nameKey="name" outerRadius={90} label>
                {lessonTypeChart.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Ro'yxatdan o'tish dinamikasi */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Ro&apos;yxatdan o&apos;tish (so&apos;nggi 30 kun)
          </h2>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={regChart}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="count"
              stroke="hsl(142, 71%, 45%)"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* EKO-PATRUL statistikasi — endi haqiqiy ma'lumot */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            EKO-PATRUL murojaatlari — toifa bo&apos;yicha
          </h2>
          {ecoCategoryChart.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Hozircha murojaatlar yo&apos;q
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ecoCategoryChart}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={70} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            EKO-PATRUL — holat taqsimoti (funnel)
          </h2>
          {data.ecoReportsByStatus.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Hozircha murojaatlar yo&apos;q
            </p>
          ) : (
            <div className="space-y-3 py-2">
              {data.ecoReportsByStatus.map((s, i) => {
                const total = data.totals.ecoReports || 1;
                const pct = Math.round((s.count / total) * 100);
                return (
                  <div key={s.status}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-medium text-foreground">
                        {ECO_REPORT_STATUS_LABELS_UZ[s.status as EcoReportStatus] ?? s.status}
                      </span>
                      <span className="text-muted-foreground">
                        {s.count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Tashkilot turi bo'yicha */}
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Tashkilotlar — turi bo&apos;yicha
        </h2>
        {data.orgsByType.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Tashkilotlar hali qo&apos;shilmagan
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {data.orgsByType.map((o) => (
              <div key={o.type} className="rounded-lg border border-border/60 bg-secondary/40 p-3">
                <div className="text-xs text-muted-foreground">
                  {ORG_TYPE_LABELS[o.type] ?? o.type}
                </div>
                <div className="mt-0.5 text-lg font-bold text-foreground">{o.count}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
