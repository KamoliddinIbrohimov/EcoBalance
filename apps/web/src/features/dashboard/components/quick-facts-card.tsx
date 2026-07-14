import {
  ArrowRight,
  Building2,
  GraduationCap,
  Home,
  MapPin,
  Radio,
} from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { QUICK_FACTS } from '../data/mock';

const ICON_BY_KEY = {
  schools:    Building2,
  kg:         Home,
  university: GraduationCap,
  mahallas:   MapPin,
  monitoring: Radio,
} as const;

export function QuickFactsCard() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Tezkor ma&apos;lumotlar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-3">
          {QUICK_FACTS.map((f) => {
            const Icon = ICON_BY_KEY[f.key];
            return (
              <li
                key={f.key}
                className="flex items-center justify-between gap-3 border-b border-border/60 pb-3 last:border-b-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm text-foreground">{f.label}</span>
                </div>
                <span className="text-sm font-semibold text-foreground">{f.value}</span>
              </li>
            );
          })}
        </ul>

        <Link
          href="/analytics"
          className="mt-2 flex items-center justify-end gap-1 text-sm font-semibold text-primary transition-colors hover:underline"
        >
          Batafsil ma&apos;lumot <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}
