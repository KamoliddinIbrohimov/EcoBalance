'use client';

import {
  ECO_REPORT_CATEGORY_LABELS_UZ,
  ECO_REPORT_STATUS_LABELS_UZ,
  PERMISSION,
  type EcoReportCategory,
  type EcoReportStatus,
} from '@eco/shared';
import {
  Activity,
  BookOpen,
  Building2,
  ClipboardList,
  FileText,
  Layers,
  Leaf,
  Users,
} from 'lucide-react';
import Link from 'next/link';

import { useAnalyticsOverview, useRecentAudit } from '@/features/analytics/hooks/use-analytics';
import { useEcoReportsList } from '@/features/eco-reports/hooks/use-eco-reports';
import { useEducationLevels } from '@/features/learning/hooks/use-education-levels';
import { Badge } from '@/shared/components/ui/badge';
import { Card } from '@/shared/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { UnderDevelopment } from '@/shared/components/layout/under-development';
import { useAuthStore } from '@/shared/stores/auth-store';

const ACTION_LABEL: Record<string, string> = {
  CREATE: 'Yaratish',
  UPDATE: 'Tahrirlash',
  DELETE: 'O‘chirish',
  LOGIN: 'Kirish',
  LOGOUT: 'Chiqish',
  LOGIN_FAILED: 'Kirishga urinish',
  PASSWORD_RESET_REQUEST: 'Parolni tiklash so‘rovi',
  PASSWORD_RESET_COMPLETE: 'Parol tiklandi',
  TOKEN_REFRESH: 'Token yangilandi',
  TOKEN_REVOKED: 'Token bekor qilindi',
};

const ACTION_COLOR: Record<string, string> = {
  CREATE: 'bg-primary-soft text-primary',
  UPDATE: 'bg-info-soft text-info',
  DELETE: 'bg-destructive/10 text-destructive',
  LOGIN: 'bg-primary-soft text-primary',
  LOGOUT: 'bg-muted text-muted-foreground',
  LOGIN_FAILED: 'bg-destructive/10 text-destructive',
};

const STATUS_TONE: Record<string, string> = {
  REPORTED: 'bg-info-soft text-info',
  IN_REVIEW: 'bg-warning-soft text-warning',
  IN_PROGRESS: 'bg-primary-soft text-primary',
  RESOLVED: 'bg-primary text-primary-foreground',
};

export default function DashboardPage() {
  const canRead = useAuthStore((s) => s.hasPermission(PERMISSION.AUDIT_READ));
  const { data: overview, isLoading: overviewLoading } = useAnalyticsOverview();
  const { data: audit, isLoading: auditLoading } = useRecentAudit(20);
  const { data: recentReports } = useEcoReportsList({ page: 1, perPage: 5 });
  const { data: levels } = useEducationLevels();

  function formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  if (!canRead) {
    return <UnderDevelopment description="Ushbu bo'lim faqat administrator uchun." />;
  }

  const kpis = overview
    ? [
        { label: 'Foydalanuvchilar', value: String(overview.totals.users), icon: Users, tone: 'primary' },
        { label: 'Tashkilotlar', value: String(overview.totals.organizations), icon: Building2, tone: 'info' },
        { label: "Ta'lim darajalari", value: String(overview.totals.levels), icon: Layers, tone: 'primary' },
        { label: 'Kurslar', value: String(overview.totals.courses), icon: BookOpen, tone: 'warning' },
        { label: 'Darslar', value: String(overview.totals.lessons), icon: ClipboardList, tone: 'primary' },
        {
          label: 'Materiallar',
          value: `${overview.totals.materials} · ${formatSize(overview.totals.materialsSizeBytes)}`,
          icon: FileText,
          tone: 'info',
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
          <Activity className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Boshqaruv paneli</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Administrator uchun operatsion umumiy ko&apos;rinish.
          </p>
        </div>
      </div>

      {/* KPI */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {overviewLoading || !overview ? (
          <>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="h-24 animate-pulse p-5" />
            ))}
          </>
        ) : (
          kpis.map((k) => {
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
          })
        )}
      </div>

      {/* Ta'lim kontenti — daraja bo'yicha jamlanma */}
      {overview && (overview.coursesByLevel.length > 0 || overview.lessonsByLevel.length > 0) ? (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Ta&apos;lim kontenti — daraja bo&apos;yicha
            </h2>
            <Link href="/learning" className="text-xs font-semibold text-primary hover:underline">
              Barchasi →
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(levels ?? []).map((lvl) => {
              const c = overview.coursesByLevel.find((x) => x.level === lvl.slug)?.count ?? 0;
              const l = overview.lessonsByLevel.find((x) => x.level === lvl.slug)?.count ?? 0;
              const m = overview.materialsByLevel.find((x) => x.level === lvl.slug)?.count ?? 0;
              return (
                <div key={lvl.id} className="rounded-lg border border-border/60 bg-secondary/30 p-4">
                  <div className="mb-2 text-sm font-semibold text-foreground">{lvl.nameUz}</div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-lg font-bold text-primary">{c}</div>
                      <div className="text-[10px] uppercase text-muted-foreground">kurs</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-info">{l}</div>
                      <div className="text-[10px] uppercase text-muted-foreground">dars</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-warning">{m}</div>
                      <div className="text-[10px] uppercase text-muted-foreground">fayl</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* So'nggi faoliyatlar */}
        <Card className="p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            So&apos;nggi faoliyatlar (audit)
          </h2>
          {auditLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Yuklanmoqda…</div>
          ) : !audit || audit.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Audit yozuvlari yo&apos;q
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Amal</TableHead>
                  <TableHead>Foydalanuvchi</TableHead>
                  <TableHead>Ob&apos;yekt</TableHead>
                  <TableHead>Sana</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audit.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${
                          ACTION_COLOR[row.action] ?? 'bg-secondary'
                        }`}
                      >
                        {ACTION_LABEL[row.action] ?? row.action}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.userName ?? '—'}
                      {row.userEmail ? (
                        <div className="text-xs text-muted-foreground">{row.userEmail}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.subjectType ?? '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(row.createdAt).toLocaleString('uz-UZ')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* So'nggi EKO-PATRUL murojaatlari */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Leaf className="mr-1 inline h-3.5 w-3.5" />
              EKO-PATRUL
            </h2>
            <Link
              href="/monitoring"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Barchasi →
            </Link>
          </div>
          {!recentReports || recentReports.data.length === 0 ? (
            <p className="px-2 py-10 text-center text-sm text-muted-foreground">
              Murojaatlar yo&apos;q
            </p>
          ) : (
            <ul className="space-y-2">
              {recentReports.data.map((r) => (
                <li
                  key={r.id}
                  className="rounded-lg border border-border/60 bg-secondary/30 p-3"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {ECO_REPORT_CATEGORY_LABELS_UZ[r.category as EcoReportCategory]}
                    </Badge>
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[r.status]}`}
                    >
                      {ECO_REPORT_STATUS_LABELS_UZ[r.status as EcoReportStatus]}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-xs text-foreground">{r.descriptionUz}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString('uz-UZ')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
