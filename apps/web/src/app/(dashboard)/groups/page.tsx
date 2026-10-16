'use client';

import type { GroupWithTeacherDto } from '@eco/shared';
import { PERMISSION } from '@eco/shared';
import { Loader2, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { Badge } from '@/shared/components/ui/badge';
import { Card } from '@/shared/components/ui/card';
import { UnderDevelopment } from '@/shared/components/layout/under-development';
import { apiClient } from '@/shared/lib/api-client';
import { useAuthStore } from '@/shared/stores/auth-store';

interface Paginated<T> {
  data: T[];
  meta: { total: number };
}

export default function GroupsPage() {
  const canManage = useAuthStore((s) => s.hasPermission(PERMISSION.GROUPS_MANAGE));

  const { data, isLoading } = useQuery({
    queryKey: ['groups', 'list'],
    queryFn: async () => {
      const res = await apiClient.get<Paginated<GroupWithTeacherDto>>('/groups', {
        params: { page: 1, perPage: 50 },
      });
      return res.data;
    },
    enabled: canManage,
  });

  if (!canManage) {
    return <UnderDevelopment description="Guruhlar bo'limiga kirish uchun ruxsat yo'q." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
          <Users className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Guruhlar</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Guruhlarni boshqarish — o&apos;qituvchi o&apos;ziga tegishli, Super Admin barcha guruhlarni ko&apos;radi.
          </p>
        </div>
      </div>

      {isLoading ? (
        <Card className="flex items-center justify-center p-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </Card>
      ) : !data || data.data.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Hozircha guruhlar yo&apos;q. Super Admin tomonidan guruh yaratilishi kutilmoqda.
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.data.map((g) => (
            <li key={g.id}>
              <Card className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-semibold text-foreground">{g.nameUz}</h2>
                    {g.descriptionUz ? (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {g.descriptionUz}
                      </p>
                    ) : null}
                  </div>
                  <Badge variant={g.isActive ? 'default' : 'outline'}>
                    {g.isActive ? 'Faol' : 'Nofaol'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    O&apos;qituvchi:{' '}
                    <span className="font-medium text-foreground">
                      {g.teacher.firstName} {g.teacher.lastName}
                    </span>
                  </span>
                  <Badge variant="secondary">{g.memberCount} talaba</Badge>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
