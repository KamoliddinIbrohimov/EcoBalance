'use client';

import type { GroupStatsDto, GroupWithTeacherDto } from '@eco/shared';
import { BarChart3, ChevronRight, Loader2, Users } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { groupsApi } from '@/features/groups/api/groups-api';
import { Badge } from '@/shared/components/ui/badge';
import { Card } from '@/shared/components/ui/card';
import { apiClient } from '@/shared/lib/api-client';
import { useAuthStore } from '@/shared/stores/auth-store';

interface Envelope<T> {
  data: T;
}

export default function StatsPage() {
  const user = useAuthStore((s) => s.user);
  const isStudent =
    user?.roles?.includes('STUDENT') &&
    !user?.roles?.includes('SUPER_ADMIN') &&
    !user?.roles?.includes('TEACHER');

  const { data: groups, isLoading } = useQuery({
    queryKey: ['groups', 'list'],
    queryFn: () => groupsApi.list(),
    enabled: !isStudent,
  });

  if (isStudent) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        <Link href="/stats/me" className="font-semibold text-primary hover:underline">
          O&apos;z natijalarimga o&apos;tish →
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
          <BarChart3 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Statistika</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Guruhlar bo&apos;yicha o&apos;rtacha progress, test o&apos;rtacha ball va tekshirilmagan topshiriqlar.
          </p>
        </div>
      </div>

      {isLoading ? (
        <Card className="flex items-center justify-center p-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </Card>
      ) : !groups || groups.data.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Hali guruhlar yo&apos;q. Avval guruhlar yarating.
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {groups.data.map((g) => (
            <GroupStatCard key={g.id} group={g} />
          ))}
        </ul>
      )}
    </div>
  );
}

function GroupStatCard({ group }: { group: GroupWithTeacherDto }) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats', 'group', group.id],
    queryFn: async () => {
      const res = await apiClient.get<Envelope<GroupStatsDto>>(`/stats/groups/${group.id}`);
      return res.data.data;
    },
  });

  return (
    <li>
      <Card className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h2 className="truncate text-base font-semibold text-foreground">{group.nameUz}</h2>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              O&apos;qituvchi: {group.teacher.firstName} {group.teacher.lastName}
            </p>
          </div>
          <Badge variant={group.isActive ? 'default' : 'outline'}>
            {group.memberCount} talaba
          </Badge>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : stats ? (
          <div className="grid grid-cols-3 gap-2">
            <StatCell label="Progress" value={`${stats.avgProgressPercent}%`} />
            <StatCell
              label="O'rt. ball"
              value={stats.avgQuizScore !== null ? `${stats.avgQuizScore}%` : '—'}
            />
            <StatCell label="Kutilgan" value={String(stats.pendingSubmissions)} highlight={stats.pendingSubmissions > 0} />
          </div>
        ) : null}

        <Link
          href={`/groups`}
          className="mt-auto flex items-center justify-end gap-1 text-xs font-medium text-primary hover:underline"
        >
          Guruhga o&apos;tish <ChevronRight className="h-3 w-3" />
        </Link>
      </Card>
    </li>
  );
}

function StatCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg px-2 py-2 text-center ${highlight ? 'bg-warning-soft text-warning' : 'bg-secondary/50 text-foreground'}`}
    >
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
