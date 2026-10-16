'use client';

import { BarChart3 } from 'lucide-react';
import Link from 'next/link';

import { Card } from '@/shared/components/ui/card';
import { useAuthStore } from '@/shared/stores/auth-store';

export default function StatsPage() {
  const user = useAuthStore((s) => s.user);
  const isStudent = user?.roles?.includes('STUDENT') && !user?.roles?.includes('SUPER_ADMIN');

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
            Guruhlar va talabalar bo&apos;yicha ko&apos;rsatkichlar. Konkret guruh/talaba statistikasi uchun
            Guruhlar bo&apos;limiga o&apos;ting.
          </p>
        </div>
      </div>

      <Card className="p-10 text-center text-sm text-muted-foreground">
        Guruh yoki talabaga qarab statistikani ko&apos;rish uchun{' '}
        <Link href="/groups" className="font-semibold text-primary hover:underline">
          Guruhlar
        </Link>{' '}
        bo&apos;limiga o&apos;ting.
      </Card>
    </div>
  );
}
