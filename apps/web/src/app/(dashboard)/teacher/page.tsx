'use client';

import { ClipboardList, GraduationCap, Loader2, Users } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { Card } from '@/shared/components/ui/card';
import { UnderDevelopment } from '@/shared/components/layout/under-development';
import { apiClient } from '@/shared/lib/api-client';
import { useAuthStore } from '@/shared/stores/auth-store';

interface GroupMini {
  id: string;
  nameUz: string;
  memberCount: number;
  isActive: boolean;
}

interface AssignmentMini {
  id: string;
  status?: string;
}

interface SubmissionMini {
  id: string;
  status: 'SUBMITTED' | 'GRADED' | 'RETURNED' | 'PENDING_REVIEW';
}

export default function TeacherHomePage() {
  const user = useAuthStore((s) => s.user);
  const isTeacher = user?.roles?.includes('TEACHER') && !user?.roles?.includes('SUPER_ADMIN');

  const { data, isLoading } = useQuery({
    queryKey: ['teacher-home'],
    queryFn: async () => {
      const groupsRes = await apiClient.get<{ data: GroupMini[]; meta: { total: number } }>('/groups', {
        params: { page: 1, perPage: 10 },
      });
      return groupsRes.data;
    },
    enabled: !!isTeacher,
  });

  // U7: tekshirilmagan topshiriqlar soni — har bir topshiriqning submissions'ini
  // yig'ib SUBMITTED/PENDING_REVIEW holatidagilarini sanaymiz.
  const { data: pendingCount } = useQuery({
    queryKey: ['teacher-home', 'pending-submissions'],
    queryFn: async () => {
      const list = await apiClient.get<{ data: AssignmentMini[] }>('/assignments', {
        params: { page: 1, perPage: 100 },
      });
      let count = 0;
      for (const a of list.data.data) {
        try {
          const subs = await apiClient.get<{ data: SubmissionMini[] }>(
            `/assignments/${a.id}/submissions`,
          );
          for (const s of subs.data.data) {
            if (s.status === 'SUBMITTED' || s.status === 'PENDING_REVIEW') count++;
          }
        } catch {
          /* ignore */
        }
      }
      return count;
    },
    enabled: !!isTeacher,
  });

  if (!isTeacher) {
    return <UnderDevelopment description="Ushbu bo'lim faqat o'qituvchilar uchun." />;
  }

  const groups = data?.data ?? [];
  const totalStudents = groups.reduce((s, g) => s + g.memberCount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Salom, {user?.firstName}!
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Guruhlar, kurslar va topshiriqlaringiz bo&apos;yicha qisqa ko&apos;rinish.
        </p>
      </div>

      {isLoading ? (
        <Card className="flex items-center justify-center p-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          <StatCard
            icon={<Users className="h-5 w-5" />}
            label="Guruhlarim"
            value={String(groups.length)}
            href="/groups"
          />
          <StatCard
            icon={<GraduationCap className="h-5 w-5" />}
            label="Jami talabalar"
            value={String(totalStudents)}
            href="/groups"
          />
          <StatCard
            icon={<ClipboardList className="h-5 w-5" />}
            label="Tekshirilmagan"
            value={String(pendingCount ?? 0)}
            href="/assignments"
          />
        </div>
      )}

      <Card className="p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Mening guruhlarim
        </h2>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Hozircha guruhlar yo&apos;q.{' '}
            <Link href="/groups" className="font-semibold text-primary hover:underline">
              Guruh yarating →
            </Link>
          </p>
        ) : (
          <ul className="space-y-2">
            {groups.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-3"
              >
                <Link
                  href={`/groups/${g.id}`}
                  className="truncate font-medium text-foreground hover:underline"
                >
                  {g.nameUz}
                </Link>
                <span className="text-xs text-muted-foreground">{g.memberCount} talaba</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="flex items-center gap-3 p-5 transition-colors hover:border-primary/40">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
          {icon}
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-bold text-foreground">{value}</div>
        </div>
      </Card>
    </Link>
  );
}
