'use client';

import { Newspaper, TreePine, Users2 } from 'lucide-react';
import Link from 'next/link';

import { useNewsList } from '@/features/news/hooks/use-news';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

/**
 * Bosh sahifadagi yangiliklar oqimi — real DB'dan olinadi
 * (`/api/v1/news?isPublished=true`).
 */
export function NewsCard() {
  const { data, isLoading } = useNewsList({ page: 1, perPage: 5, isPublished: true });
  const items = data?.data ?? [];

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Yangiliklar</CardTitle>
        <Link
          href="/news"
          className="text-xs font-semibold text-primary transition-colors hover:underline"
        >
          Barchasini ko&apos;rish
        </Link>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 pt-0">
        {isLoading ? (
          <p className="py-4 text-center text-xs text-muted-foreground">Yuklanmoqda…</p>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Yangiliklar hozircha yo&apos;q.
          </p>
        ) : (
          items.map((n, idx) => (
            <article
              key={n.id}
              className="flex gap-3 border-b border-border/60 pb-3 last:border-b-0 last:pb-0"
            >
              <div
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${
                  idx % 2 === 0
                    ? 'bg-primary-soft text-primary'
                    : 'bg-info-soft text-info'
                }`}
                aria-hidden
              >
                {idx % 3 === 0 ? (
                  <TreePine className="h-6 w-6" />
                ) : idx % 3 === 1 ? (
                  <Users2 className="h-6 w-6" />
                ) : (
                  <Newspaper className="h-6 w-6" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-3 text-sm leading-snug text-foreground">{n.titleUz}</p>
                <time className="mt-1.5 block text-xs text-muted-foreground">
                  {new Date(n.publishedAt ?? n.createdAt).toLocaleDateString('uz-UZ')}
                </time>
              </div>
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}
