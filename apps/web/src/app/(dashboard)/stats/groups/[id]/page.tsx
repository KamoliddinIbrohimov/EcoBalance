'use client';

import { AlertTriangle, ChevronRight, Clock, Loader2, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

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
import { apiClient } from '@/shared/lib/api-client';
import { formatDateTime } from '@/shared/lib/format-date';

interface StudentRow {
  student: { id: string; firstName: string; lastName: string; email: string };
  progressPercent: number;
  quizzesAverageScore: number | null;
  assignmentsAverageScore: number | null;
  lastActivityAt: string | null;
  totalStudyTimeSec: number;
  overdueAssignments: number;
  risks: string[];
}

interface Envelope<T> {
  data: T;
}

export default function GroupStudentsPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  const { data, isLoading } = useQuery({
    queryKey: ['stats', 'group', id, 'students'],
    queryFn: async () => {
      const r = await apiClient.get<Envelope<StudentRow[]>>(`/stats/groups/${id}/students`);
      return r.data.data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <Card className="flex items-center justify-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        Guruhda talabalar yo‘q
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
          <Users className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Guruh talabalari jadvali
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {data.length} talaba — progress, o&apos;qish vaqti, kechikkan topshiriqlar va xavf belgisi.
          </p>
        </div>
      </div>

      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Talaba</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Testlar</TableHead>
              <TableHead>Topshiriqlar</TableHead>
              <TableHead>Vaqt</TableHead>
              <TableHead>Oxirgi faollik</TableHead>
              <TableHead>Xavf</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((r) => (
              <TableRow key={r.student.id}>
                <TableCell>
                  <div className="font-medium text-foreground">
                    {r.student.firstName} {r.student.lastName}
                  </div>
                  <div className="text-xs text-muted-foreground">{r.student.email}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={r.progressPercent >= 60 ? 'default' : 'outline'}>
                    {r.progressPercent}%
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {r.quizzesAverageScore !== null ? `${r.quizzesAverageScore}%` : '—'}
                </TableCell>
                <TableCell className="text-sm">
                  {r.assignmentsAverageScore !== null
                    ? `${r.assignmentsAverageScore}%`
                    : '—'}
                  {r.overdueAssignments > 0 ? (
                    <Badge variant="destructive" className="ml-1 text-[10px]">
                      {r.overdueAssignments} muddat
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  <Clock className="mr-1 inline h-3 w-3" />
                  {formatStudyTime(r.totalStudyTimeSec)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {r.lastActivityAt ? formatDateTime(new Date(r.lastActivityAt)) : '—'}
                </TableCell>
                <TableCell>
                  {r.risks.length > 0 ? (
                    <Badge variant="destructive" className="inline-flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {r.risks.length}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/stats/students/${r.student.id}`}
                    className="inline-flex items-center text-xs font-medium text-primary hover:underline"
                  >
                    Karta <ChevronRight className="h-3 w-3" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function formatStudyTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}s ${m}d`;
  return `${m} daq`;
}
