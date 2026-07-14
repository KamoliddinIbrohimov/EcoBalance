'use client';

import { ArrowLeft, Construction, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';

interface UnderDevelopmentProps {
  /** Optional phase label (e.g. "Phase 3"). Falls back to translation default. */
  phase?: string;
  /** Optional description override. */
  description?: string;
}

export function UnderDevelopment({ phase, description }: UnderDevelopmentProps) {
  const t = useTranslations('underDev');
  const pathname = usePathname();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center py-12 md:py-20">
      <Card className="w-full overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-warning to-info" />
        <CardContent className="flex flex-col items-center gap-5 p-10 text-center">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-warning-soft text-warning">
              <Construction className="h-10 w-10" strokeWidth={1.75} />
            </div>
            <div className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              {t('title')}
            </h1>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              {description ?? t('description')}
            </p>
          </div>

          {phase ? (
            <div className="rounded-full bg-primary-soft px-4 py-1.5 text-xs font-semibold text-primary">
              {phase}
            </div>
          ) : null}

          <div className="mt-2 flex flex-col items-center gap-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              {t('path')}
            </span>
            <code className="rounded-lg bg-secondary px-3 py-1.5 font-mono text-sm text-foreground">
              {pathname}
            </code>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                {t('backHome')}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
