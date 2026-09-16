'use client';

import {
  ECO_REPORT_CATEGORY_LABELS_UZ,
  ECO_REPORT_STATUS,
  ECO_REPORT_STATUS_LABELS_UZ,
  PERMISSION,
  type EcoReportStatus,
} from '@eco/shared';
import {
  AlertTriangle,
  Leaf,
  Plus,
  Recycle,
  TreePine,
  Wind,
  Zap,
  Droplets,
  MoreHorizontal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';

import { EcoReportFormDialog } from '@/features/eco-reports/components/eco-report-form-dialog';
import {
  useEcoReportsList,
  useEcoStats,
  useUpdateEcoReportStatus,
} from '@/features/eco-reports/hooks/use-eco-reports';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { PaginationBar } from '@/shared/components/ui/pagination-bar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { UnderDevelopment } from '@/shared/components/layout/under-development';
import { useAuthStore } from '@/shared/stores/auth-store';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  WASTE: Recycle,
  WATER: Droplets,
  GREEN_AREA: TreePine,
  AIR_NOISE: Wind,
  ENERGY: Zap,
  OTHER: MoreHorizontal,
};

const RISK_BADGE: Record<string, string> = {
  LOW: 'bg-primary-soft text-primary',
  MEDIUM: 'bg-warning-soft text-warning',
  HIGH: 'bg-destructive/10 text-destructive',
};

const STATUS_BADGE: Record<string, string> = {
  REPORTED: 'bg-info-soft text-info',
  IN_REVIEW: 'bg-warning-soft text-warning',
  IN_PROGRESS: 'bg-primary-soft text-primary',
  RESOLVED: 'bg-primary text-primary-foreground',
};

const ALL = '__all__';

export default function MonitoringPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canRead = hasPermission(PERMISSION.ECO_REPORTS_READ);
  const canCreate = hasPermission(PERMISSION.ECO_REPORTS_CREATE);
  const canManage = hasPermission(PERMISSION.ECO_REPORTS_MANAGE);

  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const { data: reports, isLoading } = useEcoReportsList({
    page,
    perPage: 20,
    category: (category || undefined) as never,
    status: (status || undefined) as never,
  });
  const { data: stats } = useEcoStats();
  const updateStatus = useUpdateEcoReportStatus();

  if (!canRead) {
    return <UnderDevelopment description="Ushbu bo'limni ko'rish uchun ruxsatingiz yo'q." />;
  }

  const categoryCounts = Object.fromEntries(
    stats?.byCategory.map((r) => [r.category, r.count]) ?? [],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <Leaf className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Ekologik monitoring — EKO-PATRUL
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Mahalladagi ekologik muammolarni aniqlash va kuzatib borish.
            </p>
          </div>
        </div>
        {canCreate ? (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Muammo haqida xabar berish
          </Button>
        ) : null}
      </div>

      {/* KPI kartalari — toifa bo'yicha soni */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Object.entries(ECO_REPORT_CATEGORY_LABELS_UZ).map(([key, label]) => {
          const Icon = CATEGORY_ICONS[key] ?? MoreHorizontal;
          const count = categoryCounts[key] ?? 0;
          return (
            <Card key={key} className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="text-lg font-bold text-foreground">{count}</div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Filterlar */}
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            value={category || ALL}
            onValueChange={(v) => {
              setPage(1);
              setCategory(v === ALL ? '' : v);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Toifa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Barcha toifalar</SelectItem>
              {Object.entries(ECO_REPORT_CATEGORY_LABELS_UZ).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={status || ALL}
            onValueChange={(v) => {
              setPage(1);
              setStatus(v === ALL ? '' : v);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Holat" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Barcha holatlar</SelectItem>
              {Object.entries(ECO_REPORT_STATUS_LABELS_UZ).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Jadval */}
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Toifa</TableHead>
              <TableHead>Tavsif</TableHead>
              <TableHead>Joylashuv</TableHead>
              <TableHead>Xavf</TableHead>
              <TableHead>Holat</TableHead>
              <TableHead>Sana</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableEmpty colSpan={6}>Yuklanmoqda…</TableEmpty>
            ) : !reports || reports.data.length === 0 ? (
              <TableEmpty colSpan={6}>Murojaatlar yo&apos;q</TableEmpty>
            ) : (
              reports.data.map((r) => {
                const CategoryIcon = CATEGORY_ICONS[r.category] ?? MoreHorizontal;
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CategoryIcon className="h-4 w-4 text-primary" />
                        <span className="text-xs">
                          {ECO_REPORT_CATEGORY_LABELS_UZ[r.category]}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate text-sm">
                      {r.descriptionUz}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.locationLabel ?? '—'}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${RISK_BADGE[r.riskLevel]}`}
                      >
                        {r.riskLevel === 'LOW'
                          ? '🟢 Past'
                          : r.riskLevel === 'MEDIUM'
                            ? '🟡 O‘rta'
                            : '🔴 Yuqori'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {canManage ? (
                        <Select
                          value={r.status}
                          onValueChange={(v) =>
                            updateStatus.mutate({
                              id: r.id,
                              input: { status: v as EcoReportStatus },
                            })
                          }
                        >
                          <SelectTrigger className="h-8 min-w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(ECO_REPORT_STATUS_LABELS_UZ).map(([k, v]) => (
                              <SelectItem key={k} value={k}>
                                {v}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={STATUS_BADGE[r.status]}>
                          {ECO_REPORT_STATUS_LABELS_UZ[r.status]}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString('uz-UZ')}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        {reports?.meta ? (
          <PaginationBar meta={reports.meta} onPageChange={setPage} itemLabel="ta murojaat" />
        ) : null}
      </Card>

      {/* Yordamchi eslatma — RESOLVED bo'lgan foiz */}
      {stats && stats.total > 0 ? (
        <Card className="flex items-start gap-3 border-primary/20 bg-primary-soft/40 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="text-sm text-foreground">
            Jami <b>{stats.total}</b> murojaat.{' '}
            {(() => {
              const resolved =
                stats.byStatus.find((s) => s.status === ECO_REPORT_STATUS.RESOLVED)?.count ?? 0;
              const pct = stats.total > 0 ? Math.round((resolved / stats.total) * 100) : 0;
              return (
                <>
                  <b>{resolved}</b> tasi hal qilingan ({pct}%).
                </>
              );
            })()}
          </div>
        </Card>
      ) : null}

      <EcoReportFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
