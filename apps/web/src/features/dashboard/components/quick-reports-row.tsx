import { Droplets, Recycle, TreePine, Wind, type LucideIcon } from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent } from '@/shared/components/ui/card';
import { cn } from '@/shared/lib/cn';
import { QUICK_REPORTS } from '../data/mock';

const ICON: Record<string, LucideIcon> = {
  air:   Wind,
  water: Droplets,
  waste: Recycle,
  tree:  TreePine,
};

const TONE: Record<string, string> = {
  blue:    'bg-info-soft text-info',
  success: 'bg-primary-soft text-primary',
};

export function QuickReportsRow() {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Tezkor hisobotlar</h2>
        <Link
          href="/reports"
          className="text-xs font-semibold text-primary transition-colors hover:underline"
        >
          Barcha hisobotlar
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {QUICK_REPORTS.map((r) => {
          const Icon = ICON[r.icon]!;
          return (
            <Link key={r.key} href="/reports" className="block">
              <Card className="eco-card-hover cursor-pointer p-4">
                <CardContent className="flex items-center gap-3 p-0">
                  <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', TONE[r.tone])}>
                    <Icon className="h-5 w-5" strokeWidth={2.25} />
                  </div>
                  <span className="text-sm font-medium text-foreground">{r.label}</span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
